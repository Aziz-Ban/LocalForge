const http = require('http');
const { sendChatRequest } = require('./llmService');

let server;

function startServer(port = 6009, modelId) {
    return new Promise((resolve, reject) => {
        if (server) {
            reject(new Error('Server is already running'));
            return;
        }

        server = http.createServer(async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.method === 'POST' && req.url === '/LocalForge/chat') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        let history = data.history;
                        if (!history &&  data.prompt) {
                            history = [{ role: 'user', content: data.prompt }];
                        }
                        
                        if (!history) {
                            res.writeHead(400, { 'Content-Type': 'text/plain' });
                            res.end('Missing "prompt" or "history" in request body.');
                            return;
                        }

                        const requestModelId = data.modelId || modelId;
                        const systemPrompt = data.systemPrompt;
                        const responseText = await sendChatRequest(history, requestModelId, systemPrompt);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result: responseText }));
                    } catch (error) {
                        console.error('Server error:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: error.message }));
                    }
                });
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not Found' }));
            }
        });

        server.listen(port, () => {
            console.log(`LocalForge server is running on http://localhost:${port}`);
            resolve(port);
        });

        server.on('error', (err) => {
            server = null;
            reject(err);
        });
    });
}

function stopServer() {
    return new Promise((resolve, reject) => {
        if (server) {
            server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('LocalForge server stopped');
                    server = null;
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

module.exports = { startServer, stopServer };
