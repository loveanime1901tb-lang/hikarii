'use strict';
let wordJobs=[],explainJobs=[],queueToken=null;
function checkStop(){if(queueToken&&queueToken.cancelled){const e=Error('Đã dừng');e.cancelled=true;throw e;}}
function stopUploads(){if(!queueToken)return;queueToken.cancelled=true;if(queueToken.xhr)queueToken.xhr.abort();renderQueues();}
function finishQueue(){if(queueToken&&queueToken.cancelled){[...wordJobs,...explainJobs].forEach(j=>{if(j.state==='pending'){j.state='stopped';j.error='Chưa gửi — đã dừng';}});}queueToken=null;}

function readFile(file,mode){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Không đọc được '+file.name));if(mode==='base64')r.readAsDataURL(file);else if(mode==='text')r.readAsText(file);else r.readAsArrayBuffer(file);}).then(v=>mode==='base64'?String(v).split(',')[1]:v);}
async function reliable(url,body){for(let n=0;;n++){try{checkStop();return await api(url,body,queueToken);}catch(e){if(!e.retryable||n>=2)throw e;await new Promise(r=>setTimeout(r,1000*(n+1)));}}}
async function expandFiles(files,kind){
 const jobs=[],limit=kind==='word'?8*1024*1024:512*1024,ext=kind==='word'?/\.docx$/i:/\.json$/i;let total=0;
 for(const file of files){checkStop();
  if(/\.zip$/i.test(file.name)){
   if(file.size>(kind==='word'?32:8)*1024*1024)throw Error('ZIP tối đa '+(kind==='word'?32:8)+' MB.');
   const zip=await JSZip.loadAsync(await readFile(file)),names=Object.keys(zip.files);
   if(names.length>600)throw Error('ZIP chứa quá nhiều tệp/thư mục (tối đa 600).');
   for(const name of names){checkStop();
    const entry=zip.files[name];if(entry.dir)continue;
    const raw=entry.unsafeOriginalName||name;
    if(raw.split('/').some(x=>x==='..')||raw.indexOf('\\')!==-1||raw.charAt(0)==='/'||name.indexOf('__MACOSX/')===0||name.split('/').pop().startsWith('._'))continue;
    const size=entry._data&&entry._data.uncompressedSize||0;total+=size;
    if(total>96*1024*1024)throw Error('Tổng nội dung ZIP vượt 96 MB. Hãy chia nhỏ gói.');
    if(!ext.test(name))continue;
    const display=file.name+'/'+name,base=name.split('/').pop();
    jobs.push({name:base,key:display,state:size>limit?'error':'pending',error:size>limit?'File vượt giới hạn kích thước.':'',get:async()=>{if(size>limit)throw Error('File vượt giới hạn kích thước.');return entry.async(kind==='word'?'base64':'string');}});
   }
  }else if(ext.test(file.name)){
   total+=file.size;jobs.push({name:file.name,key:file.name,state:'pending',get:async()=>{if(file.size>limit)throw Error('File vượt giới hạn kích thước.');return readFile(file,kind==='word'?'base64':'text');}});
  }
 }
 if(jobs.length>300)throw Error('Tối đa 300 file mỗi lượt.');if(!jobs.length)throw Error('Không tìm thấy '+(kind==='word'?'Word .docx':'lời giải .json')+' trong các file đã chọn.');
 if(kind==='word'){const counts={};jobs.forEach(j=>counts[j.name]=(counts[j.name]||0)+1);jobs.forEach(j=>{if(counts[j.name]>1){j.state='error';j.error='Trùng tên Word trong gói. Đổi tên trước khi nhập.';j.get=null;}});}
 // Give repeated JSON paths distinct UI identities, while keeping original names for matching.
 jobs.forEach((j,i)=>j.key=i+':'+j.key);return jobs;
}
function queueText(jobs){const ok=jobs.filter(j=>j.state==='done').length,bad=jobs.filter(j=>j.state==='error').length;return 'Hoàn tất '+ok+'/'+jobs.length+' · Lỗi '+bad+' · Đã dừng '+jobs.filter(j=>j.state==='stopped').length+'\n'+jobs.map(j=>(j.state==='done'?'✓ ':j.state==='error'?'✕ ':j.state==='running'?'… ':'○ ')+j.name+(j.error?': '+j.error:j.note?': '+j.note:'')).join('\n');}
function renderQueues(){document.querySelectorAll('[data-action="upload-stop"]').forEach(b=>b.disabled=!queueToken||queueToken.cancelled);const log=$('#status');if(log&&wordJobs.length)log.textContent=queueText(wordJobs);const retry=$('[data-action="upload-retry"]');if(retry)retry.disabled=working||explainWork||!wordJobs.some(j=>j.state==='error'||j.state==='pending'||j.state==='stopped');}
async function refreshBank(){items=await api('/api/admin/history');renderBank();}
async function runWords(mode){
 if(working||explainWork)return;working=true;queueToken={cancelled:false};renderBank();renderQueues();
 const category=$('#import-category').value,topic=$('#import-topic').value.trim();
 try{
  if(mode==='scan'){const names=await api('/api/admin/history/import-files',undefined,queueToken);wordJobs=names.map(name=>({name,key:name,state:'pending',scan:true}));}
  else if(mode!=='retry')wordJobs=await expandFiles(Array.from($('#files').files),'word');
  for(const job of wordJobs){
   if(queueToken.cancelled)break;
   if(job.state==='done'||(!job.get&&!job.scan))continue;
   job.state='running';job.error='';renderQueues();
   try{const response=job.scan?await reliable('/api/admin/history/scan-one',{name:job.name,category,topic}):await reliable('/api/admin/history/import-one',{name:job.name,base64:await job.get(),category,topic});job.state='done';job.note=response.status;job.get=null;}
   catch(e){job.state=e.cancelled?'stopped':'error';job.error=e.message;if(e.status===401||e.status===403){job.error+=' Mở /admin ở tab khác để đăng nhập lại, rồi bấm thử lại.';break;}}
   renderQueues();
  }
  try{await refreshBank();}catch(e){$('#status').textContent=queueText(wordJobs)+'\nChưa tải lại danh sách: '+e.message;}
 }finally{finishQueue();working=false;renderBank();renderQueues();}
}
function countExplanations(){const results=explainJobs.filter(j=>j.row).map(j=>j.row),counts={ready:0,review:0,unchanged:0,skipped:0,applied:0};
 const matched={};results.forEach(r=>{if(r.id)(matched[r.id]||(matched[r.id]=[])).push(r);});
 Object.keys(matched).forEach(id=>{if(matched[id].length>1)matched[id].forEach(r=>{r.status='review';r.problems=['Nhiều JSON cùng khớp đề này. Chỉ nhập một lời giải cho mỗi đề.'];explainChosen.delete(r.key);});});
 results.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);explainPreview={results,counts,ignored:[]};renderExplanationPreview();
 const log=$('#explain-log');if(log)log.textContent=queueText(explainJobs);
}
async function checkExplanations(retry){
 if(working||explainWork)return;explainWork=true;queueToken={cancelled:false};renderBank();renderQueues();
 try{
  if(!retry){explainJobs=await expandFiles(Array.from($('#explain-zip').files),'json');explainChosen.clear();explainPreview=null;}
  for(const job of explainJobs){if(queueToken.cancelled)break;if(job.state==='done')continue;job.state='running';job.error='';countExplanations();
   try{const text=await job.get(),data=JSON.parse(text.replace(/^\uFEFF/,''));const row=await reliable('/api/admin/history/explanations/check-one',{name:job.name,data});row.key=job.key;job.row=row;job.state='done';if(row.status==='ready')explainChosen.add(job.key);}
   catch(e){job.state=e.cancelled?'stopped':'error';job.error=e.message;job.row={key:job.key,file:job.name,status:'skipped',problems:[e.message]};if(e.status===401||e.status===403)break;}
   countExplanations();
  }
 }finally{finishQueue();explainWork=false;renderBank();countExplanations();renderQueues();}
}
async function commitExplanations(){
 if(working||explainWork||!explainPreview)return;
 const chosen=explainJobs.filter(j=>j.row&&j.row.status==='ready'&&explainChosen.has(j.key));if(!chosen.length)return;
 const replacements=chosen.reduce((n,j)=>n+(j.row.replaceCount||0),0);
 if(!confirm('Cập nhật '+chosen.length+' đề'+(replacements?' (thay '+replacements+' lời giải hiện có)':'')+'? File cũ sẽ được sao lưu trên máy chủ.'))return;
 explainWork=true;queueToken={cancelled:false};renderBank();renderQueues();renderExplanationPreview();
 try{
  chosen.forEach(j=>{j.state='pending';j.error='';});
  for(const job of chosen){if(queueToken.cancelled)break;job.state='running';
   job.note='Đang cập nhật…';countExplanations();
   try{await reliable('/api/admin/history/explanations/apply-one',{token:job.row.token});job.row.status='applied';job.state='done';job.note='Đã cập nhật';job.error='';explainChosen.delete(job.key);}
   catch(e){job.state=e.cancelled?'stopped':'error';job.error='Chưa xác nhận cập nhật: '+e.message;job.note='';if(e.status===401||e.status===403)break;}
   countExplanations();
  }
  try{await refreshBank();}catch(e){$('#explain-log').textContent+='\nChưa tải lại danh sách: '+e.message;}
 }finally{finishQueue();explainWork=false;renderBank();countExplanations();renderQueues();}
}
async function classifySelected(){
 if(working||explainWork||!checkedIds.size)return;working=true;renderBank();
 const ids=Array.from(checkedIds),category=$('#bulk-category').value,topic=$('#bulk-topic').value.trim(),out=[];
 try{for(let i=0;i<ids.length;i+=20){const r=await reliable('/api/admin/history/classify',{ids:ids.slice(i,i+20),category,topic});out.push(...r.results);}await refreshBank();$('#bulk-result').textContent='Đã phân loại '+out.filter(r=>r.ok).length+'/'+ids.length+' đề.'+out.filter(r=>!r.ok).map(r=>'\n'+r.error).join('');}
 catch(e){$('#bulk-result').textContent='Đã xử lý '+out.length+' đề. '+e.message+' Có thể bấm lại để tiếp tục.';}
 finally{working=false;renderBank();}
}
window.addEventListener('beforeunload',e=>{if(working||explainWork||window.hkFramesBusy){e.preventDefault();e.returnValue='Đang nhập dữ liệu. Các file đã hoàn tất đã được lưu.';}});
