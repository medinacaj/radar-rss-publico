"use strict";
/* Radar RSS V1.2: interacción progresiva, sin backend ni librerías externas. */
(() => {
  const KEY = 'radar-v12-preferences';
  const SEARCH_KEY = 'radar-v12-saved-searches';
  const GEO = ['all', 'latam', 'chile', 'venezuela', 'region'];
  const clean = value => String(value ?? '').trim();
  function load(key, fallback) {
    try { const raw = JSON.parse(localStorage.getItem(key) || 'null'); return raw ?? fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { actionToast('No se pudo guardar la preferencia en este navegador.'); return false; }
  }
  function regionalCats() { return state.categories.filter(c => /^0[456]\s*-/.test(c)); }
  function catOf(geo) {
    const code = {chile:'04',venezuela:'05',region:'06'}[geo];
    return state.categories.find(cat => cat.startsWith(code + ' -')) || null;
  }
  function inGeo(item, geo) {
    if (geo === 'all') return true;
    const selected = geo === 'latam' ? regionalCats() : [catOf(geo)].filter(Boolean);
    return (item.categories || []).some(cat => selected.includes(cat));
  }
  const stored = load(KEY, {});
  const prefs = {
    mine: stored?.mine === true,
    categories: Array.isArray(stored?.categories) ? stored.categories.filter(x => typeof x === 'string').slice(0, 12) : [],
    briefing: ['all','mine','latam','chile','venezuela','region'].includes(stored?.briefing) || /^cat:/.test(stored?.briefing || '') ? stored.briefing : 'all'
  };
  let geo = 'all';
  let pendingSearchFeed = null;
  let savedSearches = (Array.isArray(load(SEARCH_KEY, [])) ? load(SEARCH_KEY, []) : [])
    .filter(x => x && typeof x.label === 'string' && typeof x.query === 'string' && GEO.includes(x.geo))
    .slice(0, 12);
  function persistPrefs() { save(KEY, prefs); }
  function myCats() { return prefs.categories.filter(cat => state.categories.includes(cat)); }
  window.RadarV12 = Object.freeze({
    getFeedGeo(){return {id:geo,label:regionName[geo]};},
    dashboardMatch(item) {
      const selected = myCats();
      return !prefs.mine || !selected.length || (item.categories || []).some(cat => selected.includes(cat));
    },
    briefingCategories() {
      if (prefs.briefing === 'mine') return myCats().length ? myCats() : state.categories;
      if (prefs.briefing === 'latam') return regionalCats();
      if (['chile','venezuela','region'].includes(prefs.briefing)) return [catOf(prefs.briefing)].filter(Boolean);
      if (prefs.briefing.startsWith('cat:')) {
        const cat = prefs.briefing.slice(4);
        return state.categories.includes(cat) ? [cat] : state.categories;
      }
      return state.categories;
    }
  });
  const display = (name, cls, tag='span') => mk(tag, cls, name);
  const regionName = { all:'Todas las noticias', latam:'Latinoamérica', chile:'Chile', venezuela:'Venezuela', region:'Medios regionales de Latinoamérica' };
  // Mantener las seis carpetas del lector sin duplicar su navegación.
  // La vista agregada de Latinoamérica conserva su enlace y las rutas antiguas.
  const railBase = renderTopicRail;
  renderTopicRail = function(...args) {
    railBase(...args);
    const rail = $('topicRail');
    const chips = [...rail.querySelectorAll('.topic-chip')];
    for (let i=0;i<state.categories.length;i++) if(regionalCats().includes(state.categories[i])) {
      if (chips[i+3]) chips[i+3].classList.add('v12-hidden-category');
    }
    if (regionalCats().length) {
      const chip = mk('button','topic-chip v12-region-chip' + (geo!=='all'?' active':''),'Latinoamérica');
      chip.type='button';chip.setAttribute('aria-current',geo!=='all'?'page':'false');
      chip.addEventListener('click',()=>goTo('region'));
      rail.append(chip);
    }
  };
  const navigateBase = navigateFromHash;
  navigateFromHash = function(...args) {
    const slug=decodeURIComponent(location.hash.slice(1));
    if(slug.startsWith('region/')) {
      const candidate=slug.slice(7);
      geo=candidate==='latinoamerica'?'latam':GEO.includes(candidate)?candidate:'latam';
    } else geo='all';
    navigateBase(...args);
    if (geo !== 'all') {
      $('feedHeading').textContent = regionName[geo];
      $('topbarSection').textContent = regionName[geo];
      $('sectionEyebrow').textContent = 'COBERTURA REGIONAL';
      $('feedDescription').textContent = geo==='latam' ? 'Chile, Venezuela y el resto de Latinoamérica en una sola sección.' : 'Noticias recientes de '+regionName[geo]+'.';
    }
    syncGeoSources();
    if(pendingSearchFeed!==null) {
      const feed=pendingSearchFeed;
      pendingSearchFeed=null;
      if(feed && [...$('sourceSelect').options].some(option=>option.value===feed)) {
        state.feed=feed;$('sourceSelect').value=feed;
      }
      render();
    }
    syncSearchForm();
    syncGeoControls();
  };
  const filtersBase = applyFilters;
  applyFilters = function(mode=state.mode) {
    const filtered = filtersBase(mode);
    return geo==='all' ? filtered : filtered.filter(item=>inGeo(item,geo));
  };
  const eligibleBase = dashboardEligible;
  dashboardEligible = function(...args) {
    return eligibleBase(...args).filter(window.RadarV12.dashboardMatch);
  };
  function syncGeoSources() {
    const select = $('sourceSelect');
    if (!select || state.pageView!=='feed' || geo==='all') return;
    const allowed=geo==='latam'?regionalCats():[catOf(geo)].filter(Boolean);
    const valid = new Set(state.sources.filter(src=>allowed.includes(src.category)&&!state.hiddenSources.has(src.id)).map(x=>x.id));
    for (const option of [...select.options].slice(1)) if(!valid.has(option.value)) option.remove();
    if(state.feed&&!valid.has(state.feed)){state.feed='';select.value='';}
  }
  function syncGeoControls() {
    const date=$('v12Date');
    if(date)date.value=String(state.maxAge);
  }
  function chooseGeo(value) {
    const next=GEO.includes(value)?value:'all';
    const hash=next==='all'?'#noticias':'#region/'+(next==='latam'?'latinoamerica':next);
    state.feed='';state.page=1;
    if(location.hash===hash){geo=next;fillSelect();syncGeoSources();syncGeoControls();render();}
    else location.hash=hash;
  }
  const originalGoTo = goTo;
  goTo = function(target) {
    if (target==='region') {
      const hash='#region/latinoamerica';
      if (location.hash===hash) navigateFromHash(); else location.hash=hash;
      return;
    }
    originalGoTo(target);
  };
  function makeSelect(id,label,entries) {
    const wrap=mk('label','v12-filter-field');
    wrap.append(display(label,'v12-control-label'));
    const select=mk('select','v12-select');select.id=id;
    entries.forEach(([value,name])=>select.append(new Option(name,value)));
    wrap.append(select);return {wrap,select};
  }
  // Un único toolbar con fuente, etiquetas, fecha, acciones y vista.
  // No crear otra fila que duplique los controles ya presentes.
  const datePicker=makeSelect('v12Date','Antigüedad',[
    ['0','Cualquier fecha'],['1','24 horas'],['7','7 días'],['30','30 días'],['90','90 días']]);
  datePicker.wrap.classList.add('v12-toolbar-age');
  datePicker.wrap.querySelector('.v12-control-label').classList.add('sr-only');
  datePicker.select.title='Filtrar por antigüedad';
  const saveSearch=mk('button','v12-save-icon');saveSearch.type='button';saveSearch.id='v12SaveSearch';
  saveSearch.title='Guardar búsqueda con los filtros actuales';
  saveSearch.setAttribute('aria-label','Guardar búsqueda con los filtros actuales');
  saveSearch.append(svgIcon('bookmark'));
  const controls=$('feedView').querySelector('.filter-controls');
  const bulkRead=$('markAllVisible');
  controls.insertBefore(datePicker.wrap,bulkRead);
  controls.insertBefore(saveSearch,bulkRead);
  const savedPanel=mk('div','v12-saved-searches');savedPanel.id='v12SavedSearches';
  savedPanel.setAttribute('aria-label','Búsquedas guardadas');
  $('feedView').querySelector('.filter-bar').after(savedPanel);
  datePicker.select.addEventListener('change',()=>{
    state.maxAge=Number(datePicker.select.value);
    savePref('max-age',state.maxAge);
    if($('settingAge')) $('settingAge').value=String(state.maxAge);
    state.page=1;render();
  });
  function snapshot(label) {
    return {
      label:clean(label).slice(0,65),
      query:state.search.slice(0,90),geo,age:state.maxAge,
      category:state.category,feed:state.feed
    };
  }
  function renderSearches() {
    savedPanel.replaceChildren();
    if(!savedSearches.length) { savedPanel.hidden=true;return; }
    savedPanel.hidden=false;
    savedPanel.append(display('Mis búsquedas:','v12-searches-label'));
    savedSearches.forEach((item,index)=>{
      const group=mk('span','v12-search-saved');
      const b=mk('button','v12-saved-open',item.label);b.type='button';b.title='Aplicar búsqueda guardada '+item.label;
      b.addEventListener('click',()=>{
        state.search=item.query;state.feed='';state.maxAge=[0,1,7,30,90].includes(Number(item.age))?Number(item.age):0;
        $('searchInput').value=state.search; savePref('max-age',state.maxAge);
        pendingSearchFeed=item.feed||'';
        if(item.category!=='all'&&state.categories.includes(item.category)) {
          geo='all';goTo(item.category);
        } else if(['chile','venezuela','region'].includes(item.geo) && catOf(item.geo)) {
          // Compatibilidad con búsquedas anteriores a la retirada del selector.
          // Chile, Venezuela y 06-Latinoamérica son carpetas existentes.
          geo='all';goTo(catOf(item.geo));
        } else {
          chooseGeo(item.geo==='latam'?'latam':'all');
        }
        state.page=1;syncGeoControls();syncGeoSources();
        // Cuando la URL cambia, pendingSearchFeed se aplica al reconstruir el selector.
        // Si la URL no cambió, el selector ya está disponible.
        if(pendingSearchFeed!==null && [...$('sourceSelect').options].some(o=>o.value===pendingSearchFeed)){
          state.feed=pendingSearchFeed;$('sourceSelect').value=pendingSearchFeed;pendingSearchFeed=null;
        }
        render();
        actionToast('Búsqueda cargada.');
      });
      const x=mk('button','v12-search-remove','×');x.type='button';x.title='Eliminar búsqueda';
      x.setAttribute('aria-label','Eliminar búsqueda '+item.label);
      x.addEventListener('click',()=>{
        savedSearches.splice(index,1);save(SEARCH_KEY,savedSearches);renderSearches();
      });
      group.append(b,x);savedPanel.append(group);
    });
  }
  function syncSearchForm(){renderSearches();}
  saveSearch.addEventListener('click',()=>{
    if(savedSearches.length>=12){actionToast('Puedes guardar hasta 12 búsquedas.');return;}
    const context=state.search.trim() || (state.category==='all'?regionName[geo]:categoryLabel(state.category));
    const label= context + (state.maxAge? ' · '+state.maxAge+' d':'');
    const item=snapshot(label);
    if(savedSearches.some(old=>old.query===item.query&&old.geo===item.geo&&old.age===item.age&&old.category===item.category&&old.feed===item.feed)){
      actionToast('Esta búsqueda ya está guardada.');return;
    }
    savedSearches.push(item);if(save(SEARCH_KEY,savedSearches)){renderSearches();actionToast('Búsqueda guardada en este navegador.');}
  });
  // Evitar repetir en la portada las categorías disponibles en la barra
  // lateral. La selección opcional vive en Configuración > Lectura y filtros.
  function createMine() {
    const reading=document.querySelector('[data-settings-pane="reading"]');
    const grid=reading?.querySelector('.setting-grid');
    if(!reading||!grid)return;
    const section=mk('section','v12-settings-myradar');
    section.id='v12MyRadar';
    section.setAttribute('aria-labelledby','v12MyRadarTitle');
    const heading=mk('div','v12-settings-myradar-head');
    const description=mk('div','');
    const title=display('Personalizar portada','v12-settings-myradar-title','h4');
    title.id='v12MyRadarTitle';
    description.append(title,display('Opcional: selecciona qué secciones aparecen en Inicio. Las carpetas de fuentes no cambian.','v12-settings-myradar-hint','p'));
    const mode=mk('button','v12-secondary','Activar selección');mode.id='v12MineToggle';mode.type='button';
    mode.addEventListener('click',()=>{
      prefs.mine=!prefs.mine;
      if(prefs.mine&&!myCats().length)prefs.categories=state.categories.slice();
      persistPrefs();updateMine();render();
    });
    heading.append(description,mode);
    const details=mk('details','v12-settings-myradar-details');
    details.id='v12MineDetails';
    const summary=mk('summary','', 'Elegir categorías de portada');
    const choices=mk('div','v12-myradar-choices');choices.id='v12MineCategories';
    choices.setAttribute('role','group');choices.setAttribute('aria-label','Categorías de portada');
    details.append(summary,choices);
    section.append(heading,details);
    grid.after(section);
  }
  function updateMine() {
    const panel=$('v12MyRadar');
    if(!panel)return;
    panel.classList.toggle('is-active',prefs.mine);
    const mode=$('v12MineToggle');
    mode.textContent=prefs.mine?'Usar portada general':'Activar selección';
    mode.setAttribute('aria-pressed',String(prefs.mine));
    const list=$('v12MineCategories');list.replaceChildren();
    const selected=new Set(myCats());
    const options=[...state.categories.filter(c=>!regionalCats().includes(c)),'latam'];
    options.forEach(cat=>{
      const ids=cat==='latam'?regionalCats():[cat];
      const active=ids.some(id=>selected.has(id));
      const title=cat==='latam'?'Latinoamérica':categoryLabel(cat);
      const button=mk('button','v12-mine-chip'+(active?' selected':''),title);
      button.type='button';button.setAttribute('aria-pressed',String(active));
      button.addEventListener('click',()=>{
        const current=new Set(myCats());
        if(active)ids.forEach(c=>current.delete(c));else ids.forEach(c=>current.add(c));
        if(current.size===0){actionToast('Selecciona al menos una sección.');return;}
        prefs.categories=[...current];
        prefs.mine=true;persistPrefs();updateMine();render();
      });
      list.append(button);
    });
  }
  createMine();
  const dashboardBase=renderDashboard;
  renderDashboard=function(...args){
    dashboardBase(...args);
    updateMine();
    const container=$('dashboardFolders');
    const region=regionalCats();
    if(!region.length)return;
    const regular=[...container.querySelectorAll('.dashboard-folder')];
    for(const section of regular){
      const label=section.querySelector('h3')?.textContent||'';
      if(region.some(cat=>categoryLabel(cat)===label))section.remove();
    }
    if(prefs.mine && !region.some(cat=>myCats().includes(cat)))return;
    const visibleIds=new Set([...$('dashboardFeature').querySelectorAll('[data-article-id]'),...$('dashboardRecent').querySelectorAll('[data-article-id]'),...container.querySelectorAll('[data-article-id]')].map(node=>node.dataset.articleId));
    const stories=dashboardEligible().filter(item=>inGeo(item,'latam')&&!visibleIds.has(item.id)).slice(0,4);
    if(!stories.length)return;
    const panel=mk('section','dashboard-folder v12-region-dashboard');
    const header=mk('button','dashboard-folder-head');header.type='button';
    header.setAttribute('aria-label','Ver noticias de Latinoamérica');
    header.append(display('Latinoamérica','v12-region-dashboard-title','h3'),
      display(String(state.sources.filter(src=>regionalCats().includes(src.category)).length)+' fuentes regionales','v12-region-dashboard-count'),
      display('Ver todo →','dashboard-folder-more'));
    header.addEventListener('click',()=>goTo('region'));
    const list=mk('div','dashboard-folder-list');
    list.append(...stories.map(item=>headlineRow(item,'dashboard-folder-row')));
    panel.append(header,list);container.append(panel);
    container.closest('.dashboard-panel').hidden=false;
  };
  function createBriefingOptions(){
    const wrap=mk('div','v12-briefing-scopes');wrap.id='v12BriefingScopes';
    wrap.setAttribute('role','group');wrap.setAttribute('aria-label','Personalizar resumen del día');
    const select=makeSelect('v12BriefingScope','Personalizar resumen',[
      ['all','Todas las secciones'],['mine','Mis intereses de Mi Radar'],['latam','Latinoamérica'],
      ['chile','Chile'],['venezuela','Venezuela'],['region','Noticias regionales'],
      ...state.categories.filter(x=>!regionalCats().includes(x)).map(cat=>['cat:'+cat,categoryLabel(cat)])
    ]);
    wrap.append(select.wrap);
    select.select.value=prefs.briefing;
    select.select.addEventListener('change',()=>{
      prefs.briefing=select.select.value;persistPrefs();
      if(window.speechSynthesis)speechSynthesis.cancel();
      window.renderBriefing();
      actionToast('Resumen personalizado.');
    });
    $('briefingView').querySelector('.briefing-head').after(wrap);
  }
  createBriefingOptions();
  function updateBriefingOptions(){
    const select=$('v12BriefingScope');
    if(!select)return;
    for(const cat of state.categories.filter(c=>!regionalCats().includes(c))){
      const value='cat:'+cat;
      if(![...select.options].some(option=>option.value===value))
        select.append(new Option(categoryLabel(cat),value));
    }
    if([...select.options].some(option=>option.value===prefs.briefing))select.value=prefs.briefing;
  }
  const readerBase=openArticleReader;
  openArticleReader=function(item,event,...rest){
    readerBase(item,event,...rest);
    if(event&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0))return;
    const compare=$('readerCompare');
    if(!compare||compare.querySelector('.v12-compare-tools'))return;
    const original=[{url:item.url,title:item.title,publisher:item.publisher||item.source,
      published_at:item.published_at,category:(item.categories||[])[0]},...(item.also_in||[])].filter(x=>x&&safeURL(x.url));
    if(original.length<2)return;
    const controls=mk('div','v12-compare-tools');
    const select=makeSelect('v12CompareSort','Comparar coberturas',[
      ['publisher','Agrupar por medio y región'],['time','Ordenar cronológicamente']]);
    controls.append(select.wrap);
    const summary=display(original.length+' publicaciones enlazadas · Sin evaluación editorial','v12-compare-summary');
    controls.append(summary);
    compare.querySelector('.reader-compare-head').after(controls);
    const originals=[...compare.querySelectorAll('.reader-compare-group')];
    select.select.addEventListener('change',()=>{
      compare.querySelectorAll('.v12-chronology').forEach(x=>x.remove());
      originals.forEach(x=>{x.hidden=select.select.value==='time';});
      if(select.select.value==='publisher')return;
      const box=mk('div','reader-compare-group v12-chronology');
      box.append(display('Línea de tiempo de publicaciones','v12-timeline-heading','h4'));
      const ul=mk('ol','v12-timeline-list');
      const sorted=original.slice().sort((a,b)=>new Date(a.published_at||0)-new Date(b.published_at||0));
      sorted.forEach(entry=>{
        const li=mk('li','v12-timeline-item');
        const stamp=entry.published_at?timeNode(entry.published_at):display('Fecha no disponible','reader-compare-meta');
        li.append(stamp,link(entry.url,entry.title||sourceLabel(entry.publisher),'reader-compare-link'),
          display(sourceLabel(entry.publisher),'reader-compare-meta'));
        ul.append(li);
      });
      box.append(ul);compare.querySelector('.reader-compare-note')?.before(box);
    });
  };
  const renderBase=render;
  render=function(...args){
    renderBase(...args);
    updateBriefingOptions();
    syncGeoControls();
  };
  syncGeoControls();renderSearches();updateMine();
})();
