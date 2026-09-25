(function(){
const I = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  text:'<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  flow:'<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v4a2 2 0 0 0 2 2H14"/>',
  work:'<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.5 6H12a3 3 0 0 1 3 3v.5M8.5 18H12a3 3 0 0 0 3-3v-.5"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  list:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
  node:'<rect x="4" y="7" width="16" height="10" rx="2"/>',
  diamond:'<path d="M12 3 21 12 12 21 3 12Z"/>',
  pill:'<rect x="3" y="8" width="18" height="8" rx="4"/>',
  link:'<path d="M5 12h11M13 8l4 4-4 4"/>',
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'
};
const ic = (n,c='i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o, (k,v) => k.charAt(0) === '_' ? undefined : v));
const LS = 'ideias.v1';

let ideas = {};
let current = null;
let db = null;
let assetsApi = null;
const uploading = {};
const MAXLIST = 30;
const pendingSync = new Set();
const timers = {};
const $ = s => document.querySelector(s);
const app = $('#app'), main = $('#main'), listEl = $('#list');

function lsRead(){ try{ return JSON.parse(localStorage.getItem(LS) || '{}') || {}; }catch(e){ return {}; } }
function lsWrite(){ try{ localStorage.setItem(LS, JSON.stringify({ideas, current, pending:[...pendingSync]}, (k,v) => k.charAt(0) === '_' ? undefined : v)); }catch(e){} }

(function boot(){
  const s = lsRead();
  ideas = s.ideas || {};
  (s.pending || []).forEach(id => pendingSync.add(id));
  current = s.current && ideas[s.current] ? s.current : null;
  renderList(); renderMain();
})();

function setSave(st){
  const el = document.getElementById('saveState');
  if(!el) return;
  el.className = 'save-state ' + (st === 'saving' ? 'saving' : 'ok');
  el.textContent = st === 'saving' ? 'Salvando…' : 'Salvo';
}

function touch(id, immediate){
  const it = ideas[id]; if(!it) return;
  it.atualizadaEm = Date.now();
  lsWrite(); setSave('saving');
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => push(id), immediate ? 0 : 700);
  renderList();
}
async function push(id){
  const it = ideas[id]; if(!it){ setSave('ok'); return; }
  if(!db){ pendingSync.add(id); lsWrite(); setSave('ok'); return; }
  try{ await db.collection('ideias').doc(id).set(clone(it)); pendingSync.delete(id); lsWrite(); }
  catch(e){ pendingSync.add(id); lsWrite(); if(e && e.code === 'unavailable') setTimeout(() => push(id), 1500 + Math.random()*1000); }
  setSave('ok');
}
async function removeIdea(id){
  const gone = ideas[id];
  if(gone) gone.blocos.forEach(b => { if(b.tipo === 'imagem' && b.asset) dropAsset(b.asset); });
  if(undo && undo.ideaId === id){ undo = null; $('#toast').classList.remove('show'); }
  delete ideas[id]; pendingSync.delete(id); clearTimeout(timers[id]);
  if(current === id){
    const rest = sorted();
    current = rest[0] ? rest[0].id : null;
  }
  lsWrite(); renderList(); renderMain();
  if(db){ try{ await db.collection('ideias').doc(id).delete(); }catch(e){} }
}

(async function connect(){
  try{
    if(!window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('assets').then(a => { assetsApi = a; }).catch(() => {});
    db = await window.claude.use('db');
    if(!db) return;
    let first = true;
    db.collection('ideias').onSnapshot(snap => {
      const remote = {};
      snap.docs.forEach(d => { if(d.exists){ const v = d.data(); if(v) remote[d.id] = clone(v); } });
      let changedCurrent = false;
      Object.keys(remote).forEach(id => {
        const r = remote[id], l = ideas[id];
        if(!l || (r.atualizadaEm || 0) > (l.atualizadaEm || 0)){
          if(id === current && l && timers[id]) return;
          ideas[id] = r; if(id === current) changedCurrent = true;
        }
      });
      Object.keys(ideas).forEach(id => {
        if(!remote[id] && !pendingSync.has(id)){ if(first) return; delete ideas[id]; if(id === current){ current = null; changedCurrent = true; } }
      });
      if(first){
        first = false;
        Object.keys(ideas).forEach(id => { if(!remote[id]) pendingSync.add(id); });
        [...pendingSync].forEach(id => { if(ideas[id]) push(id); else pendingSync.delete(id); });
      }
      if(!current){ const s = sorted(); current = s[0] ? s[0].id : null; changedCurrent = true; }
      lsWrite(); renderList();
      if(changedCurrent && !main.contains(document.activeElement)) renderMain();
    }, () => {});
  }catch(e){ db = null; }
})();

function sorted(){ return Object.values(ideas).sort((a,b) => (b.atualizadaEm||0) - (a.atualizadaEm||0)); }

function newIdea(){
  const id = uid(), now = Date.now();
  ideas[id] = { id, titulo:'', criadaEm:now, atualizadaEm:now, blocos:[{ id:uid(), tipo:'texto', texto:'' }] };
  current = id; touch(id, true);
  app.classList.remove('nav');
  renderMain();
  const t = document.getElementById('title'); if(t) t.focus();
}

function short(t){ t = String(t).replace(/\s+/g,' ').trim(); return t.length > MAXLIST ? t.slice(0, MAXLIST - 1).trimEnd() + '…' : t; }
function renderList(){
  const q = ($('#q').value || '').trim().toLowerCase();
  const all = sorted();
  const items = all.filter(it => !q || (it.titulo || 'Sem título').toLowerCase().includes(q));
  if(!all.length){ listEl.innerHTML = '<div class="list-empty">Suas ideias aparecem aqui.</div>'; return; }
  if(!items.length){ listEl.innerHTML = '<div class="list-empty">Nenhuma ideia encontrada.</div>'; return; }
  listEl.innerHTML = items.map(it => `
    <div class="item ${it.id === current ? 'on':''}" data-id="${it.id}" role="button" tabindex="0">
      <span class="t" title="${esc(it.titulo || 'Sem título')}">${esc(short(it.titulo || 'Sem título'))}</span>
      <button class="del" data-del="${it.id}" aria-label="Apagar ideia">${ic('trash')}</button>
    </div>`).join('');
}
listEl.addEventListener('click', e => {
  const d = e.target.closest('[data-del]');
  if(d){ e.stopPropagation(); askDelete(d.dataset.del); return; }
  const it = e.target.closest('.item');
  if(it){ current = it.dataset.id; lsWrite(); renderList(); renderMain(); app.classList.remove('nav'); }
});
listEl.addEventListener('keydown', e => { if(e.key === 'Enter' && e.target.classList.contains('item')) e.target.click(); });
$('#q').addEventListener('input', renderList);
$('#newBtn').addEventListener('click', newIdea);
$('#scrim').addEventListener('click', () => app.classList.remove('nav'));

let delTarget = null;
function askDelete(id){
  delTarget = id;
  const it = ideas[id];
  $('#mTitle').textContent = 'Apagar "' + (it && it.titulo ? it.titulo : 'Sem título') + '"?';
  $('#modal').classList.add('open');
  setTimeout(() => $('#mCancel').focus(), 20);
}
function closeModal(){ $('#modal').classList.remove('open'); delTarget = null; }
$('#mCancel').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal') closeModal(); });
$('#mOk').addEventListener('click', () => { const id = delTarget; closeModal(); if(id) removeIdea(id); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });

function fmt(ts){
  if(!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'}) + ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}

function renderMain(){
  const it = current && ideas[current];
  if(!it){
    main.innerHTML = `
      <div class="topbar"><button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button></div>
      <div class="empty"><div class="empty-in">
        <div class="bulb">${ic('bulb')}</div>
        <h1>Comece sua primeira ideia</h1>
        <p>Cada ideia vira uma página com anotações, imagens, fluxogramas, workflows e checklists.</p>
        <button class="primary" data-act="new">${ic('plus')}Nova ideia</button>
      </div></div>`;
    return;
  }
  main.innerHTML = `
    <div class="topbar" id="topbar">
      <button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button>
      <span class="save-state ok" id="saveState">Salvo</span>
      <button class="ghost danger" data-act="del">${ic('trash')}Apagar ideia</button>
    </div>
    <div class="doc">
      <textarea class="title" id="title" rows="1" placeholder="Nome da ideia">${esc(it.titulo)}</textarea>
      <div class="meta">Criada em ${fmt(it.criadaEm)}</div>
      <div id="blocks">${it.blocos.map((b,i) => blockHTML(b,i,it.blocos.length)).join('')}</div>
      <div class="adder">
        <button class="add-b" data-add="texto">${ic('text')}Texto</button>
        <button class="add-b" data-add="fluxograma">${ic('flow')}Fluxograma</button>
        <button class="add-b" data-add="workflow">${ic('work')}Workflow</button>
        <button class="add-b" data-add="checklist">${ic('list')}Checklist</button>
        <button class="add-b" data-add="imagem">${ic('img')}Imagem</button>
      </div>
    </div>`;
  main.querySelectorAll('textarea').forEach(autosize);
  it.blocos.forEach(b => { if(b.tipo === 'fluxograma') drawFlow(b); });
}

function blockTools(i,n){
  return `<div class="block-tools">
    ${i>0?`<button class="bt" data-mv="-1" aria-label="Mover para cima">${ic('up')}</button>`:''}
    ${i<n-1?`<button class="bt" data-mv="1" aria-label="Mover para baixo">${ic('down')}</button>`:''}
    <button class="bt x" data-rm aria-label="Remover bloco">${ic('x')}</button>
  </div>`;
}

function blockHTML(b,i,n){
  let inner = '';
  const headX = `<button class="head-x" data-rm aria-label="Remover bloco">${ic('trash')}Remover</button>`;
  if(b.tipo === 'texto'){
    inner = `<textarea class="txt" data-f="texto" rows="1" placeholder="Escreva sua ideia…">${esc(b.texto)}</textarea>`;
  } else if(b.tipo === 'fluxograma'){
    inner = `<div class="card">
      <div class="card-head">${ic('flow')}<input data-f="nome" value="${esc(b.nome)}" placeholder="Fluxograma sem nome"><span class="chip">${b.nos.length} ${b.nos.length===1?'etapa':'etapas'}</span>${headX}</div>
      <div class="fc-bar">
        <button class="tb" data-fc="add" data-shape="caixa">${ic('node')}Etapa</button>
        <button class="tb" data-fc="add" data-shape="decisao">${ic('diamond')}Decisão</button>
        <button class="tb" data-fc="add" data-shape="inicio">${ic('pill')}Início/fim</button>
        <span class="sep"></span>
        <button class="tb" data-fc="link">${ic('link')}Conectar</button>
        <div class="fc-edit" data-fc-edit></div>
      </div>
      <div class="fc-wrap"><svg data-fc-svg viewBox="0 0 800 380"></svg></div>
    </div>`;
  } else if(b.tipo === 'workflow'){
    const done = b.etapas.filter(e => e.status === 'feito').length;
    const pct = b.etapas.length ? Math.round(done / b.etapas.length * 100) : 0;
    inner = `<div class="card">
      <div class="card-head">${ic('work')}<input data-f="nome" value="${esc(b.nome)}" placeholder="Workflow sem nome"><span class="chip">${done}/${b.etapas.length} feitas</span>${headX}</div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <ol class="steps">${b.etapas.map((e,k) => `
        <li class="step ${e.status==='feito'?'done':e.status==='andamento'?'run':''}" data-k="${k}">
          <span class="n">${e.status==='feito'?ic('check'):k+1}</span>
          <input data-step value="${esc(e.texto)}" placeholder="Descreva a etapa">
          <button class="status ${e.status==='feito'?'done':e.status==='andamento'?'run':''}" data-st>${e.status==='feito'?'Feito':e.status==='andamento'?'Em andamento':'Pendente'}</button>
          <button class="mini" data-rmstep aria-label="Remover etapa">${ic('x')}</button>
        </li>`).join('')}</ol>
      <button class="add-row" data-addstep>${ic('plus')}Adicionar etapa</button>
    </div>`;
  } else if(b.tipo === 'checklist'){
    const done = b.itens.filter(e => e.feito).length;
    inner = `<div class="card">
      <div class="card-head">${ic('list')}<input data-f="nome" value="${esc(b.nome)}" placeholder="Checklist sem nome"><span class="chip">${done}/${b.itens.length}</span>${headX}</div>
      <ul class="checks">${b.itens.map((e,k) => `
        <li class="check ${e.feito?'on':''}" data-k="${k}">
          <button class="box ${e.feito?'on':''}" data-tick aria-label="Marcar item" aria-pressed="${e.feito?'true':'false'}">${ic('check')}</button>
          <input data-item value="${esc(e.texto)}" placeholder="Novo item">
          <button class="mini" data-rmitem aria-label="Remover item">${ic('x')}</button>
        </li>`).join('')}</ul>
      <button class="add-row" data-additem>${ic('plus')}Adicionar item</button>
    </div>`;
  }
  else if(b.tipo === 'imagem'){
    const src = b.asset ? '/_blob/' + b.asset : (b.dataUrl || '');
    const up = uploading[b.id];
    let body;
    if(src) body = `<div class="img-view"><img src="${esc(src)}" alt="${esc(b.legenda || 'Imagem')}"></div><input class="img-cap" data-f="legenda" value="${esc(b.legenda)}" placeholder="Legenda (opcional)">`;
    else if(up === 'enviando') body = `<div class="img-drop"><div class="bulb">${ic('img')}</div>Enviando imagem…</div>`;
    else body = `<div class="img-drop" data-drop tabindex="0" role="button"><div class="bulb">${ic('img')}</div>Escolha uma imagem ou arraste para cá<small>Você também pode colar com Ctrl+V</small>${up && up !== 'enviando' ? `<span class="img-err">${esc(up)}</span>` : ''}</div>`;
    inner = `<div class="card"><div class="card-head">${ic('img')}<span style="flex:1;color:var(--tx);font-weight:500">Imagem</span>${src ? `<button class="head-x" data-reimg>${ic('refresh')}Trocar</button>` : ''}${headX}</div>${body}</div>`;
  }
  return `<section class="block" data-b="${b.id}">${blockTools(i,n)}${inner}</section>`;
}

function autosize(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
const cur = () => ideas[current];
const blk = el => { const s = el.closest('[data-b]'); return s ? cur().blocos.find(b => b.id === s.dataset.b) : null; };
function rerenderBlock(b){
  const it = cur(); const i = it.blocos.indexOf(b);
  const old = main.querySelector(`[data-b="${b.id}"]`); if(!old) return;
  const tmp = document.createElement('div'); tmp.innerHTML = blockHTML(b, i, it.blocos.length);
  const nu = tmp.firstElementChild; old.replaceWith(nu);
  nu.querySelectorAll('textarea').forEach(autosize);
  if(b.tipo === 'fluxograma') drawFlow(b);
  return nu;
}

main.addEventListener('scroll', () => { const t = document.getElementById('topbar'); if(t) t.classList.toggle('scrolled', main.scrollTop > 4); });

main.addEventListener('input', e => {
  const it = cur(); if(!it) return;
  const t = e.target;
  if(t.id === 'title'){ it.titulo = t.value; autosize(t); touch(it.id); return; }
  if(t.tagName === 'TEXTAREA') autosize(t);
  const b = blk(t); if(!b) return;
  if(t.dataset.f){ b[t.dataset.f] = t.value; touch(it.id); return; }
  if(t.hasAttribute('data-step')){ b.etapas[+t.closest('[data-k]').dataset.k].texto = t.value; touch(it.id); return; }
  if(t.hasAttribute('data-item')){ b.itens[+t.closest('[data-k]').dataset.k].texto = t.value; touch(it.id); return; }
  if(t.hasAttribute('data-fc-label')){ const n = b.nos.find(x => x.id === b._sel); if(n){ n.texto = t.value; drawFlow(b); touch(it.id); } }
});

main.addEventListener('keydown', e => {
  const t = e.target;
  if(t.id === 'title' && e.key === 'Enter'){ e.preventDefault(); const f = main.querySelector('#blocks textarea, #blocks input'); if(f) f.focus(); return; }
  if(e.key === 'Enter' && (t.hasAttribute('data-step') || t.hasAttribute('data-item'))){
    e.preventDefault();
    const b = blk(t), k = +t.closest('[data-k]').dataset.k;
    if(t.hasAttribute('data-step')) b.etapas.splice(k+1, 0, {texto:'', status:'pendente'});
    else b.itens.splice(k+1, 0, {texto:'', feito:false});
    touch(cur().id); const nu = rerenderBlock(b);
    const next = nu.querySelector(`[data-k="${k+1}"] input`); if(next) next.focus();
  }
  if(e.key === 'Backspace' && t.value === '' && (t.hasAttribute('data-step') || t.hasAttribute('data-item'))){
    const b = blk(t), k = +t.closest('[data-k]').dataset.k, arr = b.etapas || b.itens;
    if(arr.length > 1){ e.preventDefault(); arr.splice(k,1); touch(cur().id); const nu = rerenderBlock(b); const prev = nu.querySelector(`[data-k="${Math.max(0,k-1)}"] input`); if(prev) prev.focus(); }
  }
  if(t.hasAttribute('data-fc-label') && e.key === 'Enter'){ e.preventDefault(); t.blur(); }
});

main.addEventListener('click', e => {
  const t = e.target.closest('button'); if(!t) return;
  const it = cur();
  if(t.dataset.act === 'menu'){ app.classList.add('nav'); return; }
  if(t.dataset.act === 'new'){ newIdea(); return; }
  if(!it) return;
  if(t.dataset.act === 'del'){ askDelete(it.id); return; }
  if(t.dataset.add){
    const tipo = t.dataset.add, b = { id:uid(), tipo };
    if(tipo === 'texto') b.texto = '';
    if(tipo === 'fluxograma'){ b.nome = ''; b.nos = []; b.arestas = []; }
    if(tipo === 'workflow'){ b.nome = ''; b.etapas = [{texto:'', status:'pendente'}]; }
    if(tipo === 'checklist'){ b.nome = ''; b.itens = [{texto:'', feito:false}]; }
    if(tipo === 'imagem'){ b.asset = null; b.dataUrl = null; b.legenda = ''; }
    it.blocos.push(b); touch(it.id); renderMain();
    const s = main.querySelector(`[data-b="${b.id}"]`);
    if(s){ s.scrollIntoView({block:'center', behavior:'smooth'}); const f = s.querySelector('textarea, .card-head input, .steps input, .checks input'); if(tipo === 'imagem') pickFor(b.id); else if(f && tipo !== 'fluxograma') setTimeout(() => f.focus(), 250); }
    return;
  }
  const b = blk(t); if(!b) return;
  if(t.hasAttribute('data-rm')){ removeBlock(it, b); return; }
  if(t.hasAttribute('data-reimg')){ pickFor(b.id); return; }
  if(t.dataset.mv){
    const i = it.blocos.indexOf(b), j = i + (+t.dataset.mv);
    if(j < 0 || j >= it.blocos.length) return;
    [it.blocos[i], it.blocos[j]] = [it.blocos[j], it.blocos[i]]; touch(it.id); renderMain();
    const s = main.querySelector(`[data-b="${b.id}"]`); if(s) s.scrollIntoView({block:'nearest'});
    return;
  }
  if(t.hasAttribute('data-st')){
    const k = +t.closest('[data-k]').dataset.k, e2 = b.etapas[k];
    e2.status = e2.status === 'pendente' ? 'andamento' : e2.status === 'andamento' ? 'feito' : 'pendente';
    touch(it.id); rerenderBlock(b); return;
  }
  if(t.hasAttribute('data-rmstep')){ b.etapas.splice(+t.closest('[data-k]').dataset.k, 1); touch(it.id); rerenderBlock(b); return; }
  if(t.hasAttribute('data-addstep')){ b.etapas.push({texto:'', status:'pendente'}); touch(it.id); const nu = rerenderBlock(b); const ins = nu.querySelectorAll('.steps input'); ins[ins.length-1].focus(); return; }
  if(t.hasAttribute('data-tick')){ const k = +t.closest('[data-k]').dataset.k; b.itens[k].feito = !b.itens[k].feito; touch(it.id); rerenderBlock(b); return; }
  if(t.hasAttribute('data-rmitem')){ b.itens.splice(+t.closest('[data-k]').dataset.k, 1); touch(it.id); rerenderBlock(b); return; }
  if(t.hasAttribute('data-additem')){ b.itens.push({texto:'', feito:false}); touch(it.id); const nu = rerenderBlock(b); const ins = nu.querySelectorAll('.checks input'); ins[ins.length-1].focus(); return; }

  if(t.dataset.fc === 'add'){
    const shape = t.dataset.shape;
    const n = b.nos.length;
    const last = b.nos[n-1];
    const node = { id:uid(), forma:shape, texto: shape === 'decisao' ? 'Decisão' : shape === 'inicio' ? (n ? 'Fim' : 'Início') : 'Nova etapa',
      x: last ? Math.min(last.x + 190, 700) : 110, y: last ? (last.x + 190 > 700 ? Math.min(last.y + 110, 320) : last.y) : 70 };
    if(last && last.x + 190 > 700) node.x = 110;
    b.nos.push(node);
    if(last) b.arestas.push({ id:uid(), de:last.id, para:node.id });
    b._sel = node.id; b._selE = null;
    touch(it.id); rerenderBlock(b); focusLabel(b); return;
  }
  if(t.dataset.fc === 'link'){ b._link = !b._link; b._src = null; drawFlow(b); return; }
  if(t.dataset.fc === 'delnode'){
    b.nos = b.nos.filter(x => x.id !== b._sel); b.arestas = b.arestas.filter(a => a.de !== b._sel && a.para !== b._sel);
    b._sel = null; touch(it.id); rerenderBlock(b); return;
  }
  if(t.dataset.fc === 'deledge'){ b.arestas = b.arestas.filter(a => a.id !== b._selE); b._selE = null; touch(it.id); drawFlow(b); return; }
  if(t.dataset.fc === 'shape'){
    const n = b.nos.find(x => x.id === b._sel); if(!n) return;
    n.forma = n.forma === 'caixa' ? 'decisao' : n.forma === 'decisao' ? 'inicio' : 'caixa';
    touch(it.id); drawFlow(b); return;
  }
});

let undo = null, toastT = null;
function removeBlock(it, b){
  const i = it.blocos.indexOf(b); if(i < 0) return;
  if(undo) finalizeUndo();
  it.blocos.splice(i,1);
  if(!it.blocos.length) it.blocos.push({ id:uid(), tipo:'texto', texto:'' });
  undo = { ideaId: it.id, block: b, index: i };
  touch(it.id); renderMain();
  $('#toastText').textContent = 'Bloco removido';
  $('#toast').classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(finalizeUndo, 6000);
}
function finalizeUndo(){
  clearTimeout(toastT); $('#toast').classList.remove('show');
  if(!undo) return;
  const b = undo.block; undo = null;
  if(b.tipo === 'imagem' && b.asset) dropAsset(b.asset);
}
$('#toastUndo').addEventListener('click', () => {
  if(!undo) return;
  const it = ideas[undo.ideaId];
  if(it){
    if(it.blocos.length === 1 && it.blocos[0].tipo === 'texto' && !it.blocos[0].texto && undo.index === 0 && it.blocos[0] !== undo.block) it.blocos = [];
    it.blocos.splice(Math.min(undo.index, it.blocos.length), 0, undo.block);
    current = it.id; touch(it.id); renderMain();
  }
  undo = null; clearTimeout(toastT); $('#toast').classList.remove('show');
});
async function dropAsset(id){ if(assetsApi){ try{ await assetsApi.delete(id); }catch(e){} } }

let pickTarget = null;
function pickFor(bid){ pickTarget = bid; const f = $('#filePick'); f.value = ''; f.click(); }
$('#filePick').addEventListener('change', e => { const file = e.target.files && e.target.files[0]; if(file && pickTarget) setImage(pickTarget, file); pickTarget = null; });

function findBlock(bid){ for(const it of Object.values(ideas)){ const b = it.blocos.find(x => x.id === bid); if(b) return [it, b]; } return [null, null]; }
async function setImage(bid, file){
  let [it, b] = findBlock(bid); if(!b) return;
  if(!/^image\//.test(file.type)){ uploading[bid] = 'Esse arquivo não é uma imagem.'; rerenderIf(it, b); return; }
  uploading[bid] = 'enviando'; rerenderIf(it, b);
  const old = b.asset;
  try{
    let blob = file;
    if(file.size > 8 * 1024 * 1024 || !/svg|gif/.test(file.type)) blob = await shrink(file, 2400, 0.9, 4 * 1024 * 1024);
    if(assetsApi){
      const r = await assetsApi.upload(blob);
      [it, b] = findBlock(bid); if(!b){ try{ await assetsApi.delete(r.id); }catch(e){} return; }
      b.asset = r.id; b.dataUrl = null;
      if(old && old !== r.id) dropAsset(old);
    } else {
      const small = await shrink(file, 1400, 0.8, 170 * 1024);
      b.dataUrl = await toDataUrl(small); b.asset = null;
    }
    delete uploading[bid];
  }catch(err){
    uploading[bid] = err && err.code === 'quota_exceeded' ? 'O espaço de imagens está cheio. Remova alguma para liberar.' : 'Não foi possível enviar essa imagem. Tente outra.';
  }
  [it, b] = findBlock(bid); if(!b) return;
  touch(it.id, true); rerenderIf(it, b);
}
function rerenderIf(it, b){ if(it && it.id === current) rerenderBlock(b); }
function toDataUrl(blob){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
function shrink(file, max, q, limit){
  return new Promise((res) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, scale = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas'), ctx = c.getContext('2d');
      const tryIt = (sc, qq) => {
        c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(bl => {
          if(!bl){ URL.revokeObjectURL(url); res(file); return; }
          if(bl.size > limit && (qq > 0.5 || sc > 0.3)) tryIt(qq > 0.5 ? sc : sc * 0.8, Math.max(0.5, qq - 0.1));
          else { URL.revokeObjectURL(url); res(bl.size < file.size || file.size > limit ? bl : file); }
        }, 'image/jpeg', qq);
      };
      tryIt(scale, q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}
main.addEventListener('click', e => { const d = e.target.closest('[data-drop]'); if(d){ const b = blk(d); if(b) pickFor(b.id); } });
main.addEventListener('keydown', e => { const d = e.target.closest && e.target.closest('[data-drop]'); if(d && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); const b = blk(d); if(b) pickFor(b.id); } });
main.addEventListener('dragover', e => { const d = e.target.closest('[data-drop]'); if(d){ e.preventDefault(); d.classList.add('over'); } });
main.addEventListener('dragleave', e => { const d = e.target.closest('[data-drop]'); if(d) d.classList.remove('over'); });
main.addEventListener('drop', e => {
  const file = e.dataTransfer && [...e.dataTransfer.files].find(f => /^image\//.test(f.type));
  const d = e.target.closest('[data-drop]');
  if(d){ e.preventDefault(); d.classList.remove('over'); const b = blk(d); if(b && file) setImage(b.id, file); return; }
  const it = cur(); if(!it || !file) return;
  e.preventDefault(); addImageWith(it, file);
});
function addImageWith(it, file){
  const b = { id:uid(), tipo:'imagem', asset:null, dataUrl:null, legenda:'' };
  it.blocos.push(b); touch(it.id); renderMain();
  const s = main.querySelector(`[data-b="${b.id}"]`); if(s) s.scrollIntoView({block:'center', behavior:'smooth'});
  setImage(b.id, file);
}
document.addEventListener('paste', e => {
  const it = cur(); if(!it) return;
  const file = e.clipboardData && [...e.clipboardData.items].filter(x => x.kind === 'file' && /^image\//.test(x.type)).map(x => x.getAsFile())[0];
  if(!file) return;
  e.preventDefault();
  const empty = it.blocos.find(x => x.tipo === 'imagem' && !x.asset && !x.dataUrl && uploading[x.id] !== 'enviando');
  if(empty) setImage(empty.id, file); else addImageWith(it, file);
});

function focusLabel(b){
  const s = main.querySelector(`[data-b="${b.id}"] [data-fc-label]`);
  if(s){ s.focus(); s.select(); }
}

const W = 150, H = 50;
function nodeSize(n){ const w = Math.max(n.forma === 'decisao' ? 150 : 120, Math.min(260, (n.texto||'').length * 7.4 + 40)); return { w, h: n.forma === 'decisao' ? 70 : H }; }
function edgePoint(n, tx, ty){
  const {w,h} = nodeSize(n), dx = tx - n.x, dy = ty - n.y;
  if(!dx && !dy) return {x:n.x, y:n.y};
  if(n.forma === 'decisao'){ const s = 1 / (Math.abs(dx)/(w/2) + Math.abs(dy)/(h/2)); return {x:n.x + dx*s, y:n.y + dy*s}; }
  const s = Math.min((w/2)/Math.abs(dx || 1e-6), (h/2)/Math.abs(dy || 1e-6));
  return {x:n.x + dx*s, y:n.y + dy*s};
}

function drawFlow(b){
  const sec = main.querySelector(`[data-b="${b.id}"]`); if(!sec) return;
  const svg = sec.querySelector('[data-fc-svg]'); if(!svg) return;
  const maxY = b.nos.reduce((m,n) => Math.max(m, n.y + 60), 380);
  svg.setAttribute('viewBox', `0 0 800 ${Math.max(380, maxY + 20)}`);
  const byId = Object.fromEntries(b.nos.map(n => [n.id, n]));
  let out = `<defs><marker id="ah-${b.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`;
  b.arestas.forEach(a => {
    const A = byId[a.de], B = byId[a.para]; if(!A || !B) return;
    const p1 = edgePoint(A, B.x, B.y), p2 = edgePoint(B, A.x, A.y);
    const ux = p2.x - p1.x, uy = p2.y - p1.y, L = Math.hypot(ux,uy) || 1;
    const q2 = {x:p2.x - ux/L*3, y:p2.y - uy/L*3};
    out += `<g data-edge="${a.id}"><line class="fc-hit" x1="${p1.x}" y1="${p1.y}" x2="${q2.x}" y2="${q2.y}"/><line class="fc-edge ${b._selE===a.id?'sel':''}" x1="${p1.x}" y1="${p1.y}" x2="${q2.x}" y2="${q2.y}" marker-end="url(#ah-${b.id})"/></g>`;
  });
  b.nos.forEach(n => {
    const {w,h} = nodeSize(n);
    const cls = `fc-node ${n.forma==='inicio'?'start':''} ${b._sel===n.id?'sel':''} ${b._src===n.id?'src':''}`;
    let shape = '';
    if(n.forma === 'decisao') shape = `<polygon points="${n.x},${n.y-h/2} ${n.x+w/2},${n.y} ${n.x},${n.y+h/2} ${n.x-w/2},${n.y}"/>`;
    else shape = `<rect x="${n.x-w/2}" y="${n.y-h/2}" width="${w}" height="${h}" rx="${n.forma==='inicio'?h/2:8}"/>`;
    out += `<g class="${cls}" data-node="${n.id}">${shape}<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central">${esc(n.texto || '…')}</text></g>`;
  });
  if(!b.nos.length) out += `<text class="fc-empty" x="400" y="190" text-anchor="middle">Adicione a primeira etapa pela barra acima</text>`;
  svg.innerHTML = out;

  const bar = sec.querySelector('[data-fc="link"]'); if(bar) bar.classList.toggle('on', !!b._link);
  const ed = sec.querySelector('[data-fc-edit]');
  const sel = b.nos.find(x => x.id === b._sel);
  const active = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-fc-label') && sec.contains(document.activeElement);
  if(active && sel) return;
  if(b._link){
    ed.innerHTML = `<span class="fc-hint">${b._src ? 'Agora clique na etapa de destino' : 'Clique na etapa de origem'}</span>`;
  } else if(sel){
    ed.innerHTML = `<input data-fc-label value="${esc(sel.texto)}" placeholder="Texto da etapa" aria-label="Texto da etapa">
      <button class="tb" data-fc="shape" title="Trocar forma">${ic(sel.forma==='decisao'?'diamond':sel.forma==='inicio'?'pill':'node')}Forma</button>
      <button class="tb x" data-fc="delnode">${ic('trash')}Remover</button>`;
  } else if(b._selE){
    ed.innerHTML = `<span class="fc-hint">Conexão selecionada</span><button class="tb x" data-fc="deledge">${ic('trash')}Remover conexão</button>`;
  } else {
    ed.innerHTML = b.nos.length ? `<span class="fc-hint">Arraste para mover. Clique para editar.</span>` : '';
  }
}

let drag = null;
function svgPt(svg, ev){ const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
main.addEventListener('pointerdown', ev => {
  const svg = ev.target.closest('[data-fc-svg]'); if(!svg) return;
  const b = blk(svg); if(!b) return;
  const g = ev.target.closest('[data-node]'), eg = ev.target.closest('[data-edge]');
  if(b._link){
    if(!g) return;
    const id = g.dataset.node;
    if(!b._src){ b._src = id; drawFlow(b); return; }
    if(b._src !== id && !b.arestas.some(a => a.de === b._src && a.para === id)){ b.arestas.push({id:uid(), de:b._src, para:id}); touch(cur().id); }
    b._src = null; b._link = false; drawFlow(b); return;
  }
  if(g){
    const n = b.nos.find(x => x.id === g.dataset.node); const p = svgPt(svg, ev);
    drag = { b, n, svg, ox: p.x - n.x, oy: p.y - n.y, moved:false, pid: ev.pointerId };
    svg.setPointerCapture(ev.pointerId);
    b._sel = n.id; b._selE = null; drawFlow(b);
    ev.preventDefault(); return;
  }
  if(eg){ b._selE = eg.dataset.edge; b._sel = null; drawFlow(b); return; }
  b._sel = null; b._selE = null; drawFlow(b);
});
main.addEventListener('pointermove', ev => {
  if(!drag || ev.pointerId !== drag.pid) return;
  const p = svgPt(drag.svg, ev);
  const {w,h} = nodeSize(drag.n);
  drag.n.x = Math.round(Math.max(w/2 + 4, Math.min(800 - w/2 - 4, p.x - drag.ox)));
  drag.n.y = Math.round(Math.max(h/2 + 4, p.y - drag.oy));
  drag.moved = true; drawFlow(drag.b);
});
function endDrag(ev){
  if(!drag || (ev && ev.pointerId !== drag.pid)) return;
  const d = drag; drag = null;
  if(d.moved) touch(cur().id);
  else focusLabel(d.b);
}
main.addEventListener('pointerup', endDrag);
main.addEventListener('pointercancel', endDrag);
main.addEventListener('focusout', e => { if(e.target.hasAttribute && e.target.hasAttribute('data-fc-label')){ const b = blk(e.target); if(b) setTimeout(() => { if(!main.querySelector(`[data-b="${b.id}"] [data-fc-label]:focus`)) drawFlow(b); }, 0); } });

document.addEventListener('keydown', e => {
  if(e.key !== 'Delete') return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if(tag === 'INPUT' || tag === 'TEXTAREA') return;
  const it = cur(); if(!it) return;
  const b = it.blocos.find(x => x.tipo === 'fluxograma' && (x._sel || x._selE)); if(!b) return;
  if(b._sel){ b.nos = b.nos.filter(x => x.id !== b._sel); b.arestas = b.arestas.filter(a => a.de !== b._sel && a.para !== b._sel); b._sel = null; touch(it.id); rerenderBlock(b); }
  else { b.arestas = b.arestas.filter(a => a.id !== b._selE); b._selE = null; touch(it.id); drawFlow(b); }
});

})();
