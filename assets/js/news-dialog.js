(() => {
  const dialog = document.createElement("dialog");
  dialog.className = "news-dialog";
  dialog.setAttribute("aria-labelledby", "news-dialog-title");
  dialog.innerHTML =
    '<div class="news-dialog-top"><span>Entre páginas · Notícia completa</span><button type="button" class="news-dialog-close" aria-label="Fechar notícia" autofocus>×</button></div><div class="news-dialog-content"></div>';
  document.body.append(dialog);
  const body = dialog.querySelector(".news-dialog-content");
  let opener = null,
    previousOverflow = "";
  dialog
    .querySelector(".news-dialog-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus();
    body.replaceChildren();
  });
  document.querySelectorAll(".news-grid article").forEach((card) => {
    const full = Array.from(card.children).map((child) =>
      child.cloneNode(true),
    );
    const title = card.querySelector("h3"),
      meta = card.querySelector(".news-meta"),
      excerpt = card.querySelector("p");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "news-open";
    button.textContent = "Ler notícia ↗";
    button.setAttribute("aria-label", "Ler notícia: " + title.textContent);
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", () => {
      opener = button;
      body.replaceChildren(...full.map((child) => child.cloneNode(true)));
      body.querySelector("h3").id = "news-dialog-title";
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
      dialog.scrollTop = 0;
    });
    card.replaceChildren(meta, title, ...(excerpt ? [excerpt] : []), button);
    card.classList.add("news-preview");
  });
})();
