const KEY='road980-state-v31'; // se mantiene para no perder cambios locales
const OWNER_HASH='NDAw'; // no muestra el PIN en UI; comprobación simple local
let state=loadState();
let currentTeam=null;
let detailFilter='all';
let pendingSticker=null;
let unlocked=false;
let lockTimer=null;
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

function clone(o){return JSON.parse(JSON.stringify(o));}
function loadState(){
  const saved=localStorage.getItem(KEY);
  if(saved){try{return JSON.parse(saved)}catch(e){}}
  return clone(window.ROAD980_DATA);
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function counts(){
  const missing=state.teams.reduce((a,t)=>a+t.missing.length,0);
  const duplicates=state.teams.reduce((a,t)=>a+t.duplicates.length,0);
  const owned=state.summary.albumTotal-missing;
  return {owned,missing,duplicates,total:state.summary.albumTotal,packs:state.summary.packs};
}
function teamCounts(t){
  const missing=t.missing.length, duplicates=t.duplicates.length, owned=t.total-missing;
  return {owned,missing,duplicates,pct:owned/t.total*100};
}
function flagSrc(code){
  const special={
    england:'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><rect width="60" height="40" fill="white"/><rect x="25" width="10" height="40" fill="#ce1124"/><rect y="15" width="60" height="10" fill="#ce1124"/></svg>`),
    scotland:'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><rect width="60" height="40" fill="#005eb8"/><path d="M0 0 L60 40 M60 0 L0 40" stroke="white" stroke-width="8"/></svg>`),
    fwc:'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><rect width="60" height="40" rx="6" fill="#f8fafc"/><text x="30" y="26" text-anchor="middle" font-size="20">🏆</text></svg>`)
  };
  return special[code] || `https://flagcdn.com/w80/${code}.png`;
}
function flagImg(t){return `<img class="flag-img" src="${flagSrc(t.code)}" alt="${t.name}" loading="lazy" onerror="this.src='${flagSrc('fwc')}'">`;}
function setView(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
function showToast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.remove('hidden');
  clearTimeout(showToast.t); showToast.t=setTimeout(()=>el.classList.add('hidden'),1600);
}
function resetLockTimer(){
  if(!unlocked)return;
  clearTimeout(lockTimer);
  lockTimer=setTimeout(()=>{unlocked=false; updateOwnerBtn(); showToast('Modo lectura activado');},5*60*1000);
}
function updateOwnerBtn(){
  const b=$('#ownerBtn'); b.textContent=unlocked?'🔓':'🔒'; b.classList.toggle('editing',unlocked); b.setAttribute('aria-label',unlocked?'Editando':'Modo propietario');
}
function verifyPin(v){ return btoa(String(Number(v)+88))===OWNER_HASH; }
function renderHome(){
  const c=counts(), pct=c.owned/c.total*100;
  $('#homeView').innerHTML=`
    <div class="hero-card">
      <div class="progress-row">
        <div class="ring" style="--p:${pct}"><div><strong>${pct.toFixed(1)}%</strong><small>completado</small></div></div>
        <div>
          <h1>Tu álbum mundial</h1>
          <p>${c.owned} / ${c.total} stickers registrados. Coca-Cola 12/12 se muestra solo como dato informativo.</p>
        </div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat green"><i>🟢</i><strong>${c.owned}</strong><span>Tengo</span></div>
      <div class="stat red"><i>🔴</i><strong>${c.missing}</strong><span>Faltan</span></div>
      <div class="stat blue"><i>🔵</i><strong>${c.duplicates}</strong><span>Duplicados</span></div>
      <div class="stat yellow"><i>📦</i><strong>${c.packs}</strong><span>Sobres</span></div>
    </div>
    <div class="quick-grid">
      <button class="quick-card" data-go="albumView"><b>🌎 Álbum</b><span>Ver países y progreso.</span></button>
      <button class="quick-card" data-go="tradeView"><b>🤝 Trade</b><span>Faltantes y duplicados.</span></button>
      <button class="quick-card" data-go="statsView"><b>📊 Estadísticas</b><span>Resumen de colección.</span></button>
      <button class="quick-card" id="backupBtn"><b>💾 Respaldo</b><span>Exportar tu colección.</span></button>
    </div>`;
  $('#backupBtn').onclick=exportState;
  $$('#homeView [data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
}
function renderAlbum(){
  $('#albumView').innerHTML=`<div class="section-head"><h2>Países</h2><button class="clear-btn" id="clearSearch">Limpiar</button></div><input id="searchInput" class="search" placeholder="🔎 Buscar país o número"></div><div id="teamList"></div>`;
  const input=$('#searchInput');
  input.oninput=()=>drawTeams(input.value);
  $('#clearSearch').onclick=()=>{input.value='';drawTeams('')};
  drawTeams('');
}
function drawTeams(q){
  q=(q||'').trim().toLowerCase();
  const list=$('#teamList'); list.innerHTML='';
  state.teams.filter(t=>!q||t.name.toLowerCase().includes(q)).forEach(t=>{
    const c=teamCounts(t), cls=c.pct<50?'low':c.pct<90?'mid':'';
    const card=document.createElement('button'); card.className='team-card';
    card.innerHTML=`${flagImg(t)}<div class="team-main"><h3>${t.name}</h3><p>${c.owned}/${t.total} · faltan ${c.missing} · dup ${c.duplicates}</p><div class="team-bar"><span style="width:${c.pct}%"></span></div></div><div class="pct-pill ${cls}">${Math.round(c.pct)}%</div>`;
    card.onclick=()=>openTeam(t.name);
    list.appendChild(card);
  });
}
function openTeam(name){currentTeam=name; detailFilter='all'; renderDetail(); setView('detailView');}
function status(t,n){ if(t.missing.includes(n))return 'missing'; if(t.duplicates.includes(n))return 'duplicate'; return 'owned'; }
function statusLabel(s){return s==='missing'?'Falta':s==='duplicate'?'Duplicado':'Tengo'}
function setStickerStatus(t,n,newStatus){
  resetLockTimer();
  t.missing=t.missing.filter(x=>x!==n);
  t.duplicates=t.duplicates.filter(x=>x!==n);
  if(newStatus==='missing') t.missing.push(n);
  if(newStatus==='duplicate') t.duplicates.push(n);
  t.missing.sort((a,b)=>a-b);
  t.duplicates.sort((a,b)=>a-b);
  save();
  renderAll();
  renderDetail(detailFilter);
  showToast(`${t.name} #${n}: ${statusLabel(newStatus)}`);
}
function openStatusSheet(t,n){
  if(!unlocked){ showToast('Activa el candado para editar'); return; }
  pendingSticker={team:t.name,number:n};
  const current=status(t,n);
  $('#sheetTitle').textContent=`${t.name} #${n}`;
  $('#sheetSubtitle').textContent=`Estado actual: ${statusLabel(current)}`;
  $$('#statusSheet [data-status]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.status===current));
  $('#statusSheet').classList.remove('hidden');
}
function closeStatusSheet(){
  pendingSticker=null;
  $('#statusSheet').classList.add('hidden');
}
function renderDetail(filter='all'){
  detailFilter=filter;
  const t=state.teams.find(x=>x.name===currentTeam)||state.teams[0]; currentTeam=t.name;
  const c=teamCounts(t);
  const btns=['all','owned','missing','duplicate'].map(f=>`<button class="${filter===f?'active':''}" data-filter="${f}">${f==='all'?'Todos':f==='owned'?'Tengo':f==='missing'?'Faltan':'Duplicados'}</button>`).join('');
  const stickers=Array.from({length:t.total},(_,i)=>i+1)
    .filter(n=>filter==='all'||status(t,n)===filter)
    .map(n=>`<button class="sticker ${status(t,n)}" data-n="${n}"><span>${n}</span></button>`).join('') || `<p class="empty">No hay stickers en este filtro.</p>`;
  $('#detailView').innerHTML=`
    <button class="back-btn" id="backAlbum">← Volver al álbum</button>
    <div class="country-hero panel">
      <div class="country-top">
        <div class="country-flag">${flagImg(t)}</div>
        <div class="country-copy"><span>Detalle de selección</span><h2>${t.name}</h2><p>${c.owned}/${t.total} stickers · ${Math.round(c.pct)}%</p></div>
        <div class="mini-ring" style="--p:${c.pct}"><strong>${Math.round(c.pct)}%</strong></div>
      </div>
      <div class="bar country-bar"><span style="width:${c.pct}%"></span></div>
      <div class="detail-stats premium">
        <div class="detail-stat green"><i>✓</i><strong>${c.owned}</strong><span>Tengo</span></div>
        <div class="detail-stat red"><i>×</i><strong>${c.missing}</strong><span>Faltan</span></div>
        <div class="detail-stat blue"><i>⧉</i><strong>${c.duplicates}</strong><span>Duplicados</span></div>
      </div>
    </div>
    <div class="panel sticker-panel clean">
      <div class="panel-title"><h3>Stickers</h3><span class="mode-badge ${unlocked?'editing':'readonly'}">${unlocked?'🔓 Editando':'🔒 Lectura'}</span></div>
      <div class="filters clean-filters">${btns}</div>
      <div class="sticker-grid v32 clean-grid">${stickers}</div>
    </div>`;
  $('#backAlbum').onclick=()=>setView('albumView');
  $$('#detailView [data-filter]').forEach(b=>b.onclick=()=>renderDetail(b.dataset.filter));
  $$('#detailView .sticker').forEach(b=>b.onclick=()=>openStatusSheet(t,Number(b.dataset.n)));
}
function chips(arr,color){return arr.length?`<div class="chips">${arr.map(n=>`<span class="chip ${color}">${n}</span>`).join('')}</div>`:`<p class="empty">Ninguno</p>`}
function renderTrade(){
  $('#tradeView').innerHTML=`<div class="section-head"><h2>Trade</h2></div>${state.teams.map(t=>{
    if(!t.missing.length&&!t.duplicates.length)return '';
    return `<div class="team-card" style="display:block"> <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${flagImg(t)}<h3 style="margin:0;font-size:24px">${t.name}</h3></div><p class="muted">Me faltan</p>${chips(t.missing,'red')}<p class="muted" style="margin-top:12px">Tengo duplicados</p>${chips(t.duplicates,'blue')}</div>`
  }).join('')}`;
}
function renderStats(){
  const c=counts();
  const best=[...state.teams].sort((a,b)=>teamCounts(b).pct-teamCounts(a).pct)[0];
  const worst=[...state.teams].sort((a,b)=>teamCounts(a).pct-teamCounts(b).pct)[0];
  const mostDup=[...state.teams].sort((a,b)=>b.duplicates.length-a.duplicates.length)[0];
  $('#statsView').innerHTML=`<div class="section-head"><h2>Stats</h2></div>
    <div class="stat-grid"><div class="stat green"><strong>${c.owned}</strong><span>Tengo</span></div><div class="stat red"><strong>${c.missing}</strong><span>Faltan</span></div><div class="stat blue"><strong>${c.duplicates}</strong><span>Dup</span></div><div class="stat yellow"><strong>12/12</strong><span>Coca-Cola</span></div></div>
    <div class="team-card">${flagImg(best)}<div class="team-main"><h3>Más completo</h3><p>${best.name} · ${teamCounts(best).owned}/${best.total}</p></div></div>
    <div class="team-card">${flagImg(worst)}<div class="team-main"><h3>Más faltantes</h3><p>${worst.name} · faltan ${worst.missing.length}</p></div></div>
    <div class="team-card">${flagImg(mostDup)}<div class="team-main"><h3>Más duplicados</h3><p>${mostDup.name} · dup ${mostDup.duplicates.length}</p></div></div>
    <div class="quick-grid" style="margin-top:12px"><button class="quick-card" id="exportBtn"><b>Exportar</b><span>Guardar respaldo JSON.</span></button><button class="quick-card" id="resetBtn"><b>Restaurar</b><span>Volver a lista inicial.</span></button></div>`;
  $('#exportBtn').onclick=exportState;
  $('#resetBtn').onclick=()=>{if(confirm('¿Restaurar lista inicial?')){state=clone(window.ROAD980_DATA);save();renderAll();setView('homeView')}};
}
function exportState(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='road-to-980-respaldo.json';a.click();}
function renderAll(){renderHome();renderAlbum();renderTrade();renderStats();updateOwnerBtn();}
function bind(){
  $$('.bottom-nav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('#ownerBtn').onclick=()=>{ if(unlocked){unlocked=false;updateOwnerBtn();showToast('Modo lectura');return;} $('#pinInput').value=''; $('#pinModal').classList.remove('hidden'); setTimeout(()=>$('#pinInput').focus(),50); };
  $('#cancelPin').onclick=()=>{$('#pinInput').value='';$('#pinModal').classList.add('hidden')};
  $('#unlockPin').onclick=()=>{const v=$('#pinInput').value; if(verifyPin(v)){unlocked=true;$('#pinInput').value='';$('#pinModal').classList.add('hidden');updateOwnerBtn();resetLockTimer();showToast('Modo propietario activo');}else{showToast('PIN incorrecto');$('#pinInput').value='';}};
  $('#pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#unlockPin').click()});
  $('#cancelStatus').onclick=closeStatusSheet;
  $('#sheetBackdrop').onclick=closeStatusSheet;
  $$('#statusSheet [data-status]').forEach(btn=>btn.onclick=()=>{
    if(!pendingSticker)return;
    const team=state.teams.find(x=>x.name===pendingSticker.team);
    const n=pendingSticker.number;
    const chosen=btn.dataset.status;
    closeStatusSheet();
    if(team){ setStickerStatus(team,n,chosen); if(navigator.vibrate) navigator.vibrate(12); }
  });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=3.3').catch(()=>{});
}
renderAll(); bind();
