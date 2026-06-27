'use strict';
const STORAGE_KEY = 'road_to_980_state_v1';
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

let appState = loadState();
let unlocked = false;
let currentTeamName = null;
let currentTradeMode = 'missing';

function loadState(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) return JSON.parse(saved);
  } catch(e) { console.warn('Cannot load saved state', e); }
  return structuredClone(INITIAL_DATA);
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); }
function cloneInitial(){ return structuredClone(INITIAL_DATA); }
function countDuplicates(team){ return team.duplicates.length; }
function uniqueOwned(team){ return 20 - team.missing.length; }
function totals(){
  const missing = appState.teams.reduce((sum,t)=>sum + t.missing.length,0);
  const duplicates = appState.teams.reduce((sum,t)=>sum + t.duplicates.length,0);
  const owned = appState.meta.albumTotal - missing;
  return { missing, duplicates, owned, total: appState.meta.albumTotal, percent: owned / appState.meta.albumTotal * 100 };
}
function normalizeTeam(team){
  team.missing = [...new Set(team.missing)].sort((a,b)=>a-b);
  team.duplicates = team.duplicates.filter(n=>Number.isInteger(n) && n>=1 && n<=20);
}
function duplicateMap(team){
  return team.duplicates.reduce((map,n)=>{ map[n]=(map[n]||0)+1; return map; },{});
}
function stickerStatus(team, n){
  if(team.missing.includes(n)) return 'missing';
  if(team.duplicates.includes(n)) return 'duplicate';
  return 'owned';
}
function cycleSticker(teamName, n){
  if(!unlocked){
    toast('Modo solo lectura. Usa el botón superior para editar.');
    return;
  }
  const team = appState.teams.find(t=>t.name===teamName);
  if(!team) return;
  const status = stickerStatus(team,n);
  team.missing = team.missing.filter(x=>x!==n);
  team.duplicates = team.duplicates.filter(x=>x!==n);
  if(status === 'owned') team.missing.push(n);
  if(status === 'missing') team.duplicates.push(n);
  // duplicate -> owned
  normalizeTeam(team);
  saveState();
  refreshOwnerTimer();
  renderAll();
  showTeam(team.name);
}
function toast(message){
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=>t.classList.remove('show'), 1800);
}
function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active', v.id === `view-${name}`));
  $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view === name));
  if(name !== 'detail') currentTeamName = null;
  window.scrollTo({top:0, behavior:'smooth'});
}
function renderHome(){
  const t = totals();
  $('#progressPct').textContent = `${t.percent.toFixed(1)}%`;
  $('#progressRing').style.setProperty('--p', t.percent.toFixed(2));
  $('.hero-copy h2').textContent = `${t.owned} / ${t.total}`;
  $('#metricOwned').textContent = t.owned;
  $('#metricMissing').textContent = t.missing;
  $('#metricDupes').textContent = t.duplicates;
  const conflicts = findConflicts();
  $('#validationPanel').innerHTML = conflicts.length
    ? `<b>Revisar:</b> ${conflicts.join('<br>')}`
    : `Base validada: <b>${t.owned}</b> tengo + <b>${t.missing}</b> faltantes = <b>${t.total}</b>. Duplicados registrados: <b>${t.duplicates}</b>. Coca-Cola: <b>12/12</b> informativo.`;
}
function findConflicts(){
  const problems = [];
  appState.teams.forEach(team=>{
    const miss = new Set(team.missing);
    const dupUnique = new Set(team.duplicates);
    [...miss].filter(n=>dupUnique.has(n)).forEach(n=>problems.push(`${team.name} #${n} aparece como faltante y duplicado.`));
    [...miss].filter(n=>n<1||n>20).forEach(n=>problems.push(`${team.name} #${n} fuera de rango.`));
  });
  const t = totals();
  if(t.missing !== appState.meta.missingTotal) problems.push(`Faltantes esperados ${appState.meta.missingTotal}, actual ${t.missing}.`);
  if(t.duplicates !== appState.meta.duplicateTotal) problems.push(`Duplicados esperados ${appState.meta.duplicateTotal}, actual ${t.duplicates}.`);
  if(t.owned !== appState.meta.ownedTotal) problems.push(`Tengo esperado ${appState.meta.ownedTotal}, actual ${t.owned}.`);
  return problems;
}
function renderAlbum(){
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  const numberQuery = /^\d+$/.test(q) ? Number(q) : null;
  const list = $('#teamList');
  list.innerHTML = '';
  appState.teams
    .filter(team => {
      if(!q) return true;
      if(team.name.toLowerCase().includes(q)) return true;
      if(numberQuery) return team.missing.includes(numberQuery) || team.duplicates.includes(numberQuery);
      return false;
    })
    .forEach(team => {
      const owned = uniqueOwned(team);
      const pct = owned / 20 * 100;
      const btn = document.createElement('button');
      btn.className = 'team-card';
      btn.type = 'button';
      btn.innerHTML = `<div class="flag">${team.flag}</div><main><h3>${team.name}</h3><div class="sub">${owned}/20 · faltan ${team.missing.length} · dup ${countDuplicates(team)}</div><div class="mini-bar"><span style="width:${pct}%"></span></div></main><div class="count-pill">${pct.toFixed(0)}%</div>`;
      btn.addEventListener('click', () => showTeam(team.name));
      list.appendChild(btn);
    });
}
function showTeam(name){
  currentTeamName = name;
  const team = appState.teams.find(t=>t.name===name);
  if(!team) return;
  const dupMap = duplicateMap(team);
  const owned = uniqueOwned(team);
  const grid = Array.from({length:20}, (_,i)=>i+1).map(n => {
    const status = stickerStatus(team,n);
    const extra = status === 'duplicate' && dupMap[n] > 1 ? ` <small>x${dupMap[n]}</small>` : '';
    return `<button class="sticker ${status}" type="button" data-num="${n}">${n}${extra}</button>`;
  }).join('');
  $('#detailRoot').innerHTML = `
    <article class="card detail-head">
      <div class="detail-title"><div class="flag">${team.flag}</div><div><p class="eyebrow">Detalle</p><h2 id="detailTitle">${team.name}</h2></div></div>
      <div class="detail-metrics">
        <div class="mini-card"><strong>${owned}</strong><span>Tengo</span></div>
        <div class="mini-card"><strong>${team.missing.length}</strong><span>Faltan</span></div>
        <div class="mini-card"><strong>${countDuplicates(team)}</strong><span>Duplicados</span></div>
      </div>
      <div class="legend"><span>🟢 Tengo</span><span>🔴 Falta</span><span>🔵 Duplicado</span></div>
      <div class="sticker-grid">${grid}</div>
    </article>
    <article class="list-block"><h3>Faltantes</h3><div class="chips">${chips(team.missing,'red')}</div></article>
    <article class="list-block"><h3>Duplicados</h3><div class="chips">${duplicateChips(team)}</div></article>
  `;
  $$('.sticker', $('#detailRoot')).forEach(btn => btn.addEventListener('click', () => cycleSticker(team.name, Number(btn.dataset.num))));
  setView('detail');
}
function chips(nums, color){ return nums.length ? nums.map(n=>`<span class="chip ${color}">${n}</span>`).join('') : '<span class="muted">Ninguno</span>'; }
function duplicateChips(team){
  const map = duplicateMap(team);
  const nums = Object.keys(map).map(Number).sort((a,b)=>a-b);
  return nums.length ? nums.map(n=>`<span class="chip blue">${n}${map[n]>1 ? ` x${map[n]}` : ''}</span>`).join('') : '<span class="muted">Ninguno</span>';
}
function renderTrade(){
  const root = $('#tradeList');
  const isMissing = currentTradeMode === 'missing';
  root.innerHTML = appState.teams.map(team => {
    const content = isMissing ? chips(team.missing, 'red') : duplicateChips(team);
    const count = isMissing ? team.missing.length : countDuplicates(team);
    if(count === 0) return '';
    return `<article class="trade-item"><h3><span>${team.flag}</span>${team.name}</h3><div class="chips">${content}</div></article>`;
  }).join('');
}
function renderStats(){
  const t = totals();
  const byMissing = [...appState.teams].sort((a,b)=>b.missing.length-a.missing.length)[0];
  const byComplete = [...appState.teams].sort((a,b)=>a.missing.length-b.missing.length)[0];
  const byDup = [...appState.teams].sort((a,b)=>countDuplicates(b)-countDuplicates(a))[0];
  $('#statsRoot').innerHTML = `
    <div class="stat-row"><span>Progreso</span><b>${t.owned}/${t.total}</b></div>
    <div class="stat-row"><span>Porcentaje</span><b>${t.percent.toFixed(1)}%</b></div>
    <div class="stat-row"><span>Más completo</span><b>${byComplete.flag} ${byComplete.name}</b></div>
    <div class="stat-row"><span>Más faltantes</span><b>${byMissing.flag} ${byMissing.name} (${byMissing.missing.length})</b></div>
    <div class="stat-row"><span>Más duplicados</span><b>${byDup.flag} ${byDup.name} (${countDuplicates(byDup)})</b></div>
    <div class="stat-row"><span>Coca-Cola</span><b>${appState.meta.cocaCola.owned}/${appState.meta.cocaCola.total}</b></div>
  `;
}
function renderAll(){ renderHome(); renderAlbum(); renderTrade(); renderStats(); }

