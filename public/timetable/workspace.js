(function(){
'use strict';
const q=id=>document.getElementById(id);
const embedded=window.parent!==window;
function syncTheme(){let dark=false;try{dark=embedded?parent.document.body.classList.contains('dark'):safeGet('hikarii_theme','light')==='dark';}catch(e){}document.documentElement.dataset.theme=dark?'dark':'light';}
let themeObserver=null;syncTheme();if(embedded){themeObserver=new MutationObserver(syncTheme);themeObserver.observe(parent.document.body,{attributes:true,attributeFilter:['class']});}
document.body.dataset.workspace='schedule';
document.querySelector('.app-brand').textContent='Thời khóa biểu';
q('toggleBar').textContent='Ẩn / hiện tùy chỉnh';q('quickExportBtn').textContent='Xuất PNG';
const history=document.createElement('div');history.className='history-tools';history.innerHTML='<button id="tkb-undo" title="Ctrl/⌘ Z" disabled>↶ Hoàn tác</button><button id="tkb-redo" title="Ctrl/⌘ Shift Z" disabled>↷ Làm lại</button>';
document.querySelector('.header-actions').prepend(history);
document.querySelectorAll('.day-tab,.nav-tab').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});});
const nav=document.createElement('nav');nav.className='workspace-nav';nav.setAttribute('aria-label','Công cụ thời khóa biểu');nav.innerHTML='<button data-mode="schedule" aria-selected="true">Lịch học</button><button data-mode="design" aria-selected="false">Thiết kế ảnh</button><button data-mode="export" aria-selected="false">Xuất & sao lưu</button>';
document.querySelector('.app-header').after(nav);
const help=document.createElement('p');help.className='workspace-help';help.textContent='Chọn ngày để sửa môn, giáo viên hoặc thêm tiết. Chuyển sang Thiết kế ảnh để đổi mẫu và ảnh nền.';nav.after(help);
const gallery=document.createElement('div');gallery.id='export-gallery';gallery.setAttribute('aria-label','Ảnh đã xuất');
// Responsive preview controls; render stays in the existing Canvas (no extra high-resolution buffer).
const preview=document.querySelector('.preview-container');
const previewTools=document.createElement('div');
previewTools.className='tkb-preview-tools';
previewTools.innerHTML='<strong>Xem trước thời khóa biểu</strong><div class="tkb-preview-buttons"><button type="button" id="tkb-side-toggle" aria-pressed="false">☰ Thu gọn menu</button><button type="button" id="tkb-preview-zoom" aria-pressed="false">⛶ Phóng to</button></div>';
preview.insertBefore(previewTools,preview.firstChild);
const sideToggle=q('tkb-side-toggle'),zoomToggle=q('tkb-preview-zoom');
if(!embedded)sideToggle.hidden=true;
let previewExpanded=false,sideCollapsed=false;
function notifyHost(action,enabled){
 if(embedded)window.parent.postMessage({type:'hikarii-tkb-ui',action:action,enabled:enabled},window.location.origin);
}
function setPreviewExpanded(enabled){
 previewExpanded=!!enabled;
 document.body.classList.toggle('tkb-preview-expanded',previewExpanded);
 zoomToggle.setAttribute('aria-pressed',String(previewExpanded));
 zoomToggle.textContent=previewExpanded?'✕ Thu nhỏ':'⛶ Phóng to';
 notifyHost('preview',previewExpanded);
 if(!previewExpanded)preview.scrollIntoView({block:'nearest'});
 // Canvas preview quality follows viewport size; PNG export settings are unchanged.
 draw();
}
zoomToggle.onclick=()=>setPreviewExpanded(!previewExpanded);
sideToggle.onclick=()=>{
 sideCollapsed=!sideCollapsed;
 sideToggle.setAttribute('aria-pressed',String(sideCollapsed));
 sideToggle.textContent=sideCollapsed?'☰ Hiện menu':'☰ Thu gọn menu';
 notifyHost('sidebar',sideCollapsed);
};
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(q('previewModal').style.display==='flex'){e.preventDefault();q('closeModal').click();return;}
 if(q('subjectDrawer').style.display==='block'){e.preventDefault();closePicker();return;}
 if(previewExpanded){e.preventDefault();setPreviewExpanded(false);}
});
window.addEventListener('resize',()=>{if(document.body.dataset.workspace!=='export')draw();});

