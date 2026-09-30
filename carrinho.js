(() => {
'use strict';
const KEY = 'guilherme-livros-cart-v1';
// Display prices only. A future checkout must validate products and prices server-side.
const products = {'o-quinto-herdeiro': {title:'O Quinto Herdeiro',price:1490,cover:'./assets/o-quinto-herdeiro-capa.jpg'}};
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value / 100);
function clean(value){return Array.isArray(value)?[...new Set(value.filter(id=>Object.hasOwn(products,id)))]:[];}
let cart = [];
try {cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));} catch (_) {}
const feedback = text => {const node=document.getElementById('cart-feedback');if(node)node.textContent=text;};
function save(){try {localStorage.setItem(KEY,JSON.stringify(cart));return true;}catch(_){return false;}}
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
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){try{cart=clean(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch(_){cart=[];}render();}});
render();
})();