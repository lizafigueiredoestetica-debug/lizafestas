/* =====================================================
   LIZA FESTAS — temas.js
   Catálogo de temas: festas vinculadas, fotos sob demanda,
   envio WhatsApp
   ===================================================== */

let _temaFestaIdsSelecionadas = [];
let _temaFotosNovas = []; // [{id, nome, dataUrl}]

function limparFormTema() {
  document.getElementById('tema-nome').value = '';
  document.getElementById('tema-descricao').value = '';
  _temaFestaIdsSelecionadas = [];
  _temaFotosNovas = [];
  document.getElementById('temaFestasCount').textContent = '0';
  document.getElementById('temaFotosPreview').innerHTML = '';
  document.getElementById('tema-fotos-input').value = '';
}

// ===================== SELEÇÃO DE FESTAS =====================
function abrirSeletorFestasTema() {
  const opcoes = db.festas.map(f => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f0e8ea;font-size:13px;cursor:pointer">
      <input type="checkbox" value="${f.id}" ${_temaFestaIdsSelecionadas.includes(f.id)?'checked':''} onchange="_toggleFestaTemaTmp('${f.id}', this.checked)">
      ${f.nome}
    </label>`).join('') || '<p style="color:var(--text-light);font-size:13px;padding:1rem 0">Nenhuma festa cadastrada ainda.</p>';

  const modal = document.createElement('div');
  modal.id = 'modal-festas-tema';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px">
      <div class="modal-header"><span>🎉 Selecionar festas</span><button onclick="document.getElementById('modal-festas-tema').remove()">✕</button></div>
      <div class="modal-body">${opcoes}
        <div style="margin-top:1rem"><button class="btn btn-primary btn-sm" onclick="document.getElementById('modal-festas-tema').remove();document.getElementById('temaFestasCount').textContent=_temaFestaIdsSelecionadas.length">✓ Confirmar</button></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
function _toggleFestaTemaTmp(id, checked) {
  if (checked) { if (!_temaFestaIdsSelecionadas.includes(id)) _temaFestaIdsSelecionadas.push(id); }
  else { _temaFestaIdsSelecionadas = _temaFestaIdsSelecionadas.filter(x => x !== id); }
}

// ===================== FOTOS (cadastro) =====================
function onTemaFotosSelecionadas(event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      _temaFotosNovas.push({ id: uid(), nome: file.name, dataUrl: e.target.result });
      _renderTemaFotosPreview();
    };
    reader.readAsDataURL(file);
  });
}
function _renderTemaFotosPreview() {
  const wrap = document.getElementById('temaFotosPreview');
  if (!wrap) return;
  wrap.innerHTML = _temaFotosNovas.map(f => `
    <div style="position:relative;width:70px">
      <img src="${f.dataUrl}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
      <button onclick="_removerFotoTemaTmp('${f.id}')" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer">✕</button>
    </div>`).join('');
}
function _removerFotoTemaTmp(id) {
  _temaFotosNovas = _temaFotosNovas.filter(f => f.id !== id);
  _renderTemaFotosPreview();
}

// ===================== CRUD =====================
async function salvarTema() {
  const nome = document.getElementById('tema-nome').value.trim();
  if (!nome) { showToast('Preencha o nome do tema!'); return; }
  const novo = {
    id: uid(),
    nome,
    descricao: document.getElementById('tema-descricao').value,
    festaIds: [..._temaFestaIdsSelecionadas],
    fotos: [..._temaFotosNovas]
  };
  db.temas.push(novo);
  saveData(); renderAll(); limparFormTema();
  await dbInserir('temas', novo);
  showToast('Tema cadastrado!');
}

function renderTemas() {
  const busca = (document.getElementById('filtTemaNome')?.value || '').toLowerCase();
  let items = [...db.temas];
  if (busca) items = items.filter(t => t.nome.toLowerCase().includes(busca));

  const cont = document.getElementById('temasLista');
  if (!cont) return;
  if (!items.length) { cont.innerHTML = '<div class="empty-state"><div class="empty-icon">🎨</div><p>Nenhum tema cadastrado</p></div>'; return; }

  cont.innerHTML = items.map(t => {
    const festasNomes = (t.festaIds||[]).map(id => { const f = db.festas.find(x=>x.id===id); return f?f.nome:null; }).filter(Boolean).join(', ') || 'Nenhuma festa vinculada';
    return `
    <div class="card">
      <strong>${t.nome}</strong>
      <div style="font-size:12px;color:var(--text-light);margin:4px 0">${t.descricao||''}</div>
      <div style="font-size:11px;color:var(--text-light);margin-bottom:8px">🎉 ${festasNomes}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="verFotosTema('${t.id}')">🖼️ Ver Fotos</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirEnvioWhatsappTema('${t.id}')">💬 Enviar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirTema('${t.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function excluirTema(id) {
  if (!confirm('Excluir este tema?')) return;
  db.temas = db.temas.filter(x => x.id !== id);
  saveData(); renderAll();
  await dbExcluir('temas', id);
  showToast('Tema excluído.');
}

// ===================== CARREGAMENTO SOB DEMANDA DAS FOTOS =====================
// Só busca no Supabase quando o usuário pede — economiza tráfego/consumo.
async function _garantirFotosTema(temaId) {
  const t = db.temas.find(x => x.id === temaId);
  if (!t) return null;
  if (t.fotos === null || t.fotos === undefined) {
    t.fotos = await supaBuscarFotosTema(temaId);
  }
  return t;
}

async function verFotosTema(temaId) {
  showToast('Carregando fotos...');
  const t = await _garantirFotosTema(temaId);
  if (!t || !t.fotos.length) { showToast('Este tema não tem fotos anexadas.'); return; }

  const modal = document.createElement('div');
  modal.id = 'modal-fotos-tema';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:600px">
      <div class="modal-header"><span>🖼️ Fotos — ${t.nome}</span><button onclick="document.getElementById('modal-fotos-tema').remove()">✕</button></div>
      <div class="modal-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
        ${t.fotos.map(f => `<img src="${f.dataUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ===================== ENVIO WHATSAPP =====================
async function abrirEnvioWhatsappTema(temaId) {
  showToast('Carregando fotos...');
  const t = await _garantirFotosTema(temaId);
  if (!t || !t.fotos.length) { showToast('Este tema não tem fotos anexadas.'); return; }

  const opcoes = t.fotos.map(f => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f0e8ea;font-size:13px;cursor:pointer">
      <input type="radio" name="fotoWhatsTema" value="${f.id}">
      <img src="${f.dataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">
      ${f.nome}
    </label>`).join('');

  const modal = document.createElement('div');
  modal.id = 'modal-whats-tema';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px">
      <div class="modal-header"><span>💬 Enviar tema "${t.nome}"</span><button onclick="document.getElementById('modal-whats-tema').remove()">✕</button></div>
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text-light);margin-bottom:8px">Escolha qual foto enviar:</p>
        ${opcoes}
        <div style="margin-top:1rem"><button class="btn btn-primary btn-sm" onclick="_confirmarEnvioWhatsappTema('${t.id}')">✓ Continuar</button></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function _confirmarEnvioWhatsappTema(temaId) {
  const t = db.temas.find(x => x.id === temaId);
  const sel = document.querySelector('input[name="fotoWhatsTema"]:checked');
  if (!sel) { showToast('Selecione uma foto!'); return; }
  const foto = t.fotos.find(f => f.id === sel.value);
  document.getElementById('modal-whats-tema').remove();

  const festasNomes = (t.festaIds||[]).map(id => { const f = db.festas.find(x=>x.id===id); return f?f.nome:null; }).filter(Boolean).join(', ');
  const texto = `Olá! 🎉 Segue o tema "${t.nome}"${t.descricao ? ' — '+t.descricao : ''}${festasNomes ? '\n\nInclui: '+festasNomes : ''}`;

  try {
    const resp = await fetch(foto.dataUrl);
    const blob = await resp.blob();
    const file = new File([blob], foto.nome || 'tema.jpg', { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: texto, title: t.nome });
      return;
    }
  } catch(e) { /* segue pro fallback abaixo */ }

  const a = document.createElement('a');
  a.href = foto.dataUrl;
  a.download = foto.nome || 'tema.jpg';
  a.click();
  showToast('Foto baixada — anexe ela manualmente na conversa do WhatsApp que vai abrir.');
  setTimeout(() => {
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  }, 600);
}
