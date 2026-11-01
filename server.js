import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');

// Helper to read/write JSON files safely
async function readJsonFile(filePath, defaultValue = {}) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return defaultValue;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 1. Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Config management
app.get('/api/config', async (req, res) => {
  const exampleConfig = await readJsonFile(path.join(DATA_DIR, 'config.json.example'), {});
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {
    apiKey: process.env.GEMINI_API_KEY || '',
    selectedModel: 'gemini-flash-lite-latest',
    dailyGoal: 10,
    stats: { totalXp: 120, completedExercises: 5, streakDays: 3 }
  });
  if (!config.apiKey && process.env.GEMINI_API_KEY) {
    config.apiKey = process.env.GEMINI_API_KEY;
  }
  res.json(config);
});

app.post('/api/config', async (req, res) => {
  const current = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  const updated = { ...current, ...req.body };
  await writeJsonFile(path.join(DATA_DIR, 'config.json'), updated);
  res.json({ ok: true, config: updated });
});

// 3. Lessons API
app.get('/api/lessons/:type', async (req, res) => {
  const { type } = req.params;
  const validTypes = ['writing', 'sentence', 'conversation'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid lesson type' });
  }
  const filePath = path.join(DATA_DIR, `lessons_${type}.json`);
  const lessons = await readJsonFile(filePath, []);
  res.json(lessons);
});

// 4. Vocabulary API
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
  const existingIdx = words.findIndex(w => w.word.toLowerCase() === cleanWord);

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
  words = words.filter(w => w.word.toLowerCase() !== wordToDelete);
  await writeJsonFile(filePath, words);
  res.json({ ok: true, count: words.length });
});