const panel=document.createElement('section');panel.className='backup-panel';panel.innerHTML='<h2>Giữ lại lịch của bạn</h2><p>PNG để đặt hình nền hoặc chia sẻ. JSON để chuyển máy và tiếp tục chỉnh sửa lịch.</p><div class="backup-actions"><button id="export-png">Xuất ảnh PNG</button><button id="export-json">Xuất bản sao JSON</button><label for="import-json">Nhập bản sao JSON</label><input id="import-json" type="file" accept=".json,application/json" hidden></div><p><label><input id="backup-media" type="checkbox" checked> Kèm ảnh nền và nhạc đã lưu (tệp sao lưu sẽ lớn hơn)</label></p><p>Dữ liệu nằm trong trình duyệt đang dùng. Đổi tên miền, đổi trình duyệt hoặc xóa dữ liệu trang sẽ không tự mang lịch sang. Hoàn tác / Làm lại giữ tối đa 50 bước trong lần mở này.</p><details><summary>Quản lý lịch</summary><p>Xóa các tiết học giữ nguyên thiết kế, ảnh nền và nhạc. Có thể Hoàn tác ngay sau khi xóa.</p><div id="danger-slot"></div></details>';
document.querySelector('.preview-section').after(panel);q('danger-slot').append(q('clearDataBtn'));
const exportResults=document.createElement('section');exportResults.id='tkb-export-results';exportResults.className='tkb-export-results';exportResults.hidden=true;
const exportInfo=document.createElement('p');exportInfo.textContent='Ảnh đã tạo trong lần xuất gần nhất. Nếu trình duyệt chặn tải xuống tự động, hãy nhấn Tải thủ công bên dưới. Nhấn hình thu nhỏ để xem hoặc chia sẻ.';
exportResults.append(exportInfo,gallery);q('export-png').closest('.backup-actions').after(exportResults);
const credit=document.createElement('p');credit.className='workspace-credit';credit.textContent='Thiết kế & phát triển bởi Hikarii';panel.after(credit);
q('export-png').onclick=()=>q('quickExportBtn').click();
function switchMode(mode){if(mode==='export'&&previewExpanded)setPreviewExpanded(false);document.body.dataset.workspace=mode;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));toolBox.style.display=mode==='design'?'flex':'none';help.textContent=mode==='schedule'?'Chọn ngày để sửa lịch. Dữ liệu được giữ trong trình duyệt của bạn.':mode==='design'?'7 mẫu thiết kế · chạm vào ô trên ảnh để sửa · PNG xuất giữ nguyên độ phân giải.':'Xuất JSON trước khi chuyển máy hoặc xóa dữ liệu trình duyệt.';if(mode!=='export')draw();}
nav.querySelectorAll('button').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
// Keep session controls reachable without opening design settings.
const sessionControls=document.querySelector('#tab-info .settings-group:last-child');document.querySelector('.editor-header').append(sessionControls);
// Hide the duplicate music tools only inside the integrated app.
const mediaGroup=q('audioInput').closest('.settings-group');
if(embedded){mediaGroup.hidden=true;const musicButton=document.createElement('button');musicButton.textContent='Mở góc âm nhạc chung';musicButton.className='toggle-btn';musicButton.onclick=()=>{parent.document.getElementById('music-panel').hidden=false;};mediaGroup.after(musicButton);}
else {bgMusic.controls=true;bgMusic.style.display='block';mediaGroup.append(bgMusic);}
document.querySelector('[data-tab="tab-info"]').textContent='Tiêu đề';document.querySelector('[data-tab="tab-layout"]').textContent='Mẫu & ảnh nền';document.querySelector('[data-tab="tab-style"]').textContent='Màu & kính';document.querySelector('[data-tab="tab-media"]').textContent=embedded?'Hiệu ứng':'Nhạc & hiệu ứng';
const low=document.createElement('label');low.className='switch-field';low.innerHTML='<span>Giảm hiệu ứng động</span><input type="checkbox" id="low-effects">';q('tab-media').append(low);
q('low-effects').checked=safeGet('tkb_low_effects',window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function effects(){const reduced=q('low-effects').checked;document.body.classList.toggle('low-effects',reduced);if(document.hidden||reduced||exportBusy)EffectEngine.pause();else EffectEngine.resume();}
q('low-effects').onchange=()=>{safeSet('tkb_low_effects',q('low-effects').checked);effects();};document.addEventListener('visibilitychange',()=>{effects();if(document.hidden)flushSettings();});effects();
q('effectSelect').addEventListener('change',effects);
// History snapshots contain editable data/settings, not duplicated media blobs.
const settingFields={title:'titleInput',sub:'subInput',accent:'accentColor',titleColor:'titleColor',subtextColor:'subtextColor',timeColor:'timeColor',subjectColor:'subjectColor',ratio:'ratioSelect',layout:'layoutSelect',textMode:'textModeSelect',glassOpacity:'glassOpacity',overlay:'overlaySelect'};
function snapshot(){const settings={hasAfternoon,isSplitMode};Object.keys(settingFields).forEach(k=>settings[k]=q(settingFields[k]).value);return JSON.stringify({morning:morningData,afternoon:afternoonData,subjects:customSubjectsList,settings});}
let undo=[],redo=[],last=snapshot(),historyTimer=null,restoring=false;
function buttons(){q('tkb-undo').disabled=!undo.length;q('tkb-redo').disabled=!redo.length;}
function commit(){clearTimeout(historyTimer);historyTimer=null;const next=snapshot();if(next!==last){undo.push(last);if(undo.length>50)undo.shift();last=next;redo=[];buttons();}}
window.recordTKB=k=>{if(restoring||!['tkb_morning','tkb_afternoon','tkb_custom_subjects','tkb_settings'].includes(k))return;clearTimeout(historyTimer);historyTimer=setTimeout(commit,k==='tkb_settings'?400:0);};
function applyState(v){restoring=true;try{morningData=v.morning;afternoonData=v.afternoon;customSubjectsList=v.subjects;Object.keys(settingFields).forEach(k=>{if(v.settings[k]!==undefined)q(settingFields[k]).value=v.settings[k];});hasAfternoon=v.settings.hasAfternoon;isSplitMode=v.settings.isSplitMode;afternoonToggle.checked=hasAfternoon;splitImageToggle.checked=isSplitMode;root.style.setProperty('--accent-color',accentColorInput.value);customSubjectColorField.style.display=textModeSelect.value==='custom'?'flex':'none';safeSet('tkb_morning',morningData);safeSet('tkb_afternoon',afternoonData);safeSet('tkb_custom_subjects',customSubjectsList);saveAllSettings();flushSettings();updateSplitUI();renderSubjectPicker();closePicker();}finally{restoring=false;}}
function travel(forward){commit();const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(last);last=from.pop();applyState(JSON.parse(last));buttons();notifyTKB(forward?'Đã làm lại.':'Đã hoàn tác.');}
q('tkb-undo').onclick=()=>travel(false);q('tkb-redo').onclick=()=>travel(true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();travel(e.shiftKey);}});
function validateBackup(v){
 if(!v||v.format!=='hikarii-timetable'||v.version!==1)throw Error('Không đúng định dạng bản sao TKB phiên bản 1.');
 const state=v.state;if(!state||!state.settings)throw Error('Thiếu dữ liệu lịch.');
 for(const session of ['morning','afternoon']){const rows=state[session];if(!Array.isArray(rows)||rows.length<1||rows.length>30)throw Error('Mỗi buổi cần 1–30 hàng tiết.');rows.forEach(r=>{if(!r||typeof r.p!=='string'||r.p.length>20||!Array.isArray(r.d)||r.d.length!==5)throw Error('Hàng tiết không hợp lệ.');r.d.forEach(c=>{if(c!==null&&(!c||typeof c.s!=='string'||c.s.length>120||typeof c.t!=='string'||c.t.length>120))throw Error('Môn/giáo viên không hợp lệ.');});});}
 if(!Array.isArray(state.subjects)||state.subjects.length>200||state.subjects.some(s=>typeof s!=='string'||s.length>120))throw Error('Danh sách môn không hợp lệ.');
 if(typeof state.settings.hasAfternoon!=='boolean'||typeof state.settings.isSplitMode!=='boolean')throw Error('Cấu hình ca học không hợp lệ.');
 Object.keys(settingFields).forEach(k=>{const val=state.settings[k],el=q(settingFields[k]);if(typeof val!=='string'||val.length>200)throw Error('Thiếu hoặc sai cấu hình '+k);if(el.tagName==='SELECT'&&!Array.from(el.options).some(o=>o.value===val))throw Error('Giá trị không hỗ trợ: '+k);if(el.type==='color'&&!/^#[0-9a-f]{6}$/i.test(val))throw Error('Mã màu không hợp lệ.');});
 if(v.media){for(const key of Object.keys(v.media)){if(!['custom_bg','custom_audio'].includes(key))throw Error('Tệp đính kèm không hợp lệ.');const m=v.media[key];if(typeof m!=='string'||m.length>43*1024*1024||!/^data:(image\/(png|jpeg|webp|gif)|audio\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/=]+$/i.test(m))throw Error('Tệp ảnh/nhạc trong bản sao không hợp lệ.');if(key==='custom_audio'&&!m.startsWith('data:audio/'))throw Error('Nhạc không hợp lệ.');if(key==='custom_bg'&&!m.startsWith('data:image/'))throw Error('Ảnh nền không hợp lệ.');}}
 return state;
}
function dataURL(blob){if(typeof blob==='string')return Promise.resolve(blob);return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Không đọc được tệp.'));r.readAsDataURL(blob);});}
q('export-json').onclick=async()=>{const b=q('export-json');b.disabled=true;try{commit();flushSettings();const backup={format:'hikarii-timetable',version:1,createdAt:new Date().toISOString(),state:JSON.parse(snapshot()),media:{}};if(q('backup-media').checked){for(const key of ['custom_bg','custom_audio']){const asset=await assetOp(key);if(asset)backup.media[key]=await dataURL(asset);}}const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hikarii-tkb-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notifyTKB('Đã tạo bản sao JSON. Giữ tệp này để chuyển lịch sang máy khác.');}catch(e){notifyTKB(e.message);}finally{b.disabled=false;}};
q('import-json').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>65*1024*1024)throw Error('Bản sao quá lớn (tối đa 65 MB).');const text=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Không đọc được bản sao.'));r.readAsText(file);});const v=JSON.parse(text),state=validateBackup(v);if(!confirm('Thay lịch và thiết kế hiện tại bằng bản sao này? Nên xuất bản sao hiện tại trước. Ảnh/nhạc đính kèm sẽ thay tệp tương ứng.'))return;commit();applyState(state);commit();for(const key of Object.keys(v.media||{})){const val=v.media[key],parts=val.split(','),raw=atob(parts[1]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const blob=new Blob([bytes],{type:parts[0].slice(5,-7)});await assetOp(key,blob);if(key==='custom_bg'){if(currentBgObjectUrl)URL.revokeObjectURL(currentBgObjectUrl);currentBgObjectUrl=URL.createObjectURL(blob);loadedBgImg=new Image();loadedBgImg.onload=()=>{bgImgVersion++;removeBgBtn.style.display='block';draw();};loadedBgImg.src=currentBgObjectUrl;}else if(embedded&&parent.hikariiMusic)await parent.hikariiMusic.reload();else setAudioSource(blob,'Nhạc từ bản sao');}notifyTKB('Đã nhập lịch. Hoàn tác phục hồi lịch và thiết kế; ảnh/nhạc cần khôi phục bằng bản sao.');}catch(err){notifyTKB('Không nhập được: '+err.message);}finally{e.target.value='';}};
q('customSubject').maxLength=q('customTeacher').maxLength=120;titleInput.maxLength=subInput.maxLength=200;
// Old local keys remain readable; only consolidated settings are written now.
if(!embedded&&!safeGet('tkb_welcome_seen',false)){notifyTKB('Chào bạn! Chọn ngày để sửa lịch, rồi vào Thiết kế ảnh để thử các mẫu.');safeSet('tkb_welcome_seen',true);}
let disposed=false;window.disposeTKB=()=>{if(disposed)return;disposed=true;notifyHost('preview',false);notifyHost('sidebar',false);flushSettings();clearTimeout(historyTimer);if(_drawTimer)cancelAnimationFrame(_drawTimer);EffectEngine.pause();if(themeObserver)themeObserver.disconnect();window.closeTKBExport();if(currentBgObjectUrl)URL.revokeObjectURL(currentBgObjectUrl);if(currentAudioUrl)URL.revokeObjectURL(currentAudioUrl);};window.addEventListener('pagehide',window.disposeTKB);
switchMode('schedule');
})();
