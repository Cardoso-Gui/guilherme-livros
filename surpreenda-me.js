(() => {
 'use strict';
 // Add only published, freely accessible first chapters to this list.
 const previews = ['./o-quinto-herdeiro-capitulo-1.html','./noah-capitulo-1.html','./labirinto-verde-capitulo-1.html'];
 document.querySelectorAll('[data-surprise-reading]').forEach(link => {
  const choose = () => {
   if (previews.length) link.href = previews[Math.floor(Math.random() * previews.length)];
  };
  choose();
  link.addEventListener('click', choose);
  link.addEventListener('auxclick', choose);
 });
})();
