const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'media-studio.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
test('music studio exposes prompt, duration, instrumental toggle, preview and download',()=>{
  for(const id of ['musicPrompt','musicDuration','musicInstrumental','musicGenerate','musicPreview','musicDownload','musicStatus']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/mediaEndpoint[^;]*\/music/);
  assert.match(js,/mrai-music-/);
});
test('music endpoint uses server-side Stability key and Stable Audio API',()=>{
  assert.match(server,/process\.env\.STABILITY_API_KEY/);
  assert.match(server,/stable-audio-3/);
  assert.match(server,/stable-audio\/text-to-audio/);
  assert.match(server,/duration must be 15 or 30 seconds/);
  assert.match(env,/STABILITY_API_KEY=/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'config.js'),'utf8'),/STABILITY_API_KEY|sk-[A-Za-z0-9]{10,}/);
});
test('health endpoint reports music readiness independently from image and speech',()=>{
  assert.match(server,/music: Boolean\(STABILITY_API_KEY\)/);
  assert.match(server,/if \(!STABILITY_API_KEY\) return send\(503/);
  assert.doesNotMatch(server,/if \(!API_KEY\) return send\(503, \{ error: 'AI provider is not configured[\s\S]*?let raw/);
  assert.match(server,/\/api\/media\/music/);
});
