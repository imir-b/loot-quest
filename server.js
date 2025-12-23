/**
 * PixelRewards - Main Server
 * 
 * Express server for the PixelRewards GPT (Get-Paid-To) platform.
 * Handles user authentication, Lootably postbacks, and reward withdrawals.
 * 
 * @architecture
 * - SQLite database (sql.js - pure JavaScript) for persistent storage
 * - Firebase Admin SDK for JWT validation
 * - Server-side reward price validation
 * - 7-day retention rule for first withdrawal
 * 
 * @routes
 * POST   /api/user/login         - Validate Firebase JWT & sync user
 * GET    /api/user/balance       - Get user balance and stats
 * GET    /api/user/transactions  - Get transaction history
 * GET    /api/postback/lootably  - Handle Lootably postback (server-to-server)
 * GET    /api/rewards            - Get rewards catalog
 * POST   /api/withdraw           - Request reward withdrawal
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const admin = require('firebase-admin');
const geoip = require('geoip-lite');
const requestIp = require('request-ip');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// High-Performance Modules
const redis = require('./src/redis');
const { rateLimit, strictRateLimit, authRateLimit, withdrawRateLimit } = require('./src/rate-limiter');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
const LOOTABLY_SECRET = process.env.LOOTABLY_SECRET || 'your_lootably_secret_key';
const LOOTABLY_IP_WHITELIST = process.env.LOOTABLY_IP_WHITELIST
    ? process.env.LOOTABLY_IP_WHITELIST.split(',').map(ip => ip.trim())
    : [];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const SIGNUP_BONUS = 50; // Welcome bonus points
const JWT_SECRET = process.env.JWT_SECRET || 'lootquest_secret_key_change_in_production';
const JWT_EXPIRES_IN = '7d'; // Token expiration
const SALT_ROUNDS = 10; // bcrypt salt rounds

// Economy Configuration (60/40 Split)
const POINTS_PER_DOLLAR = 1000; // 1000 points = $1.00
const USER_SPLIT = 0.60; // User receives 60% of offer value
const PLATFORM_SPLIT = 0.40; // Platform keeps 40%

// Discord Webhook for Support Notifications
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE WRAPPER CLASS
// ═══════════════════════════════════════════════════════════════════════════

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'data', 'pixelrewards.db');
    }

    async init() {
        const SQL = await initSqlJs();

        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
            console.log('📂 Loaded existing database');
        } else {
            this.db = new SQL.Database();
            console.log('✨ Created new database');
            this.initSchema();
        }

        // ═══════════════════════════════════════════════════════════════
        // HIGH-PERFORMANCE SQLite Configuration
        // ═══════════════════════════════════════════════════════════════
        this.db.run('PRAGMA foreign_keys = ON');
        this.db.run('PRAGMA journal_mode = WAL');        // Write-Ahead Logging for concurrency
        this.db.run('PRAGMA synchronous = NORMAL');      // Faster writes, still safe
        this.db.run('PRAGMA cache_size = -64000');       // 64MB cache
        this.db.run('PRAGMA temp_store = MEMORY');       // Temp tables in RAM
        this.db.run('PRAGMA mmap_size = 268435456');     // 256MB memory-mapped I/O
        console.log('⚡ SQLite WAL mode enabled (high-performance)');
    }

    initSchema() {
        // Create tables if they don't exist
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT,
                display_name TEXT,
                avatar_url TEXT,
                provider TEXT DEFAULT 'email',
                firebase_uid TEXT,
                discord_id TEXT,
                discord_username TEXT,
                discord_avatar TEXT,
                balance INTEGER DEFAULT 0 CHECK(balance >= 0),
                total_earned INTEGER DEFAULT 0,
                total_withdrawn INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                first_withdrawal_at DATETIME,
                last_login_at DATETIME
            )
        `);

        // Add columns if they don't exist (for existing databases)
        try { this.db.run('ALTER TABLE users ADD COLUMN firebase_uid TEXT'); } catch (e) { }
        try { this.db.run('ALTER TABLE users ADD COLUMN discord_id TEXT'); } catch (e) { }
        try { this.db.run('ALTER TABLE users ADD COLUMN discord_username TEXT'); } catch (e) { }
        try { this.db.run('ALTER TABLE users ADD COLUMN discord_avatar TEXT'); } catch (e) { }

        this.db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
                source TEXT NOT NULL,
                offer_name TEXT,
                description TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                reward_id TEXT NOT NULL,
                reward_name TEXT NOT NULL,
                points_spent INTEGER NOT NULL,
                delivery_info TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'cancelled', 'failed')),
                admin_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create indexes
        this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

        // Support tickets table (for bug reports & contact forms)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('bug', 'contact')),
                email TEXT,
                subject TEXT NOT NULL,
                content TEXT NOT NULL,
                user_id TEXT,
                browser_info TEXT,
                page_url TEXT,
                status TEXT DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved', 'closed')),
                admin_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            )
        `);
        this.db.run('CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)');

        this.save();
    }

    // Execute SQL that returns no result
    run(sql, params = []) {
        this.db.run(sql, params);
        this.save();
    }

    // Get single row
    get(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }
        stmt.free();
        return null;
    }

    // Get all rows
    all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    // Save database to file
    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    // Close database
    close() {
        if (this.db) {
            this.save();
            this.db.close();
        }
    }
}

// Global database instance
const db = new Database();

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE ADMIN SDK INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

let firebaseInitialized = false;

function initFirebase() {
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            firebaseInitialized = true;
            console.log('🔥 Firebase Admin SDK initialized');
        } else {
            console.warn('⚠️  Firebase service account not found. Authentication will fail.');
            console.warn(`   Expected path: ${serviceAccountPath}`);
            console.warn('   Download from: Firebase Console > Project Settings > Service Accounts');
        }
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD REWARDS CATALOG
// ═══════════════════════════════════════════════════════════════════════════

let rewardsCatalog = { rewards: [] };

function loadRewards() {
    try {
        const rewardsPath = path.join(__dirname, 'rewards.json');
        rewardsCatalog = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
        console.log(`🎁 Loaded ${rewardsCatalog.rewards.length} rewards from catalog`);
    } catch (error) {
        console.error('❌ Failed to load rewards.json:', error.message);
    }
}

// Helper to get reward by ID
function getRewardById(rewardId) {
    return rewardsCatalog.rewards.find(r => r.id === rewardId) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://www.gstatic.com", "https://apis.google.com", "https://*.firebaseapp.com", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "wss://*.firebaseio.com", "https://lootably.com"],
            frameSrc: ["'self'", "https://*.firebaseapp.com", "https://lootably.com"],
        },
    },
}));

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: i18n Language Detection (GeoIP)
// ═══════════════════════════════════════════════════════════════════════════

// French-speaking countries
const FRENCH_COUNTRIES = ['FR', 'BE', 'CH', 'CA', 'LU', 'MC', 'SN', 'CI', 'MA', 'TN', 'DZ', 'HT', 'MG', 'ML', 'NE', 'BF', 'TD'];

/**
 * Detect user language from IP or cookie
 * Sets a 'lang' cookie if not present
 */
