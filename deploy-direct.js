const { Client } = require('node-scp');
const { Client: SSHClient } = require('ssh2');
const path = require('path');
const fs = require('fs');

const config = {
    host: '82.165.138.12',
    port: 22,
    username: 'root',
    password: '7GYMO97a',
    remotePath: '/var/www/lootquest',
};

async function deploy() {
    console.log('🚀 Starting Direct Deployment...');

    // 1. Upload Files
    console.log('📦 Uploading files...');
    try {
        const client = await Client(config);

        // List of files/folders to upload
        const uploads = [
            'server.js',
            '.env',
            'package.json',
            'ecosystem.config.js',
            'firebase-service-account.json',
            'public',
            'src',
            'data' // If exists
        ];

        for (const item of uploads) {
            if (fs.existsSync(item)) {
                const stat = fs.statSync(item);
                const remoteDest = path.posix.join(config.remotePath, item);

                if (stat.isDirectory()) {
                    console.log(`   📂 Uploading directory: ${item}...`);
                    await client.uploadDir(item, remoteDest);
                } else {
                    console.log(`   📄 Uploading file: ${item}...`);
                    await client.uploadFile(item, remoteDest);
                }
            }
        }

        client.close();
        console.log('✅ Upload complete.');

    } catch (e) {
        console.error('❌ Upload failed:', e);
        return;
    }

    // 2. Restart Server
    console.log('🔄 Restarting server on VPS...');
    const conn = new SSHClient();

    conn.on('ready', () => {
        const commands = [
            `cd ${config.remotePath}`,
            'npm install --production',
            'pm2 restart lootquest || pm2 start ecosystem.config.js --env production'
        ];

        console.log(`   Executing: ${commands.join(' && ')}`);

        conn.exec(commands.join(' && '), (err, stream) => {
            if (err) throw err;

            stream.on('close', (code, signal) => {
                console.log(`\n✅ Deployment finished with code ${code}`);
                conn.end();
            }).on('data', (data) => {
                process.stdout.write('   [VPS] ' + data);
            }).stderr.on('data', (data) => {
                process.stderr.write('   [VPS ERR] ' + data);
            });
        });
    }).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password
    });
}

deploy();
