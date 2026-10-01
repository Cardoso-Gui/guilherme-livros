(() => {
 'use strict';
 const chapter=document.getElementById('capitulo'),smaller=document.getElementById('font-smaller'),larger=document.getElementById('font-larger'),value=document.getElementById('font-value');
 if(!chapter||!smaller||!larger||!value)return;
 let size=14,key='reader-font:preview';
 const valid=n=>[12,14,16,18,20].includes(n);
 function update(save=false){
  const paragraphs=[...chapter.querySelectorAll('p')],anchor=paragraphs.find(p=>p.getBoundingClientRect().bottom>140);
  const before=anchor?.getBoundingClientRect().top;
  chapter.style.setProperty('--reading-size',size+'px');value.textContent=size+' px';smaller.disabled=size<=12;larger.disabled=size>=20;
  if(save){
   if(anchor)window.scrollBy({top:anchor.getBoundingClientRect().top-before,behavior:'instant'});
   try{localStorage.setItem(key,String(size));}catch(_){}
   window.dispatchEvent(new CustomEvent('reading-font-change',{detail:{size}}));
  }
 }
 smaller.addEventListener('click',()=>{size=Math.max(12,size-2);update(true);});
 larger.addEventListener('click',()=>{size=Math.min(20,size+2);update(true);});
 window.addEventListener('reader-preferences',event=>{
  key='reader-font:'+event.detail.user_id;
  let saved;try{saved=Number(localStorage.getItem(key));}catch(_){}
  size=valid(event.detail.font_size)?event.detail.font_size:valid(saved)?saved:14;
  update();
 });
 if(!window.livrosAuthClient){try{const stored=Number(localStorage.getItem(key));if(valid(stored))size=stored;}catch(_){}}
 document.getElementById('reader-controls').hidden=false;update();
})();