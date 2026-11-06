'use strict';
// Hikarii History admin: bulk selection / publish / hide / trash / restore.
// Server-side permission checks and validation remain authoritative.
let selected = null;
let items = [];
const checkedIds = new Set();
let filterMode = 'all';
let queryText = '';let adminCategory='all';let adminTopic='';
let working = false;
let explainWork = false;
let explainPreview = null;
const explainChosen = new Set();

function examStatus(e) {
  return e.status || (e.trashed ? 'trashed' : e.hidden ? 'hidden' : e.published ? 'published' : 'draft');
}
function statusText(st) {
  return ({ published: 'Đã đăng', hidden: 'Đã ẩn', draft: 'Bản nháp', trashed: 'Thùng rác' })[st] || st;
}
function shownExams() {
  return items.slice().sort((a,b)=>naturalCompare(a.title,b.title)).filter(e => {
    const st = examStatus(e);
    const statusOK = filterMode === 'all' || st === filterMode || (filterMode === 'errors' && (e.errors || []).length > 0) || (filterMode === 'missing-explanations' && (!e.explanations || e.explanations.filled < e.explanations.total));
    const searchOK = !queryText || (e.title || '').toLocaleLowerCase().indexOf(queryText) !== -1;
    return statusOK && searchOK && (adminCategory==='all'||(e.category||'thpt')===adminCategory) && (!adminTopic||(e.topic||'').toLowerCase().includes(adminTopic));
  });
}
function renderBank() {
  const purge=$('[data-action="purge-selected"]');if(purge){purge.hidden=filterMode!=='trashed';purge.disabled=working||explainWork||!checkedIds.size;}
  const bank = $('#exam-bank');
  if (!bank) return;
  const visible = shownExams();
  const allVisible = visible.length > 0 && visible.every(e => checkedIds.has(e.id));
  const someVisible = visible.some(e => checkedIds.has(e.id));
  const counts = { all: items.length, published: 0, draft: 0, hidden: 0, trashed: 0, errors: 0, 'missing-explanations': 0 };
  items.forEach(e => { counts[examStatus(e)]++; if ((e.errors || []).length) counts.errors++; if (!e.explanations || e.explanations.filled < e.explanations.total) counts['missing-explanations']++; });
  const filterSelect = $('#bank-filter');
  if (filterSelect) {
    Array.from(filterSelect.options).forEach(opt => {opt.textContent = statusText(opt.value) === opt.value && opt.value === 'all' ? 'Tất cả (' + counts.all + ')' : (opt.value === 'all' ? 'Tất cả' : opt.value === 'errors' ? 'Có lỗi' : opt.value === 'missing-explanations' ? 'Thiếu lời giải' : statusText(opt.value)) + ' (' + (counts[opt.value] || 0) + ')'; });
    filterSelect.value = filterMode;
  }
  const cb = $('#check-visible');
  if (cb) { cb.checked = allVisible; cb.indeterminate = someVisible && !allVisible; cb.disabled = visible.length === 0 || working; }
  const selectedCount = checkedIds.size;
  const selectedLabel = $('#selected-count');
  if (selectedLabel) selectedLabel.textContent = 'Đã chọn ' + selectedCount + ' đề · Đang hiện ' + visible.length + '/' + items.length;
  ['publish-selected','hide-selected','trash-selected','restore-selected','clear-selected'].forEach(action => {
    const b = document.querySelector('[data-action="' + action + '"]');
    if (b) b.disabled = working || explainWork || selectedCount === 0;
  });
  const publishAll = document.querySelector('[data-action="publish-all"]');
  if (publishAll) publishAll.disabled = working || explainWork || !items.some(e => examStatus(e) === 'draft' || examStatus(e) === 'hidden');
  bank.innerHTML = visible.length ? visible.map(e => {
    const st = examStatus(e), isChecked = checkedIds.has(e.id);
    return '<article class="hk-panel hk-exam-card' + (isChecked ? ' hk-exam-selected' : '') + '">' +
      '<div class="hk-exam-top"><label class="hk-select-label"><input class="hk-exam-check" type="checkbox" data-select-id="' + e.id + '"' + (isChecked ? ' checked' : '') + (working ? ' disabled' : '') + '> Chọn</label>' +
      '<span class="hk-pill hk-state-' + st + '">' + statusText(st) + '</span></div>' +
      '<h3>' + esc(e.title) + '</h3><p>'+esc(categories[e.category||'thpt'])+(e.topic?' · '+esc(e.topic):'')+'</p><p>' + e.questions + ' câu · ' + e.minutes + ' phút</p>' +
      '<p class="hk-muted">Lời giải: ' + (e.explanations ? e.explanations.filled + '/' + e.explanations.total : '—') + '</p>' +
      ((e.errors || []).length ? '<p class="hk-error">' + esc(e.errors.join('; ')) + '</p>' : '') +
      '<div class="hk-pills">' + (st === 'trashed' ? '<button class="hk-button" data-action="restore-one:' + e.id + '">Khôi phục</button>'+btn('Xóa vĩnh viễn','purge-one:'+e.id) : btn('Xem / sửa / đăng', 'edit:' + e.id)) + '</div></article>';
  }).join('') : '<div class="hk-panel hk-muted">Không có đề phù hợp với bộ lọc.</div>';
}

