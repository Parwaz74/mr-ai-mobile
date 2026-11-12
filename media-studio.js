(() => {
'use strict';
const $=id=>document.getElementById(id);
const locales={en:'en-US',fa:'fa-IR',ar:'ar-SA',de:'de-DE',fr:'fr-FR',es:'es-ES',pt:'pt-PT',ru:'ru-RU',zh:'zh-CN',hi:'hi-IN',tr:'tr-TR',it:'it-IT',ja:'ja-JP',ko:'ko-KR',id:'id-ID',bn:'bn-BD',ur:'ur-PK',sw:'sw-KE',vi:'vi-VN',th:'th-TH',nl:'nl-NL',pl:'pl-PL',uk:'uk-UA',ro:'ro-RO',el:'el-GR',sv:'sv-SE',no:'nb-NO',da:'da-DK',fi:'fi-FI',cs:'cs-CZ',hu:'hu-HU',ms:'ms-MY',ta:'ta-IN',te:'te-IN',mr:'mr-IN',gu:'gu-IN',pa:'pa-IN',am:'am-ET',ha:'ha-NG'};
const names=[['en','English'],['fa','فارسی'],['ar','العربية'],['de','Deutsch'],['fr','Français'],['es','Español'],['pt','Português'],['ru','Русский'],['zh','中文'],['hi','हिन्दी'],['tr','Türkçe'],['it','Italiano'],['ja','日本語'],['ko','한국어'],['id','Bahasa Indonesia'],['bn','বাংলা'],['ur','اردو'],['sw','Kiswahili'],['vi','Tiếng Việt'],['th','ไทย'],['nl','Nederlands'],['pl','Polski'],['uk','Українська'],['ro','Română'],['el','Ελληνικά'],['sv','Svenska'],['no','Norsk'],['da','Dansk'],['fi','Suomi'],['cs','Čeština'],['hu','Magyar'],['ms','Bahasa Melayu'],['ta','தமிழ்'],['te','తెలుగు'],['mr','मराठी'],['gu','ગુજરાતી'],['pa','ਪੰਜਾਬੀ'],['am','አማርኛ'],['ha','Hausa']];
fetch('/api/local-media/status').then(r=>r.json()).then(data=>{const status=$('localEngineStatus');if(!status)return;status.textContent=data.connected?`موتور محلی متصل است: ${data.device||'ComfyUI'}. workflow تصویر و ویدئو باید جداگانه تنظیم شوند.`:'موتور محلی هنوز متصل نیست؛ برای راه‌اندازی، راهنمای workflows/README_FA.md را در بسته پروژه ببینید.';}).catch(()=>{const status=$('localEngineStatus');if(status)status.textContent='وضعیت موتور محلی از این نشانی قابل بررسی نیست؛ سرور M.R AI باید اجرا باشد.';});
const lang=$('ttsLanguage'); if(lang){names.forEach(([code,name])=>{const o=document.createElement('option');o.value=code;o.textContent=name;lang.append(o);});try{lang.value=localStorage.getItem('mr_ai_language')||'en';}catch(_){}}
$('ttsSpeak')?.addEventListener('click',()=>{const text=$('ttsText').value.trim();if(!text)return $('ttsStatus').textContent='ابتدا متن را وارد کنید.';if(!('speechSynthesis'in window))return $('ttsStatus').textContent='مرورگر شما تبدیل متن به گفتار را پشتیبانی نمی‌کند.';speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=locales[lang.value]||'en-US';u.rate=Number($('ttsRate').value)||1;u.onstart=()=>{$('ttsStatus').textContent='در حال پخش گفتار…';};u.onend=()=>{$('ttsStatus').textContent='پخش تمام شد. توجه: این قابلیت صدا را پخش می‌کند، نه اینکه فایل صوتی TTS بسازد.';};u.onerror=()=>{$('ttsStatus').textContent='پخش گفتار در این دستگاه ناموفق بود یا صدای انتخابی موجود نیست.';};speechSynthesis.speak(u);});
$('ttsStop')?.addEventListener('click',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();$('ttsStatus').textContent='پخش متوقف شد.';});
$('ttsGenerate')?.addEventListener('click',async()=>{const text=$('ttsText').value.trim();if(!text)return $('ttsStatus').textContent='ابتدا متن را وارد کنید.';const btn=$('ttsGenerate');btn.disabled=true;$('ttsStatus').textContent='در حال درخواست تولید گفتار از سرویس هوش مصنوعی…';try{const r=await fetch(`${(window.MRAI_CONFIG?.mediaEndpoint||'/api/media')}/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:$('ttsVoice')?.value||'alloy',language:lang.value,languageName:lang.options[lang.selectedIndex]?.text||lang.value})});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||`خطای سرور: ${r.status}`);}const blob=await r.blob();if(!blob.size)throw new Error('فایل صوتی خالی دریافت شد.');const url=URL.createObjectURL(blob),a=$('ttsDownload');a.href=url;a.download=`mrai-speech-${Date.now()}.mp3`;a.hidden=false;$('ttsStatus').textContent='فایل گفتار MP3 آماده دانلود است.';}catch(e){$('ttsStatus').textContent=e.message||'تولید گفتار ناموفق بود.';}finally{btn.disabled=false;}});
$('musicGenerate')?.addEventListener('click',async()=>{const prompt=$('musicPrompt')?.value.trim()||'';if(!prompt)return $('musicStatus').textContent='ابتدا شرح موسیقی را وارد کنید.';const btn=$('musicGenerate');btn.disabled=true;$('musicStatus').textContent='در حال ارسال درخواست تولید موسیقی…';try{const r=await fetch(`${(window.MRAI_CONFIG?.mediaEndpoint||'/api/media')}/music`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,duration:Number($('musicDuration').value)||30,instrumental:$('musicInstrumental').checked})});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||`خطای سرور: ${r.status}`);}const blob=await r.blob();if(!blob.size)throw new Error('سرویس موسیقی فایل خالی برگرداند.');const url=URL.createObjectURL(blob),audio=$('musicPreview'),a=$('musicDownload');audio.src=url;audio.hidden=false;a.href=url;a.download=`mrai-music-${Date.now()}.${blob.type.includes('wav')?'wav':'mp3'}`;a.hidden=false;$('musicStatus').textContent='موسیقی آماده پخش و دانلود است.';}catch(e){$('musicStatus').textContent=e.message||'تولید موسیقی ناموفق بود.';}finally{btn.disabled=false;}});
let audioRecorder=null,audioStream=null,audioChunks=[];
$('audioRecordStart')?.addEventListener('click',async()=>{try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('ضبط صدا در این مرورگر پشتیبانی نمی‌شود. از HTTPS و مرورگر به‌روز استفاده کنید.');audioStream=await navigator.mediaDevices.getUserMedia({audio:true});audioChunks=[];audioRecorder=new MediaRecorder(audioStream);audioRecorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data);};audioRecorder.onstop=()=>{const blob=new Blob(audioChunks,{type:audioRecorder.mimeType||'audio/webm'});setDownload('audio',blob,`mrai-audio-${Date.now()}.webm`);audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;};audioRecorder.start();$('audioRecordStart').disabled=true;$('audioRecordStop').disabled=false;$('audioStatus').textContent='ضبط صدا فعال است؛ برای پایان، دکمه پایان ضبط را بزنید.';}catch(e){$('audioStatus').textContent=e.message||'دسترسی به میکروفون ممکن نشد.';}});
$('audioRecordStop')?.addEventListener('click',()=>{if(audioRecorder?.state==='recording'){audioRecorder.stop();$('audioRecordStart').disabled=false;$('audioRecordStop').disabled=true;$('audioStatus').textContent='در حال آماده‌سازی فایل صوتی…';}});
let videoRecorder=null,videoStream=null,videoChunks=[];
$('videoStart')?.addEventListener('click',async()=>{try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('ضبط ویدئو در این مرورگر پشتیبانی نمی‌شود. از HTTPS و مرورگر به‌روز استفاده کنید.');videoStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:true});const preview=$('videoPreview');preview.srcObject=videoStream;await preview.play();videoChunks=[];videoRecorder=new MediaRecorder(videoStream);videoRecorder.ondataavailable=e=>{if(e.data.size)videoChunks.push(e.data);};videoRecorder.onstop=()=>{const blob=new Blob(videoChunks,{type:videoRecorder.mimeType||'video/webm'});setDownload('video',blob,`mrai-video-${Date.now()}.webm`);videoStream?.getTracks().forEach(t=>t.stop());videoStream=null;preview.srcObject=null;};videoRecorder.start();$('videoStart').disabled=true;$('videoStop').disabled=false;$('videoStatus').textContent='دوربین فعال و ضبط در حال انجام است.';}catch(e){$('videoStatus').textContent=e.message||'دسترسی به دوربین یا میکروفون ممکن نشد.';}});
$('videoStop')?.addEventListener('click',()=>{if(videoRecorder?.state==='recording'){videoRecorder.stop();$('videoStart').disabled=false;$('videoStop').disabled=true;$('videoStatus').textContent='در حال آماده‌سازی فایل ویدئویی…';}});
let sourceImage=null;
$('imageFileInput')?.addEventListener('change',()=>{const file=$('imageFileInput').files?.[0];if(!file)return;if(!file.type.startsWith('image/')){$('imageStatusLocal').textContent='لطفاً یک فایل تصویری معتبر انتخاب کنید.';return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{sourceImage=img;const c=$('imageCanvas'),ctx=c.getContext('2d');const max=Number($('imageMaxSize').value)||1920,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);drawImage();c.style.display='block';$('imageExport').disabled=false;$('imageStatusLocal').textContent=`تصویر بارگذاری شد: ${img.naturalWidth} × ${img.naturalHeight}`;URL.revokeObjectURL(url);};img.onerror=()=>{$('imageStatusLocal').textContent='خواندن تصویر ممکن نشد.';URL.revokeObjectURL(url);};img.src=url;});
function drawImage(){if(!sourceImage)return;const c=$('imageCanvas'),ctx=c.getContext('2d');const max=Number($('imageMaxSize').value)||1920,scale=Math.min(1,max/Math.max(sourceImage.naturalWidth,sourceImage.naturalHeight));c.width=Math.round(sourceImage.naturalWidth*scale);c.height=Math.round(sourceImage.naturalHeight*scale);ctx.filter=`brightness(${Number($('imageBrightness').value)||100}%)`;ctx.drawImage(sourceImage,0,0,c.width,c.height);ctx.filter='none';}
$('imageBrightness')?.addEventListener('input',drawImage);$('imageMaxSize')?.addEventListener('change',drawImage);
$('imageExport')?.addEventListener('click',()=>{const c=$('imageCanvas');if(!sourceImage)return; c.toBlob(blob=>{if(blob)setDownload('image',blob,`mrai-image-${Date.now()}.png`);else $('imageStatusLocal').textContent='ساخت فایل PNG ناموفق بود.';},'image/png');});
async function submitLocalMedia(kind, payload, statusNode, button) {
  button.disabled = true;
  statusNode.textContent = 'در حال ارسال به موتور تولید محلی…';
  try {
    const queued = await fetch(`/api/local-media/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const q = await queued.json().catch(() => ({}));
    if (!queued.ok) throw new Error(q.error || `خطای موتور محلی: ${queued.status}`);
    const started = Date.now();
    statusNode.textContent = `در صف تولید محلی قرار گرفت؛ شناسه کار: ${q.jobId}`;
    while (Date.now() - started < 15 * 60 * 1000) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const response = await fetch(`/api/local-media/jobs/${encodeURIComponent(q.jobId)}`);
      const state = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(state.error || 'خواندن وضعیت تولید ممکن نشد.');
      if (state.status === 'timed_out') throw new Error('زمان مجاز تولید تمام شد؛ تنظیمات مدل و سخت‌افزار را بررسی کنید.');
      if (state.status === 'error' || state.status === 'failed') throw new Error('موتور محلی نتوانست این workflow را اجرا کند؛ تنظیمات مدل و workflow را بررسی کنید.');
      if (state.files?.length) return state.files;
      if (state.completed) throw new Error('موتور کار را تمام کرد اما فایل خروجی قابل دریافت پیدا نشد؛ نود ذخیره‌سازی workflow را بررسی کنید.');
      statusNode.textContent = `تولید در حال انجام است… وضعیت: ${state.status || 'running'}`;
    }
    throw new Error('زمان انتظار ۱۵ دقیقه‌ای تمام شد؛ کار ممکن است هنوز در صف موتور محلی باشد.');
  } finally { button.disabled = false; }
}
async function uploadLocalReferenceImage(file) {
  if (!file) return '';
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('فرمت تصویر مرجع باید PNG، JPEG یا WebP باشد.');
  const dataUrl = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('خواندن تصویر مرجع ناموفق بود.'));reader.readAsDataURL(file);});
  if (String(dataUrl).length > 11 * 1024 * 1024) throw new Error('تصویر مرجع بیش از حد بزرگ است؛ تصویر کوچک‌تری انتخاب کنید.');
  const response = await fetch('/api/local-media/upload-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl})});
  const result = await response.json().catch(()=>({}));
  if (!response.ok || !result.name) throw new Error(result.error || 'ارسال تصویر مرجع به موتور محلی ناموفق بود.');
  return result.name;
}
$('imageGenerateAI')?.addEventListener('click', async () => {
  const prompt = $('mediaPrompt')?.textContent?.trim() && $('mediaPrompt').textContent !== 'پس از تکمیل فرم، پرامپت اینجا نمایش داده می‌شود.' ? $('mediaPrompt').textContent : $('mediaSubject')?.value.trim();
  if (!prompt) return $('imageStatusLocal').textContent = 'ابتدا موضوع تصویر را وارد کنید و پرامپت را بسازید.';
  try {
    const referenceFile = $('imageReferenceInput')?.files?.[0];
    const referenceImage = referenceFile ? await uploadLocalReferenceImage(referenceFile) : '';
    const files = await submitLocalMedia('image', { prompt, negativePrompt: $('imageNegative')?.value || '', width: 1024, height: 1024, ...(referenceImage ? { referenceImage } : {}) }, $('imageStatusLocal'), $('imageGenerateAI'));
    const file = files.find(item => item.mediaType === 'images') || files[0];
    if (!file?.url) throw new Error('workflow تصویری فایلی برای نمایش برنگرداند.');
    const img = $('aiImagePreview'), a = $('aiImageDownload'); img.src = file.url; img.hidden = false; a.href = file.url; a.download = file.filename || `mrai-local-image-${Date.now()}.png`; a.hidden = false;
    $('imageStatusLocal').textContent = 'تصویر از موتور محلی دریافت شد.';
  } catch (e) { $('imageStatusLocal').textContent = e.message || 'تولید تصویر محلی ناموفق بود.'; }
});
$('localVideoGenerate')?.addEventListener('click', async () => {
  const prompt = $('localVideoPrompt')?.value.trim() || $('mediaPrompt')?.textContent?.trim();
  if (!prompt || prompt === 'پس از تکمیل فرم، پرامپت اینجا نمایش داده می‌شود.') return $('localVideoStatus').textContent = 'ابتدا شرح ویدئو را وارد کنید.';
  try {
    const files = await submitLocalMedia('video', { prompt, negativePrompt: $('imageNegative')?.value || '', width: Number($('localVideoWidth').value), height: Number($('localVideoHeight').value), frames: Number($('localVideoFrames').value), fps: Number($('localVideoFps').value) }, $('localVideoStatus'), $('localVideoGenerate'));
    const file = files.find(item => ['videos','gifs'].includes(item.mediaType)) || files[0];
    if (!file?.url) throw new Error('workflow ویدئویی فایلی برای نمایش برنگرداند.');
    const video = $('localVideoPreview'), a = $('localVideoDownload'); video.src = file.url; video.hidden = false; a.href = file.url; a.download = file.filename || `mrai-local-video-${Date.now()}.mp4`; a.hidden = false;
    $('localVideoStatus').textContent = 'ویدئو از موتور محلی دریافت شد.';
  } catch (e) { $('localVideoStatus').textContent = e.message || 'تولید ویدئوی محلی ناموفق بود.'; }
});
function setDownload(kind,blob,filename){const url=URL.createObjectURL(blob);const a=$(kind+'Download');a.href=url;a.download=filename;a.hidden=false;a.textContent=`دانلود ${kind==='audio'?'فایل صوتی':kind==='video'?'فایل ویدئویی':'تصویر PNG'}`;if(kind==='audio'){$('audioPreview').src=url;$('audioPreview').hidden=false;$('audioStatus').textContent='فایل صوتی آماده است.';}if(kind==='video')$('videoStatus').textContent='فایل ویدئویی آماده است.';if(kind==='image')$('imageStatusLocal').textContent='فایل PNG آماده است.';}
window.addEventListener('beforeunload',()=>{audioStream?.getTracks().forEach(t=>t.stop());videoStream?.getTracks().forEach(t=>t.stop());if('speechSynthesis'in window)speechSynthesis.cancel();});
})();
