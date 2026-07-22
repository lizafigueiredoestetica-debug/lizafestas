/* =====================================================
   LIZA FESTAS — agenda.js
   Agendamentos — tabela `agenda`
   ===================================================== */

let agendaFiltroAtual = 'tudo';
let agBuscaClienteAtual = '';

async function salvarAgendamento() {
  const cliente = document.getElementById('ag-cliente').value.trim();
  const telefone = document.getElementById('ag-telefone').value;
  const data = document.getElementById('ag-data').value;
  const hora = document.getElementById('ag-hora').value;
  const recorrencia = document.getElementById('ag-recorrencia').value;
  const qtdRepeticoes = parseInt(document.getElementById('ag-repeticoes').value || '1');
  const dataRetirada = document.getElementById('ag-data-retirada').value;
  const horaRetirada = document.getElementById('ag-hora-retirada').value;
  const sinal = document.getElementById('ag-sinal').value;
  const statusCor = document.getElementById('ag-status-cor').value || 'reservado';

  if (!cliente || !data) { showToast('Preencha cliente e data!'); return; }
  if (!selectedServicos.length) { showToast('Selecione ao menos uma festa!'); return; }

  const sessoes = _gerarSessoes(data, hora, recorrencia, qtdRepeticoes);
  const conflito = _checarConflitoHorario(sessoes, null);
  if (conflito) {
    if (!confirm('⚠️ Conflito de horário detectado com "' + conflito.cliente + '" em ' + fmtDate(conflito.data) + (conflito.hora ? ' às ' + conflito.hora : '') + '.\n\nDeseja agendar mesmo assim?')) return;
  }

  const novo = {
    id: uid(), cliente, telefone,
    sessoes,
    servicoIds: [...selectedServicos],
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

function _gerarSessoes(dataBase, hora, recorrencia, qtd) {
  const sessoes = [];
  const ids = [...selectedServicos];
  if (!recorrencia || qtd <= 1) {
    sessoes.push({ data: dataBase, hora, servicoIds: ids, status: 'pendente' });
    return sessoes;
  }
  const passoDias = { semanal: 7, quinzenal: 14, mensal: 30, personalizado: parseInt(document.getElementById('ag-intervalo-dias')?.value || '7') };
  const passo = passoDias[recorrencia] || 7;
  let d = new Date(dataBase + 'T00:00:00');
  for (let i = 0; i < qtd; i++) {
    const iso = d.toISOString().split('T')[0];
    sessoes.push({ data: iso, hora, servicoIds: ids, status: 'pendente' });
    d.setDate(d.getDate() + passo);
  }
  return sessoes;
}

function _checarConflitoHorario(sessoesNovas, ignorarAgId) {
  for (const ag of db.agenda) {
    if (ag.id === ignorarAgId) continue;
    for (const s of ag.sessoes) {
      for (const nova of sessoesNovas) {
        if (s.data === nova.data && s.hora && nova.hora && s.hora === nova.hora) {
          return { cliente: ag.cliente, data: s.data, hora: s.hora };
        }
      }
    }
  }
  return null;
}

function limparFormAgenda() {
  ['ag-cliente','ag-telefone','ag-hora','ag-data-retirada','ag-hora-retirada','ag-sinal','ag-obs'].forEach(id => {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var rec = document.getElementById('ag-recorrencia'); if (rec) rec.value = '';
  var rep = document.getElementById('ag-repeticoes'); if (rep) rep.value = '1';
  var stEl = document.getElementById('ag-status-cor'); if (stEl) stEl.value = 'reservado';
  selectedServicos = [];
  setToday();
  renderServiceChips();
}

function setAgendaFiltro(filtro, btn) {
  agendaFiltroAtual = filtro;
  document.querySelectorAll('.agenda-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAgenda();
}

function renderAgenda() {
  agBuscaClienteAtual = (document.getElementById('agBuscaCliente')?.value || '').toLowerCase();
  const hoje = _hoje();
  let items = [...db.agenda];

  if (agBuscaClienteAtual) items = items.filter(ag => ag.cliente.toLowerCase().includes(agBuscaClienteAtual));
  if (agendaFiltroAtual === 'hoje') items = items.filter(ag => ag.sessoes.some(s => s.data === hoje));
  else if (agendaFiltroAtual === 'pendentes') items = items.filter(ag => ag.sessoes.some(s => s.status === 'pendente'));
  else if (agendaFiltroAtual === 'realizados') items = items.filter(ag => ag.sessoes.every(s => s.status === 'realizado'));

  items.sort((a, b) => (a.sessoes[0]?.data||'').localeCompare(b.sessoes[0]?.data||''));

  const cont = document.getElementById('agendaLista');
  if (!cont) return;
  if (!items.length) { cont.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Nenhum agendamento encontrado</p></div>'; return; }

  cont.innerHTML = items.map(ag => {
    const cor = (typeof _coresStatus !== 'undefined' && _coresStatus[ag.statusCor]) || { bg:'#F9F9F9', border:'#DDD', label:'Sem status' };
    const srvNome = _agServicos(ag);
    const sessoesHtml = ag.sessoes.map((s, idx) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
        <span>${fmtDate(s.data)}${s.hora ? ' · ' + s.hora : ''}</span>
        <span class="badge-pill ${s.status==='realizado'?'badge-ativo':'badge-inativo'}">${s.status==='realizado'?'Realizado':'Pendente'}</span>
        ${s.status !== 'realizado' ? `<button class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px" onclick="realizarSessao('${ag.id}',${idx})">✓ Realizar</button>` : ''}
        <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px" onclick="marcarFalta('${ag.id}',${idx})">Faltou</button>
      </div>`).join('');

    return `
    <div class="card" id="agcard-${ag.id}" style="border-left:4px solid ${cor.border};margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <strong style="font-size:15px">${ag.cliente}</strong>
          <div style="font-size:12px;color:var(--text-light)">${srvNome}</div>
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

async function realizarSessao(agId, idx) {
  const ag = db.agenda.find(x => x.id === agId);
  if (!ag || !ag.sessoes[idx]) return;
  ag.sessoes[idx].status = 'realizado';
  saveData(); renderAll();
  await dbAtualizar('agenda', ag);
  showToast('Sessão marcada como realizada!');
}

async function marcarFalta(agId, idx) {
  const ag = db.agenda.find(x => x.id === agId);
  if (!ag || !ag.sessoes[idx]) return;
  ag.sessoes[idx].status = 'faltou';
  if (confirm('Deseja reagendar essa sessão agora?')) {
    const novaData = prompt('Nova data (AAAA-MM-DD):', ag.sessoes[idx].data);
    if (novaData) ag.sessoes.push({ data: novaData, hora: ag.sessoes[idx].hora, servicoIds: ag.sessoes[idx].servicoIds, status: 'pendente' });
  }
  saveData(); renderAll();
  await dbAtualizar('agenda', ag);
  showToast('Falta registrada.');
}

async function excluirAgendamento(id) {
  if (!confirm('Excluir este agendamento e todas as suas sessões?')) return;
  db.agenda = db.agenda.filter(x => x.id !== id);
  saveData(); renderAll();
  await dbExcluir('agenda', id);
  showToast('Agendamento excluído.');
}
