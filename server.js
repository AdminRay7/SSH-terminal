const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the frontend HTML file
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    // Create an SSH connection to your VPS
    const conn = new Client();
    
    conn.on('ready', () => {
        console.log('SSH Connection Ready');
        ws.send('\r\n*** SSH CONNECTION ESTABLISHED ***\r\n');

        // Open an interactive shell
        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
            if (err) {
                ws.send('\r\n*** SSH SHELL ERROR: ' + err.message + ' ***\r\n');
                return;
            }

            // Send SSH output to the browser
            stream.on('data', (data) => {
                ws.send(data.toString('binary'));
            }).on('close', () => {
                conn.end();
                ws.close();
            });

            // Send browser input to the SSH shell
            ws.on('message', (msg) => {
                stream.write(msg);
            });
        });
    }).on('error', (err) => {
        ws.send('\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n');
    });

    // ⚠️ IMPORTANT: ENTER YOUR VPS DETAILS HERE ⚠️
    // We will use Heroku Environment Variables for security
    conn.connect({
        host: process.env.VPS_HOST,
        port: 22,
        username: process.env.VPS_USER || 'ubuntu',
        password: process.env.VPS_PASS,
        // If using a private key instead of password, uncomment the lines below:
        // privateKey: require('fs').readFileSync('/path/to/key.pem') 
    });
});
 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});