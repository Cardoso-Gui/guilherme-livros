import {confirmPayment} from './payment.ts';
export async function handle(req: Request): Promise<Response> {
 const reply=(status:number,data:Record<string,unknown>)=>Response.json(data,{status});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 const secret=Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
 if(!secret)return reply(503,{error:'webhook_not_configured'});
 const id=new URL(req.url).searchParams.get('data.id')?.trim().toLowerCase();
 const requestId=req.headers.get('x-request-id')?.trim();
 const signature=req.headers.get('x-signature')||'';
 const parts=signature.split(',').map(v=>v.trim().split('='));
 const ts=parts.find(p=>p[0]==='ts')?.[1];
 const hashes=parts.filter(p=>p[0]==='v1').map(p=>p[1]);
 if(!id||!requestId||!ts||!/^\d+$/.test(ts)||!hashes.length)return reply(401,{error:'invalid_signature'});
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const manifest=encoder.encode('id:'+id+';request-id:'+requestId+';ts:'+ts+';');
 let valid=false;
 for(const hash of hashes){
  if(!/^[a-fA-F0-9]{64}$/.test(hash))continue;
  const bytes=new Uint8Array(hash.match(/../g)!.map(h=>parseInt(h,16)));
  if(await crypto.subtle.verify('HMAC',key,bytes,manifest))valid=true;
 }
 if(!valid)return reply(401,{error:'invalid_signature'});
 let event;
 try{event=await req.json();}catch{return reply(400,{error:'invalid_json'});}
 if(event.type!=='payment')return reply(200,{received:true,ignored:true});
 if(String(event.data?.id||'').toLowerCase()!==id)return reply(400,{error:'payment_id_mismatch'});
 if(event.live_mode!==true)return reply(200,{received:true,ignored:true});
 try{
  const result=await confirmPayment(id);
  // Dashboard simulation IDs and unrelated merchant payments have no shop order.
  if('error' in result){
   if(result.code===404)return reply(200,{received:true,ignored:true});
   return reply(result.code,{error:result.error});
  }
  return reply(200,{received:true,access_granted:result.access_granted});
 }catch{console.error('Production webhook confirmation failed');return reply(503,{error:'confirmation_unavailable'});}
}
Deno.serve(handle);
