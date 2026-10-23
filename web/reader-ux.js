"use strict";
/* Reader navigation wraps the complete existing reader after its other modules.
   It retains RSS previews, library actions and the original-source links. */
(() => {
  const dialog=$('articleReaderDialog');
  if(!dialog||dialog.dataset.readerUx==='true')return;
  dialog.dataset.readerUx='true';

  const navigation=mk('nav','reader-navigation');
  navigation.setAttribute('aria-label','Navegación de noticias');
  const previous=mk('button','reader-secondary','Anterior');
  previous.id='readerPrevious';previous.type='button';
  previous.title='Noticia anterior (← o k)';previous.setAttribute('aria-keyshortcuts','ArrowLeft k');
  const position=mk('span','reader-position');position.id='readerPosition';
  position.setAttribute('aria-live','polite');position.setAttribute('aria-atomic','true');
  const next=mk('button','reader-secondary','Siguiente');
  next.id='readerNext';next.type='button';
  next.title='Noticia siguiente (→ o j)';next.setAttribute('aria-keyshortcuts','ArrowRight j');
  navigation.append(previous,position,next);
  dialog.querySelector('.reader-topbar').after(navigation);

  const unread=mk('button','reader-secondary reader-unread','Marcar como no leída');
  unread.id='readerUnread';unread.type='button';
  dialog.querySelector('.reader-actions').insertBefore(unread,$('readerShare'));

  let session=null,openingVersion=0;
  const otherDialogOpen=()=>[...document.querySelectorAll('dialog[open]')].some(node=>node!==dialog);
  const rows=()=>[...document.querySelectorAll('[data-article-id],.dashboard-saved-item')]
    .filter(node=>!node.closest('dialog')&&node.getClientRects().length>0);
  const rowKey=node=>node.dataset.articleId?'id:'+node.dataset.articleId:'url:'+node.querySelector('.dashboard-saved-title')?.href;
  const rowScope=node=>node.parentElement?.closest('[id]')?.id||'';
  const focusable=row=>row?.querySelector('.article-title a, .briefing-title, .dashboard-recent-title, .dashboard-saved-title')||
    [...(row?.querySelectorAll('a, button, [tabindex]')||[])]
      .find(node=>node.getAttribute('aria-hidden')!=='true'&&node.tabIndex!==-1&&!node.disabled);

  function startSession(item,event){
    // Opening marks read and can remove the originating row from an unread list.
    // Capture both the complete filtered order and its viewport anchor first.
    const filtered=applyFilters().slice();
    const inFiltered=filtered.some(entry=>entry.id===item.id);
    const visibleRows=rows();
    const trigger=event?.currentTarget||event?.target||document.activeElement;
    const triggerRow=trigger?.closest?.('[data-article-id],.dashboard-saved-item');
    const origin=triggerRow&&(!triggerRow.dataset.articleId||triggerRow.dataset.articleId===item.id)
      ?triggerRow:visibleRows.find(node=>node.dataset.articleId===item.id);
    const scope=rowScope(origin||{}),originKey=origin?rowKey(origin):'id:'+item.id;
    const scopedRows=visibleRows.filter(node=>rowScope(node)===scope);
    const returnKeys=inFiltered&&!origin?.matches('.dashboard-saved-item')
      ?filtered.map(entry=>'id:'+entry.id):scopedRows.map(rowKey);
    return {
      items:inFiltered?filtered:[item],index:0,
      originKey,scope,returnKeys,returnIndex:returnKeys.indexOf(originKey),
      originFocus:focusable(origin),
      anchorTop:origin?.getBoundingClientRect().top,
      scrollX:window.scrollX,scrollY:window.scrollY
    };
  }

  function sync(){
    if(!session||!activeReaderItem)return;
    position.textContent=`${session.index+1} de ${session.items.length}`;
    previous.disabled=session.index===0;
    next.disabled=session.index===session.items.length-1;
    unread.disabled=!state.read.has(activeReaderItem.id);
    unread.textContent=unread.disabled?'Marcada como no leída':'Marcar como no leída';
  }

  const baseOpen=openArticleReader;
  openArticleReader=function(item,event,...rest){
    if(event&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)){
      return baseOpen.call(this,item,event,...rest);
    }
    if(!dialog.open||!session){session=startSession(item,event);openingVersion+=1;}
    let index=session.items.findIndex(entry=>entry.id===item.id);
    if(index<0){
      // A related-story link can leave the current filtered sequence. Preserve
      // the return location while starting a sequence for that selected story.
      const filtered=applyFilters().slice();
      session.items=filtered.some(entry=>entry.id===item.id)?filtered:[item];
      index=session.items.findIndex(entry=>entry.id===item.id);
    }
    session.index=index;
    const result=baseOpen.call(this,item,event,...rest);
    sync();
    return result;
  };

  function move(delta){
    if(!dialog.open||!session||otherDialogOpen())return;
    const index=session.index+delta;
    if(index<0||index>=session.items.length)return;
    const focused=document.activeElement;
    openArticleReader(session.items[index]);
    // Keep button focus usable when the selected end disables that button.
    if(focused===previous&&previous.disabled)next.focus({preventScroll:true});
    else if(focused===next&&next.disabled)previous.focus({preventScroll:true});
  }
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  unread.addEventListener('click',()=>{
    if(!dialog.open||!activeReaderItem||otherDialogOpen())return;
    const hadFocus=document.activeElement===unread;
    markRead(activeReaderItem.id,false);
    sync();
    if(hadFocus&&dialog.open&&!otherDialogOpen()){
      // Disabling the focused action can blur it to body in native dialogs.
      // Retain a usable target for the reader's scoped keyboard shortcuts.
      const target=!next.disabled?next:!previous.disabled?previous:$('readerClose');
      target.focus({preventScroll:true});
    }
    actionToast('Marcada como no leída.');
  });
  // The existing original-source action marks read without reopening the reader.
  $('readerOpenOriginal').addEventListener('click',sync);
  dialog.addEventListener('keydown',event=>{
    if(!dialog.open||!session||otherDialogOpen()||event.defaultPrevented||event.isComposing||
      event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    const target=event.target;
    if(!dialog.contains(target)||target.closest('dialog')!==dialog||target.isContentEditable||
      target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"]'))return;
    const key=event.key.toLowerCase();
    if(!['arrowleft','arrowright','j','k'].includes(key))return;
    event.preventDefault();
    move(key==='arrowleft'||key==='k'?-1:1);
  });

  function restoreLocation(closed){
    const visibleRows=rows();
    const scopedRows=visibleRows.filter(node=>rowScope(node)===closed.scope);
    const candidatesRows=scopedRows.length?scopedRows:visibleRows;
    let row=candidatesRows.find(node=>rowKey(node)===closed.originKey);
    if(!row){
      const candidates=[...closed.returnKeys.slice(closed.returnIndex+1),...closed.returnKeys.slice(0,closed.returnIndex).reverse()];
      for(const key of candidates){
        row=candidatesRows.find(node=>rowKey(node)===key);
        if(row)break;
      }
    }
    row||=candidatesRows[0];
    const target=closed.originFocus?.isConnected&&row?.contains(closed.originFocus)
      ?closed.originFocus:focusable(row)||row||document.querySelector('.mode-tab.active');
    if(target){
      if(target===row&&!row.hasAttribute?.('tabindex'))target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
    }
    const top=row&&closed.anchorTop!==undefined
      ?window.scrollY+row.getBoundingClientRect().top-closed.anchorTop:closed.scrollY;
    window.scrollTo({left:closed.scrollX,top,behavior:'instant'});
  }
  dialog.addEventListener('close',()=>{
    const closed=session,version=openingVersion;session=null;
    if(!closed)return;
    requestAnimationFrame(()=>{
      if(dialog.open||session||openingVersion!==version||otherDialogOpen())return;
      restoreLocation(closed);
    });
  });
})();
