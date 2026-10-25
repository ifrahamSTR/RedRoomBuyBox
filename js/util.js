/* Shared helpers: number formats, a small DOM builder (text always goes in
   via textContent -- listing titles are scraped data), and the one tooltip. */
const U = (() => {
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  const money = (v) => (v == null ? "–" : "$" + nf0.format(Math.round(v)));
  const moneyK = (v) => {
    if (v == null) return "–";
    const k = v / 1000;
    return "$" + (k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")) + "K";
  };
  const signed = (v) => (v == null ? "–" : (v >= 0 ? "+" : "−") + money(Math.abs(v)));
  const pct = (v, nd = 1) => (v == null ? "–" : v.toFixed(nd) + "%");
  const share = (v) => (v == null ? "–" : Math.round(v * 100) + "%");
  const times = (v) => (v == null ? "–" : v.toFixed(2) + "×");
  const monthYear = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  const median = (xs) => {
    const s = xs.filter((x) => x != null).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  /** el("a.cls", {href}, child...) -- strings become text nodes. */
  function el(spec, attrs, ...kids) {
    const [tag, ...cls] = spec.split(".");
    const n = document.createElement(tag || "div");
    if (cls.length) n.className = cls.join(" ");
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "on") Object.entries(v).forEach(([ev, fn]) => n.addEventListener(ev, fn));
        else if (k === "style") n.style.cssText = v;
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return n;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  const extIcon = () => {
    const s = svg("svg", { width: 11, height: 11, viewBox: "0 0 12 12", "aria-hidden": "true" });
    svg("path", { d: "M4.5 2H2v8h8V7.5M7 2h3v3M10 2 5.5 6.5", fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
    return s;
  };

  // ---- the shared tooltip ----
  const tipEl = () => document.getElementById("tip");
  function showTip(lines, x, y) {
    const t = tipEl();
    t.replaceChildren(...lines);
    t.hidden = false;
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 16;
    t.style.left = left + "px";
    t.style.top = top + "px";
  }
  const hideTip = () => { tipEl().hidden = true; };

  return { money, moneyK, signed, pct, share, times, monthYear, median, el, svg, extIcon, showTip, hideTip };
})();