// 5. Dictionary Lookup (Free Dictionary API + Fallback)
app.get('/api/dictionary/lookup', async (req, res) => {
  const word = (req.query.word || '').trim().toLowerCase();
  if (!word) {
    return res.status(400).json({ error: 'Word required' });
  }

  try {
    const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (dictRes.ok) {
      const data = await dictRes.json();
      const first = data[0];
      const phonetics = first.phonetics?.find(p => p.text) || {};
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

  // Fallback response with Google TTS
  res.json({
    word: word,
    ipa: '',
    type: 'word',
    definition: 'Tra cứu định nghĩa từ vựng',
    example: '',
    audioUrl: `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
  });
});

// Helper to get effective API Key and Model (from request, config.json, or environment)
async function getEffectiveApiKey(providedKey) {
  if (providedKey && providedKey.trim()) {
    return providedKey.trim();
  }
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  return config.apiKey || process.env.GEMINI_API_KEY || '';
}

async function getEffectiveModel(providedModel) {
  if (providedModel && providedModel.trim()) {
    const m = providedModel.trim();
    // Auto-migrate away from deprecated model names
    if (m.includes('2.5') || m.includes('2.0') || m.includes('1.5')) {
      return 'gemini-flash-lite-latest';
    }
    return m;
  }
  const config = await readJsonFile(path.join(DATA_DIR, 'config.json'), {});
  return config.selectedModel || 'gemini-flash-lite-latest';
}

// 5.5 Scan Models from Google Gemini API
app.post('/api/gemini/scan-models', async (req, res) => {
  const apiKey = await getEffectiveApiKey(req.body.apiKey);
  if (!apiKey) {
    return res.status(400).json({ ok: false, error: 'Vui lòng cung cấp Gemini API Key để quét danh sách model.' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      return res.status(response.status).json({ ok: false, error: msg });
    }

    const data = await response.json();
    const rawModels = data.models || [];

    // Filter only active text/chat generateContent models, exclude deprecated & non-text models
    const availableModels = rawModels
      .filter(m => {
        const methods = m.supportedGenerationMethods || [];
        const name = m.name.toLowerCase();
        return methods.includes('generateContent') && 
               name.includes('gemini') && 
               !name.includes('image') && 
               !name.includes('tts') && 
               !name.includes('transcribe') && 
               !name.includes('computer-use') && 
               !name.includes('banana') && 
               !name.includes('robotics') && 
               !name.includes('2.5-flash') && 
               !name.includes('2.5-pro') && 
               !name.includes('1.5-flash') && 
               !name.includes('1.5-pro') && 
               !name.includes('2.0-flash');
      })
      .map(m => {
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

    // Sort to place recommended active models on top
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

// Helper for Gemini REST call with intelligent auto-fallback
async function callGeminiApi({ apiKey, model, prompt, responseFormatJson = false }) {
  if (!apiKey) {
    throw new Error('Chưa cung cấp Gemini API Key. Hãy nhập Key tại mục Cài đặt.');
  }

  let activeModel = model;
  if (!activeModel || activeModel.includes('2.5') || activeModel.includes('2.0') || activeModel.includes('1.5')) {
    activeModel = 'gemini-flash-lite-latest';
  }

  const tryCall = async (targetModel) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    const bodyPayload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
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
      body: JSON.stringify(bodyPayload)
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
    // If original model encounters 404 (deprecated), 503 (high demand), or 400, retry once with gemini-flash-lite-latest
    if (activeModel !== 'gemini-flash-lite-latest' && (err.status === 404 || err.status === 503 || err.status === 400)) {
      console.warn(`Model ${activeModel} failed with status ${err.status}. Auto-retrying with gemini-flash-lite-latest...`);
      return await tryCall('gemini-flash-lite-latest');
    }
    throw err;
  }
}

// 6. Test Gemini Model Endpoint
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
      model: effectiveModel,
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

// 7. Evaluate Writing Translation with Gemini (or Fallback Local Engine)
app.post('/api/gemini/evaluate', async (req, res) => {
  const { vietnamese, englishUser, referenceEn, model, apiKey } = req.body;
  const effectiveApiKey = await getEffectiveApiKey(apiKey);
  const effectiveModel = await getEffectiveModel(model);

  if (!englishUser || !vietnamese) {
    return res.status(400).json({ error: 'Missing input fields' });
  }

  // If effective Gemini API Key is available, evaluate with Gemini
  if (effectiveApiKey) {
    try {
      const evaluationPrompt = `
Bạn là chuyên gia giảng dạy tiếng Anh bản ngữ chuyên nghiệp, chấm bài dịch song ngữ Việt - Anh.
Nhiệm vụ của bạn là đánh giá bản dịch tiếng Anh của người học dựa trên câu gốc tiếng Việt và câu tham khảo chuẩn.

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
      } catch (parseErr) {
        const cleaned = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        evaluationData = JSON.parse(cleaned);
      }

      return res.json({
        ok: true,
        source: 'gemini',
        model: effectiveModel,
        ...evaluationData
      });
    } catch (geminiErr) {
      console.warn('Gemini evaluation error, falling back to local heuristic:', geminiErr.message);
    }
  }

  // Fallback: Local rule-based intelligent similarity check
  const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
  const userWords = normalize(englishUser);
  const refWords = normalize(referenceEn || '');

  let matched = 0;
  userWords.forEach(w => {
    if (refWords.includes(w)) matched++;
  });

  const precision = userWords.length > 0 ? (matched / userWords.length) : 0;
  const recall = refWords.length > 0 ? (matched / refWords.length) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const score = Math.round(f1 * 100);

  res.json({
    ok: true,
    source: 'local_heuristic',
    score: score,
    isGood: score >= 75,
    idealCorrection: referenceEn || englishUser,
    feedback: [
      score >= 85 ? "Bản dịch rất tốt và bám sát câu mẫu!" :
      score >= 60 ? "Bản dịch tương đối ổn, hãy kiểm tra lại cấu trúc câu và từ vựng theo bản mẫu." :
      "Bản dịch còn khác biệt nhiều so với câu mẫu. Hãy xem lại gợi ý ngữ pháp và đối chiếu với câu chuẩn."
    ],
    alternatives: {
      formal: referenceEn || '',
      casual: referenceEn || '',
      idiomatic: referenceEn || ''
    }
  });
});

// 8. Generate Custom Lesson using Gemini
app.post('/api/gemini/generate-lesson', async (req, res) => {
  const { topic, level = 'intermediate', count = 5, apiKey, model } = req.body;
  const effectiveApiKey = await getEffectiveApiKey(apiKey);
  const effectiveModel = await getEffectiveModel(model);

  if (!topic) {
    return res.status(400).json({ error: 'Chủ đề (topic) không được để trống' });
  }

  const prompt = `
Bạn là giáo viên biên soạn giáo trình tiếng Anh. Hãy tạo một bài tập luyện viết dịch câu song ngữ theo chủ đề: "${topic}".
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

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ENGLISH MASTER (Personal Edition)`);
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
