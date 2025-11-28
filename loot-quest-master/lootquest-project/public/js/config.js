const Config = {
    API_BASE_URL: '/api',
    ENDPOINTS: {
        LOGIN: '/login',
        AUTH_GOOGLE: '/auth/google',
        AUTH_DISCORD: '/auth/discord',
        USER_PROFILE: '/user/profile',
        QUESTS: '/quests',
        SHOP: '/shop',
        HISTORY: '/history',
        LEADERBOARD: '/leaderboard',
        ADMIN_WITHDRAWALS: '/admin/withdrawals',
        GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent'
    },
    GEMINI_API_KEY: "" // To be injected or handled via backend proxy in production
};
