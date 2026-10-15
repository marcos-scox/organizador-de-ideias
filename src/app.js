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
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  archive:'<path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon:'<path d="M20.9 13A8 8 0 0 1 11 3.1 8 8 0 1 0 20.9 13Z"/>'
};
const ic = (n,c='i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o, (k,v) => k.charAt(0) === '_' ? undefined : v));
const LS = 'ideias.v1';
const PREFS = 'ideias.settings.v1';
const DEFAULT_SETTINGS = {theme:'dark',reduceMotion:false,autoBackup:false,backupFrequency:'daily',keepBackups:10,lastBackupAt:0,backupTreeUri:'',backupFolderName:''};
function readSettings(){ try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(PREFS)||'{}')};}catch(e){return {...DEFAULT_SETTINGS};} }

let ideas = {};
let current = null;
let view = 'ideas';
let db = null;
let assetsApi = null;
let settings = readSettings();
let backupFolderHandle = null;
let autoBackupTimer = null;
const uploading = {};
const MAXLIST = 30;
const pendingSync = new Set();
const pendingDelete = new Set();
const timers = {};
const $ = s => document.querySelector(s);
const app = $('#app'), main = $('#main'), listEl = $('#list');

function lsRead(){ try{ return JSON.parse(localStorage.getItem(LS) || '{}') || {}; }catch(e){ return {}; } }
function lsWrite(){ try{ localStorage.setItem(LS, JSON.stringify({ideas, current, pending:[...pendingSync], deleting:[...pendingDelete]}, (k,v) => k.charAt(0) === '_' ? undefined : v)); }catch(e){} }

