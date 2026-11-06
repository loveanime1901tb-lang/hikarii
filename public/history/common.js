'use strict';
const $=s=>document.querySelector(s),view=$('#view');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,primary)=>'<button class="hk-button '+(primary?'hk-primary':'')+'" data-action="'+action+'">'+label+'</button>';
function rawApi(url,body,token){return new Promise((resolve,reject)=>{
 if(token&&token.cancelled){const e=Error('Đã dừng');e.cancelled=true;reject(e);return;}const x=new XMLHttpRequest();if(token)token.xhr=x;x.onabort=()=>{const e=Error('Đã dừng gửi. File hiện tại có thể đã được server nhận; hãy kiểm tra danh sách hoặc thử lại để đối chiếu.');e.cancelled=true;reject(e);};x.open(body===undefined?'GET':'POST',url);x.timeout=45000;
 if(url.indexOf('/api/admin/')===0)x.setRequestHeader('X-Hikarii-Admin','1');
 if(body!==undefined)x.setRequestHeader('Content-Type','application/json');
 const fail=(message,status,retryable)=>{const e=Error(message);e.status=status;e.retryable=retryable;reject(e);};
 x.onload=()=>{let d;try{d=JSON.parse(x.responseText);}catch(e){return fail('HTTP '+x.status+': '+(x.responseText.trim()?'Phản hồi không đúng định dạng hoặc bị ngắt.':'Máy chủ trả về rỗng.')+' Hãy thử lại; nếu còn lỗi hãy kiểm tra nhật ký máy chủ.',x.status,true);}
 if(x.status<200||x.status>=300)return fail(d.error||('HTTP '+x.status),x.status,[408,429,502,503,504].includes(x.status));resolve(d);};
 x.onerror=()=>fail('Mất kết nối máy chủ. Có thể thử lại file đang lỗi.',0,true);
 x.ontimeout=()=>fail('Máy chủ phản hồi quá lâu. Có thể thử lại file đang lỗi.',0,true);
 x.send(body===undefined?null:JSON.stringify(body));
 });}
const categories={thpt:'Tổng ôn THPT',semester1:'Học kỳ I',semester2:'Học kỳ II',topic:'Theo bài / chủ đề'};
function categoryOptions(value,all){return (all?'<option value="all">Tất cả nhóm đề</option>':'')+Object.keys(categories).map(k=>'<option value="'+k+'"'+(value===k?' selected':'')+'>'+categories[k]+'</option>').join('');}
function naturalCompare(a,b){const x=String(a).toLowerCase().match(/\d+|\D+/g)||[],y=String(b).toLowerCase().match(/\d+|\D+/g)||[];for(let i=0;i<Math.min(x.length,y.length);i++){if(x[i]===y[i])continue;const n=/^\d+$/.test(x[i])&&/^\d+$/.test(y[i]);const c=n?Number(x[i])-Number(y[i]):x[i].localeCompare(y[i]);if(c)return c;}return x.length-y.length;}
function read(k,d){try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){alert('Bộ nhớ đầy hoặc bị chặn. Hãy xuất sao lưu; thay đổi chưa được lưu.');return false;}}
function error(e){alert(e.message||String(e));}
function theme(){document.documentElement.style.colorScheme=read('hikarii_theme','light');document.documentElement.dataset.theme=read('hikarii_theme','light');}theme();$('#theme').onclick=()=>{save('hikarii_theme',read('hikarii_theme','light')==='dark'?'light':'dark');theme();};
function download(name,value){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}

// Bounded, short-lived cache for public exam reads only. Never cache grades or admin calls.
const examReadCache=new Map(),examReadPending=new Map();
function api(url,body,token){
 if(body!==undefined||!/^\/api\/history\/exams(?:\/[a-f0-9]{24})?$/.test(url))return rawApi(url,body,token);
 const hit=examReadCache.get(url);if(hit&&Date.now()-hit.time<15000)return Promise.resolve(JSON.parse(hit.data));
 if(!examReadPending.has(url))examReadPending.set(url,rawApi(url).then(d=>{const data=JSON.stringify(d);examReadCache.delete(url);examReadCache.set(url,{time:Date.now(),data});while(examReadCache.size>9)examReadCache.delete(examReadCache.keys().next().value);return data;}).finally(()=>examReadPending.delete(url)));
 return examReadPending.get(url).then(JSON.parse);
}
