const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');

test('proxy reports unconfigured state and rejects model requests without a secret', async () => {
  const port = 19000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), LLM_API_KEY: '' }, stdio: 'ignore' });
  const request = (path, method='GET', body) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: body ? {'content-type':'application/json'} : {} }, res => { let data=''; res.on('data', c=>data+=c); res.on('end',()=>resolve({status:res.statusCode, body:JSON.parse(data)})); });
    req.on('error', reject); if(body)req.write(JSON.stringify(body)); req.end();
  });
  try {
    let health;
    for (let i=0;i<30;i++) { try { health=await request('/health'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
    assert.equal(health.status,200); assert.equal(health.body.configured,false);
    const result=await request('/api/chat','POST',{message:'hello'});
    assert.equal(result.status,503);
    const image=await request('/api/media/image','POST',{prompt:'a landscape'});
    assert.equal(image.status,503);
    const speech=await request('/api/media/speech','POST',{text:'hello'});
    assert.equal(speech.status,503);
  } finally { child.kill('SIGTERM'); }
});
