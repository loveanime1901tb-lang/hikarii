import {parseYouTube} from './core.js';

// Only trusted embed hosts and explicit HTTPS audio resources are accepted.
// No third-party content is proxied or downloaded by the Termux server.
export function parseMusicSource(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch (_) { throw new Error('Hãy dán một liên kết đầy đủ bắt đầu bằng https://.'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Liên kết phải dùng HTTPS và không chứa thông tin đăng nhập.');
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const urlText = url.href;

  if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com',
       'youtu.be','www.youtube-nocookie.com'].includes(host)) {
    const yt = parseYouTube(urlText);
    return {type:'youtube', embed:yt.embed, url:yt.url, label:'Mở trên YouTube ↗'};
  }

  if (host === 'open.spotify.com') {
    // Spotify uses a fixed-format content ID; strip intl-xx prefix if present.
    const match = path.match(/^\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{22})\/?$/i);
    if (!match) throw new Error('Hãy dùng link Spotify bài hát, album hoặc playlist đầy đủ (open.spotify.com).');
    const category = match[1].toLowerCase(), id = match[2];
    return {type:'spotify', embed:'https://open.spotify.com/embed/'+category+'/'+id,
      url:'https://open.spotify.com/'+category+'/'+id, label:'Mở trên Spotify ↗',
      tall:category!=='track'};
  }
  if (host === 'spotify.link') {
    return {type:'external',url:urlText,label:'Mở liên kết Spotify ↗',
      message:'Đây là link Spotify rút gọn. Hãy dùng link đầy đủ từ open.spotify.com để phát ngay trong web.'};
  }

  if (['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(host)) {
    const match = path.match(/^\/(?:@[^/]+\/video\/|player\/v1\/)(\d{15,22})\/?$/);
    if (!match) {
      return {type:'external',url:urlText,label:'Mở trên TikTok ↗',
        message:'Chỉ nhúng được link video TikTok đầy đủ dạng tiktok.com/@ten/video/ID. TikTok phát cả hình lẫn tiếng.'};
    }
    return {type:'tiktok',embed:'https://www.tiktok.com/player/v1/'+match[1],
      url:urlText,label:'Mở trên TikTok ↗'};
  }
  if (['vt.tiktok.com','vm.tiktok.com'].includes(host)) {
    return {type:'external',url:urlText,label:'Mở trên TikTok ↗',
      message:'Link TikTok rút gọn không thể nhúng trực tiếp. Hãy mở liên kết và sao chép địa chỉ video đầy đủ.'};
  }

  if (['zingmp3.vn','www.zingmp3.vn','mp3.zing.vn','www.mp3.zing.vn'].includes(host)) {
    return {type:'external',url:urlText,label:'Mở trên Zing MP3 ↗',
      message:'Zing MP3 chưa có trình nhúng công khai ổn định để phát trực tiếp tại đây. Bạn có thể mở bài hát trên Zing MP3.'};
  }

  if (/\.(?:mp3|m4a|aac|ogg|oga|opus|wav|flac|weba|webm)(?:$)/i.test(path)) {
    return {type:'audio',url:urlText,label:'Mở tệp âm thanh ↗'};
  }

  throw new Error('Chưa hỗ trợ link này. Hãy thử YouTube, Spotify, TikTok, link MP3 trực tiếp hoặc Zing MP3.');
}
