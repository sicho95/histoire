
import { getSettings, saveSettings } from '../storage/settings.js';
import { logDebug } from '../core/debug.js';
import { getAudioCacheEntry, putAudioCacheEntry } from '../storage/audio_cache.js';

let activeResolve = null;
let currentAudio = null;
let primed = false;

function settle() { if (activeResolve) { activeResolve(); activeResolve = null; } }
function stopAudioEl() { if (currentAudio) { try { currentAudio.pause(); currentAudio.src=''; } catch {} currentAudio=null; } }
function hashText(t) { let h=2166136261; for(const c of String(t)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0).toString(36); }

function cacheId(s, text) {
  if (s.ttsProvider==='gcp')
    return `gcp::${s.gcpVoiceName}::${s.gcpVoiceType}::${hashText(text)}`;
  if (s.ttsProvider==='openai')
    return `openai::${s.openaiVoice}::${hashText(text)}`;
  if (s.ttsProvider==='elevenlabs')
    return `eleven::${s.elevenVoiceId}::${s.elevenModel}::${s.elevenFormat}::${s.elevenForceFrench?'fr':'auto'}::${hashText(text)}`;
  return `browser::${hashText(text)}`;
}

function blobToDataUrl(blob) {
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});
}
function dataUrlToBlob(d) {
  const [meta,b64]=d.split(',');const mime=/data:(.*?);base64/.exec(meta)?.[1]||'audio/mpeg';
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return new Blob([bytes],{type:mime});
}

async function getCached(s, text) {
  const id=cacheId(s,text);const e=await getAudioCacheEntry(id);
  if(e?.dataUrl){logDebug('tts.cache.hit',{id});return dataUrlToBlob(e.dataUrl);}
  return null;
}
async function putCache(s, text, blob) {
  const id=cacheId(s,text);
  await putAudioCacheEntry({id,provider:s.ttsProvider,voiceKey:id,textPreview:String(text).slice(0,120),dataUrl:await blobToDataUrl(blob),createdAt:Date.now()});
  logDebug('tts.cache.store',{id,size:blob.size});
}

async function badRes(res,prefix) {
  let d='';try{d=(await res.text()).slice(0,300);}catch{}
  return new Error(`${prefix}_${res.status}${d?': '+d:''}`);
}

// ── GCP ──
async function fetchGcp(text, s) {
  if(!s.gcpApiKey) throw new Error('gcp_missing_api_key');
  const body={input:{text},voice:{languageCode:s.gcpLanguage||'fr-FR',name:s.gcpVoiceName||'fr-FR-Wavenet-A'},audioConfig:{audioEncoding:'MP3',speakingRate:s.gcpSpeakingRate??0.87}};
  const res=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${s.gcpApiKey}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok) throw await badRes(res,'gcp_tts');
  const {audioContent}=await res.json();
  const bytes=Uint8Array.from(atob(audioContent),c=>c.charCodeAt(0));
  const blob=new Blob([bytes],{type:'audio/mpeg'});
  // quota tracking
  const now=new Date();const mk=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const fresh=getSettings();
  const chars=(fresh.gcpMonthKey===mk?fresh.gcpCharsThisMonth:0)+text.length;
  saveSettings({...fresh,gcpCharsThisMonth:chars,gcpMonthKey:mk});
  return blob;
}

// ── OpenAI ──
async function fetchOpenAi(text, s) {
  if(!s.openaiApiKey) throw new Error('openai_missing_api_key');
  const res=await fetch('https://api.openai.com/v1/audio/speech',
    {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.openaiApiKey}`},
     body:JSON.stringify({model:'tts-1',voice:s.openaiVoice||'nova',input:text})});
  if(!res.ok) throw await badRes(res,'openai_tts');
  return res.blob();
}

// ── ElevenLabs ──
const ELEVEN_MULTILANG=new Set(['eleven_multilingual_v2','eleven_flash_v2_5','eleven_turbo_v2_5','eleven_v3']);
async function fetchEleven(text, s) {
  if(!s.elevenApiKey||!s.elevenVoiceId) throw new Error('eleven_missing_config');
  const body={text,model_id:s.elevenModel||'eleven_multilingual_v2',output_format:s.elevenFormat||'mp3_44100_128',voice_settings:{stability:0.45,similarity_boost:0.8}};
  if(s.elevenForceFrench&&ELEVEN_MULTILANG.has(body.model_id)) body.language_code='fr';
  const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${s.elevenVoiceId}`,
    {method:'POST',headers:{'Content-Type':'application/json','xi-api-key':s.elevenApiKey,'Accept':'audio/mpeg'},body:JSON.stringify(body)});
  if(!res.ok) throw await badRes(res,'eleven_tts');
  return res.blob();
}

