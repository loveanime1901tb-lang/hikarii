// Vocabulary Store & Spaced Repetition Module

export class VocabStore {
  constructor() {
    this.words = [];
    this.listeners = [];
  }

  async init() {
    try {
      const res = await fetch('/api/vocabulary');
      if (res.ok) {
        this.words = await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch vocabulary from server, fallback localStorage:', err.message);
      const local = localStorage.getItem('personal_vocab');
      if (local) {
        this.words = JSON.parse(local);
      }
    }
    this.notify();
    return this.words;
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.words));
  }

  getSavedWordList() {
    return this.words.map(w => w.word.toLowerCase());
  }

  hasWord(word) {
    const clean = (word || '').trim().toLowerCase();
    return this.words.some(w => w.word.toLowerCase() === clean);
  }

  async saveWord(wordData) {
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wordData)
      });
      if (res.ok) {
        const data = await res.json();
        // Update local memory list
        const clean = wordData.word.trim().toLowerCase();
        const existingIdx = this.words.findIndex(w => w.word.toLowerCase() === clean);
        if (existingIdx >= 0) {
          this.words[existingIdx] = data.word;
        } else {
          this.words.unshift(data.word);
        }
        localStorage.setItem('personal_vocab', JSON.stringify(this.words));
        this.notify();
        return data.word;
      }
    } catch (err) {
      console.error('Error saving word to server:', err);
    }
  }

  async deleteWord(word) {
    const clean = (word || '').trim().toLowerCase();
    try {
      await fetch(`/api/vocabulary/${encodeURIComponent(clean)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting word:', err);
    }
    this.words = this.words.filter(w => w.word.toLowerCase() !== clean);
    localStorage.setItem('personal_vocab', JSON.stringify(this.words));
    this.notify();
  }

  getAll() {
    return this.words;
  }
}
