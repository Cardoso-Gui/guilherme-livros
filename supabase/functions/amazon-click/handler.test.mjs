import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './handler.js';
const origin = 'https://cardoso-gui.github.io';
const request = (body, options={}) => new Request('https://example.test/functions/v1/amazon-click', {
 method:'POST', headers:{origin,'content-type':'application/json',...options.headers},
 body: typeof body === 'string' ? body : JSON.stringify(body), ...options
});
test('accept only three book slugs and send only slug to backend', async()=>{
 for(const book_slug of ['noah','labirinto-verde','o-quinto-herdeiro']) {
  let called=0;
  const handle=createHandler({base:'https://example.test',serviceKey:'test-only',fetchImpl:async(url,opts)=>{
   called++; assert.equal(url,'https://example.test/rest/v1/rpc/record_amazon_click');
   assert.deepEqual(JSON.parse(opts.body),{p_book_slug:book_slug});return Response.json(true);
  }});
  assert.equal((await handle(request({book_slug}))).status,204);assert.equal(called,1);
 }
});
test('invalid payload never calls backend',async()=>{
 let called=0;
 const handle=createHandler({base:'https://example.test',serviceKey:'test-only',fetchImpl:async()=>{called++;return Response.json(true)}});
 for(const body of [{book_slug:'unknown'},{book_slug:'noah',user_id:'x'},null,[],{},'bad-json']) {
  assert.equal((await handle(request(body))).status,400);
 }
 assert.equal(called,0);
});
test('method/origin/content type/body limit guards',async()=>{
 let called=0;
 const handle=createHandler({base:'https://example.test',serviceKey:'test-only',fetchImpl:async()=>{called++;return Response.json(true)}});
 assert.equal((await handle(new Request('https://example.test',{headers:{origin}}))).status,405);
 assert.equal((await handle(request({book_slug:'noah'},{headers:{origin:'https://attacker.test','content-type':'application/json'}}))).status,403);
 assert.equal((await handle(request({book_slug:'noah'},{headers:{origin,'content-type':'text/plain'}}))).status,415);
 assert.equal((await handle(request('x'.repeat(129)))).status,413);
 const preflight=await handle(new Request('https://example.test',{method:'OPTIONS',headers:{origin}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('cache-control'),'no-store');
 assert.equal(called,0);
});
test('rate cap and failures never retry',async()=>{
 for(const [result,status] of [[false,429],[{unexpected:true},503]]) {
  let calls=0;const handle=createHandler({base:'https://example.test',serviceKey:'test-only',fetchImpl:async()=>{calls++;return Response.json(result)}});
  assert.equal((await handle(request({book_slug:'noah'}))).status,status);assert.equal(calls,1);
 }
 const fail=createHandler({base:'https://example.test',serviceKey:'test-only',fetchImpl:async()=>{throw Error('secret')}});
 assert.equal((await fail(request({book_slug:'noah'}))).status,503);
 const missing=createHandler({});
 assert.equal((await missing(request({book_slug:'noah'}))).status,503);
});
