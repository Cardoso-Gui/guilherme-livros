import {ORIGIN,call,config,confirmPayment} from './payment.ts';
export async function handle(req:Request):Promise<Response>{
 const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{error:'origin_not_allowed'});
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer .+$/i.test(auth))return reply(401,{error:'login_required'});
 try{
  const c=config();
  const identity=await call(c.base+'/auth/v1/user',{headers:{apikey:c.headers.apikey,Authorization:auth}});
  if(!identity.ok)return reply(401,{error:'login_required'});
  const user=await identity.json();
  let body;try{body=await req.json();}catch{return reply(400,{error:'invalid_payment'});}
  let id=body.payment_id;
  if(!id){
   const recent=await call(c.base+'/rest/v1/checkout_orders?user_id=eq.'+encodeURIComponent(user.id)+'&order=created_at.desc&limit=3&select=id,payment_id',{headers:c.headers});
   if(!recent.ok)throw Error('order_lookup');
   for(const order of await recent.json()){
    const search=await call('https://api.mercadopago.com/v1/payments/search?external_reference='+encodeURIComponent(order.id)+'&sort=date_created&criteria=desc&limit=10',{headers:{Authorization:'Bearer '+c.mp}});
    if(!search.ok)throw Error('provider_search');
    const matches=((await search.json()).results||[]).filter((p:any)=>String(p.external_reference)===order.id);
    const payment=matches.find((p:any)=>p.status==='approved')||matches[0];
    if(payment){id=String(payment.id);break;}
   }
  }
  if(!id)return reply(200,{mode:'production',status:'no_payment',approved:false});
  const result=await confirmPayment(String(id),user.id);
  return reply('error' in result?result.code:200,result);
 }catch{console.error('Production payment confirmation failed');return reply(503,{error:'confirmation_unavailable'});}
}
Deno.serve(handle);