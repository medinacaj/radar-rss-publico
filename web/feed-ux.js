"use strict";
/* Visible, reversible feed filters. Preferences stay local to this browser. */
(() => {
  const feed=document.getElementById('feedView');
  const bar=feed?.querySelector('.filter-bar');
  const controls=feed?.querySelector('.filter-controls');
  if(!bar||!controls||document.getElementById('feedActiveFilters'))return;
  const get=id=>document.getElementById(id);
  const region=mk('div','feed-active-filters');region.id='feedActiveFilters';
  region.setAttribute('role','region');region.setAttribute('aria-label','Filtros activos');region.tabIndex=-1;
  const chips=mk('div','feed-filter-chips');chips.id='feedFilterChips';
  const clear=mk('button','feed-clear-filters','Limpiar filtros');clear.id='feedClearFilters';clear.type='button';
  clear.title='Quitar búsqueda, fuente, fecha, estado, carpeta, región, etiqueta y solo nuevas. Conserva las preferencias de lectura.';
  const scope=mk('p','feed-filter-scope','Conserva las preferencias: ocultar leídas, fuentes ocultas y palabras silenciadas.');
  scope.id='feedFilterScope';clear.setAttribute('aria-describedby',scope.id);
  region.append(chips,clear,scope);bar.after(region);

  const library=()=>window.RadarLibrary?.getFeedFilters()||{folder:null,tag:''};
  const geo=()=>window.RadarV12?.getFeedGeo()||{id:'all',label:''};
  const hasScope=()=>Boolean(library().folder||state.category!=='all'||geo().id!=='all');
  function refresh(focus=false){state.page=1;render();if(focus)region.focus({preventScroll:true});}
  function clearSearch(){state.search='';get('searchInput').value='';}
  function clearAge(){state.maxAge=0;savePref('max-age',0);if(get('settingAge'))get('settingAge').value='0';if(get('v12Date'))get('v12Date').value='0';}
  function openPreference(tab,id){
    syncSettings();selectedTab(tab);
    const dialog=get('settingsDialog');if(dialog&&!dialog.open)dialog.showModal();
    get(id)?.scrollIntoView({block:'nearest',behavior:'auto'});get(id)?.focus({preventScroll:true});
  }
  function clearScope(preserveSource=true){
    const source=preserveSource?state.feed:'';
    const restore=()=>{state.feed=source;fillSelect();refresh();};
    if(location.hash==='#noticias'){goTo('all');restore();}
    else {window.addEventListener('hashchange',restore,{once:true});goTo('all');}
  }
  function clearFilters(){
    const scoped=hasScope();
    clearSearch();state.feed='';get('sourceSelect').value='';clearAge();state.mode='all';state.onlyNew=false;
    window.RadarLibrary?.clearTagFilter();
    if(scoped)clearScope(false);else refresh(true);
  }
  clear.addEventListener('click',clearFilters);
  function filters(){
    const active=[];
    const add=(id,label,remove,preference=false)=>active.push({id,label,remove,preference});
    if(state.search.trim())add('search','Búsqueda: '+state.search.trim(),()=>{clearSearch();refresh(true);});
    if(state.feed){const source=state.sources.find(item=>item.id===state.feed);add('source','Fuente: '+sourceLabel(source?.name||state.feed),()=>{state.feed='';get('sourceSelect').value='';refresh(true);});}
    if(state.maxAge&&state.mode!=='saved')add('age',state.maxAge===1?'Últimas 24 horas':'Últimos '+state.maxAge+' días',()=>{clearAge();refresh(true);});
    if(state.mode!=='all')add('mode',state.mode==='saved'?'Guardadas':'Sin leer',()=>{state.mode='all';refresh(true);});
    const current=library();
    if(current.folder)add('folder','Carpeta: '+current.folder.label,()=>clearScope());
    else if(state.category!=='all')add('folder','Carpeta: '+categoryLabel(state.category),()=>clearScope());
    const place=geo();if(place.id!=='all')add('region','Región: '+place.label,()=>clearScope());
    if(current.tag)add('tag','Etiqueta: '+current.tag,()=>{window.RadarLibrary?.clearTagFilter();refresh(true);});
    if(state.onlyNew)add('only-new','Solo nuevas desde tu visita',()=>{state.onlyNew=false;refresh(true);});
    if(state.hideRead&&state.mode!=='saved')add('hide-read','Ocultar leídas',()=>openPreference('reading','settingHideRead'),true);
    if(state.hiddenSources.size&&state.mode!=='saved')add('hidden-sources',state.hiddenSources.size+' fuentes ocultas',()=>openPreference('sources','settingsSourceSearch'),true);
    if(state.mutedKeywords.split(',').some(word=>word.trim().length>1))add('keywords','Palabras silenciadas',()=>openPreference('reading','settingKeywords'),true);
    return active;
  }

  // Mobile uses the existing source, tag and advanced controls, preserving events.
  const toggle=mk('button','feed-filters-toggle');toggle.id='feedFiltersToggle';toggle.type='button';
  toggle.setAttribute('aria-controls','feedFilterPanel');toggle.setAttribute('aria-expanded','false');
  const toggleLabel=mk('span','','Filtros');
  const count=mk('span','feed-filters-count');count.id='feedFiltersCount';toggle.append(toggleLabel,count);
  const panel=mk('div','feed-filter-panel');panel.id='feedFilterPanel';panel.hidden=true;
  panel.setAttribute('role','group');panel.setAttribute('aria-label','Filtros y acciones de noticias');
  bar.append(toggle);bar.after(panel);
  const advanced=get('feedAdvanced');
  const movable=[get('sourceSelect')?.closest('label'),get('libraryTagFilter')?.closest('label'),advanced].filter(Boolean);
  const homes=movable.map(element=>{
    const anchor=mk('span','feed-control-anchor');anchor.hidden=true;element.before(anchor);
    return {element,anchor};
  });
  let mobile=false,expanded=false,desktopAdvancedOpen=Boolean(advanced?.open);
  function setExpanded(value){
    expanded=value;panel.hidden=!mobile||!expanded;toggle.setAttribute('aria-expanded',String(mobile&&expanded));
  }
  function placeControls(){
    const next=window.innerWidth<=640;
    if(next!==mobile){
      mobile=next;
      if(mobile){
        desktopAdvancedOpen=Boolean(advanced?.open);
        homes.forEach(({element})=>panel.append(element));
        if(advanced)advanced.open=true;
      }else{
        homes.forEach(({element,anchor})=>anchor.after(element));
        if(advanced)advanced.open=desktopAdvancedOpen;
        expanded=false;
      }
    }
    toggle.hidden=!mobile;setExpanded(expanded);
  }
  toggle.addEventListener('click',()=>setExpanded(!expanded));
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&expanded){setExpanded(false);toggle.focus({preventScroll:true});event.stopPropagation();}
  });
  window.addEventListener('resize',placeControls);

  const emptyPrevious=emptyState;
  emptyState=function(...args){
    // Preserve the existing loading and initial-ingestion states.
    if(!state.items.length||state.historyLoading)return emptyPrevious(...args);
    const el=mk('div','empty-state feed-empty-state');
    const heading=mk('h3','feed-empty-title');
    const hint=mk('p','feed-empty-hint');
    const actions=mk('div','feed-empty-actions');
    const action=(label,callback)=>{const button=mk('button','settings-secondary feed-empty-action',label);button.type='button';button.addEventListener('click',callback);actions.append(button);};
    if(state.mode==='saved'&&!state.saved.size){
      heading.textContent='Aún no tienes noticias guardadas';
      hint.textContent='Usa el botón de guardar de una noticia para encontrarla aquí después.';
      action('Ver todas las noticias',()=>{state.mode='all';clearFilters();});
    }else{
      heading.textContent=state.search.trim()?'Sin resultados para «'+state.search.trim()+'»':state.mode==='saved'?'No hay guardadas con estos filtros':'No hay noticias con estos filtros';
      hint.textContent='Ajusta los filtros activos para ampliar los resultados.';
      if(state.search.trim()&&hasScope())action('Buscar en todas las secciones',()=>clearScope());
      else if(state.search.trim())action('Borrar búsqueda',()=>{clearSearch();refresh(true);get('searchInput').focus({preventScroll:true});});
      else if(state.maxAge&&state.mode!=='saved')action('Ampliar antigüedad',()=>{clearAge();refresh(true);});
      else if(state.feed)action('Ver todas las fuentes',()=>{state.feed='';get('sourceSelect').value='';refresh(true);});
      else if(library().tag)action('Quitar etiqueta',()=>{window.RadarLibrary?.clearTagFilter();refresh(true);});
      else if(state.hideRead&&state.mode!=='saved')action('Mostrar leídas',()=>{state.hideRead=false;state.mode='all';savePref('hide-read',false);if(get('settingHideRead'))get('settingHideRead').checked=false;refresh(true);});
      else if(state.mode==='unread')action('Ver también las leídas',()=>{state.mode='all';refresh(true);});
      else if(state.onlyNew)action('Ver también las anteriores',()=>{state.onlyNew=false;refresh(true);});
      else if(hasScope())action('Ver todas las secciones',()=>clearScope());
      else if(state.hiddenSources.size)action('Revisar fuentes ocultas',()=>openPreference('sources','settingsSourceSearch'));
      else if(state.mutedKeywords.split(',').some(word=>word.trim().length>1))action('Revisar palabras silenciadas',()=>openPreference('reading','settingKeywords'));
      else if(state.mode==='saved')action('Ver todas las noticias',()=>{state.mode='all';refresh(true);});
      else {hint.textContent='Revisa las fuentes disponibles o vuelve después de la próxima actualización.';action('Revisar fuentes',()=>openPreference('sources','settingsSourceSearch'));}
      if(filters().filter(item=>!item.preference).length>1)action('Limpiar filtros',clearFilters);
    }
    el.append(heading,hint,actions);return el;
  };
  function update(){
    const active=filters();chips.replaceChildren();
    for(const item of active){
      const button=mk('button','feed-filter-chip'+(item.preference?' is-preference':''),item.label+(item.preference?' · Ajustar':' ×'));
      button.type='button';button.dataset.filter=item.id;
      button.setAttribute('aria-label',(item.preference?'Revisar preferencia: ':'Quitar filtro: ')+item.label);
      button.addEventListener('click',item.remove);chips.append(button);
    }
    region.hidden=state.pageView!=='feed'||!active.length;
    clear.hidden=!active.some(item=>!item.preference);scope.hidden=!active.some(item=>item.preference);
    count.textContent=String(active.length);count.hidden=!active.length;
    toggle.setAttribute('aria-label','Filtros'+(active.length?' · '+active.length+' activos':''));
    // The new row owns this chip, avoiding a second copy in the old context row.
    const oldNew=get('onlyNewChip');if(oldNew)oldNew.hidden=true;
    const context=get('feedContext'),follow=get('followTopic');if(context&&follow)context.hidden=follow.hidden;
  }
  const renderPrevious=render;
  render=function(...args){const result=renderPrevious(...args);update();return result;};
  placeControls();update();
})();
