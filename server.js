const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
    let conn = new Client();
    let stream = null;
    let isConnected = false;

    ws.on('message', (msg) => {
        // 1. If not connected, expect login credentials
        if (!isConnected) {
            try {
                const creds = JSON.parse(msg);
                
                conn.on('ready', () => {
                    isConnected = true;
                    ws.send('\r\n*** SSH CONNECTION ESTABLISHED ***\r\n');

                    conn.shell({ term: 'xterm-256color', rows: 30, cols: 100 }, (err, s) => {
                        if (err) return ws.send('Shell error: ' + err.message);
                        stream = s;

                        stream.on('data', (data) => {
                            ws.send(data.toString('binary'));
                        }).on('close', () => {
                            conn.end();
                            ws.close();
                        });
                    });
                }).on('error', (err) => {
                    ws.send('\r\n*** SSH ERROR: ' + err.message + ' ***\r\n');
                });

                // Connect using credentials from the browser
                conn.connect({
                    host: creds.host,
                    port: 22,
                    username: creds.username,
                    password: creds.password
                });

            } catch (e) {
                ws.send('Invalid login format.');
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