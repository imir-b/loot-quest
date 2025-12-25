/**
 * Force VPS to pull latest from GitHub and deploy
 */

const { Client } = require('ssh2');

const conn = new Client();

console.log('═══════════════════════════════════════════════════════════');
console.log('   🔄 Updating VPS from GitHub');
console.log('═══════════════════════════════════════════════════════════\n');

conn.on('ready', () => {
    console.log('✅ Connected\n');

    const commands = [
        'cd /var/www/lootquest',
        'git fetch origin',
        'git reset --hard origin/master',
        'git pull origin master',
        'ls -la scripts/',
        'bash scripts/deploy.sh 2>&1'
    ];

    conn.exec(commands.join(' && '), { pty: true }, (err, stream) => {
        if (err) throw err;

        stream.on('data', (data) => {
            process.stdout.write(data.toString());
        });

        stream.on('close', (code) => {
            console.log('\n═══════════════════════════════════════════════════════════');
            if (code === 0 || code === null) {
                console.log('   ✅ Deployment Complete!');
                console.log('═══════════════════════════════════════════════════════════');
                console.log('\n   🌐 http://82.165.138.12:3000');
            } else {
                console.log(`   Exit code: ${code}`);
            }
            conn.end();
        });
    });

}).connect({
    host: '82.165.138.12',
    port: 22,
    username: 'root',
    password: '7GYMO97a'
});
