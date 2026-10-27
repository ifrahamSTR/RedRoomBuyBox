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
  const head = (title, note) => U.el("div.dd-head", null, U.el("h3", null, title), note ? U.el("p.dd-note", null, note) : null);

  /** First photo of a category: the top comp's if it has one, else the next comp by revenue. */
  function pick(t, man, cat) {
    for (const c of t.comps) { const m = imgsOf(man, c.id, cat)[0]; if (m) return { m, comp: c }; }
    return null;
  }

  // ---- sections ----
  function hero(t, man) {
    const top = t.comps[0], b = t.bench;
    const ext = imgsOf(man, top.id, "exterior")[0];
    const tile = (label, value, sub) => U.el("div.kpi", null, U.el("div.kpi__label", null, label), U.el("div.kpi__value", null, value), U.el("div.kpi__sub", null, sub));
    return U.el("div.dd-block", null,
      ext ? U.el("div.dd-hero", null, photoFigure(fromManifest(ext), { caption: false }),
        U.el("div.dd-hero__tag", null, `${top.name} · ${top.br}BR ${top.note} · ${k1(top.revenue)}`)) : null,
      U.el("div.kpis.dd-kpis", null,
        tile("Comp avg revenue", k1(b.compAvgRevenue), `${t.comps.length} red rooms`),
        tile("Floor", k1(b.compFloor) + "+", "lowest comp"),
        tile("Avg ADR · occupancy", `${U.money(b.compAvgAdr)} · ${pct0(b.compAvgOcc)}`, "comps"),
        tile("Market 2BR median", k1(b.market2brMedian), "red rooms excluded")));
  }

  function mustHaves(t, man) {
    const tiles = [["playroom", "Kink playroom"], ["hot-tub", "Hot tub"], ["sauna", "Sauna"], ["fire-pit", "Fire pit"], ["outdoor-dining", "Outdoor dining"]];
    const row = U.el("div.dd-strip");
    tiles.forEach(([cat, label]) => {
      const hit = pick(t, man, cat);
      const fig = hit ? photoFigure(fromManifest(hit.m), { caption: false }) : U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, "No photo"));
      const cap = U.el("figcaption", null, U.el("b", null, label), hit && hit.comp !== t.comps[0] ? U.el("span.dd-src", null, hit.comp.name) : null);
      fig.append(cap);
      if (cat === "sauna") fig.append(U.el("span.dd-badge", null, t.saunaBadge));
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
        U.el("th", { scope: "row" }, c.name, U.el("span.dd-sub", null, `${c.br}BR`)),
        U.el("td.dd-rev", null, U.el("span.dd-bar", null, U.el("i", { style: `width:${(c.revenue / max) * 100}%` })), U.el("span", null, k1(c.revenue))),
        t.amenities.map((a) => cell(c.amenities[a.key])),
        U.el("td.dd-score", null, `${c.score}/${k}`)))),
      U.el("tfoot", null,
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Comps with it"), t.amenities.map((a) => U.el("td", null, `${a.comps}/${t.comps.length}`)), U.el("td")),
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Market 1–2BR"), t.amenities.map((a) => U.el("td", null, pct0(a.market))), U.el("td")),
        U.el("tr", null, U.el("th", { scope: "row", colspan: 2 }, "Top 10% 1–2BR"), t.amenities.map((a) => U.el("td", null, pct0(a.top10))), U.el("td"))));
    const full = t.comps.filter((c) => c.score === k).length;
    return U.el("div.dd-block", null,
      head("Amenity matrix", `${full} of ${t.comps.length} comps have all ${k} amenities; only ${t.bench.all4} of ${t.bench.n12} Blue Ridge 1–2BRs do.`),
      U.el("div.dd-scroll", { tabindex: 0, role: "region", "aria-label": "Amenity matrix" }, tbl));
  }

  function designPremium(t, man) {
    const card = (id) => {
      const c = t.comps.find((x) => x.id === id);
      const ext = imgsOf(man, id, "exterior")[0];
      return U.el("div.dd-card" + (id === t.comps[0].id ? ".dd-top" : ""), null,
        ext ? photoFigure(fromManifest(ext), { caption: false }) : U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, "No exterior photo")),
        U.el("div.dd-card__body", null,
          U.el("div.dd-card__name", null, c.name, U.el("span.dd-sub", null, `${c.score}/${t.amenities.length}`)),
          U.el("div.dd-card__stats", null, U.el("b", null, U.money(c.revenue)), ` · ADR ${U.money(c.adr)} · ${pct0(c.occupancy)} occ.`)));
    };
    return U.el("div.dd-block", null, head("Design premium", t.designPremium.takeaway),
      U.el("div.dd-pair", null, card(t.designPremium.a), card(t.designPremium.b)));
  }

  function extras(t) {
    if (!t.extras.length) return null;
    const row = U.el("div.dd-strip.dd-strip--3");
    t.extras.forEach((x) => {
      const fig = x.file ? photoFigure(photo(x.file, x.label, x.label, x.focus), { caption: false })
        : U.el("figure.dd-photo.dd-photo--empty", null, U.el("span", null, x.note));
      fig.append(U.el("figcaption", null, U.el("b", null, x.label)));
      row.append(fig);
    });
    return U.el("div.dd-block", null, head(`${t.comps[0].name} extras`, "Upside, not must-have."), row);
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
        U.el("h3", null, c.name), U.el("span.dd-sub", null, `${c.br}BR · ${U.money(c.revenue)}`),
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
    const body = document.getElementById("dd-body"), gal = document.getElementById("dd-galleries");
    if (t.comingSoon) {
      body.replaceChildren(U.el("div.dd-soon", null, U.el("b", null, "Coming soon"), U.el("span", null, `${t.label} deep dive`)));
      gal.replaceChildren(U.el("div.dd-soon", null, U.el("b", null, "Coming soon")));
    } else {
      let man = manifests[t.id];
      if (!man) {
        try { man = manifests[t.id] = await (await fetch(t.manifest)).json(); }
        catch (e) { man = { images: [], gaps: [] }; console.warn("Deep dive photos need the site served over http(s):", e.message); }
      }
      if (active !== t.id) return;
      body.replaceChildren(hero(t, man), mustHaves(t, man), matrix(t), designPremium(t, man), extras(t) || "");
      gal.replaceChildren(...t.comps.map((c, i) => gallery(t, man, c, i)));
    }
    if (scroll) document.getElementById("deep-dive").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init(id) {
    bindLightbox();
    open(id || D.tabs[0].id, !!id);
  }

  return { init, open, photo, openLightbox };
})();