app.use((req, res, next) => {
    // Skip for API requests and static files
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }

    // Check if user already has a language preference
    let lang = req.cookies?.lang;

    if (!lang) {
        // Detect from IP address
        const ip = requestIp.getClientIp(req);
        const geo = geoip.lookup(ip);

        // Set language based on country
        lang = (geo && FRENCH_COUNTRIES.includes(geo.country)) ? 'fr' : 'en';

        // Set cookie for 1 year
        res.cookie('lang', lang, {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: false, // Allow JS access
            sameSite: 'Lax'
        });

        console.log(`🌍 GeoIP: ${ip} → ${geo?.country || 'Unknown'} → lang=${lang}`);
    }

    // Attach to request for other middleware
    req.lang = lang;
    next();
});

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Firebase JWT Verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Middleware to verify Firebase JWT token
 * Extracts user info and attaches to req.user
 */
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
        });
    }

    if (!firebaseInitialized) {
        return res.status(500).json({
            success: false,
            error: 'Firebase not configured on server'
        });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0],
            picture: decodedToken.picture,
            provider: decodedToken.firebase?.sign_in_provider || 'unknown'
        };
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Get client IP address
// ═══════════════════════════════════════════════════════════════════════════

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Generate JWT Token
// ═══════════════════════════════════════════════════════════════════════════

function generateToken(user) {
    return jwt.sign(
        {
            uid: user.id,
            email: user.email,
            provider: user.provider
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Verify Our Own JWT (for email/password auth)
// ═══════════════════════════════════════════════════════════════════════════

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
        });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            provider: decoded.provider
        };
        next();
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUTH MIDDLEWARE (supports both Firebase and our JWT)
// ═══════════════════════════════════════════════════════════════════════════

async function verifyAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid authorization header'
        });
    }

    const token = authHeader.split('Bearer ')[1];

    // Try our JWT first
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            provider: decoded.provider || 'email'
        };
        return next();
    } catch (jwtError) {
        // If not our JWT, try Firebase
        if (firebaseInitialized) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                req.user = {
                    uid: decodedToken.uid,
                    email: decodedToken.email,
                    name: decodedToken.name || decodedToken.email?.split('@')[0],
                    picture: decodedToken.picture,
                    provider: decodedToken.firebase?.sign_in_provider || 'google'
                };
                return next();
            } catch (firebaseError) {
                console.error('Firebase token verification failed:', firebaseError.message);
            }
        }

        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES (Email/Password)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * 
 * Register a new user with email and password.
 * Password is hashed with bcrypt before storage.
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Check if email already exists
        const existingUser = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate user ID
        const userId = uuidv4();
        const name = displayName || email.split('@')[0];

        // Create user
        db.run(`
            INSERT INTO users (id, email, password_hash, display_name, provider, balance, last_login_at)
            VALUES (?, ?, ?, ?, 'email', ?, datetime('now'))
        `, [userId, email.toLowerCase(), passwordHash, name, SIGNUP_BONUS]);

        // Add signup bonus transaction
        if (SIGNUP_BONUS > 0) {
            const txId = `bonus_${userId}_${Date.now()}`;
            db.run(`
                INSERT INTO transactions (id, user_id, amount, type, source, description)
                VALUES (?, ?, ?, 'credit', 'signup_bonus', 'Welcome bonus!')
            `, [txId, userId, SIGNUP_BONUS]);

            db.run('UPDATE users SET total_earned = total_earned + ? WHERE id = ?', [SIGNUP_BONUS, userId]);
        }

        const newUser = db.get('SELECT * FROM users WHERE id = ?', [userId]);

        // Generate JWT token
        const token = generateToken(newUser);

        console.log(`👤 New user registered (email): ${email}`);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                displayName: newUser.display_name,
                balance: newUser.balance,
                totalEarned: newUser.total_earned,
                provider: 'email',
                isNewUser: true,
                signupBonus: SIGNUP_BONUS
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * 
 * Login with email and password.
 * Returns JWT token on success.
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Check if this is an OAuth-only account
        if (!user.password_hash) {
            return res.status(401).json({
                success: false,
                error: 'This account uses Google/Discord login'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Update last login
        db.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

        // Generate JWT token
        const token = generateToken(user);

        console.log(`🔓 User logged in (email): ${email}`);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                balance: user.balance,
                totalEarned: user.total_earned,
                totalWithdrawn: user.total_withdrawn,
                provider: 'email'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * 
 * Get current user info from JWT token.
 */
app.get('/api/auth/me', verifyAuth, (req, res) => {
    try {
        const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.uid]);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                balance: user.balance,
                totalEarned: user.total_earned,
                totalWithdrawn: user.total_withdrawn,
                provider: user.provider || 'email'
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user info' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// HYBRID AUTH: Firebase (Google) + Discord OAuth2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/firebase
 * 
 * Verify Firebase idToken and create/link user account.
 * Links by email if account already exists (e.g., from Discord).
 */
app.post('/api/auth/firebase', async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, error: 'idToken is required' });
        }

        // Verify Firebase token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            console.error('Firebase token verification failed:', error.message);
            return res.status(401).json({ success: false, error: 'Invalid Firebase token' });
        }

        const { uid: firebaseUid, email, name, picture } = decodedToken;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required from Firebase' });
        }

        const emailLower = email.toLowerCase();

        // Check if user exists by email (could be from Discord or email registration)
        let user = db.get('SELECT * FROM users WHERE email = ?', [emailLower]);

        if (user) {
            // Link Firebase UID to existing account
            db.run(`
                UPDATE users 
                SET firebase_uid = ?,
                    display_name = COALESCE(?, display_name),
                    avatar_url = COALESCE(?, avatar_url),
                    last_login_at = datetime('now')
                WHERE email = ?
            `, [firebaseUid, name, picture, emailLower]);

            user = db.get('SELECT * FROM users WHERE email = ?', [emailLower]);
            console.log(`🔗 Linked Firebase to existing account: ${emailLower}`);
        } else {
            // Create new user with Firebase info
            const userId = uuidv4();
            db.run(`
                INSERT INTO users (id, email, display_name, avatar_url, provider, firebase_uid, balance, created_at, last_login_at)
                VALUES (?, ?, ?, ?, 'firebase', ?, 0, datetime('now'), datetime('now'))
            `, [userId, emailLower, name || email.split('@')[0], picture, firebaseUid]);

            user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
            console.log(`✨ New user created via Firebase: ${emailLower}`);
        }

        // Generate session JWT
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                balance: user.balance,
                totalEarned: user.total_earned,
                provider: user.provider,
                linkedAccounts: {
                    firebase: !!user.firebase_uid,
                    discord: !!user.discord_id
                }
            }
        });

    } catch (error) {
        console.error('Firebase auth error:', error);
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
});

