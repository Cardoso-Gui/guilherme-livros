(() => {
  "use strict";
  const config = window.bookAnalytics;
  if (!config?.collectUrl || !config.collectAnonKey) return;
  const destinations = Object.freeze({
    noah: "https://www.amazon.com.br/dp/B0HM9GLSB1",
    "labirinto-verde": "https://www.amazon.com.br/dp/B0HN2QSW7V",
    "o-quinto-herdeiro": "https://www.amazon.com.br/dp/B0HM9DHVTN",
  });
  function track(event) {
    // Keyboard activation produces a primary click. Middle buttons use auxclick only.
    if (
      !event.isTrusted ||
      event.defaultPrevented ||
      (event.type === "click" ? event.button !== 0 : event.button !== 1)
    )
      return;
    const link = event.target.closest?.("a[data-amazon-book]");
    const slug = link?.dataset.amazonBook;
    if (
      !Object.prototype.hasOwnProperty.call(destinations, slug) ||
      link.href !== destinations[slug]
    )
      return;
    try {
      void fetch(config.collectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.collectAnonKey}`,
        },
        body: JSON.stringify({ book_slug: slug }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
      }).catch(() => {});
    } catch (_) {
      /* Navigation must also survive a synchronous fetch failure. */
    }
  }
  document.addEventListener("click", track);
  document.addEventListener("auxclick", track);
})();
