"use strict";
// Radar RSS: interfaz pública sin autenticación y sin HTML sin sanear de fuentes externas.
const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('es-CL');
// Comparar referencias anteriores sin sustituir el nuevo estilo principal.
const PREVIEW_STYLE = new URLSearchParams(location.search).get('preview');
const IS_HASHNODE_PREVIEW = PREVIEW_STYLE === 'hashnode';
const IS_SUBSTACK_PREVIEW = PREVIEW_STYLE === 'substack';
const IS_STYLE_PREVIEW = IS_HASHNODE_PREVIEW || IS_SUBSTACK_PREVIEW;
function storeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
// El tema sigue al sistema operativo salvo que la persona elija uno explícitamente.
// Versiones anteriores guardaban "light" en cada visita aunque nadie lo eligiera,
// por eso solo se respeta lo guardado cuando existe la marca de elección explícita.
const THEME_EXPLICIT_KEY='radar-theme-explicit';
function initialTheme(){
  const saved=storeGet('radar-theme');
  if(storeGet(THEME_EXPLICIT_KEY)==='true'&&['system','light','dark'].includes(saved))return saved;
  return 'system';
}
const state = {
  sources: [], categories: [], items: [], health: [], generated: null,
  feedMeta:null,historyLoaded:false,historyLoading:false,historyFailed:false,
  pageView: 'dashboard', category: 'all', feed: '', mode: 'all', layout: storeGet('radar-layout') === 'list' ? 'list' : 'cards',
  theme: initialTheme(),
  search: '', page: 1, ready: false,
  density: storeGet('radar-density') === 'compact' ? 'compact' : 'comfortable',
  columns: ['auto','2','3','4','5','6'].includes(storeGet('radar-columns')) ? storeGet('radar-columns') : 'auto',
  pageSize: [12,24,36,60].includes(Number(storeGet('radar-page-size'))) ? Number(storeGet('radar-page-size')) : 36,
  maxAge: [0,1,7,30,90].includes(Number(storeGet('radar-max-age'))) ? Number(storeGet('radar-max-age')) : 0,
  fontSize: storeGet('radar-font') === 'large' ? 'large' : 'normal',
  showImages: storeGet('radar-show-images') !== 'false',
  showSummaries: storeGet('radar-show-summaries') !== 'false',
  hideRead: storeGet('radar-hide-read') === 'true',
  newTab: storeGet('radar-new-tab') !== 'false',
  sort: ['newest','oldest','source'].includes(storeGet('radar-sort')) ? storeGet('radar-sort') : 'newest',
  startMode: ['all','unread','saved'].includes(storeGet('radar-start-mode')) ? storeGet('radar-start-mode') : 'all',
  mutedKeywords: (storeGet('radar-keywords') || '').slice(0,600),
  hiddenSources: safeStoredSet('radar-hidden-sources'),
  saved: safeStoredSet('radar-saved'), read: safeStoredSet('radar-read'),
  lite: storeGet('radar-lite') === 'true',
  lastVisit: Number(storeGet('radar-last-visit')) || 0, onlyNew: false
};

const VECTOR_PATHS={
  home:'<path d="m3 10 9-7 9 7v10H5V10M9 21v-7h6v7"/>',
  newspaper:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h5v5H7zM15 8h3M15 12h3M7 16h11"/>',
  brain:'<path d="M12 5A4 4 0 0 0 5 4a5 5 0 0 0-1 8 5 5 0 0 0 6 8l2-2V5Zm0 0a4 4 0 0 1 7-1 5 5 0 0 1 1 8 5 5 0 0 1-6 8l-2-2"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-7 6-7 12 0 18 7-6 7-12 0-18"/>',
  map:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  flag:'<path d="M5 22V4m0 1c7-5 9 5 16 0v12c-7 5-9-5-16 0"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  rss:'<circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2-.5 2-2 1-2-.7L3 7l1 2-1 2v2l1 2-1 2 2.5 2.7 2-.7 2 1 .5 2h4l.5-2 2-1 2 .7L21 17l-1-2 1-2v-2l-1-2 1-2-2.5-2.7-2 .7-2-1-.5-2z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon:'<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
  external:'<path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M13 3h8v8M10 14 21 3"/>',
  'arrow-right':'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  'arrow-up':'<path d="M12 20V4M5 11l7-7 7 7"/>',
  'arrow-down':'<path d="M12 4v16M5 13l7 7 7-7"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.5 9A7.5 7.5 0 0 1 19 7l1 5M4 12l1 5a7.5 7.5 0 0 0 13.5-2"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  bookmark:'<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/>',
  share:'<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
  undo:'<path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  more:'<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  'bookmark-filled':'<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z" fill="currentColor"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  trending:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18.4 5.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  volume:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  message:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  keyboard:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  timeline:'<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h6M4 17h6"/>'
};
const CATEGORY_ICONS=['brain','cpu','globe','map','flag','compass'];
function svgIcon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');
 svg.setAttribute('stroke','currentColor');svg.setAttribute('fill','none');
 svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');
 svg.innerHTML=VECTOR_PATHS[name]||VECTOR_PATHS.newspaper;
 return svg;
}
function hydrateIcons(){document.querySelectorAll('[data-icon]').forEach(node=>node.replaceChildren(svgIcon(node.dataset.icon)));}

const CATEGORY_LABELS = ['Inteligencia Artificial', 'Tecnología', 'Internacionales', 'Chile', 'Venezuela', 'Latinoamérica'];

