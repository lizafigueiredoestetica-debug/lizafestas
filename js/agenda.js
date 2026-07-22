/* =====================================================
   LIZA FESTAS — agenda.js
   ===================================================== */

let agendaFiltroAtual = 'tudo';
let agBuscaClienteAtual = '';
let _agCalMes = new Date().getMonth();
let _agCalAno = new Date().getFullYear();
let _agCalDiaSelecionado = null;

async function salvarAgendamento() {
  const cliente = document.getElementById('ag-cliente').value.trim();
  const telefone = document.getElementById('ag-telefone').value;
  const data = document.getElementById('ag-data').value;
  const dataRetirada = document.getElementById('ag-data-retirada').value;
  const horaRetirada = document.getElementById('ag-hora-retirada').value;
  const sinal = document.getElementById('ag-sinal').value;
  const temaId = document.getElementById('ag-tema').value || null;
  const statusCor = document.getElementById('ag-status-cor').value || 'reservado';

  if (!cliente || !data) { showToast('Preencha cliente e data!'); return; }
  if (!selectedServicos.length) { showToast('Selecione ao menos uma festa!'); return; }

  const sessoes = [{ data, hora: '', servicoIds: [...selectedServicos], status: 'pendente' }];

  const novo = {
    id: uid(), cliente, telefone,
    sessoes,
    servicoIds: [...selectedServicos],
    materiais: {...selectedMateriais},
    temaId,
    dataRetirada, horaRetirada,
    sinal: parseFloat(sinal || 0),
    statusCor,
    obs: document.getElementById('ag-obs').value
  };
  db.agenda.push(novo);

  saveData(); renderAll(); limparFormAgenda();
  await dbInserir('agenda', novo);
  showToast('Agendamento criado!');
}

