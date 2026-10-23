"use strict";
/* Radar RSS library v1 — local only: source folders, tags, saved metadata.
   Runs after app.js without replacing the RSS collector or changing the 5-min checker.
   Browser storage is not a cloud backup. */
(function(){
const ARCHIVE_KEY='radar-saved-archive-v1';
const FOLDER_KEY='radar-source-folders-v1';
const TAG_KEY='radar-article-tags-v1';
const LIMIT=350;
VECTOR_PATHS.folder='<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>';
VECTOR_PATHS['folder-plus']='<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3zM12 11v6M9 14h6"/>';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
const write=(key,value)=>{
  try{localStorage.setItem(key,JSON.stringify(value));return true;}
  catch(error){console.warn('Radar RSS: no se pudo guardar',key,error);return false;}
};
const snapshot=item=>{
  if(!item||typeof item.id!=='string'||!safeURL(item.url))return null;
  return {
    id:item.id.slice(0,150),url:safeURL(item.url),
    title:String(item.title||'Sin título').slice(0,250),
    image:safeURL(item.image)||null,
    summary:String(item.summary||'').slice(0,900),
    published_at:String(item.published_at||'').slice(0,40),
    first_seen_at:String(item.first_seen_at||'').slice(0,40),
    publisher:String(item.publisher||'').slice(0,90),
    source:String(item.source||'').slice(0,120),
    source_ids:Array.isArray(item.source_ids)?item.source_ids.filter(x=>typeof x==='string').slice(0,20):[],
    categories:Array.isArray(item.categories)?item.categories.filter(x=>typeof x==='string').slice(0,10):[],
    is_radar:Boolean(item.is_radar)
  };
};
const rawArchive=read(ARCHIVE_KEY,[]);
let archive=new Map((Array.isArray(rawArchive)?rawArchive:[]).slice(-LIMIT).map(snapshot).filter(Boolean).map(x=>[x.id,x]));
const rawFolders=read(FOLDER_KEY,{});
let folders=Object.create(null);
function readFolders(data){
  const result=Object.create(null);
  if(!data||typeof data!=='object'||Array.isArray(data))return result;
  for(const [name,ids] of Object.entries(data).slice(0,25)){
    if(!name.trim()||name.length>45||!Array.isArray(ids)||name==='__proto__')continue;
    result[name]=[...new Set(ids.filter(x=>typeof x==='string'&&x.length<150))].slice(0,160);
  }
  return result;
}
folders=readFolders(rawFolders);
const rawTags=read(TAG_KEY,{});
let tags=Object.create(null);
function readTags(data){
  const output=Object.create(null);
  if(!data||typeof data!=='object'||Array.isArray(data))return output;
  for(const [id,values] of Object.entries(data).slice(-3000)){
    if(!id||id.length>150||!Array.isArray(values))continue;
    output[id]=[...new Set(values.filter(x=>typeof x==='string').map(x=>x.trim()).filter(x=>x&&x.length<=30))].slice(0,8);
  }
  return output;
}
tags=readTags(rawTags);
let activeFolder=null,activeTag='';
// Read-only snapshot for the feed's visible filter summary; no library data is removed.
window.RadarLibrary=Object.freeze({
 getFeedFilters(){return {
  folder:activeFolder?{id:activeFolder,label:activeFolder,kind:'manual'}:
   state.category!=='all'?{id:state.category,label:folderName('default',state.category),kind:'default'}:null,
  tag:activeTag
 };},
 clearTagFilter(){activeTag='';const select=document.getElementById('libraryTagFilter');if(select)select.value='';}
});

const FOLDER_OVERLAY_KEY='radar-default-folders-v1';
let defaults=(()=>{try{const obj=JSON.parse(localStorage.getItem(FOLDER_OVERLAY_KEY)||'{}');
 const result=Object.create(null);
 if(obj&&typeof obj==='object'&&!Array.isArray(obj))
  for(const [id,v] of Object.entries(obj).slice(0,40)){
   if(id.length>150||!v||typeof v!=='object')continue;
   result[id]={name:typeof v.name==='string'?v.name.slice(0,45):'',
    hidden:v.hidden===true,sources:Array.isArray(v.sources)?v.sources.filter(x=>typeof x==='string').slice(0,160):null};
  }
 return result;
}catch{return Object.create(null);}})();
const saveDefaults=()=>write(FOLDER_OVERLAY_KEY,defaults);
const folderName=(kind,id)=>kind==='default'?(defaults[id]?.name||categoryLabel(id)):id;
const folderSources=(kind,id)=>kind==='default'?(Array.isArray(defaults[id]?.sources)?defaults[id].sources:state.sources.filter(x=>x.category===id).map(x=>x.id)):(folders[id]||[]);
function folderNameTaken(name,kind,id){
 const key=name.toLocaleLowerCase('es');
 return state.categories.some(x=>!(kind==='default'&&x===id)&&folderName('default',x).toLocaleLowerCase('es')===key)
  ||Object.keys(folders).some(x=>!(kind==='manual'&&x===id)&&x.toLocaleLowerCase('es')===key);
}
let folderSelection=null,folderEditor=null;
function hideFolderMenu(focus=false){
 const menu=document.getElementById('folderMenu');if(!menu||menu.hidden)return;
 menu.hidden=true;
 if(focus&&folderSelection?.anchor?.isConnected)folderSelection.anchor.focus();
 folderSelection=null;
}
function showFolderMenu(kind,id,x,y,anchor){
 hideFolderMenu();folderSelection={kind,id,anchor};
 const el=$('folderMenu');
 const forAll=kind==='all';
 el.setAttribute('aria-label',forAll?'Acciones de Todas las noticias':'Acciones de carpeta');
 for(const button of el.querySelectorAll('[data-folder-action]')){
  const command=button.dataset.folderAction;
  button.hidden=forAll?!['read','unread','view','sources'].includes(command):['unread','view'].includes(command);
  if(command==='read')button.textContent=forAll?'Marcar todas como leídas':'Marcar como leída';
  if(command==='sources')button.textContent=forAll?'Gestionar fuentes RSS':'Administrar fuentes';
 }
 el.hidden=false;
 el.style.left=Math.max(8,Math.min(x,window.innerWidth-el.offsetWidth-8))+'px';
 el.style.top=Math.max(8,Math.min(y,window.innerHeight-el.offsetHeight-8))+'px';
 [...el.querySelectorAll('[data-folder-action]')].find(button=>!button.hidden)?.focus({preventScroll:true});
}
function equipFolder(row,button,kind,id){
 if(kind!=='all'){
  row.classList.add('folder-entry');
  row.dataset.radarSourceIds=JSON.stringify(folderSources(kind,id));
 }
 button.setAttribute('aria-keyshortcuts','Shift+F10');
 button.setAttribute('aria-description','Clic derecho o Shift+F10 para opciones. En pantallas táctiles, mantén pulsado.');
 let touchTimer=null,touchStart=null,blockClickUntil=0;
 const stopLongPress=()=>{
  if(touchTimer!==null){window.clearTimeout(touchTimer);touchTimer=null;}
  touchStart=null;
 };
 row.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(Date.now()<blockClickUntil)return;
  stopLongPress();
  showFolderMenu(kind,id,e.clientX,e.clientY,button);
 });
 row.addEventListener('keydown',e=>{
  if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){
   e.preventDefault();const r=button.getBoundingClientRect();
   showFolderMenu(kind,id,r.left+20,r.top+22,button);
  }
 });
 button.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||!e.isPrimary)return;
  stopLongPress();
  touchStart={x:e.clientX,y:e.clientY,pointerId:e.pointerId};
  touchTimer=window.setTimeout(()=>{
   if(!touchStart)return;
   blockClickUntil=Date.now()+1250;
   const {x,y}=touchStart;
   stopLongPress();
   showFolderMenu(kind,id,x,y,button);
  },550);
 });
 button.addEventListener('pointermove',e=>{
  if(touchStart&&e.pointerId===touchStart.pointerId&&
      Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>12)stopLongPress();
 });
 for(const eventName of ['pointerup','pointercancel','pointerleave']){
  button.addEventListener(eventName,stopLongPress);
 }
 // La pulsación prolongada abre el menú, no navega a la carpeta.
 button.addEventListener('click',e=>{
  if(Date.now()<blockClickUntil){
   e.preventDefault();e.stopImmediatePropagation();
   blockClickUntil=0;
  }
 },true);
}
function equipDefaults(){
 const list=$('libraryFolderNav');
 [...list.querySelectorAll('.system-folder-link')].forEach((button,i)=>{
  const id=state.categories[i];if(!id)return;
  const row=mk('div','folder-default-row');
  button.replaceWith(row);row.append(button);
  row.hidden=defaults[id]?.hidden===true;
  button.querySelector('.nav-label').textContent=folderName('default',id);
  const ids=folderSources('default',id),count=unread(ids);
  button.querySelector('.nav-count').textContent=String(count);
  button.title=count+' sin leer · '+ids.length+' fuentes';
  equipFolder(row,button,'default',id);
 });
 $('folderRestore').hidden=!state.categories.some(id=>defaults[id]?.hidden);
}
function openFolderEditor(kind,id,create=false,sources=false){
 hideFolderMenu();
 folderEditor={kind,id,create,sources,selected:new Set(create?[]:folderSources(kind,id))};
 const dialog=$('folderDialog');
 $('folderDialogTitle').textContent=create?'Nueva carpeta de fuentes':
   sources?'Administrar fuentes · '+folderName(kind,id):'Renombrar carpeta';
 $('folderNamePane').hidden=sources;
 $('folderSourcesPane').hidden=!sources;
 $('folderNameInput').value=create?'':folderName(kind,id);
 $('folderError').textContent='';
 if(sources){$('folderSourceSearch').value='';listFolderSources();}
 dialog.showModal();(sources?$('folderSourceSearch'):$('folderNameInput')).focus();
}
function listFolderSources(){
 if(!folderEditor)return;
 const filter=stripAccents($('folderSourceSearch').value.trim());
 const list=$('folderSourceList');list.replaceChildren();
 for(const source of state.sources.slice().sort((a,b)=>a.name.localeCompare(b.name,'es'))){
  if(filter&&!stripAccents(source.name+' '+categoryLabel(source.category)).includes(filter))continue;
  const row=mk('label','folder-source-row-option');
  const input=mk('input');input.type='checkbox';
  input.checked=folderEditor.selected.has(source.id);
  input.addEventListener('change',()=>{
   if(input.checked)folderEditor.selected.add(source.id);else folderEditor.selected.delete(source.id);
   $('folderSelectedCount').textContent=folderEditor.selected.size+' fuentes seleccionadas';
  });
  const info=mk('span','folder-source-text');
  info.append(mk('strong','',sourceLabel(source.name)),mk('small','',categoryLabel(source.category)));
  row.append(input,info);list.append(row);
 }
 $('folderSelectedCount').textContent=folderEditor.selected.size+' fuentes seleccionadas';
}
function saveFolderEditor(){
 const e=folderEditor;if(!e)return;
 if(e.sources){
  const ids=[...e.selected];
  if(e.kind==='default'){
   const old=defaults[e.id]||{};defaults[e.id]={...old,sources:ids};
   if(!saveDefaults()){defaults[e.id]=old;return $('folderError').textContent='No se pudieron guardar las fuentes.';}
  }else{
   const old=folders[e.id];folders[e.id]=ids;
   if(!write(FOLDER_KEY,folders)){folders[e.id]=old;return $('folderError').textContent='No se pudieron guardar las fuentes.';}
  }
 }else{
  const name=$('folderNameInput').value.trim().replace(/\s+/g,' ').slice(0,45);
  if(!name||name==='__proto__'||folderNameTaken(name,e.kind,e.id))
   return $('folderError').textContent='Elige un nombre diferente al de las carpetas existentes.';
  if(e.create){
   if(Object.keys(folders).length>=25)return $('folderError').textContent='Máximo de 25 carpetas.';
   folders[name]=[];
   if(!write(FOLDER_KEY,folders)){delete folders[name];return $('folderError').textContent='No se pudo guardar.';}
  }else if(e.kind==='default'){
   const old=defaults[e.id]||{};defaults[e.id]={...old,name};
   if(!saveDefaults()){defaults[e.id]=old;return $('folderError').textContent='No se pudo guardar.';}
  }else{
   const old=folders[e.id];delete folders[e.id];folders[name]=old;
   if(!write(FOLDER_KEY,folders)){delete folders[name];folders[e.id]=old;return $('folderError').textContent='No se pudo guardar.';}
   if(activeFolder===e.id)window.location.hash='#carpeta/'+encodeURIComponent(name);
  }
 }
 $('folderDialog').close();
 buildNav();renderSettingsSources();fillSelect();render();
 if(e.kind==='default'&&state.category===e.id){$('feedHeading').textContent=folderName('default',e.id);$('topbarSection').textContent=folderName('default',e.id);}
 actionToast('Carpeta actualizada.');
}
function deleteFolder(kind,id){
 hideFolderMenu();
 const warning=kind==='default'
  ?'¿Ocultar la carpeta «'+folderName(kind,id)+'»? Solo desaparece de este navegador y podrás restaurarla. Las fuentes y noticias no se borran.'
  :'¿Eliminar la carpeta «'+folderName(kind,id)+'»? No se borrarán las fuentes ni noticias.';
 if(!confirm(warning))return;
 if(kind==='default'){
  const old=defaults[id]||{};defaults[id]={...old,hidden:true};
  if(!saveDefaults()){defaults[id]=old;return actionToast('No se pudo guardar.');}
  if(state.category===id)window.location.hash='#noticias';
 }else{
  const old=folders[id];delete folders[id];
  if(!write(FOLDER_KEY,folders)){folders[id]=old;return actionToast('No se pudo eliminar.');}
  if(activeFolder===id)window.location.hash='#noticias';
 }
 buildNav();render();actionToast('Carpeta retirada de la lista.');
}
async function markAllNewsRead(){
 // Esta acción explícita incluye el historial publicado, no solo una página.
 if(!confirm('¿Marcar como leídas todas las noticias disponibles de las fuentes activas, incluido el historial?'))return;
 if(hasHistory()){
  await loadHistory();
  if(state.historyFailed){actionToast('No se pudo cargar el historial. No se cambió la lectura.');return;}
 }
 const active=new Set(state.sources.filter(x=>!state.hiddenSources.has(x.id)).map(x=>x.id));
 markArticlesRead(state.items.filter(item=>(item.source_ids||[]).some(id=>active.has(id))));
}
function runFolderAction(command){
 if(!folderSelection)return;
 const {kind,id}=folderSelection;
 if(kind==='all'){
  hideFolderMenu();
  if(command==='read')void markAllNewsRead();
  else if(command==='unread'){state.mode='unread';state.page=1;goTo('all');}
  else if(command==='view'){state.mode='all';state.page=1;goTo('all');}
  else if(command==='sources'){
   setNavOpen(false,false);
   $('settingsButton').click();selectedTab('sources');
  }
  return;
 }
 if(command==='rename')openFolderEditor(kind,id);
 else if(command==='sources')openFolderEditor(kind,id,false,true);
 else if(command==='delete')deleteFolder(kind,id);
 else if(command==='read'){
  const ids=new Set(folderSources(kind,id));hideFolderMenu();
  markArticlesRead(state.items.filter(item=>(item.source_ids||[]).some(source=>ids.has(source))));
 }
}
function installFolderUI(){
 VECTOR_PATHS['rotate-ccw']='<path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/>';
 const menu=mk('div','folder-popup-menu');menu.id='folderMenu';menu.hidden=true;
 menu.setAttribute('role','menu');menu.setAttribute('aria-label','Acciones de carpeta');
 for(const [action,label] of [['rename','Renombrar'],['sources','Administrar fuentes'],['read','Marcar como leída'],['delete','Eliminar carpeta'],['view','Ver todas las noticias'],['unread','Mostrar solo las no leídas']]){
  const b=mk('button','folder-popup-option',label);b.type='button';b.setAttribute('role','menuitem');b.dataset.folderAction=action;
  b.addEventListener('click',()=>runFolderAction(action));menu.append(b);
 }
 document.body.append(menu);
 document.addEventListener('pointerdown',event=>{
  if(!menu.hidden&&!event.target.closest('#folderMenu'))hideFolderMenu();
 });
 document.addEventListener('keydown',event=>{
  if(menu.hidden)return;
  if(event.key==='Escape'){event.preventDefault();hideFolderMenu(true);}
  else if(['ArrowDown','ArrowUp'].includes(event.key)){
   event.preventDefault();const buttons=[...menu.querySelectorAll('button:not([hidden])')],i=buttons.indexOf(document.activeElement);
   buttons[(i+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();
  }else if(event.key==='Tab')hideFolderMenu();
 });
 window.addEventListener('resize',()=>hideFolderMenu());
 const dialog=mk('dialog','folder-manage-dialog');dialog.id='folderDialog';
 const header=mk('div','folder-dialog-top');
 const title=mk('h2','');title.id='folderDialogTitle';
 const x=mk('button','folder-dialog-close','×');x.type='button';x.setAttribute('aria-label','Cerrar');x.addEventListener('click',()=>dialog.close());
 header.append(title,x);
 const name=mk('div');name.id='folderNamePane';
 const input=mk('input','folder-dialog-input');input.id='folderNameInput';input.maxLength=45;
 input.placeholder='Nombre de carpeta';input.setAttribute('aria-label','Nombre de carpeta');
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveFolderEditor();}});
 name.append(input);
 const sources=mk('div');sources.id='folderSourcesPane';sources.hidden=true;
 const search=mk('input','folder-dialog-input');search.id='folderSourceSearch';search.type='search';
 search.placeholder='Buscar fuente RSS';search.setAttribute('aria-label','Buscar fuente RSS');
 search.addEventListener('input',listFolderSources);
 const count=mk('p','folder-source-count');count.id='folderSelectedCount';
 const list=mk('div','folder-source-choices');list.id='folderSourceList';
 sources.append(search,count,list);
 const err=mk('p','folder-dialog-error');err.id='folderError';
 const buttons=mk('div','folder-dialog-buttons');
 const cancel=mk('button','folder-dialog-cancel','Cancelar');cancel.type='button';cancel.addEventListener('click',()=>dialog.close());
 const save=mk('button','folder-dialog-save','Guardar');save.type='button';save.addEventListener('click',saveFolderEditor);
 buttons.append(cancel,save);
 dialog.append(header,name,sources,err,buttons);document.body.append(dialog);
}