function safeStoredSet(key) {
  try {
    const data = JSON.parse(storeGet(key) || '[]');
    return new Set(Array.isArray(data) ? data.filter(x => typeof x === 'string').slice(key === 'radar-read' ? -5000 : -4000) : []);
  } catch { return new Set(); }
}
function persist(key, values) {
  try { localStorage.setItem(key, JSON.stringify([...values].slice(key === 'radar-read' ? -5000 : -4000))); } catch { /* modo privado o almacenamiento bloqueado */ }
}
function safeURL(raw) {
  try { const u = new URL(raw); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}
function mk(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = value;
  return node;
}
function link(url, label, className = '') {
  const node = mk('a', className, label);
  node.href = safeURL(url) || '#';
  node.target = '_blank';
  node.rel = 'noopener noreferrer external';
  node.referrerPolicy = 'no-referrer';
  return node;
}
function ageDate(input) {
  if (!input) return 'Sin fecha';
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return 'Sin fecha';
  const minutes = Math.max(0, (Date.now() - dt.getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${Math.floor(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `Hace ${Math.floor(hours)} h`;
  if (hours < 48) return 'Ayer';
  const days = hours / 24;
  if (days < 7) return `Hace ${Math.floor(days)} días`;
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
}
function timeNode(input, className='') {
  const node = mk('time', className, ageDate(input));
  const dt = new Date(input || '');
  if (!Number.isNaN(dt.getTime())) {
    node.dateTime = dt.toISOString();
    node.title = new Intl.DateTimeFormat('es-CL', { dateStyle: 'full', timeStyle: 'short' }).format(dt);
  }
  return node;
}
function shortDate(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
function stripAccents(s) { return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
// Los prefijos del OPML (MEDIO, REGIONAL, OFICIAL, SÁTIRA…) organizan las suscripciones.
// En pantalla se muestra el nombre limpio y, cuando informa al lector, un sello aparte.
const SOURCE_PREFIX=/^\s*(MEDIO|REGIONAL|OFICIAL|SÁTIRA|SATIRA|ANÁLISIS|ANALISIS|TENDENCIA|TÉCNICO|TECNICO|VIDEO|IMPACTO|RADAR)\s*[—–-]\s*/i;
const SOURCE_KINDS={OFICIAL:['Oficial','Fuente oficial: comunicado de un organismo público o empresa'],
  'SÁTIRA':['Sátira','Medio humorístico: el contenido no es una noticia real'],SATIRA:['Sátira','Medio humorístico: el contenido no es una noticia real'],
  'ANÁLISIS':['Análisis','Análisis u opinión especializada'],ANALISIS:['Análisis','Análisis u opinión especializada'],
  VIDEO:['Video','Contenido en video']};
function sourceLabel(name, fallback='Fuente RSS') {
  const raw=String(name||'').trim();
  const cleaned=raw.replace(SOURCE_PREFIX,'').trim();
  return cleaned||raw||fallback;
}
function sourceKind(...names){
  for(const name of names){
    const match=String(name||'').match(SOURCE_PREFIX);
    const kind=match&&SOURCE_KINDS[match[1].toUpperCase()];
    if(kind)return {label:kind[0],hint:kind[1],key:kind[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};
  }
  return null;
}
function kindBadge(item){
  const kind=sourceKind(item.source,item.publisher);
  if(!kind)return null;
  const badge=mk('span','source-kind kind-'+kind.key,kind.label);badge.title=kind.hint;
  return badge;
}
// Cobertura: número de fuentes distintas que publicaron la misma historia.
function coverageOf(item){
  if(Number.isFinite(item?.coverage)&&item.coverage>0)return item.coverage;
  const ids=new Set(item?.source_ids||[]);
  for(const alt of (Array.isArray(item?.also_in)?item.also_in:[]))ids.add(alt.source_id||alt.publisher||alt.url);
  return Math.max(1,ids.size);
}
function storyTime(item){
  const t=new Date(item?.published_at||item?.first_seen_at||0).getTime();
  return Number.isFinite(t)?t:0;
}
// «Mientras no estabas»: noticias que Radar vio por primera vez después de tu última visita.
function isNewSinceVisit(item){
  if(!state.lastVisit)return false;
  const seen=new Date(item?.first_seen_at||0).getTime();
  return Number.isFinite(seen)&&seen>state.lastVisit;
}
function categoryLabel(cat) {
  const idx = state.categories.indexOf(cat);
  return idx >= 0 ? (CATEGORY_LABELS[idx] || cat.replace(/^\d+\s*-\s*/, '')) : String(cat || 'Noticias');
}
const browserTheme = window.matchMedia?.('(prefers-color-scheme: light)');
function setTheme(theme, explicit=false) {
  state.theme = ['light','dark','system'].includes(theme) ? theme : 'system';
  const light=IS_STYLE_PREVIEW || state.theme==='light' || (state.theme==='system' && Boolean(browserTheme?.matches));
  document.body.classList.toggle('light',light);
  $('themeGlyph').replaceChildren(svgIcon(light?'moon':'sun'));
  $('themeToggle').setAttribute('aria-label',light?'Cambiar a modo oscuro':'Cambiar a modo claro');
  $('themeToggle').title=light?'Modo oscuro':'Modo claro';
  if(!IS_STYLE_PREVIEW)document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#ffffff':'#181b1b');
  if(explicit&&!IS_STYLE_PREVIEW){
    try{localStorage.setItem('radar-theme',state.theme);localStorage.setItem(THEME_EXPLICIT_KEY,'true');}catch{}
  }
}
function setColumns(value){
  state.columns=['auto','2','3','4','5','6'].includes(value)?value:'auto';
  savePref('columns',state.columns);
  applyDisplaySettings();
  $('settingColumns').value=state.columns;
}
function syncColumnsControl(){
  $('columnsCurrent').textContent=state.columns==='auto'?'Auto':state.columns;
  $('columnsToggle').title=state.columns==='auto'?'Tarjetas · columnas automáticas':'Tarjetas · '+state.columns+' columnas';
  $('columnsToggle').setAttribute('aria-label',state.columns==='auto'?'Configurar columnas automáticas':'Configurar '+state.columns+' columnas');
  document.querySelectorAll('#columnsMenu [data-columns]').forEach(option=>{
    const active=option.dataset.columns===state.columns;
    option.setAttribute('aria-checked',String(active));
    option.classList.toggle('selected',active);
  });
}

function closeColumnsMenu(restoreFocus=false){
  const menu=$('columnsMenu');
  if(menu.hidden)return;
  menu.hidden=true;
  $('columnsToggle').setAttribute('aria-expanded','false');
  if(restoreFocus)$('columnsToggle').focus();
}
function openColumnsMenu(focusOption=false){
  const menu=$('columnsMenu');
  menu.hidden=false;
  $('columnsToggle').setAttribute('aria-expanded','true');
  syncColumnsControl();
  if(focusOption){
    (menu.querySelector('[aria-checked="true"]')||menu.querySelector('[data-columns]'))?.focus();
  }
}
function chooseColumns(value){
  if(state.layout!=='cards'){
    state.layout='cards';state.page=1;progressiveLoads=0;
    savePref('layout',state.layout);
  }
  setColumns(value);render();
  closeColumnsMenu(true);
}
function initColumnsMenu(){
  const toggle=$('columnsToggle'),menu=$('columnsMenu');
  const entries=[...menu.querySelectorAll('button[data-columns]')];
  toggle.addEventListener('click',()=>{
    if(menu.hidden)openColumnsMenu(false);else closeColumnsMenu();
  });
  toggle.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();openColumnsMenu(true);
      if(event.key==='ArrowUp')entries[entries.length-1].focus();
    }
  });
  entries.forEach((button,index)=>{
    button.addEventListener('click',()=>chooseColumns(button.dataset.columns));
    button.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?entries.length-1:
          (index+(event.key==='ArrowDown'?1:-1)+entries.length)%entries.length;
        entries[next].focus();
      }else if(event.key==='Escape'){
        event.preventDefault();closeColumnsMenu(true);
      }else if(event.key==='Tab')closeColumnsMenu();
    });
  });
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('#cardsColumnsControl'))closeColumnsMenu();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!menu.hidden){event.preventDefault();closeColumnsMenu(true);}
  });
  document.addEventListener('focusin',event=>{
    if(!menu.hidden&&!event.target.closest('#cardsColumnsControl'))closeColumnsMenu();
  });
}
function applyDisplaySettings() {
  document.body.classList.toggle('compact',state.density==='compact');
  document.body.classList.toggle('font-large',state.fontSize==='large');
  document.body.classList.toggle('hide-images',!state.showImages);
  document.body.classList.toggle('hide-summaries',!state.showSummaries);
  document.body.dataset.columns=state.columns;
  document.body.classList.toggle('layout-list',state.layout==='list');
  syncColumnsControl();
}
function downloadText(name,body,mime) {
  const obj=URL.createObjectURL(new Blob([body],{type:mime}));
  const a=document.createElement('a');a.href=obj;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(obj),2000);
}
function escapeXML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function savePref(key,value) {try{localStorage.setItem('radar-'+key,String(value));}catch{}}
function selectedTab(name) {
  document.querySelectorAll('[data-settings-tab]').forEach(x=>{
    const active=x.dataset.settingsTab===name;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('[data-settings-pane]').forEach(x=>{const active=x.dataset.settingsPane===name;x.classList.toggle('active',active);x.hidden=!active;});
  const scroll=$('settingsPages');
  if(scroll)scroll.scrollTop=0;
  if(name==='health')renderFeedHealth();
  if(name==='data')updateDataCounts();
}
function updateDataCounts(){
  $('dataSavedCount').textContent=state.saved.size;
  $('dataReadCount').textContent=state.read.size;
  $('dataMutedCount').textContent=state.hiddenSources.size;
}
function renderFeedHealth(){
  const total=state.health.length,ok=state.health.filter(x=>x.state==='ok').length,
    empty=state.health.filter(x=>x.state==='empty').length,
    broken=state.health.filter(x=>x.state==='error').length,
    stale=state.health.filter(x=>x.state==='stale').length;
  $('healthSummary').textContent=total?`${ok} de ${total} fuentes se leyeron bien · ${broken} no disponibles · ${empty} sin noticias · ${stale} sin novedades hace más de un año`:'';
  const list=$('healthFeedList');list.replaceChildren();
  const issues=state.health.filter(x=>x.state!=='ok');
  if(!issues.length){list.append(mk('p','setting-hint',total?'Sin incidencias detectadas en la última actualización.':'Aún no hay un diagnóstico disponible.'));return;}
  for(const source of issues){
    const row=mk('div','health-row');
    const heading=mk('strong','',sourceLabel(source.name,'Fuente'));
    const meta=mk('small','',feedProblemLabel(source));
    const detail=mk('span','',friendlyFeedProblem(source));
    if(source.error)detail.title='Detalle técnico: '+source.error;
    row.append(heading,meta,detail);list.append(row);
  }
}
function renderCategoryToggles(){
  const area=$('settingsCategories');area.replaceChildren();
  for(const category of state.categories){
    const sources=state.sources.filter(x=>x.category===category);
    const visible=sources.filter(x=>!state.hiddenSources.has(x.id)).length;
    const btn=mk('button','settings-category-toggle',`${categoryLabel(category)} · ${visible}/${sources.length}`);
    btn.type='button';btn.setAttribute('aria-label',`Alternar categoría ${categoryLabel(category)}`);
    btn.addEventListener('click',()=>{
      if(visible===sources.length) sources.forEach(x=>state.hiddenSources.add(x.id));
      else sources.forEach(x=>state.hiddenSources.delete(x.id));
      persist('radar-hidden-sources',state.hiddenSources);
      state.page=1;refreshFeedUI();renderSettingsSources();
    });area.append(btn);
  }
}
function refreshFeedUI() {
  if (state.feed && state.hiddenSources.has(state.feed)) state.feed='';
  fillSelect(); buildNav(); render();
}
function syncSettings() {
  $('settingTheme').value=state.theme;
  $('settingLayout').value=state.layout;
  $('settingColumns').value=state.columns;
  $('settingDensity').value=state.density;
  $('settingPageSize').value=String(state.pageSize);
  $('settingAge').value=String(state.maxAge);
  $('settingFont').value=state.fontSize;
  $('settingImages').checked=state.showImages;
  $('settingSummaries').checked=state.showSummaries;
  $('settingSort').value=state.sort;
  $('settingStartMode').value=state.startMode;
  $('settingHideRead').checked=state.hideRead;
  $('settingNewTab').checked=state.newTab;
  $('settingKeywords').value=state.mutedKeywords;
  renderSettingsSources();
  updateDataCounts();
  selectedTab('appearance');
}
function renderSettingsSources() {
  const search=stripAccents($('settingsSourceSearch').value.trim());
  const list=$('settingsSources'); list.replaceChildren();
  const ordered=state.sources.slice().sort((a,b)=>a.category.localeCompare(b.category,'es') || a.name.localeCompare(b.name,'es'));
  let displayed=0;
  for (const source of ordered) {
    if (search && !stripAccents(source.name + ' ' + categoryLabel(source.category)).includes(search)) continue;
    displayed++;
    const label=mk('label','settings-source-row');
    const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=!state.hiddenSources.has(source.id);
    checkbox.setAttribute('aria-label','Mostrar '+source.name);
    const line=mk('span','settings-source-details'); line.append(mk('span','settings-source-name',sourceLabel(source.name)),mk('small','',categoryLabel(source.category)));
    label.append(checkbox,line); list.append(label);
    checkbox.addEventListener('change',()=>{
      if (checkbox.checked) state.hiddenSources.delete(source.id); else state.hiddenSources.add(source.id);
      persist('radar-hidden-sources',state.hiddenSources);
      state.page=1; refreshFeedUI();
      updateSettingsSourceCount(displayed);
    });
  }
  updateSettingsSourceCount(displayed);
  renderCategoryToggles();
}
function updateSettingsSourceCount(visibleInSearch) {
  const visible=state.sources.filter(x=>!state.hiddenSources.has(x.id)).length;
  $('settingsSourceCount').textContent=`${visible} de ${state.sources.length} fuentes activas en este navegador · ${visibleInSearch} en esta búsqueda`;

}
function initSettingsHandlers(){
  const dialog=$('settingsDialog');
  $('settingsButton').addEventListener('click',()=>{
    syncSettings();dialog.showModal();
    $('settingsPages').scrollTop=0;
  });
  $('closeSettings').addEventListener('click',()=>dialog.close());
  $('settingsDone').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  document.querySelectorAll('[data-settings-tab]').forEach(el=>el.addEventListener('click',()=>selectedTab(el.dataset.settingsTab)));
  $('settingTheme').addEventListener('change',e=>setTheme(e.target.value,true));
  browserTheme?.addEventListener?.('change',()=>{if(state.theme==='system')setTheme('system');});
  $('settingLayout').addEventListener('change',e=>{state.layout=e.target.value;savePref('layout',state.layout);state.page=1;applyDisplaySettings();render();});
  $('settingColumns').addEventListener('change',e=>setColumns(e.target.value));
  $('settingDensity').addEventListener('change',e=>{state.density=e.target.value;savePref('density',state.density);applyDisplaySettings();});
  $('settingFont').addEventListener('change',e=>{state.fontSize=e.target.value;savePref('font',state.fontSize);applyDisplaySettings();});
  $('settingPageSize').addEventListener('change',e=>{state.pageSize=Number(e.target.value);savePref('page-size',state.pageSize);state.page=1;render();});
  $('settingAge').addEventListener('change',e=>{state.maxAge=Number(e.target.value);savePref('max-age',state.maxAge);state.page=1;render();});
  for(const [id,key,field] of [['settingImages','show-images','showImages'],['settingSummaries','show-summaries','showSummaries']]){
    $(id).addEventListener('change',e=>{state[field]=e.target.checked;savePref(key,state[field]);applyDisplaySettings();});
  }
  $('settingHideRead').addEventListener('change',e=>{state.hideRead=e.target.checked;savePref('hide-read',state.hideRead);state.page=1;render();});
  $('settingNewTab').addEventListener('change',e=>{state.newTab=e.target.checked;savePref('new-tab',state.newTab);render();});
  $('settingSort').addEventListener('change',e=>{state.sort=e.target.value;savePref('sort',state.sort);state.page=1;render();});
  $('settingStartMode').addEventListener('change',e=>{state.startMode=e.target.value;savePref('start-mode',state.startMode);state.mode=state.startMode;state.page=1;render();});
  $('settingKeywords').addEventListener('input',e=>{state.mutedKeywords=e.target.value.slice(0,600);savePref('keywords',state.mutedKeywords);state.page=1;render();});
  $('settingsSourceSearch').addEventListener('input',renderSettingsSources);
  $('showAllSources').addEventListener('click',()=>{state.hiddenSources.clear();persist('radar-hidden-sources',state.hiddenSources);state.page=1;refreshFeedUI();renderSettingsSources();});
  $('exportOPML').addEventListener('click',()=>{
    let lines=['<?xml version="1.0" encoding="UTF-8"?>','<opml version="2.0"><head><title>Mis fuentes Radar RSS</title></head><body>'];
    for(const category of state.categories){
      lines.push(`<outline text="${escapeXML(category)}">`);
      for(const f of state.sources.filter(x=>x.category===category&&!state.hiddenSources.has(x.id))){
        lines.push(`<outline type="rss" text="${escapeXML(f.name)}" title="${escapeXML(f.name)}" xmlUrl="${escapeXML(f.url)}" htmlUrl="${escapeXML(f.website||'')}"/>`);
      }lines.push('</outline>');
    }lines.push('</body></opml>');downloadText('radar-rss-mis-fuentes.opml',lines.join('\n'),'application/xml;charset=utf-8');
  });
  $('exportData').addEventListener('click',()=>{
    const data={format:'radar-rss-settings-v2',exported_at:new Date().toISOString(),preferences:{theme:state.theme,layout:state.layout,columns:state.columns,density:state.density,pageSize:state.pageSize,maxAge:state.maxAge,fontSize:state.fontSize,showImages:state.showImages,showSummaries:state.showSummaries,hideRead:state.hideRead,newTab:state.newTab,sort:state.sort,startMode:state.startMode,mutedKeywords:state.mutedKeywords},hiddenSources:[...state.hiddenSources],saved:[...state.saved],read:[...state.read]};
    downloadText('radar-rss-preferencias.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
    $('dataNotice').textContent='Archivo de respaldo generado.';
  });
  $('importData').addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(file.size>1_000_000){$('dataNotice').textContent='El archivo supera el límite de 1 MB.';return;}
    try{
      const data=JSON.parse(await file.text());if(data.format!=='radar-rss-settings-v2'||typeof data.preferences!=='object')throw Error('Formato incompatible');
      const p=data.preferences,select=(key,allowed,def)=>allowed.includes(p[key])?p[key]:def;
      state.theme=select('theme',['system','light','dark'],'system');state.layout=select('layout',['cards','list'],'cards');state.columns=select('columns',['auto','2','3','4','5','6'],'auto');state.density=select('density',['comfortable','compact'],'comfortable');
      state.pageSize=select('pageSize',[12,24,36,60],36);state.maxAge=select('maxAge',[0,1,7,30,90],0);state.fontSize=select('fontSize',['normal','large'],'normal');
      for(const field of ['showImages','showSummaries','hideRead','newTab'])if(typeof p[field]==='boolean')state[field]=p[field];
      state.sort=select('sort',['newest','oldest','source'],'newest');state.startMode=select('startMode',['all','unread','saved'],'all');state.mutedKeywords=typeof p.mutedKeywords==='string'?p.mutedKeywords.slice(0,600):'';
      const valid=new Set(state.sources.map(x=>x.id));
      for(const [k,key,onlyValid] of [['hiddenSources','radar-hidden-sources',true],['saved','radar-saved',false],['read','radar-read',false]]){
        state[k]=new Set((Array.isArray(data[k])?data[k]:[]).filter(x=>typeof x==='string'&&x.length<150&&(!onlyValid||valid.has(x))).slice(-4000));persist(key,state[k]);
      }
      for(const [key,value] of [['layout',state.layout],['columns',state.columns],['theme',state.theme],['density',state.density],['font',state.fontSize],['page-size',state.pageSize],['max-age',state.maxAge],['show-images',state.showImages],['show-summaries',state.showSummaries],['hide-read',state.hideRead],['new-tab',state.newTab],['sort',state.sort],['start-mode',state.startMode],['keywords',state.mutedKeywords]])savePref(key,value);
      state.mode=state.startMode;state.page=1;setTheme(state.theme,true);applyDisplaySettings();refreshFeedUI();syncSettings();selectedTab('data');$('dataNotice').textContent='Preferencias y datos importados correctamente.';
    }catch{$('dataNotice').textContent='No se pudo importar. Utiliza un respaldo JSON generado por Radar RSS.';}
  });
  $('clearRead').addEventListener('click',()=>{if(confirm('¿Borrar el historial de lectura de este navegador?')){state.read.clear();persist('radar-read',state.read);state.page=1;render();updateDataCounts();$('dataNotice').textContent='Historial borrado.';}});
  $('clearSaved').addEventListener('click',()=>{if(confirm('¿Vaciar los artículos guardados en este navegador?')){state.saved.clear();persist('radar-saved',state.saved);state.page=1;render();updateDataCounts();$('dataNotice').textContent='Guardadas vaciadas.';}});
  $('resetSettings').addEventListener('click',()=>{
    if(!confirm('¿Restablecer las preferencias? Tus artículos leídos y guardados no se borrarán.'))return;
    for(const key of ['layout','columns','theme','density','font','page-size','max-age','show-hero','show-images','show-summaries','hide-read','new-tab','sort','start-mode','keywords','hidden-sources','sidebar-width','theme-explicit']){try{localStorage.removeItem('radar-'+key);}catch{}}
    state.theme='system';state.layout='cards';state.columns='auto';state.density='comfortable';state.fontSize='normal';state.pageSize=36;state.maxAge=0;
    state.showImages=true;state.showSummaries=true;state.hideRead=false;state.newTab=true;state.sort='newest';state.startMode='all';state.mode='all';state.mutedKeywords='';state.hiddenSources.clear();state.page=1;
    setTheme('system');applyDisplaySettings();$('settingsSourceSearch').value='';refreshFeedUI();syncSettings();selectedTab('data');$('dataNotice').textContent='Preferencias restablecidas.';
    window.dispatchEvent(new Event('radar-sidebar-pref-sync'));
  });
}
function buildNav() {
  const nav=$('categoryNav');
  nav.replaceChildren();
  const core=[{id:'home',label:'Inicio'},{id:'all',label:'Todas las noticias'}];
  const folders=state.categories.map(id=>({id,label:categoryLabel(id)}));
  const sourceFolderNav=document.getElementById('libraryFolderNav');
  if(sourceFolderNav)sourceFolderNav.replaceChildren();
  function addRow(entry,index,parent){
    const active=entry.id==='home'?state.pageView==='dashboard':
      state.pageView==='feed'&&state.category===entry.id;
    const isFolder=index>=2;
    const button=mk('button','nav-link'+(active?' active':'')+(isFolder?' system-folder-link':''));
    button.type='button';
    if(isFolder){const topic=state.categories.indexOf(entry.id);if(topic>=0)button.dataset.topic=String(topic+1);}
    button.setAttribute('aria-current',active?'page':'false');
    button.title=entry.label;
    if(isFolder)button.setAttribute('aria-label','Carpeta de fuentes: '+entry.label);
    const symbol=mk('span','nav-glyph');
    symbol.append(svgIcon(index===0?'home':index===1?'newspaper':'folder'));
    const left=mk('span','nav-left');
    left.append(symbol,mk('span','nav-label',entry.label));
    const sources=entry.id==='all'?state.sources.filter(s=>!state.hiddenSources.has(s.id)):
      state.sources.filter(s=>s.category===entry.id&&!state.hiddenSources.has(s.id));
    button.append(left,mk('span','nav-count',entry.id==='home'?'':String(sources.length)));
    button.addEventListener('click',()=>goTo(entry.id));
    parent.append(button);
  }
  core.forEach((entry,index)=>addRow(entry,index,nav));
  if(sourceFolderNav){
    folders.forEach((entry,index)=>addRow(entry,index+2,sourceFolderNav));
  }else if(folders.length){
    // Respaldo visual si el módulo de biblioteca no está disponible.
    const section=mk('section','source-folders-section');
    section.append(mk('div','folder-group-head','CARPETAS DE FUENTES'));
    const list=mk('div','library-system-folders');
    folders.forEach((entry,index)=>addRow(entry,index+2,list));
    section.append(list);nav.append(section);
  }
  renderTopicRail();
}
function renderTopicRail(){
 const rail=$('topicRail');rail.replaceChildren();
 const entries=[{id:'home',label:'Inicio'},{id:'briefing',label:'Resumen'},{id:'all',label:'Todas'},...state.categories.map(id=>({id,label:categoryLabel(id)}))];
 let current=null;
 entries.forEach(entry=>{
  const active=entry.id==='home'?state.pageView==='dashboard':entry.id==='briefing'?state.pageView==='briefing':state.pageView==='feed'&&state.category===entry.id;
  const button=mk('button','topic-chip'+(active?' active':''),entry.label);button.type='button';
  const topic=state.categories.indexOf(entry.id);if(topic>=0)button.dataset.topic=String(topic+1);
  button.setAttribute('aria-current',active?'page':'false');
  button.addEventListener('click',()=>goTo(entry.id));rail.append(button);
  if(active)current=button;
 });
 // Mantener visible la sección activa sin mover la página verticalmente.
 if(current)requestAnimationFrame(()=>{rail.scrollLeft=Math.max(0,current.offsetLeft-rail.offsetLeft-16);});
}
// V11: navegación editorial horizontal en cualquier pantalla.
// La biblioteca detallada permanece accesible en un cajón bajo demanda,
// con foco, cierre por Escape y fondo inerte tanto en escritorio como móvil.
const MOBILE_NAV=window.matchMedia('(min-width: 0px)');
function setNavOpen(open,restoreFocus=true){
  const sidebar=$('appSidebar'),page=document.querySelector('.page');
  if(!sidebar||!page)return;
  const mobile=MOBILE_NAV.matches,wasOpen=document.body.classList.contains('nav-open');
  const next=mobile&&open;
  document.body.classList.toggle('nav-open',next);
  $('menuToggle').setAttribute('aria-expanded',String(next));
  $('sidebarBackdrop').hidden=!next;
  sidebar.inert=mobile&&!next;
  page.inert=next;
  if(mobile)sidebar.setAttribute('aria-modal',String(next));else sidebar.removeAttribute('aria-modal');
  if(next&&!wasOpen){
    (sidebar.querySelector('.nav-link.active')||sidebar.querySelector('.nav-link'))?.focus({preventScroll:true});
  }else if(!next&&wasOpen&&restoreFocus){
    $('menuToggle').focus();
  }
}
function initMobileNav(){
  $('menuToggle').addEventListener('click',()=>setNavOpen(!document.body.classList.contains('nav-open')));
  $('menuClose').addEventListener('click',()=>setNavOpen(false));
  $('sidebarBackdrop').addEventListener('click',()=>setNavOpen(false));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.body.classList.contains('nav-open')&&!document.querySelector('dialog[open]')){
      event.preventDefault();setNavOpen(false);
    }
  });
  const sync=()=>setNavOpen(false,false);
  MOBILE_NAV.addEventListener?.('change',sync);
  sync();
}
function goTo(target){
  const hash=target==='home'?'#inicio':target==='all'?'#noticias':target==='briefing'?'#resumen':'#categoria/'+encodeURIComponent(target);
  if(window.location.hash===hash)navigateFromHash();
  else window.location.hash=hash;
}
function navigateFromHash(){
  closeColumnsMenu();closeCardMenu();setNavOpen(false,false);
  const hash=decodeURIComponent(window.location.hash.slice(1));
  state.pageView=(!hash||hash==='inicio')?'dashboard':hash==='resumen'?'briefing':'feed';
  state.category=hash.startsWith('categoria/')&&state.categories.includes(hash.slice(10))?hash.slice(10):'all';
  state.feed='';
  state.page=1;progressiveLoads=0;
  baseDescription=null;
  updateHeader();buildNav();fillSelect();
  $('dashboardView').hidden=state.pageView!=='dashboard';
  $('feedView').hidden=state.pageView!=='feed';
  $('briefingView').hidden=state.pageView!=='briefing';
  document.body.classList.toggle('on-dashboard',state.pageView==='dashboard');
  document.body.classList.toggle('on-briefing',state.pageView==='briefing');
  render();
}
function fillSelect() {
  const select = $('sourceSelect'); const old = state.feed; select.replaceChildren();
  const defaultOpt = document.createElement('option'); defaultOpt.value=''; defaultOpt.textContent='Todas las fuentes'; select.append(defaultOpt);
  state.sources.filter(x => !state.hiddenSources.has(x.id) && (state.category === 'all' || x.category === state.category))
    .sort((a,b) => a.name.localeCompare(b.name,'es'))
    .forEach(x => { const option=document.createElement('option'); option.value=x.id; option.textContent=x.name; select.append(option); });
  select.value = old && [...select.options].some(x => x.value === old) ? old : '';
  state.feed = select.value;
}
// Contadores contextuales del selector; excluyen únicamente el propio filtro fuente.
// Se derivan de los artículos ya cargados, sin nuevas consultas a los medios.
function updateSourceCounts(){
  const select=$('sourceSelect');
  if(!select||select.options.length<2)return;
  const selected=state.feed;
  let eligible;
  try{
    state.feed='';
    eligible=applyFilters();
  }finally{
    state.feed=selected;
  }
  const counts=new Map();
  for(const item of eligible){
    for(const id of new Set(Array.isArray(item.source_ids)?item.source_ids:[])){
      counts.set(id,(counts.get(id)||0)+1);
    }
  }
  const sourceNames=new Map(state.sources.map(source=>[source.id,sourceLabel(source.name)]));
  for(const option of [...select.options].slice(1)){
    const amount=counts.get(option.value)||0;
    option.textContent=`${sourceNames.get(option.value)||option.textContent} (${format.format(amount)})`;
    option.title=`${format.format(amount)} noticias con los filtros actuales`;
  }
}
function updateHeader() {
  const name = state.category === 'all' ? 'Todas las noticias' : categoryLabel(state.category);
  $('feedHeading').textContent = name;
  $('topbarSection').textContent = state.pageView === 'dashboard' ? 'Inicio' : state.pageView === 'briefing' ? 'Resumen del día' : name;
  $('sectionEyebrow').textContent = state.category === 'all' ? 'SELECCIÓN EDITORIAL' : 'EXPLORAR CATEGORÍA';
  $('feedDescription').textContent = state.category === 'all' ? 'Titulares y novedades de todas las fuentes.' : `Noticias recientes de ${name}.`;
}
// Mientras hay una búsqueda, la descripción muestra los resultados; al borrarla se
// recupera la descripción de la sección (incluidas las de carpetas personales).
let baseDescription=null;
function describeSearch(query,count){
  const node=$('feedDescription');
  if(query){
    if(baseDescription===null)baseDescription=node.textContent;
    node.textContent=`${format.format(count)} ${count===1?'resultado':'resultados'} para «${query}»`+(state.historyLoading?' · buscando en noticias anteriores…':'');
  }else if(baseDescription!==null){
    node.textContent=baseDescription;baseDescription=null;
  }
}
// Traducción de errores técnicos del recolector a frases comprensibles.
function friendlyFeedProblem(source){
  const raw=String(source?.error||'');
  if(source?.state==='stale')return 'El medio no publica en su RSS desde hace más de un año.';
  if(source?.state==='empty')return 'El RSS respondió, pero sin noticias.';
  if(/\b(401|403)\b|Forbidden/i.test(raw))return 'El medio no permite la lectura automática de su RSS.';
  if(/\b(404|410)\b|Not Found/i.test(raw))return 'La dirección del RSS ya no existe.';
  if(/\b429\b/.test(raw))return 'El medio limitó las consultas; se reintentará en la próxima revisión.';
  if(/\b5\d\d\b/.test(raw))return 'El sitio del medio tuvo un error temporal.';
  if(/demasiado grande/i.test(raw))return 'El RSS es demasiado pesado para procesarlo.';
  if(/no válido|interpretables|XML/i.test(raw))return 'El RSS tiene un formato que no se pudo leer.';
  if(/Timeout|timed out|Connection|SSL|Name or service|resolve/i.test(raw))return 'El sitio no respondió a tiempo.';
  if(/no público|no autorizado|redirecci/i.test(raw))return 'El RSS redirige a una dirección no permitida.';
  return 'No se pudo leer en la última revisión.';
}
function feedProblemLabel(source){
  return source.state==='stale'?'Sin novedades':source.state==='empty'?'Sin noticias':'No disponible';
}
// Avisos discretos y descartables. La preferencia solo es local a este navegador.
function openFeedHealth() {
  const modal=$('feedHealthDialog');
  const list=$('feedHealthIssues');
  const issues=state.health.filter(x=>x.state!=='ok');
  const ok=state.health.filter(x=>x.state==='ok').length;
  const errors=issues.filter(x=>x.state==='error').length;
  const empty=issues.filter(x=>x.state==='empty').length;
  const stale=issues.filter(x=>x.state==='stale').length;
  $('feedHealthOverview').textContent=state.health.length
    ? `${ok} de ${state.health.length} fuentes se leyeron bien en la última revisión.`+(issues.length?` ${issues.length} no ${issues.length===1?'estuvo disponible':'estuvieron disponibles'}; el resto de las noticias no se ve afectado.`:'')
    : 'Todavía no hay datos de la última revisión.';
  list.replaceChildren();
  if(!issues.length){
    list.append(mk('p','feed-health-empty',state.health.length?'No hay incidencias pendientes.':'El diagnóstico estará disponible después de recopilar los feeds.'));
  }else{
    for(const source of issues){
      const row=mk('article','feed-health-item');
      const head=mk('div','feed-health-item-head');
      head.append(mk('strong','',sourceLabel(source.name)),mk('span','feed-health-status',feedProblemLabel(source)));
      row.append(head,mk('p','feed-health-error',friendlyFeedProblem(source)));
      const extra=[];
      if(source.last_success_at)extra.push('Última lectura correcta: '+shortDate(source.last_success_at));
      if(source.error)extra.push('Detalle técnico: '+source.error);
      if(extra.length)row.append(mk('p','feed-health-tech',extra.join(' · ')));
      const original=safeURL(source.url||source.xmlUrl||source.xml_url||'');
      if(original){
        const a=link(original,'Consultar fuente RSS','feed-health-source-link');a.append(svgIcon('external'));
        row.append(a);
      }
      list.append(row);
    }
  }
  if(!modal.open)modal.showModal();
}
function showFeedNotice(message, signature, details) {
  const banner=$('statusBanner');
  $('statusMessage').textContent=message;
  $('statusDetails').hidden=!details;
  banner.dataset.signature=signature;
  banner.hidden=Boolean(signature && storeGet('radar-dismissed-health-notice-v1')===signature);
}
function statusSummary() {
  const banner=$('statusBanner');
  const indicator=$('feedHealthIndicator');
  const section=$('sidebarFeedHealth');
  banner.hidden=true;
  indicator.hidden=true;
  section.hidden=true;
  if (!state.ready) {
    showFeedNotice('No se pudieron cargar las noticias. Revisa tu conexión y vuelve a intentarlo en unos minutos.', 'load-error', false);
    return;
  }
  if (!state.generated && !state.items.length) {
    showFeedNotice('Todavía no hay noticias: la primera recopilación aún no termina.', 'awaiting-first-run', false);
    return;
  }
  // Las fuentes caídas no impiden leer el resto: se informa solo en el menú lateral
  // (y en Configuración), sin avisos sobre las noticias.
  const issues=state.health.filter(x=>x.state==='error'||x.state==='stale');
  if (!issues.length) return;
  $('feedHealthCount').textContent=String(issues.length);
  const label=issues.length===1?'fuente no disponible':'fuentes no disponibles';
  indicator.querySelector('.health-indicator-label').textContent=label;
  indicator.setAttribute('aria-label',`${issues.length} ${label}. Ver detalles`);
  indicator.title='Ver qué fuentes no se pudieron leer en la última revisión';
  indicator.hidden=false;
  section.hidden=false;
}
function applyFilters(mode=state.mode) {
  // (library.js reemplaza esta función; el filtro «solo nuevas» se aplica en features.js)
  const query=stripAccents(state.search.trim());
  const blocked=state.mutedKeywords.split(',').map(w=>stripAccents(w.trim())).filter(w=>w.length>1).slice(0,30);
  const filtered=state.items.filter(item=>{
    if(state.category!=='all'&&!(item.categories||[]).includes(state.category))return false;
    if(!(item.source_ids||[]).some(id=>!state.hiddenSources.has(id)))return false;
    if(state.feed&&!(item.source_ids||[]).includes(state.feed))return false;
    if(state.maxAge){const t=new Date(item.published_at).getTime();if(!Number.isFinite(t)||(Date.now()-t)>state.maxAge*86400000)return false;}
    if(mode==='saved'&&!state.saved.has(item.id))return false;
    if(mode==='unread'&&state.read.has(item.id))return false;
    if(state.hideRead&&mode!=='saved'&&state.read.has(item.id))return false;
    const haystack=stripAccents([item.title,item.summary,item.publisher,item.source].join(' '));
    if(query&&!haystack.includes(query))return false;
    if(blocked.some(x=>haystack.includes(x)))return false;
    return true;
  });
  if(state.sort==='oldest')filtered.sort((a,b)=>new Date(a.published_at||a.first_seen_at)-new Date(b.published_at||b.first_seen_at));
  else if(state.sort==='source')filtered.sort((a,b)=>String(a.publisher||a.source||'').localeCompare(String(b.publisher||b.source||''),'es'));
  return filtered;
}

