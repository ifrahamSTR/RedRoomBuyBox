/* Market Deep Dive + "Inside the red rooms". Data: js/deepdive.js (generated
   by scripts/build_deepdive_blue_ridge.py); photos: the tab's manifest.json
   (every image classified by eye). Image helpers mirror the Clearwater site's
   photo(src, alt, caption) + photoFigure + shared lightbox, with stepping
   through a listing's gallery. */
const DeepDive = (() => {
  const D = window.DEEPDIVE;
  const GALLERY_ORDER = ["themed-bedroom", "playroom", "kink-equipment"];
  const manifests = {};
  let active = null;

  // ---- photo helpers (reference pattern) ----
  const photo = (src, alt, caption, focus) => ({ file: src, alt: alt || caption || "", caption: caption || "", focus });
  const fromManifest = (m) => photo(m.file, m.caption, m.caption);

  function photoFigure(p, opts = {}) {
    const fig = U.el("figure.dd-photo" + (opts.cls ? "." + opts.cls : ""));
    const btn = U.el("button.dd-photo__btn", { type: "button", "aria-label": "Expand image: " + p.alt });
    const img = U.el("img", { src: p.file, alt: p.alt, loading: "lazy", decoding: "async", style: p.focus ? `object-position:${p.focus}` : null });
    btn.append(img);
    btn.addEventListener("click", () => openLightbox(opts.list || [p], opts.index || 0));
    fig.append(btn);
    if (opts.caption !== false && p.caption) fig.append(U.el("figcaption", null, opts.label || p.caption));
    return fig;
  }

  // ---- lightbox: one overlay, steps through a list ----
  let lb = { list: [], i: 0, lastFocus: null };
  function showLightbox() {
    const p = lb.list[lb.i];
    const img = document.getElementById("lightbox-image");
    img.src = p.file; img.alt = p.alt;
    document.getElementById("lightbox-caption").textContent = p.caption + (lb.list.length > 1 ? `  ·  ${lb.i + 1} / ${lb.list.length}` : "");
    document.getElementById("lightbox-prev").hidden = document.getElementById("lightbox-next").hidden = lb.list.length < 2;
  }
  function openLightbox(list, i) {
    lb = { list, i, lastFocus: document.activeElement };
    showLightbox();
    const o = document.getElementById("lightbox");
    o.classList.add("lightbox--open"); o.setAttribute("aria-hidden", "false");
    document.getElementById("lightbox-close").focus();
  }
  function closeLightbox() {
    const o = document.getElementById("lightbox");
    if (!o.classList.contains("lightbox--open")) return;
    o.classList.remove("lightbox--open"); o.setAttribute("aria-hidden", "true");
    document.getElementById("lightbox-image").src = "";
    if (lb.lastFocus) lb.lastFocus.focus();
  }
  const step = (d) => { if (lb.list.length > 1) { lb.i = (lb.i + d + lb.list.length) % lb.list.length; showLightbox(); } };
  function bindLightbox() {
    document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
    document.getElementById("lightbox-prev").addEventListener("click", () => step(-1));
    document.getElementById("lightbox-next").addEventListener("click", () => step(1));
    document.getElementById("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
    document.addEventListener("keydown", (e) => {
      if (!document.getElementById("lightbox").classList.contains("lightbox--open")) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }

  // ---- helpers ----
  const pct0 = (v) => Math.round(v * 100) + "%";
  const k1 = (v) => "$" + (v / 1000).toFixed(1) + "K"; // $117.7K, as specified
  const imgsOf = (man, id, cat) => man.images.filter((m) => m.listingId === id && (!cat || m.category === cat));
  const compLink = (c) => U.el("a.dd-link", { href: c.url, target: "_blank", rel: "noopener" }, c.name, U.extIcon());
  const cap1 = (x) => x ? x[0].toUpperCase() + x.slice(1) : "";
  /** A finding (green) or caveat (amber) set apart from the visuals, so it is read, not skipped. */
  const callout = (text, kind = "find") => text ? U.el("p", { class: "dd-callout dd-callout--" + kind },
    U.el("span.dd-callout__k", null, kind === "find" ? "Key finding" : "Caveat"), U.el("span", null, text)) : null;
  const head = (title, note) => [U.el("div.dd-head", null, U.el("h3", null, title)), callout(note)];

  /** First photo of a category: the top comp's if it has one, else the next comp by revenue. */
  function pick(t, man, cat) {
    for (const c of t.comps) { const m = imgsOf(man, c.id, cat)[0]; if (m) return { m, comp: c }; }
    return null;
  }

  // ---- sections ----
  function hero(t, man) {
    const top = t.comps[0], b = t.bench, H = t.hero || {};
    const ext = H.photo ? imgsOf(man, top.id).find((m) => m.file.endsWith("/" + H.photo)) : imgsOf(man, top.id, "exterior")[0];
    const tile = (label, value, sub) => U.el("div.kpi", null, U.el("div.kpi__label", null, label), U.el("div.kpi__value", null, value), U.el("div.kpi__sub", null, sub));
    return U.el("div.dd-block", null,
      ext ? U.el("div.dd-hero", null, photoFigure(fromManifest(ext), { caption: false }),
        U.el("div.dd-hero__tag", null, H.tag || `${top.name} · ${top.br}BR ${top.note} · ${k1(top.revenue)}`)) : null,
      t.kpis ? U.el("div.kpis.dd-kpis", null, t.kpis.map((k) => tile(k.label, (k.sign ? "+" : "") + k1(k.value), k.sub))) :
      U.el("div.kpis.dd-kpis", null,
        tile("Comp avg revenue", k1(b.compAvgRevenue), `${t.comps.length} red rooms`),
        tile("Floor", k1(b.compFloor) + "+", "lowest comp"),
        tile("Avg ADR · occupancy", `${U.money(b.compAvgAdr)} · ${pct0(b.compAvgOcc)}`, "comps"),
        tile("Market 2BR median", k1(b.market2brMedian), "red rooms excluded")));
  }

  function mustHaves(t, man) {
    const tiles = (t.mustHaves || [{ cat: "playroom", label: "Kink playroom" }, { cat: "hot-tub", label: "Hot tub" },
      { cat: "sauna", label: "Sauna", badge: t.saunaBadge }, { cat: "fire-pit", label: "Fire pit" }, { cat: "outdoor-dining", label: "Outdoor dining" }]);
    const row = U.el("div.dd-strip", { style: `--n:${tiles.length}` });
    tiles.forEach(({ cat, label, badge }) => {
      const hit = pick(t, man, cat);
      const fig = hit ? photoFigure(fromManifest(hit.m), { caption: false }) : U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, "No photo"));
      const cap = U.el("figcaption", null, U.el("b", null, label), hit && hit.comp !== t.comps[0] ? U.el("span.dd-src", null, hit.comp.name) : null);
      fig.append(cap);
      if (badge) fig.append(U.el("span.dd-badge", null, badge));
      row.append(fig);
    });
    return U.el("div.dd-block", null, head("Must-haves"), row);
  }

  function matrix(t) {
    const max = Math.max(...t.comps.map((c) => c.revenue));
    const k = t.amenities.length;
    const cell = (v) => U.el("td", { class: "dd-m dd-m--" + (v ? "yes" : "no") }, String(v));
    const tbl = U.el("table.dd-matrix", null,
      U.el("thead", null, U.el("tr", null, U.el("th", { scope: "col" }, "Listing"), U.el("th", { scope: "col" }, "Revenue"),
        t.amenities.map((a) => U.el("th", { scope: "col", class: "dd-m-h" }, a.label)), U.el("th", { scope: "col", class: "dd-m-h" }, "Score"))),
      U.el("tbody", null, t.comps.map((c, i) => U.el("tr", { class: i === 0 ? "dd-top" : null },
        U.el("th", { scope: "row" }, compLink(c), U.el("span.dd-sub", null, `${c.br}BR`)),
        U.el("td.dd-rev", null, U.el("span.dd-bar", null, U.el("i", { style: `width:${(c.revenue / max) * 100}%` })), U.el("span", null, k1(c.revenue))),
        t.amenities.map((a) => cell(c.amenities[a.key])),
        U.el("td.dd-score", null, `${c.score}/${k}`)))),
      U.el("tfoot", null,
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Comps with it"), t.amenities.map((a) => U.el("td", null, `${a.comps}/${t.comps.length}`)), U.el("td")),
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Market 1–2BR"), t.amenities.map((a) => U.el("td", null, pct0(a.market))), U.el("td")),
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Top 10% 1–2BR"), t.amenities.map((a) => U.el("td", null, pct0(a.top10))), U.el("td"))));
    const full = t.comps.filter((c) => c.score === k).length;
    return U.el("div.dd-block", null,
      head("Amenity matrix", t.matrixNote || `${full} of ${t.comps.length} comps have all ${k} amenities; only ${t.bench.all4} of ${t.bench.n12} ${t.label.split(",")[0]} 1–2BRs do.`),
      U.el("div.dd-scroll", { tabindex: 0, role: "region", "aria-label": "Amenity matrix" }, tbl));
  }

  function designPremium(t, man) {
    const card = (id) => {
      const c = t.comps.find((x) => x.id === id);
      const ext = imgsOf(man, id, "exterior")[0];
      return U.el("div.dd-card" + (id === t.comps[0].id ? ".dd-top" : ""), null,
        ext ? photoFigure(fromManifest(ext), { caption: false }) : U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, "No exterior photo")),
        U.el("div.dd-card__body", null,
          U.el("div.dd-card__name", null, compLink(c), U.el("span.dd-sub", null, `${c.score}/${t.amenities.length}`)),
          U.el("div.dd-card__build", null, cap1(c.note)),
          U.el("div.dd-chips", null, (t.designPremium.shared || []).map((x) => U.el("span.dd-chip", null, x))),
          U.el("div.dd-card__stats", null, U.el("b", null, U.money(c.revenue)), ` · ADR ${U.money(c.adr)} · ${pct0(c.occupancy)} occ.`)));
    };
    return U.el("div.dd-block", null, head("Design premium", t.designPremium.takeaway),
      U.el("div.dd-pair", null, card(t.designPremium.a), card(t.designPremium.b)));
  }

  // ---- acquisition target: does the house and lot have room for the must-haves? ----
  const SRC = { listing: "listing", notes: "your notes", photo: "photo", search: "search result" };
  const VERDICT = { fits: "Fits", likely: "Likely", tight: "Tight", unknown: "Unknown" };
  const srcTag = (s) => U.el("span.dd-tag", null, SRC[s] || s);

  /** One acquisition target: a compact card that expands to the full check. */
  function target(T, man) {
    const L = T.lines, pr = T.price;
    const list = imgsOf(man, T.id).map(fromManifest);
    const pic = (file, opts = {}) => {
      if (!file) return null;
      const k = list.findIndex((p) => p.file.endsWith("/" + file));
      return k < 0 ? U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, "No photo")) : photoFigure(list[k], { list, index: k, ...opts });
    };
    const fmtDate = new Date(T.checked + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // price vs the comp file's price-to-rent lines
    const top = Math.ceil((L.p25 * 1.1) / 50000) * 50000;
    const at = (v) => `${(v / top) * 100}%`;
    const mark = (v, cls, label) => U.el("span", { class: "dd-scale__mark " + cls, style: `left:${at(v)}` }, U.el("span.dd-scale__label", null, label));
    const scale = U.el("div.dd-scale", { role: "img", "aria-label": `Price ${U.money(pr.value)} against the 30% line ${U.money(L.p30)} and the 25% line ${U.money(L.p25)}` },
      U.el("div.dd-scale__track", null, U.el("i", { style: `width:${at(pr.value)}` })),
      mark(L.p30, "dd-scale__line", `30% line ${k1(L.p30)}`),
      mark(L.p25, "dd-scale__line dd-scale__line--25", `25% line ${k1(L.p25)}`),
      pr.earlier ? mark(pr.earlier, "dd-scale__was", `was ${k1(pr.earlier)}`) : null,
      mark(pr.value, "dd-scale__now", `${k1(pr.value)} now`));
    const under = pr.value < L.p30;
    const key = (cls, text) => U.el("span", null, U.el("i", { class: cls }), text);
    const legend = U.el("div.dd-scale-legend", null,  // shown instead of the in-bar labels on phones
      key("dd-k dd-k--now", `${k1(pr.value)} now`), pr.earlier ? key("dd-k dd-k--was", `was ${k1(pr.earlier)}`) : null,
      key("dd-k dd-k--line", `30% line ${k1(L.p30)}`), key("dd-k dd-k--line", `25% line ${k1(L.p25)}`));

    const fit = U.el("div.dd-fit", null, T.fit.map((f) => U.el("div.dd-fit__card", null,
      pic(f.photo, { caption: false }),
      U.el("div.dd-fit__body", null,
        U.el("div.dd-fit__top", null, U.el("b", null, f.item), U.el("span", { class: "dd-pill dd-pill--" + f.verdict }, VERDICT[f.verdict])),
        U.el("div.dd-fit__where", null, f.where),
        U.el("div.dd-fit__ev", null, f.evidence),
        U.el("div.dd-fit__comps", null, f.comps)))));

    const lines = (arr) => U.el("ul.dd-list", null, arr.map((x) => U.el("li", null, x.text, " ", srcTag(x.src))));
    const thumb = list.find((p) => p.file.endsWith("/" + T.thumb)) || list[0];
    const counts = {};
    T.fit.forEach((f) => { counts[f.verdict] = (counts[f.verdict] || 0) + 1; });
    const summary = U.el("summary.dd-tsum", null,
      thumb ? U.el("img.dd-tsum__img", { src: thumb.file, alt: thumb.alt, loading: "lazy" }) : U.el("span.dd-tsum__img.dd-tsum__img--none", null, "No photos"),
      U.el("div.dd-tsum__main", null,
        U.el("div.dd-tsum__title", null, T.name, U.el("span.dd-sub", null, T.address.split(", ").slice(1).join(", "))),
        U.el("div.dd-tsum__price", null, U.el("b", null, U.money(pr.value)), ` · ${pr.status} · checked ${fmtDate}`),
        U.el("div.dd-chips", null, (T.chips || []).map((c) => U.el("span.dd-chip", null, c)),
          U.el("span.dd-chip", null, `${pct0(L.yieldNow)} of price / yr at comp avg`),
          Object.keys(VERDICT).filter((v) => counts[v]).map((v) => U.el("span", { class: "dd-pill dd-pill--" + v }, `${VERDICT[v]} ${counts[v]}`)))),
      U.el("span.dd-tsum__toggle", { "aria-hidden": "true" }));
    return U.el("details.dd-target", null, summary, U.el("div.dd-target__body", null,
      U.el("div.dd-head", null, U.el("a.dd-link", { href: T.url, target: "_blank", rel: "noopener" }, "View listing", U.extIcon())),
      U.el("div.dd-target__top", null,
        pic(T.thumb, { caption: false }),
        U.el("div.dd-target__facts", null,
          U.el("div.dd-price", null, U.el("b", null, U.money(pr.value)), U.el("span", null, `${pr.status} · checked ${fmtDate}`), srcTag(pr.src)),
          pr.earlier ? U.el("div.dd-price__was", null, `Was ${U.money(pr.earlier)}, ${pr.earlierNote} `, srcTag(pr.earlierSrc)) : null,
          U.el("dl.dd-facts", null, T.facts.map((f) => U.el("div", null, U.el("dt", null, f.label), U.el("dd", null, f.value, " ", srcTag(f.src))))))),
      U.el("div.dd-sub-block", null,
        U.el("h4", null, "Price vs the comp file's lines"),
        scale, legend,
        callout((under ? "Below the 30% line" : "Above the 30% line") +
          `: a year at the comp average (${k1(L.compAvg)}) = ${pct0(L.yieldNow)} of the price` +
          (L.yieldEarlier ? ` (${pct0(L.yieldEarlier)} at ${k1(pr.earlier)}).` : "."))),
      U.el("div.dd-sub-block", null, U.el("h4", null, "Room for the must-haves"), fit),
      U.el("div.dd-sub-block", null,
        U.el("div.dd-pair", null,
          U.el("div.dd-card", null, pic(T.seclusionPhoto, { caption: false }), U.el("div.dd-card__body", null, U.el("div.dd-card__name", null, "Seclusion"), lines(T.seclusion))),
          U.el("div.dd-card", null, pic(T.viewPhoto, { caption: false }), U.el("div.dd-card__body", null, U.el("div.dd-card__name", null, "View"), lines(T.view))))),
      U.el("div.dd-sub-block", null, U.el("h4", null, "Risks"),
        U.el("ul.dd-risks", null, T.risks.map((r) => U.el("li", null, U.el("span.dd-risks__icon", { "aria-hidden": "true" }, "!"), U.el("b", null, r.flag), U.el("span", null, r.detail))))),
      U.el("p.dd-sources", null, "Sources: ", T.sources.flatMap((x, k) => [k ? " · " : "", U.el("a", { href: x.url, target: "_blank", rel: "noopener" }, x.label)]),
        ` · checked ${fmtDate}.` + (T.sourceNote ? " " + T.sourceNote : ""))));
  }

  function targets(t, man) {
    const el = document.getElementById("dd-targets");
    if (!el) return;
    const ts = t.targets || [];
    document.getElementById("dd-targets-count").textContent = ts.length ? `· ${ts.length}` : "";
    el.replaceChildren(...(ts.length ? ts.map((T) => target(T, man)) : [U.el("p.dd-note", null, "No targets yet.")]));
  }

  // ---- revenue ladder: plain home -> + water -> + red room ----
  function ladder(t, man) {
    const L = t.ladder, byId = Object.fromEntries(t.comps.map((c) => [c.id, c]));
    const ph = (id) => {
      const m = imgsOf(man, id).find((x) => x.file.endsWith("/" + L.photos[id]));
      return m ? photoFigure(fromManifest(m), { caption: false }) : null;
    };
    const card = (id) => {
      const c = byId[id];
      return U.el("div.dd-card" + (c.role === "red" ? ".dd-top" : ""), null, ph(id),
        U.el("div.dd-card__body", null,
          U.el("div.dd-card__name", null, compLink(c)),
          U.el("div.dd-card__build", null, cap1(c.note)),
          U.el("div.dd-card__stats", null, U.el("b", null, U.money(c.revenue)), ` · #${c.rank} of ${t.bench.n12}`),
          U.el("div.dd-card__stats.dd-card__stats--tight", null, `${U.money(Math.round(c.adr))} a night · ${pct0(c.occupancy)} booked`)));
    };
    const step = (g) => U.el("div.dd-step", null,
      U.el("span.dd-step__arrow", { "aria-hidden": "true" }, "→"),
      U.el("b", null, "+" + U.money(g.value)), U.el("span", null, `+${(g.pct * 100).toFixed(1)}%`),
      U.el("span.dd-step__label", null, g.label));
    return U.el("div.dd-block", null,
      head("Revenue ladder", `+${U.money(L.total.value)} (+${(L.total.pct * 100).toFixed(1)}%) from a plain home to waterfront + red room. ${L.takeaway}`),
      U.el("div.dd-ladder", null, card(L.steps[0]), step(L.gaps[0]), card(L.steps[1]), step(L.gaps[1]), card(L.steps[2])),
      callout(L.caveat, "caveat"));
  }

  // ---- buy box: what to buy, and the price bands ----
  function buyBox(t) {
    const B = t.buyBox;
    const max = Math.ceil((Math.max(...B.bases.map((b) => b.p20)) * 1.08) / 50000) * 50000;
    const at = (v) => (v / max) * 100;
    return U.el("div.dd-block", null, head("Buy box"),
      U.el("div.dd-buybox", null,
        U.el("ul.dd-criteria", null, B.criteria.map((c) => U.el("li", null,
          U.el("span.dd-check", { "aria-hidden": "true" }, "✓"), U.el("b", null, c.label), U.el("span", null, c.why)))),
        U.el("div.dd-bands", null,
          U.el("h4", null, "Price where a year's revenue = 30% → 20% of price"),
          B.bases.map((b) => U.el("div.dd-band", null,
            U.el("div.dd-band__label", null, b.label),
            U.el("div.dd-band__track", null, U.el("span.dd-band__fill", { style: `left:${at(b.p30)}%;width:${at(b.p20) - at(b.p30)}%` })),
            U.el("div.dd-band__vals", null, `30% ${k1(b.p30)} · 25% ${k1(b.p25)} · 20% ${k1(b.p20)}`))),
          U.el("div.dd-band__axis", null, U.el("span", null, "$0"), U.el("span", null, k1(max))))));
  }

  // ---- "Inside the red rooms": one scrolling gallery per comp ----
  function gallery(t, man, c, i) {
    const imgs = GALLERY_ORDER.flatMap((cat) => imgsOf(man, c.id, cat));
    const list = imgs.map(fromManifest);
    const track = U.el("div.dd-gallery__track", { tabindex: 0, role: "region", "aria-label": `${c.name} photos` });
    if (!imgs.some((m) => m.category === "themed-bedroom")) {
      track.append(U.el("div.dd-warn", null, "No themed-bedroom photo for this listing"));
      console.warn("Deep dive: no themed-bedroom photo for listing", c.id);
    }
    list.forEach((p, k) => track.append(photoFigure(p, { cls: "dd-slide", list, index: k })));
    const prev = U.el("button.dd-gallery__nav.dd-gallery__nav--prev", { type: "button", "aria-label": `Previous ${c.name} photos` }, "‹");
    const next = U.el("button.dd-gallery__nav.dd-gallery__nav--next", { type: "button", "aria-label": `Next ${c.name} photos` }, "›");
    const pageBy = (d) => track.scrollBy({ left: d * track.clientWidth * 0.85, behavior: "smooth" });
    prev.addEventListener("click", () => pageBy(-1));
    next.addEventListener("click", () => pageBy(1));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); pageBy(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); pageBy(1); }
    });
    const sync = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    requestAnimationFrame(sync);
    track.querySelectorAll("img").forEach((im) => im.addEventListener("load", sync, { once: true }));
    return U.el("div.dd-gallery" + (i === 0 ? ".dd-top" : ""), null,
      U.el("div.dd-gallery__head", null,
        U.el("h3", null, compLink(c)), U.el("span.dd-sub", null, `${c.br}BR · ${U.money(c.revenue)}`),
        U.el("a", { href: c.url, target: "_blank", rel: "noopener" }, "Airbnb listing", U.extIcon())),
      U.el("div.dd-gallery__frame", null, prev, track, next));
  }

  // ---- tabs ----
  function renderTabs() {
    document.getElementById("dd-tabs").replaceChildren(...D.tabs.map((t) => U.el("button", {
      type: "button", role: "tab", "aria-selected": String(t.id === active), class: "dd-tab",
      on: { click: () => { open(t.id); App.setDeepDive(t.id); } },
    }, t.label, U.el("span.dd-tab__kind", null, t.kind))));
  }

  async function open(id, scroll) {
    const t = D.tabs.find((x) => x.id === id) || D.tabs[0];
    active = t.id;
    renderTabs();
    document.querySelectorAll(".dd-market").forEach((e) => { e.textContent = t.label; });
    const body = document.getElementById("dd-body"), gal = document.getElementById("dd-galleries");
    if (t.comingSoon) {
      body.replaceChildren(U.el("div.dd-soon", null, U.el("b", null, "Coming soon"), U.el("span", null, `${t.label} deep dive`)));
      gal.replaceChildren(U.el("div.dd-soon", null, U.el("b", null, "Coming soon")));
      document.getElementById("dd-targets").replaceChildren(U.el("div.dd-soon", null, U.el("b", null, "Coming soon")));
      document.getElementById("dd-targets-count").textContent = "";
    } else {
      let man = manifests[t.id];
      if (!man) {
        try { man = manifests[t.id] = await (await fetch(t.manifest)).json(); }
        catch (e) { man = { images: [], gaps: [] }; console.warn("Deep dive photos need the site served over http(s):", e.message); }
      }
      if (active !== t.id) return;
      body.replaceChildren(hero(t, man), mustHaves(t, man), t.ladder ? ladder(t, man) : "", matrix(t),
        t.designPremium ? designPremium(t, man) : "", t.buyBox ? buyBox(t) : "");
      gal.replaceChildren(...t.comps.filter((c) => c.redRoom !== false).map((c, i) => gallery(t, man, c, i)));
      targets(t, man);
    }
    if (scroll) document.getElementById("deep-dive").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init(id) {
    bindLightbox();
    open(id || D.tabs[0].id, !!id);
  }

  return { init, open, photo, openLightbox };
})();
