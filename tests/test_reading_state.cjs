"use strict";
// Exercise the actual app functions, replacing only browser/network boundaries
// and presentation functions unrelated to publication or reading state.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const source=app.slice(0,app.indexOf("document.body.classList.toggle('radar-hybrid',!IS_STYLE_PREVIEW);"));
const OLD='2026-10-20T10:00:00Z',NEXT='2026-10-21T10:00:00Z',NEWEST='2026-10-21T16:00:00Z';

function harness(){
  const elements=new Map(),storage=new Map(),timers=new Map(),calls=[],effects=[],warnings=[];
  let timerId=0,fetcher;
  function node(tag='div'){
    let text='';
    const classes=new Set();
    return {tagName:tag.toUpperCase(),hidden:false,disabled:false,isConnected:true,children:[],listeners:{},dataset:{},attributes:{},
      className:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(){}},
      get textContent(){return text+this.children.map(child=>child.textContent).join('');},
      set textContent(value){this.replaceChildren();text=String(value);},
      append(...children){for(const child of children){child.parentNode=this;child.isConnected=this.isConnected;}this.children.push(...children);},
      replaceChildren(...children){
        for(const child of this.children){
          if(child===document.activeElement)document.activeElement=document.body;
          child.parentNode=null;child.isConnected=false;
        }
        text='';this.children=[];this.append(...children);
      },
      addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},
      setAttribute(name,value){this.attributes[name]=String(value);},
      closest(){for(let current=this;current;current=current.parentNode)if(current.hidden||current.inert)return current;return null;},
      focus(options){this.focusOptions=options;document.activeElement=this;},
      click(){if(!this.disabled)for(const fn of this.listeners.click||[])fn({target:this});}
    };
  }
  const document={hidden:false,activeElement:null,
    getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},
    createElement:node,createElementNS:(_,tag)=>node(tag),querySelector:()=>null,querySelectorAll:()=>[]};
  document.body=node('body');
  const window={scrollY:640,matchMedia:()=>({matches:false}),
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    requestAnimationFrame:fn=>fn(),dispatchEvent:event=>effects.push(event)};
  const context=vm.createContext({document,window,location:{search:''},URL,URLSearchParams,Intl,Date,Set,Map,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
    console:{warn:(...args)=>warnings.push(args),error:(...args)=>warnings.push(args)},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    fetch:async url=>{
      const name=url.split('/').pop().split('?')[0];calls.push(name);
      const value=await fetcher(name);
      if(value instanceof Error)throw value;
      return {ok:true,json:async()=>value};
    },effects});
  vm.runInContext(source,context,{filename:'app.js'});
  vm.runInContext(`
    for(const name of ['buildNav','fillSelect','updateHeader','statusSummary','render']){
      globalThis[name]=()=>effects.push({type:name,generated:state.generated,meta:state.feedMeta,items:state.items,sources:state.sources,health:state.health});
    }
  `,context);
  const state=vm.runInContext('state',context);
  Object.assign(state,{ready:true,generated:OLD,feedMeta:{generated_at:OLD,archive_files:['archive-01.json']},
    sources:[{id:'old-source'}],categories:['old-category'],health:[{id:'old-source',state:'ok'}],
    items:[{id:'old'},{id:'history'}],historyLoaded:true,historyFailed:false,historyLoading:false,
    pageView:'feed',category:'old-category',feed:'old-source',mode:'unread',search:'texto',page:3});
  const input=node('input');input.value='texto';document.activeElement=input;
  const run=code=>vm.runInContext(code,context);
  return {state,elements,storage,timers,calls,effects,warnings,document,window,input,run,
    el:id=>document.getElementById(id),
    setFetch:fn=>{fetcher=fn;},
    expire(ms){for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}
  };
}
function publication(stamp=NEXT,items=[{id:'old'},{id:'new'}]){
  return {
    'meta.json':{generated_at:stamp,archive_files:['archive-02.json'],total_articles:items.length+1,latest_count:items.length},
    'sources.json':{sources:[{id:'new-source',name:'Nueva fuente',category:'new-category'}],categories:['new-category']},
    'latest.json':{generated_at:stamp,items},
    'status.json':{checked_at:stamp,feeds:[{id:'new-source',state:'ok'}]}
  };
}
function stableState(state){
  return JSON.stringify({items:state.items,sources:state.sources,categories:state.categories,health:state.health,
    generated:state.generated,feedMeta:state.feedMeta,historyLoaded:state.historyLoaded,historyFailed:state.historyFailed,
    historyLoading:state.historyLoading,pageView:state.pageView,category:state.category,feed:state.feed,
    mode:state.mode,search:state.search,page:state.page});
}

