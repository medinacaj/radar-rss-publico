"use strict";
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const modulePath=path.join(__dirname,'../web/reader-ux.js');
const source=fs.existsSync(modulePath)?fs.readFileSync(modulePath,'utf8'):'';

// The real reader module runs against a small DOM. Its existing dependencies
// retain their important side effects: marking read persists and rebuilds rows.
function setup({mode='all',order=['a','b','c','d'],pageSize=36,withSaved=false,withCover=false,read=[]}={}){
  let document;
  class Element {
    constructor(tag){
      this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;
      this.dataset={};this.attributes={};this.listeners={};this.className='';
      this.hidden=false;this.disabled=false;this.open=false;this.textContent='';
      this.top=0;this.isContentEditable=false;
      this.classList={contains:name=>this.className.split(/\s+/).includes(name)};
    }
    get isConnected(){return this===document.body||Boolean(this.parentElement?.isConnected);}
    get disabled(){return this._disabled||false;}
    set disabled(value){
      this._disabled=Boolean(value);
      // Browsers may blur a focused native button as soon as it is disabled.
      if(this._disabled&&document?.activeElement===this)document.activeElement=document.body;
    }
    get id(){return this.attributes.id||'';}
    set id(value){this.attributes.id=value;}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
    prepend(...nodes){for(const node of nodes.reverse()){node.remove();node.parentElement=this;this.children.unshift(node);}}
    insertBefore(node,before){node.remove();node.parentElement=this;this.children.splice(this.children.indexOf(before),0,node);}
    after(node){const siblings=this.parentElement.children;this.parentElement.insertBefore(node,siblings[siblings.indexOf(this)+1]||null);}
    remove(){if(!this.parentElement)return;const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}
    replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
    matches(selector){return selector.split(',').some(part=>{
      const s=part.trim();
      if(s.includes(' ')){
        const [ancestor,tag]=s.split(' ');return this.matches(tag)&&Boolean(this.parentElement?.closest(ancestor));
      }
      if(s==='[data-article-id]')return Boolean(this.dataset.articleId);
      if(s==='dialog[open]')return this.tagName==='DIALOG'&&this.open;
      if(s==='[tabindex]')return this.attributes.tabindex!==undefined;
      if(s==='[id]')return Boolean(this.id);
      if(s.startsWith('[contenteditable'))return this.isContentEditable;
      if(s.startsWith('[role='))return this.attributes.role===s.slice(7,-2);
      if(s.startsWith('#'))return this.id===s.slice(1);
      if(s.startsWith('.')){
        const [cls,tag]=s.slice(1).split(' ');
        return cls.split('.').every(name=>this.classList.contains(name))&&(!tag||this.children.some(child=>child.tagName===tag.toUpperCase()));
      }
      return this.tagName===s.toUpperCase();
    });}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    contains(node){return node===this||this.children.some(child=>child.contains(node));}
    addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
    dispatchEvent(event){event.target??=this;event.currentTarget=this;for(const fn of this.listeners[event.type]||[])fn(event);return !event.defaultPrevented;}
    click(){if(!this.disabled)this.dispatchEvent({type:'click'});}
    focus(options){if(!this.disabled){document.activeElement=this;this.lastFocusOptions=options;}}
    getClientRects(){return this.isConnected&&!this.hidden&&!this.parentElement?.hidden?[this.getBoundingClientRect()]:[];}
    getBoundingClientRect(){return {top:this.top-window.scrollY,left:0,height:100,bottom:this.top-window.scrollY+100};}
    scrollTo(){}
    showModal(){this.open=true;this.querySelector('button')?.focus();}
    close(){this.open=false;document.activeElement=document.body;this.dispatchEvent({type:'close'});}
  }
  document={createElement:tag=>new Element(tag),activeElement:null};
  document.body=new Element('body');document.activeElement=document.body;
  document.getElementById=id=>document.body.querySelector('#'+id);
  document.querySelector=selector=>document.body.querySelector(selector);
  document.querySelectorAll=selector=>document.body.querySelectorAll(selector);
  const frames=[];
  const window={scrollX:14,scrollY:650,scrollCalls:[],scrollTo(options){this.scrollCalls.push(options);this.scrollX=options.left??this.scrollX;this.scrollY=options.top??this.scrollY;}};
  const make=(tag,id,cls,parent=document.body)=>{const node=new Element(tag);node.id=id||'';node.className=cls||'';parent.append(node);return node;};
  const grid=make('div','articleGrid');
  const savedList=withSaved?make('div','dashboardSavedList'):null;
  const modeTab=make('button',null,'mode-tab active');
  const dialog=make('dialog','articleReaderDialog');
  const topbar=make('div',null,'reader-topbar',dialog);
  const close=make('button','readerClose','reader-close',topbar);
  const scroll=make('div',null,'reader-scroll',dialog);
  const title=make('h2','readerTitle','reader-title',scroll);
  const actions=make('div',null,'reader-actions',dialog);
  const save=make('button','readerSave',null,actions);
  const share=make('button','readerShare',null,actions);
  const original=make('a','readerOpenOriginal',null,actions);
  close.addEventListener('click',()=>dialog.close());
  const items=['a','b','c','d','outside'].map(id=>({id,title:'Noticia '+id,url:'https://example.test/'+id}));
  const state={items,read:new Set(read),mode,page:1,pageSize};
  const storage=new Map(),openCalls=[],readCalls=[];
  const applyFilters=()=>order.map(id=>items.find(item=>item.id===id)).filter(item=>mode!=='unread'||!state.read.has(item.id));
  function render(){
    const nodes=applyFilters().slice(0,state.page*state.pageSize).map((item,index)=>{
      const node=new Element('article');node.dataset.articleId=item.id;node.className='article-card';node.top=600+index*160;
      if(withCover){const cover=new Element('a');cover.className='cover';cover.setAttribute('aria-hidden','true');cover.tabIndex=-1;node.append(cover);}
      const title=new Element('h3');title.className='article-title';
      const a=new Element('a');a.className='article-title-link';title.append(a);node.append(title);return node;
    });grid.replaceChildren(...nodes);
    if(savedList)savedList.replaceChildren(...items.slice(0,3).map((item,index)=>{
      const node=new Element('div');node.className='dashboard-saved-item';node.top=1300+index*160;
      if(withCover){const cover=new Element('a');cover.className='dashboard-saved-cover';cover.href=item.url;node.append(cover);}
      const a=new Element('a');a.className='dashboard-saved-title';a.href=item.url;node.append(a);return node;
    }));
  }
  function markRead(id,value){
    readCalls.push([id,value]);const original=state.read.has(id);
    if(value)state.read.add(id);else state.read.delete(id);
    if(original===value)return;
    storage.set('radar-read',JSON.stringify([...state.read]));render();
  }
  const baseOpen=function(item,event){
    if(event){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();}
    openCalls.push(item.id);context.activeReaderItem=item;title.textContent=item.title;
    if(!dialog.open)dialog.showModal();markRead(item.id,true);
  };
  const context=vm.createContext({window,document,state,applyFilters,markRead,openArticleReader:baseOpen,activeReaderItem:null,
    requestAnimationFrame:fn=>frames.push(fn),console,
    $:id=>document.getElementById(id),mk:(tag,cls,text)=>{const node=new Element(tag);node.className=cls||'';node.textContent=text||'';return node;},
    actionToast:()=>{}});
  dialog.addEventListener('close',()=>{context.activeReaderItem=null;});
  original.addEventListener('click',()=>{if(context.activeReaderItem)markRead(context.activeReaderItem.id,true);});
  render();vm.runInContext(source,context);
  const get=id=>document.getElementById(id);
  const row=id=>grid.children.find(node=>node.dataset.articleId===id);
  const open=id=>{
    const trigger=row(id)?.querySelector('a');trigger?.focus();
    const event=trigger?{currentTarget:trigger,target:trigger,button:0,preventDefault(){this.defaultPrevented=true;}}:undefined;
    context.openArticleReader(items.find(item=>item.id===id),event);
  };
  const savedRow=id=>savedList?.children.find(node=>node.querySelector('a').href==='https://example.test/'+id);
  const openSaved=id=>{
    const trigger=savedRow(id).querySelector('a');trigger.focus();
    context.openArticleReader(items.find(item=>item.id===id),{currentTarget:trigger,target:trigger,button:0,preventDefault(){}});
  };
  const key=(key,target=close,extra={})=>{const event={type:'keydown',key,target,preventDefault(){this.defaultPrevented=true;},...extra};dialog.dispatchEvent(event);return event;};
  const flush=()=>{while(frames.length)frames.shift()();};
  return {context,window,document,dialog,grid,modeTab,get,row,open,savedRow,openSaved,key,flush,make,render,state,storage,openCalls,readCalls,baseOpen,source};
}

