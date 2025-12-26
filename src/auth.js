/**
 * Authentication Module - Session Management & Middleware
 * 
 * Provides:
 * - Redis-backed session store (connect-redis v9)
 * - Firebase token verification
 * - Session-based authentication middleware
 * - User sync with SQLite database
 * 
 * @module auth
 */

const session = require('express-session');
const { getClient } = require('./redis');

// connect-redis v7+ / v9 exports a default constructor
const RedisStore = require('connect-redis').default;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'lootquest_session_secret_change_in_production';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_NAME = 'lq_session';

// ═══════════════════════════════════════════════════════════════════════════
// REDIS SESSION STORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Redis session store
 * For connect-redis v9, pass the ioredis client directly
 * @returns {RedisStore} Redis session store instance
 */
function createSessionStore() {
    try {
        const redisClient = getClient();

        // connect-redis v9 expects the client in the constructor options
        return new RedisStore({
            client: redisClient,
            prefix: 'lq:session:',
            ttl: Math.floor(SESSION_MAX_AGE / 1000) // TTL in seconds
        });
    } catch (err) {
        console.error('Failed to create Redis session store:', err.message);
        // Fallback: return null and use MemoryStore
        return null;
    }
}

/**
 * Session middleware configuration
 * @param {boolean} isProduction - Whether running in production
 * @returns {Function} Express session middleware
 */
function createSessionMiddleware(isProduction = false) {
    const store = createSessionStore();

    const sessionConfig = {
        name: SESSION_NAME,
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        rolling: true, // Reset maxAge on every request
        cookie: {
            secure: true,             // Always HTTPS (required for SameSite=None)
            httpOnly: true,           // Prevent XSS access
            maxAge: SESSION_MAX_AGE,
            sameSite: 'none',         // Allow cross-site cookies (fixes Tracking Prevention)
        }
    };

    // Only use Redis store if available
    if (store) {
        sessionConfig.store = store;
        console.log('✅ Redis session store configured');
    } else {
        console.warn('⚠️ Using in-memory session store (Redis unavailable)');
    }

    return session(sessionConfig);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Middleware: Check if user is authenticated via session
 * Attaches user data to req.user if authenticated
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        code: 'AUTH_REQUIRED'
    });
}

/**
 * Middleware: Optional authentication
 * Attaches user if logged in, but doesn't block if not
 */
function optionalAuth(req, res, next) {
    if (req.session && req.session.user) {
        req.user = req.session.user;
    }
    next();
}

/**
 * Create user session after successful authentication
 * @param {Object} req - Express request
 * @param {Object} userData - User data to store in session
 */
function createUserSession(req, userData) {
    req.session.user = {
        id: userData.id,
        firebase_uid: userData.firebase_uid,
        email: userData.email,
        username: userData.username,
        picture: userData.picture,
        provider: userData.provider,
        loginTime: Date.now()
    };
}

/**
 * Destroy user session (logout)
 * @param {Object} req - Express request
 * @returns {Promise<void>}
 */
function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    createSessionMiddleware,
    createSessionStore,
    isAuthenticated,
    optionalAuth,
    createUserSession,
    destroySession,
    SESSION_NAME
};
