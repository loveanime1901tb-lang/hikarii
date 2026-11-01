import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

console.clear();
console.log('======================================================================');
console.log('  🌟 ENGLISH MASTER - ĐANG TẠO ĐƯỜNG TRUYỀN PUBLIC TRỰC TUYẾN 🌟');
console.log('======================================================================\n');

// 1. Check if server is already running on port 3000
console.log('[1/3] Kiểm tra Server ứng dụng (Port 3000)...');
let serverProcess = null;
let isAlreadyRunning = false;

try {
  const check = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(1000) });
  if (check.ok) {
    isAlreadyRunning = true;
    console.log('  -> Server đang hoạt động sẵn tại http://localhost:3000.');
  }
} catch (e) {
  isAlreadyRunning = false;
}

if (!isAlreadyRunning) {
  console.log('  -> Đang khởi động Server Node.js...');
  serverProcess = spawn('node', ['server.js'], {
    stdio: 'ignore',
    detached: false
  });
  await new Promise(r => setTimeout(r, 1500));
}

// 2. Fetch Tunnel Password (User IP)
console.log('[2/3] Lấy mã Tunnel Password của máy bạn...');
let ipPassword = 'Không lấy được IP (Kiểm tra kết nối mạng)';
try {
  const res = await fetch('https://loca.lt/mytunnelpassword');
  if (res.ok) {
    ipPassword = (await res.text()).trim();
  }
} catch (e) {
  try {
    const res2 = await fetch('https://api.ipify.org');
    if (res2.ok) ipPassword = (await res2.text()).trim();
  } catch {}
}

// 3. Open Localtunnel
console.log('[3/3] Đang kết nối đường truyền bảo mật HTTPS ra toàn cầu...\n');
try {
  const tunnel = await localtunnel({ port: 3000 });

  console.log('======================================================================');
  console.log('  🎉 ĐÃ TẠO ĐƯỜNG LINK ONLINE THÀNH CÔNG!');
  console.log('======================================================================');
  console.log(`\n  👉 ĐƯỜNG LINK TRUY CẬP:  \x1b[32m\x1b[1m${tunnel.url}\x1b[0m`);
  console.log(`  👉 MẬT KHẨ TUNNEL LÀ:   \x1b[33m\x1b[1m${ipPassword}\x1b[0m\n`);
  console.log('----------------------------------------------------------------------');
  console.log('  * Hướng dẫn: Gửi đường link trên cho bạn bè hoặc mở trên điện thoại.');
  console.log('  * Lần đầu mở link, trang loca.lt sẽ hiện ô "Tunnel Password":');
  console.log('    -> Hãy nhập mật khẩu ở trên vào rồi bấm "Submit" để vào học.');
  console.log('  * Nhấn Ctrl + C bất cứ lúc nào để dừng chia sẻ.');
  console.log('======================================================================\n');

  tunnel.on('close', () => {
    console.log('\nTunnel đã đóng.');
    if (serverProcess) serverProcess.kill();
    process.exit();
  });

  tunnel.on('error', (err) => {
    console.error('Lỗi tunnel:', err.message);
  });
} catch (err) {
  console.error('Không thể tạo tunnel:', err.message);
}

process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});