/**
 * GET /api/auth/discord
 * 
 * Redirect to Discord OAuth2 authorization page.
 */
app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).json({ success: false, error: 'Discord OAuth not configured' });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify email'
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

/**
 * GET /api/auth/discord/callback
 * 
 * Handle Discord OAuth2 callback.
 * Exchange code for token, fetch user, create/link account by email.
 */
app.get('/api/auth/discord/callback', async (req, res) => {
    try {
        const { code, error: oauthError } = req.query;

        if (oauthError) {
            console.error('Discord OAuth error:', oauthError);
            return res.redirect('/?error=discord_denied');
        }

        if (!code) {
            return res.redirect('/?error=no_code');
        }

        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        const redirectUri = process.env.DISCORD_REDIRECT_URI;

        // Exchange code for access token
        let tokenResponse;
        try {
            tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
                new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri
                }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
            );
        } catch (error) {
            console.error('Discord token exchange failed:', error.response?.data || error.message);
            return res.redirect('/?error=token_exchange_failed');
        }

        const accessToken = tokenResponse.data.access_token;

        // Fetch Discord user profile
        let discordUser;
        try {
            const userResponse = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            discordUser = userResponse.data;
        } catch (error) {
            console.error('Discord user fetch failed:', error.response?.data || error.message);
            return res.redirect('/?error=user_fetch_failed');
        }

        const { id: discordId, email, username, avatar, global_name } = discordUser;

        if (!email) {
            return res.redirect('/?error=email_required');
        }

        const emailLower = email.toLowerCase();
        const displayName = global_name || username;
        const avatarUrl = avatar
            ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;

        // Check if user exists by email (could be from Firebase or email registration)
        let user = db.get('SELECT * FROM users WHERE email = ?', [emailLower]);

        if (user) {
            // Link Discord to existing account
            db.run(`
                UPDATE users 
                SET discord_id = ?,
                    discord_username = ?,
                    discord_avatar = ?,
                    display_name = COALESCE(display_name, ?),
                    avatar_url = COALESCE(avatar_url, ?),
                    last_login_at = datetime('now')
                WHERE email = ?
            `, [discordId, username, avatar, displayName, avatarUrl, emailLower]);

            user = db.get('SELECT * FROM users WHERE email = ?', [emailLower]);
            console.log(`🔗 Linked Discord to existing account: ${emailLower}`);
        } else {
            // Create new user with Discord info
            const userId = uuidv4();
            db.run(`
                INSERT INTO users (id, email, display_name, avatar_url, provider, discord_id, discord_username, discord_avatar, balance, created_at, last_login_at)
                VALUES (?, ?, ?, ?, 'discord', ?, ?, ?, 0, datetime('now'), datetime('now'))
            `, [userId, emailLower, displayName, avatarUrl, discordId, username, avatar]);

            user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
            console.log(`✨ New user created via Discord: ${emailLower}`);
        }

        // Generate session JWT
        const token = generateToken(user);

        // Redirect to frontend with token
        res.redirect(`/?token=${token}&provider=discord`);

    } catch (error) {
        console.error('Discord callback error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/user/login
 * 
 * Validates Firebase JWT and syncs user profile to database.
 * Creates new user if first login, updates last_login otherwise.
 * Awards signup bonus for new users.
 */
app.post('/api/user/login', verifyAuth, (req, res) => {
    try {
        const { uid, email, name, picture, provider } = req.user;

        // Check if user exists
        const existingUser = db.get('SELECT * FROM users WHERE id = ?', [uid]);

        if (existingUser) {
            // Update last login
            db.run(`
                UPDATE users 
                SET last_login_at = datetime('now'),
                    display_name = COALESCE(?, display_name),
                    avatar_url = COALESCE(?, avatar_url)
                WHERE id = ?
            `, [name, picture, uid]);

            const user = db.get('SELECT * FROM users WHERE id = ?', [uid]);

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    balance: user.balance,
                    totalEarned: user.total_earned,
                    totalWithdrawn: user.total_withdrawn,
                    createdAt: user.created_at,
                    isNewUser: false
                }
            });
        }

        // Create new user
        db.run(`
            INSERT INTO users (id, email, display_name, avatar_url, provider, balance, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `, [uid, email, name, picture, provider, SIGNUP_BONUS]);

        // Add signup bonus transaction
        if (SIGNUP_BONUS > 0) {
            const txId = `bonus_${uid}_${Date.now()}`;
            db.run(`
                INSERT INTO transactions (id, user_id, amount, type, source, description)
                VALUES (?, ?, ?, 'credit', 'signup_bonus', 'Welcome bonus!')
            `, [txId, uid, SIGNUP_BONUS]);

            // Update total earned
            db.run('UPDATE users SET total_earned = total_earned + ? WHERE id = ?', [SIGNUP_BONUS, uid]);
        }

        const newUser = db.get('SELECT * FROM users WHERE id = ?', [uid]);

        console.log(`👤 New user registered: ${email} (Bonus: ${SIGNUP_BONUS} pts)`);

        res.json({
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                displayName: newUser.display_name,
                avatarUrl: newUser.avatar_url,
                balance: newUser.balance,
                totalEarned: newUser.total_earned,
                totalWithdrawn: newUser.total_withdrawn,
                createdAt: newUser.created_at,
                isNewUser: true,
                signupBonus: SIGNUP_BONUS
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Database error during login' });
    }
});

/**
 * GET /api/user/balance
 * 
 * Returns the current user's balance and statistics.
 */
app.get('/api/user/balance', verifyAuth, (req, res) => {
    try {
        const user = db.get(`
            SELECT balance, total_earned, total_withdrawn, created_at, first_withdrawal_at 
            FROM users WHERE id = ?
        `, [req.user.uid]);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Calculate if 7-day rule applies
        let canWithdraw = true;
        let daysRemaining = 0;

        if (!user.first_withdrawal_at) {
            // First withdrawal check - using created_at
            const accountAge = Date.now() - new Date(user.created_at).getTime();
            if (accountAge < SEVEN_DAYS_MS) {
                canWithdraw = false;
                daysRemaining = Math.ceil((SEVEN_DAYS_MS - accountAge) / (24 * 60 * 60 * 1000));
            }
        }

        res.json({
            success: true,
            balance: user.balance,
            totalEarned: user.total_earned,
            totalWithdrawn: user.total_withdrawn,
            canWithdraw,
            daysRemaining,
            firstWithdrawalAt: user.first_withdrawal_at
        });

    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch balance' });
    }
});

/**
 * GET /api/user/transactions
 * 
 * Returns paginated transaction history for the current user.
 * Query params: limit (default 50), offset (default 0)
 */
app.get('/api/user/transactions', verifyAuth, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const transactions = db.all(`
            SELECT id, amount, type, source, offer_name, description, created_at
            FROM transactions 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [req.user.uid, limit, offset]);

        const countResult = db.get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [req.user.uid]);
        const total = countResult ? countResult.count : 0;

        res.json({
            success: true,
            transactions,
            pagination: {
                limit,
                offset,
                total,
                hasMore: offset + transactions.length < total
            }
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
});

/**
 * GET /api/user/withdrawals
 * 
 * Returns withdrawal history for the current user.
 */
app.get('/api/user/withdrawals', verifyAuth, (req, res) => {
    try {
        const withdrawals = db.all(`
            SELECT id, reward_id, reward_name, points_spent, status, created_at, completed_at
            FROM withdrawals 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.uid]);

        res.json({ success: true, withdrawals });

    } catch (error) {
        console.error('Withdrawals error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch withdrawals' });
    }
});

