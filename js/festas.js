// ANTES
function salvarFesta() {
  ...
  db.servicos.push({ id:uid(), nome, duracao:dur, preco:parseFloat(preco), status:document.getElementById('serv-status').value });
  saveData(); renderAll(); limparFormFesta();
  showToast('Festa cadastrada!');
}

// DEPOIS
async function salvarFesta() {
  const nome = document.getElementById('serv-nome').value.trim();
  const dur = document.getElementById('serv-duracao').value;
  const preco = document.getElementById('serv-preco').value;
  if (!nome||!preco) { showToast('Preencha nome e preço!'); return; }
  const nova = { id:uid(), nome, duracao:dur, preco:parseFloat(preco), status:document.getElementById('serv-status').value };
  db.festas.push(nova);
  saveData(); renderAll(); limparFormFesta();
  await dbInserir('festas', nova);
  showToast('Festa cadastrada!');
}