test('refresh leaves the current feed, loaded history, metadata, filters and position intact until Mostrar',async()=>{
  const h=harness(),docs=publication(),before=stableState(h.state),items=h.state.items;
  h.setFetch(name=>docs[name]);
  await h.run('refreshPublishedData()');
  assert.equal(stableState(h.state),before);
  assert.equal(h.state.items,items);
  assert.equal(h.effects.length,0,'no feed render or arrival animation before acceptance');
  assert.equal(h.el('publicationNotice').hidden,false);
  assert.match(h.el('publicationMessage').textContent,/Hay 1 noticia nueva/);
  assert.equal(h.window.scrollY,640);
  assert.equal(h.document.activeElement,h.input);
});

test('Mostrar applies one coherent snapshot, resets archive state and preserves an open reader and focus',async()=>{
  const h=harness(),docs=publication();
  h.el('articleReaderDialog').open=true;
  h.setFetch(name=>docs[name]);
  await h.run('refreshPublishedData()');
  h.run('applyPendingPublication()');
  assert.equal(h.state.generated,NEXT);
  assert.equal(h.state.feedMeta,docs['meta.json']);
  assert.equal(h.state.items,docs['latest.json'].items);
  assert.equal(h.state.sources,docs['sources.json'].sources);
  assert.equal(h.state.categories,docs['sources.json'].categories);
  assert.equal(h.state.health,docs['status.json'].feeds);
  assert.equal(h.state.historyLoaded,false);
  assert.equal(h.state.historyFailed,false);
  assert.equal(h.el('publicationNotice').hidden,true);
  const renders=h.effects.filter(event=>event.type==='render');
  assert.equal(renders.length,1);
  assert.equal(renders[0].generated,NEXT);
  assert.equal(renders[0].items,docs['latest.json'].items);
  assert.equal(renders[0].meta,docs['meta.json']);
  assert.equal(h.effects.filter(event=>event.type==='radar:news-added').length,1);
  assert.equal(h.el('articleReaderDialog').open,true);
  assert.equal(h.document.activeElement,h.input);
  h.run('applyPendingPublication()');
  assert.equal(h.effects.filter(event=>event.type==='render').length,1,'acceptance is idempotent');
});

test('rechecking the same pending generation downloads metadata only and zero new IDs has an update notice',async()=>{
  const h=harness(),docs=publication(NEXT,[{id:'old'}]);
  h.setFetch(name=>docs[name]);
  await h.run('refreshPublishedData()');
  await h.run('refreshPublishedData()');
  assert.deepEqual(h.calls,['meta.json','sources.json','latest.json','status.json','meta.json']);
  assert.match(h.el('publicationMessage').textContent,/actualización/i);
  assert.equal(h.state.generated,OLD);
});

test('failed or incompatible newer downloads keep both the visible feed and a valid pending publication',async()=>{
  for(const problem of ['network','latest-generation','status-generation','malformed-items','malformed-sources','source-name','article-sources']){
    const h=harness(),first=publication(),before=stableState(h.state);
    h.setFetch(name=>first[name]);
    await h.run('refreshPublishedData()');
    const notice=h.el('publicationMessage').textContent;
    const newer=publication(NEWEST,[{id:'newer'}]);
    if(problem==='latest-generation')newer['latest.json'].generated_at=OLD;
    if(problem==='status-generation')newer['status.json'].checked_at=OLD;
    if(problem==='malformed-items')newer['latest.json'].items=[null];
    if(problem==='malformed-sources')newer['sources.json'].sources=null;
    if(problem==='source-name')delete newer['sources.json'].sources[0].name;
    if(problem==='article-sources')newer['latest.json'].items[0].source_ids='invalid';
    h.setFetch(name=>problem==='network'&&name==='latest.json'?new Error('offline'):newer[name]);
    await h.run('refreshPublishedData()');
    assert.equal(stableState(h.state),before,problem);
    assert.equal(h.el('publicationMessage').textContent,notice,problem);
    h.run('applyPendingPublication()');
    assert.equal(h.state.generated,NEXT,problem);
    assert.equal(h.state.items,first['latest.json'].items,problem);
  }
});

