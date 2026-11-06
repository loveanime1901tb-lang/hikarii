import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import util from 'util';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { learnerPrompt } from './public/js/personalization.js';
import { H_ADMIN_HTML, H_MAINTENANCE_HTML } from './lib/templates.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const LOGS_DIR = path.resolve(path.join(__dirname, 'logs'));

// Ensure required runtime folders exist
[DATA_DIR, PUBLIC_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const VERSION = '2026.11.07-node24-modern.1';
let hAdminRequests = 0;
let hPresenceRequests = 0;
let hRequests = 0;
let hErrors = 0;
let hActive = 0;
let hMaintenance = false;
const hEvents = [];
const hLogState = { persistent: false, mode: 'ram', limit: 100, error: null };

function hCleanLog(s) {
  return String(s)
    .replace(/AIza[\w-]+/g, '[KEY]')
    .replace(/(api[_-]?key|password|token)([\s:=]+)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 1200);
}

function hEvent(kind, message) {
  message = hCleanLog(message);
  kind = String(kind).slice(0, 40);
  const now = new Date().toISOString();
  let index = -1;
  for (let i = 0; i < hEvents.length; i++) {
    if (hEvents[i].kind === kind && hEvents[i].message === message) {
      index = i;
      break;
    }
  }
  let event;
  if (index >= 0) {
    event = hEvents.splice(index, 1)[0];
    event.count = Math.min(Number.MAX_SAFE_INTEGER, event.count + 1);
    event.time = now;
  } else {
    event = { time: now, firstTime: now, kind, message, count: 1 };
  }
  hEvents.push(event);
  if (hEvents.length > 100) hEvents.shift();
}

function hDataError(filePath, err) {
  const code = err instanceof SyntaxError ? 'INVALID_JSON' : (err.code || 'READ_ERROR');
  hEvent('error', `${path.basename(filePath)}: ${code}`);
  const error = new Error(`Không đọc được ${path.basename(filePath)} (${code}). Kiểm tra thư mục data và nội dung JSON.`);
  error.status = 503;
  error.code = code;
  return error;
}

async function readJsonFile(filePath, defaultValue) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (err) {
    if (err.code === 'ENOENT' && arguments.length > 1) return defaultValue;
    throw hDataError(filePath, err);
  }
}

async function writeJsonFile(filePath, data) {
  const temp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fsPromises.writeFile(temp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    await fsPromises.rename(temp, filePath);
  } catch (err) {
    await fsPromises.unlink(temp).catch(() => {});
    hEvent('error', `${path.basename(filePath)}: ${err.code || 'WRITE_ERROR'}`);
    const e = new Error(`Không ghi được ${path.basename(filePath)}. Kiểm tra quyền ghi và dung lượng đĩa.`);
    e.status = 503;
    throw e;
  }
}

const hLessonStatus = {};
async function hReadLessons(type) {
  const name = `lessons_${type}.json`;
  try {
    const data = await readJsonFile(path.join(DATA_DIR, name));
    if (
      !Array.isArray(data) ||
      !data.every((l) => {
        const a = l && (l.sentences || l.dialogues);
        return (
          l &&
          typeof l.id === 'string' &&
          typeof l.title === 'string' &&
          Array.isArray(a) &&
          a.length > 0 &&
          a.every((i) => i && typeof i.vi === 'string' && typeof i.en === 'string')
        );
      })
    ) {
      const err = new Error(`Dữ liệu ${name} không đúng cấu trúc bài học.`);
      err.status = 503;
      throw err;
    }
    hLessonStatus[type] = { file: name, ok: true, count: data.length, checkedAt: new Date().toISOString() };
    return data;
  } catch (err) {
    hLessonStatus[type] = { file: name, ok: false, count: 0, error: err.message, checkedAt: new Date().toISOString() };
    throw err;
  }
}

async function hCheckLessons() {
  for (const type of ['sentence', 'writing', 'conversation']) {
    try {
      await hReadLessons(type);
    } catch {
      /* handled in hLessonStatus */
    }
  }
  return hLessonStatus;
}

// Security & Header Configuration
app.disable('x-powered-by');
app.use(cors());

app.use((req, res, next) => {
  hRequests++;
  hActive++;
  if (req.path.startsWith('/api/admin/')) hAdminRequests++;
  if (req.path === '/api/presence') hPresenceRequests++;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');

  let complete = false;
  function finish() {
    if (complete) return;
    complete = true;
    hActive--;
    if (res.statusCode >= 500) hErrors++;
  }
  res.once('finish', finish);
  res.once('close', finish);
  next();
});

