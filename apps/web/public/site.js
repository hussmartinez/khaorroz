// Arròs — progressive enhancement. Everything works without JS; this adds motion and cooking tools.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vt = (fn) => (document.startViewTransition && !reduce ? document.startViewTransition(fn) : fn());

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
    const state = { area: "", texture: "", province: "", q: "", ft: new Map() };
    const apply = (animate = true) => {
      const run = () => {
        let n = 0;
        for (const c of cards) {
          const text = !state.q || c.dataset.search.includes(state.q);
          const hit = state.ft.get(c.dataset.slug);
          const ok = (!state.area || c.dataset.area === state.area)
            && (!state.texture || c.dataset.texture === state.texture)
            && (!state.province || c.dataset.provinces.split(" ").includes(state.province))
            && (text || hit !== undefined);
          c.hidden = !ok;
          if (ok) { n++; c.classList.add("in"); }
          // full-text matches show where the word was found
          let ex = c.querySelector(".ft-hit");
          if (ok && !text && hit) {
            if (!ex) { ex = document.createElement("p"); ex.className = "ft-hit"; c.querySelector(".summary").after(ex); }
            ex.innerHTML = hit;
          } else ex?.remove();
        }
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
    // Texture tiles set the filter, then scroll to the grid
    $$("[data-set-texture]").forEach((tile) => tile.addEventListener("click", (e) => {
      e.preventDefault();
      $(`[data-filter-texture="${tile.dataset.setTexture}"]`)?.click();
      sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }));
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
    if (on) recipe.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };
  cookBtn?.addEventListener("click", () => setCook(cookBtn.getAttribute("aria-pressed") !== "true"));
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && document.body.classList.contains("cooking") && "wakeLock" in navigator) {
      try { lock = await navigator.wakeLock.request("screen"); } catch {}
    }
  });
})();