test('captures the complete filtered order before marking read removes a row',()=>{
  const h=setup({mode:'unread',order:['c','b','d'],pageSize:2});h.open('b');
  assert.ok(h.get('readerPrevious'),'reader navigation must be mounted');
  assert.equal(h.get('readerPosition').textContent,'2 de 3');
  assert.equal(h.row('b'),undefined);
  h.get('readerPrevious').click();
  assert.equal(h.context.activeReaderItem.id,'c');
  assert.equal(h.get('readerPrevious').disabled,true);
  h.get('readerPrevious').click();
  assert.deepEqual(h.openCalls,['b','c']);
  h.get('readerNext').click();h.get('readerNext').click();
  assert.equal(h.context.activeReaderItem.id,'d');
  assert.equal(h.get('readerPosition').textContent,'3 de 3');
  assert.equal(h.get('readerNext').disabled,true);
  h.get('readerNext').click();
  assert.deepEqual(h.openCalls,['b','c','b','d']);
});

test('reader keys navigate only inside the active reader, outside editable fields and modifiers',()=>{
  const h=setup();h.open('b');
  assert.equal(h.key('ArrowRight').defaultPrevented,true);assert.equal(h.context.activeReaderItem.id,'c');
  h.key('k');assert.equal(h.context.activeReaderItem.id,'b');
  for(const tag of ['input','textarea','select']){
    const input=h.make(tag,null,null,h.dialog);h.key('j',input);assert.equal(h.context.activeReaderItem.id,'b');
  }
  const editable=h.make('div',null,null,h.dialog);editable.isContentEditable=true;
  const child=h.make('span',null,null,editable);h.key('ArrowLeft',child);assert.equal(h.context.activeReaderItem.id,'b');
  for(const modifier of ['ctrlKey','metaKey','altKey','shiftKey','isComposing'])h.key('j',undefined,{[modifier]:true});
  h.key('j',undefined,{defaultPrevented:true});assert.equal(h.context.activeReaderItem.id,'b');
  h.key('j',h.document.body);assert.equal(h.context.activeReaderItem.id,'b');
  const other=h.make('dialog');other.open=true;h.key('j');assert.equal(h.context.activeReaderItem.id,'b');
  other.open=false;h.key('j');assert.equal(h.context.activeReaderItem.id,'c');
});

