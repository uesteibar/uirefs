/* uirefs web UI: grid, filters, detail panel. No build step, no framework. State: ?type=&tag=&q= and #/r/<id>. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = () => matchMedia("(max-width: 760px)").matches;

const top = $(".top"), grid = $("main.grid"), panel = $(".panel"), pscroll = $(".pscroll"), ptype = $(".ptype");
const scrim = $(".scrim"), rail = $(".rail"), find = $(".find"), searchIn = $("#q"), typeSeg = $(".types");
const typeBtns = $$("button", typeSeg), toastEl = $(".toast");

const params = new URLSearchParams(location.search);
const state = { type: params.get("type") || "", tag: params.get("tag") || "", q: params.get("q") || "", items: [] };

const details = new Map();   // id -> detail, once fetched
const gone = new Set();      // ids removed optimistically, hidden until the server answers
let seq = 0, panelId = null, pushed = false, focusBack = null, toastTimer = 0, firstPaint = true;

const ICON = {
  x: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>`,
  out: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 13 13 7M8 7h5v5"/></svg>`,
  expand: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 8V4h4M16 12v4h-4M4 4l4.5 4.5M16 16l-4.5-4.5"/></svg>`,
  shrink: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 4v4.5H4M11.5 16v-4.5H16M8.5 8.5 4 4M11.5 11.5 16 16"/></svg>`,
  link: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/></svg>`,
};
const TYPE_LABEL = { component: "Component", site: "Site", animation: "Animation", identity: "Identity", resource: "Resource" };

/* ---------- URLs ---------- */
function filterQuery() {
  const p = new URLSearchParams();
  if (state.type) p.set("type", state.type);
  if (state.tag) p.set("tag", state.tag);
  if (state.q.trim()) p.set("q", state.q.trim());
  return p;
}
const syncURL = () => {
  const qs = filterQuery().toString();
  history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
};
const hashId = () => { const m = location.hash.match(/^#\/r\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };
const visible = () => state.items.filter(it => !gone.has(it.id));
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

/* ---------- segmented control: the thumb slides to the pressed button ---------- */
function placeThumb(seg, animate = true) {
  const on = $('button[aria-pressed="true"], button[aria-selected="true"]', seg), th = $(".thumb", seg);
  if (!on || !th) return;
  if (!animate) seg.classList.remove("ready");
  th.style.setProperty("--x", on.offsetLeft + "px");
  th.style.setProperty("--w", on.offsetWidth + "px");
  if (!animate) { th.getBoundingClientRect(); requestAnimationFrame(() => seg.classList.add("ready")); }
}

/* ---------- data ---------- */
async function load() {
  const mine = ++seq;
  try {
    const r = await fetch("/api/references?" + filterQuery(), { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.json();
    if (mine !== seq) return;
    state.items = Array.isArray(body.items) ? body.items : [];
    renderGrid(firstPaint ? "enter" : "morph");
    firstPaint = false;
    if (panelId) updateNav();
    grid.setAttribute("aria-busy", "false");
  } catch {
    if (mine !== seq) return;
    toast("Could not load references. Check the service and retry.");
  }
}

/* Refresh the tag rail for the current type. Returns false when the chosen tag is not there any more. */
async function loadTags() {
  const p = new URLSearchParams();
  if (state.type) p.set("type", state.type);
  try {
    const r = await fetch("/api/tags?" + p, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const names = ((await r.json()).tags || []).map(t => t.name);
    const kept = !state.tag || names.includes(state.tag);
    // Concept tags are one-off sentences; they stay searchable and clickable in the detail, not in the rail.
    const shown = names.filter(n => !n.startsWith("concept:"));
    if (state.tag && !shown.includes(state.tag)) shown.unshift(state.tag);
    renderRail(shown);
    return kept;
  } catch {
    return true;
  }
}

async function loadDetail(id) {
  const r = await fetch("/api/references/" + encodeURIComponent(id), { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  details.set(id, d);
  return d;
}

/* ---------- tag rail ---------- */
const tagLabel = n => n.startsWith("concept:") ? n.slice(8) : n;
function chip(n, pressed) {
  return `<button type="button" class="chip" data-tag="${esc(n)}" aria-pressed="${pressed}">${esc(tagLabel(n))}<span class="x" aria-hidden="true">${ICON.x}</span></button>`;
}
function renderRail(names) {
  rail.innerHTML = names.map(n => chip(n, n === state.tag)).join("");
  railFades();
}
function railFades() {
  const max = rail.scrollWidth - rail.clientWidth;
  rail.classList.toggle("l", rail.scrollLeft > 2);
  rail.classList.toggle("r", rail.scrollLeft < max - 2);
}
function setTag(tag, from) {
  state.tag = tag;
  for (const c of $$(".chip", rail)) c.setAttribute("aria-pressed", String(c.dataset.tag === tag));
  if (tag && !$(`.chip[data-tag="${CSS.escape(tag)}"]`, rail)) rail.insertAdjacentHTML("afterbegin", chip(tag, true));
  const on = tag && $(`.chip[data-tag="${CSS.escape(tag)}"]`, rail);
  if (on) {
    on.classList.remove("pop"); void on.offsetWidth; on.classList.add("pop");
    if (from !== "rail") on.scrollIntoView({ behavior: calm() ? "auto" : "smooth", inline: "center", block: "nearest" });
  }
  syncURL();
  load();
}

/* ---------- grid ---------- */
function card(it, i) {
  const thumb = it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="${i < 12 ? "eager" : "lazy"}" decoding="async">`
    : `<span class="tile"><span>${esc(TYPE_LABEL[it.type] || it.type)}</span></span>`;
  const kinds = ["demo", "clip"].filter(k => (it.kinds || []).includes(k));
  const marks = kinds.length ? `<span class="marks">${kinds.map(k => `<span class="mark-k k-${k}">${k === "demo" ? "Demo" : "Clip"}</span>`).join("")}</span>` : "";
  const host = it.source && it.source.url ? hostOf(it.source.url) : "";
  const sub = [TYPE_LABEL[it.type] || it.type, host].filter(Boolean).map(esc).join(" · ");
  return `<article class="card" data-id="${esc(it.id)}" style="--i:${i};view-transition-name:c-${esc(it.id)}">
    <a class="open" href="#/r/${encodeURIComponent(it.id)}">
      <span class="thumb">${thumb}${marks}</span>
      <span class="meta"><span class="name">${esc(it.title)}</span><span class="sub">${sub}</span></span>
    </a>
    ${killHTML(it.id)}
  </article>`;
}

function killHTML(id) {
  return `<div class="kill" data-kill="${esc(id)}"><span class="no-w"><button type="button" class="no" tabindex="-1">Cancel</button></span><button type="button" class="yes">Delete</button></div>`;
}

function skeleton(n = 8) {
  grid.innerHTML = Array.from({ length: n }, (_, i) =>
    `<div class="card sk" style="--i:${i}" aria-hidden="true"><span class="thumb"></span><span class="meta" style="display:block;padding:11px 3px 0"><span class="name" style="display:block"></span><span class="sub"></span></span></div>`).join("");
  grid.classList.add("enter");
}

function paintGrid() {
  const items = visible();
  if (!items.length) {
    const filtered = !!(state.q.trim() || state.type || state.tag);
    grid.innerHTML = `<div class="empty"><span class="glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <p>${filtered ? "Nothing matches." : "No references yet."}</p>${filtered ? `<button type="button" data-reset>Clear filters</button>` : ""}</div>`;
    return;
  }
  grid.innerHTML = items.map(card).join("");
  for (const img of $$("img", grid)) if (img.complete && img.naturalWidth) img.classList.add("ld");
}

/* "enter": cards rise in a short stagger. "morph": a view transition moves the cards that stay. */
function renderGrid(mode = "morph") {
  grid.classList.toggle("enter", mode === "enter");
  if (mode === "morph" && document.startViewTransition && !calm() && grid.children.length && !grid.querySelector(".sk")) {
    document.startViewTransition(paintGrid);
  } else paintGrid();
}
grid.addEventListener("load", e => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);
grid.addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);

/* ---------- panel ---------- */
function stageHTML(d) {
  const byRole = a => (a.role === "primary" ? 0 : 1);
  const images = (d.assets || []).filter(a => a.kind === "image").sort((a, b) => byRole(a) - byRole(b));
  const demos = (d.assets || []).filter(a => a.kind === "demo");
  const clips = (d.assets || []).filter(a => a.kind === "clip");
  const views = [];
  if (demos.length) views.push(["demo", "Demo", demos.map(a => `<div class="demo-wrap">
      <iframe class="demo" data-src="${esc(a.url)}" sandbox="allow-scripts" title="${esc(d.title)}" loading="lazy"></iframe>
      <div class="tools">
        <button type="button" class="tbtn" data-expand>${ICON.expand}<span>Expand</span></button>
        <a class="tbtn" href="${esc(a.url)}" target="_blank" rel="noopener">${ICON.out}<span>Open in a new tab</span></a>
      </div></div>`).join("")]);
  if (images.length) views.push(["images", images.length > 1 ? "Images" : "Image", `<div class="car">` + images.map(a =>
      `<figure><img src="${esc(a.url)}" alt="${esc(a.caption || d.title)}" decoding="async">${a.caption ? `<figcaption>${esc(a.caption)}</figcaption>` : ""}</figure>`).join("") + `</div>`
      + (images.length > 1 ? `<div class="dots">${images.map((_, i) => `<button type="button" aria-label="Image ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>` : "")]);
  if (clips.length) views.push(["clip", "Clip", clips.map(a => `<video class="clip" src="${esc(a.url)}" controls preload="metadata" playsinline></video>`).join("")]);
  if (!views.length) return "";
  const tabs = views.length > 1 ? `<div class="seg" role="tablist" aria-label="Media"><span class="thumb" aria-hidden="true"></span>`
    + views.map(([k, label], i) => `<button type="button" role="tab" data-view="${k}" aria-selected="${i === 0}">${label}</button>`).join("") + `</div>` : "";
  return `<section class="stage">${tabs}` + views.map(([k, , html], i) => `<div class="view" data-view="${k}"${i ? " hidden" : ""}>${html}</div>`).join("") + `</section>`;
}

function panelHTML(id, d) {
  const item = state.items.find(i => i.id === id) || null;
  const src = d || item;
  const title = src ? src.title : "";
  ptype.textContent = src ? (TYPE_LABEL[src.type] || src.type) : "";
  let h = `<h2 class="ptitle">${esc(title)}</h2>`;
  const url = src && src.source && src.source.url;
  if (url) h += `<div class="src"><a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(url)}">${esc(hostOf(url) || url)}${ICON.out}</a>${d && d.locator ? `<span>${esc(d.locator)}</span>` : ""}</div>`;
  if (!d) return h + `<div class="wait"></div>`;
  h += stageHTML(d);
  if (d.description) h += `<p class="desc">${esc(d.description)}</p>`;
  if (d.behavior) h += `<div class="beh"><h3>Behavior</h3><p>${esc(d.behavior)}</p></div>`;
  if ((d.tags || []).length) h += `<div class="tags">` + d.tags.map(t => `<button type="button" class="chip" data-ftag="${esc(t)}" title="Show references tagged ${esc(tagLabel(t))}">${esc(tagLabel(t))}</button>`).join("") + `</div>`;
  let when = "";
  if (d.created_at) { const t = new Date(d.created_at); if (!isNaN(t)) when = `<time datetime="${esc(d.created_at)}">Saved ${t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time>`; }
  h += `<div class="foot">${when || "<span></span>"}<div class="foot-actions"><button type="button" class="tbtn" data-copy aria-label="Copy link to this reference">${ICON.link}<span>Copy link</span></button>${killHTML(d.id)}</div></div>`;
  return h;
}

function renderPanel(id, dir = "") {
  const d = details.get(id);
  pscroll.classList.remove("next", "prev");
  pscroll.innerHTML = panelHTML(id, d);
  if (dir) { void pscroll.offsetWidth; pscroll.classList.add(dir); }
  pscroll.scrollTop = 0;
  updateNav();
  const tabs = $(".stage .seg", pscroll);
  if (tabs) requestAnimationFrame(() => placeThumb(tabs, false));
  // Demos start once the panel has arrived, so the slide stays smooth.
  const first = $(".view:not([hidden]) iframe[data-src]", pscroll);
  if (first) setTimeout(() => startDemos($(".view:not([hidden])", pscroll)), panel.dataset.shown ? 60 : 420);
}

function startDemos(view) {
  for (const f of $$("iframe[data-src]", view)) { f.src = f.dataset.src; f.removeAttribute("data-src"); }
}

function updateNav() {
  const ids = visible().map(it => it.id), i = ids.indexOf(panelId);
  $('[data-step="-1"]', panel).disabled = i <= 0;
  $('[data-step="1"]', panel).disabled = i < 0 || i >= ids.length - 1;
}

async function showPanel(id, dir = "") {
  const changed = panelId !== id;
  panelId = id;
  if (phone()) document.documentElement.style.setProperty("--sy", (scrollY + innerHeight / 2) + "px");
  document.body.classList.add("open");
  panel.removeAttribute("inert");
  panel.setAttribute("aria-hidden", "false");
  if (changed) {
    renderPanel(id, dir);
    if (calm()) panel.focus({ preventScroll: true });
    else requestAnimationFrame(() => panel.focus({ preventScroll: true }));
    setTimeout(() => { if (panelId) panel.dataset.shown = "1"; }, 450);
  }
  if (details.has(id)) return;
  try {
    await loadDetail(id);
    if (panelId === id) renderPanel(id);
  } catch {
    if (panelId === id) pscroll.innerHTML = `<h2 class="ptitle">${esc((state.items.find(i => i.id === id) || {}).title || "")}</h2><p class="nope">Not found.</p>`;
  }
}

function hidePanel() {
  panelId = null;
  delete panel.dataset.shown;
  collapseDemo();
  document.body.classList.remove("open");
  panel.setAttribute("inert", "");
  panel.setAttribute("aria-hidden", "true");
  pushed = false;
  setTimeout(() => { if (!panelId) pscroll.replaceChildren(); }, 600);
  if (focusBack && focusBack.isConnected) focusBack.focus({ preventScroll: true });
  focusBack = null;
}

/* User asked to close: undo our own history entry, or drop the hash of a deep link. */
function closePanel() {
  if (!panelId) return;
  if (pushed) { pushed = false; history.back(); }
  else { history.replaceState(history.state, "", location.pathname + location.search); hidePanel(); }
}

function onRoute() {
  const id = hashId();
  if (id) showPanel(id);
  else hidePanel();
}

function step(delta) {
  if (!panelId) return;
  collapseDemo();
  const ids = visible().map(it => it.id);
  const next = ids[ids.indexOf(panelId) + delta];
  if (!next) return;
  history.replaceState(history.state, "", "#/r/" + encodeURIComponent(next));
  showPanel(next, delta > 0 ? "next" : "prev");
  const c = $(`.card[data-id="${CSS.escape(next)}"]`, grid);
  if (c) { focusBack = $("a.open", c); if (!phone()) c.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }); }
}

/* demo: expand to the viewport with a FLIP, so it grows out of its place */
function toggleDemo(wrap) {
  const before = wrap.getBoundingClientRect();
  const full = wrap.classList.toggle("full");
  const btn = $("[data-expand]", wrap);
  btn.innerHTML = full ? `${ICON.shrink}<span>Collapse</span>` : `${ICON.expand}<span>Expand</span>`;
  if (calm()) return;
  const after = wrap.getBoundingClientRect();
  wrap.animate([
    { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, transformOrigin: "0 0" },
    { transform: "none", transformOrigin: "0 0" },
  ], { duration: 520, easing: "cubic-bezier(.32,.72,0,1)" });
}
function collapseDemo() {
  const w = $(".demo-wrap.full");
  if (w) toggleDemo(w);
}

function zoom(img) {
  const z = document.createElement("div");
  z.className = "zoom";
  z.tabIndex = -1;
  z.innerHTML = `<img src="${esc(img.currentSrc || img.src)}" alt="${esc(img.alt)}">`;
  const back = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    z.classList.add("out");
    setTimeout(() => { z.remove(); removeEventListener("keydown", onKey, true); }, 200);
    (back && back !== document.body && back.isConnected ? back : panel).focus({ preventScroll: true });
  };
  /* the open lightbox owns the keyboard: no shortcut runs behind it, scroll keys keep their default */
  const onKey = e => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") e.preventDefault();
  };
  z.addEventListener("click", close);
  addEventListener("keydown", onKey, true);
  document.body.append(z);
  z.focus({ preventScroll: true });
}

/* ---------- copy link: the shareable /r/<id>, with a fallback for non-secure contexts ---------- */
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to execCommand */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

async function copyLink(id) {
  const url = location.origin + "/r/" + encodeURIComponent(id);
  toast(await copyText(url) ? "Link copied" : "Could not copy the link.");
}

/* ---------- delete: the pill opens into Cancel / Delete; the second press deletes ---------- */
let armed = null, armTimer = 0;
function disarm() {
  if (!armed) return;
  armed.classList.remove("arm", "shake");
  $(".no", armed).tabIndex = -1;
  armed = null;
  clearTimeout(armTimer);
}
function arm(k) {
  disarm();
  armed = k;
  k.classList.add("arm");
  $(".no", k).tabIndex = 0;
  clearTimeout(armTimer);
  armTimer = setTimeout(disarm, 5000);
}
function onKill(e) {
  const k = e.target.closest("[data-kill]");
  if (!k) return false;
  e.preventDefault(); e.stopPropagation();
  if (e.target.closest(".no")) { disarm(); $(".yes", k).focus({ preventScroll: true }); return true; }
  if (!e.target.closest(".yes")) return true;
  if (k.classList.contains("arm")) { const id = k.dataset.kill; disarm(); doDelete(id); }
  else arm(k);
  return true;
}

async function doDelete(id) {
  const idx = state.items.findIndex(i => i.id === id);
  const removed = idx >= 0 ? state.items[idx] : null;
  if (panelId === id) closePanel();
  const el = $(`.card[data-id="${CSS.escape(id)}"]`, grid);
  if (el && !calm()) { el.classList.add("leaving"); await new Promise(r => setTimeout(r, 260)); }
  gone.add(id);
  if (removed) state.items.splice(state.items.indexOf(removed), 1);
  renderGrid("morph");
  try {
    const r = await fetch("/api/references/" + encodeURIComponent(id), { method: "DELETE" });
    if (!r.ok && r.status !== 404) {
      let msg = "";
      try { msg = ((await r.json()) || {}).error || ""; } catch { /* no json body */ }
      throw new Error(msg || `The service answered ${r.status}.`);
    }
    details.delete(id);
    toast("Deleted");
  } catch (err) {
    gone.delete(id);
    if (removed) state.items.splice(Math.min(idx, state.items.length), 0, removed);
    renderGrid("morph");
    toast(`Not deleted. ${err.message || ""}`.trim());
  }
}

/* ---------- toast ---------- */
function toast(msg) {
  toastEl.hidden = true;
  void toastEl.offsetWidth;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, msg.length < 20 ? 2200 : 6000);
}

/* ---------- interaction ---------- */
for (const btn of typeBtns) {
  btn.setAttribute("aria-pressed", String((btn.dataset.type || "") === state.type));
  btn.addEventListener("click", async () => {
    if ((btn.dataset.type || "") === state.type) return;
    state.type = btn.dataset.type || "";
    for (const b of typeBtns) b.setAttribute("aria-pressed", String(b === btn));
    placeThumb(typeSeg);
    if (phone()) btn.scrollIntoView({ behavior: calm() ? "auto" : "smooth", inline: "center", block: "nearest" });
    syncURL();
    if (!(await loadTags())) { state.tag = ""; syncURL(); }
    load();
  });
}

rail.addEventListener("click", e => {
  const c = e.target.closest(".chip");
  if (c) setTag(c.dataset.tag === state.tag ? "" : c.dataset.tag, "rail");
});
rail.addEventListener("scroll", railFades, { passive: true });
addEventListener("resize", () => { railFades(); placeThumb(typeSeg, false); const t = $(".stage .seg", pscroll); if (t) placeThumb(t, false); });

/* search */
let qTimer = 0;
const syncFind = () => find.classList.toggle("has-q", !!searchIn.value);
searchIn.addEventListener("input", () => {
  syncFind();
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { state.q = searchIn.value; syncURL(); load(); }, 180);
});
searchIn.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.stopPropagation();
    if (searchIn.value) { searchIn.value = ""; syncFind(); state.q = ""; syncURL(); load(); }
    else searchIn.blur();
  }
});
searchIn.addEventListener("blur", () => { if (!searchIn.value) find.classList.remove("wide"); });
$(".clear", find).addEventListener("click", () => { searchIn.value = ""; syncFind(); state.q = ""; syncURL(); load(); searchIn.focus(); });
$(".glass", find).addEventListener("click", () => { find.classList.add("wide"); searchIn.focus(); });
$(".brand").addEventListener("click", e => {
  e.preventDefault();
  if (!state.type && !state.tag && !state.q) { scrollTo({ top: 0, behavior: calm() ? "auto" : "smooth" }); return; }
  resetFilters();
});

