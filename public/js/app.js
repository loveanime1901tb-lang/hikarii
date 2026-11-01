// Main App Router & State Coordinator

import { AiService } from './ai_service.js';
import { VocabStore } from './vocab_store.js';
import { DictionaryModule } from './dictionary.js';
import { PracticeModule } from './practice.js';
import { SettingsModule } from './settings.js';

class App {
  constructor() {
    this.aiService = new AiService();
    this.vocabStore = new VocabStore();
    this.dictionary = new DictionaryModule(this.vocabStore);
    
    this.xp = parseInt(localStorage.getItem('personal_xp') || '120', 10);
    this.streak = parseInt(localStorage.getItem('personal_streak') || '3', 10);

    this.practice = new PracticeModule(
      this.aiService,
      this.dictionary,
      this.vocabStore,
      (points) => this.addXp(points)
    );

    this.settings = new SettingsModule(
      this.aiService,
      (newModel) => this.updateModelBadge(newModel)
    );

    this.lessonsCache = {
      writing: [],
      sentence: [],
      conversation: []
    };
  }

  async init() {
    await this.aiService.loadConfig();
    await this.vocabStore.init();
    await this.loadAllLessons();
    this.initNavbar();
    this.updateStatsDisplay();
    this.updateModelBadge(this.aiService.getModel());

    // Listen for hash route changes
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  addXp(points) {
    this.xp += points;
    localStorage.setItem('personal_xp', this.xp.toString());
    this.updateStatsDisplay();
  }

  updateStatsDisplay() {
    const xpEl = document.getElementById('nav-xp-points');
    const streakEl = document.getElementById('nav-streak-days');
    const vocabCountEl = document.getElementById('nav-vocab-count');

    if (xpEl) xpEl.innerText = `${this.xp.toLocaleString()} XP`;
    if (streakEl) streakEl.innerText = `${this.streak} ngày`;
    if (vocabCountEl) vocabCountEl.innerText = `${this.vocabStore.getAll().length} từ`;
  }

  updateModelBadge(model) {
    const badge = document.getElementById('nav-active-model');
    if (badge) {
      badge.innerText = model;
    }
  }

  async loadAllLessons() {
    try {
      const [w, s, c] = await Promise.all([
        fetch('/api/lessons/writing').then(r => r.json()),
        fetch('/api/lessons/sentence').then(r => r.json()),
        fetch('/api/lessons/conversation').then(r => r.json())
      ]);
      this.lessonsCache.writing = w;
      this.lessonsCache.sentence = s;
      this.lessonsCache.conversation = c;
    } catch (err) {
      console.error('Error prefetching lessons:', err);
    }
  }

  initNavbar() {
    // Navigation links
    document.querySelectorAll('[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        window.location.hash = route;
      });
    });
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    const [viewName, subParam, subParam2] = hash.split('/');

    // Hide all view containers
    const views = ['home-view', 'writing-view', 'sentence-view', 'conversation-view', 'vocabulary-view', 'settings-view', 'practice-view'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('d-none');
    });

    // Update active nav state
    document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active', 'text-amber-500'));

    switch (viewName) {
      case 'home':
        this.renderHome();
        break;
      case 'writing':
        if (subParam === 'level' && subParam2) {
          this.renderWritingCatalog(null, subParam2);
        } else {
          this.renderWritingCatalog(subParam);
        }
        break;
      case 'sentence':
        if (subParam === 'level' && subParam2) {
          this.renderSentenceCatalog(null, subParam2);
        } else {
          this.renderSentenceCatalog(subParam);
        }
        break;
      case 'conversation':
        if (subParam === 'level' && subParam2) {
          this.renderConversationCatalog(subParam2);
        } else {
          this.renderConversationCatalog();
        }
        break;
      case 'vocabulary':
        this.renderVocabulary();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'practice':
        this.startPracticeSession(subParam, subParam2);
        break;
      default:
        this.renderHome();
    }
  }

  // View: Home Dashboard
  renderHome() {
    const el = document.getElementById('home-view');
    if (!el) return;
    el.classList.remove('d-none');

    // Attach AI Generator submit
    const genInput = el.querySelector('#input-custom-topic');
    const genLevel = el.querySelector('#select-custom-level');
    const genBtn = el.querySelector('#btn-generate-custom');
    const genStatus = el.querySelector('#ai-gen-status');

    if (genBtn && genInput) {
      genBtn.onclick = async () => {
        const topic = genInput.value.trim();
        const level = genLevel ? genLevel.value : 'intermediate';
        if (!topic) {
          genInput.focus();
          return;
        }

        genBtn.disabled = true;
        genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang tạo bài học...';
        if (genStatus) {
          genStatus.classList.remove('d-none');
          genStatus.innerHTML = `AI (${this.aiService.getModel()}) đang biên soạn bài tập song ngữ mức độ <b>${level.toUpperCase()}</b> cho chủ đề <b>"${topic}"</b>...`;
        }

        try {
          const res = await this.aiService.generateLesson({ topic, level });
          if (res.ok && res.lesson) {
            // Launch practice with generated lesson
            document.getElementById('home-view').classList.add('d-none');
            document.getElementById('practice-view').classList.remove('d-none');
            this.practice.startLesson(res.lesson);
          } else {
            alert('Lỗi tạo bài: ' + (res.error || 'Vui lòng kiểm tra lại kết nối'));
          }
        } catch (err) {
          alert('Lỗi: ' + err.message);
        } finally {
          genBtn.disabled = false;
          genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Tạo Bài Luyện Viết Ngay';
          if (genStatus) genStatus.classList.add('d-none');
        }
      };
    }
  }

  // View: Writing Catalog (Paragraph: Emails, Diaries, Essays...)
  renderWritingCatalog(filterCategory, activeLevel = 'all') {
    const el = document.getElementById('writing-view');
    if (!el) return;
    el.classList.remove('d-none');

    const lessons = this.lessonsCache.writing || [];
    const listContainer = el.querySelector('#writing-lesson-list');
    const filterGroup = el.querySelector('#filter-level-writing');

    // Handle filter buttons click & visual active state
    if (filterGroup) {
      filterGroup.querySelectorAll('button').forEach(btn => {
        const lvl = btn.getAttribute('data-level');
        if (lvl === activeLevel) {
          btn.className = 'btn btn-sm btn-warning active';
        } else {
          btn.className = 'btn btn-sm btn-outline-secondary text-gray-200';
        }
        btn.onclick = () => {
          this.renderWritingCatalog(filterCategory, lvl);
        };
      });
    }

    let filtered = lessons;
    if (filterCategory) {
      filtered = filtered.filter(l => l.category === filterCategory);
    }
    if (activeLevel && activeLevel !== 'all') {
      filtered = filtered.filter(l => l.level === activeLevel);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-gray-400">
          <i class="fa-solid fa-filter fs-2 text-warning mb-2 d-block"></i>
          Không có bài học nào thuộc mức độ này. Hãy thử chọn mức độ khác!
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(l => {
      const levelBadgeColor = l.level === 'beginner' ? 'bg-success-subtle text-success border border-success-subtle' :
                              l.level === 'intermediate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      return `
        <div class="col-md-6 mb-4">
          <div class="card card-dark h-100 p-4">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${levelBadgeColor} text-uppercase text-xs">
                ${l.category} • ${l.level}
              </span>
              <span class="text-xs text-gray-400">
                <i class="fa-regular fa-clock me-1"></i> ${l.sentences.length * 3} phút
              </span>
            </div>
            <h3 class="h5 fw-bold text-white mb-2">${l.title}</h3>
            <p class="text-gray-400 small mb-4 flex-grow-1">${l.description}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-xs text-gray-400">${l.sentences.length} câu luyện dịch</span>
              <button class="btn btn-warning text-dark fw-bold btn-sm px-3 rounded-pill btn-start-writing" data-id="${l.id}">
                Bắt đầu luyện tập <i class="fa-solid fa-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.btn-start-writing').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.hash = `#practice/writing/${id}`;
      });
    });
  }

  // View: Sentence Catalog
  renderSentenceCatalog(filterCat, activeLevel = 'all') {
    const el = document.getElementById('sentence-view');
    if (!el) return;
    el.classList.remove('d-none');

    const lessons = this.lessonsCache.sentence || [];
    const listContainer = el.querySelector('#sentence-lesson-list');
    const filterGroup = el.querySelector('#filter-level-sentence');

    if (filterGroup) {
      filterGroup.querySelectorAll('button').forEach(btn => {
        const lvl = btn.getAttribute('data-level');
        if (lvl === activeLevel) {
          btn.className = 'btn btn-sm btn-warning active';
        } else {
          btn.className = 'btn btn-sm btn-outline-secondary text-gray-200';
        }
        btn.onclick = () => {
          this.renderSentenceCatalog(filterCat, lvl);
        };
      });
    }

    let filtered = lessons;
    if (activeLevel && activeLevel !== 'all') {
      filtered = filtered.filter(l => l.level === activeLevel);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-gray-400">
          <i class="fa-solid fa-filter fs-2 text-warning mb-2 d-block"></i>
          Không có bài học nào thuộc mức độ này.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(l => {
      const levelBadgeColor = l.level === 'beginner' ? 'bg-success-subtle text-success border border-success-subtle' :
                              l.level === 'intermediate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      return `
        <div class="col-md-6 mb-4">
          <div class="card card-dark h-100 p-4">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${levelBadgeColor} text-uppercase text-xs">
                ${l.category} • ${l.level}
              </span>
              <span class="text-xs text-gray-400">${l.sentences.length} câu</span>
            </div>
            <h3 class="h5 fw-bold text-white mb-2">${l.title}</h3>
            <div class="d-flex justify-content-end mt-4">
              <button class="btn btn-warning text-dark fw-bold btn-sm px-3 rounded-pill btn-start-sentence" data-id="${l.id}">
                Luyện Câu <i class="fa-solid fa-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.btn-start-sentence').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.hash = `#practice/sentence/${id}`;
      });
    });
  }

  // View: Conversation Catalog
  renderConversationCatalog(activeLevel = 'all') {
    const el = document.getElementById('conversation-view');
    if (!el) return;
    el.classList.remove('d-none');

    const lessons = this.lessonsCache.conversation || [];
    const listContainer = el.querySelector('#conversation-lesson-list');
    const filterGroup = el.querySelector('#filter-level-conversation');

    if (filterGroup) {
      filterGroup.querySelectorAll('button').forEach(btn => {
        const lvl = btn.getAttribute('data-level');
        if (lvl === activeLevel) {
          btn.className = 'btn btn-sm btn-warning active';
        } else {
          btn.className = 'btn btn-sm btn-outline-secondary text-gray-200';
        }
        btn.onclick = () => {
          this.renderConversationCatalog(lvl);
        };
      });
    }

    let filtered = lessons;
    if (activeLevel && activeLevel !== 'all') {
      filtered = filtered.filter(l => l.level === activeLevel);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-gray-400">
          <i class="fa-solid fa-filter fs-2 text-warning mb-2 d-block"></i>
          Không có bài học hội thoại nào thuộc mức độ này.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(l => {
      const levelBadgeColor = l.level === 'beginner' ? 'bg-success-subtle text-success border border-success-subtle' :
                              l.level === 'intermediate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      return `
        <div class="col-md-6 mb-4">
          <div class="card card-dark h-100 p-4">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${levelBadgeColor} text-uppercase text-xs">
                Hội thoại • ${l.level}
              </span>
              <span class="text-xs text-gray-400">${l.dialogues.length} lượt thoại</span>
            </div>
            <h3 class="h5 fw-bold text-white mb-2">${l.title}</h3>
            <p class="text-gray-400 small mb-4 flex-grow-1">${l.description}</p>
            <div class="d-flex justify-content-end">
              <button class="btn btn-warning text-dark fw-bold btn-sm px-3 rounded-pill btn-start-conv" data-id="${l.id}">
                Bắt đầu đối thoại <i class="fa-solid fa-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.btn-start-conv').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.location.hash = `#practice/conversation/${id}`;
      });
    });
  }

  // View: Vocabulary Notebook & Flashcards
  renderVocabulary() {
    const el = document.getElementById('vocabulary-view');
    if (!el) return;
    el.classList.remove('d-none');

    const words = this.vocabStore.getAll();
    const listContainer = el.querySelector('#vocab-table-body');
    const countBadge = el.querySelector('#vocab-total-count');
    if (countBadge) countBadge.innerText = words.length;

    if (words.length === 0) {
      listContainer.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-gray-400">
            <i class="fa-regular fa-bookmark fs-2 text-warning mb-2 d-block"></i>
            Chưa có từ vựng nào được lưu. Khi luyện tập, hãy click vào bất kỳ từ tiếng Anh nào để tra nghĩa và bấm "Lưu vào Sổ"!
          </td>
        </tr>
      `;
      return;
    }

    listContainer.innerHTML = words.map(w => `
      <tr>
        <td class="text-white fw-bold">
          <span class="text-amber-400 fs-6">${w.word}</span>
          ${w.ipa ? `<span class="text-gray-400 fst-italic small ms-1">/${w.ipa.replace(/\//g, '')}/</span>` : ''}
        </td>
        <td><span class="badge bg-secondary-subtle text-secondary small">${w.type || 'n/a'}</span></td>
        <td class="text-gray-200 small">${w.meaning || '-'}</td>
        <td class="text-gray-400 fst-italic small">${w.example ? `"${w.example}"` : '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning py-0 px-2 rounded-circle me-1 btn-play-vocab-audio" data-word="${w.word}">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle btn-delete-vocab" data-word="${w.word}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Audio Play
    listContainer.querySelectorAll('.btn-play-vocab-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dictionary.playPronunciation(btn.getAttribute('data-word'));
      });
    });

    // Delete
    listContainer.querySelectorAll('.btn-delete-vocab').forEach(btn => {
      btn.addEventListener('click', async () => {
        const w = btn.getAttribute('data-word');
        if (confirm(`Bạn có chắc muốn xóa từ "${w}" khỏi sổ?`)) {
          await this.vocabStore.deleteWord(w);
          this.renderVocabulary();
          this.updateStatsDisplay();
        }
      });
    });
  }

  // View: Settings & Model Tester
  renderSettings() {
    const el = document.getElementById('settings-view');
    if (!el) return;
    el.classList.remove('d-none');
    this.settings.render();
  }

  // Active Practice Route Handlers
  startPracticeSession(type, id) {
    const practiceView = document.getElementById('practice-view');
    if (!practiceView) return;
    practiceView.classList.remove('d-none');

    let lesson = null;
    if (type === 'writing') {
      lesson = this.lessonsCache.writing.find(l => l.id === id);
    } else if (type === 'sentence') {
      lesson = this.lessonsCache.sentence.find(l => l.id === id);
    } else if (type === 'conversation') {
      lesson = this.lessonsCache.conversation.find(l => l.id === id);
    }

    if (lesson) {
      this.practice.startLesson(lesson);
    } else {
      practiceView.innerHTML = `
        <div class="container py-5 text-center">
          <p class="text-danger">Không tìm thấy bài học! Vui lòng chọn bài từ danh mục.</p>
          <a href="#writing" class="btn btn-warning text-dark">Về trang chủ</a>
        </div>
      `;
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
