(() => {
 'use strict';
 const area=document.getElementById('library-content');
 const client=window.livrosAuthClient;
 async function init(){
  try {
   if(!client) throw new Error();
   const {data,error}=await client.auth.getUser();
   if(error || !data.user){area.innerHTML='<h2>Suas histórias esperam por você.</h2><p>Entre na sua conta para acessar seus livros.</p><a class="button" href="./entrar.html">Entrar</a>';return;}
   const result=await client.from('book_access').select('book_id');
   if(result.error) throw result.error;
   if(!result.data.some(row=>row.book_id==='o-quinto-herdeiro')){area.innerHTML='<h2>Sua biblioteca está começando.</h2><p>Os livros liberados para sua conta aparecerão aqui.</p><a class="button" href="./descubra.html">Descobrir histórias</a>';return;}
   area.innerHTML='<div class="owned-book"><img src="./assets/o-quinto-herdeiro-capa.jpg" alt="Capa de O Quinto Herdeiro" width="145"><div><p class="eyebrow">LEGADO ELEMENTAL</p><h2>O Quinto Herdeiro</h2><p>Seu livro completo está disponível.</p><a class="button" href="./ler.html">Abrir livro <span aria-hidden="true">↗</span></a></div></div>';
  }catch(_){area.innerHTML='<h2>Não conseguimos carregar sua biblioteca.</h2><p>Tente novamente em instantes.</p><button class="button" onclick="location.reload()">Tentar novamente</button>';}
 }
 client?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT') location.reload();});
 init();
})();