async function resetFilters() {
  state.type = ""; state.tag = ""; state.q = "";
  searchIn.value = ""; syncFind(); find.classList.remove("wide");
  for (const b of typeBtns) b.setAttribute("aria-pressed", String(!b.dataset.type));
  placeThumb(typeSeg);
  syncURL();
  await loadTags();
  load();
}

grid.addEventListener("click", e => {
  if (onKill(e)) return;
  if (e.target.closest("[data-reset]")) { resetFilters(); return; }
  const open = e.target.closest("a.open");
  if (open) { disarm(); focusBack = open; if (location.hash !== open.getAttribute("href")) pushed = true; }
});

panel.addEventListener("click", e => {
  if (onKill(e)) return;
  if (e.target.closest("[data-close]")) { closePanel(); return; }
  const st = e.target.closest("[data-step]");
  if (st) { step(Number(st.dataset.step)); return; }
  const ex = e.target.closest("[data-expand]");
  if (ex) { toggleDemo(ex.closest(".demo-wrap")); return; }
  if (e.target.closest("[data-copy]")) { copyLink(panelId); return; }
  const tab = e.target.closest("[data-view][role=tab]");
  if (tab) {
    const seg = tab.parentElement;
    for (const b of $$("[role=tab]", seg)) b.setAttribute("aria-selected", String(b === tab));
    placeThumb(seg);
    collapseDemo();
    for (const v of $$(".view", pscroll)) v.hidden = v.dataset.view !== tab.dataset.view;
    const v = $(`.view[data-view="${tab.dataset.view}"]`, pscroll);
    startDemos(v);
    for (const vid of $$("video", pscroll)) if (!v.contains(vid)) vid.pause();
    return;
  }
  const dot = e.target.closest(".dots button");
  if (dot) {
    const car = $(".car", pscroll), i = $$(".dots button", pscroll).indexOf(dot);
    car.scrollTo({ left: i * (car.clientWidth + 12), behavior: calm() ? "auto" : "smooth" });
    return;
  }
  const img = e.target.closest(".car img");
  if (img) { zoom(img); return; }
  const ft = e.target.closest("[data-ftag]");
  if (ft) {
    const t = ft.dataset.ftag;
    closePanel();
    if (state.type) {
      state.type = "";
      for (const b of typeBtns) b.setAttribute("aria-pressed", String(!b.dataset.type));
      placeThumb(typeSeg);
      loadTags().then(() => setTag(t));
    } else setTag(t);
  }
});
pscroll.addEventListener("scroll", e => {
  const car = e.target.closest && e.target.classList && e.target.classList.contains("car") ? e.target : null;
  if (!car) return;
  const i = Math.round(car.scrollLeft / (car.clientWidth + 12));
  $$(".dots button", pscroll).forEach((b, j) => b.setAttribute("aria-current", String(j === i)));
}, { capture: true, passive: true });

