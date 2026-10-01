(() => {
'use strict';
const KEY = 'guilherme-livros-cart-v1';
// Display prices only. A future checkout must validate products and prices server-side.
const products = {'o-quinto-herdeiro': {title:'O Quinto Herdeiro',price:1490,cover:'./assets/o-quinto-herdeiro-capa.jpg'}};
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value / 100);
function clean(value){return Array.isArray(value)?[...new Set(value.filter(id=>Object.hasOwn(products,id)))]:[];}
let accountKey = localStorage.getItem(KEY+':active') || KEY + ':guest';
let cart = [];
try {cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));} catch (_) {}
if(localStorage.getItem(accountKey)===null)localStorage.setItem(accountKey,JSON.stringify(cart));
const feedback = text => {const node=document.getElementById('cart-feedback');if(node)node.textContent=text;};
function save(){try {localStorage.setItem(KEY,JSON.stringify(cart));localStorage.setItem(accountKey,JSON.stringify(cart));localStorage.setItem(KEY+':active',accountKey);return true;}catch(_){return false;}}
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
document.querySelectorAll('[data-cart-add]').forEach(button=>button.addEventListener('click',()=>{
 const id=button.dataset.cartAdd;if(!Object.hasOwn(products,id))return;
 if(cart.includes(id)){location.assign('./carrinho.html');return;}
 cart.push(id);const saved=save();render();
 const status=button.parentElement.querySelector('[role="status"]');if(status)status.textContent=saved?'Livro adicionado! Você pode continuar escolhendo.':'Livro selecionado, mas este navegador não permitiu salvar o carrinho.';
}));
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){try{cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch(_){cart=[];}save();render();}});
render();
let currentUser = accountKey===KEY+':guest'?null:accountKey.slice(KEY.length+1);
function switchAccount(session){
 const userId=session?.user?.id||null;
 const nextKey=KEY+':'+(userId||'guest');
 if(nextKey===accountKey && currentUser===userId)return;
 localStorage.setItem(accountKey,JSON.stringify(cart));
 const stored=localStorage.getItem(nextKey);
 const guest=clean(JSON.parse(localStorage.getItem(KEY+':guest')||'[]'));
 cart=stored===null ? (userId?guest:[]) : clean(JSON.parse(stored));
 if(userId && stored===null)localStorage.setItem(KEY+':guest','[]');
 currentUser=userId;accountKey=nextKey;save();render();
}
const client=window.livrosAuthClient;
window.cartReady=client ? client.auth.getSession().then(({data,error})=>{
 if(!error)switchAccount(data.session);
 return markOwned();
}).catch(()=>{}) : Promise.resolve();
client?.auth.onAuthStateChange((_event,session)=>{
 // Avoid awaiting Auth calls inside the Supabase callback.
 setTimeout(()=>{try{switchAccount(session);markOwned();}catch(_){}},0);
});
async function markOwned(){
 const client=window.livrosAuthClient;if(!client)return;
 try{
  const identity=await client.auth.getUser();if(identity.error||!identity.data.user)return;
  const access=await client.from('book_access').select('book_id');
  if(access.error)return;
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