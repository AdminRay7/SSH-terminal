const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
    let conn = new Client();
    let stream = null;
    let isConnected = false;

    ws.on('message', (msg) => {
        // 1. If not connected, expect login credentials (IP, User, Key)
        if (!isConnected) {
            try {
                const creds = JSON.parse(msg);
                
                // Fix for Windows/Android clipboard formatting issues with keys
                // Replace any carriage returns with newlines and trim extra spaces
                let formattedKey = creds.key.replace(/\r\n/g, '\n').trim();

                conn.on('ready', () => {
                    isConnected = true;
                    ws.send('\r\n*** SSH CONNECTION ESTABLISHED ***\r\n');

                    // Open interactive shell
                    conn.shell({ term: 'xterm-256color', rows: 30, cols: 100 }, (err, s) => {
                        if (err) return ws.send('Shell error: ' + err.message);
                        stream = s;

                        // Send server output to browser
                        stream.on('data', (data) => {
                            ws.send(data.toString('binary'));
                        }).on('close', () => {
                            conn.end();
                            ws.close();
                        });
                    });
                }).on('error', (err) => {
                    ws.send('\r\n*** SSH ERROR: ' + err.message + ' ***\r\n');
                    ws.send('\r\nCheck that your IP and .pem key are correct.\r\n');
                });

                // Connect using the key
                conn.connect({
                    host: creds.host,
                    port: 22,
                    username: creds.username,
                    privateKey: formattedKey // Pass the cleaned-up key
                });

            } catch (e) {
                ws.send('Invalid login format: ' + e.message + '\r\n');
            }
            return;
        }

        // 2. If connected, send keystrokes to SSH stream
        if (stream && stream.writable) {
            stream.write(msg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});