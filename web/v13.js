"use strict";
/* Radar RSS V1.3: ayuda contextual y estadísticas exclusivamente locales.
   No se recopilan eventos ni se envía telemetría a terceros. */
/* Las ayudas de inicio son herramientas de Configuración > Lectura y filtros.
   La portada queda libre de una guía introductoria permanente. */
(() => {
  const reading=document.querySelector('[data-settings-pane="reading"]');
  if(!reading||document.getElementById('v13Guide'))return;
  const panel=mk('section','settings-reading-help');
  panel.id='v13Guide';
  panel.setAttribute('aria-labelledby','v13GuideTitle');
  const title=mk('h4','', 'Herramientas de lectura');
  title.id='v13GuideTitle';
  const description=mk('p','setting-hint',
    'Accesos a funciones disponibles en Radar RSS. También puedes usarlas desde el lector.');
  const actions=mk('div','settings-reading-actions');
  function addAction(label,hint,callback){
    const button=mk('button','settings-reading-action');
    button.type='button';
    button.append(mk('strong','',label),mk('span','',hint));
    button.addEventListener('click',callback);
    actions.append(button);
  }
  addAction('Personalizar temas','Ajusta qué noticias quieres ver',()=>{
    selectedTab('reading');
    const target=$('v12MyRadar');
    target?.scrollIntoView({block:'nearest',behavior:'auto'});
    $('v12MineToggle')?.focus({preventScroll:true});
  });
  addAction('Combinar filtros','Buscar por fuente y antigüedad',()=>{
    const dialog=$('settingsDialog');
    if(dialog?.open)dialog.close();
    goTo('all');
    const focus=()=>$('sourceSelect')?.focus({preventScroll:true});
    if(state.pageView==='feed')focus();
    else window.addEventListener('hashchange',focus,{once:true});
  });
  addAction('Comparar titulares','Contrasta una noticia publicada por varios medios',()=>{
    const dialog=$('settingsDialog');
    if(dialog?.open)dialog.close();
    const item=state.items.find(x=>Array.isArray(x.also_in)&&x.also_in.some(y=>safeURL(y.url)));
    if(item)openArticleReader(item,null,'compare');
    else {
      goTo('all');
      actionToast('Busca una noticia con el botón «medios» para comparar.');
    }
  });
  panel.append(title,description,actions);
  reading.append(panel);
})();


/* V5.4 — controles secundarios mediante un desplegable nativo y accesible.
   Se reagrupan los elementos existentes: no se duplican ni se pierden eventos. */
(() => {
  const controls=document.querySelector('#feedView .filter-controls');
  if (!controls || document.getElementById('feedAdvanced')) return;
  const date=document.querySelector('.v12-toolbar-age');
  const save=document.getElementById('v12SaveSearch');
  const bulk=document.getElementById('markAllVisible');
  if(!date||!save||!bulk)return;
  const group=document.createElement('details');
  group.className='feed-advanced';
  group.id='feedAdvanced';
  const summary=document.createElement('summary');
  summary.setAttribute('aria-label','Más opciones de noticias: antigüedad y acciones');
  const content=document.createElement('div');
  content.className='feed-advanced-content';
  group.append(summary,content);
  summary.addEventListener('click',event=>{event.preventDefault();group.open=!group.open;});
  content.append(date,save,bulk);
  controls.append(group);
  function updateSummary(){
    const age=Number(document.getElementById('v12Date')?.value||state.maxAge);
    summary.textContent=age>0?'Opciones · fecha activa':'Más opciones';
  }
  const renderPrevious=render;
  render=function(...args){
    const result=renderPrevious(...args);
    updateSummary();
    return result;
  };
  document.getElementById('v12Date').addEventListener('change',updateSummary);
  const inFilterPanel=()=>Boolean(group.closest('.feed-filter-panel'));
  save.addEventListener('click',()=>{if(!inFilterPanel())group.open=false;});
  bulk.addEventListener('click',()=>{if(!inFilterPanel())group.open=false;});
  document.addEventListener('pointerdown',event=>{
    if(group.open&&!inFilterPanel()&&!group.contains(event.target))group.open=false;
  });
  group.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&group.open&&!inFilterPanel()){group.open=false;summary.focus();event.stopPropagation();}
  });
  updateSummary();
})();
