'use strict';
// Small summary index + bounded serialized LRU. Never hand mutable cache objects to callers.
const fs=require('fs'),path=require('path');
module.exports=function(bank,summary){
 const index=new Map(),cache=new Map();let bytes=0;const limit=6*1024*1024;
 const valid=id=>{if(!/^[a-f0-9]{24}$/.test(id))throw Error('Mã đề không hợp lệ');};
 function remember(id,s){if(cache.has(id)){bytes-=cache.get(id).length*2;cache.delete(id);}if(s.length*2>limit)return;cache.set(id,s);bytes+=s.length*2;while(bytes>limit||cache.size>24){const k=cache.keys().next().value;bytes-=cache.get(k).length*2;cache.delete(k);}}
 function record(e,s){index.set(e.id,Object.assign(summary(e),{source:e.source}));remember(e.id,s);}
 const ready=(async()=>{for(const name of await fs.promises.readdir(bank)){if(!/^[a-f0-9]{24}\.json$/.test(name))continue;const s=await fs.promises.readFile(path.join(bank,name),'utf8');record(JSON.parse(s),s);await new Promise(r=>setImmediate(r));}})();
 async function warm(id){if(!id)return;valid(id);if(!cache.has(id)){try{const s=await fs.promises.readFile(path.join(bank,id+'.json'),'utf8');record(JSON.parse(s),s);}catch(e){if(e.code!=='ENOENT')throw e;}}}
 function read(id){valid(id);const s=cache.get(id)||fs.readFileSync(path.join(bank,id+'.json'),'utf8');remember(id,s);return JSON.parse(s);}
 function write(e){valid(e.id);const dest=path.join(bank,e.id+'.json'),s=JSON.stringify(e);fs.writeFileSync(dest+'.tmp',s,{mode:384});fs.renameSync(dest+'.tmp',dest);record(e,s);}
 function forget(id){index.delete(id);if(cache.has(id)){bytes-=cache.get(id).length*2;cache.delete(id);}}
 return {ready,warm,read,write,forget,list:()=>Array.from(index.values()).map(e=>Object.assign({},e)),all:()=>Array.from(index.keys()).map(read)};
};