export async function fetchElevenSubscription(apiKey) {
  if(!apiKey) return{ok:false,error:'no_key'};
  try{const r=await fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':apiKey}});
    if(!r.ok)return{ok:false,error:`sub_${r.status}`};return{ok:true,...await r.json()};}
  catch(e){return{ok:false,error:String(e)};}
}

// ── Browser TTS ──
function pickFr() {
  const vs=speechSynthesis.getVoices();
  return vs.find(v=>/^fr/i.test(v.lang)&&/google|premium|hortense|thomas|amelie|audrey/i.test(v.name))
        ||vs.find(v=>/^fr/i.test(v.lang))||null;
}
function speakBrowser(text) {
  return new Promise(res=>{
    if(!text||!('speechSynthesis' in window))return res();
    stopSpeak();
    const u=new SpeechSynthesisUtterance(String(text));
    u.lang='fr-FR';u.rate=0.97;u.pitch=1;
    const v=pickFr();if(v)u.voice=v;
    logDebug('tts.browser',{voice:v?.name||null});
    u.onend=()=>{settle();res();};u.onerror=()=>{settle();res();};
    activeResolve=res;
    try{speechSynthesis.resume?.();speechSynthesis.speak(u);}catch{settle();res();}
  });
}

function playBlob(blob, meta) {
  return new Promise(res=>{
    stopSpeak();
    const url=URL.createObjectURL(blob);const audio=new Audio(url);
    currentAudio=audio;activeResolve=res;
    logDebug('tts.play',meta);
    const done=()=>{URL.revokeObjectURL(url);stopAudioEl();settle();res();};
    audio.onended=done;audio.onerror=done;audio.play().catch(done);
  });
}

export function stopSpeak(){try{window.speechSynthesis?.cancel();}catch{}stopAudioEl();settle();logDebug('tts.stop',{});}

export function primeTts(){
  if(!('speechSynthesis' in window)||primed)return;primed=true;
  try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.cancel();speechSynthesis.speak(u);setTimeout(()=>speechSynthesis.cancel(),30);}catch{}
}

export async function speak(text) {
  const s=getSettings();if(!text)return;
  const remote=s.ttsProvider!=='browser';
  if(remote&&(s.gcpApiKey||s.openaiApiKey||s.elevenApiKey)){
    try{
      const cached=await getCached(s,text);
      if(cached) return playBlob(cached,{provider:s.ttsProvider,cached:true});
      let blob;
      if(s.ttsProvider==='gcp') blob=await fetchGcp(text,s);
      else if(s.ttsProvider==='openai') blob=await fetchOpenAi(text,s);
      else blob=await fetchEleven(text,s);
      await putCache(s,text,blob);
      return playBlob(blob,{provider:s.ttsProvider,cached:false});
    }catch(e){logDebug('tts.remote.error',{msg:String(e)});}
  }
  return speakBrowser(text);
}

export async function warmTtsCache(texts=[]) {
  const s=getSettings();
  if(s.ttsProvider==='browser') return{stored:0,skipped:texts.length};
  let stored=0,skipped=0;
  for(const text of texts.filter(Boolean)){
    const cached=await getCached(s,text);if(cached){skipped++;continue;}
    try{
      let blob;
      if(s.ttsProvider==='gcp') blob=await fetchGcp(text,s);
      else if(s.ttsProvider==='openai') blob=await fetchOpenAi(text,s);
      else blob=await fetchEleven(text,s);
      await putCache(s,text,blob);stored++;
    }catch(e){logDebug('tts.warm.error',{msg:String(e),preview:String(text).slice(0,80)});}
  }
  return{stored,skipped};
}