async function resetApplication(){
  const confirmed = window.confirm('Isso vai apagar todas as ideias e imagens deste navegador/aplicativo e da sincronização. Essa ação não pode ser desfeita. Continuar?');
  if(!confirmed) return;
  try{
    const localIdeas = Object.values(ideas);
    const remote = db && db.collection('ideias');
    if(remote){
      try{
        const snap = await remote.get();
        const docs = snap && Array.isArray(snap.docs) ? snap.docs : [];
        await Promise.all(docs.map(d => d && d.id ? remote.doc(d.id).delete() : null));
      }catch(e){
        await Promise.all(localIdeas.map(it => remote.doc(it.id).delete().catch(() => null)));
      }
    }
    if(assetsApi){
      await Promise.all(localIdeas.flatMap(it => (it.blocos || []).filter(b => b.asset).map(b => assetsApi.delete(b.asset).catch(() => null))));
    }
    localStorage.clear();
    sessionStorage.clear();
    if(window.caches){
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    if(navigator.serviceWorker){
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    ideas = {}; current = null; pendingSync.clear(); view = 'ideas';
    window.location.reload();
  }catch(e){
    window.alert('Não foi possível concluir o reset. Tente novamente.');
  }
}

(function boot(){
  applySettings();
  const s = lsRead();
  ideas = s.ideas || {};
  (s.pending || []).forEach(id => pendingSync.add(id));
  (s.deleting || []).forEach(id => pendingDelete.add(id));
  current = s.current && ideas[s.current] ? s.current : null;
  renderList(); renderMain();
  loadBackupLocation().then(() => maybeAutomaticBackup());
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
  scheduleAutomaticBackup();
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
  delete ideas[id]; pendingSync.delete(id); pendingDelete.add(id); clearTimeout(timers[id]);
  if(current === id){
    const rest = sorted();
    current = rest[0] ? rest[0].id : null;
  }
  lsWrite(); renderList(); renderMain();
  if(db){
    try{
      await db.collection('ideias').doc(id).delete();
      pendingDelete.delete(id); lsWrite();
    }catch(e){ setTimeout(() => removeRemoteIdea(id, 0), 1200); }
  } else {
    pendingDelete.delete(id); lsWrite();
  }
}

async function removeRemoteIdea(id, attempt){
  if(!db || !pendingDelete.has(id)) return;
  try{
    await db.collection('ideias').doc(id).delete();
    pendingDelete.delete(id); lsWrite();
  }catch(e){
    if(attempt < 4) setTimeout(() => removeRemoteIdea(id, attempt + 1), 1200 * (attempt + 1));
    else { pendingDelete.delete(id); lsWrite(); }
  }
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
        if(pendingDelete.has(id)) return;
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
      if(changedCurrent && view === 'ideas' && !main.contains(document.activeElement)) renderMain();
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
$('#settingsBtn').addEventListener('click',()=>{view='settings';app.classList.remove('nav');renderMain();});
document.addEventListener('click', e => {
  const about = e.target.closest('[data-act="about"]');
  if(about){ view = 'about'; app.classList.remove('nav'); renderMain(); }
});

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

function applySettings(){
  const root=document.documentElement;
  root.dataset.theme=settings.theme==='light'?'light':'dark';
  root.classList.toggle('reduce-motion',!!settings.reduceMotion);
}
function saveSettings(){
  settings.keepBackups=Math.max(1,Math.min(50,Number(settings.keepBackups)||10));
  try{localStorage.setItem(PREFS,JSON.stringify(settings));}catch(e){}
  applySettings();
}
function backupPlugin(){return window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.BackupFolder||null;}
function openFolderDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){resolve(null);return;}
    const req=indexedDB.open('ideias-backup-handles',1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('handles'))req.result.createObjectStore('handles');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function storeFolderHandle(handle){
  const idb=await openFolderDb();if(!idb)return;
  await new Promise((resolve,reject)=>{const tx=idb.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'backup-folder');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});idb.close();
}
async function loadFolderHandle(){
  const idb=await openFolderDb();if(!idb)return null;
  const handle=await new Promise((resolve,reject)=>{const tx=idb.transaction('handles','readonly'),req=tx.objectStore('handles').get('backup-folder');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});idb.close();return handle;
}
async function loadBackupLocation(){
  try{if(!backupPlugin()&&window.showDirectoryPicker)backupFolderHandle=await loadFolderHandle();}catch(e){}
  if(backupFolderHandle&&backupFolderHandle.name){settings.backupFolderName=backupFolderHandle.name;saveSettings();}
  if(view==='settings')updateSettingsUI();
}
async function chooseBackupFolder(){
  try{
    const plugin=backupPlugin();
    if(plugin&&plugin.pickFolder){
      const r=await plugin.pickFolder();settings.backupTreeUri=r.uri;settings.backupFolderName=r.name||'Pasta selecionada';saveSettings();await updateSettingsUI();return true;
    }
    if(window.showDirectoryPicker){
      const h=await window.showDirectoryPicker({id:'ideias-backups',mode:'readwrite'});
      if(h.requestPermission&&(await h.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('Acesso de gravação não autorizado.');
      backupFolderHandle=h;settings.backupTreeUri='';settings.backupFolderName=h.name||'Pasta selecionada';await storeFolderHandle(h);saveSettings();await updateSettingsUI();return true;
    }
    window.alert('Este navegador não permite escolher uma pasta diretamente. Use “Baixar ZIP” e escolha onde salvar o arquivo.');
  }catch(e){if(e&&e.name!=='AbortError')window.alert('Não foi possível acessar essa pasta. Tente selecioná-la novamente.');}
  return false;
}
async function browserFolderPermission(request){
  if(!backupFolderHandle)return false;
  try{let p=await backupFolderHandle.queryPermission({mode:'readwrite'});if(p==='granted')return true;if(request&&backupFolderHandle.requestPermission)p=await backupFolderHandle.requestPermission({mode:'readwrite'});return p==='granted';}catch(e){return false;}
}
function backupBytes(){
  if(!window.fflate)throw new Error('Não foi possível carregar a ferramenta de ZIP.');
  const payload={format:'organizador-de-ideias-backup',formatVersion:1,appVersion:'1.4.3',createdAt:new Date().toISOString(),current,ideas:clone(ideas)};
  const guide='Backup do Organizador de Ideias\n\nO arquivo backup.json guarda suas ideias, fluxogramas, workflows, checklists, textos e imagens salvas localmente. Imagens mantidas por um serviço de sincronização externo permanecem como referências vinculadas à conta de origem.\n';
  return window.fflate.zipSync({'backup.json':window.fflate.strToU8(JSON.stringify(payload)),'LEIA-ME.txt':window.fflate.strToU8(guide)},{level:6});
}
function backupFilename(){return 'organizador-backup-'+new Date().toISOString().replace(/[:.]/g,'-').replace('T','_').slice(0,19)+'.zip';}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function blobBase64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function base64Bytes(text){const binary=atob(text);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function writeBackupFile(blob,name,automatic){
  const plugin=backupPlugin();
  if(plugin&&settings.backupTreeUri){await plugin.writeBackup({treeUri:settings.backupTreeUri,name,data:await blobBase64(blob)});return true;}
  if(backupFolderHandle){
    if(!(await browserFolderPermission(!automatic)))return false;
    const dir=await backupFolderHandle.getDirectoryHandle('backups',{create:true});
    const handle=await dir.getFileHandle(name,{create:true});const writer=await handle.createWritable();await writer.write(blob);await writer.close();return true;
  }
  return false;
}
async function backupNow({automatic=false,download=false}={}){
  try{
    if(!automatic&&!download&&!settings.backupTreeUri&&!backupFolderHandle){await chooseBackupFolder();}
    const blob=new Blob([backupBytes()],{type:'application/zip'}),name=backupFilename();
    let saved=false;
    if(!download)saved=await writeBackupFile(blob,name,automatic);
    if(download||!saved){if(automatic)return false;downloadBlob(blob,name);}
    settings.lastBackupAt=Date.now();saveSettings();
    if(view==='settings')await updateSettingsUI();
    if(!automatic&&!download&&!saved&&!window.showDirectoryPicker&&!backupPlugin())window.alert('Backup baixado. Neste navegador, escolha a pasta de destino no gerenciador de arquivos.');
    return true;
  }catch(e){if(!automatic)window.alert('Não foi possível criar o backup. Verifique o espaço disponível e tente novamente.');return false;}
}
async function listBackupFiles(){
  const plugin=backupPlugin();
  if(plugin&&settings.backupTreeUri){const r=await plugin.listBackups({treeUri:settings.backupTreeUri});return (r.files||[]).filter(f=>/\.zip$/i.test(f.name));}
  if(!backupFolderHandle||!(await browserFolderPermission(false)))return [];
  try{
    const dir=await backupFolderHandle.getDirectoryHandle('backups',{create:false}),files=[];
    for await(const [name,h] of dir.entries()){if(/\.zip$/i.test(name)){const f=await h.getFile();files.push({name,size:f.size,lastModified:f.lastModified});}}
    return files.sort((a,b)=>(b.lastModified||0)-(a.lastModified||0));
  }catch(e){return [];}
}
async function pruneBackups(){
  const files=await listBackupFiles(),excess=files.slice(Math.max(1,Math.min(50,+settings.keepBackups||10)));
  for(const f of excess){try{const p=backupPlugin();if(p&&settings.backupTreeUri)await p.deleteBackup({treeUri:settings.backupTreeUri,name:f.name});else{const d=await backupFolderHandle.getDirectoryHandle('backups');await d.removeEntry(f.name);}}catch(e){}}
}
async function maybeAutomaticBackup(){
  if(!settings.autoBackup)return;
  const ms={daily:86400000,weekly:604800000,monthly:2592000000}[settings.backupFrequency]||86400000;
  if(settings.lastBackupAt&&Date.now()-settings.lastBackupAt<ms)return;
  const p=backupPlugin(),hasLocation=(p&&settings.backupTreeUri)||backupFolderHandle;
  if(!hasLocation)return;
  if(backupFolderHandle&&!(await browserFolderPermission(false)))return;
  await backupNow({automatic:true});
}
function scheduleAutomaticBackup(){if(!settings.autoBackup)return;clearTimeout(autoBackupTimer);autoBackupTimer=setTimeout(()=>maybeAutomaticBackup(),3500);}
async function updateSettingsUI(){
  const name=document.getElementById('backupFolderName'),status=document.getElementById('backupFolderStatus'),dot=document.getElementById('backupFolderDot');
  if(!name||!status)return;
  const plugin=backupPlugin(),hasNative=!!(plugin&&settings.backupTreeUri),hasBrowser=!!backupFolderHandle;
  name.textContent=hasNative?(settings.backupFolderName||'Pasta Android selecionada'):hasBrowser?(backupFolderHandle.name||settings.backupFolderName):'Nenhuma pasta selecionada';
  const supported=!!(plugin&&plugin.pickFolder||window.showDirectoryPicker);
  status.textContent=hasNative?'Pasta Android vinculada com acesso persistente.':hasBrowser?(await browserFolderPermission(false)?'Pasta vinculada; backups salvos em backups/.':'A pasta precisa ser autorizada novamente.'):(supported?'Selecione uma pasta para gravar e listar os backups.':'Seleção direta indisponível neste navegador; use Baixar ZIP.');
  if(dot)dot.classList.toggle('connected',hasNative||(hasBrowser&&await browserFolderPermission(false)));
  const help=document.getElementById('backupFolderHelp');if(help&&!supported)help.textContent='O navegador deste dispositivo não oferece acesso direto a pastas. Use Baixar ZIP para escolher um destino; os dados continuam no armazenamento local do aplicativo.';
  const list=document.getElementById('backupList'),count=document.getElementById('backupListCount');
  if(list){
    let files=[];try{files=await listBackupFiles();}catch(e){}
    if(count)count.textContent=files.length?`(${files.length})`:'';
    list.innerHTML=files.length?files.map(f=>`<div class="backup-entry"><span class="backup-file">${ic('archive')}<strong title="${esc(f.name)}">${esc(f.name)}</strong></span><span class="backup-size">${formatBytes(f.size||0)}</span><button class="icon-action" data-settings="download-existing" data-name="${esc(f.name)}" title="Baixar backup" aria-label="Baixar backup">${ic('down')}</button><button class="icon-action" data-settings="restore-existing" data-name="${esc(f.name)}" title="Restaurar como cópia" aria-label="Restaurar backup">${ic('refresh')}</button><button class="icon-action danger" data-settings="delete-existing" data-name="${esc(f.name)}" title="Excluir backup" aria-label="Excluir backup">${ic('trash')}</button></div>`).join(''):'<span class="settings-muted">Nenhum arquivo ZIP encontrado nesta pasta.</span>';
  }
  const last=document.getElementById('lastBackupText');if(last)last.textContent=settings.lastBackupAt?'Último backup: '+fmt(settings.lastBackupAt):'Nenhum backup automático realizado ainda.';
  const dark=document.querySelector('[data-theme-pick="dark"]'),light=document.querySelector('[data-theme-pick="light"]');if(dark)dark.classList.toggle('active',settings.theme==='dark');if(light)light.classList.toggle('active',settings.theme==='light');
  const usage=document.getElementById('storageUsage');if(usage&&navigator.storage&&navigator.storage.estimate){try{const e=await navigator.storage.estimate();usage.textContent=e.usage!=null?`Armazenamento local usado: ${formatBytes(e.usage)}${e.quota?` de ${formatBytes(e.quota)}`:''}`:'';}catch(e){}}
}
function formatBytes(n){if(!n)return '0 KB';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${u[i]}`;}
async function readBackupBlob(name){
  const p=backupPlugin();if(p&&settings.backupTreeUri){const r=await p.readBackup({treeUri:settings.backupTreeUri,name});return new Blob([base64Bytes(r.data)],{type:'application/zip'});}
  const dir=await backupFolderHandle.getDirectoryHandle('backups'),h=await dir.getFileHandle(name);return await h.getFile();
}
async function restoreBackupFile(file){
  try{
    if(file.size>100*1024*1024)throw new Error('O ZIP excede o limite de 100 MB.');
    const files=window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer())),raw=files['backup.json'];if(!raw)throw new Error('ZIP sem arquivo backup.json.');
    const data=JSON.parse(window.fflate.strFromU8(raw));
    if(data.format!=='organizador-de-ideias-backup'||data.formatVersion!==1||!data.ideas||typeof data.ideas!=='object')throw new Error('Este arquivo não é um backup compatível.');
    const entries=Object.values(data.ideas).filter(x=>x&&Array.isArray(x.blocos));if(!entries.length)throw new Error('O backup não contém ideias válidas.');
    if(!window.confirm(`O backup contém ${entries.length} ideia(s). Vou importá-las como cópias, sem apagar as ideias atuais. Continuar?`))return;
    const imported=[];
    for(const source of entries){const copy=clone(source),id=uid(),now=Date.now();copy.id=id;copy.titulo=(copy.titulo||'Sem título')+' (restaurada)';copy.criadaEm=now;copy.atualizadaEm=now;ideas[id]=copy;pendingSync.add(id);imported.push(id);}
    current=imported[0]||current;lsWrite();renderList();if(view!=='settings')renderMain();for(const id of imported)push(id);scheduleAutomaticBackup();
    window.alert(`Importação concluída: ${imported.length} ideia(s) adicionada(s). As ideias existentes foram preservadas.`);
  }catch(e){window.alert(e&&e.message?e.message:'Não foi possível ler esse backup ZIP.');}
}
async function handleSettingsAction(action,name){
  if(action==='choose-folder'){await chooseBackupFolder();return;}
  if(action==='refresh-folder'){await updateSettingsUI();return;}
  if(action==='backup-now'){await backupNow();await pruneBackups();if(view==='settings')await updateSettingsUI();return;}
  if(action==='download-backup'){await backupNow({download:true});return;}
  if(action==='import-backup'){const f=document.getElementById('backupPick');f.value='';f.click();return;}
  if(action==='share-backup'){
    const blob=new Blob([backupBytes()],{type:'application/zip'}),file=new File([blob],backupFilename(),{type:'application/zip'});
    try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file],title:'Backup do Organizador de Ideias'});return;}}catch(e){if(e&&e.name==='AbortError')return;}
    downloadBlob(blob,file.name);return;
  }
  if(action==='download-existing'){const blob=await readBackupBlob(name);downloadBlob(blob,name);return;}
  if(action==='restore-existing'){const blob=await readBackupBlob(name);await restoreBackupFile(blob);return;}
  if(action==='delete-existing'){
    if(!window.confirm(`Excluir o arquivo “${name}” da pasta de backups?`))return;
    const p=backupPlugin();if(p&&settings.backupTreeUri)await p.deleteBackup({treeUri:settings.backupTreeUri,name});else{const d=await backupFolderHandle.getDirectoryHandle('backups');await d.removeEntry(name);}await updateSettingsUI();
  }
}
main.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='autoBackupToggle'){
    if(t.checked&&!settings.backupTreeUri&&!backupFolderHandle){const ok=await chooseBackupFolder();if(!ok)t.checked=false;}
    settings.autoBackup=t.checked;saveSettings();if(settings.autoBackup)scheduleAutomaticBackup();await updateSettingsUI();return;
  }
  if(t.id==='backupFrequency'){settings.backupFrequency=t.value;saveSettings();return;}
  if(t.id==='keepBackups'){settings.keepBackups=Math.max(1,Math.min(50,+t.value||10));t.value=settings.keepBackups;saveSettings();await pruneBackups();await updateSettingsUI();return;}
  if(t.id==='reduceMotionToggle'){settings.reduceMotion=t.checked;saveSettings();return;}
});
document.getElementById('backupPick').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(f)restoreBackupFile(f);});

function downloadPdf(){
  const it = cur(); if(!it) return;
  const previousTitle = document.title;
  const safeTitle = (it.titulo || 'Ideia').replace(/[\\/:*?"<>|]+/g,' ').trim();
  document.title = `${safeTitle || 'Ideia'}.pdf`;
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
}

function renderMain(){
  if(view === 'settings'){
    main.innerHTML = `
      <div class="topbar" id="topbar">
        <button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button><img class="topbar-logo" src="assets/logo-lampada.png" alt="Logo do Organizador de Ideias">
        <button class="ghost" data-act="back">${ic('down')}Voltar para ideias</button>
      </div>
      <section class="settings-page">
        <div class="settings-heading"><div><span class="eyebrow">SISTEMA</span><h1>Configurações</h1><p>Escolha onde guardar seus backups e ajuste a aparência do aplicativo.</p></div></div>
        <div class="settings-grid">
          <article class="settings-card">
            <header class="settings-card-head">${ic('folder')}<h2>Pasta de dados</h2></header>
            <div class="settings-card-body">
              <div class="setting-folder"><div><span class="setting-caption">Pasta selecionada</span><strong id="backupFolderName">Carregando…</strong></div><span class="folder-dot" id="backupFolderDot"></span></div>
              <div class="setting-actions"><button class="primary" data-settings="choose-folder">${ic('folder')}Selecionar pasta</button><button class="btn-sec" data-settings="refresh-folder">${ic('refresh')}Atualizar</button></div>
              <p class="settings-help" id="backupFolderHelp">Os backups ZIP serão salvos dentro de <code>backups/</code>. As ideias continuam no armazenamento local do aplicativo.</p>
              <div class="folder-tree"><span>Organizador de Ideias/</span><span>└── backups/</span><span>　 └── organizador-backup-*.zip</span></div>
              <div class="settings-status" id="backupFolderStatus" role="status"></div>
            </div>
          </article>
          <article class="settings-card settings-backups">
            <header class="settings-card-head">${ic('archive')}<h2>Backup e compartilhamento</h2></header>
            <div class="settings-card-body">
              <div class="setting-actions backup-actions"><button class="primary" data-settings="backup-now">${ic('archive')}Salvar backup agora</button><button class="btn-sec" data-settings="download-backup">${ic('down')}Baixar ZIP</button><button class="btn-sec" data-settings="import-backup">${ic('up')}Importar ZIP</button><button class="btn-sec" data-settings="share-backup">${ic('link')}Compartilhar</button></div>
              <p class="settings-help">O arquivo inclui ideias, textos, fluxogramas, workflows, checklists e imagens armazenadas localmente. Referências de imagens sincronizadas permanecem vinculadas à conta original.</p>
              <div class="auto-backup-box">
                <label class="setting-check"><input type="checkbox" id="autoBackupToggle" ${settings.autoBackup?'checked':''}><span><strong>Backup automático</strong></span></label>
                <div class="auto-options"><label>Frequência<select id="backupFrequency"><option value="daily" ${settings.backupFrequency==='daily'?'selected':''}>Uma vez por dia</option><option value="weekly" ${settings.backupFrequency==='weekly'?'selected':''}>Uma vez por semana</option><option value="monthly" ${settings.backupFrequency==='monthly'?'selected':''}>Uma vez por mês</option></select></label><label>Manter últimos<input id="keepBackups" type="number" min="1" max="50" value="${settings.keepBackups}"></label></div>
                <small id="lastBackupText">${settings.lastBackupAt?'Último backup: '+esc(fmt(settings.lastBackupAt)):'Nenhum backup automático realizado ainda.'}</small>
                <small class="settings-help">O automático roda quando o aplicativo está aberto e a pasta continua autorizada.</small>
              </div>
              <div class="backup-list-wrap"><div class="backup-list-title">Backups na pasta <span id="backupListCount"></span></div><div id="backupList" class="backup-list"><span class="settings-muted">Selecione uma pasta para ver os backups.</span></div></div>
            </div>
          </article>
          <article class="settings-card">
            <header class="settings-card-head">${ic('sun')}<h2>Aparência</h2></header>
            <div class="settings-card-body">
              <div class="theme-options"><button class="theme-option ${settings.theme==='dark'?'active':''}" data-theme-pick="dark">${ic('moon')}Escuro</button><button class="theme-option ${settings.theme==='light'?'active':''}" data-theme-pick="light">${ic('sun')}Claro</button></div>
              <label class="setting-check motion-check"><input type="checkbox" id="reduceMotionToggle" ${settings.reduceMotion?'checked':''}><span>Reduzir animações</span></label>
              <p class="settings-help">Ative para reduzir movimentos e transições na interface.</p>
              <div class="storage-usage" id="storageUsage"></div>
            </div>
          </article>
        </div>
      </section>`;
    updateSettingsUI();
    return;
  }
  if(view === 'about'){
    main.innerHTML = `
      <div class="topbar" id="topbar">
        <button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button><img class="topbar-logo" src="assets/logo-lampada.png" alt="Logo do Organizador de Ideias">
        <button class="ghost" data-act="back">${ic('down')}Voltar para ideias</button>
      </div>
      <section class="about-page">
        <div class="about-hero"><img src="assets/logo-lampada.png" alt="Lâmpada acesa" class="about-logo"><div><span class="eyebrow">SOBRE A PLATAFORMA</span><h1>Organizador de Ideias</h1><p>Um espaço simples para tirar ideias da cabeça e transformar pensamentos em planos visuais.</p></div></div>
        <div class="about-grid">
          <article class="about-card"><span class="about-icon">${ic('bulb')}</span><h2>Feito para pensar melhor</h2><p>Reúna anotações, imagens, fluxogramas, workflows e checklists em uma única ideia, sem perder o fio do que importa.</p></article>
          <article class="about-card"><span class="about-icon">${ic('refresh')}</span><h2>Seus dados no seu dispositivo</h2><p>O aplicativo salva automaticamente suas ideias no armazenamento local. Não é necessário criar uma conta para começar.</p></article>
          <article class="about-card"><span class="about-icon">${ic('work')}</span><h2>Plataforma aberta</h2><p>O projeto é desenvolvido com tecnologias web e empacotado para Android, mantendo o código disponível para a comunidade.</p></article>
        </div>
        <div class="about-footer"><div><span class="eyebrow">CRIADOR</span><h2>Marcos Dev</h2><p>Desenvolvido por <strong>Marcos Dev</strong> para organizar ideias com mais clareza.</p></div><a class="github-link" href="https://github.com/marcos-scox/organizador-de-ideias" target="_blank" rel="noopener">${ic('link')}Ver projeto no GitHub</a></div>
        <div class="reset-card"><div><strong>Redefinir aplicativo</strong><p>Apaga as ideias, imagens, dados locais e cache deste navegador ou aplicativo. Se a sincronização estiver ativa, remove também os dados sincronizados.</p></div><button class="btn-danger" data-act="reset">Redefinir tudo</button></div>
        <p class="about-version">Organizador de Ideias · versão 1.4.3 · Licença MIT</p>
      </section>`;
    return;
  }
  const it = current && ideas[current];
  if(!it){
    main.innerHTML = `
      <div class="topbar"><button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button><img class="topbar-logo" src="assets/logo-lampada.png" alt="Logo do Organizador de Ideias"></div>
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
      <button class="menu-btn" data-act="menu" aria-label="Abrir lista">${ic('menu')}</button><img class="topbar-logo" src="assets/logo-lampada.png" alt="Logo do Organizador de Ideias">
      <span class="save-state ok" id="saveState">Salvo</span>
      <button class="ghost pdf-button" data-act="pdf" title="Imprimir ou salvar esta ideia em PDF">${ic('img')}Baixar PDF</button>
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
  b.cores = b.cores || {};
  const palette = (items) => `<div class="block-colors" aria-label="Cores do bloco">${items.map(([key,label,def]) => `<label title="${label}"><span>${label}</span><input type="color" data-color="${key}" value="${esc(b.cores[key] || def)}" aria-label="Cor: ${label}"></label>`).join('')}</div>`;
  const headX = `<button class="head-x" data-rm aria-label="Remover bloco">${ic('trash')}Remover</button>`;
  if(b.tipo === 'texto'){
    inner = `<textarea class="txt" data-f="texto" rows="1" placeholder="Escreva sua ideia…" style="color:${esc(b.cores.texto || '#ECEAE4')};background-color:${esc(b.cores.card || 'transparent')}">${esc(b.texto)}</textarea>`;
  } else if(b.tipo === 'fluxograma'){
    inner = `<div class="card" style="--user-card:${esc(b.cores.card||'#1A1C20')}">
      <div class="card-head">${ic('flow')}<input data-f="nome" value="${esc(b.nome)}" placeholder="Fluxograma sem nome"><span class="chip">${b.nos.length} ${b.nos.length===1?'etapa':'etapas'}</span>${headX}</div>
      <div class="fc-bar">
        <button class="tb" data-fc="add" data-shape="caixa">${ic('node')}Etapa</button>
        <button class="tb" data-fc="add" data-shape="decisao">${ic('diamond')}Decisão</button>
        <button class="tb" data-fc="add" data-shape="inicio">${ic('pill')}Início/fim</button>
        <button class="tb" data-fc="add" data-shape="paralelogramo">Paralelogramo</button>
        <button class="tb" data-fc="add" data-shape="hexagono">Hexágono</button>
        <button class="tb" data-fc="add" data-shape="circulo">Círculo</button>
        <span class="sep"></span>
        <button class="tb" data-fc="link">${ic('link')}Conectar</button>
        <span class="sep"></span><button class="tb" data-zoom="out" aria-label="Diminuir zoom">−</button><span class="fc-zoom-label" data-zoom-label>100%</span><button class="tb" data-zoom="in" aria-label="Aumentar zoom">+</button><button class="tb" data-zoom="reset">Ajustar</button>
        <div class="fc-edit" data-fc-edit></div>
      </div>
      <div class="fc-wrap"><svg data-fc-svg viewBox="0 0 800 380"></svg></div>
    </div>`;
  } else if(b.tipo === 'workflow'){
    const done = b.etapas.filter(e => e.status === 'feito').length;
    const pct = b.etapas.length ? Math.round(done / b.etapas.length * 100) : 0;
    inner = `<div class="card" style="--user-card:${esc(b.cores.card||'#1A1C20')};--user-text:${esc(b.cores.texto||'#ECEAE4')};--user-shape:${esc(b.cores.forma||'#E3B04B')}">
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
    inner = `<div class="card" style="--user-card:${esc(b.cores.card||'#1A1C20')};--user-text:${esc(b.cores.texto||'#ECEAE4')};--user-shape:${esc(b.cores.forma||'#E3B04B')}">
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
  const colors = b.tipo === 'fluxograma' ? palette([['texto','Texto','#ECEAE4'],['forma','Formas','#343941'],['card','Card','#1A1C20']]) : b.tipo === 'workflow' || b.tipo === 'checklist' ? palette([['texto','Texto','#ECEAE4'],['forma','Destaque','#E3B04B'],['card','Card','#1A1C20']]) : b.tipo === 'texto' ? palette([['texto','Texto','#ECEAE4'],['card','Fundo','#0E0F11']]) : '';
  return `<section class="block ${b.tipo === 'fluxograma' ? 'block-flow' : ''}" data-b="${b.id}">${blockTools(i,n)}${inner}${colors}</section>`;
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
  if(t.dataset.nodeColor){
    const node = b.nos.find(x => x.id === b._sel); if(!node) return;
    node[t.dataset.nodeColor === 'forma' ? 'cor' : 'corTexto'] = t.value;
    drawFlow(b); touch(it.id); return;
  }
  if(t.dataset.nodeSize){
    const node = b.nos.find(x => x.id === b._sel); if(!node) return;
    const key = t.dataset.nodeSize === 'largura' ? 'largura' : 'altura';
    node[key] = +t.value;
    const output = t.parentElement.querySelector('output'); if(output) output.value = t.value;
    drawFlow(b); touch(it.id); return;
  }
  if(t.dataset.color){
    b.cores = b.cores || {}; b.cores[t.dataset.color] = t.value;
    const section = main.querySelector(`[data-b="${b.id}"]`);
    const card = section && section.querySelector('.card');
    if(t.dataset.color === 'texto' && b.tipo === 'texto') section.querySelector('.txt').style.color = t.value;
    if(t.dataset.color === 'card' && b.tipo === 'texto') section.querySelector('.txt').style.backgroundColor = t.value;
    if(card) card.style.setProperty(t.dataset.color === 'forma' ? '--user-shape' : `--user-${t.dataset.color}`, t.value);
    if(b.tipo === 'fluxograma') drawFlow(b);
    touch(it.id); return;
  }
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
  if(t.dataset.settings){handleSettingsAction(t.dataset.settings,t.dataset.name);return;}
  if(t.dataset.themePick){settings.theme=t.dataset.themePick;saveSettings();updateSettingsUI();return;}
  if(t.dataset.act === 'settings'){view='settings';app.classList.remove('nav');renderMain();return;}
  if(t.dataset.act === 'about'){ view = 'about'; app.classList.remove('nav'); renderMain(); return; }
  if(t.dataset.act === 'back'){ view = 'ideas'; renderMain(); return; }
  if(t.dataset.act === 'reset'){ resetApplication(); return; }
  if(t.dataset.act === 'new'){ newIdea(); return; }
  if(t.dataset.act === 'pdf'){ downloadPdf(); return; }
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
    const last = b.nos.find(x => x.id === b.ultimoClicado) || b.nos[b.nos.length-1];
    const node = { id:uid(), forma:shape, texto: shape === 'decisao' ? 'Decisão' : shape === 'inicio' ? (b.nos.length ? 'Fim' : 'Início') : 'Nova etapa',
      x: last ? last.x + 190 : 110, y: last ? last.y : 70 };
    b.nos.push(node);
    if(last) b.arestas.push({ id:uid(), de:last.id, para:node.id });
    b._sel = node.id; b.ultimoClicado = node.id; b._selE = null;
    touch(it.id); rerenderBlock(b); focusLabel(b); return;
  }
  if(t.dataset.fc === 'link'){ b._link = !b._link; b._src = null; drawFlow(b); return; }
  if(t.dataset.zoom){ b.zoom = b.zoom || 1; b.zoom = t.dataset.zoom === 'reset' ? 1 : Math.max(.35, Math.min(2.5, b.zoom + (t.dataset.zoom === 'in' ? .15 : -.15))); drawFlow(b); return; }
  if(t.dataset.fc === 'duplicate'){
    const original = b.nos.find(x => x.id === b._sel); if(!original) return;
    const copy = {...original,id:uid(),x:original.x+190,y:original.y+80,texto:(original.texto||'Forma')+' (cópia)'};
    b.nos.push(copy); b.arestas.push({id:uid(),de:original.id,para:copy.id});
    b._sel=copy.id; b.ultimoClicado=copy.id; b._selE=null;
    touch(it.id); rerenderBlock(b); focusLabel(b); return;
  }
  if(t.dataset.fc === 'delnode'){
    b.nos = b.nos.filter(x => x.id !== b._sel); b.arestas = b.arestas.filter(a => a.de !== b._sel && a.para !== b._sel);
    b._sel = null; touch(it.id); rerenderBlock(b); return;
  }
  if(t.dataset.fc === 'deledge'){ b.arestas = b.arestas.filter(a => a.id !== b._selE); b._selE = null; touch(it.id); drawFlow(b); return; }
  if(t.dataset.fc === 'shape'){
    const n = b.nos.find(x => x.id === b._sel); if(!n) return;
    const forms=['caixa','decisao','inicio','paralelogramo','hexagono','circulo'];
    n.forma=forms[(forms.indexOf(n.forma)+1)%forms.length];
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
function nodeSize(n){
  const baseW=n.forma==='decisao'?150:n.forma==='circulo'?90:n.forma==='paralelogramo'||n.forma==='hexagono'?150:120;
  const w=Math.max(60,Math.min(420,n.largura||Math.max(baseW,Math.min(260,(n.texto||'').length*7.4+40))));
  const baseH=n.forma==='decisao'?70:n.forma==='circulo'?90:H;
  const h=Math.max(40,Math.min(260,n.altura||baseH));
  return {w,h};
}
function edgePoint(n, tx, ty){
  const {w,h} = nodeSize(n), dx = tx - n.x, dy = ty - n.y;
  if(!dx && !dy) return {x:n.x, y:n.y};
  if(n.forma === 'circulo'){ const t=1/Math.sqrt((dx/(w/2))**2+(dy/(h/2))**2); return {x:n.x+dx*t,y:n.y+dy*t}; }
  if(n.forma === 'decisao'){ const s = 1 / (Math.abs(dx)/(w/2) + Math.abs(dy)/(h/2)); return {x:n.x + dx*s, y:n.y + dy*s}; }
  const s = Math.min((w/2)/Math.abs(dx || 1e-6), (h/2)/Math.abs(dy || 1e-6));
  return {x:n.x + dx*s, y:n.y + dy*s};
}

function drawFlow(b){
  const sec = main.querySelector(`[data-b="${b.id}"]`); if(!sec) return;
  const svg = sec.querySelector('[data-fc-svg]'); if(!svg) return;
  const bounds = b.nos.reduce((m,n) => { const z=nodeSize(n); return {x:Math.max(m.x,n.x+z.w/2+50),y:Math.max(m.y,n.y+z.h/2+50)}; }, {x:800,y:380});
  const canvasW=Math.max(800,bounds.x), canvasH=Math.max(380,bounds.y), zoom=b.zoom||1;
  svg.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);
  svg.style.width=`${canvasW*zoom}px`; svg.style.height=`${canvasH*zoom}px`;
  svg.style.setProperty('--user-text',b.cores?.texto||''); svg.style.setProperty('--user-shape',b.cores?.forma||'');
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
    else if(n.forma === 'paralelogramo') shape = `<polygon points="${n.x-w/2+Math.min(24,w*.18)},${n.y-h/2} ${n.x+w/2},${n.y-h/2} ${n.x+w/2-Math.min(24,w*.18)},${n.y+h/2} ${n.x-w/2},${n.y+h/2}"/>`;
    else if(n.forma === 'hexagono') { const inset=Math.min(24,w*.22); shape=`<polygon points="${n.x-w/2+inset},${n.y-h/2} ${n.x+w/2-inset},${n.y-h/2} ${n.x+w/2},${n.y} ${n.x+w/2-inset},${n.y+h/2} ${n.x-w/2+inset},${n.y+h/2} ${n.x-w/2},${n.y}"/>`; }
    else if(n.forma === 'circulo') shape = `<ellipse cx="${n.x}" cy="${n.y}" rx="${w/2}" ry="${h/2}"/>`;
    else shape = `<rect x="${n.x-w/2}" y="${n.y-h/2}" width="${w}" height="${h}" rx="${n.forma==='inicio'?h/2:8}"/>`;
    out += `<g class="${cls}" data-node="${n.id}" style="--node-fill:${esc(n.cor || b.cores?.forma || '#343941')};--node-text:${esc(n.corTexto || b.cores?.texto || '#ECEAE4')}">${shape}<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central">${esc(n.texto || '…')}</text></g>`;
  });
  if(!b.nos.length) out += `<text class="fc-empty" x="400" y="190" text-anchor="middle">Adicione a primeira etapa pela barra acima</text>`;
  svg.innerHTML = out;

  const zoomLabel=sec.querySelector('[data-zoom-label]'); if(zoomLabel) zoomLabel.textContent=`${Math.round(zoom*100)}%`;
  const bar = sec.querySelector('[data-fc="link"]'); if(bar) bar.classList.toggle('on', !!b._link);
  const ed = sec.querySelector('[data-fc-edit]');
  const sel = b.nos.find(x => x.id === b._sel);
  const active = document.activeElement && document.activeElement.hasAttribute && (document.activeElement.hasAttribute('data-fc-label') || document.activeElement.hasAttribute('data-node-color') || document.activeElement.hasAttribute('data-node-size')) && sec.contains(document.activeElement);
  if(active && sel) return;
  if(b._link){
    ed.innerHTML = `<span class="fc-hint">${b._src ? 'Agora clique na etapa de destino' : 'Clique na etapa de origem'}</span>`;
  } else if(sel){
    const size=nodeSize(sel);
    ed.innerHTML = `<input data-fc-label value="${esc(sel.texto)}" placeholder="Texto da etapa" aria-label="Texto da etapa">
      <label class="node-color" title="Cor desta forma">Forma<input type="color" data-node-color="forma" value="${esc(sel.cor || b.cores?.forma || '#343941')}" aria-label="Cor desta forma"></label>
      <label class="node-color" title="Cor do texto desta forma">Texto<input type="color" data-node-color="texto" value="${esc(sel.corTexto || b.cores?.texto || '#ECEAE4')}" aria-label="Cor do texto desta forma"></label>
      <label class="node-size" title="Largura da forma">Largura <input type="range" data-node-size="largura" min="60" max="420" step="10" value="${size.w}"><output>${size.w}</output></label>
      <label class="node-size" title="Altura da forma">Altura <input type="range" data-node-size="altura" min="40" max="260" step="10" value="${size.h}"><output>${size.h}</output></label>
      <button class="tb" data-fc="duplicate" title="Duplicar forma">Duplicar</button>
      <button class="tb" data-fc="shape" title="Trocar tipo de forma">${ic(sel.forma==='decisao'?'diamond':sel.forma==='inicio'?'pill':'node')}Tipo</button>
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
    if(!b._src){ b._src = id; b.ultimoClicado = id; drawFlow(b); return; }
    if(b._src !== id && !b.arestas.some(a => a.de === b._src && a.para === id)){ b.arestas.push({id:uid(), de:b._src, para:id}); touch(cur().id); }
    b.ultimoClicado = id; b._src = null; b._link = false; drawFlow(b); return;
  }
  if(g){
    const n = b.nos.find(x => x.id === g.dataset.node); const p = svgPt(svg, ev);
    drag = { b, n, svg, ox: p.x - n.x, oy: p.y - n.y, moved:false, pid: ev.pointerId };
    svg.setPointerCapture(ev.pointerId);
    b._sel = n.id; b.ultimoClicado = n.id; b._selE = null; drawFlow(b);
    ev.preventDefault(); return;
  }
  if(eg){ b._selE = eg.dataset.edge; b._sel = null; drawFlow(b); return; }
  b._sel = null; b._selE = null; drawFlow(b);
});
main.addEventListener('pointermove', ev => {
  if(!drag || ev.pointerId !== drag.pid) return;
  const p = svgPt(drag.svg, ev);
  const {w,h} = nodeSize(drag.n);
  drag.n.x = Math.round(Math.max(w/2 + 4, p.x - drag.ox));
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
