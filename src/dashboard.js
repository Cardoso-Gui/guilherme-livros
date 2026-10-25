import { createClient } from "@supabase/supabase-js";

const config = window.bookAnalytics;
const $ = (id) => document.getElementById(id);
const books = [
  { slug: "noah", title: "Noah: A História Começa", cover: "noah-capa.jpg" },
  {
    slug: "labirinto-verde",
    title: "Labirinto Verde",
    cover: "labirinto-verde-capa.png",
  },
  {
    slug: "o-quinto-herdeiro",
    title: "O Quinto Herdeiro",
    cover: "o-quinto-herdeiro-capa.jpg",
  },
];
const number = new Intl.NumberFormat("pt-BR");
const dayLabel = (day) =>
  day.slice(8, 10) + "/" + day.slice(5, 7) + "/" + day.slice(0, 4);
const iso = (date) => date.toISOString().slice(0, 10);
const shift = (day, delta) => {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + delta);
  return iso(date);
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
let authorized = false,
  generation = 0,
  request,
  loginBusy = false;
const client = createClient(config.projectUrl, config.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      }),
  },
});
function status(message, error = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(error);
}
function clearData() {
  for (const id of ["total-today", "total-week", "total-month"])
    $(id).textContent = "—";
  $("chart").replaceChildren();
  $("books").replaceChildren();
  $("daily-rows").replaceChildren();
  $("daily-details").hidden = true;
  $("empty").hidden = true;
  $("range-label").textContent = "";
}
function endSession(message = "") {
  authorized = false;
  generation++;
  request?.abort();
  clearData();
  $("dashboard").hidden = true;
  $("logout").hidden = true;
  $("login-section").hidden = false;
  $("password").value = "";
  status(message);
}
client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") endSession();
});
function selectedRange() {
  const end = today();
  if ($("period").value !== "custom")
    return { from: shift(end, 1 - Number($("period").value)), to: end };
  const from = $("date-from").value,
    to = $("date-to").value;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to ||
    to > end ||
    from < shift(to, -365)
  )
    throw new Error(
      "Escolha datas válidas, sem datas futuras, em um intervalo de até 366 dias.",
    );
  return { from, to };
}
function svgElement(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
}
function render(rows, range) {
  const end = today(),
    week = shift(end, -6),
    month = shift(end, -29);
  const sum = (from) =>
    rows
      .filter((row) => row.day >= from && row.day <= end)
      .reduce((total, row) => total + row.clicks, 0);
  $("total-today").textContent = number.format(sum(end));
  $("total-week").textContent = number.format(sum(week));
  $("total-month").textContent = number.format(sum(month));
  const selected = rows.filter(
    (row) => row.day >= range.from && row.day <= range.to,
  );
  const series = [];
  for (let day = range.from; day <= range.to; day = shift(day, 1))
    series.push({
      day,
      clicks: selected
        .filter((row) => row.day === day)
        .reduce((n, row) => n + row.clicks, 0),
    });
  const total = series.reduce((n, row) => n + row.clicks, 0);
  $("range-label").textContent =
    `${dayLabel(range.from)} a ${dayLabel(range.to)} · ${number.format(total)} cliques`;
  $("empty").hidden = total !== 0;
  const chartWidth = Math.max(280, Math.min(960, $("chart").clientWidth));
  const svg = svgElement("svg", {
    viewBox: `0 0 ${chartWidth} 260`,
    role: "img",
    "aria-label": `Cliques diários: ${number.format(total)} no período. Os valores completos estão na tabela abaixo.`,
  });
  const max = Math.max(1, ...series.map((row) => row.clicks)),
    step = (chartWidth - 70) / series.length;
  svg.append(
    svgElement("line", {
      x1: 45,
      y1: 215,
      x2: chartWidth - 25,
      y2: 215,
      class: "axis",
    }),
  );
  const maxText = svgElement("text", { x: 8, y: 30 });
  maxText.textContent = number.format(max);
  svg.append(maxText);
  for (let i = 0; i < series.length; i++) {
    const row = series[i],
      height = (row.clicks / max) * 180;
    const bar = svgElement("rect", {
      x: 45 + i * step + Math.min(3, step / 5),
      y: 215 - height,
      width: Math.max(0.8, step - Math.min(6, step / 3)),
      height,
      rx: Math.min(3, step / 4),
      class: "bar",
    });
    const title = svgElement("title");
    title.textContent = `${dayLabel(row.day)}: ${number.format(row.clicks)} cliques`;
    bar.append(title);
    svg.append(bar);
    if (
      i === 0 ||
      i === series.length - 1 ||
      i === Math.floor((series.length - 1) / 2)
    ) {
      const text = svgElement("text", {
        x: 45 + i * step + step / 2,
        y: 242,
        "text-anchor": "middle",
      });
      text.textContent = dayLabel(row.day).slice(0, 5);
      svg.append(text);
    }
    const tr = document.createElement("tr"),
      date = document.createElement("th"),
      value = document.createElement("td");
    date.scope = "row";
    date.textContent = dayLabel(row.day);
    value.textContent = number.format(row.clicks);
    tr.append(date, value);
    $("daily-rows").append(tr);
  }
  $("chart").replaceChildren(svg);
  $("daily-details").hidden = false;
  for (const book of books) {
    const card = document.createElement("article");
    card.className = "book";
    const image = document.createElement("img");
    image.src = "./assets/" + book.cover;
    image.alt = "";
    image.width = 64;
    image.height = 96;
    const content = document.createElement("div"),
      title = document.createElement("h3"),
      count = document.createElement("strong"),
      label = document.createElement("span");
    title.textContent = book.title;
    count.textContent = number.format(
      selected
        .filter((row) => row.book_slug === book.slug)
        .reduce((n, row) => n + row.clicks, 0),
    );
    label.textContent = "cliques na Amazon";
    content.append(title, count, label);
    card.append(image, content);
    $("books").append(card);
  }
}
async function load() {
  if (!authorized) return;
  let range;
  try {
    range = selectedRange();
  } catch (error) {
    status(error.message, true);
    return;
  }
  const id = ++generation;
  request?.abort();
  request = new AbortController();
  clearData();
  $("retry").hidden = true;
  $("dashboard").setAttribute("aria-busy", "true");
  status("Carregando estatísticas…");
  try {
    const start = [range.from, shift(today(), -29)].sort()[0],
      rows = [];
    for (let offset = 0; ; offset += 1000) {
      const {
        data,
        error,
        status: code,
      } = await client
        .from("amazon_click_daily")
        .select("book_slug,day,clicks")
        .gte("day", start)
        .lte("day", today())
        .order("day")
        .order("book_slug")
        .range(offset, offset + 999)
        .abortSignal(request.signal);
      if (id !== generation) return;
      if (error) {
        const failure = new Error(
          "Não foi possível carregar os dados. Tente novamente.",
        );
        failure.code = code;
        throw failure;
      }
      if (
        !Array.isArray(data) ||
        data.some(
          (row) =>
            !books.some((book) => book.slug === row.book_slug) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
            !Number.isSafeInteger(Number(row.clicks)) ||
            Number(row.clicks) < 0,
        )
      )
        throw new Error("O serviço retornou dados inválidos. Tente novamente.");
      rows.push(...data.map((row) => ({ ...row, clicks: Number(row.clicks) })));
      if (data.length < 1000) break;
    }
    if (id !== generation || !authorized) return;
    render(rows, range);
    status("Dados atualizados.");
  } catch (error) {
    if (id !== generation) return;
    clearData();
    if (error.code === 401 || error.code === 403) {
      endSession();
      await client.auth.signOut({ scope: "local" });
      status("Sua sessão expirou ou não tem acesso. Entre novamente.", true);
    } else {
      status(error.message, true);
      $("retry").hidden = false;
    }
  } finally {
    if (id === generation) $("dashboard").setAttribute("aria-busy", "false");
  }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginBusy) return;
  loginBusy = true;
  $("login-submit").disabled = true;
  status("Verificando acesso…");
  try {
    const { error } = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value,
    });
    $("password").value = "";
    if (error)
      throw new Error(
        "Não foi possível entrar. Confira suas credenciais e tente novamente.",
      );
    const owner = await client.rpc("analytics_is_owner");
    if (owner.error) {
      await client.auth.signOut({ scope: "local" });
      throw new Error(
        "Não foi possível verificar seu acesso. Tente novamente.",
      );
    }
    if (owner.data !== true) {
      await client.auth.signOut({ scope: "local" });
      throw new Error("Esta conta não tem acesso às estatísticas.");
    }
    authorized = true;
    $("login-section").hidden = true;
    $("dashboard").hidden = false;
    $("logout").hidden = false;
    await load();
  } catch (error) {
    status(error.message, true);
  } finally {
    loginBusy = false;
    $("login-submit").disabled = false;
  }
});
$("logout").addEventListener("click", async () => {
  endSession();
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    status(
      error
        ? "Painel fechado. Não foi possível confirmar o encerramento no servidor. Recarregue esta página."
        : "Você saiu do painel.",
      Boolean(error),
    );
  } catch (_) {
    status("Painel fechado. Recarregue a página para encerrar esta aba.", true);
  }
  $("email").focus();
});
$("period").addEventListener("change", () => {
  $("custom-dates").hidden = $("period").value !== "custom";
});
$("range-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void load();
});
$("refresh").addEventListener("click", () => void load());
$("retry").addEventListener("click", () => void load());
$("date-from").value = shift(today(), -29);
$("date-to").value = today();
$("date-from").max = today();
$("date-to").max = today();
$("timezone-note").textContent =
  "Datas no fuso de Brasília (America/Sao_Paulo).";
