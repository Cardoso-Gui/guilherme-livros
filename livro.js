(() => {
 'use strict';
 const client=window.livrosAuthClient, status=document.getElementById('reading-status'), panel=document.getElementById('private-reader'), text=document.getElementById('capitulo'), title=document.getElementById('chapter-title'), select=document.getElementById('chapter-select'), previous=document.getElementById('previous-chapter'), next=document.getElementById('next-chapter');
 let chapters=[], index=0, userId='', ready=false, restoring=false, timer, queued=Promise.resolve(), position=null,anchorIndex=null,anchorOffset=0;
 const clear=()=>{ready=false;clearTimeout(timer);chapters=[];text.replaceChildren();panel.hidden=true;};
 const key=()=>`reading-position:${userId}:o-quinto-herdeiro`;
 function remember(fraction){
  if(!ready||restoring)return;
  position={user_id:userId,book_id:'o-quinto-herdeiro',chapter_index:index,scroll_fraction:fraction,paragraph_index:anchorIndex,paragraph_offset:anchorOffset,font_size:parseInt(text.style.getPropertyValue('--reading-size'))||14,updated_at:new Date().toISOString()};
  try{localStorage.setItem(key(),JSON.stringify(position));}catch(_){}
  if(!timer)timer=setTimeout(sync,1000);
 }
 function sync(){
  clearTimeout(timer);timer=null;
  if(!position||!ready)return;
  const snapshot={...position};
  queued=queued.catch(()=>{}).then(async()=>{
   if(!ready||snapshot.user_id!==userId)return;
   const result=await client.from('reading_progress').upsert(snapshot,{onConflict:'user_id,book_id'});
   if(result.error)console.warn('Não foi possível sincronizar a posição de leitura.');
  });
 }
 function capture(){
  if(!ready||restoring)return;
  const paragraphs=[...text.children];
  const offset=130;
  anchorIndex=paragraphs.findIndex(p=>p.getBoundingClientRect().bottom>offset);
  if(anchorIndex<0)anchorIndex=Math.max(0,paragraphs.length-1);
  const paragraph=paragraphs[anchorIndex];
  anchorOffset=paragraph?Math.max(0,Math.min(1,(offset-paragraph.getBoundingClientRect().top)/Math.max(1,paragraph.offsetHeight))):0;
  const top=text.getBoundingClientRect().top+window.scrollY;
  remember(Math.max(0,Math.min(1,(window.scrollY-top)/Math.max(1,text.offsetHeight-window.innerHeight/2))));
 }
 window.addEventListener('scroll',capture,{passive:true});
 window.addEventListener('reading-font-change',capture);
 window.addEventListener('pagehide',()=>{capture();sync();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){capture();sync();}});
 function render(move=false){
  const chapter=chapters[index];if(!chapter)return;
  title.textContent=chapter.title;select.value=String(index);
  text.replaceChildren(...chapter.paragraphs.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));
  previous.disabled=index===0;next.disabled=index===chapters.length-1;
  document.getElementById('chapter-position').textContent=`Parte ${index+1} de ${chapters.length}`;
  if(move){restoring=true;anchorIndex=0;anchorOffset=0;title.focus({preventScroll:true});title.scrollIntoView({behavior:'instant',block:'start'});requestAnimationFrame(()=>{restoring=false;remember(0);});}
 }
 previous.addEventListener('click',()=>{if(index>0){index--;render(true);}});
 next.addEventListener('click',()=>{if(index<chapters.length-1){index++;render(true);}});
 select.addEventListener('change',()=>{const target=Number(select.value);if(Number.isInteger(target)&&target>=0&&target<chapters.length){index=target;render(true);}});
 client?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){clear();status.hidden=false;status.textContent='Sua sessão terminou. Entre novamente para continuar.';}});
 async function init(){
  try{
   if(!client)throw new Error();
   const user=await client.auth.getUser();
   if(user.error||!user.data.user){status.innerHTML='Entre na sua conta para ler. <a href="./entrar.html">Entrar</a>';return;}
   userId=user.data.user.id;
   const access=await client.from('book_access').select('book_id').eq('book_id','o-quinto-herdeiro');
   if(access.error)throw access.error;
   if(!access.data.length){status.textContent='Este livro ainda não está liberado para sua conta.';return;}
   const download=await client.storage.from('livros-privados').download('o-quinto-herdeiro-leitura.json');
   if(download.error)throw download.error;
   const book=JSON.parse(await download.data.text());
   if(!Array.isArray(book.chapters)||!book.chapters.length)throw new Error();
   // Session can end while the private download is in progress.
   const current=await client.auth.getUser();
   if(current.error||current.data.user?.id!==userId)throw new Error();
   chapters=book.chapters;
   select.replaceChildren(...chapters.map((chapter,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=chapter.title;return option;}));
   let saved=null;
   try{
    const raw=localStorage.getItem(key());
    if(raw!==null){const value=JSON.parse(raw);saved=typeof value==='number'?{chapter_index:value,scroll_fraction:0,updated_at:'1970-01-01'}:value;}
   }catch(_){}
   const remote=await client.from('reading_progress').select('chapter_index,scroll_fraction,paragraph_index,paragraph_offset,font_size,updated_at').eq('user_id',userId).eq('book_id','o-quinto-herdeiro').maybeSingle();
   if(!remote.error&&remote.data&&(!saved||Date.parse(remote.data.updated_at)>Date.parse(saved.updated_at)))saved=remote.data;
   const finalUser=await client.auth.getUser();
   if(finalUser.error||finalUser.data.user?.id!==userId)throw new Error();
   if(saved&&Number.isInteger(saved.chapter_index)&&saved.chapter_index>=0&&saved.chapter_index<chapters.length)index=saved.chapter_index;
   window.dispatchEvent(new CustomEvent('reader-preferences',{detail:{user_id:userId,font_size:saved?.font_size}}));
   render();status.hidden=true;panel.hidden=false;ready=true;restoring=true;
   await document.fonts.ready;
   if(!ready)return;
   requestAnimationFrame(()=>{
    if(!ready)return;
    const fraction=Math.max(0,Math.min(1,Number(saved?.scroll_fraction)||0));
    if(saved){
     const paragraph=Number.isInteger(saved.paragraph_index)?text.children[saved.paragraph_index]:null;
     if(paragraph){anchorIndex=saved.paragraph_index;anchorOffset=Math.max(0,Math.min(1,Number(saved.paragraph_offset)||0));window.scrollTo({top:paragraph.getBoundingClientRect().top+window.scrollY+anchorOffset*paragraph.offsetHeight-130,behavior:'instant'});}
     else{const top=text.getBoundingClientRect().top+window.scrollY;window.scrollTo({top:top+fraction*Math.max(1,text.offsetHeight-window.innerHeight/2),behavior:'instant'});}
    }
    requestAnimationFrame(()=>{restoring=false;remember(fraction);});
   });
  }catch(_){clear();status.hidden=false;status.textContent='Não foi possível abrir o livro. Verifique sua conexão e tente recarregar a página.';}
 }
 init();
})();