async function load() {
  try {
    items = (await api('/api/admin/history')).sort((a,b)=>naturalCompare(a.title,b.title));
    const realIds = new Set(items.map(e => e.id));
    Array.from(checkedIds).forEach(id => { if (!realIds.has(id)) checkedIds.delete(id); });
    view.innerHTML = '<div class="hk-row"><h1>Ngân hàng đề Lịch sử</h1><a href="/admin">← Quản trị máy chủ</a></div>' +
      '<section class="hk-panel"><h2>Nhập đề Word / ZIP</h2><p>Mỗi file một đề theo mẫu Hikarii: 24 câu A–D, 4 câu đúng/sai và hai bảng đáp án cuối file. Tối đa 8 MB/Word; ZIP tối đa 32 MB, 300 đề mỗi lượt. ZIP có thể chứa thư mục con. Đề đã nhập cùng tên và nội dung sẽ được bỏ qua.</p>' +
      '<div class="hk-pills"><label>Nhóm cho đề mới <select id="import-category" class="hk-search">'+categoryOptions('thpt',false)+'</select></label><label>Bài / chủ đề <input id="import-topic" class="hk-search" maxlength="100" placeholder="Ví dụ: ASEAN"></label></div><input id="files" type="file" accept=".docx,.zip" multiple><div class="hk-pills">' + btn('Tải file đã chọn','upload',true) + btn('Thử lại file lỗi / chưa xong','upload-retry')+btn('Quét thư mục data/history/import','scan')+btn('Dừng tải lên','upload-stop') + '</div><pre class="hk-job-log" id="status" aria-live="polite"></pre></section>' +
      '<section class="hk-panel hk-explanations-bulk" aria-label="Nhập lời giải hàng loạt"><h2>Nhập lời giải JSON hàng loạt</h2>' +
      '<p>Chọn một ZIP chứa nhiều file <strong>loi-giai-de-01.json…</strong>. Hệ thống ghép theo mã đề hoặc tên/số đề, kiểm tra đáp án rồi cho xem trước. Không cần nhập lại Word hay sửa đề từng cái.</p>' +
      '<input type="file" id="explain-zip" accept=".zip,.json" multiple>' +
      '<div class="hk-pills">' + btn('Kiểm tra ZIP / JSON lời giải','explain-preview',true)+btn('Thử lại file kiểm tra lỗi / đã dừng','explain-retry')+btn('Dừng tải lên','upload-stop') + btn('Tải mẫu lời giải ZIP (đề đã chọn / tất cả)','explain-template') + '</div>' +
      '<p class="hk-muted">ZIP tối đa 8 MB; JSON tối đa 512 KB/file. Gửi lần lượt từng file, có thể thử lại khi lỗi. Chỉ những file khớp một đề duy nhất và không mâu thuẫn đáp án mới được cập nhật. Xem bảng đối chiếu trước khi xác nhận.</p>' +
      '<div id="explain-preview-area" aria-live="polite"></div><pre id="explain-log" aria-live="polite"></pre></section>' +
      '<div class="hk-row"><h2>Đề đã nhập</h2></div><section class="hk-panel hk-bank-tools" aria-label="Quản lý đề hàng loạt">' +
      '<div class="hk-bank-filters"><label>Bộ lọc <select id="bank-filter" class="hk-search"><option value="all"></option><option value="draft"></option><option value="published"></option><option value="hidden"></option><option value="trashed"></option><option value="errors"></option><option value="missing-explanations"></option></select></label>' +
      '<label>Nhóm đề <select id="admin-category" class="hk-search">'+categoryOptions(adminCategory,true)+'</select></label><label>Bài / chủ đề <input id="admin-topic" class="hk-search" value="'+esc(adminTopic)+'"></label><label>Tìm đề <input id="bank-search" class="hk-search" type="search" placeholder="Nhập tên đề..." value="' + esc(queryText) + '"></label></div>' +
      '<div class="hk-select-bar"><label class="hk-select-label"><input type="checkbox" id="check-visible"> Chọn tất cả đang hiển thị</label><span id="selected-count" class="hk-muted" aria-live="polite"></span></div>' +
      '<div class="hk-pills hk-bulk-actions">' + btn('Đăng tất cả đề hợp lệ','publish-all',true) + btn('Đăng đã chọn','publish-selected') + btn('Ẩn đã chọn','hide-selected') + btn('Xóa đã chọn','trash-selected') + btn('Khôi phục đã chọn','restore-selected')+btn('Xóa vĩnh viễn đã chọn','purge-selected') + btn('Bỏ chọn','clear-selected') + '</div>' +
      '<div class="hk-pills"><label>Chuyển đề đã chọn vào <select id="bulk-category" class="hk-search">'+categoryOptions('thpt',false)+'</select></label><label>Bài / chủ đề <input id="bulk-topic" class="hk-search" maxlength="100"></label>'+btn('Lưu phân loại đã chọn','classify')+'</div><p class="hk-muted">“Chọn tất cả” theo bộ lọc hiện tại. Xóa chỉ chuyển vào Thùng rác, có thể khôi phục. Đề sai cấu trúc sẽ không được đăng.</p><pre id="bulk-result" aria-live="polite"></pre></section>' +
      '<div id="exam-bank" class="hk-grid" aria-live="polite"></div><div id="editor"></div>';
    $('#admin-category').onchange=e=>{adminCategory=e.target.value;renderBank();};$('#admin-topic').oninput=e=>{adminTopic=e.target.value.toLowerCase().trim();renderBank();};$('#bank-filter').value = filterMode;
    $('#bank-search').addEventListener('input', function () { queryText = this.value.toLocaleLowerCase().trim(); renderBank(); });
    $('#bank-filter').addEventListener('change', function () { filterMode = this.value; renderBank(); });
    $('#check-visible').addEventListener('change', function () {
      const checked = this.checked;
      shownExams().forEach(e => { if (checked) checkedIds.add(e.id); else checkedIds.delete(e.id); });
      renderBank();
    });
    renderBank();
    renderExplanationPreview();renderQueues();if(window.hkFrameAdmin)window.hkFrameAdmin();
  } catch (e) {
    if(e.status!==401&&e.status!==403){view.innerHTML='<h1>Chưa tải được quản trị</h1><p>'+esc(e.message)+'</p><button class="hk-button" id="retry-load">Thử lại</button>';$('#retry-load').onclick=load;return;}
    view.innerHTML = '<section class="hk-panel"><h1>Đăng nhập quản trị</h1><p>Dùng mật khẩu quản trị hiện có.</p><form id="login"><input type="password" id="password" autocomplete="current-password" required><button class="hk-button hk-primary">Đăng nhập</button></form><p id="loginerror" role="alert"></p></section>';
    $('#login').onsubmit = async ev => { ev.preventDefault(); try { await api('/api/admin/login', {password: $('#password').value}); load(); } catch (err) { $('#loginerror').textContent = err.message; } };
  }
}