test('mark unread persists without reopening or immediately marking the article read again',()=>{
  const h=setup({mode:'unread'});h.open('b');h.get('readerUnread')?.click();
  assert.equal(h.state.read.has('b'),false);
  assert.deepEqual(JSON.parse(h.storage.get('radar-read')),[]);
  assert.ok(h.row('b'));
  assert.deepEqual(h.openCalls,['b']);
  assert.equal(h.get('readerUnread').disabled,true);
  h.get('readerClose').click();h.flush();
  assert.equal(h.state.read.has('b'),false);
  assert.equal(h.document.activeElement,h.row('b').querySelector('a'));
});

test('closing restores the original row and viewport after marking read rebuilt the list',()=>{
  const h=setup();const original=h.row('b');const top=original.getBoundingClientRect().top;
  h.open('b');assert.equal(original.isConnected,false);
  h.get('readerNext').click();h.window.scrollY=10;
  h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.row('b').querySelector('a'));
  assert.equal(h.row('b').getBoundingClientRect().top,top);
  assert.equal(h.window.scrollX,14);
  assert.equal(h.document.activeElement.lastFocusOptions.preventScroll,true);
});

test('closing an unread reader focuses the next surviving logical neighbor in the same viewport position',()=>{
  const h=setup({mode:'unread'});const top=h.row('b').getBoundingClientRect().top;
  h.open('b');h.get('readerNext').click();
  h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.row('d').querySelector('a'));
  assert.equal(h.row('d').getBoundingClientRect().top,top);
});

test('closing does not take focus or scroll from another dialog or a newly reopened reader',()=>{
  const h=setup();h.open('b');h.get('readerClose').click();
  const other=h.make('dialog');other.open=true;const field=h.make('input',null,null,other);field.focus();h.flush();
  assert.equal(h.document.activeElement,field);assert.equal(h.window.scrollCalls.length,0);
  other.open=false;h.open('a');h.get('readerClose').click();h.open('d');h.flush();
  assert.equal(h.dialog.contains(h.document.activeElement),true);assert.equal(h.window.scrollCalls.length,0);
});