// La portada utiliza las noticias realmente recopiladas. No inventa puntuaciones
// de popularidad ni presenta la recencia como una clasificación editorial.
function dashboardEligible(){
  const words=state.mutedKeywords.split(',').map(w=>stripAccents(w.trim())).filter(w=>w.length>1).slice(0,30);
  return state.items.filter(item=>{
    if(!(item.source_ids||[]).some(id=>!state.hiddenSources.has(id)))return false;
    if(window.RadarV12 && !window.RadarV12.dashboardMatch(item))return false;
    if(state.maxAge){
      const date=new Date(item.published_at).getTime();
      if(!Number.isFinite(date)||(Date.now()-date)>state.maxAge*86400000)return false;
    }
    const text=stripAccents([item.title,item.summary,item.publisher,item.source].join(' '));
    return !words.some(word=>text.includes(word));
  }).sort((a,b)=>new Date(b.published_at||b.first_seen_at||0)-new Date(a.published_at||a.first_seen_at||0));
}
// Pulso: noticias por hora en las últimas 24 horas (barras mínimas, sin librerías).
function activitySpark(items){
  const now=Date.now(),buckets=new Array(24).fill(0);
  for(const item of items){
    const age=(now-storyTime(item))/3600000;
    if(age>=0&&age<24)buckets[23-Math.floor(age)]++;
  }
  const total=buckets.reduce((a,b)=>a+b,0),max=Math.max(1,...buckets);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 72 20');svg.setAttribute('width','72');svg.setAttribute('height','20');
  svg.setAttribute('class','activity-spark');svg.setAttribute('role','img');
  svg.setAttribute('aria-label',`${total} noticias en las últimas 24 horas`);
  const title=document.createElementNS(ns,'title');title.textContent=`${total} noticias en las últimas 24 horas (una barra por hora)`;svg.append(title);
  buckets.forEach((count,i)=>{
    const h=count?Math.max(2,Math.round(count/max*18)):1;
    const bar=document.createElementNS(ns,'rect');
    bar.setAttribute('x',String(i*3));bar.setAttribute('y',String(20-h));bar.setAttribute('width','2');bar.setAttribute('height',String(h));bar.setAttribute('rx','1');
    if(!count)bar.setAttribute('class','is-empty');
    svg.append(bar);
  });
  return svg;
}
function headlineRow(item,className='dashboard-recent-row'){
  const row=mk('div',className+(state.read.has(item.id)?' read-article':''));
  row.dataset.articleId=item.id;
  const title=link(item.url,item.title||'Sin título','dashboard-recent-title');
  title.addEventListener('click',event=>openArticleReader(item,event));
  const info=mk('span','dashboard-recent-meta');
  const kind=kindBadge(item);if(kind)info.append(kind,document.createTextNode(' '));
  info.append(mk('span','',sourceLabel(item.publisher||item.source)),document.createTextNode(' · '),timeNode(item.published_at));
  const coverage=coverageOf(item);
  if(coverage>1)info.append(document.createTextNode(' · '),mk('span','row-coverage',`${coverage} medios`));
  row.append(title,info);
  return row;
}
function renderDashboard(){
  const feature=$('dashboardFeature');
  const recent=$('dashboardRecent');
  const folders=$('dashboardFolders');
  if(!feature||!recent||!folders)return;
  const items=dashboardEligible();
  const top=[],seen=new Set();
  for(const item of items){
    const primary=(item.categories||[])[0]||'';
    if(!seen.has(primary)){top.push(item);seen.add(primary);}
    if(top.length>=3)break;
  }
  for(const item of items){if(top.length>=3)break;if(!top.some(x=>x.id===item.id))top.push(item);}
  if(top.length)feature.replaceChildren(...top.map(card));
  else feature.replaceChildren(mk('p','dashboard-empty','No hay artículos disponibles con las preferencias actuales.'));
  const savedPanel=$('dashboardSavedPanel'), savedList=$('dashboardSavedList');
  const savedNews=items.filter(x=>state.saved.has(x.id)).slice(0,4);
  savedPanel.hidden=!savedNews.length;
  savedList.replaceChildren(...savedNews.map(story=>{
   const row=mk('div','dashboard-saved-item'),content=mk('div','dashboard-saved-content');
   const image=mk('a','dashboard-saved-cover');image.href=safeURL(story.url)||'#';
   image.target='_blank';image.rel='noopener noreferrer external';
   image.addEventListener('click',event=>openArticleReader(story,event));
   if(safeURL(story.image)){const img=mk('img');img.src=story.image;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';image.append(img);}
   else image.append(svgIcon('bookmark'));
   const title=link(story.url,story.title||'Sin título','dashboard-saved-title');title.target='_blank';title.addEventListener('click',event=>openArticleReader(story,event));
   content.append(title,mk('span','dashboard-saved-meta',sourceLabel(story.publisher||story.source)));row.append(image,content);return row;
  }));
  // Titulares compactos: más noticias por pantalla sin repetir las de portada.
  const used=new Set(top.map(x=>x.id));
  const last=items.filter(x=>!used.has(x.id)).slice(0,8);
  last.forEach(x=>used.add(x.id));
  if(!last.length)recent.replaceChildren(mk('p','dashboard-empty','Todavía no hay más publicaciones.'));
  else recent.replaceChildren(...last.map(item=>headlineRow(item)));
  const blocks=[];
  state.categories.forEach((cat,i)=>{
    const shown=state.sources.some(s=>s.category===cat&&!state.hiddenSources.has(s.id));
    if(!shown)return;
    const news=items.filter(item=>(item.categories||[]).includes(cat)&&!used.has(item.id)).slice(0,4);
    if(!news.length)return;
    news.forEach(x=>used.add(x.id));
    const block=mk('section','dashboard-folder');
    block.dataset.topic=String(i+1);
    const head=mk('button','dashboard-folder-head');head.type='button';
    const icon=mk('span','dashboard-folder-icon');icon.append(svgIcon(CATEGORY_ICONS[i]||'grid'));
    head.append(icon,mk('h3','',categoryLabel(cat)),activitySpark(items.filter(item=>(item.categories||[]).includes(cat))),mk('span','dashboard-folder-more','Ver todo'),svgIcon('arrow-right'));
    head.setAttribute('aria-label','Ver todas las noticias de '+categoryLabel(cat));
    head.addEventListener('click',()=>goTo(cat));
    const list=mk('div','dashboard-folder-list');
    list.append(...news.map(item=>headlineRow(item,'dashboard-folder-row')));
    block.append(head,list);blocks.push(block);
  });
  folders.replaceChildren(...blocks);
  folders.closest('.dashboard-panel').hidden=!blocks.length;
}

function emptyState(filtered) {
  const isEmpty = !state.items.length;
  if (!isEmpty && state.search.trim() && state.historyLoading) {
    const el = mk('div','empty-state');
    const symbol=mk('div','empty-icon');symbol.append(svgIcon('search'));
    el.append(symbol, mk('h3','','Buscando en noticias anteriores…'), mk('p','','Revisamos el archivo completo de los últimos 45 días.'));
    return el;
  }
  if (!isEmpty && state.search.trim()) {
    const el = mk('div','empty-state');
    const symbol=mk('div','empty-icon');symbol.append(svgIcon('search'));
    const clear=mk('button','settings-secondary','Borrar búsqueda');clear.type='button';
    clear.addEventListener('click',()=>{$('searchInput').value='';state.search='';state.page=1;render();$('searchInput').focus();});
    el.append(symbol, mk('h3','',`Sin resultados para «${state.search.trim()}»`),
      mk('p','',state.category==='all'?'Prueba con otras palabras o revisa la ortografía.':'Prueba en «Todas las noticias» o con otras palabras.'), clear);
    return el;
  }
  const el = mk('div','empty-state');
  const symbol=mk('div','empty-icon');symbol.append(svgIcon(isEmpty?'rss':'search'));
  el.append(symbol,
    mk('h3','',isEmpty ? 'Esperando las primeras noticias' : 'No hay noticias con estos filtros'),
    mk('p','',isEmpty ? 'Aún no se han cargado noticias. Revisa el estado de las fuentes RSS o vuelve a intentarlo después de la próxima actualización.' : 'Prueba otra categoría o fuente, desmarca tus filtros o busca con otros términos.'));
  return el;
}
let actionToastTimer,actionToastVersion=0;
function actionToast(message,{undo}={}){
  const toast=$('actionToast');
  toast.textContent=message;
  toast.hidden=false;
  const version=++actionToastVersion;
  let undoAvailable=typeof undo==='function';
  if(undoAvailable){
    const button=mk('button','toast-undo','Deshacer');button.type='button';
    button.addEventListener('click',()=>{
      if(!undoAvailable||version!==actionToastVersion)return;
      undoAvailable=false;
      window.clearTimeout(actionToastTimer);
      undo(button);
    });
    toast.append(button);
  }
  window.clearTimeout(actionToastTimer);
  actionToastTimer=window.setTimeout(()=>{undoAvailable=false;toast.hidden=true;},undoAvailable?8000:3200);
}
async function shareArticle(item) {
  const url=safeURL(item.url);
  if(!url){actionToast('Esta noticia no tiene un enlace válido.');return;}
  if(typeof navigator.share==='function'){
    try{
      await navigator.share({title:item.title||'Noticia',url});
      return;
    }catch(error){
      if(error?.name==='AbortError')return; // El usuario canceló el panel nativo.
    }
  }
  try{
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    else {
      const input=document.createElement('textarea');
      input.value=url;input.readOnly=true;input.style.position='fixed';input.style.opacity='0';
      document.body.append(input);input.select();
      const copied=document.execCommand('copy');input.remove();
      if(!copied)throw new Error('No se pudo copiar automáticamente');
    }
    actionToast('Enlace de la noticia copiado. Ya puedes compartirlo.');
  }catch {
    // Fallback visible para navegadores que bloquean el portapapeles.
    window.prompt('Copia el enlace de la noticia:',url);
  }
}
function articleAction(iconName,label,extraClass=''){
 const button=mk('button','article-action'+(extraClass?' '+extraClass:''));button.type='button';
 button.title=label;button.setAttribute('aria-label',label);
 const symbol=mk('span','article-action-icon');symbol.setAttribute('aria-hidden','true');symbol.append(svgIcon(iconName));
 button.append(symbol,mk('span','article-action-label',label));return button;
}

let activeReaderItem=null;
function syncReaderActions(){
  if(!activeReaderItem)return;
  const saved=state.saved.has(activeReaderItem.id);
  $('readerSaveLabel').textContent=saved?'Quitar guardado':'Guardar';
  $('readerSave').classList.toggle('is-saved',saved);
  $('readerSave').setAttribute('aria-pressed',String(saved));
}
// «Cómo lo cuenta cada medio»: titulares de la misma historia agrupados por región.
function compareSection(item){
  const others=Array.isArray(item.also_in)?item.also_in.filter(x=>safeURL(x.url)):[];
  if(!others.length)return null;
  const entries=[{publisher:item.publisher||item.source,source:item.source,title:item.title,url:item.url,
    category:(item.categories||[])[0],published_at:item.published_at,lead:true},...others];
  const section=mk('section','reader-compare');section.id='readerCompare';
  section.setAttribute('aria-labelledby','readerCompareTitle');
  const head=mk('div','reader-compare-head');
  const h=mk('h3','','Cómo lo cuenta cada medio');h.id='readerCompareTitle';
  head.append(svgIcon('layers'),h,mk('span','reader-compare-count',`${coverageOf(item)} medios`));
  section.append(head);
  const withTitles=entries.filter(x=>String(x.title||'').trim()).length;
  if(withTitles<2)section.append(mk('p','reader-compare-note','Esta historia se agrupó antes de que Radar guardara los titulares de cada medio; se muestran solo los enlaces.'));
  const groups=new Map();
  for(const entry of entries.slice(0,13)){
    const kind=sourceKind(entry.source,entry.publisher);
    const key=kind?.label==='Oficial'?'Fuentes oficiales':categoryLabel(entry.category||'')||'Otros medios';
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(entry);
  }
  for(const [label,list] of groups){
    const group=mk('div','reader-compare-group');
    group.append(mk('h4','',label));
    const ul=mk('ul','');
    for(const entry of list){
      const li=mk('li','');
      const a=link(entry.url,String(entry.title||'').trim()||sourceLabel(entry.publisher,'Ver en el medio'),'reader-compare-link');
      const meta=mk('span','reader-compare-meta');
      meta.append(mk('strong','',sourceLabel(entry.publisher,'Otro medio')));
      if(entry.published_at)meta.append(document.createTextNode(' · '),timeNode(entry.published_at));
      if(entry.lead)meta.append(mk('span','reader-compare-lead','esta vista previa'));
      li.append(a,meta);ul.append(li);
    }
    group.append(ul);section.append(group);
  }
  section.append(mk('p','reader-compare-note','Titulares tal como los publicó cada medio. Radar no valora ni reescribe su contenido.'));
  return section;
}
function openArticleReader(item,event,focusTarget){
  if(event){
    // Ctrl/Cmd/middle-click still opens the original source using native browser behavior.
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
  }
  const dialog=$('articleReaderDialog');
  activeReaderItem=item;
  $('readerTitle').textContent=item.title||'Noticia sin título';
  $('readerCategory').textContent=categoryLabel((item.categories||[])[0]||'');
  const meta=$('readerMeta');meta.replaceChildren(
    mk('strong','',sourceLabel(item.publisher||item.source)),
    mk('span','',ageDate(item.published_at))
  );
  const cover=$('readerCover');cover.replaceChildren();cover.hidden=!state.showImages||state.lite||!safeURL(item.image);
  if(!cover.hidden){
    const image=mk('img');image.src=item.image;image.alt='Imagen ilustrativa de la noticia';
    image.referrerPolicy='no-referrer';
    image.addEventListener('error',()=>{cover.hidden=true;},{once:true});
    cover.append(image);
  }
  const summary=$('readerSummary');summary.replaceChildren();
  const description=String(item.summary||'').trim();
  summary.append(mk('p','',description||'Esta fuente solo publica un titular o un extracto breve. Abre el medio original para leer la noticia completa.'));
  const comparison=compareSection(item);
  if(comparison)summary.append(comparison);
  const url=safeURL(item.url);
  const source=$('readerOpenOriginal');source.href=url||'#';
  source.setAttribute('aria-disabled',String(!url));
  source.tabIndex=url?0:-1;
  source.target=state.newTab?'_blank':'_self';
  $('readerOpenOriginal').querySelector('.reader-open-hint').textContent=state.newTab?'en otra pestaña':'en esta pestaña';
  syncReaderActions();
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('.reader-scroll')?.scrollTo?.({top:0});
  if(focusTarget==='compare'){
    requestAnimationFrame(()=>{const target=$('readerCompare');if(target){target.scrollIntoView({block:'start'});target.querySelector('h3')?.setAttribute('tabindex','-1');target.querySelector('h3')?.focus({preventScroll:true});}});
  }
  markRead(item.id,true);
}
function initArticleReader(){
  const dialog=$('articleReaderDialog');
  $('readerClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{activeReaderItem=null;});
  $('readerSave').addEventListener('click',()=>{
    if(!activeReaderItem)return;
    const id=activeReaderItem.id;
    if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);
    persist('radar-saved',state.saved);
    syncReaderActions();
    render();
    actionToast(state.saved.has(id)?'Noticia guardada':'Noticia retirada de guardadas');
  });
  $('readerShare').addEventListener('click',()=>{if(activeReaderItem)void shareArticle(activeReaderItem);});
  $('readerOpenOriginal').addEventListener('click',event=>{
    if(!activeReaderItem||!safeURL(activeReaderItem.url)){event.preventDefault();return;}
    markRead(activeReaderItem.id,true);
  });
}
// Los medios que no envían fotografías reciben una cubierta editorial
// claramente tipográfica: nunca se presenta una ilustración como foto real.
function editorialCover(item) {
  const tile=mk('div','article-cover-placeholder');
  tile.setAttribute('aria-hidden','true');
  const wrap=mk('div','article-cover-placeholder-inner');
  const source=sourceLabel(item.publisher||item.source,'Medio de noticias');
  const sourceName=mk('span','article-cover-publisher',source);
  const note=mk('span','article-cover-note','Sin fotografía disponible');
  wrap.append(svgIcon('newspaper'),sourceName,note);
  tile.append(wrap);
  return tile;
}
// Tarjeta: el título y la imagen abren la vista previa; Guardar queda a mano y
// el resto de acciones vive en un menú "⋯" para no repetir cuatro botones por tarjeta.
function card(item) {
  const isRead=state.read.has(item.id);
  const hasImage=Boolean(safeURL(item.image))&&!state.lite&&state.showImages;
  const el=mk('article','article-card '+(isRead?'read-article':'unread-card')+(hasImage?'':' no-cover'));el.dataset.articleId=item.id;
  const allowPreview=!state.lite&&state.showImages;
  if(hasImage){
    const cover=mk('a','cover'); cover.href=safeURL(item.url)||'#';cover.target=state.newTab?'_blank':'_self';cover.rel='noopener noreferrer external';cover.referrerPolicy='no-referrer';
    cover.tabIndex=-1;cover.setAttribute('aria-hidden','true');
    cover.addEventListener('click',event=>openArticleReader(item,event));
    const img=document.createElement('img');img.src=item.image;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>{
      cover.remove();
      el.classList.add('no-cover');
      if(allowPreview && !el.querySelector('.article-cover-placeholder'))
        el.prepend(editorialCover(item));
    },{once:true});
    cover.append(img);el.append(cover);
  } else if(allowPreview) {
    el.append(editorialCover(item));
  }
  const category=(item.categories||[])[0]||'';
  const topic=state.categories.indexOf(category);
  if(topic>=0)el.dataset.topic=String(topic+1);
  const content=mk('div','article-content');
  const title=mk('h3','article-title');
  const titleLink=link(item.url,item.title||'Sin título');
  titleLink.addEventListener('click',event=>openArticleReader(item,event));
  title.append(titleLink);
  const kicker=mk('div','article-kicker');
  kicker.append(mk('span','article-category',categoryLabel(category)));
  if(isNewSinceVisit(item)){const fresh=mk('span','article-new','Nueva');fresh.title='Publicada desde tu última visita';kicker.append(fresh);}
  content.append(kicker,title);
  const summary=String(item.summary||'').trim();
  if(summary&&state.showSummaries){
    content.append(mk('p','article-excerpt',summary));
  }else if(!summary){
    el.classList.add('no-excerpt');
  }
  const coverage=coverageOf(item);
  if(coverage>1){
    const others=Array.isArray(item.also_in)?item.also_in:[];
    const also=mk('button','article-also'+(coverage>=5?' is-wide':''));also.type='button';
    also.append(svgIcon('layers'),mk('span','',`${coverage} medios`));
    also.title='Cubierta por '+coverage+' medios'+(others.length?': '+others.slice(0,8).map(x=>sourceLabel(x.publisher,'Otro medio')).join(' · '):'')+'. Ver cómo lo cuenta cada uno.';
    also.setAttribute('aria-label',`Cubierta por ${coverage} medios. Comparar titulares`);
    also.addEventListener('click',()=>openArticleReader(item,null,'compare'));
    content.append(also);
  }
  const footer=mk('div','article-footer');
  const meta=mk('div','article-meta');
  const kind=kindBadge(item);
  if(kind)meta.append(kind);
  meta.append(mk('span','publisher',sourceLabel(item.publisher||item.source)),timeNode(item.published_at));
  const actions=mk('div','article-actions');
  actions.setAttribute('role','group');actions.setAttribute('aria-label','Acciones de esta noticia');
  const saved=state.saved.has(item.id);
  const save=mk('button','article-action article-save'+(saved?' saved':''));save.type='button';
  const saveLabel=saved?'Quitar de guardadas':'Guardar para después';
  save.title=saveLabel;save.setAttribute('aria-label',saveLabel+': '+(item.title||'noticia'));save.setAttribute('aria-pressed',String(saved));
  save.append(svgIcon(saved?'bookmark-filled':'bookmark'));
  save.addEventListener('click',()=>{
    if(state.saved.has(item.id))state.saved.delete(item.id);else state.saved.add(item.id);
    persist('radar-saved',state.saved);
    render();
    actionToast(state.saved.has(item.id)?'Noticia guardada.':'Noticia quitada de guardadas.');
  });
  const more=mk('button','article-action article-more');more.type='button';
  more.title='Más acciones';more.setAttribute('aria-label','Más acciones: '+(item.title||'noticia'));
  more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','cardMenu');
  more.append(svgIcon('more'));
  more.addEventListener('click',()=>toggleCardMenu(item,more));
  // La acción de lectura es visible sin abrir el menú de tres puntos.
  const read=mk('button','article-action article-read-toggle');
  read.type='button';
  const readLabel=isRead?'Marcar como no leída':'Marcar como leída';
  read.title=readLabel;
  read.setAttribute('aria-label',readLabel+': '+(item.title||'noticia'));
  read.setAttribute('aria-pressed',String(isRead));
  read.append(svgIcon(isRead?'undo':'check'));
  read.addEventListener('click',()=>{
    const next=!state.read.has(item.id);
    markRead(item.id,next);
    actionToast(next?'Marcada como leída.':'Marcada como no leída.');
  });
  more.setAttribute('aria-keyshortcuts','Shift+F10');
  el.addEventListener('contextmenu',event=>{
    event.preventDefault();
    closeCardMenu();
    toggleCardMenu(item,more,{x:event.clientX,y:event.clientY});
  });
  el.addEventListener('keydown',event=>{
    if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){
      event.preventDefault();
      closeCardMenu();
      toggleCardMenu(item,more);
    }
  });
  actions.append(read,save,more);
  footer.append(meta,actions);
  content.append(footer);
  el.append(content);return el;
}
let cardMenuItem=null,cardMenuAnchor=null;
function closeCardMenu(restoreFocus=false){
  const menu=$('cardMenu');
  if(!menu||menu.hidden)return;
  menu.hidden=true;
  cardMenuAnchor?.setAttribute('aria-expanded','false');
  if(restoreFocus&&cardMenuAnchor?.isConnected)cardMenuAnchor.focus();
  cardMenuItem=null;cardMenuAnchor=null;
}
function toggleCardMenu(item,anchor,point=null){
  const menu=$('cardMenu');
  if(!menu.hidden&&cardMenuAnchor===anchor){closeCardMenu(true);return;}
  closeCardMenu();
  cardMenuItem=item;cardMenuAnchor=anchor;
  const isRead=state.read.has(item.id);
  $('cardMenuReadLabel').textContent=isRead?'Marcar como no leída':'Marcar como leída';
  menu.querySelector('[data-card-action="read"] .ui-icon-slot').replaceChildren(svgIcon(isRead?'undo':'check'));
  const open=$('cardMenuOpen'),url=safeURL(item.url);
  open.hidden=!url;open.href=url||'#';
  menu.hidden=false;anchor.setAttribute('aria-expanded','true');
  const r=anchor.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;
  const atCursor=point&&point.x>0&&point.y>0;
  const left=atCursor?point.x: r.right-w;
  const top=atCursor?point.y+4:r.bottom+6;
  menu.style.left=Math.max(8,Math.min(left,window.innerWidth-w-8))+'px';
  menu.style.top=Math.max(8,Math.min(top,window.innerHeight-h-8))+'px';
  // El foco del menú fijo no debe desplazar la página y cerrarlo inmediatamente.
  menu.querySelector('[role="menuitem"]:not([hidden])')?.focus({preventScroll:true});
}
function initCardMenu(){
  const menu=$('cardMenu');
  const entries=()=>[...menu.querySelectorAll('[role="menuitem"]:not([hidden])')];
  menu.addEventListener('click',event=>{
    const target=event.target.closest('[data-card-action]');
    if(!target||!cardMenuItem)return;
    const item=cardMenuItem,action=target.dataset.cardAction;
    if(action==='share'){closeCardMenu(true);void shareArticle(item);}
    else if(action==='read'){const next=!state.read.has(item.id);closeCardMenu(true);markRead(item.id,next);actionToast(next?'Marcada como leída.':'Marcada como no leída.');}
    else if(action==='open'){markRead(item.id,true);closeCardMenu();}
  });
  menu.addEventListener('keydown',event=>{
    const list=entries(),index=list.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowDown'?1:-1)+list.length)%list.length;
      list[next]?.focus();
    }else if(event.key==='Escape'){event.preventDefault();closeCardMenu(true);}
    else if(event.key==='Tab')closeCardMenu();
  });
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#cardMenu,.article-more'))closeCardMenu();});
  window.addEventListener('resize',()=>closeCardMenu(),{passive:true});
  // Cerrar solo cuando la persona inicia el desplazamiento. Un evento scroll
  // causado por foco/Playwright puede ocurrir entre abrir el menú y pulsar una acción.
  window.addEventListener('wheel',()=>closeCardMenu(),{passive:true});
  document.addEventListener('touchmove',()=>closeCardMenu(),{passive:true});
}
// Una revisión por ID impide que Deshacer borre una marca manual posterior.
const readRevisions=new Map();
function markRead(id,value){
  const original=state.read.has(id);
  if(value)state.read.add(id);else state.read.delete(id);
  if(original===value)return;
  readRevisions.set(id,(readRevisions.get(id)||0)+1);
  const active=document.activeElement;
  const returnFocus=active?.classList?.contains('article-read-toggle')===true;
  persist('radar-read',state.read);
  // Renderiza tarjetas, pestañas, filtros y contadores desde un único estado.
  // La biblioteca restaura los indicadores de las seis carpetas en su wrapper.
  render();
  if(returnFocus){
    const target=[...document.querySelectorAll('#articleGrid .article-card, #dashboardFeature .article-card')]
      .find(el=>el.dataset.articleId===id)?.querySelector('.article-read-toggle');
    (target||$('articleGrid').querySelector('.article-read-toggle')||document.querySelector('.mode-tab.active'))?.focus({preventScroll:true});
  }
}
function markArticlesRead(items){
  const focusOrigin=document.activeElement;
  const readSet=state.read;
  const changed=[];
  for(const item of items){
    const id=item?.id;
    if(typeof id!=='string'||!id||state.read.has(id))continue;
    state.read.add(id);
    const revision=(readRevisions.get(id)||0)+1;
    readRevisions.set(id,revision);changed.push({id,revision});
  }
  if(!changed.length){actionToast('No había noticias pendientes.');return 0;}
  persist('radar-read',state.read);render();
  actionToast(changed.length===1?'1 noticia marcada como leída.':format.format(changed.length)+' noticias marcadas como leídas.',{
    undo:undoButton=>{
      const restoreFocus=document.activeElement===undoButton;
      let reverted=0;
      for(const {id,revision} of changed){
        if(state.read!==readSet||readRevisions.get(id)!==revision||!state.read.has(id))continue;
        state.read.delete(id);readRevisions.set(id,revision+1);reverted++;
      }
      if(reverted){persist('radar-read',state.read);render();}
      actionToast(reverted?'Se deshizo la marca de lectura.':'No quedan marcas de este lote por deshacer.');
      // El mensaje retira Deshacer del DOM. Devolver su foco al control estable
      // del lote sin interferir con otro diálogo o una acción de foco posterior.
      if(restoreFocus&&focusOrigin?.isConnected&&!focusOrigin.disabled&&
        !focusOrigin.matches?.(':disabled')&&!focusOrigin.closest('[hidden],[inert]')&&
        !document.querySelector('dialog[open]')&&
        (document.activeElement===undoButton||document.activeElement===document.body)){
        focusOrigin.focus({preventScroll:true});
      }
    }
  });
  return changed.length;
}
function render() {
  const filtered=applyFilters(), visible=filtered.slice(0,state.page*state.pageSize);
  updateSourceCounts();
  $('visibleCount').textContent=`${format.format(filtered.length)} ${hasHistory()?'RECIENTES':'ARTÍCULOS'}`;
  $('markAllVisible').disabled=!visible.some(item=>!state.read.has(item.id));
  $('filterSummary').textContent=`${format.format(visible.length)} visibles · ${format.format(applyFilters('unread').length)} sin leer con estos filtros`; 
  const modeCounts={
    all:state.mode==='all'?filtered.length:applyFilters('all').length,
    unread:state.mode==='unread'?filtered.length:applyFilters('unread').length,
    saved:state.mode==='saved'?filtered.length:applyFilters('saved').length
  };
  for(const [mode,id,label] of [
    ['all','allCount','Todas'],
    ['unread','unreadCount','Sin leer'],
    ['saved','savedCount','Guardadas']
  ]){
    const count=modeCounts[mode];
    $(id).textContent=format.format(count);
    const button=document.querySelector(`.mode-tab[data-mode="${mode}"]`);
    const basis=mode==='saved'?'guardadas disponibles':(hasHistory()?'noticias recientes cargadas':'noticias disponibles');
    button.title=`${label}: ${format.format(count)} ${basis}. Los contadores respetan los filtros activos.`;
    button.setAttribute('aria-label',button.title);
  }
  const query=state.search.trim();
  describeSearch(query,filtered.length);
  // Una búsqueda debe cubrir todo el archivo, no solo las 300 noticias recientes.
  if(query.length>=3&&hasHistory()&&!state.historyLoading&&!state.historyFailed)void loadHistory();
  const grid=$('articleGrid'); grid.className='article-grid'+(state.layout === 'list'?' list-view':'');
  // La portada y el resumen tienen sus propios componentes: no construir
  // tarjetas ocultas en cada pulsación o actualización de esos paneles.
  if(state.pageView==='feed'){
    if (!visible.length) grid.replaceChildren(emptyState(filtered));
    else grid.replaceChildren(...visible.map(card));
    $('loadMore').hidden=visible.length>=filtered.length;
    updateHistoryButton();
  }else if(grid.childElementCount){
    grid.replaceChildren();
    $('loadMore').hidden=true;
  }
  document.querySelectorAll('.mode-tab').forEach(button=>button.classList.toggle('active',button.dataset.mode === state.mode));
  document.querySelectorAll('.view-button').forEach(button=>button.classList.toggle('active',button.dataset.view === state.layout));
  document.body.classList.toggle('layout-list',state.layout==='list');
  syncColumnsControl();
  if(state.pageView==='dashboard')renderDashboard();
  if(state.pageView==='briefing'&&typeof renderBriefing==='function')renderBriefing();
}

