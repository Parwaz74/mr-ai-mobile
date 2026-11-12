const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');

test('proxy enforces configured origin and JSON content type', async () => {
  const port = 20000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), LLM_API_KEY: '', ALLOWED_ORIGIN: 'https://app.example.test' }, stdio: 'ignore' });
  const request = (method, origin, contentType) => new Promise((resolve, reject) => {
    const headers = {}; if (origin) headers.origin = origin; if (contentType) headers['content-type'] = contentType;
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/chat', method, headers }, res => { let data=''; res.on('data', c=>data+=c); res.on('end',()=>resolve({status:res.statusCode, headers:res.headers, body:data ? JSON.parse(data) : null})); });
    req.on('error', reject); if (method === 'POST') req.write(JSON.stringify({message:'hello'})); req.end();
  });
  try {
    for (let i=0;i<30;i++) { try { await request('GET'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
    const denied = await request('POST', 'https://evil.example', 'application/json');
    assert.equal(denied.status, 403);
    const allowed = await request('POST', 'https://app.example.test', 'text/plain');
    assert.equal(allowed.status, 415);
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example.test');
  } finally { child.kill('SIGTERM'); }
});
