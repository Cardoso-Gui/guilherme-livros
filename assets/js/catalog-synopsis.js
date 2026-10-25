(() => {
  const dialog = document.querySelector(".synopsis-dialog");
  const title = dialog.querySelector("h2");
  const content = dialog.querySelector(".synopsis-content");
  let trigger, overflow;
  document.querySelectorAll(".book-card details").forEach((details) => {
    const card = details.closest(".book-card");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "synopsis-open";
    button.textContent = card.classList.contains("featured-book")
      ? "Ler sinopse"
      : "Sobre o livro";
    button.setAttribute("aria-haspopup", "dialog");
    details.before(button);
    details.hidden = true;
    button.addEventListener("click", () => {
      trigger = button;
      title.textContent = card.querySelector("h3").textContent;
      content.replaceChildren(
        details.querySelector(".book-details").cloneNode(true),
      );
      overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
    });
  });
  dialog
    .querySelector("button")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = overflow;
    trigger?.focus();
  });
})();
