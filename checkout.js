(() => {
 'use strict';
 const button=document.getElementById('checkout-test');
 if(!button)return;
 const status=document.getElementById('checkout-status');
 const login=document.getElementById('checkout-login');
 const errors={already_owned:'Este livro já está na sua biblioteca. Você não precisa comprar novamente.',login_required:'Entre na sua conta do site antes de continuar.',invalid_cart:'Confira os livros no carrinho e tente novamente.',too_many_attempts:'Aguarde um minuto antes de tentar novamente.',payment_provider_error:'O Mercado Pago não conseguiu abrir o pagamento. Tente novamente mais tarde.'};
 const params=new URLSearchParams(location.search);

 let busy=false,confirming=false,pending=false,polls=0;
 button.disabled=false;
 button.addEventListener('click',async()=>{
  if(busy||confirming||pending)return;
  busy=true;button.disabled=true;button.textContent='Abrindo checkout...';status.textContent='';login.hidden=true;
  try{
   await window.cartReady;
   const client=window.livrosAuthClient;
   if(!client)throw Error('checkout_unavailable');
   const {data,error}=await client.auth.getSession();
   if(error||!data.session){login.hidden=false;throw Error('login_required');}
   let items;try{items=JSON.parse(localStorage.getItem('guilherme-livros-cart-v1')||'[]');}catch{throw Error('invalid_cart');}
   const response=await fetch('https://xheqlilvylkoxefepbmn.supabase.co/functions/v1/mercado-pago-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({items}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(!response.ok){if(result.error==='login_required')login.hidden=false;throw Error(result.error);}
   const url=new URL(result.checkout_url);
   if(result.mode!=='production'||url.protocol!=='https:'||url.hostname!=='www.mercadopago.com.br')throw Error('checkout_unavailable');
   location.assign(url.href);
  }catch(error){status.textContent=errors[error.message]||'Não foi possível abrir o pagamento. Tente novamente.';}
  finally{busy=false;button.disabled=confirming||pending;button.textContent='Finalizar compra';}
 });

 const resultStatus=document.getElementById('cart-feedback');
 async function confirmReturn(){
  if(busy||confirming)return;
  confirming=true;
  
  const paymentId=params.get('payment_id')||params.get('collection_id');
  
  resultStatus.textContent='Conferindo seu pagamento...';
  button.disabled=true;
  try{
   await window.cartReady;
   const {data,error}=await window.livrosAuthClient.auth.getSession();
   if(error||!data.session){if(!paymentId){resultStatus.textContent='';return;}login.hidden=false;throw Error('Entre na mesma conta do site e atualize esta página para confirmar o pagamento.');}
   const response=await fetch('https://xheqlilvylkoxefepbmn.supabase.co/functions/v1/mercado-pago-status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({payment_id:paymentId}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(!response.ok)throw Error('Não foi possível confirmar o pagamento agora. Atualize esta página para tentar novamente. Seu carrinho foi mantido.');
   if(result.status==='no_payment'){resultStatus.textContent='';return;}
   pending=false;
   if(result.mode==='production'&&result.approved===true&&result.status==='approved'&&result.access_granted===true){
    let cart=JSON.parse(localStorage.getItem('guilherme-livros-cart-v1')||'[]');
    if(!Array.isArray(cart))cart=[];
    localStorage.setItem('guilherme-livros-cart-v1',JSON.stringify(cart.filter(id=>id!==result.book_id)));
    window.dispatchEvent(new StorageEvent('storage',{key:'guilherme-livros-cart-v1'}));
    resultStatus.textContent='Pagamento aprovado! Seu livro já está disponível em Minha biblioteca.';
   }else{
    pending=['pending','in_process','authorized'].includes(result.status);
    if(pending&&polls++<12)setTimeout(confirmReturn,15000);
    resultStatus.textContent=pending?'Pagamento aguardando confirmação. O livro continua no carrinho.':'O pagamento não está aprovado. O livro continua no carrinho.';
   }
  }catch(error){resultStatus.textContent=error.message||'Não foi possível confirmar o pagamento. Seu carrinho foi mantido.';}
  finally{confirming=false;button.disabled=busy||pending;}
 }
 confirmReturn();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)confirmReturn();});
})();