function limparFormAgenda() {
  ['ag-cliente','ag-telefone','ag-data-retirada','ag-hora-retirada','ag-sinal','ag-obs'].forEach(id => {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var stEl = document.getElementById('ag-status-cor'); if (stEl) stEl.value = 'reservado';
  var temaEl = document.getElementById('ag-tema'); if (temaEl) temaEl.value = '';
  selectedServicos = [];
  selectedMateriais = {};
  setToday();
  renderServiceChips();
}

function _populateTemaSelect() {
  var sel = document.getElementById('ag-tema');
  if (!sel) return;
  var atual = sel.value;
  sel.innerHTML = '<option value="">Nenhum</option>' + db.temas.map(t => `<option value="${t.id}">${t.nome}</option>`).join('');
  sel.value = atual;
}

function setAgendaFiltro(filtro, btn) {
  agendaFiltroAtual = filtro;
  _agCalDiaSelecionado = null;
  document.querySelectorAll('.agenda-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAgenda();
}

// ===================== CALENDÁRIO MENSAL =====================
function mudarMesCalendario(delta) {
  _agCalMes += delta;
  if (_agCalMes > 11) { _agCalMes = 0; _agCalAno++; }
  if (_agCalMes < 0) { _agCalMes = 11; _agCalAno--; }
  renderAgendaCalendario();
}

function _statusDoDia(dataIso) {
  // Prioriza o status mais "forte": alugado > personalizado > credito > reservado > devolveu
  const prioridade = ['alugado','personalizado','credito','reservado','devolveu'];
  const ags = db.agenda.filter(ag => ag.sessoes.some(s => s.data === dataIso));
  if (!ags.length) return null;
  for (const p of prioridade) { if (ags.some(a => a.statusCor === p)) return p; }
  return ags[0].statusCor;
}

function renderAgendaCalendario() {
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const titulo = document.getElementById('agCalendarioTitulo');
  if (titulo) titulo.textContent = nomesMes[_agCalMes] + ' de ' + _agCalAno;

  const primeiroDia = new Date(_agCalAno, _agCalMes, 1);
  const ultimoDia = new Date(_agCalAno, _agCalMes + 1, 0);
  const diaSemanaInicio = primeiroDia.getDay();
  const totalDias = ultimoDia.getDate();
  const hoje = _hoje();

  let celulas = '';
  for (let i = 0; i < diaSemanaInicio; i++) celulas += '<div></div>';
  for (let d = 1; d <= totalDias; d++) {
    const iso = _agCalAno + '-' + String(_agCalMes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const status = _statusDoDia(iso);
    const cor = status && _coresStatus[status] ? _coresStatus[status] : null;
    const isHoje = iso === hoje;
    const isSelecionado = iso === _agCalDiaSelecionado;
    celulas += `<div onclick="selecionarDiaCalendario('${iso}')" style="
      aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-size:13px;
      background:${cor ? cor.bg : '#fff'};
      border:2px solid ${isSelecionado ? 'var(--rose)' : (cor ? cor.border : 'var(--border)')};
      font-weight:${isHoje ? '700':'400'};
      color:${cor ? cor.border : 'var(--text)'}">${d}</div>`;
  }

  const grid = document.getElementById('agCalendarioGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;font-size:11px;color:var(--text-light);text-align:center">
      <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${celulas}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--text-light)">
      ${Object.entries(_coresStatus).map(([k,c]) => `<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:${c.border};display:inline-block"></span>${c.label.split(' ').slice(1).join(' ')}</span>`).join('')}
    </div>`;
}

function selecionarDiaCalendario(iso) {
  _agCalDiaSelecionado = (_agCalDiaSelecionado === iso) ? null : iso;
  renderAgendaCalendario();
  renderAgenda();
}

// ===================== LISTAGEM / FILTRO =====================
function renderAgenda() {
  _populateTemaSelect();
  renderAgendaCalendario();
  agBuscaClienteAtual = (document.getElementById('agBuscaCliente')?.value || '').toLowerCase();
  const hoje = _hoje();
  let items = [...db.agenda];

  if (agBuscaClienteAtual) items = items.filter(ag => ag.cliente.toLowerCase().includes(agBuscaClienteAtual));
  if (_agCalDiaSelecionado) items = items.filter(ag => ag.sessoes.some(s => s.data === _agCalDiaSelecionado));
  else if (agendaFiltroAtual === 'hoje') items = items.filter(ag => ag.sessoes.some(s => s.data === hoje));
  else if (agendaFiltroAtual === 'pendentes') items = items.filter(ag => ag.sessoes.some(s => s.status === 'pendente'));
  else if (agendaFiltroAtual === 'realizados') items = items.filter(ag => ag.sessoes.every(s => s.status === 'realizado'));

  items.sort((a, b) => (a.sessoes[0]?.data||'').localeCompare(b.sessoes[0]?.data||''));

  const cont = document.getElementById('agendaLista');
  if (!cont) return;
  if (!items.length) { cont.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Nenhum agendamento encontrado</p></div>'; return; }

  cont.innerHTML = items.map(ag => {
    const cor = (typeof _coresStatus !== 'undefined' && _coresStatus[ag.statusCor]) || { bg:'#F9F9F9', border:'#DDD', label:'Sem status' };
    const srvNome = _agServicos(ag);
    const tema = ag.temaId ? db.temas.find(t => t.id === ag.temaId) : null;
    const sessoesHtml = ag.sessoes.map((s, idx) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
        <span>${fmtDate(s.data)}</span>
        <span class="badge-pill ${s.status==='realizado'?'badge-ativo':'badge-inativo'}">${s.status==='realizado'?'Realizado':'Pendente'}</span>
        ${s.status !== 'realizado' ? `<button class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px" onclick="realizarSessao('${ag.id}',${idx})">✓ Realizar</button>` : ''}
        <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px" onclick="marcarFalta('${ag.id}',${idx})">Faltou</button>
      </div>`).join('');

    return `
    <div class="card" id="agcard-${ag.id}" style="border-left:4px solid ${cor.border};margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <strong style="font-size:15px">${ag.cliente}</strong>
          <div style="font-size:12px;color:var(--text-light)">${srvNome}${tema ? ' · 🎨 '+tema.nome : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <select onchange="setStatusAgenda('${ag.id}', this.value)" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border)">
            <option value="reservado" ${ag.statusCor==='reservado'?'selected':''}>🟢 Reservado</option>
            <option value="alugado" ${ag.statusCor==='alugado'?'selected':''}>🔴 Alugado</option>
            <option value="devolveu" ${ag.statusCor==='devolveu'?'selected':''}>⚫ Devolveu</option>
            <option value="personalizado" ${ag.statusCor==='personalizado'?'selected':''}>🟣 Personalizado</option>
            <option value="credito" ${ag.statusCor==='credito'?'selected':''}>🟠 Crédito</option>
          </select>
          <button class="btn btn-edit" onclick="enviarWhatsappAgenda('${ag.id}')">💬</button>
          <button class="btn btn-danger" onclick="excluirAgendamento('${ag.id}')">✕</button>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px">
        <div><label style="color:var(--text-light)">Retirada:</label> ${ag.dataRetirada ? fmtDate(ag.dataRetirada) + (ag.horaRetirada?' '+ag.horaRetirada:'') : '—'}</div>
        <div><label style="color:var(--text-light)">Sinal:</label> ${ag.sinal > 0 ? fmtMoney(ag.sinal) : '—'}</div>
      </div>
      <div style="margin-top:8px">${sessoesHtml}</div>
      ${ag.obs ? `<div style="margin-top:6px;font-size:12px;color:var(--text-light)">📝 ${ag.obs}</div>` : ''}
    </div>`;
  }).join('');
}

async function setStatusAgenda(id, cor) {
  const ag = db.agenda.find(x => x.id === id);
  if (!ag) return;
  ag.statusCor = cor;
  saveData(); renderAgenda(); renderStatusAgendaPanel();
  await dbAtualizar('agenda', ag);
}

// ===================== REALIZAR = TRANSFERE PARA ATENDIMENTOS =====================
async function realizarSessao(agId, idx) {
  const ag = db.agenda.find(x => x.id === agId);
  if (!ag || !ag.sessoes[idx]) return;

  const totalFestas = (ag.servicoIds||[]).reduce((soma, sid) => {
    const f = db.festas.find(x => x.id === sid);
    return soma + (f ? parseFloat(f.preco) : 0);
  }, 0);
  const sinal = parseFloat(ag.sinal || 0);
  const saldo = Math.max(0, totalFestas - sinal);

  if (!confirm(`Transferir "${ag.cliente}" para Atendimentos?\n\nTotal da festa: ${fmtMoney(totalFestas)}\nSinal já recebido: ${fmtMoney(sinal)}\nSaldo a registrar: ${fmtMoney(saldo)}`)) return;

  const novoAtendimento = {
    id: uid(),
    cliente: ag.cliente,
    data: ag.sessoes[idx].data,
    servicoIds: [...(ag.servicoIds||[])],
    materiais: {...(ag.materiais||{})},
    valor: saldo,
    pagto: 'pix',
    obs: `Convertido da agenda. Total: ${fmtMoney(totalFestas)} · Sinal já pago: ${fmtMoney(sinal)}.` + (ag.obs ? ' ' + ag.obs : ''),
    statusCor: null
  };
  db.atendimentos.push(novoAtendimento);

  const matsAtualizados = [];
  Object.entries(ag.materiais||{}).forEach(([matId, qtd]) => {
    const m = db.materiais.find(x => x.id === matId);
    if (m) { m.qtd = Math.max(0, parseInt(m.qtd) - parseInt(qtd)); matsAtualizados.push(m); }
  });

  db.agenda = db.agenda.filter(x => x.id !== agId);

  saveData(); renderAll();

  await dbInserir('atendimentos', novoAtendimento);
  for (const m of matsAtualizados) await dbAtualizar('materiais', m);
  await dbExcluir('agenda', agId);

  showToast('Agendamento transferido para Atendimentos!');
}

async function marcarFalta(agId, idx) {
  const ag = db.agenda.find(x => x.id === agId);
  if (!ag || !ag.sessoes[idx]) return;
  ag.sessoes[idx].status = 'faltou';
  saveData(); renderAll();
  await dbAtualizar('agenda', ag);
  showToast('Falta registrada.');
}
async function excluirAgendamento(id) {
  if (!confirm('Excluir este agendamento?')) return;
  db.agenda = db.agenda.filter(x => x.id !== id);
  saveData(); renderAll();
  await dbExcluir('agenda', id);
  showToast('Agendamento excluído.');
}