// JSON Body Parsers
app.use('/api/admin/history', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

// Vocabulary write serialization queue
let hVocabularyQueue = Promise.resolve();
app.use('/api/vocabulary', (req, res, next) => {
  if (req.method === 'GET') return next();
  let release;
  const wait = hVocabularyQueue;
  hVocabularyQueue = new Promise((resolve) => {
    release = resolve;
  });
  res.once('finish', release);
  res.once('close', release);
  wait.then(() => {
    if (!res.destroyed) next();
    else release();
  });
});

// Maintenance response handler
function hSendMaintenancePage(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Retry-After', '60');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  return res.status(503).type('html').send(H_MAINTENANCE_HTML);
}

// Maintenance middleware
app.use((req, res, next) => {
  if (!hMaintenance) return next();
  if (req.path === '/admin' || req.path.startsWith('/api/admin') || req.path === '/api/health') return next();

  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ ok: false, error: 'Máy chủ đang bảo trì. Vui lòng quay lại sau.' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.path === '/' || req.path === '/index.html' || /\.html?$/i.test(req.path) || (req.headers.accept || '').includes('text/html')) {
      return hSendMaintenancePage(res);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '60');
  return res.status(503).type('text/plain').send('Website đang bảo trì. Vui lòng quay lại sau.');
});

// Admin Authentication Configuration
const hAdminFile = path.resolve(process.env.ADMIN_FILE || path.join(__dirname, '.hikarii-admin.json'));
let hAuth = null;
const hSessions = Object.create(null);
let hLoginWindow = 0;
let hLoginCount = 0;
let hLoginBusy = false;

function hMakeAuth(password) {
  const salt = crypto.randomBytes(24).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash, iterations: 120000 };
}

function hInitAuth() {
  if (process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD phải có ít nhất 10 ký tự.');
    hAuth = hMakeAuth(process.env.ADMIN_PASSWORD);
    return;
  }
  if (fs.existsSync(hAdminFile)) {
    try {
      hAuth = JSON.parse(fs.readFileSync(hAdminFile, 'utf8'));
      if (hAuth && /^[a-f0-9]{48}$/.test(hAuth.salt) && /^[a-f0-9]{64}$/.test(hAuth.hash) && hAuth.iterations === 120000) {
        return;
      }
    } catch {
      /* parse error falls through to generate new */
    }
  }
  const password = crypto.randomBytes(18).toString('hex');
  hAuth = hMakeAuth(password);
  fs.writeFileSync(hAdminFile, JSON.stringify(hAuth) + '\n', { flag: 'w', mode: 0o600 });
  console.log('\n=======================================================');
  console.log('  MẬT KHẨU QUẢN TRỊ ADMIN (lần đầu tạo): ' + password);
  console.log('  Đăng nhập tại: http://localhost:' + PORT + '/admin');
  console.log('=======================================================\n');
}

hInitAuth();

function hPruneSessions() {
  const now = Date.now();
  Object.keys(hSessions).forEach((k) => {
    if (hSessions[k] < now) delete hSessions[k];
  });
}

function hToken(req) {
  const m = /(?:^|;\s*)hikarii_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}

