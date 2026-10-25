// No request/body/header logging. Infrastructure may retain invocation metadata.
const ORIGIN = 'https://cardoso-gui.github.io';
const BOOKS = new Set(['noah', 'labirinto-verde', 'o-quinto-herdeiro']);
export function createHandler({base, serviceKey, fetchImpl = fetch}) {
 return async function handle(req) {
  const headers = {
   'Access-Control-Allow-Origin': ORIGIN,
   'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
   'Access-Control-Allow-Methods': 'POST,OPTIONS',
   'Vary': 'Origin', 'Cache-Control': 'no-store'
  };
  const reply = (status, error) => error
   ? Response.json({error}, {status, headers})
   : new Response(null, {status, headers});
  if (req.headers.get('origin') !== ORIGIN) return reply(403, 'origin_not_allowed');
  if (req.method === 'OPTIONS') return reply(204);
  if (req.method !== 'POST') return reply(405, 'method_not_allowed');
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
   return reply(415, 'json_required');
  if (Number(req.headers.get('content-length')) > 128) return reply(413, 'body_too_large');
  let body;
  try {
   const reader = req.body?.getReader();
   if (!reader) return reply(400, 'invalid_body');
   let size = 0; const chunks = [];
   while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 128) { await reader.cancel(); return reply(413, 'body_too_large'); }
    chunks.push(part.value);
   }
   const bytes = new Uint8Array(size); let offset = 0;
   for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
   body = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  } catch { return reply(400, 'invalid_body'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !BOOKS.has(body.book_slug))
   return reply(400, 'invalid_book');
  if (!base || !serviceKey) return reply(503, 'unavailable');
  try {
   const result = await fetchImpl(base + '/rest/v1/rpc/record_amazon_click', {
    method:'POST',
    headers:{apikey:serviceKey, Authorization:'Bearer '+serviceKey, 'Content-Type':'application/json'},
    body:JSON.stringify({p_book_slug:body.book_slug}),
    signal:AbortSignal.timeout(4000)
   });
   if (!result.ok) return reply(503, 'unavailable');
   const accepted = await result.json();
   if (accepted === true) return reply(204);
   if (accepted === false) return reply(429, 'rate_limited');
   return reply(503, 'unavailable');
  } catch { return reply(503, 'unavailable'); }
 };
}
