/* Revenue position: one strip per market and bedroom count, every other home
   of that size as a gray dot (jittered so dense ranges stay readable), the
   median as a tick, the market's top non-red-room home as a ring, and the red
   rooms in crimson. All markets share one revenue axis so they compare at a
   glance; a single market gets its own axis. */
const Chart = (() => {
  const ROW = 34, GAP = 10, AXIS = 28, TOP = 10, RIGHT = 30;
  let host, hovRing = null;

  function jitter(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) / 4294967295) * 2 - 1;
  }

  /** Round axis step for the data range, with at most one tick per ~56px. */
  function niceScale(max, plotW) {
    const maxTicks = Math.max(2, Math.min(7, Math.floor(plotW / 56)));
    const steps = [5000, 10000, 20000, 25000, 50000, 100000, 200000];
    const step = steps.find((s) => max / s <= maxTicks) || 200000;
    return { step, top: Math.ceil((max * 1.04) / step) * step };
  }

  function legend() {
    const L = document.getElementById("chart-legend");
    const sw = (draw) => { const s = U.svg("svg", { width: 14, height: 14, viewBox: "-7 -7 14 14", "aria-hidden": "true" }); draw(s); return s; };
    L.replaceChildren(
      U.el("span", null, sw((s) => U.svg("circle", { r: 5.5, fill: "var(--rr)" }, s)), "Red room"),
      U.el("span", null, sw((s) => U.svg("circle", { r: 4.5, fill: "#fff", stroke: "var(--rr)", "stroke-width": 2.5 }, s)), "New find"),
      U.el("span", null, sw((s) => U.svg("circle", { r: 3, fill: "var(--context)", "fill-opacity": 0.6 }, s)), "Other homes, same size"),
      U.el("span", null, sw((s) => U.svg("line", { x1: 0, x2: 0, y1: -6, y2: 6, stroke: "var(--ink)", "stroke-width": 2, "stroke-linecap": "round" }, s)), "Median"),
      U.el("span", null, sw((s) => U.svg("circle", { r: 4.5, fill: "#fff", stroke: "var(--ink)", "stroke-width": 1.75 }, s)), "Market max (excl. red rooms)"),
    );
  }

  function render() {
    host = document.getElementById("chart");
    const markets = App.chartMarkets();
    const rooms = App.rooms();
    const W = Math.max(300, host.clientWidth - 8);
    const narrow = W < 560;
    const LBL = narrow ? 112 : 168;
    const plotW = W - LBL - (narrow ? 22 : RIGHT);

    const rows = [];
    markets.forEach((m) => [1, 2].forEach((b, k) => rows.push({
      m, b, first: k === 0, size: m.sizes[b], rooms: rooms.filter((r) => r.market === m.id && r.bedrooms === b),
    })));
    let max = 0;
    rows.forEach((r) => {
      const h = r.size.homes;
      max = Math.max(max, h.length ? h[h.length - 1][0] : 0, ...r.rooms.map((x) => x.revenue));
    });
    const { step, top } = niceScale(max, plotW);
    const x = (v) => LBL + (v / top) * plotW;

    let y = TOP;
    rows.forEach((r, i) => { if (i && r.first) y += GAP; r.y = y + ROW / 2; y += ROW; });
    const H = y + AXIS;

    const s = U.svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
      "aria-label": "Revenue of each market's 1BR and 2BR homes with the red rooms highlighted; the table below lists every red room's values" });
    host.replaceChildren(s); // in the page from the start so labels can be measured

    // market separators, grid and axis
    const grid = U.svg("g", { class: "grid" }, s);
    rows.forEach((r, i) => { if (i && r.first) U.svg("line", { x1: 0, x2: W, y1: r.y - ROW / 2 - GAP / 2, y2: r.y - ROW / 2 - GAP / 2 }, grid); });
    const ax = U.svg("g", { class: "ax" }, s);
    for (let v = 0; v <= top + 1; v += step) {
      U.svg("line", { x1: x(v), x2: x(v), y1: TOP - 4, y2: H - AXIS + 2 }, grid);
      const t = U.svg("text", { x: x(v), y: H - AXIS + 18, "text-anchor": "middle" }, ax);
      t.textContent = v === 0 ? "$0" : U.moneyK(v);
    }


    rows.forEach((r) => {
      // labels: the size (with its home count when there is room), then the
      // market name trimmed to the space left beside it
      const sl = U.svg("text", { class: "lbl-s", x: LBL - 12, y: r.y + 4, "text-anchor": "end" }, s);
      sl.textContent = narrow ? `${r.b}BR` : `${r.b}BR · ${r.size.n}`;
      if (r.first) {
        const t = U.svg("text", { class: "lbl-m" + (narrow ? " lbl-m--sm" : ""), x: 0, y: r.y + 4.5 }, s);
        fitText(t, r.m.name, LBL - 12 - sl.getComputedTextLength() - 8);
      }

      const g = U.svg("g", null, s);
      // hit band for the gray dots (nearest point in the row)
      const band = U.svg("rect", { x: LBL - 6, y: r.y - ROW / 2, width: plotW + 12, height: ROW, fill: "transparent" }, g);
      const rowDots = [];
      for (const [rev, id, title] of r.size.homes) {
        const cx = x(rev), cy = r.y + jitter(id) * 9;
        U.svg("circle", { class: "ctx", cx, cy, r: 2.6 }, g);
        rowDots.push({ kind: "home", rev, id, title, cx, cy, row: r });
      }
      const med = r.size.median;
      U.svg("line", { class: "med", x1: x(med), x2: x(med), y1: r.y - 8, y2: r.y + 8 }, g);
      rowDots.push({ kind: "median", rev: med, cx: x(med), cy: r.y, row: r });
      const tp = r.size.top;
      const topDot = rowDots.find((d) => d.id === tp.id);
      U.svg("circle", { class: "topc", cx: x(tp.revenue), cy: topDot ? topDot.cy : r.y, r: 4.5 }, g);
      if (topDot) topDot.kind = "top";

      band.addEventListener("pointermove", (e) => hoverRow(e, rowDots, s));
      band.addEventListener("pointerleave", () => { U.hideTip(); clearRing(); });

      // red rooms on top, with values as the only direct labels
      const placed = [];
      r.rooms.slice().sort((a, b) => a.revenue - b.revenue).forEach((rm) => {
        const cx = x(rm.revenue);
        const c = U.svg("circle", {
          class: "rr" + (rm.status === "new" ? " rr--new" : ""), cx, cy: r.y, r: rm.status === "new" ? 5.5 : 6.5,
          tabindex: 0, "data-id": rm.id, role: "button",
          "aria-label": `${rm.title}: ${U.money(rm.revenue)}, percentile ${U.pct(rm.pctl12)} among 1–2BR homes`,
        }, s);
        const show = (ev) => {
          const b = ev.type === "focus" ? c.getBoundingClientRect() : null;
          U.showTip(roomTip(rm), b ? b.left + b.width / 2 : ev.clientX, b ? b.top : ev.clientY);
          App.setHot(rm.id);
        };
        c.addEventListener("pointerenter", show);
        c.addEventListener("pointermove", (ev) => U.showTip(roomTip(rm), ev.clientX, ev.clientY));
        c.addEventListener("focus", show);
        c.addEventListener("pointerleave", () => { U.hideTip(); App.setHot(null); });
        c.addEventListener("blur", () => { U.hideTip(); App.setHot(null); });
        c.addEventListener("click", () => App.select(rm.id));
        c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); App.select(rm.id); } });

        const wTxt = 42;
        const clash = placed.some((p) => Math.abs(p - cx) < wTxt);
        const t = U.svg("text", { class: "rr-val", x: cx, y: clash ? r.y + 20 : r.y - 11, "text-anchor": "middle",
          "paint-order": "stroke", stroke: "#fff", "stroke-width": 3, "stroke-linejoin": "round" }, s);
        t.textContent = U.moneyK(rm.revenue);
        if (!clash) placed.push(cx);
      });
    });

    hovRing = null;
    applyHot();
  }

  /** Set an SVG label, trimming it with an ellipsis to maxW (full text as its title). */
  function fitText(t, text, maxW) {
    t.textContent = text;
    if (t.getComputedTextLength() <= maxW) return;
    let n = text.length;
    while (n > 1 && t.getComputedTextLength() > maxW) t.textContent = text.slice(0, --n).trimEnd() + "…";
    U.svg("title", null, t).textContent = text;
  }

  function roomTip(rm) {
    const m = App.marketById[rm.market];
    return [
      U.el("div", null, U.el("b", null, U.money(rm.revenue)), ` · ${m.name} ${rm.bedrooms}BR`),
      U.el("div", null, rm.title),
      U.el("div.t-sub", null, `Percentile ${U.pct(rm.pctl12)} among 1–2BR (#${rm.rank12} of ${rm.n12}) · ${U.times(rm.vsMedian)} median`),
    ];
  }

  function hoverRow(e, rowDots, s) {
    const pt = s.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM().inverse());
    let best = null, bd = Infinity;
    for (const d of rowDots) {
      const dx = Math.abs(d.cx - p.x);
      if (dx > 14) continue;
      const dist = d.kind === "median" ? dx * 1.5 : Math.hypot(dx, (d.cy - p.y) * 0.5);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (!best) { U.hideTip(); clearRing(); return; }
    const r = best.row, b = r.b, m = r.m;
    let lines;
    if (best.kind === "median") lines = [U.el("div", null, U.el("b", null, U.money(best.rev)), ` · median ${m.name} ${b}BR`), U.el("div.t-sub", null, "Other homes of this size, red rooms excluded")];
    else lines = [
      U.el("div", null, U.el("b", null, U.money(best.rev)), ` · ${m.name} ${b}BR`),
      U.el("div", null, best.title),
      best.kind === "top" ? U.el("div.t-sub", null, "Market max (excl. red rooms)") : null,
    ].filter(Boolean);
    U.showTip(lines, e.clientX, e.clientY);
    if (best.kind !== "median") {
      if (!hovRing) hovRing = U.svg("circle", { class: "hov", r: 5 }, s);
      hovRing.setAttribute("cx", best.cx); hovRing.setAttribute("cy", best.cy);
      hovRing.style.display = "";
    } else clearRing();
  }

  const clearRing = () => { if (hovRing) hovRing.style.display = "none"; };

  function applyHot() {
    if (!host) return;
    const hot = App.state.hot;
    host.querySelectorAll("circle.rr").forEach((c) => c.classList.toggle("is-hot", c.dataset.id === hot));
  }

  return { render, legend, applyHot };
})();
