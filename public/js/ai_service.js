// AI Service & Gemini Connection / Evaluation / Benchmark Module

export class AiService {
  constructor() {
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
    let storedModel = localStorage.getItem('gemini_selected_model');
    this.selectedModel = storedModel || 'gemini-flash-lite-latest';
  }

  async loadConfig() {
    try {
      const res = await fetch('/api/config', {signal: AbortSignal.timeout(10000)});
      if (res.ok) {
        const config = await res.json();
        this.hasServerKey = Boolean(config.hasServerKey);
        if (config.selectedModel && !localStorage.getItem('gemini_selected_model')) this.selectedModel = config.selectedModel;
      }
    } catch {}
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem('gemini_api_key', this.apiKey);
  }

  getApiKey() {
    return this.apiKey;
  }

  setModel(model) {
    this.selectedModel = model || 'gemini-flash-lite-latest';
    localStorage.setItem('gemini_selected_model', this.selectedModel);
  }

  getModel() {
    return this.selectedModel;
  }

  // Scan available models for the given API key
  async scanAvailableModels() {
    if (!this.apiKey && !this.hasServerKey) {
      throw new Error('Vui lòng nhập API Key trước khi quét danh sách model.');
    }
    const res = await fetch('/api/gemini/scan-models', {
      method: 'POST',
      signal: AbortSignal.timeout(65000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey })
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Không thể quét danh sách model');
    }
    // Save scanned models to cache
    localStorage.setItem('gemini_scanned_models', JSON.stringify(data.models));
    return data.models;
  }

  getCachedScannedModels() {
    try {
      const saved = localStorage.getItem('gemini_scanned_models');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  // Test a single model
  async testModel(modelToTest) {
    const model = modelToTest || this.selectedModel;
    const res = await fetch('/api/gemini/test', {
      method: 'POST',
      signal: AbortSignal.timeout(65000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        model: model
      })
    });

    const data = await res.json();
    return data;
  }

  // Benchmark multiple models
  async benchmarkModels(modelList = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']) {
    const results = [];
    for (const m of modelList) {
      try {
        const testRes = await this.testModel(m);
        results.push({
          model: m,
          ok: testRes.ok,
          latencyMs: testRes.latencyMs,
          reply: testRes.reply || '',
          error: testRes.error || null
        });
      } catch (err) {
        results.push({
          model: m,
          ok: false,
          latencyMs: -1,
          error: err.message
        });
      }
    }
    return results;
  }

  // Evaluate translation
  async evaluateTranslation({ vietnamese, englishUser, referenceEn, learnerName = '' }) {
    const res = await fetch('/api/gemini/evaluate', {
      method: 'POST',
      signal: AbortSignal.timeout(65000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vietnamese,
        englishUser,
        referenceEn,
        learnerName,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    const data = await res.json();
    return data;
  }

  // Generate custom lesson
  async generateLesson({ topic, level = 'intermediate', count = 5, learnerName = '' }) {
    const res = await fetch('/api/gemini/generate-lesson', {
      method: 'POST',
      signal: AbortSignal.timeout(65000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        level,
        count,
        learnerName,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    const data = await res.json();
    return data;
  }
}