let historyRequest=null;
function historyFiles(){return (Array.isArray(state.feedMeta?.archive_files)?state.feedMeta.archive_files:[]).filter(x=>/^archive-\d{2}\.json$/.test(x)).slice(0,32);}
function hasHistory(){return !state.historyLoaded&&historyFiles().length>0;}
function updateHistoryButton(){
  if(state.historyLoading){$('loadMore').hidden=false;$('loadMore').disabled=true;$('loadMore').textContent='Cargando historial…';}
  else if(hasHistory()&&state.pageView==='feed'){
    $('loadMore').hidden=false;$('loadMore').disabled=false;
    $('loadMore').replaceChildren(mk('span','','Cargar noticias anteriores'),svgIcon('arrow-down'));
  }else{
    $('loadMore').disabled=false;
    $('loadMore').replaceChildren(mk('span','','Cargar más noticias'),svgIcon('arrow-down'));
  }
}
async function loadHistory(){
  if(!hasHistory()||historyRequest)return historyRequest;
  const manifest=state.feedMeta;
  state.historyLoading=true;updateHistoryButton();
  historyRequest=(async()=>{
    try{
      // Limitar las descargas simultáneas: 16 fragmentos pueden agotar memoria
      // y conexiones en móviles; mantener el orden y validar todo antes de aplicar.
      const files=historyFiles(),docs=new Array(files.length);
      let next=0;
      async function worker(){
        while(next<files.length){
          const i=next++;
          docs[i]=await dataFetch('./data/'+files[i]);
        }
      }
      await Promise.all(Array.from({length:Math.min(3,files.length)},()=>worker()));
      if(manifest!==state.feedMeta)return;
      const items=new Map(state.items.map(x=>[x.id,x]));
      for(const doc of docs){
        if(doc.generated_at!==manifest.generated_at||!Array.isArray(doc.items))throw Error('Archivo de historial incompatible');
        for(const article of doc.items)if(article&&typeof article.id==='string'&&!items.has(article.id))items.set(article.id,article);
      }
      state.items=[...items.values()].sort((a,b)=>String(b.published_at||b.first_seen_at||'').localeCompare(String(a.published_at||a.first_seen_at||'')));
      state.historyLoaded=true;
    }catch(error){
      if(manifest===state.feedMeta){console.warn('Historial RSS:',error);state.historyFailed=true;actionToast('No fue posible cargar noticias anteriores.');}
    }
    finally{if(manifest===state.feedMeta){state.historyLoading=false;historyRequest=null;render();}}
  })();
  return historyRequest;
}