const saveArchive=()=>write(ARCHIVE_KEY,[...archive.values()].slice(-LIMIT));
const savedNews=()=>{
  const found=new Map(state.items.filter(x=>state.saved.has(x.id)).map(x=>[x.id,x]));
  for(const [id,item] of archive)if(state.saved.has(id)&&!found.has(id))found.set(id,item);
  return [...found.values()];
};
function syncArchive(){
  let changed=false;
  for(const item of state.items){
    if(!state.saved.has(item.id))continue;
    const s=snapshot(item);
    if(!s)continue;
    const previous=archive.get(s.id);
    if(!previous||previous.title!==s.title||previous.summary!==s.summary||previous.image!==s.image){
      archive.delete(s.id);archive.set(s.id,s);changed=true;
    }
  }
  if(changed)saveArchive();
}
function toggleBookmark(item){
  if(state.saved.has(item.id)){
    state.saved.delete(item.id);archive.delete(item.id);
  }else{
    if(archive.size>=LIMIT){actionToast('Máximo de '+LIMIT+' noticias archivadas. Exporta un respaldo y libera espacio antes de seguir.');return;}
    const s=snapshot(item);
    if(!s){actionToast('La noticia no tiene enlace válido.');return;}
    archive.delete(s.id);archive.set(s.id,s);state.saved.add(s.id);
  }
  const saved=saveArchive();
  const restoreFocus=document.activeElement?.classList?.contains('article-save')===true;
  persist('radar-saved',state.saved);
  render();
  // Guardar vuelve a pintar las tarjetas: devolver el foco al botón equivalente
  // evita perderse en lectores de pantalla y durante la navegación con teclado.
  if(restoreFocus){
    const article=[...document.querySelectorAll('#articleGrid .article-card')].find(el=>el.dataset.articleId===item.id);
    const button=article?.querySelector('.article-save');
    if(button)button.focus({preventScroll:true});
  }
  if(!saved)actionToast('Espacio local insuficiente: exporta un respaldo desde Configuración.');
  else actionToast(state.saved.has(item.id)?'Guardada en tu biblioteca local.':'Quitada de guardadas.');
}
function unread(ids){
  const sourceIds=new Set(ids);
  return state.items.reduce((acc,item)=>acc+Number(!state.read.has(item.id)&&(item.source_ids||[]).some(id=>sourceIds.has(id)&&!state.hiddenSources.has(id))),0);
}
const oldBuildNav=buildNav;
buildNav=function(){
  oldBuildNav();
  const buttons=[
    ...$('categoryNav').querySelectorAll(':scope > .nav-link'),
    ...$('libraryFolderNav').querySelectorAll('.system-folder-link')
  ];
  buttons.forEach((button,index)=>{
    if(index===0)return;
    const ids=index===1
      ? state.sources.filter(s=>!state.hiddenSources.has(s.id)).map(s=>s.id)
      : state.sources.filter(s=>s.category===state.categories[index-2]&&!state.hiddenSources.has(s.id)).map(s=>s.id);
    const count=unread(ids);
    const label=button.querySelector('.nav-count');if(label)label.textContent=String(count);
    button.title=count+' sin leer · '+ids.length+' fuentes';
  });
  equipDefaults();
  renderFolderNav();
  // Reutilizar los gestos de las carpetas sin transformar el botón general
  // en una carpeta editable (ni ocultar ninguna carpeta OPML).
  const allButton=$('categoryNav').querySelectorAll(':scope > .nav-link')[1];
  if(allButton)equipFolder(allButton,allButton,'all','all');
};
function renderFolderNav(){
  const nav=$('libraryFolderNav');
  // Actualiza solo las carpetas manuales; las del catálogo permanecen intactas.
  nav.querySelectorAll('.library-folder-row').forEach(row=>row.remove());
  const entries=Object.entries(folders);
  entries.forEach(([name,ids])=>{
    const wrapper=mk('div','library-folder-row');
    const b=mk('button','nav-link'+(activeFolder===name?' active':''));
    b.type='button';b.setAttribute('aria-current',activeFolder===name?'page':'false');
    const icon=mk('span','nav-glyph');icon.append(svgIcon('folder'));
    const left=mk('span','nav-left');left.append(icon,mk('span','nav-label',name));
    b.append(left,mk('span','nav-count',String(unread(ids))));
    b.title=ids.length+' fuentes · '+unread(ids)+' sin leer';
    b.addEventListener('click',()=>{window.location.hash='#carpeta/'+encodeURIComponent(name);});
    wrapper.append(b);equipFolder(wrapper,b,'manual',name);nav.append(wrapper);
  });
}
function createFolder(){openFolderEditor('manual',null,true);}
function showSourceDetails(source){
 let dialog=document.getElementById('librarySourceDetailsDialog');
 if(!dialog){
  dialog=mk('dialog','library-source-details-dialog');
  dialog.id='librarySourceDetailsDialog';
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  document.body.append(dialog);
 }
 dialog.replaceChildren();
 const heading=mk('h2','',sourceLabel(source.name));
 const description=mk('p','', 'Información del catálogo público de Radar RSS.');
 const close=mk('button','settings-secondary','Cerrar');close.type='button';close.addEventListener('click',()=>dialog.close());
 const entries=[['Nombre en catálogo',source.name],['Categoría original',categoryLabel(source.category)],['Carpeta asignada',Object.entries(folders).find(([,ids])=>ids.includes(source.id))?.[0]||state.categories.filter(id=>folderSources('default',id).includes(source.id)).map(categoryLabel).join(', ')||'Sin carpeta'],['Identificador',source.id],['Dirección RSS',source.url],['Sitio del medio',source.website]];
 const dl=mk('dl','library-source-details-list');
 for(const [label,value] of entries){
  const dt=mk('dt','',label),dd=mk('dd');
  if((label==='Dirección RSS'||label==='Sitio del medio')&&safeURL(value)){
   const link=mk('a','',value);link.href=safeURL(value);link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';dd.append(link);
   const copy=mk('button','library-source-copy','Copiar');copy.type='button';copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(value);actionToast('Dirección copiada.');}
    catch{actionToast('No se pudo copiar la dirección.');}
   });dd.append(copy);
  }else dd.textContent=value||'No disponible en el catálogo';
  dl.append(dt,dd);
 }
 dialog.append(heading,description,dl,close);
 dialog.showModal();close.focus();
}
function decorateSources(){
 const list=$('settingsSources');
 for(const label of [...list.querySelectorAll('.settings-source-row')]){
  if(label.closest('.library-source-row'))continue;
  const name=label.querySelector('.settings-source-name')?.textContent?.trim()||'';
  const cat=label.querySelector('small')?.textContent?.trim()||'';
  const source=state.sources.find(s=>sourceLabel(s.name)===name&&categoryLabel(s.category)===cat);
  if(!source)continue;
  const wrapper=mk('div','library-source-row'),select=mk('select','library-source-folder');
  select.setAttribute('aria-label','Mover '+name+' a otra carpeta');
  select.title='Mover a una carpeta de este navegador';
  for(const id of state.categories)select.append(new Option(categoryLabel(id),'default:'+id));
  for(const folder of Object.keys(folders))select.append(new Option(folder,'manual:'+folder));
  const currentManual=Object.entries(folders).find(([,ids])=>ids.includes(source.id))?.[0];
  const currentDefault=state.categories.find(id=>folderSources('default',id).includes(source.id));
  select.value=currentManual?'manual:'+currentManual:'default:'+(currentDefault||source.category);
  select.addEventListener('change',()=>{
   const target=select.value;
   if(!target.startsWith('default:')&&!target.startsWith('manual:'))return;
   const oldFolders=JSON.stringify(folders),oldDefaults=JSON.stringify(defaults);
   for(const id of state.categories){
    const old=defaults[id]||{};
    defaults[id]={...old,sources:folderSources('default',id).filter(x=>x!==source.id)};
   }
   for(const ids of Object.values(folders)){
    const pos=ids.indexOf(source.id);if(pos>=0)ids.splice(pos,1);
   }
   if(target.startsWith('default:')){
    const id=target.slice(8);
    if(!state.categories.includes(id))return;
    defaults[id].sources.push(source.id);
   }else{
    const name=target.slice(7);
    if(!Object.prototype.hasOwnProperty.call(folders,name))return;
    folders[name].push(source.id);
   }
   if(!saveDefaults()||!write(FOLDER_KEY,folders)){
    defaults=JSON.parse(oldDefaults);folders=readFolders(JSON.parse(oldFolders));
    saveDefaults();write(FOLDER_KEY,folders);
    actionToast('No se pudo guardar el cambio de carpeta.');
    return;
   }
   buildNav();renderSettingsSources();render();
   actionToast('Fuente movida a la carpeta seleccionada.');
  });
  const checkbox=label.querySelector('input[type="checkbox"]');
  const details=label.querySelector('.settings-source-details');
  const open=mk('button','library-source-details-trigger');open.type='button';
  open.setAttribute('aria-label','Ver detalles de '+name);open.title='Ver nombre, RSS, web y carpeta';
  if(details)open.append(details);
  open.addEventListener('click',()=>showSourceDetails(source));
  label.replaceWith(wrapper);
  if(checkbox){label.replaceChildren(checkbox);label.classList.add('library-source-check');wrapper.append(label);}
  wrapper.append(open,select);
 }
}
const oldSources=renderSettingsSources;
renderSettingsSources=function(){oldSources();decorateSources();};
const oldNavigate=navigateFromHash;
navigateFromHash=function(){
  const hash=decodeURIComponent(window.location.hash.slice(1));
  activeFolder=hash.startsWith('carpeta/')&&Object.prototype.hasOwnProperty.call(folders,hash.slice(8))?hash.slice(8):null;
  if(activeFolder)state.mode='all';
  oldNavigate();
  if(!activeFolder&&state.pageView==='feed'&&state.category!=='all'){
    const name=folderName('default',state.category);
    $('topbarSection').textContent=name;$('feedHeading').textContent=name;
    $('sectionEyebrow').textContent='CARPETA DE FUENTES';
    $('feedDescription').textContent='Noticias agrupadas de las fuentes de esta carpeta.';
  }
  if(activeFolder){
    $('topbarSection').textContent=activeFolder;
    $('feedHeading').textContent=activeFolder;
    $('feedDescription').textContent='Noticias de los medios que agrupaste en esta carpeta.';
    $('sectionEyebrow').textContent='CARPETA DE FUENTES';
  }
  buildNav();
};
const oldFillSelect=fillSelect;
fillSelect=function(){
  oldFillSelect();
  if(!activeFolder&&state.category!=='all'){
    const ids=new Set(folderSources('default',state.category)),sel=$('sourceSelect'),current=state.feed;
    sel.replaceChildren(new Option('Todas las fuentes',''));
    state.sources.filter(s=>ids.has(s.id)&&!state.hiddenSources.has(s.id))
      .sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(s=>sel.append(new Option(s.name,s.id)));
    sel.value=current&&[...sel.options].some(o=>o.value===current)?current:'';
    state.feed=sel.value;
  }
  if(activeFolder){
    for(const option of [...$('sourceSelect').options].slice(1)){
      if(!folders[activeFolder]?.includes(option.value))option.remove();
    }
    if($('sourceSelect').value&&!folders[activeFolder]?.includes($('sourceSelect').value)){
      $('sourceSelect').value='';state.feed='';
    }
  }
};
const oldApplyFilters=applyFilters;
applyFilters=function(mode=state.mode){
  // Same filter semantics, with archived saved items, tags, and source folders.
  const blocked=state.mutedKeywords.split(',').map(x=>stripAccents(x.trim())).filter(x=>x.length>1).slice(0,30);
  const query=stripAccents(state.search.trim());
  const input=mode==='saved'?savedNews():state.items;
  const filtered=input.filter(item=>{
    if(state.category!=='all'&&!(item.source_ids||[]).some(id=>folderSources('default',state.category).includes(id)))return false;
    if(mode!=='saved'&&!(item.source_ids||[]).some(id=>!state.hiddenSources.has(id)))return false;
    if(activeFolder&&!(item.source_ids||[]).some(id=>(folders[activeFolder]||[]).includes(id)))return false;
    if(state.feed&&!(item.source_ids||[]).includes(state.feed))return false;
    if(state.maxAge&&mode!=='saved'){
      const t=new Date(item.published_at).getTime();
      if(!Number.isFinite(t)||(Date.now()-t)>state.maxAge*86400000)return false;
    }
    if(mode==='saved'&&!state.saved.has(item.id))return false;
    if(mode==='unread'&&state.read.has(item.id))return false;
    if(state.hideRead&&mode!=='saved'&&state.read.has(item.id))return false;
    if(activeTag&&!(tags[item.id]||[]).includes(activeTag))return false;
    const text=stripAccents([item.title,item.summary,item.publisher,item.source,...(tags[item.id]||[])].join(' '));
    return(!query||text.includes(query))&&!blocked.some(w=>text.includes(w));
  });
  if(state.sort==='oldest')filtered.sort((a,b)=>new Date(a.published_at||a.first_seen_at||0)-new Date(b.published_at||b.first_seen_at||0));
  else if(state.sort==='source')filtered.sort((a,b)=>String(a.publisher||a.source||'').localeCompare(String(b.publisher||b.source||''),'es'));
  return filtered;
};
const oldDashboard=renderDashboard;
renderDashboard=function(){
  oldDashboard();
  const panel=$('dashboardSavedPanel'),list=$('dashboardSavedList');
  const items=savedNews().sort((a,b)=>new Date(b.published_at||b.first_seen_at||0)-new Date(a.published_at||a.first_seen_at||0)).slice(0,4);
  panel.hidden=!items.length;
  list.replaceChildren(...items.map(item=>{
    const row=mk('div','dashboard-saved-item'),body=mk('div','dashboard-saved-content');
    const cover=mk('a','dashboard-saved-cover');cover.href=safeURL(item.url)||'#';cover.target='_blank';cover.rel='noopener noreferrer external';
    cover.addEventListener('click',e=>openArticleReader(item,e));
    if(safeURL(item.image)){const image=mk('img');image.loading='lazy';image.src=item.image;image.alt='';image.referrerPolicy='no-referrer';cover.append(image);}
    else cover.append(svgIcon('bookmark'));
    const a=link(item.url,item.title||'Sin título','dashboard-saved-title');a.addEventListener('click',e=>openArticleReader(item,e));
    body.append(a,mk('span','dashboard-saved-meta',sourceLabel(item.publisher||item.source)));row.append(cover,body);return row;
  }));
};
const oldCard=card;
card=function(item){
  const el=oldCard(item);
  const prev=el.querySelector('.article-save');
  if(prev){
    const replacement=prev.cloneNode(true);
    prev.replaceWith(replacement);
    replacement.addEventListener('click',()=>toggleBookmark(item));
  }
  return el;
};
const oldRead=markRead;
markRead=function(...args){oldRead(...args);updateUnreadCounts();};
function updateUnreadCounts(){
  const buttons=[
    ...$('categoryNav').querySelectorAll(':scope > .nav-link'),
    ...$('libraryFolderNav').querySelectorAll('.system-folder-link')
  ];
  buttons.forEach((btn,i)=>{
    if(i===0)return;
    const ids=i===1?state.sources.map(s=>s.id):state.sources.filter(s=>s.category===state.categories[i-2]).map(s=>s.id);
    const n=unread(ids);const count=btn.querySelector('.nav-count');
    const total=i>=2?unread(folderSources('default',state.categories[i-2])):n;
    if(count)count.textContent=String(total);
    btn.title=total+' noticias sin leer';
  });
  renderFolderNav();
}
const oldRender=render;
render=function(){
  syncArchive();
  oldRender();
  refreshTagFilter();
  updateUnreadCounts();
};
const oldOpen=openArticleReader;
openArticleReader=function(item,e,...rest){
  oldOpen(item,e,...rest);
  if(e&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0))return;
  $('libraryTagInput').value='';
  renderTags();
};
function allTags(){return [...new Set(Object.values(tags).flat())].sort((a,b)=>a.localeCompare(b,'es'));}
function refreshTagFilter(){
  const select=$('libraryTagFilter'),names=allTags();
  select.replaceChildren(new Option('Todas las etiquetas',''),...names.map(x=>new Option(x,x)));
  if(activeTag&&!names.includes(activeTag))activeTag='';
  select.value=activeTag;
}
function renderTags(){
  const el=$('libraryReaderTags');el.replaceChildren();
  if(!activeReaderItem)return;
  for(const name of (tags[activeReaderItem.id]||[])){
    const b=mk('button','library-tag-chip',name+' ×');b.type='button';b.title='Eliminar etiqueta '+name;
    b.addEventListener('click',()=>{
      const remaining=(tags[activeReaderItem.id]||[]).filter(x=>x!==name);
      if(remaining.length)tags[activeReaderItem.id]=remaining;else delete tags[activeReaderItem.id];
      write(TAG_KEY,tags);renderTags();refreshTagFilter();render();
    });
    el.append(b);
  }
}
function addTag(){
  if(!activeReaderItem)return;
  const input=$('libraryTagInput');
  const name=input.value.trim().replace(/\s+/g,' ').slice(0,30);
  if(!name)return;
  const current=tags[activeReaderItem.id]||[];
  if(current.some(x=>x.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))return;
  if(current.length>=8){actionToast('Máximo 8 etiquetas por noticia.');return;}
  tags[activeReaderItem.id]=[...current,name];
  if(!write(TAG_KEY,tags))actionToast('No se pudieron guardar las etiquetas.');
  input.value='';renderTags();refreshTagFilter();render();
}
function mount(){
  installFolderUI();
  const foldersSection=mk('section','source-folders-section');
  foldersSection.setAttribute('aria-labelledby','sourceFoldersHeading');
  const header=mk('div','folder-group-head');
  const heading=mk('span','','CARPETAS DE FUENTES');
  heading.id='sourceFoldersHeading';header.append(heading);
  const add=mk('button');add.type='button';add.title='Crear carpeta de fuentes';add.setAttribute('aria-label','Crear carpeta de fuentes');
  add.append(svgIcon('folder-plus'));header.append(add);
  const restore=mk('button','folder-restore');restore.id='folderRestore';
  restore.type='button';restore.hidden=true;restore.title='Restaurar carpetas ocultas';
  restore.setAttribute('aria-label','Restaurar carpetas ocultas');
  restore.append(svgIcon('rotate-ccw'));header.insertBefore(restore,add);
  restore.addEventListener('click',()=>{
    for(const id of state.categories)if(defaults[id]?.hidden)defaults[id].hidden=false;
    if(!saveDefaults())return actionToast('No se pudieron restaurar.');
    buildNav();render();
  });
  const nav=mk('nav','library-folder-nav library-system-folders');
  nav.id='libraryFolderNav';
  nav.setAttribute('aria-label','Carpetas de fuentes del catálogo y creadas por ti');
  foldersSection.append(header,nav);
  $('categoryNav').after(foldersSection);
  add.addEventListener('click',createFolder);
  const wrapper=mk('label','library-tag-filter-wrap'),filter=mk('select','library-tag-filter');
  filter.id='libraryTagFilter';filter.setAttribute('aria-label','Filtrar por etiqueta');wrapper.append(filter);
  $('sourceSelect').closest('label').after(wrapper);
  filter.addEventListener('change',()=>{activeTag=filter.value;state.page=1;render();});
  const section=mk('section','reader-organize');
  section.append(mk('strong','','Etiquetas personales'));
  const inputRow=mk('div','reader-tag-create');const input=mk('input');input.id='libraryTagInput';input.type='text';input.maxLength=30;input.placeholder='Ej.: Investigación';input.setAttribute('aria-label','Nueva etiqueta');
  const btn=mk('button','','Añadir');btn.type='button';inputRow.append(input,btn);section.append(inputRow);
  const names=mk('div','reader-tags');names.id='libraryReaderTags';section.append(names);
  section.append(mk('p','','Etiquetas disponibles en este navegador. Para conservar el artículo fuera del RSS, utiliza Guardar.'));
  $('readerNote').after(section);
  btn.addEventListener('click',addTag);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTag();}});
  const sourcePane=document.querySelector('[data-settings-pane="sources"]');
  const group=mk('div','folder-settings');
  group.append(mk('span','','Organiza tus fuentes en carpetas personales.'));
  const folderButton=mk('button','settings-secondary','Crear carpeta');folderButton.type='button';group.append(folderButton);
  sourcePane.querySelector('.setting-hint').after(group);folderButton.addEventListener('click',createFolder);
  // El buscador original conserva una referencia directa a renderSettingsSources.
  // Decorar después del render sin perder la escucha de búsqueda existente.
  $('settingsSourceSearch').addEventListener('input',()=>queueMicrotask(decorateSources));
  $('readerSave').addEventListener('click',e=>{
    if(!activeReaderItem)return;
    e.preventDefault();e.stopImmediatePropagation();
    toggleBookmark(activeReaderItem);syncReaderActions();
  },true);
  $('clearSaved').addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(!confirm('¿Vaciar las noticias guardadas y sus copias locales?'))return;
    state.saved.clear();archive.clear();saveArchive();persist('radar-saved',state.saved);render();updateDataCounts();$('dataNotice').textContent='Guardadas vaciadas.';
  },true);
  $('exportData').addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();syncArchive();
    const obj={format:'radar-rss-settings-v3',exported_at:new Date().toISOString(),
      preferences:{theme:state.theme,layout:state.layout,columns:state.columns,density:state.density,pageSize:state.pageSize,maxAge:state.maxAge,fontSize:state.fontSize,showHero:state.showHero,showImages:state.showImages,showSummaries:state.showSummaries,hideRead:state.hideRead,newTab:state.newTab,sort:state.sort,startMode:state.startMode,mutedKeywords:state.mutedKeywords,sidebarWidth:Number(localStorage.getItem('radar-sidebar-width'))||310},
      saved:[...state.saved],read:[...state.read],hiddenSources:[...state.hiddenSources],
      savedArchive:[...archive.values()],sourceFolders:folders,folderDefaults:defaults,articleTags:tags};
    downloadText('radar-rss-respaldo-completo.json',JSON.stringify(obj,null,2),'application/json;charset=utf-8');
    $('dataNotice').textContent='Respaldo completo generado con guardadas, etiquetas y carpetas.';
  },true);
  $('importData').addEventListener('change',async e=>{
    e.stopImmediatePropagation();
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(file.size>5_000_000){$('dataNotice').textContent='Respaldo mayor de 5 MB.';return;}
    try{
      const d=JSON.parse(await file.text());
      if(!['radar-rss-settings-v2','radar-rss-settings-v3'].includes(d.format)||!d.preferences)throw Error('Formato incompatible');
      const p=d.preferences,choose=(key,options,def)=>options.includes(p[key])?p[key]:def;
      state.theme=choose('theme',['system','light','dark'],'system');
      state.layout=choose('layout',['cards','list'],'cards');
      state.columns=choose('columns',['auto','2','3','4','5','6'],'auto');
      state.density=choose('density',['comfortable','compact'],'comfortable');
      state.pageSize=choose('pageSize',[12,24,36,60],36);
      state.maxAge=choose('maxAge',[0,1,7,30,90],0);
      state.fontSize=choose('fontSize',['normal','large'],'normal');
      for(const key of ['showHero','showImages','showSummaries','hideRead','newTab'])if(typeof p[key]==='boolean')state[key]=p[key];
      state.sort=choose('sort',['newest','oldest','source'],'newest');
      state.startMode=choose('startMode',['all','unread','saved'],'all');
      state.mutedKeywords=typeof p.mutedKeywords==='string'?p.mutedKeywords.slice(0,600):'';
      const known=new Set(state.sources.map(s=>s.id));
      state.saved=new Set((Array.isArray(d.saved)?d.saved:[]).filter(x=>typeof x==='string'&&x.length<150).slice(-4000));
      state.read=new Set((Array.isArray(d.read)?d.read:[]).filter(x=>typeof x==='string'&&x.length<150).slice(-4000));
      state.hiddenSources=new Set((Array.isArray(d.hiddenSources)?d.hiddenSources:[]).filter(x=>known.has(x)));
      persist('radar-saved',state.saved);persist('radar-read',state.read);persist('radar-hidden-sources',state.hiddenSources);
      archive=new Map((Array.isArray(d.savedArchive)?d.savedArchive:[]).slice(-LIMIT).map(snapshot).filter(Boolean).filter(x=>state.saved.has(x.id)).map(x=>[x.id,x]));
      folders=readFolders(d.sourceFolders);defaults=(d.folderDefaults&&typeof d.folderDefaults==='object'&&!Array.isArray(d.folderDefaults))?d.folderDefaults:Object.create(null);tags=readTags(d.articleTags);
      saveArchive();write(FOLDER_KEY,folders);saveDefaults();write(TAG_KEY,tags);syncArchive();
      if(Number.isFinite(Number(p.sidebarWidth))&&Number(p.sidebarWidth)>=240&&Number(p.sidebarWidth)<=480){
        try{localStorage.setItem('radar-sidebar-width',String(Math.round(Number(p.sidebarWidth))));}catch{}
        window.dispatchEvent(new Event('radar-sidebar-pref-sync'));
      }
      for(const [key,value] of [['layout',state.layout],['columns',state.columns],['theme',state.theme],['density',state.density],['font',state.fontSize],['page-size',state.pageSize],['max-age',state.maxAge],['show-hero',state.showHero],['show-images',state.showImages],['show-summaries',state.showSummaries],['hide-read',state.hideRead],['new-tab',state.newTab],['sort',state.sort],['start-mode',state.startMode],['keywords',state.mutedKeywords]])savePref(key,value);
      state.mode=state.startMode;state.page=1;
      setTheme(state.theme,true);applyDisplaySettings();refreshFeedUI();syncSettings();selectedTab('data');
      $('dataNotice').textContent='Respaldo importado correctamente.';
    }catch(err){console.warn('Importación Radar RSS',err);$('dataNotice').textContent='Archivo inválido o incompatible.';}
  },true);
  refreshTagFilter();renderFolderNav();
}
// UI is ready: deferred script executes after DOM is parsed, before boot resolves.
mount();
})();