'use strict';
// One lazy worker for DOCX parsing and Word generation; no periodic disk writes.
let Worker;try{Worker=require('worker_threads').Worker;}catch(_){}
let worker=null,pending=null,idle=null;
exports.run=async function(type,a,b){
 if(pending){const e=Error('Đang xử lý một file khác. Vui lòng thử lại.');e.status=429;throw e;}
 if(!Worker){await new Promise(r=>setImmediate(r));return type==='parse'?require('./history.cjs').parse(a,b):require('./history-paper.cjs')[type](a,b);}
 clearTimeout(idle);
 if(!worker){worker=new Worker(require('path').join(__dirname,'history-worker.cjs'));const current=worker;worker.on('message',m=>{const p=pending;pending=null;if(!p)return;if(m.error){const e=Error(m.error);e.status=400;p.reject(e);}else p.resolve(type==='parse'?m.value:m.value);idle=setTimeout(()=>{const w=worker;worker=null;if(w)w.terminate();},15000);idle.unref();});worker.on('error',err=>{if(worker!==current)return;if(pending){pending.reject(err);pending=null;}worker=null;});worker.on('exit',()=>{if(worker!==current)return;worker=null;if(pending){pending.reject(Error('Tác vụ xử lý đã dừng. Hãy thử lại.'));pending=null;}});}
 return new Promise((resolve,reject)=>{pending={resolve,reject};worker.postMessage({type,a,b});});
};
