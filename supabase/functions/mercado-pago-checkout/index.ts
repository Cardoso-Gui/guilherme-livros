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
 const mp=Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
 if(!mp||!admin||!base)return reply(503,{error:'checkout_not_configured'});
 const adminHeaders={apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'};
 const call=(url:string,options:RequestInit={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});
 try{
  const identity=await call(base+'/auth/v1/user',{headers:{apikey:admin,Authorization:auth}});
  if(!identity.ok)return reply(401,{error:'login_required'});
  const user=await identity.json();
  let body;try{body=await req.json();}catch{return reply(400,{error:'invalid_cart'});}
  if(!Array.isArray(body.items)||body.items.length!==1||body.items[0]!=='o-quinto-herdeiro')return reply(400,{error:'invalid_cart'});
  const access=await call(base+'/rest/v1/book_access?user_id=eq.'+encodeURIComponent(user.id)+'&book_id=eq.o-quinto-herdeiro&select=book_id',{headers:adminHeaders});
  if(!access.ok)throw Error('access_lookup');
  if((await access.json()).length)return reply(409,{error:'already_owned'});
  const recent=await call(base+'/rest/v1/checkout_orders?user_id=eq.'+encodeURIComponent(user.id)+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-60000).toISOString())+'&select=id',{headers:adminHeaders});
  if(!recent.ok)throw Error('order_lookup');
  if((await recent.json()).length>=5)return reply(429,{error:'too_many_attempts'});
  const sellerResponse=await call('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+mp}});
  if(!sellerResponse.ok)throw Error('seller_lookup');
  const seller=await sellerResponse.json();
  if(!seller.id||!Array.isArray(seller.tags)||seller.tags.includes('test_user'))return reply(503,{error:'production_not_configured'});
  const id=crypto.randomUUID();
  const inserted=await call(base+'/rest/v1/checkout_orders',{method:'POST',headers:adminHeaders,body:JSON.stringify({id,user_id:user.id,book_id:'o-quinto-herdeiro',amount_cents:1490})});
  if(!inserted.ok)throw Error('order_save');
  const site=ORIGIN+'/guilherme-livros/carrinho.html';
  const result=await call('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:'Bearer '+mp,'Content-Type':'application/json'},body:JSON.stringify({
   items:[{id:'o-quinto-herdeiro',title:'O Quinto Herdeiro — edição digital',quantity:1,currency_id:'BRL',unit_price:14.90,category_id:'books'}],
   external_reference:id,metadata:{order_id:id,environment:'production'},
   back_urls:{success:site+'?checkout=production&result=success',pending:site+'?checkout=production&result=pending',failure:site+'?checkout=production&result=failure'},
   auto_return:'approved',notification_url:base+'/functions/v1/mercado-pago-webhook'
  })});
  if(!result.ok){console.error('Mercado Pago preference HTTP',result.status);return reply(502,{error:'payment_provider_error'});}
  const preference=await result.json();
  // Only the official production checkout is accepted.
  const url=new URL(preference.init_point);
  if(url.protocol!=='https:'||url.hostname!=='www.mercadopago.com.br')throw Error('unsafe_checkout_url');
  const saved=await call(base+'/rest/v1/checkout_orders?id=eq.'+id,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({preference_id:String(preference.id),checkout_url:url.href})});
  if(!saved.ok)throw Error('preference_save');
  return reply(200,{checkout_url:url.href,order_id:id,mode:'production'});
 }catch{console.error('Test checkout request failed');return reply(503,{error:'checkout_unavailable'});}
}
Deno.serve(handle);
