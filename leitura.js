(() => {
  const chapter = document.getElementById('capitulo');
  const smaller = document.getElementById('font-smaller');
  const larger = document.getElementById('font-larger');
  const value = document.getElementById('font-value');
  let size = 20;
  const update = () => {
    chapter.style.setProperty('--reading-size', `${size}px`);
    value.textContent = `${size} px`;
    smaller.disabled = size <= 16;
    larger.disabled = size >= 28;
  };
  smaller.addEventListener('click', () => { size = Math.max(16, size - 2); update(); });
  larger.addEventListener('click', () => { size = Math.min(28, size + 2); update(); });
  document.getElementById('reader-controls').hidden = false;
  update();
})();
