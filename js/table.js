/* The red room table: one row per property, sortable, synced with the map
   and chart (hover highlights, click flies the map to it). */
const Table = (() => {
  const COLS = [
    { key: "market", label: "Market", sort: (r) => App.marketRank(r.market) * 1e7 - r.revenue },
    { key: "title", label: "Property", sort: (r) => r.title.toLowerCase() },
    { key: "bedrooms", label: "BR", num: true, sort: (r) => r.bedrooms },
    { key: "revenue", label: "Est. revenue", num: true, tip: "Estimated annual revenue (Revenue Potential)" },
    { key: "pctl12", label: "Percentile · 1–2BR", num: true, tip: "Share of the market's 1BR and 2BR homes earning the same or less" },
    { key: "vsMedian", label: "× median", num: true, tip: "Revenue ÷ the median of the market's other homes with the same bedroom count" },
    { key: "vsTop1", label: "vs max 1BR", num: true, tip: "Difference to the market's highest-earning 1BR (red rooms excluded)" },
    { key: "vsTop2", label: "vs max 2BR", num: true, tip: "Difference to the market's highest-earning 2BR (red rooms excluded)" },
    { key: "adr", label: "ADR", num: true, tip: "Average daily rate" },
    { key: "occupancy", label: "Occ.", num: true, tip: "Occupancy" },
  ];
  let sort = { key: "market", dir: 1 };

  function head() {
    return U.el("thead", null, U.el("tr", null, COLS.map((c) => {
      const active = sort.key === c.key;
      return U.el("th", {
        class: c.num ? "num" : null, scope: "col", title: c.tip || null,
        "aria-sort": active ? (sort.dir > 0 ? "ascending" : "descending") : null,
      }, U.el("button", { type: "button", on: { click: () => setSort(c.key) } },
        c.label, U.el("span.arr", { "aria-hidden": "true" }, active && sort.dir < 0 ? "▼" : "▲")));
    })));
  }

  function setSort(key) {
    const c = COLS.find((x) => x.key === key);
    if (sort.key === key) sort.dir = -sort.dir;
    else sort = { key, dir: c.num ? -1 : 1 };
    render();
  }

  function sorted(rows) {
    const c = COLS.find((x) => x.key === sort.key);
    const f = c.sort || ((r) => r[c.key]);
    return rows.slice().sort((a, b) => {
      const va = f(a), vb = f(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }

  function delta(v, top, b, m) {
    const up = v >= 0;
    return U.el("td.num", null,
      U.el("span", { class: up ? "up" : "down" }, (up ? "▲ " : "▼ ") + U.signed(v)),
      U.el("span.sub", null, U.el("a.max-link", {
        href: `https://www.airbnb.com/rooms/${top.id}`, target: "_blank", rel: "noopener",
        title: `${m.name}'s top ${b}BR: ${top.title}`, on: { click: (e) => e.stopPropagation() },
      }, `max ${U.money(top.revenue)}`)));
  }

  function row(r) {
    const m = App.marketById[r.market];
    const pill = r.status === "new"
      ? U.el("span.pill.pill--new", { title: `Found by ${r.foundBy}, not yet confirmed: ${r.evidence}` }, "● New find")
      : U.el("span.pill.pill--confirmed", { title: r.evidence }, "✓ Confirmed");
    const meta = [];
    if (r.rating) meta.push(`★ ${r.rating.toFixed(2)}`);
    if (r.reviews != null) meta.push(`${r.reviews} reviews`);
    return U.el("tr", {
      "data-id": r.id, tabindex: 0,
      on: {
        mouseenter: () => App.setHot(r.id), mouseleave: () => App.setHot(null),
        focus: () => App.setHot(r.id), blur: () => App.setHot(null),
        click: () => App.select(r.id),
        keydown: (e) => { if (e.key === "Enter" && e.target === e.currentTarget) App.select(r.id); },
      },
    },
      U.el("td.mkt", null, m.name, U.el("span.sub", null, `${m.state} · ${U.monthYear(m.snapshot)} data`)),
      U.el("td.prop", null,
        U.el("a", { href: r.url, target: "_blank", rel: "noopener", on: { click: (e) => e.stopPropagation() } }, r.title, U.extIcon()),
        U.el("span.sub", null, pill, meta.join(" · "),
          r.inCleaned ? null : U.el("span.pill.pill--new", { title: "Missing from the workbook's Cleaned_Data (its listing scrape failed); ranked as if it were in the set" }, "not in cleaned set"))),
      U.el("td.num", null, String(r.bedrooms)),
      U.el("td.num", null, U.el("span.big", null, U.money(r.revenue))),
      U.el("td.num", null, U.el("span.big", null, U.pct(r.pctl12)),
        U.el("span.meter", { "aria-hidden": "true" }, U.el("i", { style: `width:${r.pctl12}%` })),
        U.el("span.sub", null, `#${r.rank12} of ${r.n12}`)),
      U.el("td.num", null, U.times(r.vsMedian), U.el("span.sub", null, `median ${U.money(m.sizes[r.bedrooms].median)}`)),
      delta(r.vsTop1, m.sizes["1"].top, 1, m),
      delta(r.vsTop2, m.sizes["2"].top, 2, m),
      U.el("td.num", null, U.money(r.adr)),
      U.el("td.num", null, U.share(r.occupancy)));
  }

  function render() {
    const rows = sorted(App.rooms());
    const tbl = document.getElementById("tbl");
    const body = U.el("tbody", null, rows.length ? rows.map(row)
      : U.el("tr.empty", null, U.el("td", { colspan: COLS.length }, "No red rooms match these filters")));
    tbl.replaceChildren(head(), body);
    document.getElementById("tbl-count").textContent = rows.length ? `· ${rows.length}` : "";
    applyHot();
  }

  function applyHot() {
    const hot = App.state.hot;
    document.querySelectorAll("#tbl tbody tr[data-id]").forEach((tr) => tr.classList.toggle("is-hot", tr.dataset.id === hot));
  }

  return { render, applyHot };
})();