function hCookie(req, token, age) {
  const secure = !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `hikarii_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}

// Admin Guard Middleware
app.use('/api/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.headers['x-hikarii-admin'] !== '1') {
    return res.status(403).json({ ok: false, error: 'Yêu cầu quản trị không hợp lệ.' });
  }
  if (req.path === '/login' && req.method === 'POST') return next();
  hPruneSessions();
  if (!hSessions[hToken(req)]) {
    return res.status(401).json({ ok: false, error: 'Hãy đăng nhập trang quản trị.' });
  }
  next();
});

// Admin Auth Routes
app.post('/api/admin/login', async (req, res) => {
  if (Date.now() - hLoginWindow > 60000) {
    hLoginWindow = Date.now();
    hLoginCount = 0;
  }
  if (hLoginBusy || ++hLoginCount > 8) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ ok: false, error: 'Đã thử quá nhiều lần. Chờ 1 phút rồi thử lại.' });
  }
  if (typeof req.body.password !== 'string' || req.body.password.length > 256) {
    return res.status(400).json({ ok: false, error: 'Mật khẩu không hợp lệ.' });
  }

  hLoginBusy = true;
  let derived;
  try {
    derived = await util.promisify(crypto.pbkdf2)(req.body.password, hAuth.salt, hAuth.iterations, 32, 'sha256');
  } finally {
    hLoginBusy = false;
  }

  if (!crypto.timingSafeEqual(derived, Buffer.from(hAuth.hash, 'hex'))) {
    return res.status(401).json({ ok: false, error: 'Mật khẩu chưa đúng.' });
  }

  hPruneSessions();
  const sessionKeys = Object.keys(hSessions);
  if (sessionKeys.length >= 10) delete hSessions[sessionKeys[0]];

  const token = crypto.randomBytes(32).toString('hex');
  hSessions[token] = Date.now() + 4 * 3600 * 1000;
  res.setHeader('Set-Cookie', hCookie(req, token, 4 * 3600));
  hEvent('admin', 'Đăng nhập quản trị thành công.');
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  delete hSessions[hToken(req)];
  res.setHeader('Set-Cookie', hCookie(req, '', 0));
  res.json({ ok: true });
});

// Admin System Metrics & Monitoring
let hCpuPrevious = null;
let hProcessPrevious = null;
let hSamplePrevious = null;
const hMetrics = { cpuPercent: null, processCpuPercent: null, cpuCount: null, memory: null, eventLoopDelayMs: null };

function hCpuSnapshot() {
  try {
    const cpus = os.cpus();
    if (!cpus || !cpus.length) return null;
    let total = 0;
    let idle = 0;
    cpus.forEach((c) => {
      Object.keys(c.times).forEach((k) => {
        total += c.times[k];
      });
      idle += c.times.idle;
    });
    return { total, idle, count: cpus.length };
  } catch {
    return null;
  }
}

function hSample() {
  const now = process.hrtime();
  const cpu = hCpuSnapshot();
  const p = typeof process.cpuUsage === 'function' ? process.cpuUsage() : null;

  if (cpu && hCpuPrevious && cpu.total > hCpuPrevious.total) {
    hMetrics.cpuPercent = Math.max(0, Math.min(100, 100 * (1 - (cpu.idle - hCpuPrevious.idle) / (cpu.total - hCpuPrevious.total))));
  } else {
    hMetrics.cpuPercent = null;
  }
  hMetrics.cpuCount = cpu ? cpu.count : null;

  if (hSamplePrevious) {
    const seconds = now[0] - hSamplePrevious[0] + (now[1] - hSamplePrevious[1]) / 1e9;
    hMetrics.eventLoopDelayMs = Math.max(0, seconds * 1000 - 3000);
    if (p && hProcessPrevious && seconds > 0) {
      hMetrics.processCpuPercent = Math.max(0, ((p.user - hProcessPrevious.user) + (p.system - hProcessPrevious.system)) / 10000 / seconds);
    }
  }

  hCpuPrevious = cpu;
  hProcessPrevious = p;
  hSamplePrevious = now;

  try {
    const total = os.totalmem();
    const available = os.freemem();
    hMetrics.memory = { total, available, used: Math.max(0, total - available), source: 'free' };
  } catch {
    hMetrics.memory = null;
  }
}

hSample();
setInterval(hSample, 3000).unref();

const hPresence = Object.create(null);
const hHistory = [];
let hGeminiCheck = null;
let hConfigQueue = Promise.resolve();

function hOnline() {
  const now = Date.now();
  Object.keys(hPresence).forEach((k) => {
    if (now - hPresence[k] > 90000) delete hPresence[k];
  });
  return Object.keys(hPresence).length;
}

app.post('/api/presence', (req, res) => {
  const id = req.body.id;
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return res.status(400).json({ ok: false });
  hOnline();
  if (!hPresence[id] && Object.keys(hPresence).length >= 2000) return res.status(429).json({ ok: false });
  hPresence[id] = Date.now();
  res.json({ ok: true });
});

setInterval(() => {
  hOnline();
  hHistory.push({
    time: Date.now(),
    cpu: hMetrics.cpuPercent,
    rss: process.memoryUsage().rss,
    ram: hMetrics.memory ? (100 * hMetrics.memory.used) / hMetrics.memory.total : null
  });
  if (hHistory.length > 180) hHistory.shift();
}, 10000).unref();

function hConfigPublic(c) {
  return {
    model: c.selectedModel || 'gemini-flash-lite-latest',
    hasKey: !!(process.env.GEMINI_API_KEY || c.apiKey),
    keySource: process.env.GEMINI_API_KEY ? 'environment' : c.apiKey ? 'file' : 'none',
    check: hGeminiCheck
  };
}

// Effective API key & model helpers
async function getEffectiveApiKey(providedKey) {
  if (typeof providedKey === 'string' && providedKey.trim()) {
    return providedKey.trim();
  }
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  return process.env.GEMINI_API_KEY || config.apiKey || '';
}

async function getEffectiveModel(providedModel) {
  if (typeof providedModel === 'string' && providedModel.trim()) {
    return providedModel.trim();
  }
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  return config.selectedModel || 'gemini-flash-lite-latest';
}

// Call Gemini API with automatic fallback
async function callGeminiApi({ apiKey, model, prompt, responseFormatJson = false }) {
  if (!apiKey) {
    throw new Error('Chưa cung cấp Gemini API Key. Hãy nhập Key tại mục Cài đặt.');
  }

  let activeModel = model || 'gemini-flash-lite-latest';

  const tryCall = async (targetModel) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const bodyPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    };
    if (responseFormatJson) {
      bodyPayload.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      const err = new Error(message);
      err.status = response.status;
      err.details = errorData;
      throw err;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = result.usageMetadata || {};
    return { text, usage, usedModel: targetModel };
  };

  try {
    return await tryCall(activeModel);
  } catch (err) {
    if (activeModel !== 'gemini-flash-lite-latest' && (err.status === 404 || err.status === 503 || err.status === 400)) {
      console.warn(`Model ${activeModel} failed with status ${err.status}. Auto-retrying with gemini-flash-lite-latest...`);
      return await tryCall('gemini-flash-lite-latest');
    }
    throw err;
  }
}

// Admin APIs
app.get('/api/admin/config', async (req, res) => {
  res.json(hConfigPublic(await readJsonFile(path.join(DATA_DIR, 'config.json'), {})));
});

app.post('/api/admin/config', async (req, res) => {
  const { model, apiKey, removeKey } = req.body;
  if (
    typeof model !== 'string' ||
    !/^[-a-zA-Z0-9_.]{1,100}$/.test(model) ||
    (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 256))
  ) {
    return res.status(400).json({ error: 'Model hoặc API key không hợp lệ.' });
  }
  if (process.env.GEMINI_API_KEY && (removeKey || apiKey)) {
    return res.status(409).json({ error: 'Server đang ưu tiên GEMINI_API_KEY trong biến môi trường.' });
  }

  const job = hConfigQueue.catch(() => {}).then(async () => {
    const p = path.join(DATA_DIR, 'config.json');
    const c = await readJsonFile(p, {});
    c.selectedModel = model;
    if (removeKey === true) delete c.apiKey;
    else if (apiKey && apiKey.trim()) c.apiKey = apiKey.trim();
    await writeJsonFile(p, c);
    hGeminiCheck = null;
    return c;
  });
  hConfigQueue = job;

  const c = await job;
  hEvent('admin', 'Đã lưu cấu hình Gemini.');
  res.json({ ok: true, config: hConfigPublic(c) });
});

let hTestBusy = false;
app.post('/api/admin/gemini-test', async (req, res) => {
  if (hTestBusy) return res.status(429).json({ error: 'Đang kiểm tra kết nối.' });
  hTestBusy = true;
  const start = Date.now();
  try {
    const key = await getEffectiveApiKey();
    const model = await getEffectiveModel();
    const result = await callGeminiApi({ apiKey: key, model, prompt: 'Reply with the single word OK.' });
    hGeminiCheck = { ok: true, time: new Date().toISOString(), latencyMs: Date.now() - start, model: result.usedModel };
    res.json(hGeminiCheck);
  } catch (err) {
    hGeminiCheck = { ok: false, time: new Date().toISOString(), latencyMs: Date.now() - start, error: err.message };
    hEvent('error', 'Kiểm tra Gemini thất bại: ' + err.message);
    res.status(502).json(hGeminiCheck);
  } finally {
    hTestBusy = false;
  }
});

app.post('/api/admin/models', async (req, res) => {
  const key = await getEffectiveApiKey();
  if (!key) return res.status(400).json({ error: 'Chưa cấu hình API key máy chủ.' });
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return res.status(502).json({ error: 'Không lấy được danh sách model.' });
    const d = await r.json();
    res.json({
      models: (d.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && !/tts|image/i.test(m.name))
        .map((m) => m.name.replace(/^models\//, ''))
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

async function hFolderSize(root) {
  let bytes = 0;
  let files = 0;
  async function scan(dir) {
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await scan(full);
        else if (entry.isFile()) {
          const s = await fsPromises.stat(full);
          bytes += s.size;
          files++;
        }
      }
    } catch {
      /* ignore access errors */
    }
  }
  await scan(root);
  return { bytes, files, partial: false };
}

app.get('/api/admin/overview', async (req, res) => {
  const c = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  const folders = {
    data: await hFolderSize(DATA_DIR),
    public: await hFolderSize(PUBLIC_DIR),
    logs: await hFolderSize(LOGS_DIR)
  };
  res.json({
    online: hOnline(),
    history: hHistory,
    gemini: hConfigPublic(c),
    storage: { disk: null, folders, checkedAt: new Date().toISOString() }
  });
});

app.post('/api/admin/clean-old-logs', async (req, res) => {
  if (req.body.confirm !== 'old-logs') return res.status(400).json({ error: 'Chưa xác nhận dọn nhật ký cũ.' });
  let removed = 0;
  for (const name of ['server.log.1', 'tunnel.log.1']) {
    try {
      await fsPromises.unlink(path.join(LOGS_DIR, name));
      removed++;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  hEvent('admin', `Đã xóa ${removed} file nhật ký cũ.`);
  res.json({ ok: true, removed });
});

app.get('/api/admin/logs', (req, res) => {
  res.json({ events: hEvents, logStorage: hLogState });
});

app.get('/api/admin/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get('/api/admin/stats', (req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    maintenance: hMaintenance,
    restartEnabled: false,
    metrics: hMetrics,
    processMemory: process.memoryUsage(),
    requests: {
      admin: hAdminRequests,
      presence: hPresenceRequests,
      total: hRequests,
      errors: hErrors,
      active: Math.max(0, hActive - 1)
    },
    lessons: hLessonStatus,
    paths: { data: DATA_DIR, public: PUBLIC_DIR },
    events: hEvents,
    logStorage: hLogState
  });
});

app.post('/api/admin/recheck', async (req, res) => {
  await hCheckLessons();
  hEvent('admin', 'Đã kiểm tra lại các file bài học.');
  res.json({ ok: true, lessons: hLessonStatus });
});

app.post('/api/admin/maintenance', (req, res) => {
  if (typeof req.body.enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'enabled phải là true hoặc false.' });
  }
  hMaintenance = req.body.enabled;
  hEvent('admin', hMaintenance ? 'Đã bật bảo trì.' : 'Đã mở lại API học tập.');
  res.json({ ok: true, maintenance: hMaintenance });
});

app.post('/api/admin/restart', (req, res) => {
  res.status(403).json({ ok: false, error: 'Khởi động lại từ web không khả dụng trên môi trường hiện tại.' });
});

// Admin and Maintenance Web Views
app.get('/admin', (req, res) => {
  res.type('html').send(H_ADMIN_HTML);
});

app.get('/maintenance', (req, res) => {
  res.type('html').send(H_MAINTENANCE_HTML);
});

// Install History Exam & Content Subsystem
const historyModule = require('./lib/history.cjs');
historyModule.install(app, {
  data: DATA_DIR,
  ai: async (args) => {
    return callGeminiApi({
      apiKey: await getEffectiveApiKey(),
      model: await getEffectiveModel(),
      prompt: args.prompt
    });
  }
});

// History web page routes
app.get('/lich-su', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'history', 'index.html'));
});

app.get('/lich-su-quan-tri', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'history', 'admin.html'));
});

// Static Assets
app.use(express.static(PUBLIC_DIR, { maxAge: 0 }));

// Core Learning APIs
app.get('/api/health', (req, res) => {
  const good =
    Object.keys(hLessonStatus).length === 3 &&
    Object.keys(hLessonStatus).every((t) => hLessonStatus[t].ok && hLessonStatus[t].count > 0);
  res.status(good ? 200 : 503).json({
    status: good ? 'ok' : 'degraded',
    maintenance: hMaintenance,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', async (req, res) => {
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  res.json({
    selectedModel: config.selectedModel || 'gemini-flash-lite-latest',
    hasServerKey: Boolean(process.env.GEMINI_API_KEY || config.apiKey)
  });
});

app.post('/api/config', (req, res) =>
  res.status(405).json({ ok: false, error: 'Cấu hình máy chủ chỉ được chỉnh trực tiếp trên máy chủ hoặc qua /admin.' })
);

app.get('/api/lessons/:type', async (req, res) => {
  const { type } = req.params;
  const validTypes = ['writing', 'sentence', 'conversation'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid lesson type' });
  }
  const lessons = await hReadLessons(type);
  res.json(lessons);
});

app.get('/api/vocabulary', async (req, res) => {
  const words = await readJsonFile(path.join(DATA_DIR, 'user_vocabulary.json'), []);
  res.json(words);
});

app.post('/api/vocabulary', async (req, res) => {
  const newWord = req.body;
  if (!newWord || !newWord.word) {
    return res.status(400).json({ error: 'Word is required' });
  }
  const filePath = path.join(DATA_DIR, 'user_vocabulary.json');
  let words = await readJsonFile(filePath, []);

  const cleanWord = newWord.word.trim().toLowerCase();
  const existingIdx = words.findIndex((w) => w.word.toLowerCase() === cleanWord);

  const entry = {
    id: existingIdx >= 0 ? words[existingIdx].id : 'v_' + Date.now(),
    word: cleanWord,
    ipa: newWord.ipa || '',
    meaning: newWord.meaning || '',
    type: newWord.type || '',
    example: newWord.example || '',
    status: newWord.status || 'new_word',
    reviewCount: existingIdx >= 0 ? (words[existingIdx].reviewCount || 0) + 1 : 1,
    lastReviewed: new Date().toISOString().split('T')[0]
  };

  if (existingIdx >= 0) {
    words[existingIdx] = { ...words[existingIdx], ...entry };
  } else {
    words.unshift(entry);
  }

  await writeJsonFile(filePath, words);
  res.json({ ok: true, word: entry, count: words.length });
});

app.delete('/api/vocabulary/:word', async (req, res) => {
  const wordToDelete = req.params.word.trim().toLowerCase();
  const filePath = path.join(DATA_DIR, 'user_vocabulary.json');
  let words = await readJsonFile(filePath, []);
  words = words.filter((w) => w.word.toLowerCase() !== wordToDelete);
  await writeJsonFile(filePath, words);
  res.json({ ok: true, count: words.length });
});

// Dictionary Lookup
app.get('/api/dictionary/lookup', async (req, res) => {
  const word = (req.query.word || '').trim().toLowerCase();
  if (!word) {
    return res.status(400).json({ error: 'Word required' });
  }

  try {
    const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (dictRes.ok) {
      const data = await dictRes.json();
      const first = data[0];
      const phonetics = first.phonetics?.find((p) => p.text) || {};
      const ipa = phonetics.text || (first.phonetic || '');
      const meanings = first.meanings || [];
      const firstMeaning = meanings[0] || {};
      const type = firstMeaning.partOfSpeech || 'noun';
      const definition = firstMeaning.definitions?.[0]?.definition || '';
      const example = firstMeaning.definitions?.[0]?.example || '';

      return res.json({
        word: first.word,
        ipa: ipa,
        type: type,
        definition: definition,
        example: example,
        audioUrl: `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
      });
    }
  } catch (err) {
    console.error('Dictionary API error:', err.message);
  }

  res.json({
    word: word,
    ipa: '',
    type: 'word',
    definition: 'Tra cứu định nghĩa từ vựng',
    example: '',
    audioUrl: `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
  });
});

// Scan Models from Gemini
app.post('/api/gemini/scan-models', async (req, res) => {
  const apiKey = await getEffectiveApiKey(req.body.apiKey);
  if (!apiKey) {
    return res.status(400).json({ ok: false, error: 'Vui lòng cung cấp Gemini API Key để quét danh sách model.' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      return res.status(response.status).json({ ok: false, error: msg });
    }

    const data = await response.json();
    const rawModels = data.models || [];

    const availableModels = rawModels
      .filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        const name = m.name.toLowerCase();
        return (
          methods.includes('generateContent') &&
          name.includes('gemini') &&
          !name.includes('image') &&
          !name.includes('tts') &&
          !name.includes('transcribe') &&
          !name.includes('computer-use') &&
          !name.includes('banana') &&
          !name.includes('robotics')
        );
      })
      .map((m) => {
        const cleanId = m.name.replace(/^models\//, '');
        let cleanDisplayName = m.displayName || cleanId;
        if (cleanId === 'gemini-flash-lite-latest') cleanDisplayName = 'Gemini Flash-Lite Latest (Siêu Tốc & Ổn Định)';
        else if (cleanId === 'gemini-3.5-flash-lite') cleanDisplayName = 'Gemini 3.5 Flash-Lite (Thế Hệ 3.5)';
        else if (cleanId === 'gemini-flash-latest') cleanDisplayName = 'Gemini Flash Latest';
        else if (cleanId === 'gemini-3.8-flash') cleanDisplayName = 'Gemini 3.8 Flash';
        else if (cleanId === 'gemini-pro-latest') cleanDisplayName = 'Gemini Pro Latest (Suy Luận Cao)';

        return {
          id: cleanId,
          displayName: cleanDisplayName,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit || 0,
          outputTokenLimit: m.outputTokenLimit || 0
        };
      });

    availableModels.sort((a, b) => {
      const getPriority = (id) => {
        if (id === 'gemini-flash-lite-latest') return 30;
        if (id === 'gemini-3.5-flash-lite') return 29;
        if (id === 'gemini-flash-latest') return 28;
        if (id === 'gemini-3.8-flash') return 27;
        if (id === 'gemini-3.5-flash') return 26;
        if (id === 'gemini-pro-latest') return 25;
        if (id.includes('flash-lite')) return 20;
        if (id.includes('flash')) return 15;
        if (id.includes('pro')) return 10;
        return 1;
      };
      return getPriority(b.id) - getPriority(a.id);
    });

    res.json({
      ok: true,
      count: availableModels.length,
      models: availableModels
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Test Gemini Model
app.post('/api/gemini/test', async (req, res) => {
  const effectiveApiKey = await getEffectiveApiKey(req.body.apiKey);
  const effectiveModel = await getEffectiveModel(req.body.model);

  const startTime = Date.now();
  try {
    const prompt = 'Xin chào! Hãy phản hồi một câu ngắn chào mừng người học tiếng Anh bằng tiếng Việt, kèm một lời chúc học tập tràn đầy năng lượng.';
    const result = await callGeminiApi({
      apiKey: effectiveApiKey,
      model: effectiveModel,
      prompt
    });
    const latencyMs = Date.now() - startTime;

    res.json({
      ok: true,
      latencyMs,
      model: result.usedModel,
      reply: result.text.trim(),
      usage: result.usage
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    res.status(err.status || 500).json({
      ok: false,
      latencyMs,
      model: effectiveModel,
      error: err.message,
      details: err.details || null
    });
  }
});

// Evaluate Writing Translation
app.post('/api/gemini/evaluate', async (req, res) => {
  const { vietnamese, englishUser, referenceEn, model, apiKey, learnerName } = req.body;
  const effectiveApiKey = await getEffectiveApiKey(apiKey);
  const effectiveModel = await getEffectiveModel(model);

  if (
    typeof englishUser !== 'string' ||
    typeof vietnamese !== 'string' ||
    !englishUser.trim() ||
    englishUser.length > 2000 ||
    vietnamese.length > 4000 ||
    (referenceEn != null && typeof referenceEn !== 'string')
  ) {
    return res.status(400).json({ error: 'Missing input fields' });
  }

  if (effectiveApiKey) {
    try {
      const evaluationPrompt = `
Bạn là chuyên gia giảng dạy tiếng Anh bản ngữ chuyên nghiệp, chấm bài dịch song ngữ Việt - Anh.
Nhiệm vụ của bạn là đánh giá bản dịch tiếng Anh của người học dựa trên câu gốc tiếng Việt và câu tham khảo chuẩn.

${learnerPrompt(learnerName, 'evaluate')}

Câu gốc tiếng Việt: "${vietnamese}"
Câu chuẩn tham khảo: "${referenceEn || ''}"
Bản dịch của người học: "${englishUser}"

Hãy chấm điểm và nhận xét khách quan, chính xác theo cấu trúc JSON:
{
  "score": number (0 đến 100, dựa trên độ chính xác ngữ pháp, từ vựng và tự nhiên),
  "isGood": boolean (true nếu score >= 80),
  "idealCorrection": "Bản dịch tiếng Anh tự nhiên và chuẩn xác nhất",
  "feedback": [
    "Nhận xét chi tiết bằng tiếng Việt về lỗi sai ngữ pháp, thì của động từ, giới từ hoặc từ vựng (nếu có)",
    "Lời khuyên cải thiện cách dùng từ tự nhiên hơn"
  ],
  "alternatives": {
    "formal": "Cách diễn đạt trang trọng / lịch sự",
    "casual": "Cách diễn đạt thân mật / giao tiếp đời thường",
    "idiomatic": "Cách diễn đạt tự nhiên chuẩn người bản xứ"
  }
}
Chỉ trả về định dạng JSON hợp lệ, không bọc trong markdown codeblock.
`;

      const result = await callGeminiApi({
        apiKey: effectiveApiKey,
        model: effectiveModel,
        prompt: evaluationPrompt,
        responseFormatJson: true
      });

      let evaluationData;
      try {
        evaluationData = JSON.parse(result.text);
      } catch {
        const cleaned = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        evaluationData = JSON.parse(cleaned);
      }

      return res.json({
        ok: true,
        source: 'gemini',
        model: result.usedModel,
        ...evaluationData
      });
    } catch (geminiErr) {
      console.warn('Gemini evaluation error, falling back to local heuristic:', geminiErr.message);
    }
  }

  // Fallback: Local rule-based heuristic
  const normalize = (t) => t.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  const userWords = normalize(englishUser);
  const refWords = normalize(referenceEn || '');

  const row = new Array(refWords.length + 1).fill(0);
  for (const word of userWords) {
    let previous = 0;
    for (let j = 1; j <= refWords.length; j++) {
      const old = row[j];
      row[j] = word === refWords[j - 1] ? previous + 1 : Math.max(row[j], row[j - 1]);
      previous = old;
    }
  }
  const matched = row[refWords.length];
  const precision = userWords.length > 0 ? matched / userWords.length : 0;
  const recall = refWords.length > 0 ? matched / refWords.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const score = Math.round(f1 * 100);

  res.json({
    ok: true,
    source: 'local_heuristic',
    score: score,
    isGood: score >= 75,
    idealCorrection: referenceEn || englishUser,
    feedback: [
      score >= 85
        ? 'Bản dịch rất tốt và bám sát câu mẫu!'
        : score >= 60
        ? 'Bản dịch tương đối ổn, hãy kiểm tra lại cấu trúc câu và từ vựng theo bản mẫu.'
        : 'Bản dịch còn khác biệt nhiều so với câu mẫu. Hãy xem lại gợi ý ngữ pháp và đối chiếu với câu chuẩn.'
    ],
    alternatives: {
      formal: referenceEn || '',
      casual: referenceEn || '',
      idiomatic: referenceEn || ''
    }
  });
});

// Generate Custom Lesson
app.post('/api/gemini/generate-lesson', async (req, res) => {
  const { topic, level = 'intermediate', count = 5, apiKey, model, learnerName } = req.body;
  const effectiveApiKey = await getEffectiveApiKey(apiKey);
  const effectiveModel = await getEffectiveModel(model);

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ error: 'Chủ đề (topic) không được để trống' });
  }

  const prompt = `
Bạn là giáo viên biên soạn giáo trình tiếng Anh. Hãy tạo một bài tập luyện viết dịch câu song ngữ theo chủ đề: "${topic}".
${learnerPrompt(learnerName, 'generate')}
Cấp độ: ${level} (Beginner / Intermediate / Advanced).
Số lượng câu: ${count} câu nối tiếp nhau tạo thành một đoạn văn hoặc bài viết hoàn chỉnh.

Trả về duy nhất JSON hợp lệ theo định dạng:
{
  "title": "Tiêu đề bài viết ngắn gọn tiếng Anh",
  "description": "Mô tả bài tập ngắn gọn bằng tiếng Anh",
  "level": "${level.toLowerCase()}",
  "category": "ai-generated",
  "sentences": [
    {
      "id": 1,
      "vi": "Câu tiếng Việt tự nhiên",
      "en": "Câu dịch tiếng Anh chuẩn xác, tự nhiên",
      "hints": ["cụm từ gợi ý 1", "cụm từ gợi ý 2"]
    }
  ]
}
Chỉ trả về JSON thuần túy, không có text dẫn nhập.
`;

  try {
    const result = await callGeminiApi({
      apiKey: effectiveApiKey,
      model: effectiveModel,
      prompt,
      responseFormatJson: true
    });

    let lessonData;
    try {
      lessonData = JSON.parse(result.text);
    } catch {
      const cleaned = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      lessonData = JSON.parse(cleaned);
    }

    lessonData.id = 'ai-custom-' + Date.now();
    res.json({ ok: true, lesson: lessonData });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 404 for unknown API calls
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'API không tồn tại.' });
});

// Global error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let code = Number(err.status);
  if (!(code >= 400 && code <= 599)) code = 500;
  hEvent('error', `HTTP ${code} ${req.method} ${req.route ? req.route.path : req.path}`);
  res.status(code).json({
    ok: false,
    error:
      code === 503
        ? err.message
        : code === 400
        ? 'Dữ liệu gửi lên không hợp lệ.'
        : code === 413
        ? 'Dữ liệu gửi lên quá lớn.'
        : 'Máy chủ gặp lỗi. Xem nhật ký trong /admin.'
  });
});

// Start Server
async function startServer() {
  await hCheckLessons();
  Object.keys(hLessonStatus).forEach((type) => {
    const s = hLessonStatus[type];
    hEvent(s.ok ? 'data' : 'error', `${s.file}: ${s.ok ? s.count + ' bài' : s.error}`);
  });

  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT không hợp lệ.');
  }

  const server = app.listen(port, process.env.HOST || '0.0.0.0', () => {
    hEvent('start', `hikarii ${VERSION} · Node ${process.version} · cổng ${port}`);
    console.log(`=======================================================`);
    console.log(`  HIKARII - ENGLISH & HISTORY LEARNING PLATFORM`);
    console.log(`  Version: ${VERSION}`);
    console.log(`  Trang học tiếng Anh : http://localhost:${port}`);
    console.log(`  Luyện thi Lịch sử   : http://localhost:${port}/lich-su`);
    console.log(`  Thời khóa biểu      : http://localhost:${port}/#timetable`);
    console.log(`  Quản trị hệ thống   : http://localhost:${port}/admin`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    console.error('Không khởi động được server: ' + err.code);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Khởi động thất bại: ' + err.message);
  process.exit(1);
});
