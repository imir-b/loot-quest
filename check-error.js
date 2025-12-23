/**
 * Check VPS error logs
 */

const { Client } = require('ssh2');

const conn = new Client();

console.log('Checking error logs...\n');

conn.on('ready', () => {
    const commands = [
        'cd /var/www/lootquest',
        'echo "=== Last 50 lines of ERROR log ==="',
        'tail -50 /var/www/lootquest/logs/error.log',
        'echo ""',
        'echo "=== Trying to start manually ==="',
        'node server.js 2>&1 | head -50'
    ];

    conn.exec(commands.join(' && '), { pty: true }, (err, stream) => {
        if (err) throw err;

        stream.on('data', (data) => {
            process.stdout.write(data.toString());
        });

        stream.on('close', () => {
            conn.end();
        });
    });

}).connect({
    host: '82.165.138.12',
    port: 22,
    username: 'root',
    password: '7GYMO97a'
});
