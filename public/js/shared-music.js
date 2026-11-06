import {parseMusicSource} from './music-sources.js';
const $=s=>document.querySelector(s);
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
// The music panel can be minimized without stopping playback.
$('#music-open').onclick=()=>$('#music-panel').hidden=!$('#music-panel').hidden;
$('#music-close').onclick=()=>$('#music-panel').hidden=true;
$('#youtube-url').value=read('hikarii_music','');
function stopEmbeddedMusic(){
  const host=$('#music-player');
  const audio=host.querySelector('audio');
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
  host.replaceChildren(); // Also stops external iframe players and releases them.
}
$('#music-form').onsubmit=ev=>{
  ev.preventDefault();
  const box=$('#music-error'),link=$('#music-external');
  try {
    const source=parseMusicSource($('#youtube-url').value.trim());
    stopEmbeddedMusic();
    window.hikariiMusic?.stopLocal();
    box.textContent='';link.hidden=true;
    link.href=source.url;link.textContent=source.label||'Mở nguồn nhạc ↗';link.hidden=false;
    if(source.type==='external'){
      box.textContent=source.message;
    }else if(source.type==='audio'){
      const audio=document.createElement('audio');
      audio.controls=true;audio.preload='none';audio.src=source.url;
      audio.setAttribute('aria-label','Trình phát âm thanh trực tiếp');
      audio.addEventListener('error',()=>{box.textContent='Không tải được tệp âm thanh. Máy chủ nguồn có thể chặn phát ngoài hoặc định dạng không được hỗ trợ.';});
      $('#music-player').appendChild(audio);
      const play=audio.play();
      if(play&&play.catch)play.catch(()=>{box.textContent='Nhấn nút phát trên thanh âm thanh để bắt đầu.';});
    }else{
      const frame=document.createElement('iframe');
      frame.title='Trình phát '+(source.type==='spotify'?'Spotify':source.type==='tiktok'?'TikTok':'YouTube');
      frame.className='music-'+source.type+(source.tall?' tall':'');
      frame.src=source.embed;
      frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.allowFullscreen=true;
      $('#music-player').appendChild(frame);
    }
    save('hikarii_music',source.url);
  }catch(err){box.textContent=err.message;}
};
$('#music-stop').onclick=()=>{
  window.hikariiMusic?.stopLocal();
  stopEmbeddedMusic();
  $('#music-external').hidden=true;
  $('#music-error').textContent='Đã dừng nhạc. Nhấn Mở nhạc để phát lại.';
};

let localLoaded=false;
function loadLocal(){if(localLoaded)return;localLoaded=true;const script=document.createElement('script');script.src='/js/local-music.js?v=4.0';document.body.appendChild(script);}
new MutationObserver(()=>{if(!$('#music-panel').hidden)loadLocal();}).observe($('#music-panel'),{attributes:true,attributeFilter:['hidden']});
if(!$('#music-panel').hidden)loadLocal();
function rememberAudio(){document.querySelectorAll('#music-panel audio').forEach(a=>{if(a.currentTime>0&&a.src)save('hikarii_audio_resume_'+(a.id||'link'),{source:a.id?'local':read('hikarii_music',''),time:a.currentTime,volume:a.volume});});}
new MutationObserver(()=>{const a=$('#music-player audio');if(!a||a.dataset.resumeBound)return;a.dataset.resumeBound='1';a.addEventListener('loadedmetadata',()=>{const last=read('hikarii_audio_resume_link',{});if(last.source===read('hikarii_music','')&&last.time<a.duration)a.currentTime=last.time;});}).observe($('#music-player'),{childList:true});
window.addEventListener('pagehide',rememberAudio);
