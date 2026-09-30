(() => {
 'use strict';
 const client=window.livrosAuthClient, status=document.getElementById('reading-status'), panel=document.getElementById('private-reader'), text=document.getElementById('capitulo'), title=document.getElementById('chapter-title'), select=document.getElementById('chapter-select'), previous=document.getElementById('previous-chapter'), next=document.getElementById('next-chapter');
 let chapters=[], index=0, userId='';
 const clear=()=>{chapters=[];text.replaceChildren();panel.hidden=true;};
 const key=()=>`reading-position:${userId}:o-quinto-herdeiro`;
 function render(move=false){
  const chapter=chapters[index];if(!chapter)return;
  title.textContent=chapter.title;select.value=String(index);
  text.replaceChildren(...chapter.paragraphs.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));
  previous.disabled=index===0;next.disabled=index===chapters.length-1;
  document.getElementById('chapter-position').textContent=`Parte ${index+1} de ${chapters.length}`;
  try{localStorage.setItem(key(),String(index));}catch(_){}
  if(move) title.scrollIntoView({behavior:'smooth',block:'start'});
 }
 previous.addEventListener('click',()=>{if(index>0){index--;render(true);}});
 next.addEventListener('click',()=>{if(index<chapters.length-1){index++;render(true);}});
 select.addEventListener('change',()=>{index=Number(select.value);render(true);});
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
   try{const saved=Number(localStorage.getItem(key()));if(Number.isInteger(saved)&&saved>=0&&saved<chapters.length)index=saved;}catch(_){}
   render();status.hidden=true;panel.hidden=false;
  }catch(_){clear();status.hidden=false;status.textContent='Não foi possível abrir o livro. Verifique sua conexão e tente recarregar a página.';}
 }
 init();
})();