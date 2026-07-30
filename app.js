// ============ التخزين (localStorage) ============
const STORAGE_KEY = 'production_tracker_data_v1';

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error('خطأ في قراءة البيانات', e); }
  return { employees: [], models: [], sessions: [] };
}

function saveData(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  }catch(e){
    console.error('خطأ في الحفظ', e);
    showToast('⚠️ فشل الحفظ - المساحة ممتلئة؟');
  }
}

let DB = loadData();

// ============ أدوات مساعدة ============
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function formatTime(totalSeconds){
  const h = Math.floor(totalSeconds/3600);
  const m = Math.floor((totalSeconds%3600)/60);
  const s = Math.floor(totalSeconds%60);
  const pad = n => String(n).padStart(2,'0');
  return h>0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function confirmAction(msg){ return window.confirm(msg); }

// ============ التنقل بين الصفحات ============
const pages = ['track','employees','models','reports'];
function renderAll(){
  renderTrackPage();
  renderEmployeesPage();
  renderModelsPage();
  renderReportsPage();
}

document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    if(btn.dataset.page === 'reports') renderReportsPage();
  });
});

renderAll();

// ============ صفحة الموظفين ============
function renderEmployeesPage(){
  const el = document.getElementById('page-employees');
  el.innerHTML = `
    <div class="card">
      <h3>➕ إضافة موظف جديد</h3>
      <label>اسم الموظف</label>
      <input type="text" id="emp-name" placeholder="مثال: عامل 1" />
      <label>المرتب الشهري (جنيه)</label>
      <input type="number" id="emp-salary" placeholder="مثال: 8000" />
      <button class="btn full" id="emp-add-btn">إضافة الموظف</button>
    </div>
    <div class="card">
      <h3>👥 قائمة الموظفين (${DB.employees.length})</h3>
      <div id="emp-list"></div>
    </div>
  `;

  document.getElementById('emp-add-btn').addEventListener('click', ()=>{
    const nameInput = document.getElementById('emp-name');
    const salaryInput = document.getElementById('emp-salary');
    const name = nameInput.value.trim();
    const salary = parseFloat(salaryInput.value);
    if(!name){ showToast('⚠️ اكتب اسم الموظف'); nameInput.focus(); return; }
    if(!salary || salary <= 0){ showToast('⚠️ اكتب مرتب صحيح'); salaryInput.focus(); return; }
    DB.employees.push({ id: uid(), name, salary, createdAt: Date.now() });
    saveData();
    showToast('✅ تم إضافة ' + name);
    renderEmployeesPage();
    renderTrackPage();
  });

  const listEl = document.getElementById('emp-list');
  if(DB.employees.length === 0){
    listEl.innerHTML = '<div class="empty">لسه معملتش موظفين. ابدأ بإضافة أول موظف فوق ⬆️</div>';
    return;
  }
  listEl.innerHTML = DB.employees.map(emp => `
    <div class="list-item">
      <div class="info">
        <div class="name">${escapeHtml(emp.name)}</div>
        <div class="sub">${emp.salary.toLocaleString('en-US')} جنيه/شهر</div>
      </div>
      <div class="actions">
        <button class="icon-btn" onclick="editEmployee('${emp.id}')">✏️</button>
        <button class="icon-btn del" onclick="deleteEmployee('${emp.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function editEmployee(id){
  const emp = DB.employees.find(e=>e.id===id);
  if(!emp) return;
  const newName = prompt('اسم الموظف:', emp.name);
  if(newName === null) return;
  const newSalary = prompt('المرتب الشهري:', emp.salary);
  if(newSalary === null) return;
  if(!newName.trim() || !parseFloat(newSalary)){ showToast('⚠️ بيانات غير صحيحة'); return; }
  emp.name = newName.trim();
  emp.salary = parseFloat(newSalary);
  saveData();
  showToast('✅ تم التعديل');
  renderEmployeesPage();
  renderTrackPage();
}

function deleteEmployee(id){
  const emp = DB.employees.find(e=>e.id===id);
  if(!emp) return;
  const hasSessions = DB.sessions.some(s=>s.employeeId===id);
  const msg = hasSessions
    ? `${emp.name} ليه جلسات تتبع مسجلة. حذفه مش هيمسح الجلسات القديمة بس هتفضل باسمه القديم. متأكد؟`
    : `متأكد من حذف ${emp.name}؟`;
  if(!confirmAction(msg)) return;
  DB.employees = DB.employees.filter(e=>e.id!==id);
  saveData();
  showToast('🗑️ تم الحذف');
  renderEmployeesPage();
  renderTrackPage();
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ صفحة الموديلات ============
let tempStages = []; // المراحل المؤقتة أثناء إنشاء موديل جديد

function renderModelsPage(){
  const el = document.getElementById('page-models');
  el.innerHTML = `
    <div class="card">
      <h3>➕ إضافة موديل جديد</h3>
      <label>اسم الموديل</label>
      <input type="text" id="model-name" placeholder="مثال: تيشرت كلاسيك" />
      <label>مراحل الإنتاج</label>
      <div class="row" style="margin-bottom:10px;">
        <input type="text" id="stage-name-input" placeholder="اسم المرحلة مثال: خياطة الأكمام" style="margin-bottom:0;" />
        <button class="btn ghost" id="add-stage-btn" style="flex:0 0 auto; padding:10px 16px;">➕</button>
      </div>
      <div id="temp-stages-list"></div>
      <button class="btn full green" id="model-save-btn" style="margin-top:10px;">حفظ الموديل</button>
    </div>
    <div class="card">
      <h3>📦 الموديلات المسجلة (${DB.models.length})</h3>
      <div id="model-list"></div>
    </div>
  `;

  renderTempStages();

  document.getElementById('add-stage-btn').addEventListener('click', addTempStage);
  document.getElementById('stage-name-input').addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); addTempStage(); }
  });
  document.getElementById('model-save-btn').addEventListener('click', saveModel);

  const listEl = document.getElementById('model-list');
  if(DB.models.length === 0){
    listEl.innerHTML = '<div class="empty">لسه معملتش موديلات. ضيف موديل جديد فوق ⬆️</div>';
  } else {
    listEl.innerHTML = DB.models.map(m => `
      <div class="list-item" style="align-items:flex-start;">
        <div class="info">
          <div class="name">${escapeHtml(m.name)}</div>
          <div class="sub">${m.stages.map(s=>escapeHtml(s)).join(' ← ')}</div>
        </div>
        <div class="actions">
          <button class="icon-btn del" onclick="deleteModel('${m.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }
}

function renderTempStages(){
  const el = document.getElementById('temp-stages-list');
  if(!el) return;
  if(tempStages.length === 0){
    el.innerHTML = '<div class="empty" style="padding:14px;">ضيف مرحلة واحدة على الأقل</div>';
    return;
  }
  el.innerHTML = tempStages.map((s,i) => `
    <div class="list-item">
      <div class="info">
        <div class="name">${i+1}. ${escapeHtml(s)}</div>
      </div>
      <div class="actions">
        <button class="icon-btn del" onclick="removeTempStage(${i})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function addTempStage(){
  const input = document.getElementById('stage-name-input');
  const val = input.value.trim();
  if(!val){ showToast('⚠️ اكتب اسم المرحلة'); return; }
  tempStages.push(val);
  input.value = '';
  input.focus();
  renderTempStages();
}

function removeTempStage(i){
  tempStages.splice(i,1);
  renderTempStages();
}

function saveModel(){
  const nameInput = document.getElementById('model-name');
  const name = nameInput.value.trim();
  if(!name){ showToast('⚠️ اكتب اسم الموديل'); nameInput.focus(); return; }
  if(tempStages.length === 0){ showToast('⚠️ ضيف مرحلة واحدة على الأقل'); return; }
  DB.models.push({ id: uid(), name, stages: [...tempStages], createdAt: Date.now() });
  saveData();
  showToast('✅ تم حفظ موديل ' + name);
  tempStages = [];
  renderModelsPage();
  renderTrackPage();
}

function deleteModel(id){
  const model = DB.models.find(m=>m.id===id);
  if(!model) return;
  if(!confirmAction(`متأكد من حذف موديل "${model.name}"؟`)) return;
  DB.models = DB.models.filter(m=>m.id!==id);
  saveData();
  showToast('🗑️ تم الحذف');
  renderModelsPage();
  renderTrackPage();
}

// ============ صفحة التتبع (العداد الحي) ============
let activeSession = null; // { modelId, stageName, employeeId, startTime, pieces:[timestamps], intervalId }

function renderTrackPage(){
  const el = document.getElementById('page-track');

  if(!activeSession){
    // شاشة الإعداد قبل بدء الجلسة
    if(DB.employees.length === 0 || DB.models.length === 0){
      el.innerHTML = `
        <div class="card">
          <div class="empty">
            محتاج تضيف موظفين وموديلات الأول قبل ما تبدأ التتبع.<br><br>
            ${DB.employees.length===0 ? '👥 ضيف موظف من تبويب "الموظفين"<br>' : ''}
            ${DB.models.length===0 ? '📦 ضيف موديل من تبويب "الموديلات"' : ''}
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="card">
        <h3>⏱ بدء جلسة تتبع جديدة</h3>
        <label>الموديل</label>
        <select id="track-model">
          <option value="">-- اختر الموديل --</option>
          ${DB.models.map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
        <label>المرحلة</label>
        <select id="track-stage" disabled>
          <option value="">-- اختر الموديل الأول --</option>
        </select>
        <label>الموظف</label>
        <select id="track-employee">
          <option value="">-- اختر الموظف --</option>
          ${DB.employees.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
        </select>
        <button class="btn full green" id="start-session-btn" style="margin-top:8px;">▶️ ابدأ الجلسة</button>
      </div>
    `;

    const modelSelect = document.getElementById('track-model');
    const stageSelect = document.getElementById('track-stage');
    modelSelect.addEventListener('change', ()=>{
      const model = DB.models.find(m=>m.id===modelSelect.value);
      if(!model){
        stageSelect.innerHTML = '<option value="">-- اختر الموديل الأول --</option>';
        stageSelect.disabled = true;
        return;
      }
      stageSelect.disabled = false;
      stageSelect.innerHTML = '<option value="">-- اختر المرحلة --</option>' +
        model.stages.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    });

    document.getElementById('start-session-btn').addEventListener('click', ()=>{
      const modelId = modelSelect.value;
      const stageName = stageSelect.value;
      const employeeId = document.getElementById('track-employee').value;
      if(!modelId){ showToast('⚠️ اختر الموديل'); return; }
      if(!stageName){ showToast('⚠️ اختر المرحلة'); return; }
      if(!employeeId){ showToast('⚠️ اختر الموظف'); return; }

      activeSession = {
        modelId, stageName, employeeId,
        startTime: Date.now(),
        pieces: []
      };
      renderTrackPage();
    });
    return;
  }

  // شاشة الجلسة النشطة
  const model = DB.models.find(m=>m.id===activeSession.modelId);
  const employee = DB.employees.find(e=>e.id===activeSession.employeeId);
  const count = activeSession.pieces.length;

  el.innerHTML = `
    <div class="card">
      <div class="session-active-badge"><span class="dot"></span> جلسة شغالة</div>
      <div style="text-align:center; font-size:13px; color:var(--text-dim); margin-bottom:4px;">
        ${escapeHtml(employee ? employee.name : '؟')} — ${escapeHtml(model ? model.name : '؟')} — ${escapeHtml(activeSession.stageName)}
      </div>
      <div class="timer-display">
        <div class="count" id="piece-count">${count}</div>
        <div class="label">قطعة</div>
        <div class="clock" id="elapsed-clock">00:00</div>
        <div class="rate-display" id="rate-display">—</div>
      </div>
      <button class="produce-btn" id="produce-btn">✅ أنتج قطعة</button>
      <div class="row">
        <button class="btn ghost" id="undo-btn">↩️ تراجع عن آخر قطعة</button>
        <button class="btn ghost" id="reset-btn">🔄 إعادة ضبط العداد</button>
      </div>
      <button class="btn full red" id="finish-btn" style="margin-top:10px;">⏹ إنهاء الجلسة</button>
    </div>
    ${count > 0 ? renderPiecesLog() : ''}
  `;

  document.getElementById('produce-btn').addEventListener('click', ()=>{
    activeSession.pieces.push(Date.now());
    updateLiveDisplay();
    renderPiecesLogInto();
  });

  document.getElementById('undo-btn').addEventListener('click', ()=>{
    if(activeSession.pieces.length === 0){ showToast('مفيش قطع لسه'); return; }
    activeSession.pieces.pop();
    updateLiveDisplay();
    renderPiecesLogInto();
    showToast('↩️ اتلغت آخر قطعة');
  });

  document.getElementById('reset-btn').addEventListener('click', ()=>{
    if(activeSession.pieces.length === 0) return;
    if(!confirmAction('متأكد من إعادة ضبط العداد؟ هيتصفر العدد بس الجلسة هتفضل شغالة.')) return;
    activeSession.pieces = [];
    updateLiveDisplay();
    renderPiecesLogInto();
    showToast('🔄 اتصفر العداد');
  });

  document.getElementById('finish-btn').addEventListener('click', finishSession);

  startLiveTimer();
}

function renderPiecesLog(){
  return `<div class="card" id="pieces-log-card"><h3>سجل القطع</h3><div id="pieces-log"></div></div>`;
}

function renderPiecesLogInto(){
  const logCard = document.getElementById('pieces-log-card');
  const track = document.getElementById('page-track');
  if(activeSession.pieces.length === 0){
    if(logCard) logCard.remove();
    return;
  }
  if(!logCard){
    track.insertAdjacentHTML('beforeend', renderPiecesLog());
  }
  const logEl = document.getElementById('pieces-log');
  const rows = activeSession.pieces.map((ts,i)=>{
    const prev = i===0 ? activeSession.startTime : activeSession.pieces[i-1];
    const gap = Math.round((ts-prev)/1000);
    return `<tr><td>${i+1}</td><td>${new Date(ts).toLocaleTimeString('ar-EG')}</td><td>${gap} ث</td></tr>`;
  }).reverse().join('');
  logEl.innerHTML = `<table><tr><th>#</th><th>الوقت</th><th>المدة</th></tr>${rows}</table>`;
}

let liveTimerInterval = null;
function startLiveTimer(){
  clearInterval(liveTimerInterval);
  updateLiveDisplay();
  liveTimerInterval = setInterval(updateLiveDisplay, 1000);
}

function updateLiveDisplay(){
  if(!activeSession) { clearInterval(liveTimerInterval); return; }
  const elapsedSec = (Date.now() - activeSession.startTime)/1000;
  const clockEl = document.getElementById('elapsed-clock');
  const countEl = document.getElementById('piece-count');
  const rateEl = document.getElementById('rate-display');
  if(clockEl) clockEl.textContent = formatTime(elapsedSec);
  if(countEl) countEl.textContent = activeSession.pieces.length;
  if(rateEl){
    const n = activeSession.pieces.length;
    if(n === 0){
      rateEl.textContent = 'هتظهر السرعة بعد أول قطعة';
    } else {
      const avgSecPerPiece = elapsedSec / n;
      const perHour = 3600/avgSecPerPiece;
      rateEl.textContent = `متوسط ${Math.round(avgSecPerPiece)} ث/قطعة — تقريباً ${perHour.toFixed(1)} قطعة/ساعة`;
    }
  }
}

function finishSession(){
  if(activeSession.pieces.length === 0){
    if(!confirmAction('الجلسة دي معملتش ولا قطعة. عايز تنهيها من غير حفظ؟')) return;
    activeSession = null;
    clearInterval(liveTimerInterval);
    renderTrackPage();
    return;
  }
  if(!confirmAction(`إنهاء الجلسة وحفظها؟ (${activeSession.pieces.length} قطعة)`)) return;

  const endTime = Date.now();
  DB.sessions.push({
    id: uid(),
    modelId: activeSession.modelId,
    stageName: activeSession.stageName,
    employeeId: activeSession.employeeId,
    startTime: activeSession.startTime,
    endTime,
    pieceCount: activeSession.pieces.length,
    pieceTimestamps: activeSession.pieces,
    totalSeconds: Math.round((endTime - activeSession.startTime)/1000)
  });
  saveData();
  showToast('✅ اتحفظت الجلسة');
  activeSession = null;
  clearInterval(liveTimerInterval);
  renderTrackPage();
  renderReportsPage();
}

// ============ صفحة التقارير ============
function renderReportsPage(){
  const el = document.getElementById('page-reports');

  if(DB.sessions.length === 0){
    el.innerHTML = `
      <div class="card">
        <div class="empty">لسه معملتش أي جلسة تتبع محفوظة.<br>ابدأ جلسة من تبويب "التتبع" وسجل قطع، وبعدين اضغط "إنهاء الجلسة".</div>
      </div>
    `;
    return;
  }

  const totalPieces = DB.sessions.reduce((a,s)=>a+s.pieceCount,0);
  const totalSessions = DB.sessions.length;

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="v">${totalSessions}</div><div class="l">جلسة محفوظة</div></div>
      <div class="stat-card"><div class="v">${totalPieces}</div><div class="l">قطعة مسجلة</div></div>
    </div>

    <div class="card">
      <h3>⚡ متوسط الثانية لكل قطعة (حسب المرحلة والعامل)</h3>
      <div id="stage-summary"></div>
    </div>

    <div class="card">
      <h3>📋 كل الجلسات</h3>
      <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
        <button class="btn ghost" id="export-btn" style="padding:6px 12px; font-size:12px;">⬇️ تصدير CSV</button>
      </div>
      <div id="sessions-list"></div>
    </div>
  `;

  renderStageSummary();
  renderSessionsList();
  document.getElementById('export-btn').addEventListener('click', exportCSV);
}

function empName(id){
  const e = DB.employees.find(x=>x.id===id);
  return e ? e.name : '(محذوف)';
}
function modelName(id){
  const m = DB.models.find(x=>x.id===id);
  return m ? m.name : '(محذوف)';
}

function renderStageSummary(){
  const el = document.getElementById('stage-summary');
  // تجميع حسب موديل+مرحلة+عامل
  const groups = {};
  DB.sessions.forEach(s=>{
    const key = `${s.modelId}|||${s.stageName}|||${s.employeeId}`;
    if(!groups[key]) groups[key] = { modelId:s.modelId, stageName:s.stageName, employeeId:s.employeeId, pieces:0, seconds:0, sessions:0 };
    groups[key].pieces += s.pieceCount;
    groups[key].seconds += s.totalSeconds;
    groups[key].sessions += 1;
  });

  const rows = Object.values(groups).sort((a,b)=> (a.seconds/a.pieces) - (b.seconds/b.pieces));
  if(rows.length === 0){ el.innerHTML = '<div class="empty">لا يوجد بيانات</div>'; return; }

  el.innerHTML = `<table>
    <tr><th>العامل</th><th>المرحلة</th><th>ث/قطعة</th><th>قطعة/ساعة</th><th>إجمالي القطع</th></tr>
    ${rows.map(r=>{
      const secPerPiece = r.seconds / r.pieces;
      const perHour = 3600/secPerPiece;
      return `<tr>
        <td>${escapeHtml(empName(r.employeeId))}</td>
        <td>${escapeHtml(r.stageName)}</td>
        <td><b>${secPerPiece.toFixed(1)}</b></td>
        <td>${perHour.toFixed(1)}</td>
        <td>${r.pieces}</td>
      </tr>`;
    }).join('')}
  </table>`;
}

function renderSessionsList(){
  const el = document.getElementById('sessions-list');
  const sorted = [...DB.sessions].sort((a,b)=>b.startTime-a.startTime);
  el.innerHTML = sorted.map(s=>{
    const secPerPiece = s.pieceCount>0 ? (s.totalSeconds/s.pieceCount).toFixed(1) : '-';
    const date = new Date(s.startTime).toLocaleDateString('ar-EG');
    const time = new Date(s.startTime).toLocaleTimeString('ar-EG');
    return `<div class="list-item" style="align-items:flex-start;">
      <div class="info">
        <div class="name">${escapeHtml(empName(s.employeeId))} — ${escapeHtml(s.stageName)}</div>
        <div class="sub">${escapeHtml(modelName(s.modelId))} · ${date} ${time} · ${s.pieceCount} قطعة · ${formatTime(s.totalSeconds)} · <span class="badge amber">${secPerPiece} ث/قطعة</span></div>
      </div>
      <div class="actions">
        <button class="icon-btn del" onclick="deleteSession('${s.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function deleteSession(id){
  if(!confirmAction('متأكد من حذف الجلسة دي؟')) return;
  DB.sessions = DB.sessions.filter(s=>s.id!==id);
  saveData();
  showToast('🗑️ اتحذفت');
  renderReportsPage();
}

function exportCSV(){
  const headers = ['التاريخ','الوقت','العامل','الموديل','المرحلة','عدد القطع','المدة (ثانية)','ثانية/قطعة'];
  const rows = DB.sessions.map(s=>[
    new Date(s.startTime).toLocaleDateString('en-GB'),
    new Date(s.startTime).toLocaleTimeString('en-GB'),
    empName(s.employeeId),
    modelName(s.modelId),
    s.stageName,
    s.pieceCount,
    s.totalSeconds,
    s.pieceCount>0 ? (s.totalSeconds/s.pieceCount).toFixed(1) : ''
  ]);
  let csv = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(r=>{ csv += r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',') + '\n'; });

  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `تقرير_الانتاج_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ تم تصدير الملف');
}