const NEWS_SNAPSHOT_KEY='radar-last-visible-news-v1';
function publishNewRSSNews(previousIds=null){
  // IDs publicados, no acciones de lectura o cambios de filtros.
  const current=state.items.slice(0,300).filter(item=>item&&typeof item.id==='string'&&item.id);
  let known=previousIds;
  if(known===null){
    try{
      const stored=JSON.parse(localStorage.getItem(NEWS_SNAPSHOT_KEY)||'null');
      known=Array.isArray(stored)?new Set(stored.filter(id=>typeof id==='string')):null;
    }catch{known=null;}
  }
  try{localStorage.setItem(NEWS_SNAPSHOT_KEY,JSON.stringify(current.map(item=>item.id)));}
  catch(error){console.warn('Radar RSS: instantánea local no disponible.',error);}
  if(!known||!known.size||!current.length)return;
  const added=current.filter(item=>!known.has(item.id));
  if(!added.length)return;
  // Emitir después del render, cuando las carpetas y tarjetas ya están montadas.
  window.requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent(
    'radar:news-added',{detail:{items:added}}
  )));
}

// Comprobación LOCAL de publicaciones nuevas: cada 15 min.
// La recopilación de RSS de origen sigue cada tres horas por GitHub Actions.
const CHECK_INTERVAL_MS=15*60*1000;
let nextCheckAt=Date.now()+CHECK_INTERVAL_MS;
let checkStartedAt=Date.now();
let checkTimer=null;
let feedRefreshBusy=false;
let pendingPublication=null;
function freshnessLabel(){
  if(!state.generated)return state.ready?'Sin sincronizar':'Cargando…';
  const age=ageDate(state.generated);
  return age==='Ahora'?'Actualizado ahora':'Actualizado '+age.charAt(0).toLowerCase()+age.slice(1);
}
function updateScheduleProgress(){
  $('lastUpdate').textContent=feedRefreshBusy?'Buscando novedades…':freshnessLabel();
  const exact=state.generated?' Última recopilación: '+shortDate(state.generated)+'.':'';
  const description='Radar RSS busca noticias nuevas cada 15 minutos; los medios se recopilan aproximadamente cada 3 horas.'+exact;
  $('refreshCycle').title=description;
  $('lastUpdate').title=description;
  $('refreshNow').disabled=feedRefreshBusy;
}
function scheduleNextCheck(){
  window.clearTimeout(checkTimer);
  checkStartedAt=Date.now();
  nextCheckAt=checkStartedAt+CHECK_INTERVAL_MS;
  checkTimer=window.setTimeout(()=>{void refreshPublishedData();},CHECK_INTERVAL_MS);
  updateScheduleProgress();
}
// Comprueba si GitHub Pages publicó datos nuevos, sin descargar directamente las fuentes.
async function refreshPublishedData(){
  if(feedRefreshBusy)return;
  if(!state.ready||document.hidden){scheduleNextCheck();return;}
  feedRefreshBusy=true;updateScheduleProgress();
  try{
    const meta=await dataFetch('./data/meta.json?check='+Date.now());
    if(!meta?.generated_at||meta.generated_at===state.generated||meta.generated_at===pendingPublication?.meta.generated_at)return;
    const generatedTime=typeof meta.generated_at==='string'?Date.parse(meta.generated_at):NaN;
    if(!Number.isFinite(generatedTime))throw Error('Fecha de publicación RSS incompatible');
    if(generatedTime<=Date.parse(state.generated)||generatedTime<=Date.parse(pendingPublication?.meta.generated_at))return;
    const [sources,latest,status]=await Promise.all([
      dataFetch('./data/sources.json?check='+Date.now()),
      dataFetch('./data/latest.json?check='+Date.now()),
      dataFetch('./data/status.json?check='+Date.now())
    ]);
    // latest y status llevan la misma generación del manifiesto. sources no
    // publica sello temporal; se valida su estructura antes de aceptar el lote.
    if(latest?.generated_at!==meta.generated_at||status?.checked_at!==meta.generated_at||
      !Array.isArray(latest.items)||!latest.items.every(item=>item&&typeof item.id==='string'&&item.id&&
        [item.source_ids,item.categories].every(values=>values===undefined||Array.isArray(values)&&values.every(value=>typeof value==='string')))||
      !Array.isArray(sources?.sources)||!sources.sources.every(source=>source&&typeof source.id==='string'&&
        typeof source.name==='string'&&typeof source.category==='string')||
      !Array.isArray(sources.categories)||!sources.categories.every(category=>typeof category==='string')||
      !Array.isArray(status.feeds)||!status.feeds.every(feed=>feed&&typeof feed.id==='string')||
      !Array.isArray(meta.archive_files)||!meta.archive_files.every(file=>/^archive-\d{2}\.json$/.test(file))){
      throw Error('Publicación RSS incompatible');
    }
    pendingPublication={meta,sources,latest,status};
    const previousIds=new Set(state.items.map(item=>item.id));
    const added=new Set(latest.items.filter(item=>!previousIds.has(item.id)).map(item=>item.id)).size;
    $('publicationMessage').textContent=added?`Hay ${format.format(added)} ${added===1?'noticia nueva':'noticias nuevas'}`:'Hay una actualización disponible';
    $('publicationNotice').hidden=false;
  }catch(error){console.warn('Comprobación automática RSS:',error);}
  finally{feedRefreshBusy=false;scheduleNextCheck();}
}
function applyPendingPublication(){
  if(!pendingPublication)return;
  const {meta,sources,latest,status}=pendingPublication;
  const previousIds=new Set(state.items.map(item=>item.id));
  // Cambiar todo antes de renderizar; cualquier descarga antigua de historial
  // queda invalidada por la identidad de feedMeta sin cerrar el lector abierto.
  state.sources=sources.sources;state.categories=sources.categories;
  state.items=latest.items;state.health=status.feeds;
  state.feedMeta=meta;state.generated=meta.generated_at;
  state.historyLoaded=false;state.historyLoading=false;state.historyFailed=false;
  historyRequest=null;pendingPublication=null;
  $('publicationNotice').hidden=true;
  updateScheduleProgress();
  buildNav();fillSelect();updateHeader();statusSummary();render();
  publishNewRSSNews(previousIds);
}