async function edit(id) {
  selected = await api('/api/admin/history/' + id);
  if (selected.trashed) throw Error('Hãy khôi phục đề khỏi Thùng rác trước khi sửa.');
  $('#editor').innerHTML = '<section class="hk-panel"><h2>Kiểm tra đề trước khi đăng</h2><label>Tên đề <input id="title" class="hk-search" value="' + esc(selected.title) + '"></label><label> Nhóm <select id="edit-category" class="hk-search">'+categoryOptions(selected.category||'thpt',false)+'</select></label><label> Bài / chủ đề <input id="edit-topic" class="hk-search" maxlength="100" value="'+esc(selected.topic||'')+'"></label><label> Phút <input type="number" id="minutes" min="1" max="240" value="' + selected.minutes + '"></label><div class="hk-pills">' + btn('Lưu bản nháp / ẩn đề','draft') + btn('Kiểm tra và đăng đề','publish',true) + '</div><section><h3>Lời giải có sẵn</h3><p>Nhập nội dung cho từng câu hoặc tải file JSON lời giải theo mẫu. Nội dung được hiển thị sau khi nộp bài và gửi kèm khi hỏi AI.</p><div class="hk-pills"><button class="hk-button" id="explain-template" type="button">Tải mẫu file lời giải</button><label class="hk-button">Nhập file lời giải <input id="explain-import" type="file" accept=".json" hidden></label></div><div id="explanations"></div></section><details><summary>Sửa dữ liệu câu hỏi (JSON)</summary><p>mc: answer 0=A, 1=B, 2=C, 3=D. tf: answer gồm 4 giá trị true/false. Có thể thêm explanation để lưu lời giải.</p><textarea id="json"></textarea></details><div>' + selected.questions.map(q => '<section><h3>' + esc(q.type === 'mc' ? 'I' : 'II') + ' · Câu ' + q.number + '</h3><p class="hk-question">' + esc(q.text) + '</p>' + q.options.map((o, i) => '<p>' + String.fromCharCode((q.type === 'mc' ? 65 : 97) + i) + '. ' + esc(o) + '</p>').join('') + '<p><strong>Đáp án: ' + esc(q.type === 'mc' ? 'ABCD'[q.answer] : JSON.stringify(q.answer)) + '</strong></p></section>').join('') + '</div></section>';
  $('#json').value = JSON.stringify(selected.questions, null, 2);
  wireExplanations();
  $('#editor').scrollIntoView();
}

