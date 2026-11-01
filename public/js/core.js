export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseYouTube(value) {
  let u; try { u=new URL(value); } catch { throw new Error('Hãy nhập link YouTube đầy đủ, bắt đầu bằng https://.'); }
  if(u.protocol!=='https:' && u.protocol!=='http:') throw new Error('Link không hợp lệ.');
  const host=u.hostname.toLowerCase();
  if(!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host)) throw new Error('Chỉ hỗ trợ liên kết từ YouTube.');
  const parts=u.pathname.split('/').filter(Boolean);
  let id=host==='youtu.be'?parts[0]:u.searchParams.get('v');
  if(['shorts','embed','live'].includes(parts[0])) id=parts[1];
  const list=u.searchParams.get('list');
  if(id && !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('Mã video YouTube không hợp lệ.');
  if(list && !/^[a-zA-Z0-9_-]{10,100}$/.test(list)) throw new Error('Mã playlist không hợp lệ.');
  if(!id&&!list) throw new Error('Link cần trỏ đến một video hoặc playlist.');
  const q=new URLSearchParams({autoplay:'0',rel:'0',playsinline:'1'});
  if(list){q.set('list',list);if(!id) q.set('listType','playlist');}
  return {embed:`https://www.youtube-nocookie.com/embed/${id||'videoseries'}?${q}`,url:id?`https://www.youtube.com/watch?v=${id}${list?'&list='+list:''}`:`https://www.youtube.com/playlist?list=${list}`};
}
export const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function streakCount(days, now=new Date()) {
  const d=new Date(now);let count=0;
  if(!days[dayKey(d)])d.setDate(d.getDate()-1);
  while(days[dayKey(d)]){count++;d.setDate(d.getDate()-1);}return count;
}
export function validateLesson(l){const a=l?.sentences||l?.dialogues;return l&&typeof l.title==='string'&&Array.isArray(a)&&a.length>0&&a.every(i=>typeof i.en==='string'&&typeof i.vi==='string');}