/**
 * GET /api/postback/lootably
 * 
 * Handles Lootably postback notifications.
 * Security: Validates secret key and optional IP whitelist.
 * Idempotency: Uses transaction_id to prevent double-crediting.
 * 
 * Expected query params:
 * - user_id: Firebase UID
 * - payout: Points to credit (in cents, we'll convert)
 * - transaction_id: Unique Lootably transaction ID
 * - secret: Your Lootably secret key
 * - offer_name (optional): Name of the completed offer
 */
app.get('/api/postback/lootably', (req, res) => {
    try {
        const clientIP = getClientIP(req);
        const { user_id, payout, transaction_id, secret, offer_name } = req.query;

        // Log postback attempt
        console.log(`📨 Postback received from ${clientIP}:`, { user_id, payout, transaction_id, offer_name });

        // Validate required parameters
        if (!user_id || !payout || !transaction_id || !secret) {
            console.warn('❌ Postback missing required params');
            return res.status(400).json({ success: false, error: 'Missing required parameters' });
        }

        // Validate secret key
        if (secret !== LOOTABLY_SECRET) {
            console.warn(`❌ Invalid secret from ${clientIP}`);
            return res.status(403).json({ success: false, error: 'Invalid secret key' });
        }

        // Validate IP whitelist (if configured)
        if (LOOTABLY_IP_WHITELIST.length > 0 && !LOOTABLY_IP_WHITELIST.includes(clientIP)) {
            console.warn(`❌ IP not whitelisted: ${clientIP}`);
            return res.status(403).json({ success: false, error: 'IP not authorized' });
        }

        // Parse payout (Lootably sends in cents, we store as points)
        const points = Math.floor(parseFloat(payout));
        if (isNaN(points) || points <= 0) {
            console.warn('❌ Invalid payout amount:', payout);
            return res.status(400).json({ success: false, error: 'Invalid payout amount' });
        }

        // Check if user exists
        const user = db.get('SELECT id FROM users WHERE id = ?', [user_id]);
        if (!user) {
            console.warn(`❌ User not found: ${user_id}`);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check for duplicate transaction (idempotency)
        const existingTx = db.get('SELECT id FROM transactions WHERE id = ?', [transaction_id]);
        if (existingTx) {
            console.log(`⚠️  Duplicate transaction ignored: ${transaction_id}`);
            return res.json({ success: true, message: 'Transaction already processed' });
        }

        // Insert transaction
        db.run(`
            INSERT INTO transactions (id, user_id, amount, type, source, offer_name, description, ip_address)
            VALUES (?, ?, ?, 'credit', 'lootably', ?, ?, ?)
        `, [
            transaction_id,
            user_id,
            points,
            offer_name || 'Offer completed',
            `Earned ${points} points from Lootably`,
            clientIP
        ]);

        // Update user balance and total earned
        db.run(`
            UPDATE users 
            SET balance = balance + ?, 
                total_earned = total_earned + ?
            WHERE id = ?
        `, [points, points, user_id]);

        console.log(`✅ Credited ${points} points to user ${user_id} (tx: ${transaction_id})`);

        res.json({ success: true, message: `Credited ${points} points` });

    } catch (error) {
        console.error('Postback error:', error);
        res.status(500).json({ success: false, error: 'Server error processing postback' });
    }
});

/**
 * GET /api/rewards
 * 
 * Returns the rewards catalog from rewards.json.
 * Public endpoint - no auth required.
 */
app.get('/api/rewards', (req, res) => {
    const { category } = req.query;

    let rewards = rewardsCatalog.rewards;

    // Filter by category if provided
    if (category && category !== 'all') {
        rewards = rewards.filter(r => r.category === category);
    }

    // Filter out of stock items (stock = 0)
    rewards = rewards.filter(r => r.stock !== 0);

    res.json({ success: true, rewards });
});

/**
 * POST /api/withdraw
 * 
 * Processes a withdrawal request.
 * 
 * Security measures:
 * 1. JWT authentication required
 * 2. Reward price fetched from server-side rewards.json (never trust client)
 * 3. 7-day retention rule for first withdrawal
 * 4. Balance check before processing
 * 
 * Body params:
 * - rewardId: ID of reward from rewards.json
 * - deliveryInfo (optional): Email, username, etc. for delivery
 */
app.post('/api/withdraw', verifyAuth, (req, res) => {
    try {
        const { rewardId, deliveryInfo } = req.body;
        const userId = req.user.uid;

        // Validate reward ID
        if (!rewardId) {
            return res.status(400).json({ success: false, error: 'Reward ID is required' });
        }

        // Get reward from server-side catalog (NEVER trust client price)
        const reward = getRewardById(rewardId);
        if (!reward) {
            return res.status(404).json({ success: false, error: 'Reward not found' });
        }

        // Check stock
        if (reward.stock === 0) {
            return res.status(400).json({ success: false, error: 'Reward is out of stock' });
        }

        // Get user from database
        const user = db.get(`
            SELECT balance, created_at, first_withdrawal_at 
            FROM users WHERE id = ?
        `, [userId]);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check 7-day rule for first withdrawal
        if (!user.first_withdrawal_at) {
            const accountAge = Date.now() - new Date(user.created_at).getTime();
            if (accountAge < SEVEN_DAYS_MS) {
                const daysRemaining = Math.ceil((SEVEN_DAYS_MS - accountAge) / (24 * 60 * 60 * 1000));
                return res.status(403).json({
                    success: false,
                    error: `First withdrawal requires 7 days. ${daysRemaining} day(s) remaining.`,
                    daysRemaining
                });
            }
        }

        // Check balance
        if (user.balance < reward.price) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance',
                required: reward.price,
                current: user.balance
            });
        }

        // Deduct balance
        db.run(`
            UPDATE users 
            SET balance = balance - ?, 
                total_withdrawn = total_withdrawn + ?,
                first_withdrawal_at = COALESCE(first_withdrawal_at, datetime('now'))
            WHERE id = ?
        `, [reward.price, reward.price, userId]);

        // Create debit transaction
        const txId = `withdraw_${userId}_${Date.now()}`;
        db.run(`
            INSERT INTO transactions (id, user_id, amount, type, source, description)
            VALUES (?, ?, ?, 'debit', 'withdrawal', ?)
        `, [txId, userId, reward.price, `Redeemed: ${reward.name}`]);

        // Create withdrawal record
        db.run(`
            INSERT INTO withdrawals (user_id, reward_id, reward_name, points_spent, delivery_info, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [userId, rewardId, reward.name, reward.price, deliveryInfo || null]);

        // Get the last insert ID (for the withdrawal)
        const lastWithdrawal = db.get('SELECT id FROM withdrawals ORDER BY id DESC LIMIT 1');
        const withdrawalId = lastWithdrawal ? lastWithdrawal.id : 0;

        // Get updated balance
        const updatedUser = db.get('SELECT balance FROM users WHERE id = ?', [userId]);

        console.log(`🎁 Withdrawal processed: ${reward.name} for user ${userId} (ID: ${withdrawalId})`);

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully!',
            withdrawal: {
                id: withdrawalId,
                reward: reward.name,
                pointsSpent: reward.price,
                status: 'pending'
            },
            newBalance: updatedUser ? updatedUser.balance : 0
        });

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (Optional - for manual management)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/stats
 * 
 * Returns platform statistics.
 * TODO: Add proper admin authentication
 */
app.get('/api/admin/stats', (req, res) => {
    try {
        const stats = {
            totalUsers: db.get('SELECT COUNT(*) as count FROM users')?.count || 0,
            totalTransactions: db.get('SELECT COUNT(*) as count FROM transactions')?.count || 0,
            totalPointsAwarded: db.get("SELECT COALESCE(SUM(amount), 0) as sum FROM transactions WHERE type = 'credit'")?.sum || 0,
            totalPointsRedeemed: db.get("SELECT COALESCE(SUM(points_spent), 0) as sum FROM withdrawals WHERE status != 'cancelled'")?.sum || 0,
            pendingWithdrawals: db.get("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'")?.count || 0
        };

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK & FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        firebaseConfigured: firebaseInitialized,
        rewardsLoaded: rewardsCatalog.rewards.length
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGAL PAGES API
// ═══════════════════════════════════════════════════════════════════════════

let legalContent = {};

function loadLegalContent() {
    try {
        const legalPath = path.join(__dirname, 'content', 'legal.json');
        if (fs.existsSync(legalPath)) {
            legalContent = JSON.parse(fs.readFileSync(legalPath, 'utf8'));
            console.log('⚖️  Loaded legal content');
        }
    } catch (error) {
        console.error('Failed to load legal.json:', error.message);
    }
}

/**
 * GET /api/legal/:page
 * Returns legal page content (terms-of-service, privacy-policy, cookie-policy)
 */
app.get('/api/legal/:page', (req, res) => {
    const page = req.params.page;
    const content = legalContent[page];

    if (!content) {
        return res.status(404).json({ success: false, error: 'Page not found' });
    }

    res.json({ success: true, content: content });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOG API
// ═══════════════════════════════════════════════════════════════════════════

let blogContent = { articles: [], categories: [] };

function loadBlogContent() {
    try {
        const blogPath = path.join(__dirname, 'content', 'blog.json');
        if (fs.existsSync(blogPath)) {
            blogContent = JSON.parse(fs.readFileSync(blogPath, 'utf8'));
            console.log(`📝 Loaded ${blogContent.articles.length} blog articles`);
        }
    } catch (error) {
        console.error('Failed to load blog.json:', error.message);
    }
}

/**
 * GET /api/blog
 * Returns list of blog articles (without full content)
 */
app.get('/api/blog', (req, res) => {
    const { category } = req.query;

    let articles = blogContent.articles.map(a => ({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        category: a.category,
        author: a.author,
        date: a.date,
        readTime: a.readTime,
        image: a.image,
        tags: a.tags
    }));

    // Filter by category
    if (category && category !== 'all') {
        articles = articles.filter(a => a.category === category);
    }

    res.json({
        success: true,
        articles,
        categories: blogContent.categories
    });
});

/**
 * GET /api/blog/:slug
 * Returns single blog article with full content
 */
app.get('/api/blog/:slug', (req, res) => {
    const article = blogContent.articles.find(a => a.slug === req.params.slug);

    if (!article) {
        return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Get related articles (same category, exclude current)
    const related = blogContent.articles
        .filter(a => a.category === article.category && a.slug !== article.slug)
        .slice(0, 3)
        .map(a => ({ slug: a.slug, title: a.title, image: a.image }));

    res.json({ success: true, article, related });
});

// ═══════════════════════════════════════════════════════════════════════════
// LOOTABLY POSTBACK (OFFER COMPLETION)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/postback/lootably
 * Server-to-server postback from Lootably when user completes an offer
 * 
 * Economy: User receives 60% of offer value
 * Formula: Points = USD * 1000 * 0.60
 * 
 * @query {string} user_id - LootQuest user ID
 * @query {number} payout - USD amount earned (e.g., 2.00)
 * @query {string} transaction_id - Unique Lootably transaction ID
 * @query {string} secret - Lootably secret key for validation
 * @query {string} offer_name - Optional offer name
 */
app.get('/api/postback/lootably', (req, res) => {
    const clientIP = getClientIP(req);

    try {
        const { user_id, payout, transaction_id, secret, offer_name } = req.query;

        // ─── VALIDATION ───

        // Check secret key
        if (secret !== LOOTABLY_SECRET) {
            console.log(`⚠️ Postback REJECTED: Invalid secret from ${clientIP}`);
            return res.status(403).send('INVALID_SECRET');
        }

        // Check required params
        if (!user_id || !payout || !transaction_id) {
            console.log(`⚠️ Postback REJECTED: Missing params from ${clientIP}`);
            return res.status(400).send('MISSING_PARAMS');
        }

        // Parse payout as float
        const payoutUSD = parseFloat(payout);
        if (isNaN(payoutUSD) || payoutUSD <= 0) {
            console.log(`⚠️ Postback REJECTED: Invalid payout ${payout}`);
            return res.status(400).send('INVALID_PAYOUT');
        }

        // IP Whitelist check (optional)
        if (LOOTABLY_IP_WHITELIST.length > 0 && !LOOTABLY_IP_WHITELIST.includes(clientIP)) {
            console.log(`⚠️ Postback REJECTED: IP ${clientIP} not whitelisted`);
            return res.status(403).send('IP_NOT_ALLOWED');
        }

        // ─── CHECK USER EXISTS ───

        const user = db.get('SELECT * FROM users WHERE id = ?', [user_id]);
        if (!user) {
            console.log(`⚠️ Postback REJECTED: User ${user_id} not found`);
            return res.status(404).send('USER_NOT_FOUND');
        }

        // ─── CHECK DUPLICATE TRANSACTION ───

        const existingTx = db.get('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
        if (existingTx) {
            console.log(`⚠️ Postback SKIPPED: Duplicate tx ${transaction_id}`);
            return res.status(200).send('DUPLICATE');
        }

        // ─── CALCULATE POINTS (60/40 SPLIT) ───

        // Formula: Points = USD * POINTS_PER_DOLLAR * USER_SPLIT
        const pointsToCredit = Math.floor(payoutUSD * POINTS_PER_DOLLAR * USER_SPLIT);
        const platformProfit = Math.floor(payoutUSD * POINTS_PER_DOLLAR * PLATFORM_SPLIT);

        // ─── CREDIT USER ───

        // Insert transaction
        db.run(`
            INSERT INTO transactions (id, user_id, amount, type, source, offer_name, description, ip_address)
            VALUES (?, ?, ?, 'credit', 'lootably', ?, ?, ?)
        `, [
            transaction_id,
            user_id,
            pointsToCredit,
            offer_name || 'Lootably Offer',
            `Earned ${pointsToCredit} pts from $${payoutUSD.toFixed(2)} offer (60% split)`,
            clientIP
        ]);

        // Update user balance and total_earned
        db.run(`
            UPDATE users 
            SET balance = balance + ?, 
                total_earned = total_earned + ?,
                last_login_at = datetime('now')
            WHERE id = ?
        `, [pointsToCredit, pointsToCredit, user_id]);

        // ─── LOG SUCCESS ───

        console.log('════════════════════════════════════════════════════════');
        console.log('💰 LOOTABLY POSTBACK SUCCESS');
        console.log(`   User: ${user_id}`);
        console.log(`   Received: $${payoutUSD.toFixed(2)}`);
        console.log(`   Credited: ${pointsToCredit} points (60%)`);
        console.log(`   Platform: ${platformProfit} points (40%)`);
        console.log(`   TX ID: ${transaction_id}`);
        console.log(`   Offer: ${offer_name || 'N/A'}`);
        console.log('════════════════════════════════════════════════════════');

        res.status(200).send('OK');

    } catch (error) {
        console.error('❌ Postback ERROR:', error);
        res.status(500).send('SERVER_ERROR');
    }
});

/**
 * GET /api/status
 * Returns server status for the footer indicator
 */
app.get('/api/status', (req, res) => {
    res.json({
        status: 'operational',
        services: {
            database: true,
            offers: true,
            rewards: true
        },
        uptime: process.uptime()
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT TICKETS API (Bug Reports & Contact)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send Discord Webhook notification for new support tickets
 */
async function sendDiscordNotification(ticket) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        const color = ticket.type === 'bug' ? 0xFF6B6B : 0x00D9FF; // Red for bugs, Cyan for contact
        const emoji = ticket.type === 'bug' ? '🐛' : '📩';

        const payload = {
            embeds: [{
                title: `${emoji} New ${ticket.type === 'bug' ? 'Bug Report' : 'Contact Message'}`,
                color: color,
                fields: [
                    { name: '📋 Subject', value: ticket.subject, inline: false },
                    { name: '📧 Email', value: ticket.email || 'Not provided', inline: true },
                    { name: '🆔 Ticket ID', value: `#${ticket.id}`, inline: true },
                    { name: '📝 Message', value: ticket.content.substring(0, 500) + (ticket.content.length > 500 ? '...' : ''), inline: false }
                ],
                footer: { text: 'LootQuest Support System' },
                timestamp: new Date().toISOString()
            }]
        };

        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`📨 Discord notification sent for ticket #${ticket.id}`);
    } catch (error) {
        console.error('Discord webhook error:', error.message);
    }
}