function explanationStatus(status) {
  return ({applied:'Đã cập nhật',ready:'Sẵn sàng',review:'Cần kiểm tra',unchanged:'Không thay đổi',skipped:'Bỏ qua'})[status] || status;
}
function renderExplanationPreview() {
  const area = $('#explain-preview-area');
  if (!area) return;
  if (!explainPreview) {area.innerHTML = '';return;}
  const rows=explainPreview.results || [];
  const ready=rows.filter(r=>r.status==='ready');
  const total=ready.filter(r=>explainChosen.has(r.key)).length;
  const counts=explainPreview.counts;
  area.innerHTML = '<p class="hk-notice">Đã đọc ' + rows.length + ' file lời giải · Sẵn sàng: <strong>' + counts.ready + '</strong> · Cần kiểm tra: ' + counts.review + ' · Không thay đổi: ' + counts.unchanged + ' · Bỏ qua: ' + counts.skipped + '.</p>' +
    '<div class="hk-select-bar"><label class="hk-select-label"><input type="checkbox" id="explain-select-all"' + (ready.length && ready.every(r=>explainChosen.has(r.key))?' checked':'') + (explainWork?' disabled':'') + '> Chọn tất cả file hợp lệ</label><span>' + total + '/' + ready.length + ' file được chọn</span></div>' +
    '<div class="hk-explain-table-wrap"><table class="hk-explain-table"><thead><tr><th>Chọn</th><th>File JSON</th><th>Đề trên website</th><th>Khớp theo</th><th>Lời giải</th><th>Trạng thái</th></tr></thead><tbody>' +
    rows.map(r=>'<tr class="hk-preview-'+r.status+'"><td>'+(r.status==='ready'?'<input type="checkbox" data-explain-key="'+esc(r.key)+'"'+(explainChosen.has(r.key)?' checked':'')+(explainWork?' disabled':'')+'>':'—')+'</td>'+
      '<td>'+esc(r.file.split('/').pop())+'</td><td>'+esc(r.matchedTitle||'Chưa tìm thấy')+'</td><td>'+esc(r.method||'—')+'</td><td>'+(r.status==='ready'||r.status==='unchanged'||r.status==='review'?('Thêm '+(r.newCount||0)+' · Thay '+(r.replaceCount||0)+' · Giữ '+(r.unchangedCount||0)):'—')+'</td><td><strong>'+explanationStatus(r.status)+'</strong>'+(r.problems&&r.problems.length?'<div class="hk-error">'+esc(r.problems.slice(0,4).join('; '))+'</div>':'')+'</td></tr>').join('')+
    '</tbody></table></div>'+
    (explainPreview.ignored&&explainPreview.ignored.length?'<details><summary>File phụ trợ bỏ qua ('+explainPreview.ignored.length+')</summary><p class="hk-muted">'+esc(explainPreview.ignored.join('; '))+'</p></details>':'')+
    '<p class="hk-muted">Lưu ý: ghép theo số/tên đề không chứng minh nội dung câu hỏi hoàn toàn giống nhau. Hãy kiểm tra các hàng đối chiếu trước khi cập nhật. Không có lời giải rỗng nào được ghi đè lên lời giải đã có; file khác đáp án hiện tại sẽ bị chặn.</p>'+
    '<button class="hk-button hk-primary" type="button" data-action="explain-apply"'+(total===0||explainWork?' disabled':'')+'>Cập nhật '+total+' file lời giải đã chọn</button>';
}
async function previewExplanations(){return checkExplanations(false);}
async function applyExplanations(){return commitExplanations();}
function downloadExplanationTemplate() {
  if(working||explainWork)return Promise.resolve();
  explainWork=true;
  const log=$('#explain-log');if(log)log.textContent='Đang tạo ZIP mẫu…';
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/history/explanations/template');xhr.timeout=70000;xhr.responseType='blob';
    xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('X-Hikarii-Admin','1');
    xhr.onload=()=>{
      if(xhr.status<200||xhr.status>=300){reject(Error('Không tạo được ZIP mẫu (HTTP '+xhr.status+').'));return;}
      const url=URL.createObjectURL(xhr.response),a=document.createElement('a');a.href=url;a.download='Hikarii-mau-loi-giai.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);resolve();
    };
    xhr.onerror=()=>reject(Error('Không kết nối được máy chủ.'));
    xhr.ontimeout=()=>reject(Error('Máy chủ phản hồi quá lâu.'));
    xhr.send(JSON.stringify({ids:Array.from(checkedIds)}));
  }).then(()=>{if(log)log.textContent='Đã tạo mẫu. Có thể điền lời giải rồi nén JSON để nhập.';}).finally(()=>{explainWork=false;});
}

