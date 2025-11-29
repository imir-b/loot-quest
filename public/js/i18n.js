/**
 * LootQuest Internationalization (i18n)
 * Handles automatic language detection (IP-based) and manual toggling.
 */

const I18n = {
    currentLang: 'fr', // Default
    translations: {
        fr: {
            // Navbar
            "nav.login": "CONNEXION",
            "nav.dashboard": "Base Principale",
            "nav.earn": "Quêtes & Pubs",
            "nav.loot": "Loot Shop",
            "nav.leaderboard": "Hall of Fame",
            "nav.inventory": "Coffre / Historique",
            "nav.aiSupport": "Assistant IA",
            "nav.support": "Aide & Support",
            "nav.legal": "Légal",
            "nav.admin": "Admin Panel",
            "nav.logout": "DÉCONNEXION",

            // Hero
            "hero.season": "Saison 1 Active",
            "hero.title.1": "JOUE.",
            "hero.title.2": "FARME.",
            "hero.title.3": "RETIRE.",
            "hero.subtitle": "Arrête de jouer gratuitement. Rejoins la guilde, regarde des pubs, invite tes amis et échange tes Pixels contre des V-Bucks & Cartes Cadeaux.",
            "hero.cta.join": "COMMENCE À FARMER",
            "hero.cta.loot": "VOIR LE BUTIN",

            // Mockup
            "mockup.inventory": "INVENTAIRE",
            "mockup.ready": "Prêt à retirer",

            // How it works
            "how.title": "COMMENT GAGNER DES PIXELS",
            "how.step1.title": "1. Regarde & Installe",
            "how.step1.desc": "L'argent magique n'existe pas : ce sont les pubs qui paient. Regarde des vidéos courtes ou installe des jeux partenaires pour gagner tes premiers Pixels.",
            "how.step2.title": "2. Partage à ta Squad",
            "how.step2.desc": "Poste ton lien unique sur TikTok ou Discord. Tu gagnes des Pixels à chaque fois qu'un pote clique dessus. C'est le moyen le plus rapide de farm.",
            "how.step3.title": "3. Encaisse le Loot",
            "how.step3.desc": "Dès que tu as assez de Pixels, échange-les instantanément contre des cartes cadeaux officielles (Robux, V-Bucks, Paysafecard).",

            // Secure Vault
            "vault.badge": "SECURE VAULT™",
            "vault.title": "Protocole de Retrait Anti-Bot",
            "vault.feat1.title": "Premier Retrait : 7 Jours",
            "vault.feat1.desc": "Vérification manuelle obligatoire pour le premier paiement. On s'assure juste que tu n'es pas un script russe.",
            "vault.feat2.title": "Ensuite : Speed Run",
            "vault.feat2.desc": "Une fois vérifié \"Humain\", tous les retraits suivants sont validés en 24h-48h max.",

            // Footer
            "footer.disclaimer": "LootQuest n'est pas affilié à Roblox, Epic Games, ou Microsoft. Plateforme de récompenses publicitaires pour gamers.",
            "footer.cgu": "CGU",
            "footer.privacy": "Confidentialité",
            "footer.support": "Support",

            // Login Modal
            "login.title": "IDENTIFICATION",
            "login.subtitle": "Connecte-toi pour sauvegarder tes Pixels.",
            "login.discord": "Continuer avec Discord",
            "login.google": "Continuer avec Google",
            "login.classic": "OU CLASSIQUE",
            "login.email_label": "EMAIL DU JOUEUR",
            "login.submit": "LANCER LA SESSION",
            "login.cookie": "En te connectant, tu acceptes que nous utilisions des cookies pour tracker tes quêtes.",

            // App Header
            "app.rank": "RANG: NOVICE",

            // Toast
            "toast.won": "Vient de gagner"
        },
        en: {
            // Navbar
            "nav.login": "LOGIN",
            "nav.dashboard": "Main Base",
            "nav.earn": "Quests & Ads",
            "nav.loot": "Loot Shop",
            "nav.leaderboard": "Hall of Fame",
            "nav.inventory": "Vault / History",
            "nav.aiSupport": "AI Assistant",
            "nav.support": "Help & Support",
            "nav.legal": "Legal",
            "nav.admin": "Admin Panel",
            "nav.logout": "LOGOUT",

            // Hero
            "hero.season": "Season 1 Active",
            "hero.title.1": "PLAY.",
            "hero.title.2": "FARM.",
            "hero.title.3": "WITHDRAW.",
            "hero.subtitle": "Stop playing for free. Join the guild, watch ads, invite friends, and exchange your Pixels for V-Bucks & Gift Cards.",
            "hero.cta.join": "START FARMING",
            "hero.cta.loot": "VIEW LOOT",

            // Mockup
            "mockup.inventory": "INVENTORY",
            "mockup.ready": "Ready to withdraw",

            // How it works
            "how.title": "HOW TO EARN PIXELS",
            "how.step1.title": "1. Watch & Install",
            "how.step1.desc": "Magic money doesn't exist: ads pay the bills. Watch short videos or install partner games to earn your first Pixels.",
            "how.step2.title": "2. Share with Squad",
            "how.step2.desc": "Post your unique link on TikTok or Discord. You earn Pixels every time a friend clicks on it. It's the fastest way to farm.",
            "how.step3.title": "3. Cash Out Loot",
            "how.step3.desc": "As soon as you have enough Pixels, exchange them instantly for official gift cards (Robux, V-Bucks, Paysafecard).",

            // Secure Vault
            "vault.badge": "SECURE VAULT™",
            "vault.title": "Anti-Bot Withdrawal Protocol",
            "vault.feat1.title": "First Withdrawal: 7 Days",
            "vault.feat1.desc": "Manual verification mandatory for the first payment. We just want to make sure you're not a Russian script.",
            "vault.feat2.title": "Then: Speed Run",
            "vault.feat2.desc": "Once verified as \"Human\", all subsequent withdrawals are validated within 24h-48h max.",

            // Footer
            "footer.disclaimer": "LootQuest is not affiliated with Roblox, Epic Games, or Microsoft. Advertising rewards platform for gamers.",
            "footer.cgu": "Terms",
            "footer.privacy": "Privacy",
            "footer.support": "Support",

            // Login Modal
            "login.title": "IDENTIFICATION",
            "login.subtitle": "Log in to save your Pixels.",
            "login.discord": "Continue with Discord",
            "login.google": "Continue with Google",
            "login.classic": "OR CLASSIC",
            "login.email_label": "PLAYER EMAIL",
            "login.submit": "START SESSION",
            "login.cookie": "By logging in, you accept that we use cookies to track your quests.",

            // App Header
            "app.rank": "RANK: NOVICE",

            // Toast
            "toast.won": "Just won"
        }
    },

    init: async function () {
        // 1. Check LocalStorage
        const storedLang = localStorage.getItem('lootquest_lang');

        if (storedLang) {
            this.setLanguage(storedLang);
        } else {
            // 2. Check IP (only if no preference stored)
            try {
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                if (data.country_code !== 'FR') {
                    this.setLanguage('en');
                } else {
                    this.setLanguage('fr');
                }
            } catch (e) {
                console.warn('IP detection failed, defaulting to FR', e);
                this.setLanguage('fr');
            }
        }

        // 3. Bind Toggle Button
        const toggleBtn = document.getElementById('lang-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
            this.updateToggleButton();
        }
    },

    setLanguage: function (lang) {
        if (!this.translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem('lootquest_lang', lang);

        // Update DOM
        document.documentElement.lang = lang;
        this.translatePage();
        this.updateToggleButton();

        // Dispatch event
        window.dispatchEvent(new CustomEvent('i18n:languageChanged', { detail: { lang } }));
    },

    toggle: function () {
        const newLang = this.currentLang === 'fr' ? 'en' : 'fr';
        this.setLanguage(newLang);
    },

    translatePage: function () {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.translations[this.currentLang][key];
            if (translation) {
                // Handle HTML content if needed, or just text
                if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                    // Special case for placeholders if we had any, but currently handled via text mostly
                    // If we want to translate placeholders, we need a convention like data-i18n-placeholder
                }

                // Preserve icons if they are separate, but here we replace content.
                // If the element has children (like icons), we might need a specific span for text.
                // For this implementation, I'll assume data-i18n is on the text container.
                // If the element contains an icon, we should wrap the text in a span with data-i18n.

                el.innerHTML = translation;
            }
        });

        // Special handling for placeholders
        const inputs = document.querySelectorAll('[data-i18n-placeholder]');
        inputs.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.translations[this.currentLang][key];
            if (translation) el.placeholder = translation;
        });
    },

    updateToggleButton: function () {
        const toggleBtn = document.getElementById('lang-toggle');
        if (!toggleBtn) return;

        // Show the flag of the OTHER language (to switch to)
        // OR show current flag. User requested "bouton drapeiau fr americain".
        // Let's show the flag of the CURRENT language, or a toggle switch.
        // Common pattern: Show the flag of the language you are currently using, or both.
        // Let's use a simple text/emoji toggle: "🇫🇷" or "🇺🇸"

        toggleBtn.innerHTML = this.currentLang === 'fr' ? '🇺🇸' : '🇫🇷';
        toggleBtn.title = this.currentLang === 'fr' ? 'Switch to English' : 'Passer en Français';
    },

    // Helper to get text
    t: function (key) {
        return this.translations[this.currentLang][key] || key;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});
