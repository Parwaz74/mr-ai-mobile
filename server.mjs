/* Minimal same-origin OpenAI-compatible proxy. Node.js 20+, no third-party packages. */
import http from 'node:http';
import { loadWorkflow, collectOutputFiles, validateComfyFileQuery } from './local-media-engine.mjs';

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.LLM_API_KEY;
const API_BASE_URL = (process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';
const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.TTS_VOICE || 'alloy';
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || '';
const COMFYUI_URL = (process.env.COMFYUI_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
const COMFYUI_IMAGE_WORKFLOW = process.env.COMFYUI_IMAGE_WORKFLOW || 'workflows/image_api.json';
const COMFYUI_IMAGE_REFERENCE_WORKFLOW = process.env.COMFYUI_IMAGE_REFERENCE_WORKFLOW || 'workflows/image_reference_api.json';
const COMFYUI_VIDEO_WORKFLOW = process.env.COMFYUI_VIDEO_WORKFLOW || 'workflows/video_api.json';
const COMFYUI_TIMEOUT_MS = Math.min(1800000, Math.max(30000, Number(process.env.COMFYUI_TIMEOUT_MS || 900000)));
const COMFYUI_CLIENT_ID = 'mrai-' + Math.random().toString(36).slice(2, 12);
const localJobDeadlines = new Map();
const STABILITY_MUSIC_URL = 'https://api.stability.ai/v2beta/audio/stable-audio/text-to-audio';
const MAX_BODY = 12 * 1024 * 1024;
const MAX_JSON_BODY = 32 * 1024;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const requests = new Map();
const MAX_HISTORY_CHARS = 18_000;
const MAX_HISTORY_ITEMS = 8;
// Bound the in-memory limiter map so long-running processes do not accumulate stale IPs forever.
function pruneRateMap(now) {
  if (requests.size < 5000) return;
  for (const [key, times] of requests) {
    const fresh = times.filter(ts => now - ts < RATE_WINDOW_MS);
    if (fresh.length) requests.set(key, fresh); else requests.delete(key);
  }
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const cors = {};
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) { cors['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN; cors['Vary'] = 'Origin'; cors['Access-Control-Allow-Headers'] = 'Content-Type'; cors['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'; }
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors }); res.end(JSON.stringify(body)); };
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) return send(403, { error: 'Origin not allowed.' });
  if (req.method === 'OPTIONS') { if (!ALLOWED_ORIGIN || origin !== ALLOWED_ORIGIN) return send(403, { error: 'Origin not allowed.' }); res.writeHead(204, cors); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, service: 'mrai-model-proxy', configured: Boolean(API_KEY), media: { image: Boolean(API_KEY), speech: Boolean(API_KEY), video: Boolean(COMFYUI_VIDEO_WORKFLOW), music: Boolean(STABILITY_API_KEY), selfHostedImageVideo: true } });
  if (req.method === 'GET' && req.url === '/api/local-media/status') {
    try {
      const upstream = await fetch(`${COMFYUI_URL}/system_stats`, { signal: AbortSignal.timeout(5000) });
      if (!upstream.ok) return send(200, { configured: true, connected: false, message: 'ComfyUI responded with an error.' });
      const stats = await upstream.json().catch(() => ({}));
      return send(200, { configured: true, connected: true, engine: 'ComfyUI self-hosted', device: stats?.devices?.[0]?.name || 'Local inference device', imageWorkflow: Boolean(COMFYUI_IMAGE_WORKFLOW), videoWorkflow: Boolean(COMFYUI_VIDEO_WORKFLOW) });
    } catch { return send(200, { configured: true, connected: false, engine: 'ComfyUI self-hosted', message: 'Local generation server is not reachable.' }); }
  }
  const localJobMatch = req.method === 'GET' && req.url.match(/^\/api\/local-media\/jobs\/([a-f0-9-]{8,80})$/i);
  if (localJobMatch) {
    try {
      const deadline = localJobDeadlines.get(localJobMatch[1]);
      if (deadline && Date.now() > deadline) { localJobDeadlines.delete(localJobMatch[1]); return send(200, { status: 'timed_out', completed: false, files: [] }); }
      const upstream = await fetch(`${COMFYUI_URL}/history/${encodeURIComponent(localJobMatch[1])}`, { signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) return send(502, { error: 'Could not read local generation job status.' });
      const history = await upstream.json(); const entry = history?.[localJobMatch[1]];
      if (!entry) return send(200, { status: 'pending', files: [] });
      const status = entry.status?.status_str || (entry.status?.completed ? 'completed' : 'running');
      return send(200, { status, completed: Boolean(entry.status?.completed), files: collectOutputFiles(entry).map(file => ({ ...file, url: `/api/local-media/file?filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder)}&type=${encodeURIComponent(file.type)}` })) });
    } catch { return send(502, { error: 'Local generation status check failed.' }); }
  }
  if (req.method === 'GET' && req.url.startsWith('/api/local-media/file?')) {
    try {
      const parsed = new URL(req.url, 'http://localhost'); const filename = parsed.searchParams.get('filename') || ''; const subfolder = parsed.searchParams.get('subfolder') || ''; const type = parsed.searchParams.get('type') || 'output';
      if (!validateComfyFileQuery(filename, subfolder, type)) return send(400, { error: 'Invalid local output file reference.' });
      const upstreamUrl = new URL(`${COMFYUI_URL}/view`); upstreamUrl.searchParams.set('filename', filename); upstreamUrl.searchParams.set('subfolder', subfolder); upstreamUrl.searchParams.set('type', type);
      const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(30000) });
      if (!upstream.ok) return send(404, { error: 'Generated file is not available.' });
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (!bytes.length || bytes.length > 250 * 1024 * 1024) return send(413, { error: 'Generated file is empty or exceeds the 250 MB download limit.' });
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': bytes.length, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors }); return res.end(bytes);
    } catch { return send(502, { error: 'Could not download the generated file from the local engine.' }); }
  }
  if (req.method !== 'POST' || !['/api/chat','/api/media/image','/api/media/speech','/api/media/music','/api/local-media/image','/api/local-media/video','/api/local-media/upload-reference'].includes(req.url)) return send(404, { error: 'Not found' });
  if (req.method === 'POST') {
    const now = Date.now(); const ip = req.socket.remoteAddress || 'unknown';
    pruneRateMap(now);
    const recent = (requests.get(ip) || []).filter(ts => now - ts < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) return send(429, { error: 'Rate limit exceeded. Try again shortly.' });
    recent.push(now); requests.set(ip, recent);
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return send(415, { error: 'Content-Type must be application/json.' });
  let raw = '';
  try {
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > MAX_BODY) return send(413, { error: 'Request too large.' }); }
    if (req.url !== '/api/local-media/upload-reference' && Buffer.byteLength(raw) > MAX_JSON_BODY) return send(413, { error: 'JSON request too large.' });
    const input = JSON.parse(raw || '{}');
    if (req.url === '/api/local-media/upload-reference') {
      const dataUrl = typeof input.dataUrl === 'string' ? input.dataUrl : '';
      const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
      if (!match) return send(400, { error: 'A PNG, JPEG or WebP reference image is required.' });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) return send(413, { error: 'Reference image must be 8 MB or smaller.' });
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const form = new FormData();
      form.append('image', new Blob([bytes], { type: `image/${match[1]}` }), `mrai-reference-${Date.now()}.${ext}`);
      form.append('type', 'input'); form.append('overwrite', 'true');
      const upstream = await fetch(`${COMFYUI_URL}/upload/image`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok || !result.name) return send(502, { error: 'ComfyUI could not store the reference image.' });
      return send(201, { uploaded: true, name: result.name, subfolder: result.subfolder || '', type: result.type || 'input' });
    }
    if (req.url === '/api/local-media/image' || req.url === '/api/local-media/video') {
      const kind = req.url.endsWith('/image') ? 'image' : 'video';
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
      const negativePrompt = typeof input.negativePrompt === 'string' ? input.negativePrompt.slice(0, 3000) : '';
      if (!prompt || prompt.length > 8000) return send(400, { error: 'A prompt between 1 and 8000 characters is required.' });
      const width = [512, 640, 768, 832, 1024, 1280].includes(Number(input.width)) ? Number(input.width) : 1024;
      const height = [512, 640, 768, 832, 1024, 1280].includes(Number(input.height)) ? Number(input.height) : 1024;
      const seed = Number.isSafeInteger(Number(input.seed)) && Number(input.seed) >= 0 ? Number(input.seed) : Math.floor(Math.random() * 2 ** 31);
      const frames = Math.min(240, Math.max(16, Number.isInteger(Number(input.frames)) ? Number(input.frames) : 49));
      const fps = [12, 16, 24, 25, 30].includes(Number(input.fps)) ? Number(input.fps) : 24;
      const hasReferenceImage = kind === 'image' && typeof input.referenceImage === 'string' && input.referenceImage.length > 0;
      const workflowPath = kind === 'image' ? (hasReferenceImage ? COMFYUI_IMAGE_REFERENCE_WORKFLOW : COMFYUI_IMAGE_WORKFLOW) : COMFYUI_VIDEO_WORKFLOW;
      const workflow = await loadWorkflow(workflowPath, { PROMPT: prompt, NEGATIVE_PROMPT: negativePrompt, WIDTH: width, HEIGHT: height, SEED: seed, FRAMES: frames, FPS: fps, INPUT_IMAGE: typeof input.referenceImage === 'string' ? input.referenceImage.slice(0, 240) : '' });
      if (workflow._NOT_A_RUNNABLE_WORKFLOW) return send(503, { error: 'A runnable ComfyUI API-format video workflow has not been configured on the server.' });
      const upstream = await fetch(`${COMFYUI_URL}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: COMFYUI_CLIENT_ID }), signal: AbortSignal.timeout(30000) });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok || !data.prompt_id) return send(502, { error: data?.error?.message || data?.node_errors ? 'ComfyUI rejected the workflow. Check model files and workflow node inputs.' : 'Could not queue the local generation workflow.' });
      localJobDeadlines.set(data.prompt_id, Date.now() + COMFYUI_TIMEOUT_MS);
      return send(202, { jobId: data.prompt_id, status: 'queued', engine: 'ComfyUI self-hosted', kind });
    }
    if (req.url === '/api/media/image') {
      if (!API_KEY) return send(503, { error: 'Image provider is not configured. Set LLM_API_KEY on the server host.' });
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
      if (!prompt || prompt.length > 4000) return send(400, { error: 'An image prompt between 1 and 4000 characters is required.' });
      const upstream = await fetch(`${API_BASE_URL}/images/generations`, { method:'POST', headers:{'Authorization':`Bearer ${API_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({model:IMAGE_MODEL,prompt,n:1,size:'1024x1024'}), signal:AbortSignal.timeout(90000) });
      const data = await upstream.json().catch(()=>({}));
      if (!upstream.ok) return send(502,{error:data?.error?.message || 'Image provider request failed.'});
      const b64=data?.data?.[0]?.b64_json;
      if(typeof b64!=='string'||!b64.startsWith('iVBOR')) return send(502,{error:'Image provider returned no supported PNG image.'});
      return send(200,{image:b64,mimeType:'image/png',model:IMAGE_MODEL});
    }
    if (req.url === '/api/media/music') {
      if (!STABILITY_API_KEY) return send(503, { error: 'Music generation is not configured. Set STABILITY_API_KEY on the server host.' });
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
      const duration = Number(input.duration || 30);
      if (!prompt || prompt.length > 4000) return send(400, { error: 'A music description between 1 and 4000 characters is required.' });
      if (![15, 30].includes(duration)) return send(400, { error: 'Music duration must be 15 or 30 seconds in this build.' });
      const form = new FormData();
      form.set('model', 'stable-audio-3');
      form.set('prompt', prompt.slice(0, 4000));
      form.set('duration', String(duration));
      const upstream = await fetch(STABILITY_MUSIC_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${STABILITY_API_KEY}`, 'Accept': 'audio/*' }, body: form, signal: AbortSignal.timeout(120000) });
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        let message = 'Music provider request failed.';
        try { message = JSON.parse(detail)?.message || JSON.parse(detail)?.error || message; } catch {}
        return send(502, { error: String(message).slice(0, 500) });
      }
      const audio = Buffer.from(await upstream.arrayBuffer());
      if (!audio.length || audio.length > 30 * 1024 * 1024) return send(502, { error: 'Music provider returned an empty or oversized audio file.' });
      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      if (!contentType.startsWith('audio/')) return send(502, { error: 'Music provider returned an unsupported content type.' });
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': audio.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
      return res.end(audio);
    }
    if (req.url === '/api/media/speech') {
      if (!API_KEY) return send(503, { error: 'Speech provider is not configured. Set LLM_API_KEY on the server host.' });
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text || text.length > 4000) return send(400,{error:'Speech text must contain 1 to 4000 characters.'});
      const voice = ['alloy','ash','ballad','coral','echo','fable','onyx','nova','sage','shimmer','marin','cedar'].includes(input.voice) ? input.voice : TTS_VOICE;
      const languageName = typeof input.languageName === 'string' ? input.languageName.slice(0,60) : 'the language of the supplied text';
      const upstream = await fetch(`${API_BASE_URL}/audio/speech`,{method:'POST',headers:{'Authorization':`Bearer ${API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:TTS_MODEL,voice,input:text,instructions:`Speak clearly and naturally in ${languageName}. Preserve the supplied text; do not translate it.`,response_format:'mp3'}),signal:AbortSignal.timeout(90000)});
      if(!upstream.ok){const data=await upstream.json().catch(()=>({}));return send(502,{error:data?.error?.message || 'Speech provider request failed.'});}
      const audio=Buffer.from(await upstream.arrayBuffer());
      if(!audio.length||audio.length>12*1024*1024)return send(502,{error:'Speech provider returned an empty or oversized audio file.'});
      res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':audio.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cors});return res.end(audio);
    }
    if (!API_KEY) return send(503, { error: 'AI provider is not configured on the server. Set LLM_API_KEY on the server host.' });
    if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 12000) return send(400, { error: 'A message between 1 and 12000 characters is required.' });
    let history = Array.isArray(input.history) ? input.history.slice(-MAX_HISTORY_ITEMS).filter(x => x && ['user','ai','assistant'].includes(x.role) && typeof x.text === 'string').map(x => ({ role: x.role === 'ai' ? 'assistant' : x.role, content: x.text.slice(0, 3000) })) : [];
    let historyBudget = MAX_HISTORY_CHARS;
    history = history.map(item => { const content = item.content.slice(0, historyBudget); historyBudget -= content.length; return { ...item, content }; }).filter(item => item.content.length > 0);
    const upstream = await fetch(`${API_BASE_URL}/chat/completions`, { method: 'POST', headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: `You are M.R AI. Respond in language code ${String(input.language || 'en').slice(0, 12)} unless the user requests otherwise. Be accurate; distinguish facts from uncertainty.` }, ...history, { role: 'user', content: input.message }], temperature: 0.4 }), signal: AbortSignal.timeout(40000) });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return send(502, { error: data?.error?.message || 'Model provider request failed.' });
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return send(502, { error: 'Model provider returned no text.' });
    return send(200, { reply: reply.trim(), model: MODEL });
  } catch (error) { return send(400, { error: error.name === 'TimeoutError' ? 'Model request timed out.' : 'Invalid request or model service unavailable.' }); }
});
server.listen(PORT, () => console.log(`M.R AI proxy listening on ${PORT}`));
