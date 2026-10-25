(() => {
  const grid = document.querySelector(".news-updates .news-grid");
  const cards = Array.from(grid.children).map((node, index) => {
    const topic = node.querySelector(".news-category").textContent.trim();
    return {
      node,
      index,
      topic,
      category: ["Lançamentos", "Próximas histórias"].includes(topic)
        ? "Literatura"
        : "Atualizações",
      date: Date.parse(node.querySelector("time").dateTime) || 0,
    };
  });
  const controls = document.querySelector(".news-controls"),
    topics = controls.querySelector(".news-topics"),
    subtopics = document.querySelector(".news-literature"),
    order = document.getElementById("news-order"),
    count = document.getElementById("news-count");
  let selected = "Todos",
    sub = "Toda a literatura",
    page = 1;
  const PAGE_SIZE = 15,
    pagination = document.getElementById("news-pagination");
  const buttons = [],
    subButtons = [];
  function apply() {
    const filtered = cards
      .filter(
        (card) =>
          (selected === "Todos" || card.category === selected) &&
          (selected !== "Literatura" ||
            sub === "Toda a literatura" ||
            card.topic === sub),
      )
      .sort(
        (a, b) =>
          (order.value === "oldest" ? a.date - b.date : b.date - a.date) ||
          a.index - b.index,
      );
    const visible = filtered.length,
      pages = Math.max(1, Math.ceil(visible / PAGE_SIZE));
    page = Math.min(page, pages);
    cards.forEach((card) => {
      card.node.hidden = true;
    });
    filtered.forEach((card, index) => {
      card.node.hidden =
        index < (page - 1) * PAGE_SIZE || index >= page * PAGE_SIZE;
      grid.append(card.node);
    });
    pagination.replaceChildren();
    pagination.hidden = pages <= 1;
    function pageButton(label, target, current = false) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = target < 1 || target > pages;
      if (current) button.setAttribute("aria-current", "page");
      if (typeof label === "number")
        button.setAttribute("aria-label", "Página " + label);
      button.addEventListener("click", () => {
        page = target;
        apply();
        count.tabIndex = -1;
        count.focus({ preventScroll: true });
        controls.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pagination.append(button);
    }
    if (pages > 1) {
      pageButton("← Anterior", page - 1);
      for (let n = 1; n <= pages; n++) pageButton(n, n, n === page);
      pageButton("Próxima →", page + 1);
    }
    subtopics.hidden = selected !== "Literatura";
    buttons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.textContent === selected),
      ),
    );
    subButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.textContent === sub)),
    );
    count.textContent =
      (visible === 1 ? "1 aviso encontrado" : visible + " avisos encontrados") +
      (visible
        ? " · Mostrando " +
          ((page - 1) * PAGE_SIZE + 1) +
          "–" +
          Math.min(page * PAGE_SIZE, visible)
        : "");
  }
  function addButtons(values, parent, collection, onSelect) {
    values.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.addEventListener("click", () => {
        onSelect(value);
        page = 1;
        apply();
      });
      parent.append(button);
      collection.push(button);
    });
  }
  addButtons(
    ["Todos", "Literatura", "Atualizações"],
    topics,
    buttons,
    (value) => {
      selected = value;
      sub = "Toda a literatura";
    },
  );
  addButtons(
    ["Toda a literatura", "Lançamentos", "Próximas histórias"],
    subtopics,
    subButtons,
    (value) => {
      sub = value;
    },
  );
  order.addEventListener("change", () => {
    page = 1;
    apply();
  });
  controls.hidden = false;
  apply();
})();
