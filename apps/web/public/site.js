// Arròs — progressive enhancement. Everything works without JS; this adds motion and cooking tools.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // View transitions only on fine pointers; swallow aborted-transition rejections (e.g. viewport resize)
  const vt = (fn) => {
    if (!document.startViewTransition || reduce || matchMedia("(pointer: coarse)").matches) return fn();
    const t = document.startViewTransition(fn);
    t.ready?.catch(() => {}); t.finished?.catch(() => {}); t.updateCallbackDone?.catch(() => {});
    return t;
  };

  // ---------- Language preference ----------
  $$(".lang-menu a[data-lang]").forEach((a) =>
    a.addEventListener("click", () => { try { localStorage.setItem("arros-lang", a.dataset.lang); } catch {} })
  );
  try {
    const pref = localStorage.getItem("arros-lang");
    const isEnglishHome = document.documentElement.lang === "en" && /\/(index\.html)?$/.test(location.pathname);
    if (isEnglishHome && pref && pref !== "en" && !document.referrer.includes(location.host)) location.replace(`/${pref}/`);
  } catch {}
  document.addEventListener("click", (e) => {
    $$("details.lang[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$("details.lang[open]").forEach((d) => (d.open = false)); });

  // ---------- Header & toolbar state ----------
  const header = $(".site-header");
  const toolbar = $(".toolbar");
  const onScroll = () => {
    header?.classList.toggle("scrolled", scrollY > 10);
    if (toolbar) toolbar.classList.toggle("stuck", toolbar.getBoundingClientRect().top <= 70 && scrollY > 300);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  // Progress bar fallback where scroll-driven animations aren't supported
  const bar = $(".progress");
  if (bar && !CSS.supports("animation-timeline: scroll()")) {
    const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
    addEventListener("scroll", upd, { passive: true }); upd();
  }
  $$("[data-top]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }));

  // ---------- Scroll reveal ----------
  const io = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" })
    : null;
  $$("[data-reveal]").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  // ---------- Card tilt + light follow ----------
  if (!reduce && matchMedia("(hover: hover)").matches) {
    $$(".card").forEach((c) => {
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty("--ry", `${(x - 0.5) * 7}deg`);
        c.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
        c.style.setProperty("--mx", `${x * 100}%`);
        c.style.setProperty("--my", `${y * 100}%`);
      });
      c.addEventListener("pointerleave", () => { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); });
    });
  }

  // ---------- Home / area pages: filtering ----------
  const sec = $("#recipes");
  const grids = sec ? $$(".grid", sec) : [];
  if (grids.length) {
    const cards = $$(".card", sec);
    const groupsEl = $$(".area-group", sec);
    const q = $("#q"), count = $("#count"), empty = $("#empty");
    const state = { area: "", texture: "", province: "", historical: "", q: "", ft: new Map() };
    const apply = (animate = true) => {
      const run = () => {
        let n = 0;
        for (const c of cards) {
          const text = !state.q || c.dataset.search.includes(state.q);
          const hit = state.ft.get(c.dataset.slug);
          const ok = (!state.area || c.dataset.area === state.area)
            && (!state.historical || c.dataset.historical === "1")
            && (!state.texture || c.dataset.texture === state.texture)
            && (!state.province || c.dataset.provinces.split(" ").includes(state.province))
            && (text || hit !== undefined);
          c.hidden = !ok;
          if (ok) { n++; c.classList.add("in"); }
          // full-text matches show where the word was found
          let ex = c.querySelector(".ft-hit");
          if (ok && !text && hit) {
            if (!ex) { ex = document.createElement("p"); ex.className = "ft-hit"; (c.querySelector(".gloss") ?? c.querySelector("h3")).after(ex); }
            ex.innerHTML = hit;
          } else ex?.remove();
        }
        // group headings with nothing visible under them disappear
        { let head = null, any = false;
          for (const el of ($("#grid")?.children ?? [])) {
            if (el.classList.contains("grid-group-head")) { if (head) head.hidden = !any; head = el; any = false; }
            else if (el.classList.contains("card") && !el.hidden) any = true;
          }
          if (head) head.hidden = !any; }
        // area groups with nothing visible disappear (heading included)
        for (const g of groupsEl) g.hidden = !$$(".card", g).some((c) => !c.hidden);
        if (count) count.textContent = (n === 1 ? sec.dataset.one : sec.dataset.many).replace("{n}", n);
        if (empty) empty.hidden = n > 0;
        // keep in-feed ad slots spaced out: only show one after at least 6 visible cards since the last
        for (const grid of grids) {
          let since = 0;
          for (const el of grid.children) {
            if (el.classList.contains("card")) { if (!el.hidden) since++; }
            else if (el.classList.contains("ad")) { el.hidden = since < 6; if (!el.hidden) since = 0; }
          }
        }
        // region chips/options only for the chosen area
        $$("[data-filter-province][data-area], [data-select=province] option[data-area]").forEach((el) => {
          el.hidden = !!state.area && el.dataset.area !== state.area;
        });
      };
      animate ? vt(run) : run();
    };
    const group = (attr, key) => {
      const btns = $$(`[${attr}]`);
      btns.forEach((b) => b.addEventListener("click", () => {
        state[key] = b.getAttribute(attr);
        btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        const sel = $(`[data-select="${key}"]`);
        if (sel) { sel.value = state[key]; sel.classList.toggle("on", !!state[key]); }
        apply();
      }));
    };
    group("data-filter-area", "area");
    $$("[data-filter-historical]").forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      state.historical = on ? "1" : "";
      apply();
    }));
    // ----- grouping, sorting, grid/list view -----
    const gridEl = $("#grid");
    const groupSel = $("[data-group]"), sortSel = $("[data-sort]");
    const arrange = () => {
      if (!gridEl) return;
      $$(".grid-group-head", gridEl).forEach((h) => h.parentNode.removeChild(h));
      const sort = sortSel?.value || "az", group = groupSel?.value || "";
      const key = (c) => group === "region" ? (c.dataset.region || "—") : group === "facet" ? (c.dataset.facetLabel || "—") : "";
      const list = [...cards].sort((a, b) =>
        (group ? key(a).localeCompare(key(b)) : 0)
        || (sort === "photo" ? Number(b.dataset.photo) - Number(a.dataset.photo) : 0)
        || a.dataset.title.localeCompare(b.dataset.title));
      let last = null;
      for (const c of list) {
        if (group && key(c) !== last) {
          last = key(c);
          const h = document.createElement("h3"); h.className = "grid-group-head"; h.textContent = last; gridEl.append(h);
        }
        gridEl.append(c);
      }
      try { localStorage.setItem("arros-arrange", JSON.stringify({ sort, group })); } catch {}
      apply(false);
    };
    try { const saved = JSON.parse(localStorage.getItem("arros-arrange") || "{}");
      if (saved.sort && sortSel) sortSel.value = saved.sort;
      if (saved.group && groupSel && [...groupSel.options].some((o) => o.value === saved.group)) groupSel.value = saved.group; } catch {}
    groupSel?.addEventListener("change", arrange);
    sortSel?.addEventListener("change", arrange);
    if ((groupSel && groupSel.value) || (sortSel && sortSel.value !== "az")) arrange();
    const viewBtns = $$("[data-view]");
    const setView = (v) => { sec.dataset.view = v; viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v))); };
    let savedView = null; try { savedView = localStorage.getItem("arros-view"); } catch {}
    setView(savedView || (matchMedia("(max-width: 720px)").matches ? "list" : "grid"));
    viewBtns.forEach((b) => b.addEventListener("click", () => { setView(b.dataset.view); try { localStorage.setItem("arros-view", b.dataset.view); } catch {} }));
    group("data-filter-texture", "texture");
    group("data-filter-province", "province");
    // choosing an area clears a region filter that belongs to another area
    $$("[data-filter-area]").forEach((b) => b.addEventListener("click", () => {
      const cur = $(`[data-filter-province][aria-pressed="true"]`);
      if (state.area && cur?.dataset.area && cur.dataset.area !== state.area) $(`[data-filter-province=""]`)?.click();
    }));
    // Mobile dropdowns drive the same chips, so state, counts and animations stay in one place.
    $$("[data-select]").forEach((s) => s.addEventListener("change", () =>
      $(`[data-filter-${s.dataset.select}="${CSS.escape(s.value)}"]`)?.click()));

    // Full-text search over every recipe (ingredients, steps, history) via Pagefind, in this page's language.
    let pf = null, seq = 0;
    const pagefind = async () => (pf ??= import("/pagefind/pagefind.js").then(async (m) => { await m.options({ excerptLength: 14 }); return m; }).catch(() => null));
    q.addEventListener("focus", () => { pagefind(); }, { once: true });
    let tmo;
    q.addEventListener("input", () => {
      clearTimeout(tmo);
      tmo = setTimeout(async () => {
        const my = ++seq;
        state.q = q.value.trim().toLowerCase();
        state.ft = new Map();
        apply(false);
        if (state.q.length < 3) return;
        const m = await pagefind();
        if (!m) return;
        const res = await m.search(state.q);
        const data = await Promise.all(res.results.slice(0, 80).map((r) => r.data()));
        if (my !== seq) return; // a newer query started
        for (const d of data) {
          const slug = d.url.match(/recipes\/([^/.]+)(\.html)?/)?.[1];
          if (slug) state.ft.set(slug, d.excerpt);
        }
        apply(false);
      }, 140);
    });
    // ?q=… (sitelinks search box / shared links) pre-fills the search
    const q0 = new URLSearchParams(location.search).get("q");
    if (q0) { q.value = q0; q.dispatchEvent(new Event("input")); }
    // Texture tiles set the filter, then scroll to the grid
    $$("[data-set-texture]").forEach((tile) => tile.addEventListener("click", (e) => {
      e.preventDefault();
      $(`[data-filter-texture="${tile.dataset.setTexture}"]`)?.click();
      sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }));
  }

  // ---------- Header: hide on scroll down, show on scroll up ----------
  { let lastY = scrollY;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (y > 160 && y > lastY + 4 && !document.body.classList.contains("menu-open")) document.body.classList.add("hdr-hidden");
      if (y < lastY - 4 || y < 160) document.body.classList.remove("hdr-hidden");
      lastY = y;
    }, { passive: true }); }

  // ---------- Menu sheet ----------
  { const sheet = $("#site-menu"), openBtn = $("[data-open-menu]");
    const open = (on) => {
      if (!sheet) return;
      sheet.hidden = !on; document.body.classList.toggle("menu-open", on);
      openBtn?.setAttribute("aria-expanded", String(on));
      if (on) sheet.querySelector("a, button")?.focus(); else openBtn?.focus();
    };
    openBtn?.addEventListener("click", () => open(true));
    $$("[data-close-menu]").forEach((b) => b.addEventListener("click", () => open(false)));
    sheet?.addEventListener("click", (e) => { if (e.target === sheet) open(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet && !sheet.hidden) open(false); });
    if (sheet) $$("a", sheet).forEach((a) => a.addEventListener("click", () => open(false))); }

  // ---------- Site-wide search (Pagefind, current language) ----------
  { const dlg = $(".search-dialog");
    if (dlg) {
      const input = dlg.querySelector("input"), out = dlg.querySelector(".sd-results");
      let pfP = null, seqS = 0, tmoS;
      const pf = () => (pfP ??= import("/pagefind/pagefind.js").then(async (m) => { await m.options({ excerptLength: 18 }); return m; }).catch(() => null));
      const openS = () => { const sh = $("#site-menu"); if (sh) sh.hidden = true; document.body.classList.remove("menu-open"); dlg.showModal(); input.focus(); input.select(); pf(); };
      $$("[data-open-search]").forEach((b) => b.addEventListener("click", openS));
      document.addEventListener("keydown", (e) => {
        const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
        if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); openS(); }
      });
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
      input.addEventListener("input", () => {
        clearTimeout(tmoS);
        tmoS = setTimeout(async () => {
          const my = ++seqS, q = input.value.trim();
          if (q.length < 2) { out.innerHTML = ""; return; }
          const m = await pf(); if (!m) return;
          const res = await m.search(q);
          const data = await Promise.all(res.results.slice(0, 14).map((r) => r.data()));
          if (my !== seqS) return;
          out.innerHTML = data.length ? data.map((d) => {
            const kind = /\/recipes\//.test(d.url) ? "🍚" : /\/provinces\//.test(d.url) ? "📍" : /history/.test(d.url) ? "📜" : "📄";
            return `<li><a href="${d.url.replace(/\.html$/, "")}"><span class="sd-kind" aria-hidden="true">${kind}</span><span><strong>${d.meta?.title ?? d.url}</strong>${d.meta?.gloss ? `<em>${d.meta.gloss}</em>` : ""}<small>${d.excerpt}</small></span></a></li>`;
          }).join("") : `<li class="sd-empty">${dlg.dataset.empty}</li>`;
        }, 160);
      });
    } }

  // ---------- Recipe tabs ----------
  { const tabs = $$(".rtabs [role=tab]"), panels = $$(".rpanel");
    if (tabs.length) {
      document.body.classList.add("has-tabs");
      const show = (id, scroll = false) => {
        if (!panels.some((p) => p.dataset.panel === id)) id = panels[0].dataset.panel;
        tabs.forEach((t) => { const on = t.dataset.tab === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
        panels.forEach((p) => { p.hidden = p.dataset.panel !== id; if (!p.hidden) p.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in")); });
        if (scroll) $(".rtabs-bar")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      };
      window.__showTab = show;
      const fromHash = () => {
        const h = decodeURIComponent(location.hash.slice(1));
        if (!h) return show(panels[0].dataset.panel);
        const panel = panels.find((p) => p.dataset.panel === h) ?? document.getElementById(h)?.closest(".rpanel");
        show(panel ? panel.dataset.panel : panels[0].dataset.panel);
        if (panel && panel.dataset.panel !== h) document.getElementById(h)?.scrollIntoView();
      };
      fromHash();
      addEventListener("hashchange", fromHash);
      tabs.forEach((t, i) => {
        t.addEventListener("click", (e) => { e.preventDefault(); show(t.dataset.tab); history.replaceState(null, "", "#" + t.dataset.tab); });
        t.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const fwd = (e.key === "ArrowRight") !== (document.documentElement.dir === "rtl");
          e.preventDefault(); const n = tabs[(i + (fwd ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); n.click();
        });
      });
      $$("[data-tab-link]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); show(a.dataset.tabLink, true); history.replaceState(null, "", "#" + a.dataset.tabLink); }));
    } }

  // ---------- A–Z index: section filter ----------
  { const btns = $$("[data-az-area]");
    if (btns.length) btns.forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.azArea;
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $$(".az-group").forEach((g) => {
        let any = false;
        g.querySelectorAll("li").forEach((li) => { li.hidden = !!a && li.dataset.area !== a; if (!li.hidden) any = true; });
        g.hidden = !any;
        const link = document.querySelector(`.az-letters a[href="#${g.id}"]`); if (link) link.hidden = !any;
      });
    })); }

  // ---------- Saved dishes / recently viewed (localStorage only) ----------
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const savedCount = () => { const n = store.get("arros-saved").length; $$("[data-saved-count]").forEach((el) => (el.textContent = n ? `(${n})` : "")); };
  savedCount();
  { const main = $("[data-recipe-slug]");
    if (main) {
      const slug = main.dataset.recipeSlug;
      store.set("arros-recent", [slug, ...store.get("arros-recent").filter((s) => s !== slug)].slice(0, 12));
    } }
  $$("[data-save]").forEach((b) => {
    const slug = b.dataset.save, label = b.querySelector("span");
    const paint = () => { const on = store.get("arros-saved").includes(slug); b.setAttribute("aria-pressed", String(on)); if (label) label.textContent = on ? b.dataset.labelOn : b.dataset.labelOff; };
    paint();
    b.addEventListener("click", () => {
      const cur = store.get("arros-saved");
      store.set("arros-saved", cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur]);
      paint(); savedCount();
    });
  });
  // toast
  const toast = (msg) => {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
  };
  $$("[data-share]").forEach((b) => b.addEventListener("click", async () => {
    const data = { title: document.title, url: location.href.split("#")[0] };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e?.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(data.url); toast(b.dataset.copied); } catch { prompt("", data.url); }
  }));
  // lists rendered from /dishes.json (saved page + portal strip)
  const savedPage = $("[data-dishes-json]"), strip = $("[data-recent-strip]");
  if (savedPage || strip) {
    const url = savedPage?.dataset.dishesJson ?? `${document.body.dataset.base || "/"}dishes.json`;
    const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const card = (d) => `<a class="card${d.photo ? " has-photo" : ""}" href="${esc(d.url)}" data-theme="${esc(d.theme)}"><div class="card-visual${d.photo ? " card-photo" : ""}"><img class="${d.photo ? "photo" : "pan"}" src="${esc(d.img)}" alt="" loading="lazy" width="104" height="104"></div><div class="card-body"><h3><span dir="auto">${esc(d.title)}</span>${d.local ? `<span class="local" dir="auto">${esc(d.local)}</span>` : ""}</h3>${d.gloss ? `<p class="gloss" dir="auto">${esc(d.gloss)}</p>` : ""}<p class="card-meta"><span class="where"><span class="pin" aria-hidden="true"></span>${esc(d.region)}${d.area ? ` · ${esc(d.area)}` : ""}</span></p></div></a>`;
    const chip = (d) => `<a class="recent-chip" href="${esc(d.url)}"><img src="${esc(d.img)}" alt="" width="40" height="40" loading="lazy"><span dir="auto">${esc(d.title)}</span></a>`;
    const saved = store.get("arros-saved"), recent = store.get("arros-recent");
    if ((savedPage && (saved.length || recent.length)) || (strip && recent.length)) {
      fetch(url).then((r) => r.json()).then((all) => {
        const by = new Map(all.map((d) => [d.slug, d]));
        const pick = (list) => list.map((s) => by.get(s)).filter(Boolean);
        if (savedPage) {
          const sv = pick(saved), rc = pick(recent);
          $("[data-saved-list]").innerHTML = sv.map(card).join("");
          $("[data-saved-empty]").hidden = sv.length > 0;
          if (rc.length) { $("[data-recent-sec]").hidden = false; $("[data-recent-full]").innerHTML = rc.map(card).join(""); }
        }
        if (strip) { const rc = pick(recent).slice(0, 8); if (rc.length) { strip.hidden = false; $("[data-recent-list]", strip).innerHTML = rc.map(chip).join(""); } }
      }).catch(() => {});
    } else if (savedPage) { $("[data-saved-empty]").hidden = false; }
  }

  // ---------- Table of contents: highlight current section ----------
  const tocLinks = $$(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.getAttribute("href").slice(1)), a]));
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      tocLinks.forEach((a) => a.classList.remove("active"));
      byId.get(e.target.id)?.classList.add("active");
    }), { rootMargin: "-15% 0px -75% 0px" });
    byId.forEach((_, id) => { const h = document.getElementById(id); if (h) obs.observe(h); });
  }

  // ---------- Recipe tools ----------
  const recipe = $(".sec-recipe");
  if (!recipe) return;
  // Servings scaler: rescale quantity cells (2nd column) of the recipe tables; dimensions,
  // temperatures, times, ratios and percentages are left alone.
  { const sc = $(".scaler");
    if (sc) {
      const baseN = Number(sc.dataset.base) || 4, out = sc.querySelector("output"), note = $(".scaled-note");
      const commaLang = /^(es|ca)$/.test(document.documentElement.lang);
      const cells = $$("tbody tr td:nth-child(2)", recipe);
      cells.forEach((td) => (td.dataset.orig = td.innerHTML));
      const FR = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
      const num = (t) => (t in FR ? FR[t] : Number(t.replace(",", ".")));
      const fmt = (v, comma) => {
        let r = v >= 100 ? Math.round(v / 5) * 5 : v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
        const back = { 0.5: "½", 0.25: "¼", 0.75: "¾" };
        if (r < 1 && back[r]) return back[r];
        let s = String(r); if (comma) s = s.replace(".", ",");
        return s;
      };
      const NUM = /(\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(\s*[–-]\s*)?(\d+(?:[.,]\d+)?)?/g;
      const SKIP = /^\s*(cm|mm|m\b|°|º|%|min|h\b|hour|hora|minut|นาที|دقيق|ساع|x\b|×|:)/i;
      const scaleHtml = (html, f) => html.replace(/>([^<]*)</g, (m0, text) => ">" + text.replace(NUM, (m, a, dash, b, off, whole) => {
        const after = whole.slice(off + m.length), before = whole.slice(0, off);
        if (SKIP.test(after) || /[:×x/]\s*$/.test(before) || /\d[.,]?$/.test(before)) return m;
        const comma = /,/.test(m) || (commaLang && !/\./.test(m));
        return fmt(num(a) * f, comma) + (dash && b ? dash + fmt(num(b) * f, comma) : (dash ?? "") + (b ?? ""));
      }) + "<");
      const set = (n) => {
        n = Math.max(1, Math.min(24, n)); out.value = String(n); out.textContent = String(n);
        const f = n / baseN;
        cells.forEach((td) => (td.innerHTML = f === 1 ? td.dataset.orig : scaleHtml(">" + td.dataset.orig + "<", f).slice(1, -1)));
        if (note) { note.hidden = f === 1; note.textContent = note.dataset.template.replace("{n}", n); }
      };
      sc.querySelectorAll("[data-scale]").forEach((b) => b.addEventListener("click", () => set(Number(out.textContent) + Number(b.dataset.scale))));
    } }
  const key = `arros-check:${location.pathname}`;

  // Ingredient checklist (remembered per page)
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  const rows = $$("tbody tr", recipe);
  rows.forEach((tr, i) => {
    if (saved.includes(i)) tr.classList.add("done");
    tr.tabIndex = 0;
    tr.setAttribute("role", "checkbox");
    tr.setAttribute("aria-checked", String(tr.classList.contains("done")));
    const toggle = (e) => {
      if (e.target.closest("a, button")) return;
      tr.classList.toggle("done");
      tr.setAttribute("aria-checked", String(tr.classList.contains("done")));
      try { localStorage.setItem(key, JSON.stringify(rows.flatMap((r, j) => (r.classList.contains("done") ? [j] : [])))); } catch {}
    };
    tr.addEventListener("click", toggle);
    tr.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(e); } });
  });

  // Timers: turn "18 min", "25–30 minutes", "17 minutos", "5 นาที" into tap-to-start buttons
  const prose = $(".prose");
  const label = prose?.dataset.timerLabel || "{n} min";
  const re = /(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*(min(?:ute)?s?|minutos?|minuts?|นาที|دقائق|دقيقة|د)(?![\p{L}])/gu;
  const reTest = new RegExp(re.source, "u");
  const walker = document.createTreeWalker(recipe, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest("li, p") && !n.parentElement.closest("table, a, button, h2, h3") && reTest.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(node.data))) {
      frag.append(node.data.slice(last, m.index));
      const mins = Number(m[2] || m[1]);
      const b = document.createElement("button");
      b.type = "button"; b.className = "timer-btn"; b.textContent = m[0];
      b.dataset.min = String(mins);
      b.setAttribute("aria-label", label.replace("{n}", mins));
      const li = node.parentElement.closest("li, p");
      b.dataset.what = (li?.querySelector("strong")?.textContent || li?.textContent || "").trim().slice(0, 40);
      frag.append(b);
      last = m.index + m[0].length;
    }
    frag.append(node.data.slice(last));
    node.replaceWith(frag);
  }
  const dock = $(".timers");
  let audio;
  const beep = () => {
    try {
      audio ||= new AudioContext();
      [0, 0.35, 0.7].forEach((t0) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, audio.currentTime + t0);
        g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t0 + 0.3);
        o.start(audio.currentTime + t0); o.stop(audio.currentTime + t0 + 0.32);
      });
    } catch {}
    navigator.vibrate?.([200, 100, 200, 100, 400]);
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  recipe.addEventListener("click", (e) => {
    const b = e.target.closest(".timer-btn");
    if (!b) return;
    try { audio ||= new AudioContext(); } catch {}
    const total = Number(b.dataset.min) * 60, end = Date.now() + total * 1000, C = 2 * Math.PI * 14;
    const el = document.createElement("div");
    el.className = "timer";
    el.innerHTML = `<svg class="ring" viewBox="0 0 34 34"><circle class="bg" cx="17" cy="17" r="14"/><circle class="fg" cx="17" cy="17" r="14" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><strong>${fmt(total)}</strong><small></small><button type="button" aria-label="×">✕</button>`;
    el.querySelector("small").textContent = b.dataset.what;
    dock.append(el);
    const fg = el.querySelector(".fg"), out = el.querySelector("strong");
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      out.textContent = fmt(left);
      fg.style.strokeDashoffset = String(C * (1 - left / total));
      if (left === 0) { clearInterval(iv); el.classList.add("done"); out.textContent = dock.dataset.done; beep(); }
    };
    const iv = setInterval(tick, 1000);
    el.querySelector("button").addEventListener("click", () => { clearInterval(iv); el.remove(); });
  });

  // Cooking mode: keep the screen awake, jump to the recipe, dim the rest
  const cookBtn = $("[data-cook]"), hint = $(".cook-hint");
  let lock = null;
  const setCook = async (on) => {
    document.body.classList.toggle("cooking", on);
    cookBtn.setAttribute("aria-pressed", String(on));
    hint.hidden = !on;
    try {
      if (on && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      else if (!on && lock) { await lock.release(); lock = null; }
    } catch {}
    if (on) { window.__showTab?.("recipe"); recipe.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
  };
  cookBtn?.addEventListener("click", () => setCook(cookBtn.getAttribute("aria-pressed") !== "true"));
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && document.body.classList.contains("cooking") && "wakeLock" in navigator) {
      try { lock = await navigator.wakeLock.request("screen"); } catch {}
    }
  });
})();
