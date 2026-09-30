const ORIGIN='https://cardoso-gui.github.io';
export async function handle(req:Request):Promise<Response>{
 const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{error:'origin_not_allowed'});
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer .+$/i.test(auth))return reply(401,{error:'login_required'});
 const base=Deno.env.get('SUPABASE_URL')!;
 const admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const mp=Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN_TEST');
 if(!mp||!admin||!base)return reply(503,{error:'checkout_not_configured'});
 const adminHeaders={apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'};
 const call=(url:string,options:RequestInit={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
 try{
  const identity=await call(base+'/auth/v1/user',{headers:{apikey:admin,Authorization:auth}});
  if(!identity.ok)return reply(401,{error:'login_required'});
  const user=await identity.json();

  let body;try{body=await req.json();}catch{return reply(400,{error:'invalid_payment'});}
  if(!/^\d{1,30}$/.test(String(body.payment_id||'')))return reply(400,{error:'invalid_payment'});
  const paymentResponse=await call('https://api.mercadopago.com/v1/payments/'+body.payment_id,{headers:{Authorization:'Bearer '+mp}});
  if(!paymentResponse.ok)return reply(502,{error:'payment_not_found'});
  const payment=await paymentResponse.json();
  const orderId=String(payment.external_reference||'');
  if(!/^[0-9a-f-]{36}$/i.test(orderId))return reply(400,{error:'unmatched_payment'});
  const orderResponse=await call(base+'/rest/v1/checkout_test_orders?id=eq.'+encodeURIComponent(orderId)+'&user_id=eq.'+encodeURIComponent(user.id)+'&select=*',{headers:adminHeaders});
  if(!orderResponse.ok)throw Error('order_lookup');
  const orders=await orderResponse.json(),order=orders[0];
  if(!order)return reply(404,{error:'order_not_found'});
  if(payment.live_mode!==false||payment.currency_id!=='BRL'||Math.round(Number(payment.transaction_amount)*100)!==order.amount_cents||order.book_id!=='o-quinto-herdeiro')return reply(400,{error:'payment_mismatch'});
  const approved=payment.status==='approved';
  const saved=await call(base+'/rest/v1/checkout_test_orders?id=eq.'+order.id,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({payment_id:String(payment.id),payment_status:payment.status,confirmed_at:approved?new Date().toISOString():null})});
  if(!saved.ok)throw Error('status_save');
  return reply(200,{mode:'test',status:payment.status,approved,book_id:order.book_id,order_id:order.id});
 }catch{console.error('Test payment confirmation failed');return reply(503,{error:'confirmation_unavailable'});}
}
Deno.serve(handle);
