const http = require('http');

jest.mock('vscode', () => ({}), { virtual: true });

const llmService = require('../services/llmService');
const {
  createServer,
  destroyServer,
  destroyAll,
  isAgentRunning,
  getRunningAgents,
} = require('../services/server');

function postJSON(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('Multi-Agent Server Manager', () => {
  /** @type {jest.SpyInstance} */
  let sendChatRequestSpy;

  beforeEach(() => {
    sendChatRequestSpy = jest.spyOn(llmService, 'sendChatRequest').mockResolvedValue('');
  });

  afterEach(async () => {
    await destroyAll();
    jest.restoreAllMocks();
  });

  test('isAgentRunning returns false for unknown agent', () => {
    expect(isAgentRunning('does-not-exist')).toBe(false);
  });

  test('getRunningAgents returns empty array initially', () => {
    expect(getRunningAgents()).toEqual([]);
  });

  test('createServer starts a server and reports it as running', async () => {
    const port = await createServer('agent-1', 0);
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
    expect(isAgentRunning('agent-1')).toBe(true);
    expect(getRunningAgents()).toEqual(['agent-1']);
  });

  test('createServer rejects if agent already running', async () => {
    await createServer('agent-2', 0);
    await expect(createServer('agent-2', 0)).rejects.toThrow('already running');
  });

  test('destroyServer stops a specific agent', async () => {
    await createServer('agent-3', 0);
    expect(isAgentRunning('agent-3')).toBe(true);
    await destroyServer('agent-3');
    expect(isAgentRunning('agent-3')).toBe(false);
  });

  test('destroyServer resolves for unknown agent', async () => {
    await expect(destroyServer('ghost')).resolves.toBeUndefined();
  });

  test('multiple agents can run concurrently', async () => {
    const p1 = await createServer('a', 0);
    const p2 = await createServer('b', 0);
    expect(p1).not.toBe(p2);
    expect(getRunningAgents().sort()).toEqual(['a', 'b']);
  });

  test('destroyAll stops all agents', async () => {
    await createServer('x', 0);
    await createServer('y', 0);
    expect(getRunningAgents().length).toBe(2);
    await destroyAll();
    expect(getRunningAgents()).toEqual([]);
  });

  test('POST /LocalForge/chat with prompt works', async () => {
    sendChatRequestSpy.mockResolvedValueOnce('Hello!');
    const port = await createServer('test-chat', 0);
    const res = await postJSON(port, '/LocalForge/chat', { prompt: 'Hi' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).result).toBe('Hello!');
  });

  test('defaultSystemPrompt is used as fallback', async () => {
    sendChatRequestSpy.mockResolvedValueOnce('ctx response');
    const port = await createServer('ctx-test', 0, undefined, 'Be helpful');
    await postJSON(port, '/LocalForge/chat', { prompt: 'Hi' });
    expect(sendChatRequestSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hi' }],
      undefined,
      'Be helpful'
    );
  });

  test('request systemPrompt overrides default', async () => {
    sendChatRequestSpy.mockResolvedValueOnce('override');
    const port = await createServer('ov-test', 0, undefined, 'Default');
    await postJSON(port, '/LocalForge/chat', {
      prompt: 'Hi',
      systemPrompt: 'Custom',
    });
    expect(sendChatRequestSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hi' }],
      undefined,
      'Custom'
    );
  });

  test('returns 400 if no prompt or history', async () => {
    const port = await createServer('bad', 0);
    const res = await postJSON(port, '/LocalForge/chat', {});
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown routes', async () => {
    const port = await createServer('nf', 0);
    const res = await postJSON(port, '/unknown', {});
    expect(res.status).toBe(404);
  });

  test('returns 500 on error', async () => {
    sendChatRequestSpy.mockRejectedValueOnce(new Error('boom'));
    const port = await createServer('err', 0);
    const res = await postJSON(port, '/LocalForge/chat', { prompt: 'x' });
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body).error).toBe('boom');
  });

  test('OPTIONS returns 204 with CORS headers', async () => {
    const port = await createServer('cors', 0);
    const res = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port, path: '/LocalForge/chat', method: 'OPTIONS' },
        (r) => resolve({ status: r.statusCode, headers: r.headers })
      );
      req.on('error', reject);
      req.end();
    });
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
