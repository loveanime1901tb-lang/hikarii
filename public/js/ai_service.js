// AI Service & Gemini Connection / Evaluation / Benchmark Module

export class AiService {
  constructor() {
    this.apiKey = localStorage.getItem('gemini_api_key') || '';
    let storedModel = localStorage.getItem('gemini_selected_model');
    // Sanitize any dead legacy models
    if (!storedModel || storedModel.includes('2.5') || storedModel.includes('2.0') || storedModel.includes('1.5')) {
      storedModel = 'gemini-flash-lite-latest';
      localStorage.setItem('gemini_selected_model', storedModel);
    }
    this.selectedModel = storedModel;
  }

  async loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.apiKey && (!this.apiKey || !localStorage.getItem('gemini_api_key'))) {
          this.setApiKey(config.apiKey);
        }
        if (config.selectedModel) {
          const current = localStorage.getItem('gemini_selected_model');
          if (!current || current.includes('2.5') || current.includes('2.0') || current.includes('1.5')) {
            this.setModel(config.selectedModel);
          }
        }
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
    let cleanModel = model;
    if (cleanModel && (cleanModel.includes('2.5') || cleanModel.includes('2.0') || cleanModel.includes('1.5'))) {
      cleanModel = 'gemini-flash-lite-latest';
    }
    this.selectedModel = cleanModel;
    localStorage.setItem('gemini_selected_model', this.selectedModel);
  }

  getModel() {
    return this.selectedModel;
  }

  // Scan available models for the given API key
  async scanAvailableModels() {
    if (!this.apiKey) {
      throw new Error('Vui lòng nhập API Key trước khi quét danh sách model.');
    }
    const res = await fetch('/api/gemini/scan-models', {
      method: 'POST',
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
  async evaluateTranslation({ vietnamese, englishUser, referenceEn }) {
    const res = await fetch('/api/gemini/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vietnamese,
        englishUser,
        referenceEn,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    const data = await res.json();
    return data;
  }

  // Generate custom lesson
  async generateLesson({ topic, level = 'intermediate', count = 5 }) {
    const res = await fetch('/api/gemini/generate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        level,
        count,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    const data = await res.json();
    return data;
  }
}
