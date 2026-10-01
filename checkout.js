(() => {
 'use strict';
 const button=document.getElementById('checkout-test');
 if(!button)return;
 const status=document.getElementById('checkout-status');
 const login=document.getElementById('checkout-login');
 const errors={already_owned:'Um dos livros já está na sua biblioteca. Você não precisa comprar novamente.',login_required:'Entre na sua conta do site antes de continuar.',invalid_cart:'Confira os livros no carrinho e tente novamente.',too_many_attempts:'Aguarde um minuto antes de tentar novamente.',payment_provider_error:'O Mercado Pago não conseguiu abrir o pagamento. Tente novamente mais tarde.'};
 const params=new URLSearchParams(location.search);
 const loginDialog=document.createElement('dialog');
 loginDialog.setAttribute('aria-labelledby','checkout-login-title');
 loginDialog.setAttribute('aria-describedby','checkout-login-description');
 loginDialog.className='checkout-login-dialog';
 loginDialog.innerHTML='<h2 id="checkout-login-title">Entre para continuar</h2><p id="checkout-login-description">Para finalizar a compra, você precisa estar logado. Assim, seus livros ficam disponíveis na sua biblioteca.</p><div class="checkout-login-actions"><a class="button" href="./entrar.html">Entrar na minha conta ↗</a><button type="button" class="checkout-login-cancel">Continuar no carrinho</button></div>';
 const dialogStyle=document.createElement('style');
 dialogStyle.textContent='.checkout-login-dialog{box-sizing:border-box;width:min(460px,calc(100% - 32px));padding:32px;border:1px solid #d9e3f0;border-radius:22px;background:#fff;color:#283442;box-shadow:0 24px 80px #152b4540}.checkout-login-dialog::backdrop{background:#172c4866;backdrop-filter:blur(3px)}.checkout-login-dialog h2{font-size:30px;margin:0 0 16px}.checkout-login-dialog p{font-size:16px;line-height:1.7;color:#53667e;margin:0 0 24px}.checkout-login-actions{display:grid;gap:12px}.checkout-login-actions .button{justify-content:center}.checkout-login-cancel{padding:12px;background:transparent;border:0;color:#254e7b;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:4px}.checkout-login-dialog :focus-visible{outline:3px solid #759dd0;outline-offset:4px}';
 document.head.append(dialogStyle);
 document.body.append(loginDialog);
 loginDialog.querySelector('button').addEventListener('click',()=>loginDialog.close());
 loginDialog.addEventListener('close',()=>button.focus());
 function requestLogin(){
  login.hidden=false;
  if(!loginDialog.open)loginDialog.showModal();
 }

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
   if(error||!data.session){requestLogin();throw Error('login_required');}
   let items;try{items=JSON.parse(localStorage.getItem('guilherme-livros-cart-v1')||'[]');}catch{throw Error('invalid_cart');}
   const response=await fetch('https://xheqlilvylkoxefepbmn.supabase.co/functions/v1/mercado-pago-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({items}),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(!response.ok){if(result.error==='login_required')requestLogin();throw Error(result.error);}
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
    localStorage.setItem('guilherme-livros-cart-v1',JSON.stringify(cart.filter(id=>!(result.book_ids||[result.book_id]).includes(id))));
    window.dispatchEvent(new StorageEvent('storage',{key:'guilherme-livros-cart-v1'}));
    resultStatus.textContent='Pagamento aprovado! Seus livros já estão disponíveis em Minha biblioteca.';
   }else{
    pending=['pending','in_process','authorized'].includes(result.status);
    if(pending&&polls++<12)setTimeout(confirmReturn,15000);
    resultStatus.textContent=pending?'Pagamento aguardando confirmação. Os livros continuam no carrinho.':'O pagamento não está aprovado. Os livros continuam no carrinho.';
   }
  }catch(error){resultStatus.textContent=error.message||'Não foi possível confirmar o pagamento. Seu carrinho foi mantido.';}
  finally{confirming=false;button.disabled=busy||pending;}
 }
 confirmReturn();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)confirmReturn();});
})();
