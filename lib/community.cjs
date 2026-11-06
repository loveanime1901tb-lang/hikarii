'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function({app,dir,imp,bank,store,read}){
 const root=path.join(dir,'avatar-frames');fs.mkdirSync(root,{recursive:true});const catalog=path.join(root,'catalog.json');
 let frames=fs.existsSync(catalog)?JSON.parse(fs.readFileSync(catalog,'utf8')):[{id:'rose-lilac',name:'Hoa hồng tím',published:true,url:'/assets/frames/rose-lilac.png'}];
 const safe=f=>({id:f.id,name:f.name,published:f.published,url:f.url});
 function persist(next){fs.writeFileSync(catalog+'.tmp',JSON.stringify(next),{mode:384});fs.renameSync(catalog+'.tmp',catalog);frames=next;}
 function fail(s){const e=Error(s);e.status=400;throw e;}
 app.get('/api/history/frames',(req,res)=>{res.setHeader('Cache-Control','private, no-cache');res.json(frames.filter(f=>f.published).map(safe));});
 app.get('/api/admin/history/frames/list',(req,res)=>res.json(frames.map(safe)));
 app.get('/api/history/frame-image/:id',async(req,res)=>{
  const f=frames.find(f=>f.id===req.params.id);if(!f)return res.status(404).end();
  res.setHeader('Cache-Control','public, max-age=86400');res.type('png');res.sendFile(path.join(root,f.id+'.png'));
 });
 app.post('/api/admin/history/frames/upload',(req,res)=>{
  const body=req.body||{},name=String(body.name||'').trim().slice(0,60);if(!name||typeof body.base64!=='string'||body.base64.length>1500000)fail('Khung PNG tối đa 1 MB, cần có tên.');
  if(frames.length>=150)fail('Kho tối đa 150 khung. Hãy xóa khung không dùng.');
  const b=Buffer.from(body.base64,'base64');if(b.length<45||b.length>1048576||b.slice(0,8).toString('hex')!=='89504e470d0a1a0a')fail('Chỉ nhận ảnh PNG tĩnh.');
  let at=8,ended=false,ihdr=false,idat=false;while(at+12<=b.length){const n=b.readUInt32BE(at),t=b.toString('ascii',at+4,at+8);if(at+12+n>b.length)fail('PNG bị thiếu dữ liệu.');if(t==='acTL')fail('Chỉ dùng khung tĩnh, không nhận APNG động.');if(t==='IHDR'){if(at!==8||n!==13)fail('PNG không hợp lệ.');const w=b.readUInt32BE(at+8),h=b.readUInt32BE(at+12);if(w<32||h<32||w>1024||h>1024||w!==h)fail('Chọn khung vuông từ 32 đến 1024 px.');ihdr=true;}if(t==='IDAT')idat=true;at+=n+12;if(t==='IEND'){ended=true;break;}}
  if(!ended||!ihdr||!idat||at!==b.length)fail('PNG không hợp lệ.');
  const id=crypto.randomBytes(16).toString('hex'),f={id,name,published:false,url:'/api/history/frame-image/'+id};
  fs.writeFileSync(path.join(root,id+'.png'),b,{mode:384});try{persist(frames.concat(f));}catch(e){fs.unlinkSync(path.join(root,id+'.png'));throw e;}res.json(safe(f));
 });
 app.post('/api/admin/history/frames/update',(req,res)=>{
  const b=req.body||{},f=frames.find(f=>f.id===b.id);if(!f)fail('Không tìm thấy khung.');
  if(b.action==='delete'){persist(frames.filter(x=>x.id!==f.id));if(/^[a-f0-9]{32}$/.test(f.id)){try{fs.unlinkSync(path.join(root,f.id+'.png'));}catch(e){if(e.code!=='ENOENT')throw e;}}return res.json({ok:true});}
  const next=Object.assign({},f);if(typeof b.name==='string'){next.name=b.name.trim().slice(0,60);if(!next.name)fail('Cần đặt tên khung.');}if(typeof b.published==='boolean')next.published=b.published;
  persist(frames.map(x=>x.id===f.id?next:x));res.json(safe(next));
 });
 async function removeTree(p){let st;try{st=await fs.promises.lstat(p);}catch(e){if(e.code==='ENOENT')return;throw e;}if(st.isDirectory()&&!st.isSymbolicLink()){for(const n of await fs.promises.readdir(p))await removeTree(path.join(p,n));await fs.promises.rmdir(p);}else await fs.promises.unlink(p);}
 async function cleanBackups(p,id){let names;try{names=await fs.promises.readdir(p);}catch(e){if(e.code==='ENOENT')return;throw e;}for(const name of names){const file=path.join(p,name),st=await fs.promises.lstat(file);if(st.isSymbolicLink())continue;if(st.isDirectory())await cleanBackups(file,id);else if(name===id+'.json')await fs.promises.unlink(file);}}
 app.post('/api/admin/history/purge',async(req,res)=>{
  const ids=req.body.ids;if(req.body.confirm!=='permanent'||!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id)))fail('Yêu cầu xóa không hợp lệ.');
  const jobs=path.join(dir,'import-jobs'),jobRefs=new Map();if(fs.existsSync(jobs))for(const n of await fs.promises.readdir(jobs)){if(!/^[a-f0-9]+\.json$/.test(n))continue;const p=path.join(jobs,n);let j;try{j=JSON.parse(await fs.promises.readFile(p,'utf8'));}catch(e){continue;}const key=j.row&&j.row.id||j.receipt&&j.receipt.id;if(ids.includes(key)){if(!jobRefs.has(key))jobRefs.set(key,[]);jobRefs.get(key).push(p);}}
  const results=[];for(const id of new Set(ids)){try{
   if(!store.list().some(e=>e.id===id)){results.push({id,status:'ok',alreadyDeleted:true});continue;}
   const e=read(id);if(!e.trashed)fail('Chỉ xóa vĩnh viễn đề trong Thùng rác.');
   if(e.source&&/^[^.].*\.docx$/i.test(e.source)&&path.basename(e.source)===e.source&&!/[\\/]/.test(e.source)&&!store.list().some(x=>x.id!==id&&x.source===e.source))await removeTree(path.join(imp,e.source));
   await removeTree(path.join(dir,'versions',id));await cleanBackups(path.join(dir,'explanation-backups'),id);
   for(const p of jobRefs.get(id)||[])await removeTree(p);
   await removeTree(path.join(bank,id+'.json'));store.forget(id);results.push({id,status:'ok'});
  }catch(e){results.push({id,status:'failed',error:e.message});}await new Promise(r=>setImmediate(r));}
  res.json({results});
 });
};
