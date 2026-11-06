'use strict';
// All routes inherit the existing /api/admin authentication middleware.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function(ctx){
 const {app,dir,imp,bank,read,write,all,summary,parse,inspect}=ctx;
 const versions=path.join(dir,'versions'),jobs=path.join(dir,'import-jobs');
 [versions,jobs].forEach(p=>fs.mkdirSync(p,{recursive:true}));
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 const core=q=>({type:q.type,number:q.number,text:q.text,options:q.options,answer:q.answer});
 const fingerprint=e=>hash(JSON.stringify(e.questions.map(core)));
 const fail=(message,status=400)=>{const e=Error(message);e.status=status;throw e;};
 function metadata(e,b){
  if(b.category!==undefined){if(!['thpt','semester1','semester2','topic'].includes(b.category))fail('Nhóm đề không hợp lệ.');e.category=b.category;}
  if(b.topic!==undefined){if(typeof b.topic!=='string'||b.topic.length>100)fail('Tên bài/chủ đề tối đa 100 ký tự.');e.topic=b.topic.trim();}
  e.category=e.category||'thpt';e.topic=e.topic||'';
 }
 function archive(e){
  if(!/^[a-f0-9]{24}$/.test(e.id)||!/^[a-f0-9]{64}$/.test(e.revision))return;
  const folder=path.join(versions,e.id);fs.mkdirSync(folder,{recursive:true});
  const file=path.join(folder,e.revision+'.json');
  // Keep the last authoritative state for this question revision (including explanations).
  fs.writeFileSync(file,JSON.stringify(e),{mode:384});
 }
 function resolve(id,revision){
  const e=read(id);if(e.revision===revision)return e;
  if(typeof revision==='string'&&/^[a-f0-9]{64}$/.test(revision)){
   const file=path.join(versions,id,revision+'.json');
   if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));
  }
  fail('Không tìm thấy phiên bản đề của bài làm này. Bài vẫn được giữ trên thiết bị.',409);
 }
 function nameCheck(name){
  if(typeof name!=='string'||name.length>155||!name.trim()||/[\\/\x00-\x1f<>:"|?*]/.test(name)||name.startsWith('.')||!/^.+\.docx$/i.test(name))fail('Tên file Word không hợp lệ. Không dùng ký tự / hoặc \\.');
  return name;
 }
 let importing=false;
 async function importOne(name,b,batch){
  nameCheck(name);if(b.length>8*1024*1024)fail('Word tối đa 8 MB.');
  const id=hash(name).slice(0,24),sourceHash=hash(b);let old=null;
  try{old=read(id);}catch(err){if(fs.existsSync(path.join(bank,id+'.json')))throw err;}
  if(old&&old.trashed)fail('Đề nằm trong Thùng rác. Hãy khôi phục trước khi nhập lại.',409);
  if(old&&old.sourceHash===sourceHash)return {ok:true,name,id,status:'Không đổi',exam:summary(old)};
  const e=await parse(b,name);
  Object.assign(e,{id,source:name,sourceHash,revision:fingerprint(e)});
  metadata(e,batch||{});
  if(old){
   archive(old);
   e.title=old.title;e.minutes=old.minutes;e.category=old.category||'thpt';e.topic=old.topic||'';
   e.questions.forEach(q=>{const prior=old.questions.find(x=>JSON.stringify(core(x))===JSON.stringify(core(q)));if(prior&&prior.explanation)q.explanation=prior.explanation;});
   if(fingerprint(e)===fingerprint(old))Object.assign(e,{revision:old.revision,published:old.published,hidden:old.hidden});
   // A genuinely changed exam is a draft until the administrator checks it.
  }
  const temp=path.join(imp,name+'.tmp');fs.writeFileSync(temp,b);fs.renameSync(temp,path.join(imp,name));write(e);
  return {ok:true,name,id,status:e.errors.length?'Cần sửa: '+e.errors.join('; '):old?'Đã cập nhật; giữ lời giải của câu không đổi':'Đã nhập bản nháp',exam:summary(e)};
 }
 async function upload(body){
  if(importing)fail('Đang nhập một đề khác. Thử lại sau.',409);
  if(!body||typeof body.base64!=='string'||body.base64.length>11200000)fail('Word tối đa 8 MB.');
  importing=true;try{return await importOne(nameCheck(body.name),Buffer.from(body.base64,'base64'),body);}finally{importing=false;}
 }
 app.post('/api/admin/history/import-one',async(req,res)=>res.json(await upload(req.body)));
 app.get('/api/admin/history/import-files',(req,res)=>res.json(fs.readdirSync(imp).filter(n=>/\.docx$/i.test(n))));
 app.post('/api/admin/history/scan-one',async(req,res)=>{
  if(importing)fail('Đang nhập một đề khác.',409);const name=nameCheck(req.body.name);importing=true;
  try{res.json(await importOne(name,fs.readFileSync(path.join(imp,name)),req.body));}finally{importing=false;}
 });
 async function scan(){const results=[];for(const name of fs.readdirSync(imp).filter(n=>/\.docx$/i.test(n))){try{if(importing)fail('Đang nhập đề khác.',409);importing=true;results.push(await importOne(name,fs.readFileSync(path.join(imp,name)),{}));}catch(e){results.push({name,status:e.message});}finally{importing=false;}}return results;}
 app.post('/api/admin/history/classify',(req,res)=>{
  const b=req.body;if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>20)fail('Chọn 1–20 đề mỗi lượt.');
  const results=b.ids.map(id=>{try{const e=read(id);metadata(e,b);write(e);return {id,ok:true};}catch(err){return {id,ok:false,error:err.message};}});
  res.json({results});
 });
 // A preview ticket per JSON, persisted for restart/retry. No full ZIP is sent to the tablet.
 let cleaned=0;
 function cleanJobs(){if(Date.now()-cleaned<3600000)return;cleaned=Date.now();for(const file of fs.readdirSync(jobs)){const p=path.join(jobs,file);if(Date.now()-fs.statSync(p).mtimeMs>7*86400000)fs.unlinkSync(p);}}
 function ticketWrite(token,p){const file=path.join(jobs,token+'.json');fs.writeFileSync(file+'.tmp',JSON.stringify(p),{mode:384});fs.renameSync(file+'.tmp',file);}
 app.post('/api/admin/history/explanations/check-one',(req,res)=>{
  cleanJobs();const b=req.body;
  if(typeof b.name!=='string'||b.name.length>500||!b.data||Buffer.byteLength(JSON.stringify(b.data))>512*1024)fail('Lời giải JSON tối đa 512 KB.');
  const row=inspect(b.data,b.name,all().filter(e=>!e.trashed));
  if(row.status==='ready'){
   const token=crypto.randomBytes(24).toString('hex');ticketWrite(token,{created:Date.now(),row});row.token=token;
  }
  const out=Object.assign({},row);delete out.choices;delete out.sourceDigest;res.json(out);
 });
 app.post('/api/admin/history/explanations/apply-one',(req,res)=>{
  const token=req.body.token;if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))fail('Mã xem trước không hợp lệ.');
  const file=path.join(jobs,token+'.json');if(!fs.existsSync(file))fail('Bản xem trước đã hết hạn. Kiểm tra file lại.',409);
  const job=JSON.parse(fs.readFileSync(file,'utf8'));if(job.receipt)return res.json(job.receipt);
  if(Date.now()-job.created>86400000)fail('Bản xem trước hết hạn sau 24 giờ. Kiểm tra lại file.',409);
  const row=job.row,e=read(row.id);
  if(e.trashed)fail('Đề đã vào Thùng rác.',409);
  const same=row.choices.every(c=>{const q=e.questions.find(q=>q.type===c.type&&q.number===c.number);return q&&q.explanation===c.explanation;});
  if(!same&&hash(JSON.stringify(e.questions))!==row.sourceDigest)fail('Đề đã thay đổi sau khi xem trước. Kiểm tra lại file này.',409);
  if(!same){
   const backup=path.join(dir,'explanation-backups','v3-'+token);fs.mkdirSync(backup,{recursive:true});
   fs.writeFileSync(path.join(backup,e.id+'.json'),JSON.stringify(e),{mode:384});
   row.choices.forEach(c=>{e.questions.find(q=>q.type===c.type&&q.number===c.number).explanation=c.explanation;});write(e);
  }
  job.receipt={ok:true,id:e.id,status:same?'unchanged':'ok'};ticketWrite(token,job);res.json(job.receipt);
 });
 return {scan,upload,metadata,archive,resolve,fingerprint};
};