/**
 * POST /api/support/bug
 * Submit a bug report
 */
app.post('/api/support/bug', async (req, res) => {
    try {
        const { subject, content, email, browserInfo, pageUrl } = req.body;

        // Validation
        if (!subject || !content) {
            return res.status(400).json({
                success: false,
                error: 'Subject and description are required'
            });
        }

        if (subject.length < 5 || subject.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Subject must be between 5 and 200 characters'
            });
        }

        if (content.length < 20 || content.length > 5000) {
            return res.status(400).json({
                success: false,
                error: 'Description must be between 20 and 5000 characters'
            });
        }

        // Get user ID if authenticated
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split('Bearer ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.uid;
            } catch (e) { /* ignore */ }
        }

        // Insert ticket
        db.run(`
            INSERT INTO support_tickets (type, email, subject, content, user_id, browser_info, page_url)
            VALUES ('bug', ?, ?, ?, ?, ?, ?)
        `, [email || null, subject, content, userId, browserInfo || null, pageUrl || null]);

        // Get the inserted ticket ID
        const ticket = db.get('SELECT * FROM support_tickets ORDER BY id DESC LIMIT 1');

        console.log(`🐛 Bug Report #${ticket.id}: "${subject}"`);

        // Send Discord notification
        await sendDiscordNotification(ticket);

        res.status(201).json({
            success: true,
            message: 'Bug report submitted successfully. Thank you!',
            ticketId: ticket.id
        });

    } catch (error) {
        console.error('Bug report error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit bug report' });
    }
});