function bulkActionLabel(action) {
  return ({publish: 'Đăng', hide: 'Ẩn', trash: 'Chuyển vào Thùng rác', restore: 'Khôi phục'})[action] || action;
}
async function runBulk(action, ids) {
  if (working || explainWork || !ids.length) return;
  const label = bulkActionLabel(action);
  if ((action === 'trash' || action === 'publish' || action === 'hide') && !window.confirm(label + ' ' + ids.length + ' đề?\nĐề đang làm dở có thể được tiếp tục với phiên bản cũ.')) return;
  working = true;
  renderBank();
  const output = $('#bulk-result');
  const totals = {success: 0, skipped: 0, failed: 0};
  const problems = [];
  try {
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      if (output) output.textContent = 'Đang ' + label.toLocaleLowerCase() + ': ' + Math.min(i + 20, ids.length) + '/' + ids.length + ' đề...';
      const response = await api('/api/admin/history/bulk', {action, ids: batch});
      (response.results || []).forEach(result => {
        if (result.status === 'ok') totals.success++;
        else if (result.status === 'skipped') totals.skipped++;
        else { totals.failed++; problems.push((result.title || result.id) + ': ' + (result.error || 'Không thực hiện được')); }
      });
    }
    checkedIds.clear();
    const message = label + ' hoàn tất. Thành công: ' + totals.success + ' · Bỏ qua: ' + totals.skipped + ' · Có lỗi: ' + totals.failed + '.' + (problems.length ? '\nChi tiết:\n' + problems.slice(0, 30).join('\n') : '');
    await load();
    const resultArea = $('#bulk-result');
    if (resultArea) resultArea.textContent = message;
  } catch (e) {
    // Important: server may already have committed earlier batches.
    checkedIds.clear();
    await load();
    const resultArea = $('#bulk-result');
    if (resultArea) resultArea.textContent = 'Đã xử lý ' + (totals.success + totals.skipped + totals.failed) + ' đề trước khi gặp lỗi. Hãy tải lại danh sách để kiểm tra.\n' + e.message;
  } finally { working = false; renderBank(); }
}

