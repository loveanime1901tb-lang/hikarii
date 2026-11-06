import localtunnel from 'localtunnel';
import { spawn } from 'child_process';

console.clear();
console.log('======================================================================');
console.log('  HIKARII - TAO DUONG TRUYEN PUBLIC TRUC TUYEN (LOCALTUNNEL)');
console.log('======================================================================\n');

// 1. Check if server is already running on port 3000
console.log('[1/3] Kiem tra Server ung dung (Port 3000)...');
let serverProcess = null;
let isAlreadyRunning = false;

try {
  const check = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(1000) });
  if (check.ok) {
    isAlreadyRunning = true;
    console.log('  -> Server dang hoat dong san tai http://localhost:3000.');
  }
} catch {
  isAlreadyRunning = false;
}

if (!isAlreadyRunning) {
  console.log('  -> Dang khoi dong Server Node.js...');
  serverProcess = spawn('node', ['server.js'], {
    stdio: 'ignore',
    detached: false
  });
  await new Promise((r) => setTimeout(r, 1500));
}

// 2. Fetch Tunnel Password (User IP)
console.log('[2/3] Lay ma Tunnel Password cua may ban...');
let ipPassword = 'Khong lay duoc IP (Kiem tra ket noi mang)';
try {
  const res = await fetch('https://loca.lt/mytunnelpassword');
  if (res.ok) {
    ipPassword = (await res.text()).trim();
  }
} catch {
  try {
    const res2 = await fetch('https://api.ipify.org');
    if (res2.ok) ipPassword = (await res2.text()).trim();
  } catch {}
}

// 3. Open Localtunnel
console.log('[3/3] Dang ket noi duong truyen bao mat HTTPS ra toan cau...\n');
try {
  const tunnel = await localtunnel({ port: 3000 });

  console.log('======================================================================');
  console.log('  DA TAO DUONG LINK ONLINE THANH CONG!');
  console.log('======================================================================');
  console.log(`\n  LINK TRUY CAP:        \x1b[32m\x1b[1m${tunnel.url}\x1b[0m`);
  console.log(`  MAT KHAU TUNNEL:      \x1b[33m\x1b[1m${ipPassword}\x1b[0m\n`);
  console.log('----------------------------------------------------------------------');
  console.log('  * Huong dan: Gui link tren cho ban be hoac mo tren dien thoai.');
  console.log('  * Lan dau mo link, trang loca.lt se yeu cau "Tunnel Password":');
  console.log('    -> Nhap mat khau o tren vao roi bam "Submit" de vao web.');
  console.log('  * Nhan Ctrl + C bat cu luc nao de dung chia se.');
  console.log('======================================================================\n');

  tunnel.on('close', () => {
    console.log('\nTunnel da dong.');
    if (serverProcess) serverProcess.kill();
    process.exit();
  });

  tunnel.on('error', (err) => {
    console.error('Loi tunnel:', err.message);
  });
} catch (err) {
  console.error('Khong the tao tunnel:', err.message);
}

process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});
