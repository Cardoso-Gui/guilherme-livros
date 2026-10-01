(() => {
'use strict';
const KEY = 'guilherme-livros-cart-v1';
// Display prices only. A future checkout must validate products and prices server-side.
const products = {'o-quinto-herdeiro': {title:'O Quinto Herdeiro',price:1490,cover:'./assets/o-quinto-herdeiro-capa.jpg'}};
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value / 100);
function clean(value){return Array.isArray(value)?[...new Set(value.filter(id=>Object.hasOwn(products,id)))]:[];}
let accountKey = localStorage.getItem(KEY+':active') || KEY + ':guest';
let cart = [],cloudReady=false,revision=0,lastSaved=null;
let currentUser = accountKey===KEY+':guest'?null:accountKey.slice(KEY.length+1);
const client=window.livrosAuthClient;
try {cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));} catch (_) {}
if(localStorage.getItem(accountKey)===null)localStorage.setItem(accountKey,JSON.stringify(cart));
const feedback = text => {const node=document.getElementById('cart-feedback');if(node)node.textContent=text;};
function save(sync=true){
 const stamp=new Date().toISOString();
 let saved=true;
 try{localStorage.setItem(KEY,JSON.stringify(cart));localStorage.setItem(accountKey,JSON.stringify(cart));localStorage.setItem(KEY+':active',accountKey);if(sync){localStorage.setItem(accountKey+':updated',stamp);localStorage.setItem(accountKey+':dirty','1');}}catch(_){saved=false;}
 if(sync&&cloudReady&&currentUser&&client){
  const row={user_id:currentUser,items:[...cart],updated_at:stamp};
  lastSaved=(lastSaved||Promise.resolve()).then(()=>currentUser===row.user_id?client.from('account_carts').upsert(row,{onConflict:'user_id'}):({error:null})).then(({error})=>{if(!error&&localStorage.getItem(KEY+':'+row.user_id+':updated')===row.updated_at)localStorage.removeItem(KEY+':'+row.user_id+':dirty');if(error)feedback('Seu carrinho está salvo neste navegador. Não foi possível sincronizar com sua conta agora.');}).catch(()=>{});
  window.cartSynced=lastSaved;
 }
 return saved;
}
function render(){
 document.querySelectorAll('[data-cart-count]').forEach(node=>{node.textContent=String(cart.length);node.closest('a').setAttribute('aria-label','Carrinho, '+cart.length+(cart.length===1?' livro':' livros'));});
 document.querySelectorAll('[data-book-price]').forEach(node=>{const p=products[node.dataset.bookPrice];if(p)node.textContent=p.price===null?'Preço a definir':money(p.price);});
 document.querySelectorAll('[data-cart-add]').forEach(button=>{button.textContent=cart.includes(button.dataset.cartAdd)?'Ver no carrinho':'Adicionar ao carrinho';});
 const list=document.getElementById('cart-items');if(!list)return;
 document.getElementById('cart-empty').hidden=cart.length>0;
 document.getElementById('cart-content').hidden=cart.length===0;
 list.replaceChildren();
 for(const id of cart){
  const p=products[id],li=document.createElement('li');li.className='cart-item';
  const img=document.createElement('img');img.src=p.cover;img.alt='Capa de '+p.title;
  const info=document.createElement('div');info.className='cart-item-info';
  const title=document.createElement('h2');title.textContent=p.title;
  const format=document.createElement('p');format.textContent='E-book · 1 unidade';
  const price=document.createElement('strong');price.textContent=p.price===null?'Preço a definir':money(p.price);
  const remove=document.createElement('button');remove.type='button';remove.className='cart-remove';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+p.title);
  remove.addEventListener('click',()=>{cart=cart.filter(item=>item!==id);const saved=save();render();feedback(p.title+' removido.'+(saved?'':' A alteração só vale nesta página.'));document.querySelector('.cart-remove, #cart-empty a')?.focus();});
  info.append(title,format,price);li.append(img,info,remove);list.append(li);
 }
 document.getElementById('cart-total').textContent=cart.some(id=>products[id].price===null)?'A definir':money(cart.reduce((sum,id)=>sum+products[id].price,0));
}
document.querySelectorAll('[data-cart-add]').forEach(button=>button.addEventListener('click',async()=>{
 await window.cartReady;
 const id=button.dataset.cartAdd;if(!Object.hasOwn(products,id))return;
 if(cart.includes(id)){location.assign('./carrinho.html');return;}
 cart.push(id);const saved=save();render();
 const status=button.parentElement.querySelector('[role="status"]');if(status)status.textContent=saved?'Livro adicionado! Você pode continuar escolhendo.':'Livro selecionado, mas este navegador não permitiu salvar o carrinho.';
}));
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){try{cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch(_){cart=[];}save();render();}});
render();
async function switchAccount(session){
 const ticket=++revision;
 const userId=session?.user?.id||null;
 const nextKey=KEY+':'+(userId||'guest');
 const changed=nextKey!==accountKey;
 cloudReady=false;
 if(changed){
  try{localStorage.setItem(accountKey,JSON.stringify(cart));}catch(_){}
  let guest=[],stored=null;
  try{stored=localStorage.getItem(nextKey);guest=clean(JSON.parse(localStorage.getItem(KEY+':guest')||'[]'));}catch(_){}
  cart=stored===null ? (userId?guest:[]) : clean(JSON.parse(stored));
  if(userId&&guest.length){cart=clean([...cart,...guest]);localStorage.setItem(KEY+':guest','[]');localStorage.setItem(nextKey+':updated',new Date().toISOString());}
  currentUser=userId;accountKey=nextKey;save(false);render();
 }
 if(!userId)return;
 try{
  const remote=await client.from('account_carts').select('items,updated_at').eq('user_id',userId).maybeSingle();
  if(ticket!==revision||currentUser!==userId)return;
  if(remote.error)throw remote.error;
  let stamp,dirty=false;try{stamp=localStorage.getItem(accountKey+':updated');dirty=localStorage.getItem(accountKey+':dirty')==='1';}catch(_){}
  if(remote.data&&!dirty&&(!stamp||Date.parse(remote.data.updated_at)>=Date.parse(stamp))){
   cart=clean(remote.data.items);localStorage.setItem(accountKey+':updated',remote.data.updated_at);
  }
  cloudReady=true;save(dirty||!remote.data||(stamp&&Date.parse(stamp)>Date.parse(remote.data.updated_at)));render();
  await markOwned(ticket);
 }catch(_){if(ticket===revision)await markOwned(ticket);}
}
let activation=null,requestedUser;
function activate(session){
 const id=session?.user?.id||null;
 if(activation&&requestedUser===id)return activation;
 requestedUser=id;
 activation=switchAccount(session);
 window.cartReady=activation;
 return activation;
}
window.cartReady=client ? client.auth.getSession().then(({data,error})=>{
 if(error)return;
 return activation||activate(data.session);
}).catch(()=>{}) : Promise.resolve();
client?.auth.onAuthStateChange((_event,session)=>{
 // Defer database/Auth calls until Supabase finishes its auth callback.
 window.cartReady=Promise.resolve().then(()=>activate(session));
});
async function markOwned(ticket=revision){
 const client=window.livrosAuthClient;if(!client)return;
 try{
  const identity=await client.auth.getUser();if(identity.error||!identity.data.user)return;
  const access=await client.from('book_access').select('book_id');
  if(access.error||ticket!==revision||identity.data.user.id!==currentUser)return;
  const owned=new Set(access.data.map(row=>row.book_id));
  document.querySelectorAll('[data-cart-add]').forEach(button=>{
   if(!owned.has(button.dataset.cartAdd))return;
   button.removeAttribute('data-cart-add');button.textContent='Na sua biblioteca';
   button.disabled=true;
   const parent=button.parentElement;
   const link=document.createElement('a');link.className='text-link';link.href='./biblioteca.html';link.textContent='Abrir minha biblioteca ↗';parent.append(link);
  });
  if(cart.some(id=>owned.has(id))){
   cart=cart.filter(id=>!owned.has(id));save();render();
   feedback('Um livro que você já possui foi removido do carrinho. Ele está em Minha biblioteca.');
  }
 }catch(_){}
}
})();