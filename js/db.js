/* =====================================================
   LIZA FESTAS — db.js
   Objeto db, loadData/saveData (Supabase), export/import,
   filtro por período
   ===================================================== */

let db = {
  servicos: [],   // "Festas" — nome interno mantido por compatibilidade
  materiais: [],
  atendimentos: [],
  despAdm: [],
  despExtra: [],
  agenda: [],
  temas: []
};

let currentPeriod = 'hoje';

// ===================== SUPABASE SYNC (legado: blob único) =====================
function _supaHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Prefer': 'return=minimal'
  };
}

async function _syncParaNuvem() {
  if (_sincronizando || _inicializando) return;
  _sincronizando = true;
  _atualizarStatusSync('sincronizando');
  try {
    db._savedAt = Date.now();
    var resp = await fetch(SUPA_URL + '/rest/v1/dados?id=eq.principal', {
      method: 'PATCH',
      headers: _supaHeaders(),
      body: JSON.stringify({ conteudo: db, atualizado_em: new Date().toISOString() })
    });
    if (resp.ok) {
      var now = new Date().toLocaleString('pt-BR');
      localStorage.setItem('lizafestas_lastsync', now);
      _atualizarStatusSync('ok', now);
      addLog('INFO', '☁️ Sincronizado com Supabase — ' + now);
    } else { throw new Error('HTTP ' + resp.status); }
  } catch(e) {
    _atualizarStatusSync('erro');
    addLog('WARN', '⚠️ Sync falhou: ' + e.message);
  } finally { _sincronizando = false; }
}

async function _carregarDaNuvem() {
  try {
    _atualizarStatusSync('carregando');
    var resp = await fetch(SUPA_URL + '/rest/v1/dados?id=eq.principal&select=conteudo,atualizado_em', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var rows = await resp.json();
    if (!rows || !rows.length || !rows[0].conteudo) return false;
    var dados = rows[0].conteudo;
    if (typeof dados === 'string') dados = JSON.parse(dados);
    if (!dados || typeof dados !== 'object') return false;

    db = dados;
    if (!db.servicos) db.servicos = [];
    if (!db.materiais) db.materiais = [];
    if (!db.atendimentos) db.atendimentos = [];
    if (!db.despAdm) db.despAdm = [];
    if (!db.despExtra) db.despExtra = [];
    if (!db.agenda) db.agenda = [];
    if (!db.temas) db.temas = [];
    // Campos legados removidos do modelo de dados (não recriar):
    delete db.categorias; delete db.anamneses; delete db.acomp;

    localStorage.setItem('lizafestas_db', JSON.stringify(db));
    var now = new Date().toLocaleString('pt-BR');
    localStorage.setItem('lizafestas_lastsync', now);
    _atualizarStatusSync('ok', now);
    addLog('INFO', '☁️ Dados carregados — ' + db.atendimentos.length + ' atend, ' + db.agenda.length + ' agend');
    return true;
  } catch(e) {
    addLog('WARN', '⚠️ Erro ao carregar do Supabase: ' + e.message);
    _atualizarStatusSync('offline');
    return false;
  }
}

function _atualizarStatusSync(status, hora) {
  var el = document.getElementById('lastSave');
  if (!el) return;
  if (status === 'ok') el.textContent = '☁️ Sincronizado às ' + (hora || '');
  else if (status === 'sincronizando') el.textContent = '☁️ Sincronizando...';
  else if (status === 'carregando') el.textContent = '☁️ Carregando dados...';
  else if (status === 'erro') el.textContent = '⚠️ Erro no sync (salvo local)';
  else if (status === 'offline') el.textContent = '📴 Offline — usando cache';
}

// ===================== STORAGE =====================
function saveData() {
  db._savedAt = Date.now();
  localStorage.setItem('lizafestas_db', JSON.stringify(db));
  var now = new Date().toLocaleString('pt-BR');
  localStorage.setItem('lizafestas_lastsave', now);
  addLog('INFO', '💾 Dados salvos — ' + now);
  if (_inicializando) return;
  var temDadosReais = db.atendimentos.length > 0 || db.agenda.length > 0 ||
    db.servicos.length > 0 || db.materiais.length > 0 ||
    db.despAdm.length > 0 || db.despExtra.length > 0;
  if (temDadosReais) _syncParaNuvem();
}

async function loadData() {
  var raw = localStorage.getItem('lizafestas_db');
  if (raw) { try { db = JSON.parse(raw); } catch(e) {} }
  if (!db.servicos) db.servicos = [];
  if (!db.materiais) db.materiais = [];
  if (!db.atendimentos) db.atendimentos = [];
  if (!db.despAdm) db.despAdm = [];
  if (!db.despExtra) db.despExtra = [];
  if (!db.agenda) db.agenda = [];
  if (!db.temas) db.temas = [];

  var carregouNuvem = await _carregarDaNuvem();
  if (!carregouNuvem) {
    var ls = localStorage.getItem('lizafestas_lastsync') || localStorage.getItem('lizafestas_lastsave');
    var el = document.getElementById('lastSave');
    if (ls && el) el.textContent = '📴 Offline — cache de ' + ls;
  }
}

function exportData() {
  var blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lizafestas-backup-' + _hoje() + '.json';
  a.click();
  showToast('Backup exportado com sucesso!');
}

function importData(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      db = JSON.parse(ev.target.result);
      saveData(); renderAll();
      showToast('Backup restaurado com sucesso!');
    } catch(err) { showToast('Erro ao importar arquivo.'); }
  };
  reader.readAsText(file);
}

function limparTodosDados() {
  if (!confirm('⚠️ Isso vai APAGAR todos os dados cadastrados.\n\nTem certeza?')) return;
  db.servicos = []; db.materiais = []; db.atendimentos = [];
  db.despAdm = []; db.despExtra = [];
  saveData(); renderAll();
  showToast('Todos os dados foram apagados.');
}

// ===================== PERIOD FILTER =====================
function setPeriod(p, btn) {
  currentPeriod = p;
  document.querySelectorAll('.period-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderDashboard();
}

function filterByPeriod(items, dateField) {
  var now = new Date();
  var today = now.toISOString().split('T')[0];
  return items.filter(function(item) {
    var d = item[dateField];
    if (!d) return true;
    if (currentPeriod === 'hoje') return d === today;
    if (currentPeriod === 'semana') {
      var w = new Date(now); w.setDate(w.getDate()-7);
      return d >= w.toISOString().split('T')[0];
    }
    if (currentPeriod === 'mes') return d.startsWith(now.getFullYear()+'-'+(String(now.getMonth()+1).padStart(2,'0')));
    return true;
  });
}