$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$$('[data-goto]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.goto)));
$('#backToAlbum').addEventListener('click', () => setView('album'));
$('#searchInput').addEventListener('input', renderAlbum);
$('#clearSearch').addEventListener('click', () => { $('#searchInput').value = ''; renderAlbum(); });
$$('.segment').forEach(btn => btn.addEventListener('click', () => { currentTradeMode = btn.dataset.trade; $$('.segment').forEach(b=>b.classList.toggle('active', b===btn)); renderTrade(); }));
let ownerAutoLockTimer = null;
function expectedOwnerPin(){ return [48,51,49,50].map(c => String.fromCharCode(c)).join(''); }
function lockOwner(showMessage=true){
  unlocked = false;
  $('#ownerToggle').textContent = '🔒 Solo lectura';
  $('#pinInput').value = '';
  clearTimeout(ownerAutoLockTimer);
  if(showMessage) toast('Modo solo lectura');
}
function refreshOwnerTimer(){
  if(!unlocked) return;
  clearTimeout(ownerAutoLockTimer);
  ownerAutoLockTimer = setTimeout(() => lockOwner(true), 5 * 60 * 1000);
}
function openOwnerDialog(){
  const input = $('#pinInput');
  input.value = '';
  input.setAttribute('value','');
  $('#pinDialog').showModal();
  setTimeout(()=>{ input.value = ''; input.focus(); }, 120);
}
$('#ownerToggle').addEventListener('click', () => {
  if(unlocked){ lockOwner(true); return; }
  openOwnerDialog();
});
$('#pinDialog').addEventListener('close', () => { $('#pinInput').value = ''; });
$('#pinInput').addEventListener('input', () => { $('#pinInput').value = $('#pinInput').value.replace(/\D/g,'').slice(0,4); });
$('#unlockBtn').addEventListener('click', () => {
  const input = $('#pinInput');
  if(input.value === expectedOwnerPin()){
    unlocked = true;
    $('#ownerToggle').textContent = '🔓 Editando';
    input.value = '';
    $('#pinDialog').close();
    toast('Modo dueño activado');
    refreshOwnerTimer();
  } else {
    input.value = '';
    toast('PIN incorrecto');
  }
});
['click','touchstart','keydown'].forEach(evt => document.addEventListener(evt, refreshOwnerTimer, {passive:true}));
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(appState,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'road-to-980-respaldo.json'; a.click(); URL.revokeObjectURL(a.href);
});
$('#importFile').addEventListener('change', event => {
  const file = event.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { appState = JSON.parse(reader.result); saveState(); renderAll(); toast('Respaldo importado'); } catch(e){ toast('Archivo inválido'); } };
  reader.readAsText(file);
});
$('#resetBtn').addEventListener('click', () => {
  if(!unlocked){ toast('Desbloquea con PIN primero'); return; }
  if(confirm('¿Restaurar la lista inicial?')){ appState = cloneInitial(); saveState(); renderAll(); toast('Lista restaurada'); }
});
if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{})); }
renderAll();
