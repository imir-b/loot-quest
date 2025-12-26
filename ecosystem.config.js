/**
 * PM2 Ecosystem Configuration
 * 
 * Cluster mode for 12 vCore VPS.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 * 
 * @see https://pm2.keymetrics.io/docs/usage/cluster-mode/
 */

module.exports = {
    apps: [{
        name: 'lootquest',
        script: 'server.js',

        // ═══════════════════════════════════════════════════════════════
        // SINGLE INSTANCE MODE (temporary - until Redis is configured)
        // ═══════════════════════════════════════════════════════════════
        instances: 1,
        exec_mode: 'fork',

        // ═══════════════════════════════════════════════════════════════
        // MEMORY MANAGEMENT
        // ═══════════════════════════════════════════════════════════════
        max_memory_restart: '1500M',  // Restart if exceeds 1.5GB RAM

        // ═══════════════════════════════════════════════════════════════
        // GRACEFUL RESTART
        // ═══════════════════════════════════════════════════════════════
        wait_ready: true,             // Wait for process.send('ready')
        listen_timeout: 10000,        // 10s timeout for ready signal
        kill_timeout: 5000,           // 5s graceful shutdown

        // ═══════════════════════════════════════════════════════════════
        // AUTO-RESTART & MONITORING
        // ═══════════════════════════════════════════════════════════════
        autorestart: true,
        watch: false,                 // Don't watch files in production
        max_restarts: 10,
        min_uptime: 5000,

        // ═══════════════════════════════════════════════════════════════
        // LOGGING
        // ═══════════════════════════════════════════════════════════════
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        combine_logs: true,
        error_file: './logs/error.log',
        out_file: './logs/output.log',

        // ═══════════════════════════════════════════════════════════════
        // ENVIRONMENT VARIABLES
        // ═══════════════════════════════════════════════════════════════
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }],

    // ═══════════════════════════════════════════════════════════════════════
    // DEPLOYMENT CONFIGURATION (Optional)
    // ═══════════════════════════════════════════════════════════════════════
    deploy: {
        production: {
            user: 'root',
            host: '82.165.138.12',
            ref: 'origin/main',
            repo: 'git@github.com:user/lootquest.git',
            path: '/var/www/lootquest',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        }
    }
};