scrim.addEventListener("click", closePanel);
document.addEventListener("click", e => { if (armed && !armed.contains(e.target)) disarm(); });

addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (armed) { e.preventDefault(); disarm(); return; }
    if ($(".demo-wrap.full")) { e.preventDefault(); collapseDemo(); return; }
    if (panelId) { e.preventDefault(); closePanel(); }
    return;
  }
  const typing = e.target.matches && e.target.matches("input, textarea, select, video, audio, [contenteditable]");
  if (!typing && (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey)))) {
    e.preventDefault();
    if (panelId) closePanel();
    find.classList.add("wide");
    searchIn.focus(); searchIn.select();
    return;
  }
  if (typing || !panelId) return;
  if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
});

/* header: hairline once scrolled; on the phone it hides on the way down and returns on the way up */
{
  let lastY = scrollY, ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      top.classList.toggle("scrolled", y > 4);
      if (phone() && !document.body.classList.contains("open")) {
        if (y > lastY + 6 && y > 120 && !find.contains(document.activeElement)) top.classList.add("hide");
        else if (y < lastY - 6 || y < 120) top.classList.remove("hide");
      }
      lastY = y; ticking = false;
    });
  }, { passive: true });
}

/* ---------- phone sheet: drag down to close, with velocity and a scrim that follows ---------- */
{
  let y0 = null, dy = 0, t0 = 0, last = 0, lastT = 0, v = 0, fromContent = false;
  const start = e => {
    if (!phone() || !panelId || $(".demo-wrap.full")) return;
    const onBar = e.target.closest(".grab, .pbar");
    fromContent = !onBar && pscroll.contains(e.target) && pscroll.scrollTop <= 0 && !e.target.closest(".car, iframe, video");
    if (!onBar && !fromContent) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = lastT = performance.now(); last = y0; v = 0;
  };
  const move = e => {
    if (y0 == null) return;
    const y = e.touches[0].clientY, now = performance.now();
    let d = y - y0;
    if (fromContent && d < 0) { y0 = null; return; }
    dy = d > 0 ? d : d / 4;                                 // rubber band upwards
    v = (y - last) / Math.max(1, now - lastT); last = y; lastT = now;
    if (fromContent && d > 0 && e.cancelable) e.preventDefault();
    panel.classList.add("drag");
    panel.style.transform = `translateY(${dy}px)`;
    scrim.style.transition = "none";
    scrim.style.opacity = String(Math.max(0, 1 - dy / (panel.offsetHeight * .9)));
  };
  const end = () => {
    if (y0 == null) return;
    panel.classList.remove("drag");
    panel.style.transform = "";
    scrim.style.transition = ""; scrim.style.opacity = "";
    const far = dy > 120 || (v > .55 && dy > 24);
    y0 = null; dy = 0;
    if (far) closePanel();
  };
  panel.addEventListener("touchstart", start, { passive: true });
  panel.addEventListener("touchmove", move, { passive: false });
  panel.addEventListener("touchend", end);
  panel.addEventListener("touchcancel", end);
}

/* ---------- boot ---------- */
searchIn.value = state.q;
syncFind();
if (state.q && phone()) find.classList.add("wide");
skeleton(phone() ? 6 : 12);
document.fonts.ready.then(() => placeThumb(typeSeg, false));
placeThumb(typeSeg, false);
addEventListener("hashchange", onRoute);
loadTags();
load();
onRoute();
