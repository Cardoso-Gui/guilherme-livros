(() => {
  const dialog = document.querySelector(".cover-dialog");
  const content = dialog.querySelector(".cover-dialog-content");
  let trigger, previousOverflow;
  function openCover(event) {
    event.preventDefault();
    trigger = event.currentTarget;
    const source = trigger.querySelector("img");
    content.replaceChildren();
    if (source) {
      const image = document.createElement("img");
      image.src = source.src;
      image.alt = source.alt;
      content.append(image);
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "cover-preview-placeholder";
      const clone = trigger.cloneNode(true);
      clone.removeAttribute("data-cover-zoom");
      clone.removeAttribute("tabindex");
      clone.setAttribute("role", "img");
      wrapper.append(clone);
      content.append(wrapper);
    }
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
  }
  document.querySelectorAll("[data-cover-zoom]").forEach((el) => {
    el.addEventListener("click", openCover);
    if (el.tagName !== "A")
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openCover(event);
      });
  });
  dialog
    .querySelector("button")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    if (trigger) trigger.focus();
  });
})();
