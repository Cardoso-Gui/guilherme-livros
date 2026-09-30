(() => {
 'use strict';
 const button=document.getElementById('checkout-test');
 if(!button)return;
 const status=document.getElementById('checkout-status');
 const login=document.getElementById('checkout-login');
 const errors={login_required:'Entre na sua conta do site antes de continuar.',invalid_cart:'Confira os livros no carrinho e tente novamente.',too_many_attempts:'Aguarde um minuto antes de tentar novamente.',payment_provider_error:'O Mercado Pago não conseguiu abrir o teste. Tente novamente mais tarde.'};
 const params=new URLSearchParams(location.search);
 if(params.get('checkout')==='test')status.textContent='Você voltou do checkout de teste. O retorno não confirma o pagamento nem libera o livro.';
 let busy=false;
 button.disabled=false;
 button.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;button.disabled=true;button.textContent='Abrindo checkout...';status.textContent='';login.hidden=true;
  try{
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
})();
