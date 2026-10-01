(() => {
 'use strict';
 const area=document.getElementById('library-content');
 const client=window.livrosAuthClient;
 let revision=0;
 async function init(){
  const ticket=++revision;
  try {
   if(!client) throw new Error();
   const {data,error}=await client.auth.getUser();
   if(error || !data.user){area.innerHTML='<h2>Suas histórias esperam por você.</h2><p>Entre na sua conta para acessar seus livros.</p><a class="button" href="./entrar.html">Entrar</a>';return;}
   const result=await client.from('book_access').select('book_id');
   if(result.error) throw result.error;
   if(!result.data.some(row=>row.book_id==='o-quinto-herdeiro')){area.innerHTML='<h2>Sua biblioteca está começando.</h2><p>Os livros liberados para sua conta aparecerão aqui.</p><a class="button" href="./descubra.html">Descobrir histórias</a>';return;}
   let progress=null;
   try{
    const raw=localStorage.getItem('reading-position:'+data.user.id+':o-quinto-herdeiro');
    if(raw!==null){const local=JSON.parse(raw);progress=typeof local==='number'?{chapter_index:local,updated_at:'1970-01-01'}:local;}
   }catch(_){}
   try{
    const saved=await client.from('reading_progress').select('chapter_index,scroll_fraction,updated_at').eq('user_id',data.user.id).eq('book_id','o-quinto-herdeiro').maybeSingle();
    if(!saved.error&&saved.data&&(!progress||Date.parse(saved.data.updated_at)>=Date.parse(progress.updated_at)))progress=saved.data;
   }catch(_){}
   const current=await client.auth.getUser();
   if(ticket!==revision||current.error||current.data.user?.id!==data.user.id)return;
   const shelf=document.createElement('div');shelf.className='library-grid';
   const card=document.createElement('a');card.className='library-book-card';card.href='./ler.html';
   const cover=document.createElement('img');cover.src='./assets/o-quinto-herdeiro-capa.jpg';cover.alt='';cover.width=768;cover.height=1152;
   const info=document.createElement('div');info.className='library-book-info';
   const title=document.createElement('h2');title.textContent='O Quinto Herdeiro';
   const position=document.createElement('p');position.className='library-book-position';
   const chapter=progress?.chapter_index;
   position.textContent=Number.isInteger(chapter)&&chapter>=0?'Parte '+(chapter+1)+' · Continuar leitura':'Ainda não iniciado';
   card.setAttribute('aria-label','O Quinto Herdeiro — '+position.textContent);
   info.append(title,position);card.append(cover,info);shelf.append(card);
   area.classList.add('library-shelf');area.replaceChildren(shelf);
  }catch(_){area.innerHTML='<h2>Não conseguimos carregar sua biblioteca.</h2><p>Tente novamente em instantes.</p><button class="button" onclick="location.reload()">Tentar novamente</button>';}
 }
 client?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){revision++;area.replaceChildren();location.reload();}});
 init();
})();