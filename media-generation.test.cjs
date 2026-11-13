const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'media-studio.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
test('AI speech generation has a downloadable MP3 control and server request',()=>{
  assert.match(html,/id="ttsGenerate"/); assert.match(html,/id="ttsVoice"/); assert.match(html,/id="ttsDownload"/);
  assert.match(js,/mediaEndpoint[^;]*\/speech/); assert.match(js,/mrai-speech-.*\.mp3/);
});
test('AI image generation has preview and downloadable PNG controls',()=>{
  assert.match(html,/id="imageGenerateAI"/); assert.match(html,/id="aiImagePreview"/); assert.match(html,/id="aiImageDownload"/);
  assert.match(js,/submitLocalMedia\('image'/); assert.match(js,/mrai-local-image/);
});
test('media provider secrets stay server-side and endpoints validate bounded input',()=>{
  assert.match(server,/process\.env\.LLM_API_KEY/); assert.match(server,/prompt\.length > 4000/); assert.match(server,/text\.length > 4000/);
  assert.match(server,/\/api\/local-media\/image/); assert.match(server,/\/api\/media\/speech/);
  assert.match(env,/IMAGE_MODEL=/); assert.doesNotMatch(fs.readFileSync(path.join(root,'config.js'),'utf8'),/sk-[A-Za-z0-9]{10,}/);
});
test('self-hosted video readiness is reported separately from hosted music provider',()=>{
  assert.match(server,/selfHostedImageVideo: true/);
  assert.match(server,/COMFYUI_VIDEO_WORKFLOW/);
});
