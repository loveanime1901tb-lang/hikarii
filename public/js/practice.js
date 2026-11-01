// Interactive Practice Engine (Sentence, Paragraph, Conversation Writing)

export class PracticeModule {
  constructor(aiService, dictionaryModule, vocabStore, onScoreEarned) {
    this.aiService = aiService;
    this.dict = dictionaryModule;
    this.vocabStore = vocabStore;
    this.onScoreEarned = onScoreEarned;

    this.container = document.getElementById('practice-view');
    this.currentLesson = null;
    this.currentIndex = 0;
    this.completedSentences = [];
    this.audioContext = null;
  }

  startLesson(lesson) {
    this.currentLesson = lesson;
    this.currentIndex = 0;
    this.completedSentences = [];
    this.render();
  }

  render() {
    if (!this.container || !this.currentLesson) return;

    const isConv = this.currentLesson.dialogues !== undefined;
    const items = isConv ? this.currentLesson.dialogues : this.currentLesson.sentences;
    const currentItem = items[this.currentIndex];

    if (!currentItem) {
      this.renderCompletedSummary();
      return;
    }

    const progressPercent = Math.round((this.currentIndex / items.length) * 100);

    // If conversation and it's a system (partner) message, auto-advance or show it
    const isPartner = isConv && currentItem.role === 'system';

    this.container.innerHTML = `
      <div class="container py-4">
        <!-- Breadcrumb / Header -->
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
          <div class="d-flex align-items-center gap-2 text-sm text-gray-400">
            <button class="btn btn-sm btn-link text-gray-400 p-0 text-decoration-none" id="btn-back-lessons">
              <i class="fa-solid fa-arrow-left me-1"></i> Quay lại danh mục
            </button>
            <span>/</span>
            <span class="text-white">${this.currentLesson.title}</span>
            <span class="badge bg-amber-500/20 text-amber-400 border border-amber-500/30 ms-2 text-capitalize">
              ${this.currentLesson.level || 'Intermediate'}
            </span>
          </div>

          <!-- Active Model Indicator -->
          <div class="small text-gray-400">
            <i class="fa-solid fa-robot text-amber-500 me-1"></i> Model: 
            <span class="text-white fw-semibold">${this.aiService.getModel()}</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress bg-gray-800 mb-4" style="height: 6px;">
          <div class="progress-bar bg-warning" style="width: ${progressPercent}%;"></div>
        </div>

        <div class="row justify-content-center">
          <div class="col-lg-10">
            <div class="card card-dark p-4 p-md-5 position-relative">
              
              <!-- Floating XP Animation Target -->
              <div id="plus-point-anchor" class="plus-point-container"></div>

              <!-- Exercise Header & Progress -->
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-xs text-gray-400 text-uppercase tracking-wider fw-bold">
                  Câu ${this.currentIndex + 1} / ${items.length}
                </span>
                <button class="btn btn-sm btn-outline-secondary rounded-pill py-1 px-3" id="btn-toggle-hint">
                  <i class="fa-regular fa-lightbulb text-warning me-1"></i> Xem gợi ý từ
                </button>
              </div>

              <!-- Hint Box (Hidden by default) -->
              <div id="hint-box" class="alert bg-gray-900 border border-warning/40 text-amber-300 small mb-3 d-none">
                <i class="fa-solid fa-wand-magic-sparkles me-2"></i>
                <b>Gợi ý từ vựng / Cấu trúc:</b> ${(currentItem.hints || []).join(' • ') || 'Tự do diễn đạt theo ý của bạn!'}
              </div>

              <!-- Vietnamese Prompt -->
              <div class="mb-4">
                <label class="text-xs text-gray-400 text-uppercase fw-bold mb-1">Dịch sang tiếng Anh:</label>
                <div class="fs-4 fw-semibold text-white lh-base bg-gray-900 p-4 rounded-3 border border-secondary" id="vietnamese-prompt">
                  ${isPartner ? `<b>[${currentItem.speaker || 'Partner'}]:</b> ` : ''}${currentItem.vi}
                </div>
              </div>

              ${isPartner ? `
                <!-- Partner Dialogue auto-view -->
                <div class="mb-4 p-3 bg-gray-800 rounded border border-secondary">
                  <div class="text-xs text-gray-400 mb-1">Câu đối đáp tiếng Anh:</div>
                  <div class="fs-5 text-amber-400" id="partner-en-text">
                    ${this.dict.formatInteractiveText(currentItem.en)}
                  </div>
                </div>
                <button class="btn btn-warning text-dark fw-bold px-4 py-2" id="btn-partner-next">
                  Tiếp tục đến lượt bạn <i class="fa-solid fa-arrow-right ms-1"></i>
                </button>
              ` : `
                <!-- User Typing Input -->
                <div class="mb-3">
                  <label class="text-xs text-gray-400 text-uppercase fw-bold mb-1">Bản dịch tiếng Anh của bạn:</label>
                  <textarea id="user-input-en" class="form-control bg-gray-950 border-secondary text-white fs-5 p-3 rounded-3" 
                    rows="3" placeholder="Nhập câu tiếng Anh tại đây... (Nhấn Ctrl+Enter để kiểm tra)" autofocus></textarea>
                </div>

                <!-- Action Controls -->
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div class="text-xs text-gray-400">
                    <span class="d-none d-md-inline">Phím tắt: </span>
                    <kbd class="bg-gray-800 text-gray-300 border border-secondary">Ctrl + Enter</kbd> kiểm tra
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-warning text-dark fw-bold px-4 py-2" id="btn-submit-answer">
                      <i class="fa-solid fa-circle-check me-1"></i> Kiểm Tra
                    </button>
                  </div>
                </div>

                <!-- Evaluation Result Box (Dynamic) -->
                <div id="eval-result-box" class="mt-4 d-none"></div>
              `}

            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(currentItem, items);
  }

  bindEvents(currentItem, items) {
    const backBtn = this.container.querySelector('#btn-back-lessons');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.hash = '#writing';
      });
    }

    const hintBtn = this.container.querySelector('#btn-toggle-hint');
    const hintBox = this.container.querySelector('#hint-box');
    if (hintBtn && hintBox) {
      hintBtn.addEventListener('click', () => {
        hintBox.classList.toggle('d-none');
      });
    }

    // Partner dialogue pass-through
    const partnerNextBtn = this.container.querySelector('#btn-partner-next');
    if (partnerNextBtn) {
      // Bind interactive words on partner text
      const partnerTextEl = this.container.querySelector('#partner-en-text');
      if (partnerTextEl) this.dict.bindContainer(partnerTextEl);

      partnerNextBtn.addEventListener('click', () => {
        this.currentIndex++;
        this.render();
      });
      return;
    }

    const inputArea = this.container.querySelector('#user-input-en');
    const submitBtn = this.container.querySelector('#btn-submit-answer');

    if (inputArea && submitBtn) {
      inputArea.focus();

      // Submit on Ctrl+Enter
      inputArea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          submitBtn.click();
        }
      });

      submitBtn.addEventListener('click', async () => {
        const text = inputArea.value.trim();
        if (!text) {
          inputArea.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang chấm...';

        await this.handleEvaluation(text, currentItem, items);

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Kiểm Tra Lại';
      });
    }
  }

  async handleEvaluation(userText, currentItem, items) {
    const evalBox = this.container.querySelector('#eval-result-box');
    evalBox.classList.remove('d-none');
    evalBox.innerHTML = `
      <div class="p-3 text-center text-gray-400">
        <div class="spinner-border text-amber-500 spinner-border-sm me-2"></div>
        Trí tuệ nhân tạo đang phân tích ngữ pháp và so sánh bản dịch...
      </div>
    `;

    try {
      const evalData = await this.aiService.evaluateTranslation({
        vietnamese: currentItem.vi,
        englishUser: userText,
        referenceEn: currentItem.en
      });

      const isGood = evalData.isGood || evalData.score >= 75;
      const scoreColor = isGood ? 'text-success' : 'text-warning';

      // Play sound and XP animation
      if (isGood) {
        this.playCorrectTone();
        this.triggerXpAnimation('+15 XP');
        if (this.onScoreEarned) this.onScoreEarned(15);
      }

      // Generate HTML feedback
      const feedbackItems = (evalData.feedback || []).map(fb => `
        <li class="mb-1">${fb}</li>
      `).join('');

      evalBox.innerHTML = `
        <div class="p-4 rounded-3 bg-gray-900 border ${isGood ? 'border-success' : 'border-warning/60'}">
          <div class="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4 fw-bold ${scoreColor}">
                <i class="fa-solid ${isGood ? 'fa-circle-check text-success' : 'fa-triangle-exclamation text-warning'} me-2"></i>
                Điểm: ${evalData.score}/100
              </span>
              <span class="badge ${isGood ? 'bg-success' : 'bg-warning text-dark'} ms-2">
                ${isGood ? 'Rất Tốt!' : 'Cần Cải Thiện'}
              </span>
            </div>
            <div class="small text-gray-400">
              Nguồn chấm: <b class="text-white">${evalData.source === 'gemini' ? 'Gemini AI (' + evalData.model + ')' : 'Local Engine'}</b>
            </div>
          </div>

          <!-- Ideal / Corrected Sentence -->
          <div class="mb-3">
            <div class="text-xs text-gray-400 fw-bold text-uppercase mb-1">
              Câu chuẩn xác (Bấm vào từ để xem phiên âm & nghĩa):
            </div>
            <div class="p-3 bg-gray-950 rounded border border-gray-800 fs-5 text-amber-300" id="corrected-interactive-text">
              ${this.dict.formatInteractiveText(evalData.idealCorrection || currentItem.en)}
            </div>
          </div>

          <!-- Feedback explanation -->
          ${evalData.feedback && evalData.feedback.length > 0 ? `
            <div class="mb-3">
              <div class="text-xs text-gray-400 fw-bold text-uppercase mb-1">Nhận xét chi tiết từ AI:</div>
              <ul class="text-gray-200 small mb-0 ps-3">
                ${feedbackItems}
              </ul>
            </div>
          ` : ''}

          <!-- Alternatives (Formal, Casual, Idiomatic) -->
          ${evalData.alternatives && (evalData.alternatives.casual || evalData.alternatives.idiomatic) ? `
            <div class="row g-2 mb-3">
              ${evalData.alternatives.casual ? `
                <div class="col-md-6">
                  <div class="bg-gray-950 p-2 rounded border border-gray-800 text-xs">
                    <span class="text-muted fw-bold">Giao tiếp thường ngày:</span>
                    <div class="text-white mt-1">${evalData.alternatives.casual}</div>
                  </div>
                </div>
              ` : ''}
              ${evalData.alternatives.idiomatic ? `
                <div class="col-md-6">
                  <div class="bg-gray-950 p-2 rounded border border-gray-800 text-xs">
                    <span class="text-muted fw-bold">Chuẩn người bản xứ:</span>
                    <div class="text-white mt-1">${evalData.alternatives.idiomatic}</div>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Next Button -->
          <div class="d-flex justify-content-end mt-3">
            <button class="btn btn-warning text-dark fw-bold px-4 py-2" id="btn-next-sentence">
              ${this.currentIndex + 1 < items.length ? 'Câu Tiếp Theo <i class="fa-solid fa-arrow-right ms-1"></i>' : 'Hoàn Thành Bài Tập <i class="fa-solid fa-flag-checkered ms-1"></i>'}
            </button>
          </div>
        </div>
      `;

      // Bind interactive words on corrected text
      const correctedBox = evalBox.querySelector('#corrected-interactive-text');
      if (correctedBox) this.dict.bindContainer(correctedBox);

      // Next Sentence Handler
      const nextBtn = evalBox.querySelector('#btn-next-sentence');
      if (nextBtn) {
        nextBtn.focus();
        nextBtn.addEventListener('click', () => {
          this.currentIndex++;
          this.render();
        });
      }

    } catch (err) {
      evalBox.innerHTML = `
        <div class="alert alert-danger">
          <i class="fa-solid fa-circle-exclamation me-2"></i> Lỗi khi đánh giá câu: ${err.message}
        </div>
      `;
    }
  }

  triggerXpAnimation(text = '+15 XP') {
    const anchor = this.container.querySelector('#plus-point-anchor');
    if (!anchor) return;

    const el = document.createElement('div');
    el.className = 'plus-point';
    el.innerText = text;
    anchor.appendChild(el);

    setTimeout(() => el.remove(), 1000);
  }

  playCorrectTone() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  renderCompletedSummary() {
    this.container.innerHTML = `
      <div class="container py-5 text-center">
        <div class="card card-dark p-5 mx-auto" style="max-width: 600px;">
          <div class="display-3 text-warning mb-3">
            <i class="fa-solid fa-trophy"></i>
          </div>
          <h2 class="h3 fw-bold text-white mb-2">Chúc Mừng Bạn Đã Hoàn Thành!</h2>
          <p class="text-gray-400 mb-4">
            Bạn đã hoàn tất xuất sắc bài luyện dịch <b>${this.currentLesson.title}</b>.
          </p>
          <div class="d-flex justify-content-center gap-3">
            <button class="btn btn-warning text-dark fw-bold px-4 py-2" id="btn-replay-lesson">
              <i class="fa-solid fa-rotate-right me-1"></i> Luyện Tập Lại
            </button>
            <button class="btn btn-outline-light px-4 py-2" id="btn-finish-return">
              <i class="fa-solid fa-list me-1"></i> Chọn Bài Khác
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-replay-lesson')?.addEventListener('click', () => {
      this.currentIndex = 0;
      this.render();
    });

    this.container.querySelector('#btn-finish-return')?.addEventListener('click', () => {
      window.location.hash = '#writing';
    });
  }
}
