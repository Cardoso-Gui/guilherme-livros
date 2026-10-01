export const ORIGIN='https://cardoso-gui.github.io';
export const call=(url:string,options:RequestInit={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
export function config(){
 const base=Deno.env.get('SUPABASE_URL'),admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),mp=Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
 if(!base||!admin||!mp)throw Error('not_configured');
 return {base,mp,headers:{apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'}};
}
export async function confirmPayment(id:string,expectedUser?:string){
 if(!/^\d{1,30}$/.test(id))return {error:'invalid_payment',code:400};
 const c=config();
 const response=await call('https://api.mercadopago.com/v1/payments/'+id,{headers:{Authorization:'Bearer '+c.mp}});
 if(response.status===404)return {error:'payment_not_found',code:404};
 if(!response.ok)throw Error('provider_error');
 const payment=await response.json();
 const reference=String(payment.external_reference||'');
 if(!/^[0-9a-f-]{36}$/i.test(reference))return {error:'unmatched_payment',code:404};
 const orders=await call(c.base+'/rest/v1/checkout_orders?id=eq.'+reference+'&select=*',{headers:c.headers});
 if(!orders.ok)throw Error('order_lookup');
 const order=(await orders.json())[0];
 if(!order||(expectedUser&&order.user_id!==expectedUser))return {error:'order_not_found',code:404};
 const sellerResponse=await call('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+c.mp}});
 if(!sellerResponse.ok)throw Error('seller_lookup');
 const seller=await sellerResponse.json();
 if(!seller.id||!Array.isArray(seller.tags)||seller.tags.includes('test_user')||String(payment.collector_id)!==String(seller.id)||payment.live_mode!==true||payment.currency_id!=='BRL'||Math.round(Number(payment.transaction_amount)*100)!==order.amount_cents)return {error:'payment_mismatch',code:400};
 const confirmed=await call(c.base+'/rest/v1/rpc/confirm_checkout_payment',{method:'POST',headers:c.headers,body:JSON.stringify({p_order_id:order.id,p_payment_id:String(payment.id),p_status:payment.status})});
 if(!confirmed.ok)throw Error('confirmation_save');
 const granted=await confirmed.json();
 return {mode:'production',status:payment.status,approved:payment.status==='approved',access_granted:granted,book_id:order.book_id,book_ids:order.book_ids||[order.book_id],order_id:order.id};
}