test('a newer valid pending publication replaces the notice and counts against the visible feed',async()=>{
  const h=harness();
  let docs=publication();h.setFetch(name=>docs[name]);
  await h.run('refreshPublishedData()');
  docs=publication(NEWEST,[{id:'new'},{id:'other'},{id:'old'}]);
  await h.run('refreshPublishedData()');
  assert.match(h.el('publicationMessage').textContent,/Hay 2 noticias nuevas/);
  h.run('applyPendingPublication()');
  assert.equal(h.state.generated,NEWEST);
});

test('older cached metadata cannot replace a newer pending publication or downgrade the visible feed',async()=>{
  const h=harness();let docs=publication(NEWEST);
  h.setFetch(name=>docs[name]);
  await h.run('refreshPublishedData()');
  docs=publication(NEXT,[{id:'older-pending'}]);
  await h.run('refreshPublishedData()');
  assert.equal(h.calls.length,5,'older metadata needs no payload downloads');
  h.run('applyPendingPublication()');
  assert.equal(h.state.generated,NEWEST);
  await h.run('refreshPublishedData()');
  assert.equal(h.calls.length,6,'an older generation cannot replace the visible publication either');
  assert.equal(h.el('publicationNotice').hidden,true);
});

test('bulk read counts only changed IDs and undo preserves prior and concurrent reading actions',()=>{
  const h=harness();h.state.read.add('prior');
  const count=h.run("markArticlesRead([{id:'prior'},{id:'a'},{id:'b'},{id:'a'}])");
  assert.equal(count,2);
  assert.match(h.el('actionToast').textContent,/2 noticias/);
  const undo=h.el('actionToast').children.find(child=>child.className==='toast-undo');
  assert(undo,'undo button is visible');
  assert.equal(undo.textContent,'Deshacer');
  assert([...h.timers.values()].some(timer=>timer.ms===8000));
  h.run("markRead('concurrent',true);markRead('b',false);markRead('b',true)");
  undo.click();
  assert.deepEqual([...h.state.read].sort(),['b','concurrent','prior']);
  assert.deepEqual(JSON.parse(h.storage.get('radar-read')).sort(),['b','concurrent','prior']);
  assert.equal(h.document.activeElement,h.input,'bulk changes and undo never move focus from an input');
});

test('keyboard Undo returns focus to the connected enabled bulk action after its button is removed',()=>{
  const h=harness(),origin=h.el('markAllVisible');
  origin.focus();
  h.run("markArticlesRead([{id:'a'}])");
  const undo=h.el('actionToast').children.find(child=>child.className==='toast-undo');
  undo.focus();undo.click();
  assert.equal(undo.isConnected,false,'the confirmation removes the focused Undo button');
  assert.equal(h.document.activeElement,origin,'focus returns to the original bulk control');
  assert.equal(origin.focusOptions.preventScroll,true);
});

