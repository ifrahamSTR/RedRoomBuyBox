/* App state and wiring: market chips, status switch, KPI tiles, URL hash.
   Every view reads App.rooms(), so the map, chart, tiles and table always
   show the same slice. */
const App = (() => {
  const data = window.RR_DATA;
  const marketById = Object.fromEntries(data.markets.map((m) => [m.id, m]));
  const roomById = Object.fromEntries(data.redrooms.map((r) => [r.id, r]));
  const state = { market: "all", status: "all", hot: null, deepDive: null };
  const hasDeepDive = () => typeof DeepDive !== "undefined" && window.DEEPDIVE;
  const STATUSES = [["all", "All"], ["confirmed", "Confirmed"], ["new", "New finds"]];

  const statusOk = (r) => state.status === "all" || r.status === state.status;
  const rooms = () => data.redrooms.filter((r) => statusOk(r) && (state.market === "all" || r.market === state.market));

  /** Markets with a red room under the status filter: most red rooms first,
      then markets with a confirmed one, then the config order. */
  function chipMarkets() {
    const c = {};
    data.redrooms.filter(statusOk).forEach((r) => {
      const x = (c[r.market] = c[r.market] || { n: 0, conf: 0 });
      x.n++;
      if (r.status === "confirmed") x.conf++;
    });
    return data.markets.filter((m) => c[m.id]).map((m) => ({ m, ...c[m.id] }))
      .sort((a, b) => b.n - a.n || (b.conf > 0) - (a.conf > 0) || a.m.order - b.m.order);
  }
  const chartMarkets = () => (state.market === "all" ? chipMarkets().map((x) => x.m) : [marketById[state.market]]);
  const marketRank = (id) => {
    const i = chipMarkets().findIndex((x) => x.m.id === id);
    return i < 0 ? 99 : i;
  };

  // ---------- filters ----------
  function renderChips() {
    const list = chipMarkets();
    const total = list.reduce((s, x) => s + x.n, 0);
    const chip = (id, label, n, extra) => U.el("button", {
      type: "button", class: "chip" + (id === "all" ? " chip--all" : ""),
      "aria-pressed": String(state.market === id), title: extra || null,
      on: { click: () => setMarket(id) },
    }, label, U.el("span", { class: "chip__n" + (extra ? " chip__n--new" : "") }, String(n)));
    document.getElementById("chips").replaceChildren(
      chip("all", "All markets", total),
      ...list.map((x) => chip(x.m.id, x.m.name, x.n, x.conf ? null : "New finds only, not yet confirmed")));
  }

  function renderSeg() {
    document.getElementById("seg").replaceChildren(...STATUSES.map(([k, label]) => U.el("button", {
      type: "button", role: "radio", "aria-checked": String(state.status === k),
      on: { click: () => setStatus(k) },
    }, label)));
  }

  // ---------- KPI tiles ----------
  function renderKpis() {
    const rs = rooms();
    const conf = rs.filter((r) => r.status === "confirmed").length;
    const tile = (label, value, sub) => U.el("div.kpi", null,
      U.el("div.kpi__label", null, label), U.el("div.kpi__value", null, value), U.el("div.kpi__sub", null, sub));
    const med = (k) => U.median(rs.map((r) => r[k]));
    const parts = [];
    if (conf) parts.push(`${conf} confirmed`);
    if (rs.length - conf) parts.push(`${rs.length - conf} new`);
    document.getElementById("kpis").replaceChildren(
      tile("Red rooms", String(rs.length), parts.join(" · ") || "–"),
      tile("Median est. revenue", rs.length ? U.moneyK(med("revenue")) : "–", "1BR & 2BR"),
      tile("Median percentile", rs.length ? U.pct(med("pctl12")) : "–", "among the market's 1–2BR homes"),
      tile("Median vs typical", rs.length ? U.times(med("vsMedian")) : "–", "the market's median, same size"));
  }

  // ---------- state changes ----------
  function renderAll(fly) {
    renderChips();
    renderSeg();
    renderKpis();
    MapView.update(fly);
    Chart.render();
    Table.render();
    writeHash();
  }

  function setMarket(id) {
    if (!(id === "all" || chipMarkets().some((x) => x.m.id === id))) id = "all";
    state.market = id;
    state.hot = null;
    renderAll(true);
  }

  function setStatus(s) {
    state.status = s;
    state.hot = null;
    const keep = state.market === "all" || chipMarkets().some((x) => x.m.id === state.market);
    if (!keep) state.market = "all";
    renderAll(!keep);
  }

  function setHot(id) {
    if (state.hot === id) return;
    state.hot = id;
    MapView.applyHot();
    Chart.applyHot();
    Table.applyHot();
  }

  function select(id) {
    setHot(id);
    MapView.goTo(id);
    const top = document.getElementById("map").getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + top - 84, behavior: "smooth" });
    }
  }

  // ---------- URL hash (#market=houston&status=confirmed) ----------
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const s = p.get("status");
    state.status = STATUSES.some(([k]) => k === s) ? s : "all";
    const m = p.get("market");
    state.market = m && chipMarkets().some((x) => x.m.id === m) ? m : "all";
    const dd = p.get("deep-dive");
    state.deepDive = dd && window.DEEPDIVE && DEEPDIVE.tabs.some((t) => t.id === dd) ? dd : null;
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (state.market !== "all") p.set("market", state.market);
    if (state.status !== "all") p.set("status", state.status);
    if (state.deepDive) p.set("deep-dive", state.deepDive);
    const h = p.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }

  function footer() {
    const d = new Date(data.generated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    document.getElementById("meta").textContent = `Updated ${d}`;
    const snaps = data.markets.slice().sort((a, b) => a.order - b.order)
      .map((m) => `${m.name} ${U.monthYear(m.snapshot)}`).join(" · ");
    document.getElementById("foot").replaceChildren(
      U.el("p", null, "Revenue: Revenue Potential from each market's Market Eval workbook (Cleaned_Data, entire homes). Percentile: share of the market's 1BR and 2BR homes earning the same or less; blue on the map marks the top 10%. Median and max: the market's other homes of that size, red rooms excluded."),
      U.el("p", null, `Data: ${snaps}`));
  }

  function init() {
    readHash();
    footer();
    Chart.legend();
    MapView.init();
    renderAll(state.market !== "all");
    if (hasDeepDive()) DeepDive.init(state.deepDive); // #deep-dive=blue-ridge opens that tab
    if (document.fonts) document.fonts.ready.then(() => Chart.render()); // labels are measured
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(Chart.render, 150); });
    window.addEventListener("hashchange", () => {
      const before = state.market;
      readHash();
      renderAll(before !== state.market);
      if (hasDeepDive() && state.deepDive) DeepDive.open(state.deepDive, true);
    });
  }

  /** A deep-dive tab was chosen: keep it in the URL. */
  function setDeepDive(id) { state.deepDive = id; writeHash(); }

  return { data, state, marketById, roomById, rooms, chartMarkets, marketRank, setHot, select, setDeepDive, init };
})();

document.addEventListener("DOMContentLoaded", App.init);