view.addEventListener('change',function(ev){
  if(ev.target.id==='explain-select-all'&&!explainWork&&explainPreview){
    (explainPreview.results||[]).filter(r=>r.status==='ready').forEach(r=>ev.target.checked?explainChosen.add(r.key):explainChosen.delete(r.key));renderExplanationPreview();return;
  }
  if(ev.target.matches('[data-explain-key]')&&!explainWork){
    if(ev.target.checked)explainChosen.add(ev.target.dataset.explainKey);else explainChosen.delete(ev.target.dataset.explainKey);
    renderExplanationPreview();return;
  }
});
view.addEventListener('change', function(ev) {
  const c = ev.target.closest('[data-select-id]');
  if (!c || working || explainWork) return;
  if (c.checked) checkedIds.add(c.dataset.selectId);
  else checkedIds.delete(c.dataset.selectId);
  renderBank();
});
view.onclick = async ev => {
  const b = ev.target.closest('[data-action]');
  if(!b)return;if(b.dataset.action==='upload-stop'){stopUploads();return;}if(working||explainWork||window.hkFramesBusy)return;
  const a = b.dataset.action;
  if(a==='purge-selected'){await purgeExams(Array.from(checkedIds).filter(id=>items.some(e=>e.id===id&&e.trashed)));return;}if(a.startsWith('purge-one:')){await purgeExams([a.slice(10)]);return;}
  if(a==='classify'){await classifySelected();return;}
  if(a==='explain-retry'){try{await checkExplanations(true);}catch(e){error(e);}return;}
  if(['upload','upload-retry','scan'].includes(a)){try{await runWords(a==='upload-retry'?'retry':a);}catch(e){error(e);}return;}
  if (a === 'explain-preview' || a === 'explain-apply' || a === 'explain-template') {
    try{if(a === 'explain-preview')await previewExplanations();else if(a === 'explain-apply')await applyExplanations();else await downloadExplanationTemplate();}catch(err){error(err);}return;
  }
  if (a === 'clear-selected') { checkedIds.clear(); renderBank(); return; }
  if (a === 'publish-all') { await runBulk('publish', items.filter(e => examStatus(e) === 'draft' || examStatus(e) === 'hidden').map(e => e.id)); return; }
  const bulkMatch = /^(publish|hide|trash|restore)-selected$/.exec(a);
  if (bulkMatch) { await runBulk(bulkMatch[1], Array.from(checkedIds)); return; }
  if (a.startsWith('restore-one:')) { await runBulk('restore', [a.slice(12)]); return; }
  b.disabled = true;
  try {
    if (a.startsWith('edit:')) await edit(a.slice(5));
    else if (a === 'draft' || a === 'publish') {
      if (!selected) throw Error('Chưa chọn đề để sửa');
      const r = await api('/api/admin/history/' + selected.id, {category:$('#edit-category').value,topic:$('#edit-topic').value,title: $('#title').value, minutes: Number($('#minutes').value), questions: withExplanations(), published: a === 'publish'});
      alert((r.errors || []).length ? r.errors.join('\n') : r.published ? 'Đã đăng đề' : 'Đã lưu bản nháp');
      await load();
    }
  } catch (e) { error(e); } finally { b.disabled = false; }
};

