// Settings & Gemini Dynamic Model Scanner / Switcher / Tester Module

export class SettingsModule {
  constructor(aiService, onModelChanged) {
    this.aiService = aiService;
    this.onModelChanged = onModelChanged;
    this.container = document.getElementById('settings-view');
  }

  render() {
    if (!this.container) return;

    const currentKey = this.aiService.getApiKey();
    const currentModel = this.aiService.getModel();
    const cachedModels = this.aiService.getCachedScannedModels();

    // Generate model options
    let modelOptionsHtml = '';
    if (cachedModels.length > 0) {
      modelOptionsHtml = cachedModels.map(m => `
        <option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>
          ${m.displayName || m.id} (${m.id})
        </option>
      `).join('');
    } else {
      // Default modern active models
      const defaults = [
        { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest (Siêu Tốc & Ổn Định Nhất - Khuyên Dùng)' },
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Thế Hệ 3.5 Mới Nhất)' },
        { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (Google AI)' },
        { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Thế Hệ Mới)' },
        { id: 'gemini-pro-latest', name: 'Gemini Pro Latest (Suy Luận Cao Cấp)' }
      ];
      modelOptionsHtml = defaults.map(m => `
        <option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>
          ${m.name}
        </option>
      `).join('');
    }

    this.container.innerHTML = `
      <div class="row justify-content-center">
        <div class="col-lg-10 col-xl-9">
          <div class="card card-dark p-4 p-md-5 mb-4 shadow-lg border-secondary">
            
            <!-- Header -->
            <div class="d-flex align-items-center gap-3 mb-4 border-bottom border-secondary pb-3">
              <div class="rounded-circle bg-amber-500/20 p-3 text-amber-500 fs-3">
                <i class="fa-solid fa-sliders"></i>
              </div>
              <div>
                <h2 class="h4 fw-bold mb-1 text-white">Cấu hình Gemini & Quét Model Trực Tiếp</h2>
                <p class="text-gray-300 small mb-0">Quản lý API Key, tự động quét toàn bộ model khả dụng từ Google AI Studio và đo đạc tốc độ</p>
              </div>
            </div>

            <!-- 1. API Key Input Section -->
            <div class="mb-4">
              <label class="form-label text-white fw-bold d-flex justify-content-between align-items-center">
                <span><i class="fa-solid fa-key text-amber-500 me-2"></i>Google Gemini API Key</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-amber-400 text-decoration-none small fw-semibold">
                  <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Lấy API Key miễn phí tại Google AI Studio
                </a>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-gray-900 border-secondary text-gray-400">
                  <i class="fa-solid fa-lock"></i>
                </span>
                <input type="password" id="input-api-key" class="form-control bg-gray-950 border-secondary text-white py-2" 
                  placeholder="Dán API Key (bắt đầu bằng AIzaSy...)" value="${currentKey}">
                <button class="btn btn-outline-secondary" type="button" id="btn-toggle-key-visibility" title="Hiện/Ẩn Key">
                  <i class="fa-regular fa-eye"></i>
                </button>
                <button class="btn btn-warning text-dark fw-bold px-4" id="btn-save-key">
                  <i class="fa-solid fa-floppy-disk me-1"></i> Lưu Key
                </button>
              </div>
              <div class="form-text text-gray-400 mt-2">
                <i class="fa-solid fa-shield-halved text-success me-1"></i> API Key được lưu an toàn trực tiếp trên trình duyệt của bạn (LocalStorage).
              </div>
            </div>

            <!-- 2. Scan Models Action Bar -->
            <div class="p-3 mb-4 rounded-3 bg-gray-900 border border-secondary">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h4 class="h6 fw-bold text-white mb-1">
                    <i class="fa-solid fa-satellite-dish text-info me-2"></i>Quét Danh Sách Model từ Tài Khoản
                  </h4>
                  <p class="text-gray-300 small mb-0">
                    Tự động kết nối Google API để lấy danh sách các model khả dụng cho API Key của bạn.
                  </p>
                </div>
                <button class="btn btn-info text-dark fw-bold px-4 py-2" id="btn-scan-models">
                  <i class="fa-solid fa-arrows-rotate me-1"></i> Quét Model Khả Dụng
                </button>
              </div>
              <div id="scan-status-alert" class="small mt-3 d-none"></div>
            </div>

            <!-- 3. Model Selector -->
            <div class="mb-4">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label text-white fw-bold mb-0">
                  <i class="fa-solid fa-microchip text-warning me-2"></i>Model Gemini Đang Sử Dụng
                </label>
                <span class="badge bg-secondary text-white small" id="models-count-badge">
                  ${cachedModels.length > 0 ? `Đã nạp ${cachedModels.length} model từ Google` : 'Danh sách mặc định'}
                </span>
              </div>
              <select id="select-gemini-model" class="form-select bg-gray-900 border-secondary text-white py-2 fs-6">
                ${modelOptionsHtml}
                <option value="custom">⚙️ Tùy chỉnh: Nhập mã model thủ công...</option>
              </select>

              <!-- Custom Model Input -->
              <div id="custom-model-wrapper" class="mt-2 ${cachedModels.some(m => m.id === currentModel) || ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-pro-latest'].includes(currentModel) ? 'd-none' : ''}">
                <input type="text" id="input-custom-model" class="form-control bg-gray-950 border-secondary text-white" 
                  placeholder="Nhập tên Model bất kỳ (ví dụ: gemini-2.0-flash)" value="${currentModel}">
              </div>
            </div>

            <!-- 4. Test Buttons -->
            <div class="d-flex flex-wrap gap-2 mb-4 pt-2 border-top border-secondary">
              <button class="btn btn-warning text-dark fw-bold px-4 py-2" id="btn-test-model">
                <i class="fa-solid fa-bolt me-1"></i> Test Model Đang Chọn
              </button>
              <button class="btn btn-outline-light fw-semibold px-4 py-2" id="btn-benchmark-models">
                <i class="fa-solid fa-chart-simple text-warning me-1"></i> So Sánh Benchmark Tốc Độ
              </button>
            </div>

            <!-- Single Test Result Panel -->
            <div id="test-result-panel" class="d-none"></div>

            <!-- Benchmark Table Panel -->
            <div id="benchmark-panel" class="d-none mt-3"></div>

          </div>

          <!-- Documentation / Guide Card -->
          <div class="card card-dark p-4 border-secondary">
            <h3 class="h6 fw-bold text-amber-400 mb-2">
              <i class="fa-regular fa-lightbulb me-1"></i> Thông Tin Về Các Dòng Model Gemini:
            </h3>
            <ul class="text-gray-300 small mb-0 ps-3 lh-lg">
              <li><b>Dòng Flash-Lite (gemini-flash-lite-latest, gemini-3.5-flash-lite):</b> Tốc độ phản hồi cực nhanh (~500ms - 900ms), hoạt động liên tục không bị quá tải (503), rất tối ưu cho việc chấm điểm bài dịch thời gian thực.</li>
              <li><b>Dòng Flash (gemini-flash-latest, gemini-3.8-flash):</b> Cung cấp khả năng ngôn ngữ tự nhiên và phân tích ngữ pháp phong phú.</li>
              <li><b>Dòng Pro (gemini-pro-latest):</b> Suy luận ngôn ngữ chuyên sâu nhất cho các bài luận phức tạp và từ vựng nâng cao.</li>
              <li>Nhấn <b>"Quét Model Khả Dụng"</b> để hệ thống tự động đồng bộ toàn bộ model được kích hoạt trên tài khoản Google AI Studio của bạn.</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const keyInput = this.container.querySelector('#input-api-key');
    const saveKeyBtn = this.container.querySelector('#btn-save-key');
    const toggleKeyBtn = this.container.querySelector('#btn-toggle-key-visibility');
    const scanBtn = this.container.querySelector('#btn-scan-models');
    const scanAlert = this.container.querySelector('#scan-status-alert');
    const modelSelect = this.container.querySelector('#select-gemini-model');
    const customWrapper = this.container.querySelector('#custom-model-wrapper');
    const customInput = this.container.querySelector('#input-custom-model');
    const testModelBtn = this.container.querySelector('#btn-test-model');
    const benchmarkBtn = this.container.querySelector('#btn-benchmark-models');

    // Toggle password visibility
    toggleKeyBtn.addEventListener('click', () => {
      const isPass = keyInput.type === 'password';
      keyInput.type = isPass ? 'text' : 'password';
      toggleKeyBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });

    // Save API Key
    saveKeyBtn.addEventListener('click', () => {
      const val = keyInput.value.trim();
      this.aiService.setApiKey(val);
      saveKeyBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Đã Lưu!';
      setTimeout(() => {
        saveKeyBtn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Lưu Key';
      }, 2000);
    });

    // 1. DYNAMIC MODEL SCANNER ACTION
    scanBtn.addEventListener('click', async () => {
      const apiKey = keyInput.value.trim();
      if (!apiKey) {
        alert('Vui lòng nhập Gemini API Key của bạn trước khi quét model!');
        keyInput.focus();
        return;
      }
      this.aiService.setApiKey(apiKey);

      scanBtn.disabled = true;
      scanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang quét Google API...';
      scanAlert.className = 'alert alert-info py-2 px-3 small mt-3';
      scanAlert.innerHTML = '<i class="fa-solid fa-satellite-dish me-2"></i> Đang truy vấn danh sách model từ <code>https://generativelanguage.googleapis.com/v1beta/models</code>...';

      try {
        const models = await this.aiService.scanAvailableModels();

        if (models && models.length > 0) {
          scanAlert.className = 'alert alert-success py-2 px-3 small mt-3';
          scanAlert.innerHTML = `<i class="fa-solid fa-circle-check text-success me-2"></i> Quét thành công! Tìm thấy <b>${models.length} model</b> khả dụng cho tài khoản của bạn.`;

          // Populate select
          const currentModel = this.aiService.getModel();
          let newOptions = models.map(m => `
            <option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>
              ${m.displayName || m.id} (${m.id})
            </option>
          `).join('');
          newOptions += '<option value="custom">⚙️ Tùy chỉnh: Nhập mã model thủ công...</option>';

          modelSelect.innerHTML = newOptions;

          // If currentModel is not in list, auto select the first recommended model
          if (!models.some(m => m.id === currentModel)) {
            const firstModel = models[0].id;
            modelSelect.value = firstModel;
            this.aiService.setModel(firstModel);
            if (this.onModelChanged) this.onModelChanged(firstModel);
          }

          const countBadge = this.container.querySelector('#models-count-badge');
          if (countBadge) countBadge.innerText = `Đã nạp ${models.length} model từ Google`;
        } else {
          scanAlert.className = 'alert alert-warning py-2 px-3 small mt-3';
          scanAlert.innerHTML = 'Không tìm thấy model nào. Hãy kiểm tra lại quyền hạn của API Key.';
        }
      } catch (err) {
        scanAlert.className = 'alert alert-danger py-2 px-3 small mt-3';
        scanAlert.innerHTML = `<i class="fa-solid fa-circle-xmark me-2"></i> Lỗi khi quét model: <b>${err.message}</b>. Hãy kiểm tra lại API Key.`;
      } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate me-1"></i> Quét Lại Model';
      }
    });

    // Model select change
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === 'custom') {
        customWrapper.classList.remove('d-none');
        if (customInput && customInput.value.trim()) {
          this.aiService.setModel(customInput.value.trim());
        }
      } else {
        customWrapper.classList.add('d-none');
        this.aiService.setModel(modelSelect.value);
      }
      if (this.onModelChanged) this.onModelChanged(this.aiService.getModel());
    });

    if (customInput) {
      customInput.addEventListener('input', () => {
        if (modelSelect.value === 'custom' && customInput.value.trim()) {
          this.aiService.setModel(customInput.value.trim());
          if (this.onModelChanged) this.onModelChanged(this.aiService.getModel());
        }
      });
    }

    // Test Single Model
    testModelBtn.addEventListener('click', async () => {
      const panel = this.container.querySelector('#test-result-panel');
      const apiKey = keyInput.value.trim();
      if (!apiKey) {
        alert('Vui lòng nhập Gemini API Key trước khi test!');
        keyInput.focus();
        return;
      }

      this.aiService.setApiKey(apiKey);
      const activeModel = this.aiService.getModel();

      panel.className = 'mt-3 p-4 rounded-3 bg-gray-900 border border-secondary';
      panel.innerHTML = `
        <div class="d-flex align-items-center text-gray-200">
          <div class="spinner-border text-amber-500 spinner-border-sm me-3"></div>
          <span>Đang gửi câu prompt kiểm tra tới model <b>${activeModel}</b>...</span>
        </div>
      `;

      try {
        const result = await this.aiService.testModel(activeModel);

        if (result.ok) {
          const latencyClass = result.latencyMs < 600 ? 'text-success' : result.latencyMs < 1200 ? 'text-warning' : 'text-danger';
          panel.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-2">
              <span class="badge bg-success text-white px-3 py-2 fs-6">
                <i class="fa-solid fa-circle-check me-1"></i> Kết Nối Hoàn Hảo!
              </span>
              <span class="fs-6 ${latencyClass} fw-bold">
                <i class="fa-solid fa-stopwatch me-1"></i> Độ trễ: ${result.latencyMs} ms
              </span>
            </div>
            <div class="text-xs text-gray-400 mb-1"><b>Model thử nghiệm:</b> <span class="text-white">${result.model}</span></div>
            <div class="bg-gray-950 p-3 rounded-3 border border-secondary text-gray-100 small mt-2">
              <div class="text-xs text-amber-400 fw-bold mb-1"><i class="fa-solid fa-comment-dots me-1"></i> Phản hồi mẫu từ AI:</div>
              "${result.reply}"
            </div>
          `;
        } else {
          panel.innerHTML = `
            <div class="badge bg-danger text-white px-3 py-2 fs-6 mb-3">
              <i class="fa-solid fa-circle-xmark me-1"></i> Kiểm Tra Thất Bại
            </div>
            <div class="text-danger small mt-1"><b>Chi tiết lỗi từ Google API:</b> ${result.error || 'Không xác định'}</div>
            <div class="text-gray-400 text-xs mt-2">
              Gợi ý: Kiểm tra xem API Key đã kích hoạt chưa, hoặc bấm nút <b>"Quét Model Khả Dụng"</b> để cập nhật danh sách model hợp lệ.
            </div>
          `;
        }
      } catch (err) {
        panel.innerHTML = `
          <div class="text-danger small"><i class="fa-solid fa-circle-xmark me-1"></i> Lỗi: ${err.message}</div>
        `;
      }
    });

    // Benchmark Available Models
    benchmarkBtn.addEventListener('click', async () => {
      const panel = this.container.querySelector('#benchmark-panel');
      const apiKey = keyInput.value.trim();
      if (!apiKey) {
        alert('Vui lòng nhập Gemini API Key trước khi benchmark!');
        keyInput.focus();
        return;
      }
      this.aiService.setApiKey(apiKey);

      panel.className = 'mt-3 p-4 rounded-3 bg-gray-900 border border-secondary';
      panel.innerHTML = `
        <div class="d-flex align-items-center text-gray-200">
          <div class="spinner-border text-warning spinner-border-sm me-3"></div>
          <span id="benchmark-status-text">Đang chuẩn bị danh sách model để đo đạc...</span>
        </div>
      `;

      // 1. Get models from scan cache; if empty, automatically scan from Google API first!
      let availableModels = this.aiService.getCachedScannedModels();
      if (!availableModels || availableModels.length === 0) {
        panel.querySelector('#benchmark-status-text').innerText = 'Chưa có danh sách model. Đang tự động quét model từ Google AI Studio...';
        try {
          availableModels = await this.aiService.scanAvailableModels();
          // Update the select dropdown as well
          if (availableModels && availableModels.length > 0) {
            const currentModel = this.aiService.getModel();
            modelSelect.innerHTML = availableModels.map(m => `
              <option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>
                ${m.displayName || m.id} (${m.id})
              </option>
            `).join('') + '<option value="custom">⚙️ Tùy chỉnh: Nhập mã model thủ công...</option>';
            const countBadge = this.container.querySelector('#models-count-badge');
            if (countBadge) countBadge.innerText = `Đã nạp ${availableModels.length} model từ Google`;
          }
        } catch (scanErr) {
          panel.innerHTML = `
            <div class="alert alert-danger py-2 px-3 small mb-0">
              <i class="fa-solid fa-circle-xmark me-2"></i> Không thể quét model: <b>${scanErr.message}</b>. Vui lòng kiểm tra lại API Key.
            </div>
          `;
          return;
        }
      }

      if (!availableModels || availableModels.length === 0) {
        panel.innerHTML = `
          <div class="alert alert-warning py-2 px-3 small mb-0">
            Không tìm thấy model nào khả dụng trên tài khoản của bạn để benchmark.
          </div>
        `;
        return;
      }

      // 2. Select the models to benchmark directly from the scanned list (take up to 5 models)
      const listToTest = availableModels.slice(0, 5).map(m => m.id);

      panel.innerHTML = `
        <div class="d-flex align-items-center text-gray-200">
          <div class="spinner-border text-warning spinner-border-sm me-3"></div>
          <div>
            <div>Đang tiến hành benchmark so sánh <b>${listToTest.length} model</b> quét từ tài khoản của bạn:</div>
            <div class="text-xs text-amber-400 mt-1"><code>${listToTest.join(', ')}</code></div>
          </div>
        </div>
      `;

      // 3. Run benchmark on each scanned model one by one
      const results = [];
      for (let i = 0; i < listToTest.length; i++) {
        const m = listToTest[i];
        try {
          const testRes = await this.aiService.testModel(m);
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

      let rows = results.map(r => {
        const statusBadge = r.ok 
          ? `<span class="badge bg-success">Hoạt động</span>` 
          : `<span class="badge bg-danger">Lỗi</span>`;
        const speed = r.ok ? `<b class="${r.latencyMs < 700 ? 'text-success' : 'text-warning'}">${r.latencyMs} ms</b>` : `<span class="text-danger small">${r.error || 'Lỗi kết nối'}</span>`;
        const isCurrent = this.aiService.getModel() === r.model;

        // Find display name from scanned models
        const modelMeta = availableModels.find(m => m.id === r.model);
        const displayName = modelMeta ? (modelMeta.displayName || modelMeta.id) : r.model;

        return `
          <tr>
            <td>
              <div class="text-white fw-bold">${displayName}</div>
              <div class="text-gray-400 text-xs"><code>${r.model}</code></div>
            </td>
            <td>${statusBadge}</td>
            <td>${speed}</td>
            <td>
              ${isCurrent 
                ? '<span class="badge bg-warning text-dark fw-bold px-2 py-1"><i class="fa-solid fa-check me-1"></i> Đang Dùng</span>' 
                : `<button class="btn btn-sm btn-outline-warning py-1 px-3 btn-select-bench fw-semibold" data-model="${r.model}">Chọn Dùng</button>`
              }
            </td>
          </tr>
        `;
      }).join('');

      panel.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="h6 text-amber-400 fw-bold mb-0 d-flex align-items-center gap-2">
            <i class="fa-solid fa-chart-simple"></i> Bảng Đo Đạc & So Sánh Tốc Độ (Các Model Đã Quét)
          </h4>
          <span class="badge bg-secondary text-white small">${results.length} model</span>
        </div>
        <div class="table-responsive">
          <table class="table table-dark table-hover table-bordered border-secondary small mb-0 align-middle">
            <thead>
              <tr class="text-gray-300">
                <th style="width: 40%;">Model Quét Từ Google</th>
                <th style="width: 15%;">Trạng Thái</th>
                <th style="width: 25%;">Độ Trễ Phản Hồi</th>
                <th style="width: 20%;">Hành Động</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="text-xs text-gray-400 mt-2">
          <i class="fa-solid fa-circle-info me-1"></i> Bấm "Chọn Dùng" để đặt model nhanh nhất làm mặc định cho việc chấm bài viết.
        </div>
      `;

      // Select button listener
      panel.querySelectorAll('.btn-select-bench').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = btn.getAttribute('data-model');
          this.aiService.setModel(m);
          modelSelect.value = m;
          if (this.onModelChanged) this.onModelChanged(m);
          benchmarkBtn.click(); // re-render table with active state updated
        });
      });
    });
  }
}
