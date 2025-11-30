require('dotenv').config(); // Charge ton fichier .env
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');

const app = express();

// --- 1. CONFIGURATION DE LA SESSION ---
// C'est ce qui permet à l'utilisateur de rester connecté quand il change de page
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Mettre 'true' si tu passes en HTTPS plus tard
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Initialisation de Passport
app.use(passport.initialize());
app.use(passport.session());

// --- 2. FONCTIONS DE SÉRIALISATION ---
// Comment stocker l'utilisateur dans le cookie (Session)
passport.serializeUser((user, done) => {
    done(null, user); // On stocke tout l'objet user pour l'instant (plus tard : juste l'ID)
});

passport.deserializeUser((obj, done) => {
    done(null, obj); // On récupère l'objet user
});

// --- 3. STRATÉGIE GOOGLE ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  (accessToken, refreshToken, profile, done) => {
    // C'est ICI que tu feras la requête SQL pour sauvegarder l'user en base de données.
    // Pour l'instant, on simule un utilisateur :
    const user = {
        id: profile.id,
        username: profile.displayName,
        email: profile.emails[0].value,
        provider: 'google',
        avatar: profile.photos[0].value
    };
    console.log("Google User connecté :", user.username);
    return done(null, user);
  }
));

// --- 4. STRATÉGIE DISCORD ---
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email'] // On demande l'ID et l'Email
  },
  (accessToken, refreshToken, profile, done) => {
    // Simulation DB
    const user = {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        provider: 'discord',
        avatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    };
    console.log("Discord User connecté :", user.username);
    return done(null, user);
  }
));

// --- 5. ROUTES D'AUTHENTIFICATION ---

// Route : Lancer la connexion Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route : Retour de Google (Callback)
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Succès ! On redirige vers l'application
    res.redirect('/app');
  }
);

// Route : Lancer la connexion Discord
app.get('/auth/discord',
  passport.authenticate('discord')
);

// Route : Retour de Discord (Callback)
app.get('/auth/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/app');
  }
);

// Route : Déconnexion
app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// --- 6. ROUTES DE L'APPLICATION ---

// Servir les fichiers statiques (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '../public')));

// Route principale (Landing Page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Route de l'App (Protégée : accessible seulement si connecté)
app.get('/app', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../public', 'app.html'));
    } else {
        res.redirect('/'); // Si pas connecté, retour à l'accueil
    }
});

// API pour que le Frontend récupère les infos du user connecté
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ error: "Non connecté" });
    }
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur LootQuest démarré sur http://localhost:${PORT}`);
});
