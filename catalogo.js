(() => {
 const form = document.querySelector('#catalog-filters');
 const grid = document.querySelector('.discover-page .book-grid');
 if (!form || !grid) return;
 const cards = Array.from(grid.querySelectorAll('.book-card'));
 const search = form.elements.search, theme = form.elements.theme, saga = form.elements.saga, year = form.elements.year, order = form.elements.order;
 const status = document.querySelector('#catalog-results');
 const empty = document.querySelector('#catalog-empty');
 const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
 for (const [select, key] of [[theme, 'theme'], [saga, 'saga'], [year, 'year']]) {
   const values = [...new Set(cards.flatMap(card => key === 'theme' ? card.dataset.theme.split('|') : [card.dataset[key]]))];
   values.sort((a, b) => key === 'year' ? (Number(b) || 0) - (Number(a) || 0) : a.localeCompare(b, 'pt-BR'));
   values.forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); });
 }
 function apply() {
   const query = normalize(search.value);
   const sorted = cards.slice();
   if (order.value === 'az' || order.value === 'za') sorted.sort((a,b) => a.dataset.title.localeCompare(b.dataset.title, 'pt-BR') * (order.value === 'az' ? 1 : -1));
   if (order.value === 'newest' || order.value === 'oldest') sorted.sort((a,b) => {
     const ay = Number(a.dataset.year), by = Number(b.dataset.year);
     if (!ay || !by) return !ay === !by ? 0 : !ay ? 1 : -1;
     return (ay-by) * (order.value === 'newest' ? -1 : 1);
   });
   let count = 0;
   sorted.forEach(card => {
     card.hidden = !(normalize(card.dataset.title).includes(query) && (!theme.value || card.dataset.theme.split('|').includes(theme.value)) && (!saga.value || card.dataset.saga === saga.value) && (!year.value || card.dataset.year === year.value));
     if (!card.hidden) count++;
     grid.append(card);
   });
   status.textContent = count === 1 ? '1 livro encontrado' : count + ' livros encontrados';
   empty.hidden = count !== 0;
 }
 form.addEventListener('submit', event => event.preventDefault());
 search.addEventListener('input', apply);
 [theme, saga, year, order].forEach(control => control.addEventListener('change', apply));
 function reset() { form.reset(); apply(); search.focus(); }
 form.querySelector('button').addEventListener('click', reset);
 empty.querySelector('button').addEventListener('click', reset);
 form.hidden = false;
 apply();
})();