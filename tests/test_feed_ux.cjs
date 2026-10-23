'use strict';
// Execute the real enhancement in a small DOM; exercise outcomes and existing nodes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes={};this.dataset={};this.listeners={};this.hidden=false;this.open=false;this.value='';this._text='';this.className='';}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set textContent(value){this._text=String(value);this.children.forEach(x=>x.parentNode=null);this.children=[];}
  get classList(){return {contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...cs])].join(' ');},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle:(c,on)=>{if(on===undefined)on=!this.classList.contains(c);if(on)this.classList.add(c);else this.classList.remove(c);return on;}};}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  insertBefore(node,before){if(!before)return this.append(node);node.remove();const i=this.children.indexOf(before);assert.ok(i>=0);node.parentNode=this;this.children.splice(i,0,node);}
  after(node){this.parentNode.insertBefore(node,this.parentNode.children[this.parentNode.children.indexOf(this)+1]);}
  before(node){this.parentNode.insertBefore(node,this);}
  remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
  replaceChildren(...nodes){this.textContent='';this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  addEventListener(name,handler){(this.listeners[name]??=[]).push(handler);}
  dispatch(name,event={}){for(const fn of this.listeners[name]||[])fn({target:this,preventDefault(){},stopPropagation(){},...event});}
  click(){this.dispatch('click');}
  focus(){document.activeElement=this;}
  scrollIntoView(){}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));return this.tagName.toLowerCase()===selector;}
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector);}
  querySelectorAll(selector){const selectors=selector.split(',').map(x=>x.trim());return this.children.flatMap(node=>[...(selectors.some(s=>node.matches(s))?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
}
const body=new Element('body');
const document={body,activeElement:null,createElement:tag=>new Element(tag),getElementById:id=>body.querySelector('#'+id),querySelector:selector=>body.querySelector(selector),addEventListener(){}};
const node=(tag,id,cls,text='')=>{const el=new Element(tag);el.id=id;el.className=cls||'';el.textContent=text;return el;};
const feed=node('section','feedView');body.append(feed);
const bar=node('div',null,'filter-bar'),controls=node('div',null,'filter-controls');bar.append(controls);feed.append(bar);
const source=node('label',null,'source-filter'),sourceSelect=node('select','sourceSelect');source.append(sourceSelect);
const tag=node('label',null,'library-tag-filter-wrap'),tagSelect=node('select','libraryTagFilter');tag.append(tagSelect);
const display=node('div',null,'display-controls');
const advanced=node('details','feedAdvanced','feed-advanced'),advancedContent=node('div',null,'feed-advanced-content');advanced.append(node('summary',null,null,'Más opciones'),advancedContent);
advancedContent.append(node('select','v12Date'),node('button','v12SaveSearch'),node('button','markAllVisible'));
controls.append(source,tag,display,advanced);
const grid=node('div','articleGrid'),search=node('input','searchInput'),contextNode=node('div','feedContext');
const onlyNew=node('span','onlyNewChip'),followTopic=node('button','followTopic');followTopic.hidden=true;contextNode.append(onlyNew,followTopic);
feed.append(grid,contextNode);body.append(search);
const settings=node('dialog','settingsDialog');settings.showModal=()=>{settings.open=true;};
for(const id of ['settingAge','settingHideRead','settingKeywords','settingsSourceSearch'])settings.append(node('input',id));body.append(settings);
const windowListeners={};
const window={innerWidth:1440,addEventListener(name,fn,options){(windowListeners[name]??=[]).push({fn,once:options?.once});},emit(name,event={}){const list=(windowListeners[name]||[]).slice();windowListeners[name]=(windowListeners[name]||[]).filter(x=>!x.once);list.forEach(x=>x.fn(event));}};
const state={pageView:'feed',category:'all',feed:'',search:'',maxAge:0,mode:'all',hideRead:false,mutedKeywords:'',hiddenSources:new Set(),onlyNew:false,page:1,sources:[{id:'s1',name:'Medio Uno'}],items:[{id:'a'}],saved:new Set(),historyLoading:false};
let privateFolder=null,privateTag='',geo='all',settingsTab='',renderCount=0;
const prefWrites=[];
window.RadarLibrary={getFeedFilters:()=>({folder:privateFolder,tag:privateTag}),clearTagFilter(){privateTag='';tagSelect.value='';}};
window.RadarV12={getFeedGeo:()=>({id:geo,label:'Latinoamérica'})};
const location={hash:'#noticias'};
const context={window,document,state,location,console,mk:(tag,cls,text)=>node(tag,null,cls,text),sourceLabel:x=>x,categoryLabel:x=>x,
  savePref:(k,v)=>prefWrites.push([k,v]),selectedTab:name=>{settingsTab=name;},
  syncSettings(){},goTo(){privateFolder=null;geo='all';state.category='all';state.feed='';location.hash='#noticias';context.render();window.emit('hashchange');},
  fillSelect(){sourceSelect.value=state.feed;},hasHistory:()=>false,
  emptyState:()=>node('div',null,'empty-state','Existing loading state'),
  render(){renderCount++;grid.replaceChildren(context.emptyState([]));},applyFilters:()=>[]};
const scriptPath=path.join(__dirname,'../web/feed-ux.js');
vm.runInNewContext(fs.existsSync(scriptPath)?fs.readFileSync(scriptPath,'utf8'):'',context,{filename:'feed-ux.js'});
const get=id=>document.getElementById(id);
const chip=name=>get('feedFilterChips')?.querySelectorAll('button').find(el=>el.dataset.filter===name);
const refresh=()=>context.render();
assert.ok(get('feedActiveFilters'),'active filters have a visible region');
assert.equal(get('feedActiveFilters').hidden,true,'no empty toolbar when nothing filters');
state.search='energía';state.feed='s1';state.maxAge=7;state.mode='unread';state.hideRead=true;
state.hiddenSources.add('s2');state.mutedKeywords='política';privateFolder={id:'Lectura',label:'Lectura',kind:'manual'};privateTag='Informe';
refresh();
assert.equal(get('feedActiveFilters').hidden,false);
for(const key of ['search','source','age','mode','folder','tag','hide-read','hidden-sources','keywords'])assert.ok(chip(key),'chip for '+key);
assert.match(chip('source').textContent,/Medio Uno/);
chip('source').click();assert.equal(state.feed,'');assert.equal(state.search,'energía');
chip('tag').click();assert.equal(privateTag,'');assert.equal(privateFolder.label,'Lectura');
chip('keywords').click();assert.equal(settingsTab,'reading');assert.equal(settings.open,true);assert.equal(document.activeElement,get('settingKeywords'));
assert.equal(state.mutedKeywords,'política','opening preferences never erases them');
state.feed='s1';privateTag='Informe';state.onlyNew=true;refresh();
get('feedClearFilters').click();
assert.equal(state.search,'');assert.equal(state.feed,'');assert.equal(state.maxAge,0);assert.equal(state.mode,'all');assert.equal(state.onlyNew,false);assert.equal(privateTag,'');assert.equal(privateFolder,null);
assert.equal(state.hideRead,true);assert.equal(state.mutedKeywords,'política');assert.equal(state.hiddenSources.has('s2'),true,'bulk reset preserves explicit global preferences');
assert.match(get('feedActiveFilters').textContent,/Conserva/);
assert.ok(prefWrites.some(([key,value])=>key==='max-age'&&value===0),'date setting is synchronized');
state.hideRead=false;state.mutedKeywords='';state.hiddenSources.clear();state.mode='saved';refresh();
assert.match(grid.textContent,/Aún no tienes noticias guardadas/);
assert.match(grid.textContent,/guardar/i);
assert.equal(grid.querySelectorAll('button')[0].textContent,'Ver todas las noticias');
state.mode='all';state.maxAge=7;refresh();
assert.match(grid.textContent,/Ampliar antigüedad/);grid.querySelectorAll('button')[0].click();assert.equal(state.maxAge,0);
state.search='sin coincidencia';privateFolder={id:'Lectura',label:'Lectura',kind:'manual'};state.feed='s1';location.hash='#carpeta/Lectura';refresh();
assert.match(grid.textContent,/Buscar en todas las secciones/);grid.querySelectorAll('button')[0].click();
assert.equal(privateFolder,null);assert.equal(state.search,'sin coincidencia');assert.equal(state.feed,'s1','broadening scope retains source selection');
// Existing listeners and node identities survive mobile placement and desktop restoration.
let sourceChanges=0;sourceSelect.addEventListener('change',()=>sourceChanges++);
window.innerWidth=390;window.emit('resize');
assert.equal(get('feedFiltersToggle').hidden,false);assert.equal(source.parentNode,get('feedFilterPanel'));assert.equal(tag.parentNode,get('feedFilterPanel'));assert.equal(advanced.parentNode,get('feedFilterPanel'));
assert.equal(get('feedFilterPanel').hidden,true);get('feedFiltersToggle').click();
assert.equal(get('feedFilterPanel').hidden,false);assert.equal(get('feedFiltersToggle').getAttribute('aria-expanded'),'true');assert.equal(advanced.open,true);
sourceSelect.dispatch('change');assert.equal(sourceChanges,1);
get('feedFilterPanel').dispatch('keydown',{key:'Escape'});assert.equal(get('feedFilterPanel').hidden,true);assert.equal(document.activeElement,get('feedFiltersToggle'));
window.innerWidth=1440;window.emit('resize');
assert.equal(source.parentNode,controls);assert.equal(tag.parentNode,controls);assert.equal(advanced.parentNode,controls);assert.deepEqual(controls.children.filter(el=>[source,tag,display,advanced].includes(el)),[source,tag,display,advanced]);
assert.equal(get('feedFiltersToggle').hidden,true);sourceSelect.dispatch('change');assert.equal(sourceChanges,2);
assert.ok(renderCount>0);
console.log('Feed UX verified: filter chips, scoped reset, contextual empty recovery, mobile controls and desktop restoration.');