async function dataFetch(path, fallback) {
  const response = await fetch(path,{cache:'no-cache'});
  if (!response.ok) throw new Error(`HTTP ${response.status} al abrir ${path}`);
  return response.json();
}
async function boot() {
  setTheme(state.theme);
  applyDisplaySettings();
  state.mode=state.startMode;
  try {
    const [sources, articles, status] = await Promise.all([
      dataFetch('./data/sources.json'), dataFetch('./data/latest.json'), dataFetch('./data/status.json')
    ]);
    state.sources=Array.isArray(sources.sources)?sources.sources:[];
    state.categories=Array.isArray(sources.categories)?sources.categories:[];
    state.items=Array.isArray(articles.items)?articles.items:[];
    state.health=Array.isArray(status.feeds)?status.feeds:[];
    state.generated=articles.generated_at;
    try{state.feedMeta=await dataFetch('./data/meta.json');}catch{state.feedMeta=null;state.historyLoaded=true;}
    state.ready=true;
    updateScheduleProgress();

  } catch(err) {
    state.ready=false;
    console.error('Carga de fuentes:',err);
  }
  statusSummary(); navigateFromHash();
  if(state.ready)publishNewRSSNews();
}
let progressiveLoads=0;
function initSocialNavigation(){
 $('dashboardSavedAll').addEventListener('click',()=>{state.mode='saved';goTo('all');});
 const back=$('backTop');back.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
 window.addEventListener('scroll',()=>{back.hidden=window.scrollY<600;},{passive:true});
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   if(!entries.some(entry=>entry.isIntersecting)||state.pageView!=='feed'||window.scrollY<350||progressiveLoads>=3||$('loadMore').hidden)return;
   progressiveLoads++;state.page+=1;render();
  },{rootMargin:'250px 0px'});
  observer.observe($('loadMore'));
 }
}
function initHandlers() {
 initSocialNavigation();
 initArticleReader();
 initMobileNav();
 initCardMenu();
  window.setInterval(updateScheduleProgress,30_000);
  scheduleNextCheck();
  $('refreshNow').addEventListener('click',()=>{void refreshPublishedData();});
  $('publicationApply').addEventListener('click',applyPendingPublication);
  window.addEventListener('focus',()=>{if(document.visibilityState==='visible'&&Date.now()>=nextCheckAt){void refreshPublishedData();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(Date.now()>=nextCheckAt){void refreshPublishedData();}else{updateScheduleProgress();}}});
  // Resolver la función en cada cambio: library.js y features.js la amplían después de cargar app.js.
  window.addEventListener('hashchange',()=>navigateFromHash());
  $('feedHealthIndicator').addEventListener('click',openFeedHealth);
  $('statusDetails').addEventListener('click',openFeedHealth);
  $('statusDismiss').addEventListener('click',()=>{
    const banner=$('statusBanner');
    try{localStorage.setItem('radar-dismissed-health-notice-v1',banner.dataset.signature||'');}catch{}
    banner.hidden=true;
  });
  const feedHealthDialog=$('feedHealthDialog');
  $('closeFeedHealth').addEventListener('click',()=>feedHealthDialog.close());
  $('doneFeedHealth').addEventListener('click',()=>feedHealthDialog.close());
  feedHealthDialog.addEventListener('click',e=>{if(e.target===feedHealthDialog)feedHealthDialog.close();});
  document.querySelectorAll('.mode-tab').forEach(button=>button.addEventListener('click',()=>{state.mode=button.dataset.mode;state.page=1;progressiveLoads=0;render();}));
  initColumnsMenu();
  document.querySelector('.view-button[data-view="list"]').addEventListener('click',()=>{
    closeColumnsMenu();
    state.layout='list';state.page=1;progressiveLoads=0;
    savePref('layout',state.layout);applyDisplaySettings();render();
  });
  $('sourceSelect').addEventListener('change',e=>{state.feed=e.target.value;state.page=1;progressiveLoads=0;render();});
  $('searchInput').addEventListener('input',e=>{
    state.search=e.target.value;state.page=1;progressiveLoads=0;
    // Desde la portada, buscar lleva al listado completo con los resultados.
    if(state.search.trim()&&state.pageView!=='feed'){goTo('all');return;}
    render();
  });
  // En móvil el buscador se despliega bajo la barra para no ocupar espacio fijo.
  $('searchToggle').addEventListener('pointerdown',e=>e.preventDefault());
  $('searchToggle').addEventListener('click',()=>{
    const open=!document.body.classList.contains('search-open');
    document.body.classList.toggle('search-open',open);
    $('searchToggle').setAttribute('aria-expanded',String(open));
    if(open)$('searchInput').focus();
  });
  $('searchInput').addEventListener('blur',()=>{
    if(!$('searchInput').value.trim()){document.body.classList.remove('search-open');$('searchToggle').setAttribute('aria-expanded','false');}
  });
  $('searchInput').addEventListener('keydown',e=>{
    if(e.key==='Escape'&&e.target.value){e.preventDefault();e.target.value='';state.search='';state.page=1;render();}
  });
  $('loadMore').addEventListener('click',()=>{if(hasHistory()&&state.page*state.pageSize>=applyFilters().length){void loadHistory();return;}state.page+=1;render();});
  $('themeToggle').addEventListener('click',()=>setTheme(document.body.classList.contains('light')?'dark':'light',true));
  $('markAllVisible').addEventListener('click',()=>{markArticlesRead(applyFilters().slice(0,state.page*state.pageSize));});
  const dialog=$('aboutDialog');
  const open=e=>{if(e)e.preventDefault();dialog.showModal();};
  $('aboutButton').addEventListener('click',open); $('footerInfo').addEventListener('click',open);
  $('closeAbout').addEventListener('click',()=>dialog.close()); $('dialogAccept').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target === dialog) dialog.close();});
  initSettingsHandlers();
  document.addEventListener('keydown',e=>{if(e.key==='/' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]') && !document.body.classList.contains('nav-open')){e.preventDefault();$('searchInput').focus();}});
}
document.body.classList.toggle('radar-hybrid',!IS_STYLE_PREVIEW);
if(IS_STYLE_PREVIEW){
  document.body.classList.remove('radar-hybrid');
  document.body.classList.add(IS_HASHNODE_PREVIEW?'hashnode-preview':'substack-preview');
  $('stylePreviewNotice').hidden=false;
  $('stylePreviewName').textContent=IS_HASHNODE_PREVIEW?'Hashnode':'Substack';
  $('stylePreviewOther').href=IS_HASHNODE_PREVIEW?'?preview=substack':'?preview=hashnode';
  $('stylePreviewOther').textContent=IS_HASHNODE_PREVIEW?'Comparar Substack':'Comparar Hashnode';
  // Ambas referencias se previsualizan en su paleta clara original.
  $('themeToggle').hidden=true;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',IS_HASHNODE_PREVIEW?'#f9fafb':'#ffffff');
}
hydrateIcons(); initHandlers(); updateScheduleProgress(); boot();
