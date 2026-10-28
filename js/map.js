/* The USA map. One persistent Leaflet marker per red room; markers closer
   than CLUSTER_PX on screen are drawn as one count bubble instead (at the
   national zoom Blue Ridge, Asheville and Charlotte overlap). Basemap: Esri
   World Light Gray, as on the Idaho discovery site (no API key), with OSM
   streets as the alternative. Two tabs: the cleaned market data (default,
   never kept in the URL) and the nationwide list as given, not cleaned. */
const MapView = (() => {
  const US = [[24.3, -125.0], [49.5, -66.8]];
  const CLUSTER_PX = 30;
  const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/";
  const ESRI_ATTR = "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ";
  const OSM_ATTR = "&copy; OpenStreetMap contributors";

  const TOP_COLOR = "#2a78d6"; // top 10% (90th percentile and up) of the market's 1-2BR homes
  const HOME_COLOR = "#8a9792"; // the other 1-2BR homes

  let map, roomLayer, clusterLayer, homeLayer, homeRenderer, bases, baseKey = "light";
  const markers = {}; // red rooms (cleaned tab)
  const listMarkers = {}; // nationwide list (other tab)
  let tab = "cleaned", active = markers, legend;
  let clusterOf = {};
  let visible = [];
  const list = () => (App.data.nationwide ? App.data.nationwide.rows : []);
  const placeOf = (r) => r.city || App.marketById[r.market].name;

  // ---- every other 1BR / 2BR home in the markets in view (canvas dots) ----
  const homeRadius = () => { const z = map.getZoom(); return z < 7 ? 2 : z < 10 ? 3 : 4.5; };

  function homeTip(h) {
    return U.el("div", null, U.el("b", null, U.money(h.rev)), ` · ${h.b}BR`, U.el("br"),
      U.el("span.t-sub", null, h.title), U.el("br"),
      U.el("span.t-sub", null, `Percentile ${U.pct(h.pctl)} among 1–2BR` + (h.pctl >= 90 ? " · top 10%" : "")));
  }

  function homePopup(h) {
    return U.el("div.pop", null,
      U.el("div.pop__market", null, U.el("span", null, `${h.m.name}, ${h.m.state} · ${h.b}BR`),
        h.pctl >= 90 ? U.el("span.pill.pill--top", null, "Top 10%") : null),
      U.el("a.pop__title", { href: `https://www.airbnb.com/rooms/${h.id}`, target: "_blank", rel: "noopener" }, h.title, U.extIcon()),
      U.el("div.pop__rev", null, U.money(h.rev), U.el("small", null, "est. annual revenue")),
      U.el("div.pop__row", null, "Percentile among 1–2BR: ", U.el("b", null, U.pct(h.pctl))));
  }

  function drawHomes() {
    homeLayer.clearLayers();
    const r = homeRadius();
    const homes = [];
    App.chartMarkets().forEach((m) => ["1", "2"].forEach((b) => m.sizes[b].homes.forEach(([rev, id, title, lat, lng, pctl]) => {
      if (lat != null && lng != null) homes.push({ m, b: +b, rev, id, title, lat, lng, pctl });
    })));
    homes.sort((a, b) => a.pctl - b.pctl).forEach((h) => { // top 10% drawn last, on top
      const top = h.pctl >= 90;
      L.circleMarker([h.lat, h.lng], {
        renderer: homeRenderer, radius: r, weight: r >= 3 ? 1 : 0, color: "#fff",
        fillColor: top ? TOP_COLOR : HOME_COLOR, fillOpacity: top ? 0.95 : 0.6,
      }).bindTooltip(() => homeTip(h), { direction: "top", className: "rr-tip", opacity: 1 })
        .bindPopup(() => homePopup(h), { maxWidth: 280 })
        .addTo(homeLayer);
    });
  }

  function resizeHomes() {
    const r = homeRadius();
    homeLayer.eachLayer((c) => c.setRadius(r).setStyle({ weight: r >= 3 ? 1 : 0 }));
  }

  function pinIcon(r) {
    return L.divIcon({
      className: "rr-pin" + (r.status === "new" ? " rr-pin--new" : ""),
      iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10], tooltipAnchor: [0, -12],
      html: "<span></span>",
    });
  }

  function tipContent(r) {
    return U.el("div", null, U.el("b", null, U.money(r.revenue)), " · " + r.bedrooms + "BR", U.el("br"),
      U.el("span.t-sub", null, r.title));
  }

  function popup(r) {
    const m = App.marketById[r.market];
    const pill = r.status === "new"
      ? U.el("span.pill.pill--new", { title: "Found in this scan, not yet confirmed" }, "● New find")
      : U.el("span.pill.pill--confirmed", null, "✓ Confirmed");
    return U.el("div.pop", null,
      U.el("div.pop__market", null, U.el("span", null, `${m.name}, ${m.state} · ${r.bedrooms}BR`), pill),
      U.el("a.pop__title", { href: r.url, target: "_blank", rel: "noopener" }, r.title, U.extIcon()),
      U.el("div.pop__rev", null, U.money(r.revenue), U.el("small", null, "est. annual revenue")),
      U.el("div.pop__row", null, "Percentile among 1–2BR: ", U.el("b", null, U.pct(r.pctl12)), ` (#${r.rank12} of ${r.n12})`),
      U.el("div.pop__row", null, U.times(r.vsMedian) + ` the market's median ${r.bedrooms}BR`),
      U.el("div.pop__row", null, `ADR ${U.money(r.adr)} · Occupancy ${U.share(r.occupancy)}`),
      U.el("div.pop__ev", null, r.evidence));
  }

  function listTip(r) {
    return U.el("div", null, U.el("b", null, U.money(r.revenue)), ` · ${r.bedrooms}BR`, U.el("br"),
      U.el("span.t-sub", null, r.title));
  }

  function listPopup(r) {
    const m = r.market && App.marketById[r.market];
    return U.el("div.pop", null,
      U.el("div.pop__market", null, U.el("span", null, `${r.city}, ${r.state} · ${r.bedrooms}BR`)),
      U.el("a.pop__title", { href: r.url, target: "_blank", rel: "noopener" }, r.title, U.extIcon()),
      U.el("div.pop__rev", null, U.money(r.revenue), U.el("small", null, "revenue as listed")),
      U.el("div.pop__row", null, m ? `Also a red room in the cleaned ${m.name} data` : "Not in the cleaned market data"));
  }

  function renderLegend() {
    const brs = list().map((r) => r.bedrooms);
    legend.replaceChildren(...(tab === "cleaned"
      ? [U.el("span", null, U.el("i"), "Red room"), U.el("span", null, U.el("i.new"), "New find"),
        U.el("span", null, U.el("i.top"), "Top 10% 1–2BR"), U.el("span", null, U.el("i.home"), "Other 1–2BR")]
      : [U.el("span", null, U.el("i"), `Adult-themed listing · ${Math.min(...brs)}–${Math.max(...brs)}BR · not cleaned`)]));
  }

  function renderTabs() {
    const t = (k, label, kind) => U.el("button", {
      type: "button", role: "tab", "aria-selected": String(tab === k), "aria-controls": "map", class: "dd-tab",
      on: { click: () => setTab(k) },
    }, label, U.el("span.dd-tab__kind", null, kind));
    document.getElementById("map-tabs").replaceChildren(
      t("cleaned", "Cleaned markets", "Market Eval data"),
      t("list", "Nationwide list", `${list().length} · not cleaned`));
  }

  /** Switch the map between the cleaned market data and the nationwide list. */
  function setTab(k) {
    if (k === tab) return;
    tab = k;
    active = k === "cleaned" ? markers : listMarkers;
    renderTabs();
    renderLegend();
    update(false);
  }

  function control(position, build) {
    const C = L.Control.extend({ onAdd() { const d = build(); L.DomEvent.disableClickPropagation(d); return d; } });
    return new C({ position }).addTo(map);
  }

  function setBase(key) {
    if (key === baseKey && map.hasLayer(bases[key])) return;
    map.removeLayer(bases[baseKey]);
    baseKey = key;
    bases[key].addTo(map);
    document.querySelectorAll(".map-bases button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.base === key)));
  }

  function init() {
    map = L.map("map", { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 2, maxZoom: 18, scrollWheelZoom: false, worldCopyJump: true });
    bases = {
      light: L.layerGroup([
        L.tileLayer(ESRI + "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 16, maxZoom: 18, attribution: ESRI_ATTR }),
        L.tileLayer(ESRI + "World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 16, maxZoom: 18 }),
      ]),
      streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: OSM_ATTR }),
    };
    bases.light.addTo(map);
    homeRenderer = L.canvas({ padding: 0.5, tolerance: 4 });
    homeLayer = L.layerGroup().addTo(map); // canvas, so it sits under the red-room pins
    clusterLayer = L.layerGroup().addTo(map);
    roomLayer = L.layerGroup().addTo(map);

    App.data.redrooms.forEach((r) => {
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r), keyboard: true, riseOnHover: true });
      m.bindPopup(() => popup(r), { maxWidth: 300, autoPanPadding: [24, 24] });
      m.bindTooltip(() => tipContent(r), { direction: "top", className: "rr-tip", opacity: 1 });
      m.on("mouseover", () => App.setHot(r.id));
      m.on("mouseout", () => App.setHot(null));
      m.on("popupopen", () => { m.closeTooltip(); App.setHot(r.id); });
      m.on("popupclose", () => App.setHot(null));
      m.on("add", () => {
        const e = m.getElement();
        if (e) e.setAttribute("aria-label", `${r.title}, ${App.marketById[r.market].name}, ${U.money(r.revenue)}`);
      });
      markers[r.id] = m;
    });
    list().forEach((r) => {
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r), keyboard: true, riseOnHover: true });
      m.bindPopup(() => listPopup(r), { maxWidth: 300, autoPanPadding: [24, 24] });
      m.bindTooltip(() => listTip(r), { direction: "top", className: "rr-tip", opacity: 1 });
      m.on("popupopen", () => m.closeTooltip());
      m.on("add", () => m.getElement() && m.getElement().setAttribute("aria-label", `${r.title}, ${r.city}, ${U.money(r.revenue)}`));
      listMarkers[r.id] = m;
    });

    control("bottomleft", () => (legend = U.el("div.map-legend")));
    renderLegend();
    if (list().length) renderTabs();
    else document.getElementById("map-tabs").closest(".map-head").hidden = true;
    control("topright", () => U.el("div.map-bases", { role: "group", "aria-label": "Basemap" },
      ["light", "streets"].map((k) => U.el("button", {
        type: "button", "data-base": k, "aria-pressed": String(k === baseKey), on: { click: () => setBase(k) },
      }, k === "light" ? "Light" : "Streets"))));
    L.control.scale({ imperial: true, metric: false, position: "bottomright" }).addTo(map);

    // Wheel zoom only once the reader has clicked into the map, so the page
    // still scrolls past it.
    map.on("click", () => map.scrollWheelZoom.enable());
    map.getContainer().addEventListener("mouseleave", () => map.scrollWheelZoom.disable());
    map.on("zoomend", () => { regroup(); resizeHomes(); });
    map.fitBounds(US, { animate: false });
  }

  function regroup() {
    const z = map.getZoom();
    const groups = [];
    for (const r of visible) {
      const p = map.project([r.lat, r.lng], z);
      const g = z < 15 && groups.find((g) => g.c.distanceTo(p) < CLUSTER_PX);
      if (g) {
        g.items.push({ r, p });
        g.c = L.point(g.items.reduce((s, i) => s + i.p.x, 0) / g.items.length, g.items.reduce((s, i) => s + i.p.y, 0) / g.items.length);
      } else groups.push({ c: p, items: [{ r, p }] });
    }
    clusterLayer.clearLayers();
    clusterOf = {};
    const singles = new Set();
    for (const g of groups) {
      if (g.items.length === 1) { singles.add(g.items[0].r.id); continue; }
      const n = g.items.length, size = 30 + Math.min(n, 8) * 2;
      const cm = L.marker(map.unproject(g.c, z), {
        icon: L.divIcon({ className: "rr-cluster", iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: `<span>${n}</span>` }),
        keyboard: true, riseOnHover: true,
      });
      const byPlace = {};
      g.items.forEach(({ r }) => { byPlace[placeOf(r)] = (byPlace[placeOf(r)] || 0) + 1; });
      const label = Object.entries(byPlace).map(([p, k]) => `${p} ${k}`).join(" · ");
      cm.bindTooltip(() => U.el("div", null, label), { direction: "top", offset: [0, -size / 2], className: "rr-tip", opacity: 1 });
      cm.on("click", () => map.flyToBounds(L.latLngBounds(g.items.map(({ r }) => [r.lat, r.lng])).pad(0.5), { maxZoom: 13, duration: 0.7 }));
      const what = tab === "cleaned" ? "red rooms" : "adult-themed listings";
      cm.on("add", () => cm.getElement() && cm.getElement().setAttribute("aria-label", `${n} ${what}: ${label}`));
      g.items.forEach(({ r }) => { clusterOf[r.id] = cm; });
      cm.addTo(clusterLayer);
    }
    for (const set of [markers, listMarkers]) {
      for (const [id, m] of Object.entries(set)) {
        const want = set === active && singles.has(id);
        if (want && !roomLayer.hasLayer(m)) roomLayer.addLayer(m);
        else if (!want && roomLayer.hasLayer(m)) roomLayer.removeLayer(m);
      }
    }
    applyHot();
  }

  function applyHot() {
    const hot = App.state.hot;
    for (const [id, m] of Object.entries(active)) {
      const e = m.getElement();
      if (e) e.classList.toggle("is-hot", id === hot);
      m.setZIndexOffset(id === hot ? 1000 : 0);
    }
    clusterLayer.eachLayer((c) => c.getElement() && c.getElement().classList.toggle("is-hot", !!hot && clusterOf[hot] === c));
  }

  function update(fly) {
    visible = tab === "cleaned" ? App.rooms() : list();
    map.closePopup();
    if (tab === "cleaned") drawHomes();
    else homeLayer.clearLayers();
    regroup();
    if (fly) focusMarket();
  }

  function focusMarket() {
    const id = App.state.market;
    if (id === "all") map.flyToBounds(US, { duration: 0.8 });
    else map.flyToBounds(App.marketById[id].bounds, { padding: [36, 36], maxZoom: 12, duration: 0.8 });
  }

  function goTo(id) {
    if (tab !== "cleaned") setTab("cleaned"); // the table and chart are the cleaned data
    const r = App.roomById[id];
    const m = markers[id];
    map.closePopup();
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
    map.once("moveend", () => { regroup(); if (roomLayer.hasLayer(m)) m.openPopup(); });
  }

  return { init, update, applyHot, goTo, setBase, get map() { return map; } };
})();