function withExplanations() {
  const qs = JSON.parse($('#json').value);
  document.querySelectorAll('[data-explanation]').forEach(el => {
    const q = qs.find(q => q.type + ':' + q.number === el.dataset.explanation);
    if (q) q.explanation = el.value.trim();
  });
  return qs;
}
function wireExplanations() {
  $('#explanations').innerHTML = selected.questions.map(q => '<details><summary>' + esc(q.type === 'mc' ? 'Phần I' : 'Phần II') + ' · Câu ' + q.number + '</summary><textarea class="hk-explain" data-explanation="' + q.type + ':' + q.number + '" aria-label="Lời giải ' + q.type + ' câu ' + q.number + '">' + esc(q.explanation || '') + '</textarea></details>').join('');
  $('#explain-template').onclick = () => download('loi-giai-' + selected.id + '.json', {format: 'hikarii-history-explanations', version: 1, examId: selected.id, title: selected.title, items: withExplanations().map(q => ({type: q.type, number: q.number, explanation: q.explanation || ''}))});
  $('#explain-import').onchange = async ev => {
    try {
      const f = ev.target.files[0];
      if (!f) return;
      if (f.size > 512 * 1024) throw Error('File lời giải tối đa 512 KB');
      const data = JSON.parse(await readFile(f,'text'));
      if (data.format !== 'hikarii-history-explanations' || data.version !== 1 || data.examId !== selected.id || !Array.isArray(data.items) || data.items.length > 28) throw Error('File sai định dạng hoặc không thuộc đề đang mở. Tải mẫu của đúng đề.');
      const seen = new Set();
      for (const item of data.items) {
        const key = item.type + ':' + item.number;
        if (!selected.questions.some(q => q.type === item.type && q.number === item.number) || seen.has(key) || typeof item.explanation !== 'string' || item.explanation.length > 12000) throw Error('Câu/lời giải không hợp lệ hoặc trùng câu');
        seen.add(key);
      }
      data.items.forEach(item => { const el = document.querySelector('[data-explanation="' + item.type + ':' + item.number + '"]'); el.value = item.explanation; });
      alert('Đã điền lời giải. Hãy xem lại rồi bấm Lưu bản nháp hoặc Đăng đề.');
    } catch (e) { error(e); } finally { ev.target.value = ''; }
  };
}
load();

async function purgeExams(ids){
 if(!ids.length||!confirm('Xóa VĨNH VIỄN '+ids.length+' đề, file nguồn và lời giải? Không thể khôi phục. Lịch sử đã nộp trên máy người học vẫn giữ, nhưng bài dở của đề này sẽ không nộp được.'))return;
 working=true;renderBank();const out=[];
 try{for(let i=0;i<ids.length;i+=10){const r=await api('/api/admin/history/purge',{ids:ids.slice(i,i+10),confirm:'permanent'});out.push(...r.results);}checkedIds.clear();await load();$('#bulk-result').textContent='Đã xóa '+out.filter(r=>r.status==='ok').length+'/'+ids.length+' đề.'+out.filter(r=>r.status!=='ok').map(r=>'\n'+r.error).join('');}catch(e){error(e);}finally{working=false;renderBank();}
}
