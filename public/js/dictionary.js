// Dictionary & Interactive Word Lookup Module

export class DictionaryModule {
  constructor(vocabStore) {
    this.vocabStore = vocabStore;
    this.currentAudio = null;
    this.popup = document.getElementById('pop-up');
    this.initGlobalEvents();
  }

  initGlobalEvents() {
    // Close popup on click outside
    document.addEventListener('click', (e) => {
      if (this.popup && !this.popup.contains(e.target) && !e.target.classList.contains('vocabulary')) {
        this.hidePopup();
      }
    });

    // Close popup on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hidePopup();
      }
    });
  }

  hidePopup() {
    if (this.popup) {
      this.popup.style.display = 'none';
    }
  }

  // Wraps text words with interactive clickable spans
  formatInteractiveText(text) {
    if (!text) return '';
    const words = text.split(/(\s+|[.,!?;:()[\]"'])/);
    const savedWords = this.vocabStore ? this.vocabStore.getSavedWordList() : [];

    return words.map(chunk => {
      const cleanWord = chunk.trim().toLowerCase().replace(/[^a-z0-9'-]/g, '');
      if (!cleanWord || cleanWord.length < 1) {
        return chunk;
      }

      let wordClass = 'vocabulary';
      if (savedWords.includes(cleanWord)) {
        wordClass += ' new_word';
      }

      return `<span class="${wordClass}" data-word="${cleanWord}">${chunk}</span>`;
    }).join('');
  }

  // Attach click listeners to all .vocabulary elements inside container
  bindContainer(container) {
    if (!container) return;
    const elements = container.querySelectorAll('.vocabulary');
    elements.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = el.getAttribute('data-word');
        if (word) {
          this.lookupWord(word, e.pageX, e.pageY);
        }
      });
    });
  }

  async lookupWord(word, pageX, pageY) {
    if (!this.popup) return;

    // Show loading state
    this.popup.style.display = 'block';
    this.popup.innerHTML = `
      <div class="p-2 text-center text-gray-400">
        <i class="fa-solid fa-spinner fa-spin text-amber-500 me-2"></i> Đang tra từ <b>${word}</b>...
      </div>
    `;

    // Calculate position
    const popupWidth = 280;
    const x = Math.min(pageX + 10, window.innerWidth - popupWidth - 20);
    const y = pageY + 15;

    this.popup.style.left = `${Math.max(10, x)}px`;
    this.popup.style.top = `${y}px`;

    try {
      const res = await fetch(`/api/dictionary/lookup?word=${encodeURIComponent(word)}`);
      const data = await res.json();

      const isSaved = this.vocabStore && this.vocabStore.hasWord(word);

      this.popup.innerHTML = `
        <div class="word-header">
          <div>
            <span class="word-title">${data.word || word}</span>
            <span class="badge bg-amber-500/20 text-amber-400 ms-1 text-xs">${data.type || 'word'}</span>
          </div>
          <button id="btn-popup-audio" class="btn btn-sm btn-outline-warning py-0 px-2 rounded-circle" title="Phát âm">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        </div>

        ${data.ipa ? `<div class="ipa-text mb-2">/${data.ipa.replace(/\//g, '')}/</div>` : ''}

        <div class="definition-text">
          <b>Định nghĩa:</b> ${data.definition || 'Không có định nghĩa trực tiếp.'}
        </div>

        ${data.example ? `<div class="text-xs text-gray-400 fst-italic mb-2">"${data.example}"</div>` : ''}

        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
          <button id="btn-popup-save" class="btn btn-sm ${isSaved ? 'btn-success' : 'btn-warning text-dark'} w-100 fw-semibold">
            <i class="fa-solid ${isSaved ? 'fa-check' : 'fa-bookmark'} me-1"></i>
            ${isSaved ? 'Đã lưu trong sổ' : 'Lưu vào Sổ từ vựng'}
          </button>
        </div>
      `;

      // Audio playback
      const audioBtn = this.popup.querySelector('#btn-popup-audio');
      if (audioBtn) {
        audioBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playPronunciation(word);
        });
      }

      // Auto play audio once on popup open
      this.playPronunciation(word);

      // Save to Vocab
      const saveBtn = this.popup.querySelector('#btn-popup-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this.vocabStore) {
            await this.vocabStore.saveWord({
              word: data.word || word,
              ipa: data.ipa || '',
              meaning: data.definition || '',
              type: data.type || '',
              example: data.example || ''
            });
            saveBtn.className = 'btn btn-sm btn-success w-100 fw-semibold';
            saveBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Đã lưu vào sổ!';
          }
        });
      }

    } catch (err) {
      this.popup.innerHTML = `
        <div class="text-danger p-2">
          <i class="fa-solid fa-circle-exclamation me-1"></i> Lỗi tra từ: ${err.message}
        </div>
      `;
    }
  }

  playPronunciation(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback Google Translate TTS
      if (this.currentAudio) {
        this.currentAudio.pause();
      }
      this.currentAudio = new Audio(`https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`);
      this.currentAudio.play().catch(() => {});
    }
  }
}
