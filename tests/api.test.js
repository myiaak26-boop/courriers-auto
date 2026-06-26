const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';

let server;
let baseUrl;

before(async () => {
  delete require.cache[require.resolve('../server')];
  const app = require('../server');
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Health endpoint', () => {
  it('GET /health returns ok', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.uptime > 0);
  });
});

describe('API validation', () => {
  it('POST /api/store without sessionId returns 400', async () => {
    const res = await request('POST', '/api/store', {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('PUT /api/courriers/abc (invalid id) returns 400', async () => {
    const res = await request('PUT', '/api/courriers/abc', { etat: 'Test' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /api/send-mail with bad email returns 400', async () => {
    const res = await request('POST', '/api/send-mail', { mailTo: 'not-an-email' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});

describe('Upload flow', () => {
  it('POST /api/upload without file returns 400', async () => {
    const res = await request('POST', '/api/upload');
    assert.equal(res.status, 400);
  });
});

describe('Rate limiting', () => {
  it('GET /health bypasses rate limiter', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request('GET', '/health');
      assert.equal(res.status, 200);
    }
  });
});
