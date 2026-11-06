(function(){
'use strict';
const panel=document.getElementById('music-panel'),error=document.getElementById('music-error');
const local=document.createElement('section');local.className='local-music';
local.innerHTML='<h3>Nhạc từ máy</h3><label for="local-music-file">Chọn tệp âm thanh (tối đa 30 MB)</label><input id="local-music-file" type="file" accept="audio/*"><p id="local-music-name">Chưa chọn tệp nhạc</p><audio id="local-music-player" controls preload="metadata" loop></audio><div class="button-row"><label><input id="local-music-loop" type="checkbox" checked> Lặp lại</label><button id="local-music-remove" class="text-btn" type="button">Xóa nhạc đã lưu</button></div><small>Nhạc lưu trong trình duyệt của bạn và tiếp tục phát khi chuyển mục.</small>';
panel.append(local);panel.setAttribute('aria-label','Góc âm nhạc');
const audio=document.getElementById('local-music-player'),name=document.getElementById('local-music-name');let url=null;
function storage(value,remove){return new Promise((resolve,reject)=>{const req=indexedDB.open('TKB_Liquid_DB',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('assets'))req.result.createObjectStore('assets');};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('assets',value!==undefined||remove?'readwrite':'readonly'),store=tx.objectStore('assets');const r=remove?store.delete('custom_audio'):value!==undefined?store.put(value,'custom_audio'):store.get('custom_audio');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};};});}
function setSource(blob){audio.pause();audio.removeAttribute('src');if(url)URL.revokeObjectURL(url);url=null;if(blob instanceof Blob){url=URL.createObjectURL(blob);audio.src=url;name.textContent=blob.name||'Nhạc đã lưu';}else name.textContent='Chưa chọn tệp nhạc';audio.load();}
window.hikariiMusic={stopLocal:()=>audio.pause(),reload:async()=>{try{setSource(await storage());}catch(e){error.textContent='Không đọc được nhạc đã lưu trong trình duyệt.';}}};
try{audio.volume=Number(JSON.parse(localStorage.getItem('tkb_audio_volume')||'0.5'));}catch(e){audio.volume=.5;}
let volTimer;audio.onvolumechange=()=>{clearTimeout(volTimer);volTimer=setTimeout(()=>{try{localStorage.setItem('tkb_audio_volume',JSON.stringify(audio.volume));}catch(e){}},350);};
audio.onplay=()=>{document.getElementById('music-player').replaceChildren();document.getElementById('music-external').hidden=true;};
audio.onerror=()=>{if(audio.getAttribute('src'))error.textContent='Trình duyệt không phát được định dạng này. Hãy thử tệp MP3 hoặc WAV.';};
document.getElementById('local-music-loop').onchange=e=>audio.loop=e.target.checked;
document.getElementById('local-music-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>30*1024*1024){error.textContent='Tệp quá lớn. Chọn nhạc dưới 30 MB.';e.target.value='';return;}try{localStorage.removeItem('hikarii_audio_resume_local-music-player');}catch(e){}setSource(file);error.textContent='';try{await storage(file);error.textContent='Đã lưu nhạc trong trình duyệt. Bấm phát để nghe.';}catch(err){error.textContent='Nhạc dùng được trong lần mở này nhưng không lưu được. Bộ nhớ có thể đầy hoặc bị chặn.';}};
document.getElementById('local-music-remove').onclick=async()=>{if(!confirm('Xóa tệp nhạc đã lưu trong trình duyệt này?'))return;try{await storage(undefined,true);setSource(null);document.getElementById('local-music-file').value='';error.textContent='Đã xóa nhạc đã lưu.';}catch(err){error.textContent='Không xóa được nhạc đã lưu. Hãy thử lại.';}};
audio.addEventListener('loadedmetadata',()=>{try{const r=JSON.parse(localStorage.getItem('hikarii_audio_resume_local-music-player')||'{}');if(r.time>0&&r.time<audio.duration)audio.currentTime=r.time;}catch(e){}});
window.hikariiMusic.reload();window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
})();