/**
 * POST /api/support/contact
 * Submit a contact message
 */
app.post('/api/support/contact', async (req, res) => {
    try {
        const { email, subject, content } = req.body;

        // Validation
        if (!email || !subject || !content) {
            return res.status(400).json({
                success: false,
                error: 'Email, subject and message are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        if (subject.length < 3 || subject.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Subject must be between 3 and 200 characters'
            });
        }

        if (content.length < 10 || content.length > 5000) {
            return res.status(400).json({
                success: false,
                error: 'Message must be between 10 and 5000 characters'
            });
        }

        // Get user ID if authenticated
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split('Bearer ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.uid;
            } catch (e) { /* ignore */ }
        }

        // Insert ticket
        db.run(`
            INSERT INTO support_tickets (type, email, subject, content, user_id)
            VALUES ('contact', ?, ?, ?, ?)
        `, [email, subject, content, userId]);

        // Get the inserted ticket ID
        const ticket = db.get('SELECT * FROM support_tickets ORDER BY id DESC LIMIT 1');

        console.log(`📩 Contact Message #${ticket.id}: "${subject}" from ${email}`);

        // Send Discord notification
        await sendDiscordNotification(ticket);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully. We\'ll respond within 24-48 hours.',
            ticketId: ticket.id
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// BUG REPORTS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/report
 * Submit a bug report (public, optionally authenticated)
 */
app.post('/api/report', async (req, res) => {
    try {
        const { category, title, description, browserInfo, pageUrl, email } = req.body;

        // Validation
        if (!category || !title || !description) {
            return res.status(400).json({
                success: false,
                error: 'Category, title and description are required'
            });
        }

        if (title.length < 5 || title.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'Title must be between 5 and 200 characters'
            });
        }

        if (description.length < 20 || description.length > 5000) {
            return res.status(400).json({
                success: false,
                error: 'Description must be between 20 and 5000 characters'
            });
        }

        // Try to get user from token if provided
        let userId = null;
        let userEmail = email || null;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.uid;
                userEmail = decoded.email;
            } catch (e) {
                // Token invalid, continue as anonymous
            }
        }

        // Insert bug report
        db.run(`
            INSERT INTO bug_reports (user_id, user_email, category, title, description, browser_info, page_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, userEmail, category, title, description, browserInfo || null, pageUrl || null]);

        console.log(`🐛 New bug report: "${title}" from ${userEmail || 'anonymous'}`);

        res.status(201).json({
            success: true,
            message: 'Bug report submitted successfully. Thank you for helping us improve!'
        });

    } catch (error) {
        console.error('Bug report error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit bug report' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PANEL API
// ═══════════════════════════════════════════════════════════════════════════

// Simple admin auth check (in production, use proper admin roles)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'lootquest_admin_2024';

function verifyAdmin(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

/**
 * GET /api/admin/reports
 * List all bug reports (admin only)
 */
app.get('/api/admin/reports', verifyAdmin, (req, res) => {
    try {
        const status = req.query.status || 'all';

        let sql = 'SELECT * FROM bug_reports ORDER BY created_at DESC';
        let params = [];

        if (status !== 'all') {
            sql = 'SELECT * FROM bug_reports WHERE status = ? ORDER BY created_at DESC';
            params = [status];
        }

        const reports = db.all(sql, params);

        // Get stats
        const stats = {
            total: db.get('SELECT COUNT(*) as count FROM bug_reports')?.count || 0,
            new: db.get("SELECT COUNT(*) as count FROM bug_reports WHERE status = 'new'")?.count || 0,
            in_progress: db.get("SELECT COUNT(*) as count FROM bug_reports WHERE status = 'in_progress'")?.count || 0,
            resolved: db.get("SELECT COUNT(*) as count FROM bug_reports WHERE status = 'resolved'")?.count || 0
        };

        res.json({ success: true, reports, stats });

    } catch (error) {
        console.error('Admin reports error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reports' });
    }
});

/**
 * PATCH /api/admin/reports/:id
 * Update bug report status (admin only)
 */
app.patch('/api/admin/reports/:id', verifyAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;

        const report = db.get('SELECT * FROM bug_reports WHERE id = ?', [id]);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const validStatuses = ['new', 'in_progress', 'resolved', 'wont_fix'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        if (status) {
            db.run('UPDATE bug_reports SET status = ? WHERE id = ?', [status, id]);
            if (status === 'resolved') {
                db.run("UPDATE bug_reports SET resolved_at = datetime('now') WHERE id = ?", [id]);
            }
        }

        if (adminNotes !== undefined) {
            db.run('UPDATE bug_reports SET admin_notes = ? WHERE id = ?', [adminNotes, id]);
        }

        const updated = db.get('SELECT * FROM bug_reports WHERE id = ?', [id]);
        res.json({ success: true, report: updated });

    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ success: false, error: 'Failed to update report' });
    }
});

/**
 * DELETE /api/admin/reports/:id
 * Delete a bug report (admin only)
 */
app.delete('/api/admin/reports/:id', verifyAdmin, (req, res) => {
    try {
        const { id } = req.params;

        const report = db.get('SELECT * FROM bug_reports WHERE id = ?', [id]);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        db.run('DELETE FROM bug_reports WHERE id = ?', [id]);
        res.json({ success: true, message: 'Report deleted' });

    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete report' });
    }
});

/**
 * GET /api/admin/stats
 * Get platform statistics (admin only)
 */
app.get('/api/admin/stats', verifyAdmin, (req, res) => {
    try {
        const stats = {
            users: {
                total: db.get('SELECT COUNT(*) as count FROM users')?.count || 0,
                today: db.get("SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')")?.count || 0
            },
            transactions: {
                total: db.get('SELECT COUNT(*) as count FROM transactions')?.count || 0,
                credits: db.get("SELECT SUM(amount) as sum FROM transactions WHERE type = 'credit'")?.sum || 0,
                debits: db.get("SELECT SUM(amount) as sum FROM transactions WHERE type = 'debit'")?.sum || 0
            },
            withdrawals: {
                pending: db.get("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'")?.count || 0,
                completed: db.get("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'completed'")?.count || 0
            },
            bugReports: {
                total: db.get('SELECT COUNT(*) as count FROM bug_reports')?.count || 0,
                new: db.get("SELECT COUNT(*) as count FROM bug_reports WHERE status = 'new'")?.count || 0
            }
        };

        res.json({ success: true, stats });

    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

async function startServer() {
    // Initialize database
    await db.init();

    // Initialize Firebase
    initFirebase();

    // Load rewards
    loadRewards();

    // Load content
    loadLegalContent();
    loadBlogContent();

    // Start Express server
    app.listen(PORT, () => {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('   🎮 LootQuest Server Started');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`   📍 URL: http://localhost:${PORT}`);
        console.log(`   🗄️  Database: ${db.dbPath}`);
        console.log(`   🔥 Firebase: ${firebaseInitialized ? 'Configured ✅' : 'Not configured ⚠️'}`);
        console.log(`   🎁 Rewards: ${rewardsCatalog.rewards.length} items loaded`);
        console.log(`   📝 Blog: ${blogContent.articles.length} articles loaded`);
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('');
        console.log('   Postback URL for Lootably:');
        console.log(`   https://yourdomain.com/api/postback/lootably?user_id={user_id}&payout={payout}&transaction_id={transaction_id}&secret=${LOOTABLY_SECRET}`);
        console.log('');

        // Signal PM2 that the application is ready
        if (process.send) {
            process.send('ready');
            console.log('   ✅ Sent ready signal to PM2');
        }
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close();
    process.exit(0);
});

// Start the server
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
