
    window.isExporting = false;
// ==========================================
    // 1. MODULE INDEXEDDB ĐỂ LƯU ẢNH NỀN OFFLINE
    // ==========================================
    const DB_NAME = 'TKB_Liquid_DB';
    const STORE_NAME = 'assets';

    function openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function assetOp(key, value, remove) {
      let db;
      try {
        db = await openDB();
        return await new Promise((resolve,reject) => {
          const tx=db.transaction(STORE_NAME, value !== undefined || remove ? 'readwrite':'readonly');
          const store=tx.objectStore(STORE_NAME);
          const req=remove?store.delete(key):value!==undefined?store.put(value,key):store.get(key);
          let result; req.onsuccess=()=>{result=req.result;};
          tx.oncomplete=()=>resolve(result || null);
          tx.onerror=tx.onabort=()=>reject(tx.error || new Error('Không lưu được tệp.'));
        });
      } catch(e) { notifyTKB('Không truy cập được bộ nhớ trình duyệt. Hãy xuất bản sao lưu trước khi đóng trang.'); throw e; }
      finally { if(db)db.close(); }
    }
    function saveBgImageToDB(v){return assetOp('custom_bg',v).catch(()=>{});}
    function loadBgImageFromDB(){return assetOp('custom_bg').catch(()=>null);}
    function removeBgImageFromDB(){return assetOp('custom_bg',undefined,true).catch(()=>{});}
    function saveAudioToDB(v){return assetOp('custom_audio',v).catch(()=>{});}
    function loadAudioFromDB(){return window.parent!==window?Promise.resolve(null):assetOp('custom_audio').catch(()=>null);}
    function removeAudioFromDB(){return assetOp('custom_audio',undefined,true).catch(()=>{});}
    function escapeText(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
    function notifyTKB(message){let el=document.getElementById('tkb-status');if(!el){el=document.createElement('p');el.id='tkb-status';el.setAttribute('role','status');document.body.prepend(el);}el.textContent=message;}
    let settingsTimer=null, pendingSettings=null;
    function flushSettings(){if(pendingSettings){writeValue('tkb_settings',pendingSettings);pendingSettings=null;}clearTimeout(settingsTimer);}
    function writeValue(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){notifyTKB('Bộ nhớ đầy hoặc bị chặn. Hãy Xuất JSON để giữ lịch của bạn.');return false;}}
    window.addEventListener('pagehide',flushSettings);
    // ==========================================
    // 2. KHỞI TẠO DỮ LIỆU & LOCALSTORAGE
    // ==========================================
    function safeGet(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    }
    function safeSet(k, v) {
      if(k==='tkb_settings'){pendingSettings=v;clearTimeout(settingsTimer);settingsTimer=setTimeout(flushSettings,350);}else writeValue(k,v);
      if(window.recordTKB)window.recordTKB(k);
    }

    const defaultMorning = [
      { p: "1", d: [{s:"HĐTN",t:""},{s:"Thể dục",t:""},{s:"Lịch sử",t:""},{s:"Hoá học",t:""},{s:"Thể dục",t:""}] },
      { p: "2", d: [{s:"Ngữ văn",t:""},{s:"Ngữ văn",t:""},{s:"Toán",t:""},{s:"Vật lý",t:""},{s:"Tin học",t:""}] },
      { p: "3", d: [{s:"Hoá học",t:""},{s:"Toán",t:""},{s:"Tin học",t:""},{s:"Ngữ văn",t:""},{s:"Vật lý",t:""}] },
      { p: "4", d: [{s:"Toán",t:""},{s:"Toán",t:""},{s:"Công nghệ",t:""},{s:"Ngữ văn",t:""},{s:"SHL",t:""}] }
    ];

    const defaultAfternoon = [
      { p: "C1", d: [{s:"Tự học",t:""},{s:"-",t:""},{s:"Bồi dưỡng",t:""},{s:"-",t:""},{s:"-",t:""}] },
      { p: "C2", d: [{s:"Tự học",t:""},{s:"-",t:""},{s:"Bồi dưỡng",t:""},{s:"-",t:""},{s:"-",t:""}] },
      { p: "C3", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] }
    ];

    let morningData = safeGet('tkb_morning', defaultMorning);
    let afternoonData = safeGet('tkb_afternoon', defaultAfternoon);
    let appSettings = safeGet('tkb_settings', {});
    // Từ bản này, tỉ lệ mặc định là 16:9. Chuyển một lần cấu hình 9:16
    // của bản cũ (nơi 9:16 từng là mặc định), không ảnh hưởng đến môn/lịch.
    // Sau lần chuyển, mọi thay đổi tỉ lệ do người dùng chọn sẽ được giữ nguyên.
    if (!safeGet('tkb_landscape_default_v1', false)) {
      if (appSettings && appSettings.ratio === '9:16') {
        appSettings.ratio = '16:9';
        safeSet('tkb_settings', appSettings);
      }
      safeSet('tkb_landscape_default_v1', true);
    }
    let customSubjectsList = safeGet('tkb_custom_subjects', []);

    let hasAfternoon = appSettings.hasAfternoon !== undefined ? appSettings.hasAfternoon : safeGet('tkb_has_afternoon', false);
    let isSplitMode = appSettings.isSplitMode !== undefined ? appSettings.isSplitMode : false;
    let currentActiveDay = 0;
    let selectedCell = null;
    let loadedBgImg = null;
    let currentBgObjectUrl = null;
    let bgImgVersion = 0;
    let hitBoxes = [];
    let currentPreviewView = 'morning';
    let currentExportBlob = null;

    const titleInput = document.getElementById('titleInput');
    const subInput = document.getElementById('subInput');
    const afternoonToggle = document.getElementById('afternoonToggle');
    const splitImageToggle = document.getElementById('splitImageToggle');
    const splitImageOption = document.getElementById('splitImageOption');
    const previewSwitcher = document.getElementById('previewSwitcher');
    const previewBtns = document.querySelectorAll('.preview-switch-btn');
    const ratioSelect = document.getElementById('ratioSelect');
    const layoutSelect = document.getElementById('layoutSelect');
    const textModeSelect = document.getElementById('textModeSelect');
    const customSubjectColorField = document.getElementById('customSubjectColorField');
    const accentColorInput = document.getElementById('accentColor');
    const titleColorInput = document.getElementById('titleColor');
    const subtextColorInput = document.getElementById('subtextColor');
    const timeColorInput = document.getElementById('timeColor');
    const subjectColorInput = document.getElementById('subjectColor');
    const glassOpacitySelect = document.getElementById('glassOpacity');
    const overlaySelect = document.getElementById('overlaySelect');
    const removeBgBtn = document.getElementById('removeBgBtn');
    let canvas = document.getElementById('mainCanvas');
    let logicalW=1920,logicalH=1080,renderScale=1;
    let ctx = canvas.getContext('2d');
    const root = document.documentElement;

    // Phục hồi cài đặt từ LocalStorage
    titleInput.value = appSettings.title || safeGet('tkb_title', "THỜI KHÓA BIỂU 12A5");
    subInput.value = appSettings.sub !== undefined ? appSettings.sub : safeGet('tkb_sub', "Năm học 2026 - 2027 • Lớp 12A5");
    if (appSettings.accent) accentColorInput.value = appSettings.accent;
    if (appSettings.titleColor) titleColorInput.value = appSettings.titleColor;
    if (appSettings.subtextColor) subtextColorInput.value = appSettings.subtextColor;
    if (appSettings.timeColor) timeColorInput.value = appSettings.timeColor;
    if (appSettings.subjectColor) subjectColorInput.value = appSettings.subjectColor;
    ratioSelect.value = appSettings.ratio || '16:9';
    if (appSettings.layout) layoutSelect.value = appSettings.layout;
    if (appSettings.textMode) textModeSelect.value = appSettings.textMode;
    if (appSettings.glassOpacity) glassOpacitySelect.value = appSettings.glassOpacity;
    if (appSettings.overlay) overlaySelect.value = appSettings.overlay;
    afternoonToggle.checked = hasAfternoon;
    splitImageToggle.checked = isSplitMode;

    root.style.setProperty('--accent-color', accentColorInput.value);
    customSubjectColorField.style.display = textModeSelect.value === 'custom' ? 'flex' : 'none';

    function saveAllSettings() {
      const settings = {
        title: titleInput.value,
        sub: subInput.value,
        accent: accentColorInput.value,
        titleColor: titleColorInput.value,
        subtextColor: subtextColorInput.value,
        timeColor: timeColorInput.value,
        subjectColor: subjectColorInput.value,
        ratio: ratioSelect.value,
        layout: layoutSelect.value,
        textMode: textModeSelect.value,
        glassOpacity: glassOpacitySelect.value,
        overlay: overlaySelect.value,
        hasAfternoon: hasAfternoon,
        isSplitMode: isSplitMode
      };
      safeSet('tkb_settings', settings);
    }

    function updateSplitUI() {
      splitImageOption.style.display = hasAfternoon ? 'flex' : 'none';
      if (!hasAfternoon) {
        isSplitMode = false;
        splitImageToggle.checked = false;
      }
      previewSwitcher.style.display = (hasAfternoon && isSplitMode) ? 'flex' : 'none';
    }
    updateSplitUI();

    // ==========================================
    // 3. XỬ LÝ SỰ KIỆN GIAO DIỆN & TABS
    // ==========================================
    const toggleBarBtn = document.getElementById('toggleBar');
    const toolBox = document.getElementById('toolBox');
    toggleBarBtn.onclick = () => {
      const isHidden = toolBox.style.display === 'none';
      toolBox.style.display = isHidden ? 'flex' : 'none';
      toggleBarBtn.classList.toggle('active', isHidden);
    };

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = document.getElementById(tab.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      };
    });

    titleInput.oninput = () => { saveAllSettings(); draw(); };
    subInput.oninput = () => { saveAllSettings(); draw(); };
    afternoonToggle.onchange = () => {
      hasAfternoon = afternoonToggle.checked;
      updateSplitUI();
      saveAllSettings();
      renderQuickEditor();
      draw();
    };
    splitImageToggle.onchange = () => {
      isSplitMode = splitImageToggle.checked;
      updateSplitUI();
      saveAllSettings();
      draw();
    };
    previewBtns.forEach(btn => {
      btn.onclick = () => {
        previewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPreviewView = btn.dataset.view;
        draw();
      };
    });

    ratioSelect.onchange = () => { saveAllSettings(); draw(); };
    
    layoutSelect.addEventListener('change', (e) => {
      const styleTab = document.querySelector('.nav-tab[data-tab="tab-style"]');
      if (e.target.value === 'basic') {
        styleTab.style.display = 'none';
        if (styleTab.classList.contains('active')) {
          document.querySelector('.nav-tab[data-tab="tab-layout"]').click();
        }
      } else {
        styleTab.style.display = '';
      }
      saveAllSettings();
      draw();
    });

    textModeSelect.onchange = () => {
      customSubjectColorField.style.display = textModeSelect.value === 'custom' ? 'flex' : 'none';
      saveAllSettings();
      draw();
    };
    accentColorInput.oninput = (e) => {
      root.style.setProperty('--accent-color', e.target.value);
      saveAllSettings();
      draw();
    };
    titleColorInput.oninput = () => { saveAllSettings(); draw(); };
    subtextColorInput.oninput = () => { saveAllSettings(); draw(); };
    timeColorInput.oninput = () => { saveAllSettings(); draw(); };
    subjectColorInput.oninput = () => { saveAllSettings(); draw(); };
    glassOpacitySelect.onchange = () => { saveAllSettings(); draw(); };
    overlaySelect.onchange = () => { saveAllSettings(); draw(); };

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.onclick = () => {
        accentColorInput.value = btn.dataset.color;
        root.style.setProperty('--accent-color', btn.dataset.color);
        saveAllSettings();
        draw();
      };
    });

    // Ảnh nền với IndexedDB
    let bgLoadVersion=0;
    document.getElementById('bgInput').addEventListener('change',async (e)=>{
      const file=e.target.files[0];if(!file)return;
      const version=++bgLoadVersion;
      if(file.size>15*1024*1024 || !/^image\//.test(file.type)){notifyTKB('Chọn ảnh dưới 15 MB.');e.target.value='';return;}
      let sourceURL=null;
      try {
        sourceURL=URL.createObjectURL(file);
        const source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Không đọc được ảnh. Hãy chọn JPG, PNG hoặc WebP.'));img.src=sourceURL;});
        if(source.width*source.height>50000000)throw Error('Ảnh quá lớn. Hãy chọn ảnh dưới 50 megapixel.');
        let blob=file;
        if(Math.max(source.width,source.height)>2560){
          const resize=document.createElement('canvas'),scale=2560/Math.max(source.width,source.height);
          resize.width=Math.round(source.width*scale);resize.height=Math.round(source.height*scale);
          resize.getContext('2d').drawImage(source,0,0,resize.width,resize.height);
          blob=await new Promise((res,rej)=>resize.toBlob(b=>b?res(b):rej(Error('Không xử lý được ảnh.')),'image/png'));
          resize.width=resize.height=1;
        }
        if(version!==bgLoadVersion)return;
        const nextURL=URL.createObjectURL(blob);
        const next=await new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>{URL.revokeObjectURL(nextURL);rej(Error('Không tải được ảnh đã xử lý.'));};img.src=nextURL;});
        if(version!==bgLoadVersion){URL.revokeObjectURL(nextURL);return;}
        if(currentBgObjectUrl)URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl=nextURL;loadedBgImg=next;bgImgVersion++;removeBgBtn.style.display='block';draw();
        await assetOp('custom_bg',blob);notifyTKB('Đã lưu ảnh nền trong trình duyệt.');
      }catch(err){notifyTKB(err.message || 'Không lưu được ảnh nền.');}
      finally{if(sourceURL)URL.revokeObjectURL(sourceURL);e.target.value='';}
    });

    removeBgBtn.onclick = () => {
      bgLoadVersion++;
      removeBgImageFromDB();
      if (currentBgObjectUrl) {
        URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = null;
      }
      if (loadedBgImg && loadedBgImg.src && loadedBgImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(loadedBgImg.src);
      }
      loadedBgImg = null;
      document.getElementById('bgInput').value = '';
      document.documentElement.style.setProperty('--sync-bg', 'none');
      document.documentElement.style.setProperty('--sync-overlay', '0');
      removeBgBtn.style.display = 'none';
      bgImgVersion++;
      draw();
    };

    // Tự động tải ảnh từ IndexedDB khi mở trang
    loadBgImageFromDB().then((imgData) => {
      if (imgData && bgLoadVersion===0) {
        const isBlob = imgData instanceof Blob;
        if (currentBgObjectUrl) URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = isBlob ? URL.createObjectURL(imgData) : imgData;
        
        loadedBgImg = new Image();
        loadedBgImg.onload = () => {
          removeBgBtn.style.display = 'block';
          draw();
        };
        loadedBgImg.src = currentBgObjectUrl;
        document.documentElement.style.setProperty('--sync-bg', `url("${currentBgObjectUrl}")`);
        document.documentElement.style.setProperty('--sync-overlay', '0.75');
        bgImgVersion++;
      }
    });

    // ==========================================
    // 3B. MODULE ÂM THANH NỀN & HIỆU ỨNG (AUDIO & PARTICLES)
    // ==========================================
    const bgMusic = document.getElementById('bgMusic');
    const audioInput = document.getElementById('audioInput');
    const removeAudioBtn = document.getElementById('removeAudioBtn');
    const audioFileName = document.getElementById('audioFileName');
    const audioVolume = document.getElementById('audioVolume');
    const effectSelect = document.getElementById('effectSelect');
    const effectCanvas = document.getElementById('effectCanvas');
    const effectCtx = effectCanvas ? effectCanvas.getContext('2d') : null;

    let currentAudioUrl = null;

    // Cài đặt âm lượng
    const savedAudioVolume = safeGet('tkb_audio_volume', 0.5);
    if (audioVolume) {
      audioVolume.value = savedAudioVolume;
      if (bgMusic) bgMusic.volume = parseFloat(savedAudioVolume);
      audioVolume.oninput = () => {
        const vol = parseFloat(audioVolume.value);
        if (bgMusic) bgMusic.volume = vol;
        safeSet('tkb_audio_volume', vol);
      };
    }

    function setAudioSource(fileOrBlob, fileName) {
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      if (fileOrBlob && bgMusic) {
        currentAudioUrl = URL.createObjectURL(fileOrBlob);
        bgMusic.src = currentAudioUrl;
        bgMusic.play().catch(() => {});
        if (removeAudioBtn) removeAudioBtn.style.display = 'inline-block';
        if (audioFileName) audioFileName.textContent = fileName || fileOrBlob.name || 'Đã tải tệp nhạc';
      } else if (bgMusic) {
        bgMusic.pause();
        bgMusic.src = '';
        if (removeAudioBtn) removeAudioBtn.style.display = 'none';
        if (audioFileName) audioFileName.textContent = 'Chưa chọn bài nào';
      }
    }

    if (audioInput) {
      audioInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file && file.size>30*1024*1024){notifyTKB('Chọn tệp nhạc dưới 30 MB.');return;}
        if (file) {
          saveAudioToDB(file);
          setAudioSource(file, file.name);
        }
      });
    }

    if (removeAudioBtn) {
      removeAudioBtn.onclick = () => {
        removeAudioFromDB();
        setAudioSource(null);
        if (audioInput) audioInput.value = '';
      };
    }

    // Tự động tải nhạc nền từ IndexedDB khi mở trang
    loadAudioFromDB().then((audioData) => {
      if (audioData) {
        const isBlob = audioData instanceof Blob;
        if (isBlob) {
          setAudioSource(audioData, audioData.name || 'Nhạc nền đã lưu');
        }
      }
    });

    // Xử lý Autoplay Policy: Mở khóa phát nhạc khi người dùng tương tác lần đầu
    function unlockAudio() {
      if (bgMusic && bgMusic.src && bgMusic.paused) {
        bgMusic.play().catch(() => {});
      }
    }
    document.addEventListener('pointerup', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    // HỆ THỐNG HẠT HIỆU ỨNG NỀN (PARTICLE SYSTEM)
    const EffectEngine = {
      canvas: effectCanvas,
      ctx: effectCtx,
      rafId: null,
      currentEffect: 'none',
      isPaused: false,
      particles: [],

      init() {
        if (!this.canvas || !this.ctx) return;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        const initialEffect = safeGet('tkb_effect', 'none');
        if (effectSelect) effectSelect.value = initialEffect;
        this.setEffect(initialEffect);
      },

      resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      },

      setEffect(type) {
        this.currentEffect = type;
        this.particles = [];
        if (type === 'none' || this.isPaused) {
          this.stop();
          if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          }
          return;
        }

        const count = type === 'sakura' ? 60 : 120;
        const w = this.canvas.width || window.innerWidth;
        const h = this.canvas.height || window.innerHeight;

        for (let i = 0; i < count; i++) {
          this.particles.push(this.createParticle(type, w, h, true));
        }

        this.start();
      },

      createParticle(type, w, h, randomizeY = false) {
        if (type === 'sakura') {
          return {
            x: Math.random() * w,
            y: randomizeY ? Math.random() * h : -25,
            r: Math.random() * 6 + 5,
            speedY: Math.random() * 1.5 + 1.2,
            wind: Math.random() * 1.2 - 0.2,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: Math.random() * 0.03 + 0.015,
            oscAmplitude: Math.random() * 1.6 + 0.8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            scaleX: Math.random() * 0.4 + 0.6,
            color: `rgba(255, ${Math.floor(Math.random() * 25 + 180)}, ${Math.floor(Math.random() * 25 + 195)}, ${Math.random() * 0.35 + 0.55})`
          };
        } else if (type === 'rain') {
          return {
            x: Math.random() * (w + 120) - 60,
            y: randomizeY ? Math.random() * h : -40,
            len: Math.random() * 20 + 16,
            width: Math.random() * 1.2 + 0.8,
            speedY: Math.random() * 8 + 18,
            slant: -2.5,
            color: `rgba(255, 255, 255, ${Math.random() * 0.25 + 0.15})`
          };
        }
      },

      start() {
        if (this.rafId || this.currentEffect === 'none' || this.isPaused) return;
        let last=0;
        const loop = (now) => {
          if(now-last>=33){this.updateAndDraw();last=now;}
          this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
      },

      stop() {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      },

      pause() {
        this.isPaused = true;
        this.stop();
      },

      resume() {
        this.isPaused = false;
        if (this.currentEffect !== 'none') {
          this.start();
        }
      },

      updateAndDraw() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        const type = this.currentEffect;
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (type === 'sakura') {
            p.angle += p.angleSpeed;
            p.x += Math.sin(p.angle) * p.oscAmplitude + p.wind;
            p.y += p.speedY;
            p.rotation += p.rotationSpeed;

            if (p.y > h + 25 || p.x < -35 || p.x > w + 35) {
              this.particles[i] = this.createParticle('sakura', w, h, false);
              continue;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.scale(p.scaleX, 1);
            this.ctx.beginPath();
            // Vẽ cánh hoa anh đào chân thực (có rãnh khuyết ở đầu)
            this.ctx.moveTo(0, p.r * -0.4);
            this.ctx.bezierCurveTo(p.r * 0.6, p.r * -1.2, p.r * 1.5, p.r * 0.2, 0, p.r * 1.2);
            this.ctx.bezierCurveTo(p.r * -1.5, p.r * 0.2, p.r * -0.6, p.r * -1.2, 0, p.r * -0.4);
            this.ctx.closePath();
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
            this.ctx.restore();
          } else if (type === 'rain') {
            p.x += p.slant * (p.speedY / 20);
            p.y += p.speedY;

            if (p.y > h + 30) {
              this.particles[i] = this.createParticle('rain', w, h, false);
              continue;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x + p.slant, p.y + p.len);
            this.ctx.strokeStyle = p.color;
            this.ctx.lineWidth = p.width;
            this.ctx.stroke();
          }
        }
      }
    };

    window.EffectEngine = EffectEngine;
    EffectEngine.init();

    if (effectSelect) {
      effectSelect.onchange = () => {
        const val = effectSelect.value;
        safeSet('tkb_effect', val);
        EffectEngine.setEffect(val);
      };
    }

    // ==========================================
    // 4. DANH SÁCH MÔN HỌC & ICON
    // ==========================================
    const pureSubjects = [
      { s: "Trống", empty: true },
      { s: "Toán" }, { s: "Ngữ văn" }, { s: "Tiếng Anh" },
      { s: "Vật lý" }, { s: "Hoá học" }, { s: "Sinh học" },
      { s: "Lịch sử" }, { s: "Địa lý" }, { s: "GDKT & PL" },
      { s: "Tin học" }, { s: "Thể dục" }, { s: "Công nghệ" },
      { s: "HĐTN" }, { s: "GDQP-AN" }, { s: "Chào cờ" }, { s: "SHL" },
      { s: "Tự học" }, { s: "Bồi dưỡng" }, { s: "Trải nghiệm hướng nghiệp" }, { s: "Giáo dục địa phương" }
    ];

    const getSubjectIcon = (sub) => {
      if (!sub || sub === '-' || sub === 'Trống') return '⚪';
      const s = sub.toLowerCase();
      if (s.includes('toán')) return '📐';
      if (s.includes('văn')) return '📖';
      if (s.includes('anh')) return '🌎';
      if (s.includes('lý') && !s.includes('địa')) return '⚡';
      if (s.includes('hoá') || s.includes('hóa')) return '🧪';
      if (s.includes('sinh') && !s.includes('shl')) return '🧬';
      if (s.includes('sử')) return '⏳';
      if (s.includes('địa')) return '🌍';
      if (s.includes('gdkt') || s.includes('pháp luật') || s.includes('pl')) return '⚖️';
      if (s.includes('tin')) return '💻';
      if (s.includes('thể dục') || s.includes('td')) return '⚽';
      if (s.includes('công nghệ') || s.includes('cn')) return '🛠️';
      if (s.includes('hđtn') || s.includes('trải nghiệm')) return '🎯';
      if (s.includes('gdqp')) return '🛡️';
      if (s.includes('chào cờ')) return '🇻🇳';
      if (s.includes('shl') || s.includes('sinh hoạt')) return '👥';
      if (s.includes('tự học')) return '✍️';
      if (s.includes('bồi dưỡng')) return '⭐';
      if (s.includes('trải nghiệm hướng nghiệp')) return '🧭';
      if (s.includes('địa phương')) return '📍';
      return '📘';
    };

    const getSubjectColor = (sub, defaultAccent) => {
      if (!sub || sub === '-' || sub === 'Trống') return 'rgba(255, 255, 255, 0.25)';
      const s = sub.toLowerCase();
      if (s.includes('toán')) return '#0ea5e9';
      if (s.includes('văn')) return '#f43f5e';
      if (s.includes('anh')) return '#a855f7';
      if (s.includes('lý') && !s.includes('địa')) return '#f59e0b';
      if (s.includes('hoá') || s.includes('hóa')) return '#10b981';
      if (s.includes('sinh') && !s.includes('shl')) return '#ec4899';
      if (s.includes('sử')) return '#f97316';
      if (s.includes('địa')) return '#06b6d4';
      if (s.includes('gdkt') || s.includes('pháp luật') || s.includes('pl')) return '#8b5cf6';
      if (s.includes('tin')) return '#6366f1';
      if (s.includes('thể dục') || s.includes('td')) return '#22c55e';
      if (s.includes('công nghệ') || s.includes('cn')) return '#14b8a6';
      if (s.includes('hđtn') || s.includes('trải nghiệm')) return '#eab308';
      if (s.includes('gdqp')) return '#ef4444';
      if (s.includes('chào cờ')) return '#dc2626';
      if (s.includes('shl') || s.includes('sinh hoạt')) return '#0284c7';
      if (s.includes('tự học')) return '#64748b';
      if (s.includes('bồi dưỡng')) return '#e11d48';
      if (s.includes('trải nghiệm hướng nghiệp')) return '#eab308';
      if (s.includes('địa phương')) return '#14b8a6';
      return defaultAccent || '#0ea5e9';
    };

    document.querySelectorAll('.day-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentActiveDay = parseInt(tab.dataset.day);
        renderQuickEditor();
      };
    });


    function addPeriodForDay(session, dayIndex) {
      const daysFull = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];
      const targetData = session === 'morning' ? morningData : afternoonData;
      let targetRowIndex = -1;
      for (let r = 0; r < targetData.length; r++) {
        if (targetData[r].d[dayIndex] === null || targetData[r].d[dayIndex] === undefined) {
          targetRowIndex = r;
          break;
        }
      }

      if (targetRowIndex === -1) {
        if(targetData.length>=30){notifyTKB('Tối đa 30 tiết mỗi buổi.');return;}
        const newPeriodNum = session === 'morning' ? String(targetData.length + 1) : ("C" + (targetData.length + 1));
        const newRow = {
          p: String(newPeriodNum),
          d: [null, null, null, null, null]
        };
        newRow.d[dayIndex] = { s: "-", t: "" };
        targetData.push(newRow);
        targetRowIndex = targetData.length - 1;
      } else {
        targetData[targetRowIndex].d[dayIndex] = { s: "-", t: "" };
      }

      safeSet(session === 'morning' ? 'tkb_morning' : 'tkb_afternoon', targetData);
      renderQuickEditor();
      draw();

      openPicker(session, targetRowIndex, dayIndex, daysFull[dayIndex]);
    }

    function deletePeriod(session, rIdx, dayIndex) {
      const targetData = session === 'morning' ? morningData : afternoonData;
      const defaultLength = session === 'morning' ? 4 : 3;
      if (rIdx >= 0 && rIdx < targetData.length) {
        if (rIdx >= defaultLength) {
          targetData[rIdx].d[dayIndex] = null;
          const allNull = targetData[rIdx].d.every(item => item === null || item === undefined);
          if (allNull) {
            targetData.splice(rIdx, 1);
          }
        } else {
          targetData[rIdx].d[dayIndex] = { s: "-", t: "" };
        }
        safeSet(session === 'morning' ? 'tkb_morning' : 'tkb_afternoon', targetData);
        renderQuickEditor();
        draw();
      }
    }

    function renderQuickEditor() {
      const daysFull = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];
      const list = document.getElementById('periodsEditorList');
      list.innerHTML = '';

      const renderRow = (r, rIdx, session) => {
        const dayItem = r.d[currentActiveDay];
        if (dayItem === null || dayItem === undefined) return;
        const isEmpty = !dayItem || dayItem.s === '-' || dayItem.s === '' || dayItem.s === 'Trống';
        const card = document.createElement('div');
        card.className = 'period-card';
        
        const icon = getSubjectIcon(isEmpty ? '' : dayItem.s);
        
        card.innerHTML = `
          <div class="period-info">
            <div class="period-icon-box">${icon}</div>
            <div class="period-details">
              <div class="period-row-title">
                <span class="period-tag">Tiết ${escapeText(r.p)}</span>
                <span class="period-subject ${isEmpty ? 'empty' : ''}">${isEmpty ? 'Chưa có môn' : escapeText(dayItem.s)}</span>
              </div>
              ${dayItem && dayItem.t ? `<span class="period-teacher">👤 ${escapeText(dayItem.t)}</span>` : '<span class="period-teacher" style="opacity:0.35;">Chưa có giáo viên</span>'}
            </div>
          </div>
          <div class="period-actions">
            <button class="btn-icon btn-edit" title="Sửa môn">✏️</button>
            <button class="btn-icon btn-delete" title="Xóa môn">🗑️</button>
          </div>
        `;
        
        card.querySelector('.btn-edit').onclick = (e) => { e.stopPropagation(); openPicker(session, rIdx, currentActiveDay, daysFull[currentActiveDay]); };
        card.querySelector('.btn-delete').onclick = (e) => { 
          e.stopPropagation(); 
          deletePeriod(session, rIdx, currentActiveDay);
        };
        card.onclick = () => openPicker(session, rIdx, currentActiveDay, daysFull[currentActiveDay]);
        list.appendChild(card);
      };

      const mHeader = document.createElement('div');
      mHeader.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin:6px 0 2px;letter-spacing:1px;';
      mHeader.innerText = '🌤️ BUỔI SÁNG';
      list.appendChild(mHeader);

      morningData.forEach((r, rIdx) => renderRow(r, rIdx, 'morning'));

      const addMBtn = document.createElement('button');
      addMBtn.className = 'btn-add-period';
      addMBtn.innerHTML = `➕ Thêm tiết sáng (${daysFull[currentActiveDay]})`;
      addMBtn.onclick = () => addPeriodForDay('morning', currentActiveDay);
      list.appendChild(addMBtn);

      if (hasAfternoon) {
        const aHeader = document.createElement('div');
        aHeader.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin:14px 0 2px;letter-spacing:1px;';
        aHeader.innerText = '🌥️ BUỔI CHIỀU';
        list.appendChild(aHeader);
        afternoonData.forEach((r, rIdx) => renderRow(r, rIdx, 'afternoon'));

        const addABtn = document.createElement('button');
        addABtn.className = 'btn-add-period';
        addABtn.innerHTML = `➕ Thêm tiết chiều (${daysFull[currentActiveDay]})`;
        addABtn.onclick = () => addPeriodForDay('afternoon', currentActiveDay);
        list.appendChild(addABtn);
      }
    }
    
    function renderSubjectPicker() {
      const pickerWrap = document.getElementById('subjectPicker');
      pickerWrap.innerHTML = '';
      
      const allSubjs = [...pureSubjects];
      customSubjectsList.forEach((cs) => {
        allSubjs.push({ s: cs, isCustom: true });
      });

      allSubjs.forEach(item => {
        let b = document.createElement('button');
        b.className = 'subj-btn' + (item.empty ? ' btn-empty' : '');
        const icon = getSubjectIcon(item.s);
        b.innerHTML = `<span style="font-size:18px">${icon}</span><span>${escapeText(item.s)}</span>`;

        if (item.isCustom) {
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-del-custom';
          delBtn.innerHTML = '✕';
          delBtn.title = 'Xóa môn tự tạo';
          delBtn.onclick = (e) => {
            e.stopPropagation();
            customSubjectsList = customSubjectsList.filter(c => c !== item.s);
            safeSet('tkb_custom_subjects', customSubjectsList);
            renderSubjectPicker();
          };
          b.appendChild(delBtn);
        }

        b.onclick = () => {
          if (selectedCell) {
            const targetArr = selectedCell.session === 'morning' ? morningData : afternoonData;
            const tName = document.getElementById('customTeacher').value.trim();
            targetArr[selectedCell.r].d[selectedCell.d] = item.empty ? { s: "-", t: "" } : { s: item.s, t: tName };
            safeSet(selectedCell.session === 'morning' ? 'tkb_morning' : 'tkb_afternoon', targetArr);
            closePicker();
          }
        };
        pickerWrap.appendChild(b);
      });
    }

    function openPicker(session, rIdx, dIdx, dayName) {
      selectedCell = { session, r: rIdx, d: dIdx };
      const row = session === 'morning' ? morningData[rIdx] : afternoonData[rIdx];
      if (!row || dIdx < 0 || dIdx > 4) { selectedCell = null; return; }
      if (!row.d[dIdx]) row.d[dIdx] = {s:'-',t:''};
      document.getElementById('drawerTarget').innerText = `${dayName} — Tiết ${row.p} (${session === 'morning' ? 'Sáng' : 'Chiều'})`;
      document.getElementById('customTeacher').value = (session === 'morning' ? morningData[rIdx].d[dIdx].t : afternoonData[rIdx].d[dIdx].t) || '';
      document.getElementById('drawerMask').style.display = 'block';
      document.getElementById('subjectDrawer').style.display = 'block';
    }

    function closePicker() {
      selectedCell = null;
      document.getElementById('drawerMask').style.display = 'none';
      document.getElementById('subjectDrawer').style.display = 'none';
      renderQuickEditor();
      draw();
    }
    document.getElementById('closeDrawer').onclick = closePicker;
    document.getElementById('drawerMask').onclick = closePicker;

    renderSubjectPicker();

    document.getElementById('addCustomBtn').onclick = () => {
      const s = document.getElementById('customSubject').value.trim();
      const t = document.getElementById('customTeacher').value.trim();
      if (s && selectedCell) {
        if (!customSubjectsList.includes(s) && !pureSubjects.some(p => p.s.toLowerCase() === s.toLowerCase())) {
          if(customSubjectsList.length>=200){notifyTKB('Đã có 200 môn tự tạo. Xóa bớt một môn trước khi thêm.');return;}
          customSubjectsList.push(s);
          safeSet('tkb_custom_subjects', customSubjectsList);
          renderSubjectPicker();
        }
        const targetArr = selectedCell.session === 'morning' ? morningData : afternoonData;
        targetArr[selectedCell.r].d[selectedCell.d] = { s: s, t: t };
        safeSet(selectedCell.session === 'morning' ? 'tkb_morning' : 'tkb_afternoon', targetArr);
        document.getElementById('customSubject').value = '';
        document.getElementById('customTeacher').value = '';
        closePicker();
      }
    };

  // A gesture opens the picker only at click, never at pointerup/touchend.
  // This prevents the remainder of the opening gesture from choosing a subject.
  function handleCanvasTap(e) {
    if (window.isExporting || selectedCell || e.button > 0) return;
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle ? window.getComputedStyle(canvas) : {};
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const width = rect.width - borderLeft - borderRight;
    const height = rect.height - borderTop - borderBottom;
    const scale = Math.min(width / logicalW, height / logicalH);
    if (!(scale > 0)) return;
    const x = (e.clientX - rect.left - borderLeft - (width - logicalW * scale) / 2) / scale;
    const y = (e.clientY - rect.top - borderTop - (height - logicalH * scale) / 2) / scale;
    if (x < 0 || x > logicalW || y < 0 || y > logicalH) return;
    for (let i = hitBoxes.length - 1; i >= 0; i--) {
      const box = hitBoxes[i];
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        if (box.isAddBtn) addPeriodForDay(box.session, box.d);
        else openPicker(box.session, box.r, box.d, box.dayName);
        break;
      }
    }
  }
  let canvasGesture = null;
  function beginCanvasGesture(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    if (canvasGesture && !canvasGesture.ended) canvasGesture.cancelled = true;
    else canvasGesture = { x: t.clientX, y: t.clientY, id: e.pointerId,
      cancelled: e.isPrimary === false || e.button > 0, ended: false };
    if (e.touches && e.touches.length !== 1) canvasGesture.cancelled = true;
  }
  function moveCanvasGesture(e) {
    if (!canvasGesture || canvasGesture.ended) return;
    const t = e.touches ? e.touches[0] : e;
    if (!t || (e.touches && e.touches.length !== 1) ||
        Math.abs(t.clientX - canvasGesture.x) > 10 ||
        Math.abs(t.clientY - canvasGesture.y) > 10) canvasGesture.cancelled = true;
  }
  function endCanvasGesture(e) {
    if (!canvasGesture) return;
    if (!e.touches) moveCanvasGesture(e);
    canvasGesture.ended = true;
  }
  function cancelCanvasGesture() {
    if (canvasGesture) { canvasGesture.cancelled = true; canvasGesture.ended = true; }
  }
  function cancelActiveCanvasGesture() {
    // Touch pointers leave the element after a normal pointerup, before click.
    // Only cancel a gesture that is still being held.
    if (canvasGesture && !canvasGesture.ended) cancelCanvasGesture();
  }
  function onCanvasClick(e) {
    const gesture = canvasGesture;
    canvasGesture = null;
    if (gesture && gesture.cancelled) return;
    handleCanvasTap(e);
  }
  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', beginCanvasGesture);
    canvas.addEventListener('pointermove', moveCanvasGesture);
    canvas.addEventListener('pointerup', endCanvasGesture);
    canvas.addEventListener('pointercancel', cancelCanvasGesture);
    canvas.addEventListener('pointerleave', cancelActiveCanvasGesture);
  } else {
    canvas.addEventListener('touchstart', beginCanvasGesture, { passive: true });
    canvas.addEventListener('touchmove', moveCanvasGesture, { passive: true });
    canvas.addEventListener('touchend', endCanvasGesture, { passive: true });
    canvas.addEventListener('touchcancel', cancelCanvasGesture);
    canvas.addEventListener('mousedown', beginCanvasGesture);
    canvas.addEventListener('mousemove', moveCanvasGesture);
    canvas.addEventListener('mouseup', endCanvasGesture);
    canvas.addEventListener('mouseleave', cancelActiveCanvasGesture);
  }
  canvas.addEventListener('click', onCanvasClick);
  // Scrolling cancels an in-progress tap without disabling normal page gestures.
  window.addEventListener('scroll', cancelActiveCanvasGesture, true);

    function getPeriodTime(session, p) {
      const cleanP = String(p).replace('C', '');
      const isAft = session === 'afternoon' || String(p).startsWith('C');
      if (!isAft) {
        const mTimes = { "1": "07:00 - 07:45", "2": "07:50 - 08:35", "3": "08:45 - 09:30", "4": "09:35 - 10:20", "5": "10:25 - 11:10", "6": "11:15 - 12:00" };
        return mTimes[cleanP] || "Chưa đặt giờ";
      } else {
        const aTimes = { "1": "13:00 - 13:45", "2": "13:50 - 14:35", "3": "14:45 - 15:30", "4": "15:35 - 16:20", "5": "16:25 - 17:10" };
        return aTimes[cleanP] || "Chưa đặt giờ";
      }
    }

    function drawVectorSubjectIcon(ctx, sub, cx, cy, size, color) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const s = (sub || '').toLowerCase();
      const r = size / 2;

      if (s.includes('toán')) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, r * 0.7);
        ctx.lineTo(r * 0.7, r * 0.7);
        ctx.lineTo(-r * 0.7, -r * 0.7);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, r * 0.35);
        ctx.lineTo(r * 0.2, r * 0.35);
        ctx.lineTo(-r * 0.35, -0.2 * r);
        ctx.closePath();
        ctx.stroke();
      } else if (s.includes('văn')) {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.6);
        ctx.lineTo(0, -r * 0.4);
        ctx.quadraticCurveTo(-r * 0.4, -r * 0.65, -r * 0.8, -r * 0.4);
        ctx.lineTo(-r * 0.8, r * 0.4);
        ctx.quadraticCurveTo(-r * 0.4, r * 0.2, 0, r * 0.6);
        ctx.quadraticCurveTo(r * 0.4, r * 0.2, r * 0.8, r * 0.4);
        ctx.lineTo(r * 0.8, -r * 0.4);
        ctx.quadraticCurveTo(r * 0.4, -r * 0.65, 0, -r * 0.4);
        ctx.stroke();
      } else if (s.includes('lý') && !s.includes('địa')) {
        ctx.beginPath();
        ctx.moveTo(r * 0.1, -r * 0.8);
        ctx.lineTo(-r * 0.4, r * 0.05);
        ctx.lineTo(0, r * 0.05);
        ctx.lineTo(-r * 0.15, r * 0.8);
        ctx.lineTo(r * 0.5, -0.05 * r);
        ctx.lineTo(0.1 * r, -0.05 * r);
        ctx.closePath();
        ctx.stroke();
      } else if (s.includes('hoá') || s.includes('hóa')) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.8);
        ctx.lineTo(r * 0.2, -r * 0.8);
        ctx.moveTo(-r * 0.15, -r * 0.8);
        ctx.lineTo(-r * 0.15, -r * 0.35);
        ctx.lineTo(-r * 0.7, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.7, r * 0.8, -r * 0.5, r * 0.8);
        ctx.lineTo(r * 0.5, r * 0.8);
        ctx.quadraticCurveTo(r * 0.7, r * 0.8, r * 0.7, r * 0.65);
        ctx.lineTo(r * 0.15, -r * 0.35);
        ctx.lineTo(r * 0.15, -r * 0.8);
        ctx.stroke();
      } else if (s.includes('tin')) {
        roundRect(ctx, -r * 0.75, -r * 0.65, r * 1.5, r * 1.05, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.4);
        ctx.lineTo(0, r * 0.75);
        ctx.moveTo(-r * 0.35, r * 0.75);
        ctx.lineTo(r * 0.35, r * 0.75);
        ctx.stroke();
      } else if (s.includes('sử')) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.7);
        ctx.lineTo(r * 0.6, -r * 0.7);
        ctx.lineTo(r * 0.6, -r * 0.7);
        ctx.lineTo(r * 0.6, r * 0.7);
        ctx.lineTo(-r * 0.6, r * 0.7);
        ctx.lineTo(r * 0.6, -r * 0.7);
        ctx.stroke();
      } else if (s.includes('địa')) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.35, r * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, 0);
        ctx.lineTo(r * 0.75, 0);
        ctx.stroke();
      } else if (s.includes('anh')) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold ' + Math.round(r * 0.85) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', 0, 1);
      } else if (s.includes('thể dục') || s.includes('td')) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.4, 0, r * 0.4, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.4, 0, r * 0.4, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(a) * (r * 0.7);
          const py = Math.sin(a) * (r * 0.7);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    // ==========================================
    // 5. CÔNG CỤ VẼ CANVAS 2D & LIQUID GLASS
    // ==========================================
    function calculateSmartTextColor(ctx, cx, cy, cw, ch) {
      try {
        if (!loadedBgImg) return { subClr: '#ffffff', tchrClr: '#cbd5e1', shadowClr: 'rgba(0,0,0,0.85)', shadowBlur: 4 };
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 50; tempCanvas.height = 50;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(loadedBgImg, 0, 0, 50, 50);
        const data = tCtx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
        const count = data.length / 4;
        const luma = 0.299 * (r/count) + 0.587 * (g/count) + 0.114 * (b/count);
        if (luma > 165) {
          return { subClr: '#0f172a', tchrClr: '#334155', shadowClr: 'rgba(255, 255, 255, 0.9)', shadowBlur: 3 };
        } else {
          return { subClr: '#ffffff', tchrClr: '#cbd5e1', shadowClr: 'rgba(0, 0, 0, 0.85)', shadowBlur: 5 };
        }
      } catch (e) {
        return { subClr: '#ffffff', tchrClr: '#cbd5e1', shadowClr: 'rgba(0, 0, 0, 0.85)', shadowBlur: 4 };
      }
    }

    function drawDefaultMeshGradient(ctx, w, h) {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);
      const drawSpot = (cx, cy, r, color) => {
        const radGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        radGrd.addColorStop(0, color);
        radGrd.addColorStop(1, 'transparent');
        ctx.fillStyle = radGrd;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      drawSpot(w * 0.1, h * 0.1, Math.max(w, h) * 0.65, 'rgba(14, 165, 233, 0.65)');
      drawSpot(w * 0.9, h * 0.25, Math.max(w, h) * 0.55, 'rgba(139, 92, 246, 0.6)');
      drawSpot(w * 0.35, h * 0.85, Math.max(w, h) * 0.7, 'rgba(236, 72, 153, 0.45)');
      drawSpot(w * 0.85, h * 0.8, Math.max(w, h) * 0.5, 'rgba(16, 185, 129, 0.4)');
    }

    function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    function drawCoverImage(ctx, img, w, h) {
      const imgRatio = img.width / img.height;
      const canvasRatio = w / h;
      let drawW, drawH, drawX, drawY;
      if (imgRatio > canvasRatio) {
        drawH = h; drawW = h * imgRatio;
        drawY = 0; drawX = (w - drawW) / 2;
      } else {
        drawW = w; drawH = w / imgRatio;
        drawX = 0; drawY = (h - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    function drawTextFit(ctx, text, x, y, maxW, size, weight = 'bold', align = 'center') {
      ctx.font = weight + " " + size + "px " + "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const initialWidth = ctx.measureText(text).width;
      if (initialWidth > maxW) {
        const ratio = maxW / initialWidth;
        const currentSize = Math.max(9, Math.floor(size * ratio * 0.95));
        ctx.font = weight + " " + currentSize + "px " + "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
      }
      ctx.fillText(text, x, y);
    }

    function drawLiquidGlassWithDropletRefraction(ctx, x, y, w, h, r, alpha) {
      const isUltraClear = alpha <= 0.03;
      ctx.shadowColor = isUltraClear ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = isUltraClear ? 12 : 24;
      ctx.fillStyle = isUltraClear ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.85)';
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      roundRect(ctx, x, y, w, h, r);
      ctx.clip();

      if (window.__blurredBgCanvas) {
        ctx.drawImage(window.__blurredBgCanvas, x*renderScale, y*renderScale, w*renderScale, h*renderScale, x, y, w, h);
      }

      ctx.save();
      const glassGrd = ctx.createLinearGradient(x, y, x + w, y + h);
      const topAlpha = isUltraClear ? 0.08 : Math.min(alpha * 0.85, 0.45);
      const botAlpha = isUltraClear ? 0.02 : Math.min(alpha * 0.2, 0.12);
      glassGrd.addColorStop(0, `rgba(255,255,255,${topAlpha})`);
      glassGrd.addColorStop(1, `rgba(255,255,255,${botAlpha})`);
      ctx.fillStyle = glassGrd;
      ctx.globalCompositeOperation = 'overlay';
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();

      const edgeGrd = ctx.createLinearGradient(x, y, x + w, y + h);
      edgeGrd.addColorStop(0, isUltraClear ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.5)');
      edgeGrd.addColorStop(0.2, isUltraClear ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.15)');
      edgeGrd.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)');
      edgeGrd.addColorStop(1, isUltraClear ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.25)');
      ctx.strokeStyle = edgeGrd;
      ctx.lineWidth = isUltraClear ? 1 : 1.5;
      ctx.stroke();

      ctx.restore();
    }

    let _drawTimer = null;
    function draw(forceSync = false) {
      if (forceSync) {
        if (_drawTimer) { cancelAnimationFrame(_drawTimer); _drawTimer = null; }
        _draw();
        return;
      }
      if (_drawTimer) cancelAnimationFrame(_drawTimer);
      _drawTimer = requestAnimationFrame(() => {
        _drawTimer = null;
        _draw();
      });
    }

    // ==========================================
    // 6. HÀM VẼ CHÍNH (_DRAW)
    // ==========================================
    function _draw() { 
      hitBoxes = [];
      const ratio = ratioSelect.value;
      const layout = layoutSelect.value;
      const styleTab = document.querySelector('.nav-tab[data-tab="tab-style"]');
      if (layout === 'basic') {
        if (styleTab) styleTab.style.display = 'none';
        if (styleTab && styleTab.classList.contains('active')) {
          document.querySelector('.nav-tab[data-tab="tab-layout"]').click();
        }
      } else {
        if (styleTab) styleTab.style.display = '';
      }
      const accent = accentColorInput.value;
      const glassAlpha = parseFloat(glassOpacitySelect.value);
      const overlay = overlaySelect.value;
      const textMode = textModeSelect.value;
      const ttlClr = titleColorInput.value;
      let manualSubClr = subjectColorInput.value;
      let manualTchrClr = subtextColorInput.value;
      const timeClr = timeColorInput ? timeColorInput.value : '#38bdf8';

      let W = 1080, H = 1920;
      if (ratio === '9:16') { W = 1080; H = 1920; }
      else if (ratio === '3:4') { W = 1200; H = 1600; }
      else if (ratio === '1:1') { W = 2000; H = 2000; }
      else if (ratio === '1:1-std') { W = 1200; H = 1200; }
      else if (ratio === '16:9') { W = 1920; H = 1080; }
      else if (ratio === '16:10') { W = 1920; H = 1200; }
      else if (ratio === '4:3') { W = 1600; H = 1200; }

      logicalW=W; logicalH=H;
      renderScale=window.isExporting?1:Math.min(1,(window.innerWidth<600?600:850)/Math.max(W,H));
      const pw=Math.round(W*renderScale),ph=Math.round(H*renderScale);
      if(canvas.width!==pw)canvas.width=pw;
      if(canvas.height!==ph)canvas.height=ph;
      ctx.setTransform(renderScale,0,0,renderScale,0,0);
      ctx.clearRect(0,0,W,H);
      const isVertical = H > W;

      // 1. Tạo Canvas Blur Background Offscreen Cache
      const currentBgState = W + "x" + H + "-" + renderScale + "-" + glassAlpha + "-" + (loadedBgImg ? "img-" + bgImgVersion : "mesh");
      if (!window.__blurredBgCanvas || window.__lastBgState !== currentBgState) {
        window.__blurredBgCanvas = document.createElement('canvas');
        window.__blurredBgCanvas.width = pw;
        window.__blurredBgCanvas.height = ph;
        window.__lastBgState = currentBgState;
        
        const bCtx = window.__blurredBgCanvas.getContext('2d');
        bCtx.setTransform(renderScale,0,0,renderScale,0,0);
        const isUltraClear = glassAlpha <= 0.03;
        const blurRadius = isUltraClear ? 4 : Math.max(10, Math.round(glassAlpha * 85));
        const satVal = isUltraClear ? "110%" : "135%";
        const brightVal = isUltraClear ? "1.02" : "1.08";
        bCtx.filter = `blur(${blurRadius*renderScale}px) saturate(${satVal}) brightness(${brightVal})`;
        if (loadedBgImg) {
          drawCoverImage(bCtx, loadedBgImg, W, H);
        } else {
          drawDefaultMeshGradient(bCtx, W, H);
        }
        bCtx.filter = 'none';
      }

      // 2. Vẽ nền gốc
      if (loadedBgImg) {
        drawCoverImage(ctx, loadedBgImg, W, H);
      } else {
        drawDefaultMeshGradient(ctx, W, H);
      }

      // 3. Độ tối nền (Giúp chữ nổi bật hơn)
      if (overlay !== 'transparent') {
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, W, H);
      }

      const padX = W * 0.04, padY = H * 0.035;
      const boardW = W - padX * 2, boardH = H - padY * 2;

      // 5. Chuẩn bị Tiêu đề & Phụ đề & Dữ liệu vẽ
      const title = titleInput.value || "THỜI KHÓA BIỂU";
      const rawSub = subInput.value || "";
      let tempHasAfternoon = hasAfternoon;
      let renderMorningData = morningData.map((r,rowIndex)=>({...r,rowIndex,sessionOverride:'morning'}));
      let renderAfternoonData = afternoonData.map((r,rowIndex)=>({...r,rowIndex,sessionOverride:'afternoon'}));
      let displaySub = rawSub;

      if (hasAfternoon && isSplitMode) {
        tempHasAfternoon = false;
        if (currentPreviewView === 'afternoon') {
          renderMorningData = renderAfternoonData;
          displaySub = rawSub ? `${rawSub} • [BUỔI CHIỀU]` : '[BUỔI CHIỀU]';
        } else {
          // Morning metadata is already prepared.
          displaySub = rawSub ? `${rawSub} • [BUỔI SÁNG]` : '[BUỔI SÁNG]';
        }
      }

      const titleBarW = Math.min(boardW * 0.75, 760);
      const titleBarH = Math.round(isVertical ? boardH * 0.082 : boardH * 0.085);
      const titleBarX = (W - titleBarW) / 2;
      const titleBarY = padY + boardH * 0.020;
      let floatingTableTop = null;

      // 4. Khung kính lớn ngoài cùng & Tiêu đề kính (Chỉ vẽ khi KHÔNG PHẢI layout floating)
      if (layout !== 'floating' && layout !== 'basic') {
        drawLiquidGlassWithDropletRefraction(ctx, padX, padY, boardW, boardH, 36, glassAlpha);

        // Card kính nổi cho thanh tiêu đề
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 18;
        roundRect(ctx, titleBarX, titleBarY, titleBarW, titleBarH, 18);
        ctx.fill();
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Vệt sáng kính phía trên thanh tiêu đề
        ctx.save();
        roundRect(ctx, titleBarX, titleBarY, titleBarW, titleBarH, 18);
        ctx.clip();
        const tGrd = ctx.createLinearGradient(titleBarX, titleBarY, titleBarX, titleBarY + titleBarH * 0.55);
        tGrd.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        tGrd.addColorStop(1, 'transparent');
        ctx.fillStyle = tGrd;
        ctx.fillRect(titleBarX, titleBarY, titleBarW, titleBarH);
        ctx.restore();

        // Vẽ chữ tiêu đề & phụ đề
        ctx.fillStyle = ttlClr;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        const titleSize = Math.round(isVertical ? boardW * 0.038 : boardH * 0.036);
        
        if (displaySub) {
          drawTextFit(ctx, title, W / 2, titleBarY + titleBarH * 0.44, titleBarW * 0.9, titleSize, '800');
          ctx.fillStyle = manualTchrClr;
          ctx.shadowBlur = 4;
          const subSize = Math.round(isVertical ? boardW * 0.019 : boardH * 0.019);
          drawTextFit(ctx, displaySub, W / 2, titleBarY + titleBarH * 0.78, titleBarW * 0.9, subSize, '600');
        } else {
          drawTextFit(ctx, title, W / 2, titleBarY + titleBarH * 0.54, titleBarW * 0.9, titleSize, '800');
        }
      } else if (layout === 'floating') {
        // Floating có vùng tiêu đề không khung: tính bảng từ đáy chữ,
        // tránh tiêu đề/phụ đề đè lên hàng Thứ 2–6, kể cả ảnh 16:9.
        const titleSize = Math.round(isVertical ? W * 0.052 : H * 0.056);
        const subSize = Math.round(isVertical ? W * 0.024 : H * 0.028);
        const titleY = padY + titleSize * 0.90;
        const subY = titleY + titleSize * 0.72 + subSize * 0.60 + Math.max(6, H * 0.007);
        const titleBottom = displaySub ? subY + subSize * 0.68 : titleY + titleSize * 0.68;
        const minimumTop = H * (isVertical ? (displaySub ? 0.135 : 0.115) : (displaySub ? 0.16 : 0.13));
        floatingTableTop = Math.max(minimumTop, Math.ceil(titleBottom + Math.max(20, H * 0.022)));
        ctx.save();
        ctx.fillStyle = ttlClr;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 10;
        drawTextFit(ctx, title, W / 2, titleY, W * 0.9, titleSize, '800');
        if (displaySub) {
          ctx.fillStyle = manualTchrClr;
          ctx.shadowBlur = 6;
          drawTextFit(ctx, displaySub, W / 2, subY, W * 0.9, subSize, '600');
        }
        ctx.restore();
      }

      // Vùng hiển thị nội dung các tiết (floating dùng vùng dưới tiêu đề thực tế).
      const contentTop = layout === 'floating' ? floatingTableTop : titleBarY + titleBarH + Math.round(boardH * 0.022);
      const contentBottom = padY + boardH * 0.975;
      const contentH = contentBottom - contentTop;
      const contentW = boardW * 0.95;
      const contentLeft = padX + (boardW - contentW) / 2;

      const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
                        const daysFull = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

                        const drawAddBtnHelper = (x, y, w, h, radius, dash, text, fontSize, textYOffset, session, d) => {
                          if (window.isExporting) return;
                          if(hasAfternoon && isSplitMode)session=currentPreviewView;
                          roundRect(ctx, x, y, w, h, radius);
                          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.fill();
                          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
                          ctx.fillStyle = accent;
                          drawTextFit(ctx, text, x + w / 2, y + textYOffset, w * 0.8, fontSize, 'bold');
                          hitBoxes.push({ isAddBtn: true, session: session, d: d, x: x, y: y, w: w, h: h, dayName: daysFull[d] });
                        };

      // Màu chữ thích ứng (Smart Auto Contrast)
      let currentSubClr = manualSubClr;
      let currentTchrClr = manualTchrClr;
      let currentShadowClr = 'rgba(0,0,0,0.7)';
      let currentShadowBlur = 4;

      if (textMode === 'auto') {
        const smart = calculateSmartTextColor(ctx, contentLeft, contentTop, contentW, contentH);
        currentSubClr = smart.subClr;
        currentTchrClr = smart.tchrClr;
        currentShadowClr = smart.shadowClr;
        currentShadowBlur = smart.shadowBlur;
      }

      // =========================================================================
      // BỐ CỤC 1: THẺ BENTO KÍNH NỔI (BENTO APPLE STYLE)
      // =========================================================================
      const LayoutRenderers = {
      bento: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const bentoTimeClr = timeColorInput ? timeColorInput.value : '#94a3b8';
        if (isVertical) {
          const cardGap = Math.max(10, Math.round(H * 0.008));
          const cardH = (contentH - 4 * cardGap) / 5;

          for (let d = 0; d < 5; d++) {
            const y = contentTop + d * (cardH + cardGap);
            drawLiquidGlassWithDropletRefraction(ctx, contentLeft, y, contentW, cardH, 20, Math.max(glassAlpha + 0.08, 0.16));

            const badgeW = Math.min(contentW * 0.28, 140), badgeH = Math.min(cardH * 0.16, 32);
            ctx.shadowBlur = 0;
            ctx.fillStyle = accent;
            roundRect(ctx, contentLeft + 16, y + 10, badgeW, badgeH, 10); ctx.fill();
            ctx.fillStyle = '#ffffff';
            drawTextFit(ctx, daysFull[d], contentLeft + 16 + badgeW / 2, y + 10 + badgeH / 2, badgeW * 0.85, 14, 'bold');

            const mList = renderMorningData.map((r, rIdx) => ({ session: r.sessionOverride || 'morning', r: rIdx, p: r.p, item: r.d[d] }));
            const aList = tempHasAfternoon ? renderAfternoonData.map((r, rIdx) => ({ session: 'afternoon', r: rIdx, p: r.p, item: r.d[d] })) : [];

            const renderSessionPills = (list, startX, width) => {
              const count = list.length;
              const pGap = 5;
              const addBtnH = 22;
              const topOffset = y + badgeH + 18;
              const availH = cardH - (badgeH + 26) - (addBtnH + 8);
              const pillH = Math.min((availH - (count - 1) * pGap) / Math.max(count, 1), 54);

              list.forEach((entry, idx) => {
                const py = topOffset + idx * (pillH + pGap);
                const isEmpty = !entry.item || entry.item.s === '-' || entry.item.s === '' || entry.item.s === 'Trống';
                const subColor = getSubjectColor(entry.item ? entry.item.s : '', accent);

                hitBoxes.push({ session: entry.session, r: entry.r, d: d, x: startX, y: py, w: width, h: pillH, dayName: daysFull[d] });

                ctx.shadowBlur = 0;
                ctx.fillStyle = isEmpty ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.16)';
                roundRect(ctx, startX, py, width, pillH, 10); ctx.fill();
                ctx.strokeStyle = isEmpty ? 'rgba(255, 255, 255, 0.12)' : (subColor || 'rgba(255, 255, 255, 0.3)');
                ctx.lineWidth = 1; ctx.stroke();

                if (!isEmpty) {
                  ctx.fillStyle = subColor;
                  roundRect(ctx, startX + 3, py + 4, 3.5, pillH - 8, 2); ctx.fill();

                  const iconSize = Math.min(pillH - 8, 26);
                  const iconX = startX + 18;
                  const iconY = py + pillH / 2;
                  drawVectorSubjectIcon(ctx, entry.item.s, iconX, iconY, iconSize, subColor);

                  const pTime = getPeriodTime(entry.session, entry.p);
                  ctx.fillStyle = bentoTimeClr;
                  drawTextFit(ctx, pTime, startX + width - 12, py + 11, width * 0.45, 10, '600', 'right');

                  ctx.shadowColor = currentShadowClr;
                  ctx.shadowBlur = currentShadowBlur;
                  ctx.fillStyle = currentSubClr;
                  const sFont = Math.min(pillH * 0.38, 16);
                  if (entry.item.t) {
                    drawTextFit(ctx, entry.item.s, startX + width / 2, py + pillH * 0.36, width * 0.58, sFont, 'bold');
                    ctx.fillStyle = currentTchrClr;
                    const tFont = Math.min(pillH * 0.28, 12);
                    drawTextFit(ctx, '👤 ' + entry.item.t, startX + width / 2, py + pillH * 0.74, width * 0.58, tFont, '500');
                  } else {
                    drawTextFit(ctx, entry.item.s, startX + width / 2, py + pillH / 2, width * 0.62, sFont, 'bold');
                  }
                } else {
                  ctx.shadowColor = 'transparent';
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                  drawTextFit(ctx, '— Trống —', startX + width / 2, py + pillH / 2, width * 0.5, 12, '500');
                }
              });

              const addY = topOffset + count * (pillH + pGap) + 2;
              drawAddBtnHelper(startX, addY, width, addBtnH, 6, [3, 3], "➕ Thêm tiết", 11, addBtnH / 2, list[0] ? list[0].session : 'morning', d);
            };

            if (tempHasAfternoon) {
              const colW = (contentW - 32 - 12) / 2;
              renderSessionPills(mList, contentLeft + 16, colW);
              renderSessionPills(aList, contentLeft + 16 + colW + 12, colW);
            } else {
              renderSessionPills(mList, contentLeft + 16, contentW - 32);
            }
          }
        } else {
          const timelineW = Math.max(68, Math.round(contentW * 0.068));
          const colGap = Math.max(10, Math.round(contentW * 0.008));
          const colW = (contentW - timelineW - colGap - 4 * colGap) / 5;
          const headerH = Math.min(contentH * 0.065, 46);

          const tlX = contentLeft;
          drawLiquidGlassWithDropletRefraction(ctx, tlX, contentTop, timelineW, contentH, 20, Math.max(glassAlpha + 0.06, 0.14));
          
          roundRect(ctx, tlX + 6, contentTop + 8, timelineW - 12, headerH, 10);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, "GIỜ", tlX + timelineW / 2, contentTop + 8 + headerH / 2, timelineW * 0.8, 13, 'bold');

          for (let d = 0; d < 5; d++) {
            const x = contentLeft + timelineW + colGap + d * (colW + colGap);
            drawLiquidGlassWithDropletRefraction(ctx, x, contentTop, colW, contentH, 20, Math.max(glassAlpha + 0.06, 0.14));

            ctx.shadowBlur = 0;
            ctx.fillStyle = accent;
            roundRect(ctx, x + 8, contentTop + 8, colW - 16, headerH, 10); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#ffffff';
            drawTextFit(ctx, daysFull[d], x + colW / 2, contentTop + 8 + headerH / 2, (colW - 16) * 0.85, 16, 'bold');

            const mList = renderMorningData.map((r, rIdx) => ({ session: r.sessionOverride || 'morning', r: rIdx, p: r.p, item: r.d[d] }));
            const aList = tempHasAfternoon ? renderAfternoonData.map((r, rIdx) => ({ session: 'afternoon', r: rIdx, p: r.p, item: r.d[d] })) : [];
            const activeList = [...mList, ...aList];

            const totalItems = activeList.length;
            const tileGap = Math.max(6, Math.round(H * 0.007));
            const addBtnH = 26;
            const topOffset = contentTop + headerH + 16;
            const availH = contentH - (headerH + 28) - (addBtnH + 10);
            const tileH = Math.min((availH - (totalItems - 1) * tileGap) / Math.max(totalItems, 1), 76);
            const startY = topOffset;

            if (d === 0) {
              activeList.forEach((entry, idx) => {
                const iy = startY + idx * (tileH + tileGap);
                const pTime = getPeriodTime(entry.session, entry.p);
                const parts = pTime.split(' - ');
                ctx.fillStyle = timeClr;
                drawTextFit(ctx, parts[0] || '', tlX + timelineW / 2, iy + tileH * 0.36, timelineW * 0.88, 12, '700');
                drawTextFit(ctx, parts[1] || '', tlX + timelineW / 2, iy + tileH * 0.68, timelineW * 0.88, 10, '500');
              });
            }

            activeList.forEach((entry, idx) => {
              const iy = startY + idx * (tileH + tileGap);
              const isEmpty = !entry.item || entry.item.s === '-' || entry.item.s === '' || entry.item.s === 'Trống';
              const tileW = colW - 16;
              const tileX = x + 8;
              const subColor = getSubjectColor(entry.item ? entry.item.s : '', accent);

              hitBoxes.push({ session: entry.session, r: entry.r, d: d, x: tileX, y: iy, w: tileW, h: tileH, dayName: daysFull[d] });

              ctx.shadowBlur = 0;
              ctx.fillStyle = isEmpty ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.16)';
              roundRect(ctx, tileX, iy, tileW, tileH, 12); ctx.fill();
              ctx.strokeStyle = isEmpty ? 'rgba(255, 255, 255, 0.12)' : (subColor || 'rgba(255, 255, 255, 0.28)');
              ctx.lineWidth = 1.2; ctx.stroke();

              if (!isEmpty) {
                ctx.fillStyle = subColor;
                roundRect(ctx, tileX + 3, iy + 6, 3.5, tileH - 12, 2); ctx.fill();

                const iconBoxSize = Math.min(tileH - 14, 34);
                const iconBoxX = tileX + 12;
                const iconBoxY = iy + (tileH - iconBoxSize) / 2;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
                roundRect(ctx, iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 8); ctx.fill();
                ctx.strokeStyle = subColor; ctx.lineWidth = 1; ctx.stroke();
                drawVectorSubjectIcon(ctx, entry.item.s, iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2, iconBoxSize * 0.6, subColor);

                const pTime = getPeriodTime(entry.session, entry.p);
                ctx.fillStyle = timeClr;
                drawTextFit(ctx, pTime, tileX + tileW - 10, iy + 11, tileW * 0.45, 11, '600', 'right');

                ctx.shadowColor = currentShadowClr;
                ctx.shadowBlur = currentShadowBlur;
                ctx.fillStyle = currentSubClr;
                const sFont = Math.min(tileW * 0.13, tileH * 0.38, 19);
                if (entry.item.t) {
                  drawTextFit(ctx, entry.item.s, tileX + tileW / 2 + 10, iy + tileH * 0.38, tileW * 0.58, sFont, 'bold');
                  ctx.fillStyle = currentTchrClr;
                  const tFont = Math.min(tileW * 0.10, tileH * 0.26, 13);
                  drawTextFit(ctx, '👤 ' + entry.item.t, tileX + tileW / 2 + 10, iy + tileH * 0.74, tileW * 0.58, tFont, '500');
                } else {
                  drawTextFit(ctx, entry.item.s, tileX + tileW / 2 + 10, iy + tileH / 2, tileW * 0.62, sFont, 'bold');
                }
              } else {
                ctx.shadowColor = 'transparent';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                drawTextFit(ctx, '— Trống —', tileX + tileW / 2, iy + tileH / 2, tileW * 0.5, 14, '500');
              }
            });

            const addBtnY = startY + totalItems * (tileH + tileGap) + 6;
            const tileW = colW - 16;
            const tileX = x + 8;
            drawAddBtnHelper(tileX, addBtnY, tileW, addBtnH, 8, [4, 4], "➕ Thêm tiết", 12, addBtnH / 2, 'morning', d);
          }
        }
      },
      studio: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const colGap = Math.max(12, Math.round(W * 0.012));
        const colW = (contentW - 4 * colGap) / 5;

        for (let d = 0; d < 5; d++) {
          const x = contentLeft + d * (colW + colGap);
          
          // Studio Card với viền Gradient sáng
          ctx.save();
          roundRect(ctx, x, contentTop, colW, contentH, 20);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.fill();
          
          // Viền gradient Studio
          const borderGrd = ctx.createLinearGradient(x, contentTop, x + colW, contentTop + contentH);
          borderGrd.addColorStop(0, accent);
          borderGrd.addColorStop(0.5, 'rgba(255,255,255,0.25)');
          borderGrd.addColorStop(1, 'rgba(139, 92, 246, 0.5)');
          ctx.strokeStyle = borderGrd;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();

          // Header dải Studio
          const sHeaderH = Math.min(contentH * 0.07, 46);
          const sHeaderGrd = ctx.createLinearGradient(x, contentTop, x + colW, contentTop);
          sHeaderGrd.addColorStop(0, accent);
          sHeaderGrd.addColorStop(1, 'rgba(139, 92, 246, 0.85)');
          ctx.fillStyle = sHeaderGrd;
          roundRect(ctx, x + 8, contentTop + 8, colW - 16, sHeaderH, 10);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.5)';
          drawTextFit(ctx, daysFull[d].toUpperCase(), x + colW / 2, contentTop + 8 + sHeaderH / 2, colW - 24, 15, '800');

          const mList = renderMorningData.map((r, rIdx) => ({ session: r.sessionOverride || 'morning', r: rIdx, p: r.p, item: r.d[d] }));
          const aList = tempHasAfternoon ? renderAfternoonData.map((r, rIdx) => ({ session: 'afternoon', r: rIdx, p: r.p, item: r.d[d] })) : [];
          const allList = (tempHasAfternoon && aList.length > 0)
            ? [...mList, { isDivider: true, text: 'BUỔI CHIỀU' }, ...aList]
            : [...mList, ...aList];

          const totalItems = allList.length;
          const sGap = 6;
          const topOffset = contentTop + sHeaderH + 16;
          const availH = contentH - (sHeaderH + 24);
          const blockH = Math.min((availH - (totalItems - 1) * sGap) / (totalItems + 0.5), 74);

          allList.forEach((entry, idx) => {
            const by = topOffset + idx * (blockH + sGap);
            const bw = colW - 16;
            const bx = x + 8;

            if (entry.isDivider) {
              const pillW = Math.min(bw * 0.72, 125);
              const pillH = Math.min(blockH * 0.65, 24);
              const pillX = bx + (bw - pillW) / 2;
              const pillY = by + (blockH - pillH) / 2;
              const divGrd = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
              divGrd.addColorStop(0, 'rgba(245, 158, 11, 0.20)');
              divGrd.addColorStop(1, 'rgba(217, 119, 6, 0.12)');
              roundRect(ctx, pillX, pillY, pillW, pillH, 11);
              ctx.fillStyle = divGrd; ctx.fill();
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
              ctx.fillStyle = '#fbbf24';
              drawTextFit(ctx, "☀️ BUỔI CHIỀU", pillX + pillW / 2, pillY + pillH / 2, pillW * 0.85, 10, 'bold');
              return;
            }

            const isEmpty = !entry.item || entry.item.s === '-' || entry.item.s === '' || entry.item.s === 'Trống';
            const subColor = getSubjectColor(entry.item ? entry.item.s : '', accent);

            hitBoxes.push({ session: entry.session, r: entry.r, d: d, x: bx, y: by, w: bw, h: blockH, dayName: daysFull[d] });

            // Studio Period Card
            ctx.shadowBlur = 0;
            ctx.fillStyle = isEmpty ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.14)';
            roundRect(ctx, bx, by, bw, blockH, 10);
            ctx.fill();
            
            // Viền phát sáng nhẹ theo môn
            ctx.strokeStyle = isEmpty ? 'rgba(255, 255, 255, 0.1)' : subColor;
            ctx.lineWidth = isEmpty ? 1 : 1.2;
            ctx.stroke();

            if (!isEmpty) {
              // Badge tiết tròn với icon Vector sắc nét
              const pRadius = Math.min(blockH * 0.28, 14);
              const pCenterX = bx + 16;
              const pCenterY = by + blockH / 2;
              ctx.fillStyle = entry.session === 'morning' ? accent : '#f59e0b';
              ctx.beginPath();
              ctx.arc(pCenterX, pCenterY, pRadius, 0, Math.PI * 2);
              ctx.fill();
              drawVectorSubjectIcon(ctx, entry.item.s, pCenterX, pCenterY, pRadius * 1.2, '#ffffff');

              // Tên môn và giáo viên căn giữa tuyệt đối
              const textCenterX = bx + bw / 2 + 10;
              ctx.shadowColor = currentShadowClr;
              ctx.shadowBlur = currentShadowBlur;
              ctx.fillStyle = currentSubClr;

              const sFont = Math.min(bw * 0.13, blockH * 0.38, 18);
              if (entry.item.t) {
                drawTextFit(ctx, entry.item.s, textCenterX, by + blockH * 0.36, bw * 0.62, sFont, 'bold');
                ctx.fillStyle = currentTchrClr;
                const tFont = Math.min(bw * 0.09, blockH * 0.26, 12);
                drawTextFit(ctx, '👤 ' + entry.item.t, textCenterX, by + blockH * 0.74, bw * 0.62, tFont, '500');
              } else {
                drawTextFit(ctx, entry.item.s, textCenterX, by + blockH / 2, bw * 0.65, sFont, 'bold');
              }
            } else {
              ctx.shadowColor = 'transparent';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
              drawTextFit(ctx, '—', bx + bw / 2, by + blockH / 2, bw * 0.5, 14, '500');
            }
          });

          // Nút "+" thêm tiết nhanh dưới cột Studio
          const addY = topOffset + totalItems * (blockH + sGap) + 4;
          if (addY + 24 <= contentTop + contentH - 6) {
            const bw = colW - 16;
            const bx = x + 8;
            drawAddBtnHelper(bx, addY, bw, 24, 8, [3, 3], "➕ Thêm tiết", 11, 12, 'morning', d);
          }
        }
      },
      floating: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const fullRows = tempHasAfternoon ? [...renderMorningData, { isDivider: true, p: "CHIỀU" }, ...renderAfternoonData] : renderMorningData;
        const totalRows = fullRows.length + 1;
        
        const tableW = Math.round(W * 0.94);
        const tableLeft = (W - tableW) / 2;

        // Cùng một mốc được tính tại khối tiêu đề; không tính lại bằng tỉ lệ cố định.
        const actualTableTop = contentTop;
        const availTableH = H * 0.95 - actualTableTop;

        const colGap = Math.max(8, Math.round(tableW * 0.008));
        const rowGap = Math.max(8, Math.round(availTableH * 0.012));

        let rowH = (availTableH - (totalRows - 1) * rowGap) / (totalRows + 0.4);
        const maxRowH = isVertical ? 120 : 135;
        if (rowH > maxRowH) rowH = maxRowH;

        const pColW = Math.max(Math.round(tableW * 0.055), isVertical ? 46 : 58);
        const dayColW = (tableW - pColW - 5 * colGap) / 5;

        const cellGlassAlpha = glassAlpha <= 0.03 ? 0.025 : Math.max(glassAlpha * 0.7, 0.08);

        // 1. Ô Header "T" (Tiết)
        ctx.shadowBlur = 0;
        ctx.fillStyle = accent;
        roundRect(ctx, tableLeft, actualTableTop, pColW, rowH, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        drawTextFit(ctx, "T", tableLeft + pColW / 2, actualTableTop + rowH / 2, pColW * 0.8, Math.min(rowH * 0.38, 20), '700');

        // 2. Ô Header các thứ (Thứ 2..Thứ 6)
        for (let d = 0; d < 5; d++) {
          const x = tableLeft + pColW + colGap + d * (dayColW + colGap);
          ctx.fillStyle = accent;
          roundRect(ctx, x, actualTableTop, dayColW, rowH, 12);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, days[d], x + dayColW / 2, actualTableTop + rowH / 2, dayColW * 0.85, Math.min(rowH * 0.38, 20), '700');
        }

        // 3. Các hàng tiết học
        let mIdx = 0, aIdx = 0;
        for (let r = 0; r < fullRows.length; r++) {
          const y = actualTableTop + (r + 1) * (rowH + rowGap);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          const rowItem = fullRows[r];

          if (rowItem.isDivider) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            roundRect(ctx, tableLeft, y, tableW, rowH * 0.7, 10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.stroke();
            ctx.fillStyle = accent;
            drawTextFit(ctx, "▼ BUỔI CHIỀU", tableLeft + tableW / 2, y + (rowH * 0.7) / 2, tableW * 0.5, 14, '700');
            continue;
          }

          const isM = r < renderMorningData.length;
          const currSession = rowItem.sessionOverride || (isM ? 'morning' : 'afternoon');
          const actualRIdx = rowItem.rowIndex;

          // Ô số tiết bên trái với hiệu ứng Liquid Glass đồng bộ
          drawLiquidGlassWithDropletRefraction(ctx, tableLeft, y, pColW, rowH, 12, cellGlassAlpha);
          ctx.fillStyle = 'rgba(25, 28, 38, 0.35)';
          roundRect(ctx, tableLeft, y, pColW, rowH, 12); ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1; ctx.stroke();

          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, String(rowItem.p).replace('C', ''), tableLeft + pColW / 2, y + rowH / 2, pColW * 0.8, Math.min(rowH * 0.40, 20), '700');

          // 5 ô môn học trong hàng với hiệu ứng Liquid Glass đồng bộ
          for (let d = 0; d < 5; d++) {
            const x = tableLeft + pColW + colGap + d * (dayColW + colGap);
            const item = rowItem.d[d];
            const isEmpty = !item || item.s === '-' || item.s === '' || item.s === 'Trống';

            hitBoxes.push({ session: currSession, r: actualRIdx, d: d, x, y, w: dayColW, h: rowH, dayName: daysFull[d] });

            // Nền Liquid Glass đồng bộ cho từng ô nổi
            drawLiquidGlassWithDropletRefraction(ctx, x, y, dayColW, rowH, 14, cellGlassAlpha);
            ctx.fillStyle = isEmpty ? 'rgba(20, 24, 33, 0.25)' : 'rgba(20, 24, 33, 0.45)';
            roundRect(ctx, x, y, dayColW, rowH, 14); ctx.fill();

            // Viền mỏng sắc nét
            ctx.strokeStyle = isEmpty ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.28)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (!isEmpty) {
              ctx.shadowColor = currentShadowClr;
              ctx.shadowBlur = currentShadowBlur;
              ctx.fillStyle = currentSubClr;

              if (item.t) {
                const sFont = Math.min(rowH * 0.32, dayColW * 0.18, 20);
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH * 0.36, dayColW * 0.88, sFont, '700');

                ctx.fillStyle = currentTchrClr;
                const tFont = Math.min(rowH * 0.24, dayColW * 0.15, 14);
                drawTextFit(ctx, item.t, x + dayColW / 2, y + rowH * 0.72, dayColW * 0.88, tFont, '500');
              } else {
                const sFont = Math.min(rowH * 0.38, dayColW * 0.20, 22);
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH / 2, dayColW * 0.88, sFont, '700');
              }
            } else {
              ctx.shadowColor = 'transparent';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
              drawTextFit(ctx, "—", x + dayColW / 2, y + rowH / 2, dayColW * 0.5, 16, '500');
            }
          }
        }

        // Hàng nút "+" thêm tiết nhanh dưới mỗi cột ngày
        const addRowY = actualTableTop + (totalRows + 1) * (rowH + rowGap);
        if (addRowY + 24 <= H * 0.98) {
          for (let d = 0; d < 5; d++) {
            const btnX = tableLeft + pColW + colGap + d * (dayColW + colGap);
            drawAddBtnHelper(btnX, addRowY, dayColW, 22, 8, [3, 3], "➕ Thêm", 11, 11, 'morning', d);
          }
        }
      },
      split: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const sessionCount = tempHasAfternoon ? 2 : 1;
        const blockGap = 16;
        const blockW = isVertical ? contentW : (contentW - blockGap) / sessionCount;
        const blockH = isVertical ? (contentH - (tempHasAfternoon ? blockGap : 0)) / sessionCount : contentH;

        const sessions = tempHasAfternoon
          ? [{name:'BUỔI SÁNG',data:renderMorningData,session:'morning'},{name:'BUỔI CHIỀU',data:renderAfternoonData,session:'afternoon'}]
          : [{name:renderMorningData[0] && renderMorningData[0].sessionOverride==='afternoon'?'BUỔI CHIỀU':'BUỔI SÁNG',data:renderMorningData,session:renderMorningData[0]?renderMorningData[0].sessionOverride:'morning'}];

        sessions.forEach((sess, sIdx) => {
          const bx = isVertical ? contentLeft : contentLeft + sIdx * (blockW + blockGap);
          const by = isVertical ? contentTop + sIdx * (blockH + blockGap) : contentTop;

          // Khung kính Liquid độc lập cho từng buổi, không méo, không bị clipping tràn
          drawLiquidGlassWithDropletRefraction(ctx, bx, by, blockW, blockH, 20, Math.max(glassAlpha + 0.06, 0.14));

          // Badge tên buổi (Sáng / Chiều)
          const sessBadgeW = Math.min(blockW * 0.28, 120);
          const sessBadgeH = 26;
          ctx.shadowBlur = 0;
          ctx.fillStyle = sess.session === 'morning' ? accent : '#f59e0b';
          roundRect(ctx, bx + 16, by + 12, sessBadgeW, sessBadgeH, 8); ctx.fill();
          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, sess.name, bx + 16 + sessBadgeW / 2, by + 12 + sessBadgeH / 2, sessBadgeW * 0.88, 12, 'bold');

          const pad = 16;
          const pColW = Math.max(38, Math.round(blockW * 0.075));
          const colGap = Math.max(6, Math.round(blockW * 0.01));
          const dayColW = (blockW - 2 * pad - pColW - 5 * colGap) / 5;
          const getDayX = (d) => bx + pad + pColW + colGap + d * (dayColW + colGap);

          // Hàng Header các thứ & ô Tiết (Đồng bộ tuyệt đối trục X và căn giữa tuyệt đối)
          const headerRowY = by + 46;
          const headerRowH = 28;

          // Ô header "T"
          ctx.fillStyle = sess.session === 'morning' ? accent : '#f59e0b';
          roundRect(ctx, bx + pad, headerRowY, pColW, headerRowH, 7); ctx.fill();
          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, "T", bx + pad + pColW / 2, headerRowY + headerRowH / 2, pColW * 0.8, 12, 'bold');

          // Header Thứ 2..6 - ĐẶT TRÊN CÙNG TRỤC getDayX(d) VỚI CÁC Ô BÊN DƯỚI -> THẲNG HÀNG 100%
          for (let d = 0; d < 5; d++) {
            const dx = getDayX(d);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            roundRect(ctx, dx, headerRowY, dayColW, headerRowH, 7); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#ffffff';
            drawTextFit(ctx, days[d], dx + dayColW / 2, headerRowY + headerRowH / 2, dayColW * 0.85, 12, 'bold');
          }

          // Các hàng tiết học
          const rows = sess.data.length;
          const rowsTop = headerRowY + headerRowH + 8;
          const availRowsH = blockH - (rowsTop - by) - 12;
          const rowGap = 6;
          const rowH = (availRowsH - (rows - 1) * rowGap) / (rows + 0.4);

          for (let r = 0; r < rows; r++) {
            const ry = rowsTop + r * (rowH + rowGap);
            const rItem = sess.data[r];

            // Ô số tiết bên trái: CĂN GIỮA TUYỆT ĐỐI CẢ CHIỀU DỌC VÀ CHIỀU NGANG
            ctx.fillStyle = sess.session === 'morning' ? accent : '#f59e0b';
            roundRect(ctx, bx + pad, ry, pColW, rowH, 8); ctx.fill();
            ctx.fillStyle = '#ffffff';
            drawTextFit(ctx, String(rItem.p).replace('C',''), bx + pad + pColW / 2, ry + rowH / 2, pColW * 0.8, Math.min(rowH * 0.45, 15), 'bold');

            for (let d = 0; d < 5; d++) {
              const dx = getDayX(d);
              const item = rItem.d[d];
              const isEmpty = !item || item.s === '-' || item.s === '' || item.s === 'Trống';

              hitBoxes.push({ session: sess.session, r: r, d: d, x: dx, y: ry, w: dayColW, h: rowH, dayName: daysFull[d] });

              ctx.fillStyle = isEmpty ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.16)';
              roundRect(ctx, dx, ry, dayColW, rowH, 9); ctx.fill();
              ctx.strokeStyle = isEmpty ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.25)';
              ctx.lineWidth = 1; ctx.stroke();

              ctx.shadowColor = currentShadowClr;
              ctx.shadowBlur = currentShadowBlur;
              ctx.fillStyle = isEmpty ? 'rgba(255,255,255,0.3)' : currentSubClr;
              const sFont = Math.min(dayColW * 0.22, rowH * 0.36, 17);

              if (item && item.t) {
                drawTextFit(ctx, item.s, dx + dayColW / 2, ry + rowH * 0.36, dayColW * 0.88, sFont, 'bold');
                ctx.fillStyle = currentTchrClr;
                const tFont = Math.min(dayColW * 0.17, rowH * 0.26, 12);
                drawTextFit(ctx, item.t, dx + dayColW / 2, ry + rowH * 0.74, dayColW * 0.88, tFont, '500');
              } else {
                drawTextFit(ctx, isEmpty ? '—' : item.s, dx + dayColW / 2, ry + rowH / 2, dayColW * 0.88, sFont, 'bold');
              }
            }
          }

          // Nút "+" thêm tiết nhanh dưới mỗi cột ngày
          const addRowY = rowsTop + (rows + 1) * (rowH + rowGap);
          if (addRowY + 22 <= by + blockH - 6) {
            for (let d = 0; d < 5; d++) {
              const dx = getDayX(d);
              drawAddBtnHelper(dx, addRowY, dayColW, 20, 6, [2, 2], "➕ Thêm", 10, 10, sess.session, d);
            }
          }
        });
      },
      table: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
    const fullRows = tempHasAfternoon ? [...renderMorningData, { isDivider: true, p: "CHIỀU" }, ...renderAfternoonData] : renderMorningData;
    const totalRows = fullRows.length + 1;
    const rowGap = Math.max(6, Math.round(H * 0.005));
    const colGap = Math.max(6, Math.round(W * 0.005));
    const pColW = Math.max(contentW * 0.08, 48);
    const dayColW = (contentW - pColW - 5 * colGap) / 5;

    const headerH = isVertical ? Math.min(Math.max(Math.round(H * 0.028), 46), 52) : Math.min(Math.max(Math.round(H * 0.042), 40), 46);
    const maxDataRowH = isVertical ? 96 : 74;
    const minDataRowH = isVertical ? 54 : 45; 
    const refRowCount = (hasAfternoon && isSplitMode) ? Math.max(morningData.length, afternoonData.length) : fullRows.length;
    
    const addBtnH = 20;
    const addBtnGap = 8;
    const availableDataH = contentH - headerH - rowGap - (addBtnH + addBtnGap);
    const calcDataRowH = (availableDataH - (refRowCount - 1) * rowGap) / Math.max(refRowCount, 1);
    const dataRowH = Math.max(minDataRowH, Math.min(calcDataRowH, maxDataRowH));

    const totalTableH = headerH + rowGap + fullRows.length * (dataRowH + rowGap) + addBtnH;
    let tableTop = contentTop;
    if (totalTableH < contentH) {
      tableTop = contentTop + Math.round((contentH - totalTableH) / 2);
    }

    const shouldClipTable = !isVertical;
    if (shouldClipTable) {
      ctx.save();
      roundRect(ctx, contentLeft, tableTop, contentW, totalTableH, 16);
      ctx.clip();
    }

    const tableGlassOpts = !isVertical ? { shadowBlur: 6, baseFill: 'rgba(0,0,0,0.35)', topAlpha: 0.15, botAlpha: 0.04 } : {};
    const tableAlpha = !isVertical ? Math.max(glassAlpha + 0.02, 0.06) : Math.max(glassAlpha + 0.04, 0.1);

    ctx.shadowBlur = 0; ctx.fillStyle = accent;
    roundRect(ctx, contentLeft, tableTop, pColW, headerH, 8); ctx.fill();
    ctx.fillStyle = '#ffffff';
    const headerFontSize = Math.min(headerH * 0.44, dayColW * 0.22, isVertical ? 22 : 18);
    drawTextFit(ctx, "T", contentLeft + pColW / 2, tableTop + headerH / 2, pColW * 0.8, headerFontSize, 'bold');

    for (let d = 0; d < 5; d++) {
      const x = contentLeft + pColW + colGap + d * (dayColW + colGap);
      ctx.fillStyle = accent;
      roundRect(ctx, x, tableTop, dayColW, headerH, 8); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawTextFit(ctx, days[d], x + dayColW / 2, tableTop + headerH / 2, dayColW * 0.85, headerFontSize, 'bold');
    }

    let mIdx = 0, aIdx = 0;
    for (let r = 0; r < fullRows.length; r++) {
      const y = tableTop + headerH + rowGap + r * (dataRowH + rowGap);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      const rowItem = fullRows[r];

      if (rowItem.isDivider) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(glassAlpha + 0.1, 0.16)})`;
        roundRect(ctx, contentLeft, y, contentW, dataRowH, 8); ctx.fill();
        ctx.fillStyle = accent;
        drawTextFit(ctx, "▼ BUỔI CHIỀU", contentLeft + contentW / 2, y + dataRowH / 2, contentW * 0.5, Math.min(dataRowH * 0.45, 20), 'bold');
        continue;
      }

      const isM = r < renderMorningData.length;
      const currSession = rowItem.sessionOverride || (isM ? 'morning' : 'afternoon');
      const actualRIdx = rowItem.rowIndex;

      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(glassAlpha + 0.05, 0.12)})`;
      roundRect(ctx, contentLeft, y, pColW, dataRowH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      drawTextFit(ctx, rowItem.p, contentLeft + pColW / 2, y + dataRowH / 2, pColW * 0.8, Math.min(dataRowH * 0.45, 20), 'bold');

      for (let d = 0; d < 5; d++) {
        const x = contentLeft + pColW + colGap + d * (dayColW + colGap);
        const item = rowItem.d[d];
        const isEmpty = !item || item.s === '-' || item.s === '' || item.s === 'Trống';

        hitBoxes.push({ session: currSession, r: actualRIdx, d: d, x, y, w: dayColW, h: dataRowH, dayName: daysFull[d] });
        drawLiquidGlassWithDropletRefraction(ctx, x, y, dayColW, dataRowH, 10, tableAlpha, tableGlassOpts);

        if (!isEmpty) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          roundRect(ctx, x + 2, y + 2, dayColW - 4, dataRowH - 4, 8); ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.shadowColor = currentShadowClr; ctx.shadowBlur = currentShadowBlur; ctx.fillStyle = currentSubClr;
          const subFontSize = Math.min(dataRowH * 0.36, dayColW * 0.22, 24);

          if (item.t) {
            drawTextFit(ctx, item.s, x + dayColW / 2, y + dataRowH * 0.36, dayColW * 0.88, subFontSize, 'bold');
            ctx.fillStyle = currentTchrClr;
            const tchrFontSize = Math.min(dataRowH * 0.24, dayColW * 0.16, 16);
            drawTextFit(ctx, item.t, x + dayColW / 2, y + dataRowH * 0.72, dayColW * 0.88, tchrFontSize, '500');
          } else {
            drawTextFit(ctx, item.s, x + dayColW / 2, y + dataRowH / 2, dayColW * 0.88, subFontSize, 'bold');
          }
        } else {
          ctx.fillStyle = currentTchrClr;
          drawTextFit(ctx, "—", x + dayColW / 2, y + dataRowH / 2, dayColW * 0.5, 18, 'bold');
        }
      }
    }

    const addRowY = tableTop + headerH + rowGap + fullRows.length * (dataRowH + rowGap);
    const addSession = (hasAfternoon && isSplitMode && currentPreviewView === 'afternoon') ? 'afternoon' : 'morning';
    for (let d = 0; d < 5; d++) {
      const btnX = contentLeft + pColW + colGap + d * (dayColW + colGap);
      drawAddBtnHelper(btnX, addRowY, dayColW, 20, 6, [2, 2], "➕ Thêm", 10, 10, addSession, d);
    }

    if (shouldClipTable) {
      ctx.restore();
    }
  },
      holographic: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const fullRows = tempHasAfternoon ? [...renderMorningData, { isDivider: true, p: "CHIỀU" }, ...renderAfternoonData] : renderMorningData;
        const totalRows = fullRows.length + 1;
        const rowGap = Math.max(12, Math.round(H * 0.012));
        const colGap = Math.max(12, Math.round(W * 0.012));
        
        const pColW = Math.max(contentW * 0.07, 46);
        const dayColW = (contentW - pColW - 5 * colGap) / 5;
        const rowH = (contentH - (totalRows - 1) * rowGap) / (totalRows + 0.5);

        const headerH = Math.min(rowH * 0.8, 50);
        ctx.fillStyle = accent;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
        roundRect(ctx, contentLeft, contentTop, pColW, headerH, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        drawTextFit(ctx, "T", contentLeft + pColW / 2, contentTop + headerH / 2, pColW * 0.8, 20, '800');

        for (let d = 0; d < 5; d++) {
          const x = contentLeft + pColW + colGap + d * (dayColW + colGap);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          roundRect(ctx, x, contentTop, dayColW, headerH, 16); ctx.fill();
          
          const borderGrd = ctx.createLinearGradient(x, contentTop, x + dayColW, contentTop + headerH);
          borderGrd.addColorStop(0, 'rgba(255,255,255,0.4)');
          borderGrd.addColorStop(1, 'rgba(255,255,255,0.05)');
          ctx.strokeStyle = borderGrd; ctx.lineWidth = 1.5; ctx.stroke();
          
          ctx.fillStyle = '#ffffff';
          drawTextFit(ctx, daysFull[d], x + dayColW / 2, contentTop + headerH / 2, dayColW * 0.85, 18, '800');
        }

        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        const rowsTop = contentTop + headerH + rowGap;
        
        for (let r = 0; r < fullRows.length; r++) {
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          const y = rowsTop + r * (rowH + rowGap);
          const rowItem = fullRows[r];

          if (rowItem.isDivider) {
             const divW = Math.min(contentW * 0.3, 200);
             const divX = contentLeft + (contentW - divW) / 2;
             const divH = Math.min(rowH * 0.6, 30);
             const divY = y + (rowH - divH) / 2;
             ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
             roundRect(ctx, divX, divY, divW, divH, 15); ctx.fill();
             ctx.fillStyle = '#ffffff';
             drawTextFit(ctx, String(rowItem.p), divX + divW / 2, divY + divH / 2, divW * 0.8, 14, 'bold');
             continue;
          }

          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          roundRect(ctx, contentLeft, y, pColW, rowH, 12); ctx.fill();
          ctx.fillStyle = timeClr;
          drawTextFit(ctx, String(rowItem.p).replace('C', ''), contentLeft + pColW / 2, y + rowH / 2, pColW * 0.8, Math.min(rowH * 0.4, 22), '800');

          for (let d = 0; d < 5; d++) {
            const x = contentLeft + pColW + colGap + d * (dayColW + colGap);
            const item = rowItem.d ? rowItem.d[d] : null;
            const isEmpty = !item || item.s === '-' || item.s === '' || item.s === 'Trống';
            
            const realSession = rowItem.sessionOverride || (tempHasAfternoon && r > renderMorningData.length ? 'afternoon' : 'morning');
            const actualRIdx = rowItem.rowIndex;
            hitBoxes.push({ session: realSession, r: actualRIdx, d: d, x, y, w: dayColW, h: rowH, dayName: daysFull[d] });

            const baseGrd = ctx.createLinearGradient(x, y, x + dayColW, y + rowH);
            if (isEmpty) {
              baseGrd.addColorStop(0, 'rgba(255,255,255,0.03)');
              baseGrd.addColorStop(1, 'rgba(255,255,255,0.01)');
            } else {
              baseGrd.addColorStop(0, 'rgba(255,255,255,0.18)');
              baseGrd.addColorStop(0.5, 'rgba(255,255,255,0.08)');
              baseGrd.addColorStop(1, 'rgba(0,0,0,0.2)');
            }
            
            ctx.shadowColor = isEmpty ? 'transparent' : 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = isEmpty ? 0 : 15;
            ctx.shadowOffsetY = isEmpty ? 0 : 8;
            ctx.fillStyle = baseGrd;
            roundRect(ctx, x, y, dayColW, rowH, 16); ctx.fill();
            
            const glowGrd = ctx.createLinearGradient(x, y, x, y + rowH);
            glowGrd.addColorStop(0, isEmpty ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)');
            glowGrd.addColorStop(1, 'rgba(255,255,255,0.05)');
            ctx.strokeStyle = glowGrd; ctx.lineWidth = 1.2; ctx.stroke();
            
            ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;

            if (!isEmpty) {
              const subColor = (textMode === 'custom' && manualSubClr) ? manualSubClr : (item.c || '#ffffff');
              ctx.fillStyle = subColor;
              if (item.t && item.t.trim() !== '') {
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH * 0.4, dayColW * 0.85, Math.min(rowH * 0.3, 22), '800');
                ctx.fillStyle = currentTchrClr;
                drawTextFit(ctx, item.t, x + dayColW / 2, y + rowH * 0.75, dayColW * 0.85, Math.min(rowH * 0.22, 16), '500');
              } else {
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH / 2, dayColW * 0.85, Math.min(rowH * 0.35, 24), '800');
              }
            } else {
               ctx.fillStyle = 'rgba(255,255,255,0.2)';
               drawTextFit(ctx, "-", x + dayColW / 2, y + rowH / 2, dayColW * 0.5, 18, 'bold');
            }
          }
        }
        
        const addRowY = rowsTop + fullRows.length * (rowH + rowGap);
        if (addRowY + 22 <= contentTop + contentH - 4) {
          for (let d = 0; d < 5; d++) {
            const btnX = contentLeft + pColW + colGap + d * (dayColW + colGap);
            drawAddBtnHelper(btnX, addRowY, dayColW, 20, 6, [2, 2], "+ Thêm", 10, 10, 'morning', d);
          }
        }
      },
      basic: (ctx, rc) => {
        const { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit } = rc;
        const fullRows = tempHasAfternoon ? [...renderMorningData, { isDivider: true, p: "CHIỀU" }, ...renderAfternoonData] : renderMorningData;
        const totalRows = fullRows.length + 1;
        
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, W, H);
        
        ctx.fillStyle = '#000000';
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        const titleY = padY + boardH * 0.05;
        drawTextFit(ctx, title, W / 2, titleY, boardW, Math.min(boardH * 0.04, 36), '800');
        if (displaySub) {
           drawTextFit(ctx, displaySub, W / 2, titleY + Math.min(boardH * 0.04, 36), boardW, Math.min(boardH * 0.025, 22), '600');
        }
        
        const myContentTop = titleY + Math.min(boardH * 0.04, 36) + 40;
        const myContentH = (H - padY) - myContentTop;
        const rowH = myContentH / totalRows;
        const pColW = Math.max(contentW * 0.06, 50);
        const dayColW = (contentW - pColW) / 5;
        
        ctx.strokeStyle = '#000000'; 
        ctx.lineWidth = 2;
        roundRect(ctx, contentLeft, myContentTop, contentW, myContentH, 8); ctx.stroke();
        
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(contentLeft, myContentTop, contentW, rowH);
        
        ctx.fillStyle = '#000000';
        drawTextFit(ctx, "Tiết", contentLeft + pColW / 2, myContentTop + rowH / 2, pColW * 0.8, 16, 'bold');
        ctx.beginPath(); ctx.moveTo(contentLeft + pColW, myContentTop); ctx.lineTo(contentLeft + pColW, myContentTop + myContentH); ctx.stroke();

        for (let d = 0; d < 5; d++) {
          const x = contentLeft + pColW + d * dayColW;
          drawTextFit(ctx, daysFull[d], x + dayColW / 2, myContentTop + rowH / 2, dayColW * 0.85, 16, 'bold');
          if (d < 4) {
            ctx.beginPath(); ctx.moveTo(x + dayColW, myContentTop); ctx.lineTo(x + dayColW, myContentTop + myContentH); ctx.stroke();
          }
        }
        
        ctx.beginPath(); ctx.moveTo(contentLeft, myContentTop + rowH); ctx.lineTo(contentLeft + contentW, myContentTop + rowH); ctx.stroke();

        for (let r = 0; r < fullRows.length; r++) {
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          const y = myContentTop + (r + 1) * rowH;
          const rowItem = fullRows[r];
          
          if (rowItem.isDivider) {
             ctx.fillStyle = '#e2e8f0';
             ctx.fillRect(contentLeft, y, contentW, rowH);
             ctx.fillStyle = '#000000';
             drawTextFit(ctx, String(rowItem.p), contentLeft + contentW / 2, y + rowH / 2, contentW * 0.5, 14, 'bold');
             ctx.beginPath(); ctx.moveTo(contentLeft, y + rowH); ctx.lineTo(contentLeft + contentW, y + rowH); ctx.stroke();
             continue;
          }

          ctx.fillStyle = '#000000';
          drawTextFit(ctx, String(rowItem.p).replace('C', ''), contentLeft + pColW / 2, y + rowH / 2, pColW * 0.8, 16, 'bold');

          for (let d = 0; d < 5; d++) {
            const x = contentLeft + pColW + d * dayColW;
            const item = rowItem.d ? rowItem.d[d] : null;
            const isEmpty = !item || item.s === '-' || item.s === '' || item.s === 'Trống';
            
            const realSession = rowItem.sessionOverride || (tempHasAfternoon && r > renderMorningData.length ? 'afternoon' : 'morning');
            const actualRIdx = rowItem.rowIndex;
            hitBoxes.push({ session: realSession, r: actualRIdx, d: d, x, y, w: dayColW, h: rowH, dayName: daysFull[d] });

            if (!isEmpty) {
              if (item.t && item.t.trim() !== '') {
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH * 0.4, dayColW * 0.85, 16, 'bold');
                drawTextFit(ctx, item.t, x + dayColW / 2, y + rowH * 0.75, dayColW * 0.85, 14, 'normal');
              } else {
                drawTextFit(ctx, item.s, x + dayColW / 2, y + rowH / 2, dayColW * 0.85, 16, 'bold');
              }
            } else {
               drawTextFit(ctx, "-", x + dayColW / 2, y + rowH / 2, dayColW * 0.5, 16, 'normal');
            }
          }
          if (r < fullRows.length - 1) {
            ctx.beginPath(); ctx.moveTo(contentLeft, y + rowH); ctx.lineTo(contentLeft + contentW, y + rowH); ctx.stroke();
          }
        }
        
        const addRowY = myContentTop + totalRows * rowH;
        if (addRowY + 22 <= myContentTop + myContentH - 4) {
          for (let d = 0; d < 5; d++) {
            const btnX = contentLeft + pColW + d * dayColW + dayColW * 0.1;
            drawAddBtnHelper(btnX, addRowY + 4, dayColW * 0.8, 20, 4, [1, 1], "➕ Thêm", 10, 10, 'morning', d);
          }
        }
      }
    };

    const renderContext = { displaySub, W, H, isVertical, contentTop, contentBottom, contentH, contentW, contentLeft, padX, padY, boardW, boardH, accent, glassAlpha, textMode, manualSubClr, manualTchrClr, currentSubClr, currentTchrClr, currentShadowClr, currentShadowBlur, timeClr, renderMorningData, renderAfternoonData, tempHasAfternoon, drawAddBtnHelper, hitBoxes, days, daysFull, drawTextFit };
    if (LayoutRenderers[layout]) LayoutRenderers[layout](ctx, renderContext);
  }



    // ==========================================
    // 7. XUẤT ẢNH & HỖ TRỢ CHIA SẺ WEB SHARE API
    // ==========================================
    let exportURLs=[], exportBusy=false;
    let exportToastTimer = null;
    function closeExportToast() {
      clearTimeout(exportToastTimer);
      exportToastTimer = null;
      const toast = document.getElementById('tkb-export-toast');
      if (toast) toast.hidden = true;
    }
    function exportToast(message, isError) {
      let toast = document.getElementById('tkb-export-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'tkb-export-toast';
        toast.className = 'tkb-export-toast';
        toast.innerHTML = '<span id="tkb-export-message"></span><button type="button" id="tkb-toast-dismiss" aria-label="Ẩn thông báo">✕</button>';
        document.body.appendChild(toast);
        document.getElementById('tkb-toast-dismiss').onclick = closeExportToast;
      }
      closeExportToast();
      document.getElementById('tkb-export-message').textContent = message;
      toast.classList.toggle('is-error', !!isError);
      toast.setAttribute('role', isError ? 'alert' : 'status');
      toast.hidden = false;
      // Thông báo tự đóng sau 6 giây, nhưng link tải thủ công vẫn nằm ở Xuất & sao lưu.
      exportToastTimer = setTimeout(closeExportToast, isError ? 10000 : 6000);
    }
    window.closeTKBExport = () => {
      closeExportToast();
      const modal = document.getElementById('previewModal');
      if (modal) modal.style.display = 'none';
      exportURLs.forEach(url => URL.revokeObjectURL(url));
      exportURLs = [];
      const gallery = document.getElementById('export-gallery');
      if (gallery) gallery.textContent = '';
      const results = document.getElementById('tkb-export-results');
      if (results) results.hidden = true;
      document.getElementById('modalImg').removeAttribute('src');
      currentExportBlob = null;
    };
    async function handleExportCanvas(filename) {
      const previewCanvas = canvas, previewCtx = ctx;
      const out = document.createElement('canvas');
      let blob;
      try {
        window.isExporting = true;
        canvas = out; ctx = out.getContext('2d'); draw(true);
        blob = await new Promise((resolve,reject) =>
          out.toBlob(value => value ? resolve(value) : reject(new Error('Không tạo được ảnh.')), 'image/png'));
      } finally {
        canvas = previewCanvas; ctx = previewCtx; window.isExporting = false;
        out.width = out.height = 1; window.__blurredBgCanvas = null; draw(true);
      }
      const url = URL.createObjectURL(blob);
      exportURLs.push(url);
      currentExportBlob = blob;
      const gallery = document.getElementById('export-gallery');
      const item = document.createElement('div');
      item.className = 'tkb-export-file';
      const label = document.createElement('span'); label.textContent = filename;
      const previewBtn = document.createElement('button');
      previewBtn.type = 'button'; previewBtn.className = 'tkb-export-thumb';
      previewBtn.title = 'Xem ảnh ' + filename;
      const img = document.createElement('img'); img.src = url; img.alt = filename;
      previewBtn.appendChild(img);
      previewBtn.onclick = () => {
        currentExportBlob = blob;
        document.getElementById('modalImg').src = url;
        document.getElementById('previewModal').style.display = 'flex';
      };
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      link.textContent = 'Tải thủ công'; link.className = 'modal-btn';
      item.append(label, previewBtn, link);
      gallery.appendChild(item);
      document.getElementById('tkb-export-results').hidden = false;
      // Chỉ thử tải tự động; không thể biết chắc trình duyệt có chặn hay không.
      // Nếu bị chặn, người dùng còn nút Tải thủ công trong Xuất & sao lưu.
      link.click();
    }
    const exportBtn = document.getElementById('quickExportBtn');
    exportBtn.addEventListener('click', async () => {
      if (exportBusy) return;
      exportBusy = true; exportBtn.disabled = true;
      const previous = currentPreviewView;
      document.body.classList.add('exporting'); EffectEngine.pause(); window.closeTKBExport();
      exportBtn.textContent = 'Đang xuất ảnh…';
      try {
        if (hasAfternoon && isSplitMode) {
          currentPreviewView = 'morning';
          await handleExportCanvas('TKB-Sang-' + ratioSelect.value.replace(':','x') + '.png');
          currentPreviewView = 'afternoon';
          await handleExportCanvas('TKB-Chieu-' + ratioSelect.value.replace(':','x') + '.png');
        } else {
          await handleExportCanvas('TKB-' + ratioSelect.value.replace(':','x') + '.png');
        }
        // Không mở modal lớn tự động; thông báo gọn tự biến mất sau 6 giây.
        exportToast('Đã tạo ' + exportURLs.length + ' ảnh PNG. Nếu máy không tự tải, chọn Xuất & sao lưu → Tải thủ công.');
      } catch (e) {
        exportToast('Xuất ảnh thất bại: ' + (e && e.message || e), true);
      } finally {
        currentPreviewView = previous;
        previewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === previous));
        exportBusy = false; exportBtn.disabled = false; exportBtn.textContent = 'Xuất PNG';
        document.body.classList.remove('exporting'); draw();
        if (!document.hidden && !document.getElementById('low-effects').checked) EffectEngine.resume();
      }
    });
    // Khi bấm Xem từ trang Xuất & sao lưu, người dùng vẫn có thể chia sẻ ảnh.
    document.getElementById('shareImageBtn').addEventListener('click', async () => {
      if (currentExportBlob && navigator.share && navigator.canShare) {
        const file = new File([currentExportBlob], 'thoi-khoa-bieu.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Thiết kế Thời khóa biểu',
              text: 'Ảnh thời khóa biểu của bạn',
              files: [file]
            });
            return;
          } catch (e) {}
        }
      }
      alert('Bạn có thể tải ảnh bằng nút Tải thủ công ở mục Xuất & sao lưu.');
    });
    function closeExportPreview() {
      document.getElementById('previewModal').style.display = 'none';
      // Không thu hồi URL tại đây: ảnh vẫn có thể tải thủ công cho tới lần xuất kế tiếp.
    }
    document.getElementById('closeModal').onclick = closeExportPreview;
    document.getElementById('previewModal').addEventListener('click', e => {
      if (e.target.id === 'previewModal') closeExportPreview();
    });

    // ==========================================
    // 7.1 XÓA TẤT CẢ DỮ LIỆU & ĐƯA VỀ TRẠNG THÁI TRỐNG
    // ==========================================
    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        const confirmed = window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu Thời Khóa Biểu về trạng thái trống không?\n\nThao tác này sẽ làm trống toàn bộ các tiết để bạn tự nhập lại từ đầu!");
        if (!confirmed) return;

        morningData = [
          { p: "1", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "2", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "3", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "4", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "5", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] }
        ];
        afternoonData = [
          { p: "C1", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "C2", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] },
          { p: "C3", d: [{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""},{s:"-",t:""}] }
        ];
        safeSet('tkb_morning', morningData);
        safeSet('tkb_afternoon', afternoonData);

        renderQuickEditor();
        draw();
      };
    }

    // ==========================================
    // 8. ĐĂNG KÝ SERVICE WORKER CHO OFFLINE 100%
    // ==========================================
    renderQuickEditor();
    draw();
  
