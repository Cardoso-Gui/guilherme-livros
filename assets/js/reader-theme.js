(() => {
  const themeKey = document.currentScript.dataset.themeKey;
  const button = document.getElementById("reader-theme-toggle");
  function render() {
    const dark = document.documentElement.dataset.readerTheme === "dark";
    button.setAttribute("aria-pressed", String(dark));
  }
  button.hidden = false;
  render();
  button.addEventListener("click", () => {
    const dark = document.documentElement.dataset.readerTheme !== "dark";
    document.documentElement.dataset.readerTheme = dark ? "dark" : "light";
    try {
      localStorage.setItem(themeKey, dark ? "dark" : "light");
    } catch (_) {}
    render();
  });
})();
