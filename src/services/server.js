const http = require('http');
const llmService = require('./llmService');

const servers = new Map();

function isAgentRunning(agentId) {
  const s = servers.get(agentId);
  return s != null && s.listening;
}

function getRunningAgents() {
  const ids = [];
  for (const [id, s] of servers) {
    if (s.listening) ids.push(id);
  }
  return ids;
}

function createServer(agentId, port = 6009, modelId, defaultSystemPrompt) {
  return new Promise((resolve, reject) => {
    if (servers.has(agentId)) {
      const existing = servers.get(agentId);
      if (existing.listening) {
        reject(new Error(`Agent "${agentId}" is already running.`));
        return;
      }
      servers.delete(agentId);
    }

    const server = http.createServer(async (req, res) => {
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
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            let history = data.history;
            if (!history && data.prompt) {
              history = [{ role: 'user', content: data.prompt }];
            }

            if (!history) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Missing "prompt" or "history" in request body.');
              return;
            }

            const requestModelId = data.modelId || modelId;
            const systemPrompt = data.systemPrompt || defaultSystemPrompt;
            const responseText = await llmService.sendChatRequest(
              history,
              requestModelId,
              systemPrompt
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ result: responseText }));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    servers.set(agentId, server);

    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve(actualPort);
    });

    server.on('error', (err) => {
      servers.delete(agentId);
      if ('code' in err && err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use.`));
      } else {
        reject(err);
      }
    });
  });
}

function destroyServer(agentId) {
  return new Promise((resolve, reject) => {
    const server = servers.get(agentId);
    if (!server) {
      resolve();
      return;
    }

    server.close((err) => {
      servers.delete(agentId);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });

    setTimeout(() => {
      if (server.listening && typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, 1000);
  });
}

async function destroyAll() {
  const ids = [...servers.keys()];
  await Promise.allSettled(ids.map((id) => destroyServer(id)));
}

module.exports = { createServer, destroyServer, destroyAll, isAgentRunning, getRunningAgents };