test('native modified clicks preserve the base reader behavior and duplicate script evaluation adds no controls or listeners',()=>{
  const h=setup();const event={button:0,ctrlKey:true,preventDefault(){throw Error('native click was intercepted');}};
  h.context.openArticleReader(h.state.items[0],event);
  assert.equal(h.dialog.open,false);assert.equal(h.openCalls.length,0);
  vm.runInContext(h.source,h.context);h.open('a');h.get('readerNext')?.click();
  assert.deepEqual(h.openCalls,['a','b']);
  assert.equal(h.document.querySelectorAll('#readerPrevious').length,1);
  assert.equal(h.document.querySelectorAll('#readerUnread').length,1);
  assert.equal(h.get('readerSave').isConnected,true);assert.equal(h.get('readerShare').isConnected,true);assert.equal(h.get('readerOpenOriginal').isConnected,true);
});

test('an article outside the filtered list has a one-item reader with disabled boundaries',()=>{
  const h=setup();h.open('outside');
  assert.equal(h.get('readerPosition')?.textContent,'1 de 1');
  assert.equal(h.get('readerPrevious').disabled,true);assert.equal(h.get('readerNext').disabled,true);
});

test('the original saved row retains focus and position even without an article id and with a duplicate elsewhere',()=>{
  const h=setup({withSaved:true});const original=h.savedRow('b');const top=original.getBoundingClientRect().top;
  h.openSaved('b');assert.equal(original.isConnected,false);
  h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.savedRow('b').querySelector('a'));
  assert.equal(h.savedRow('b').getBoundingClientRect().top,top);
});

test('opening the original after marking unread updates the unread action again',()=>{
  const h=setup();h.open('b');h.get('readerUnread').click();
  assert.equal(h.get('readerUnread').disabled,true);
  h.get('readerOpenOriginal').click();
  assert.equal(h.state.read.has('b'),true);
  assert.equal(h.get('readerUnread').disabled,false);
  h.get('readerUnread').click();assert.equal(h.state.read.has('b'),false);
});

test('closing an unread reader falls back to the preceding row and then to the selected mode for an empty list',()=>{
  const h=setup({mode:'unread',order:['a','b']});h.open('b');h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.row('a').querySelector('a'));
  h.open('a');h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.modeTab);
});

test('restored article focus uses the accessible title before a hidden cover in DOM order',()=>{
  for(const read of [[],['b']]){
    const h=setup({withCover:true,read});h.open('b');h.get('readerClose').click();h.flush();
    assert.equal(h.document.activeElement,h.row('b').querySelector('.article-title a'));
  }
  const h=setup({withSaved:true,withCover:true});h.openSaved('b');h.get('readerClose').click();h.flush();
  assert.equal(h.document.activeElement,h.savedRow('b').querySelector('.dashboard-saved-title'));
});

test('marking unread keeps focused reader controls usable for navigation at each boundary',()=>{
  for(const [id,focusId,key,nextId] of [
    ['b','readerNext','j','c'],
    ['d','readerPrevious','k','c'],
    ['outside','readerClose','j','outside']
  ]){
    const h=setup();h.open(id);h.get('readerUnread').focus();h.get('readerUnread').click();
    assert.equal(h.get('readerUnread').disabled,true);
    assert.equal(h.state.read.has(id),false);
    assert.equal(h.document.activeElement.id,focusId,'focused unread action must yield to an enabled reader control');
    assert.equal(h.document.activeElement.disabled,false);
    assert.equal(h.document.activeElement.lastFocusOptions.preventScroll,true);
    const event=h.key(key,h.document.activeElement);
    assert.equal(event.defaultPrevented,true);
    assert.equal(h.context.activeReaderItem.id,nextId);
    assert.equal(h.state.read.has(id),false);
    assert.equal(h.dialog.open,true);
  }
});

test('a programmatic unread action preserves focus in another reader control or editable field',()=>{
  for(const kind of ['readerSave','input','textarea']){
    const h=setup();h.open('b');
    const focused=kind==='readerSave'?h.get(kind):h.make(kind,null,null,h.dialog);
    focused.focus();h.get('readerUnread').click();
    assert.equal(h.get('readerUnread').disabled,true);
    assert.equal(h.state.read.has('b'),false);
    assert.equal(h.document.activeElement,focused);
  }
});
