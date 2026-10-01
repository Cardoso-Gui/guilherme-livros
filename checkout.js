(() => {
 'use strict';
 const button=document.getElementById('checkout-test');
 if(!button)return;
 const status=document.getElementById('checkout-status');
 const login=document.getElementById('checkout-login');
 const errors={already_owned:'Este livro já está na sua biblioteca. Você não precisa comprar novamente.',login_required:'Entre na sua conta do site antes de continuar.',invalid_cart:'Confira os livros no carrinho e tente novamente.',too_many_attempts:'Aguarde um minuto antes de tentar novamente.',payment_provider_error:'O Mercado Pago não conseguiu abrir o teste. Tente novamente mais tarde.'};
 const params=new URLSearchParams(location.search);

 let busy=false;
 button.disabled=false;
 button.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;button.disabled=true;button.textContent='Abrindo checkout...';status.textContent='';login.hidden=true;
  try{
   await window.cartReady;
   const client=window.livrosAuthClient;
   if(!client)throw Error('checkout_unavailable');
   const {data,error}=await client.auth.getSession();
   if(error||!data.session){login.hidden=false;throw Error('login_required');}
   let items;try{items=JSON.parse(localStorage.getItem('guilherme-livros-cart-v1')||'[]');}catch{throw Error('invalid_cart');}
   const response=await fetch('https://xheqlilvylkoxefepbmn.supabase.co/functions/v1/mercado-pago-checkout-test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({items}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(!response.ok){if(result.error==='login_required')login.hidden=false;throw Error(result.error);}
   const url=new URL(result.checkout_url);
   if(result.mode!=='test'||url.protocol!=='https:'||url.hostname!=='sandbox.mercadopago.com.br')throw Error('checkout_unavailable');
   location.assign(url.href);
  }catch(error){status.textContent=errors[error.message]||'Não foi possível abrir o checkout de teste. Tente novamente.';}
  finally{busy=false;button.disabled=false;button.textContent='Testar pagamento';}
 });

 const resultStatus=document.getElementById('cart-feedback');
 async function confirmReturn(){
  
  const paymentId=params.get('payment_id')||params.get('collection_id');
  
  resultStatus.textContent='Conferindo seu pagamento de teste...';
  button.disabled=true;
  try{
   await window.cartReady;
   const {data,error}=await window.livrosAuthClient.auth.getSession();
   if(error||!data.session){if(!paymentId){resultStatus.textContent='';return;}login.hidden=false;throw Error('Entre na mesma conta do site e atualize esta página para confirmar o pagamento.');}
   const response=await fetch('https://xheqlilvylkoxefepbmn.supabase.co/functions/v1/mercado-pago-status-test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({payment_id:paymentId}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(!response.ok)throw Error('Não foi possível confirmar o pagamento agora. Atualize esta página para tentar novamente. Seu carrinho foi mantido.');
   if(result.status==='no_payment'){resultStatus.textContent='';return;}
   if(result.mode==='test'&&result.approved===true&&result.status==='approved'){
    let cart=JSON.parse(localStorage.getItem('guilherme-livros-cart-v1')||'[]');
    if(!Array.isArray(cart))cart=[];
    localStorage.setItem('guilherme-livros-cart-v1',JSON.stringify(cart.filter(id=>id!==result.book_id)));
    window.dispatchEvent(new StorageEvent('storage',{key:'guilherme-livros-cart-v1'}));
    resultStatus.textContent=result.access_granted?'Pagamento de teste aprovado! Seu livro já está disponível em Minha biblioteca.':'Pagamento de teste aprovado! O livro foi removido do carrinho. A liberação de teste está restrita às contas autorizadas.';
   }else{
    resultStatus.textContent=['pending','in_process','authorized'].includes(result.status)?'Pagamento de teste aguardando confirmação. O livro continua no carrinho.':'O pagamento de teste não está aprovado. O livro continua no carrinho.';
   }
  }catch(error){resultStatus.textContent=error.message||'Não foi possível confirmar o pagamento. Seu carrinho foi mantido.';}
  finally{button.disabled=false;}
 }
 confirmReturn();

})();