test('Undo focus restoration respects inputs, open dialogs and origins no longer usable',()=>{
  for(const condition of ['input','dialog','detached','disabled','hidden','hidden-parent','render-focus']){
    const h=harness(),origin=h.el('markAllVisible');
    origin.focus();h.run("markArticlesRead([{id:'a'}])");
    const undo=h.el('actionToast').children.find(child=>child.className==='toast-undo');
    undo.focus();
    if(condition==='input')h.input.focus();
    if(condition==='dialog')h.document.querySelector=()=>({open:true});
    if(condition==='detached')origin.isConnected=false;
    if(condition==='disabled')origin.disabled=true;
    if(condition==='hidden')origin.hidden=true;
    if(condition==='hidden-parent')origin.parentNode={hidden:true};
    if(condition==='render-focus')h.run("render=()=>document.getElementById('otherInput').focus()");
    undo.click();
    assert.notEqual(h.document.activeElement,origin,condition);
    if(condition==='input')assert.equal(h.document.activeElement,h.input,condition);
    if(condition==='render-focus')assert.equal(h.document.activeElement,h.el('otherInput'),condition);
  }
});

test('undo expires after eight seconds, a new toast replaces it and plain string toasts still work',()=>{
  const h=harness();
  h.run("markArticlesRead([{id:'a'}])");
  const undo=h.el('actionToast').children.find(child=>child.className==='toast-undo');
  h.expire(8000);undo.click();
  assert(h.state.read.has('a'));
  assert.equal(h.el('actionToast').hidden,true);
  h.run("markArticlesRead([{id:'b'}])");
  const superseded=h.el('actionToast').children.find(child=>child.className==='toast-undo');
  h.run("actionToast('Enlace copiado.')");
  superseded.click();assert(h.state.read.has('b'));
  assert.equal(h.el('actionToast').textContent,'Enlace copiado.');
  assert.equal(h.el('actionToast').hidden,false);
  h.expire(3200);assert.equal(h.el('actionToast').hidden,true);
  assert.equal(h.run("markArticlesRead([{id:'a'},{id:'b'}])"),0);
  assert.match(h.el('actionToast').textContent,/No había noticias pendientes/);
});

test('undo cannot remove reading marks from a backup imported after the batch',()=>{
  const h=harness();
  h.run("markArticlesRead([{id:'a'}])");
  const undo=h.el('actionToast').children.find(child=>child.className==='toast-undo');
  h.state.read=new Set(['a','imported']);
  h.storage.set('radar-read',JSON.stringify([...h.state.read]));
  undo.click();
  assert.deepEqual([...h.state.read],['a','imported']);
  assert.deepEqual(JSON.parse(h.storage.get('radar-read')),['a','imported']);
});

test('history completion restores normal enabled pagination and history failure preserves the feed',async()=>{
  for(const fail of [false,true]){
    const h=harness(),before=h.state.items;
    h.state.historyLoaded=false;
    h.setFetch(()=>fail?new Error('offline'):{generated_at:OLD,items:[{id:'older'}]});
    const request=h.run('loadHistory()');
    assert.equal(h.el('loadMore').disabled,true);
    assert.equal(h.el('loadMore').textContent,'Cargando historial…');
    await request;
    h.run('updateHistoryButton()');
    assert.equal(h.el('loadMore').disabled,false);
    assert.equal(h.el('loadMore').textContent,fail?'Cargar noticias anteriores':'Cargar más noticias');
    assert.equal(h.state.historyLoading,false);
    if(fail)assert.equal(h.state.items,before);
    else assert(h.state.items.some(item=>item.id==='older'));
  }
});

test('an old archive request cannot overwrite an accepted publication or its new archive request',async()=>{
  const h=harness(),docs=publication();let completeOld;
  h.state.historyLoaded=false;
  h.setFetch(name=>name==='archive-01.json'?new Promise(resolve=>{completeOld=resolve;}):docs[name]);
  const oldRequest=h.run('loadHistory()');
  await h.run('refreshPublishedData()');
  h.run('applyPendingPublication()');
  assert.equal(h.state.historyLoading,false);
  h.setFetch(name=>name==='archive-02.json'?{generated_at:NEXT,items:[{id:'new-history'}]}:docs[name]);
  await h.run('loadHistory()');
  assert(h.state.items.some(item=>item.id==='new-history'));
  completeOld({generated_at:OLD,items:[{id:'stale-history'}]});
  await oldRequest;
  assert.equal(h.state.generated,NEXT);
  assert(!h.state.items.some(item=>item.id==='stale-history'));
  assert.equal(h.state.historyLoaded,true);
});
