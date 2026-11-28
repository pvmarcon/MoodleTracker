"use strict";
/* MoodleTracker UI — vanilla JS, sem build. Polling leve + hash routing. */

const STAGES = ["discovered", "extracted", "markdown", "chunked", "embedded", "drafted"];
const STAGE_LABEL = { discovered: "Descoberto", extracted: "Extraído", markdown: "Markdown", chunked: "Chunks", embedded: "Embeddings", drafted: "Rascunho" };
const STATUS = { queued: ["Na fila", "gray"], processing: ["Processando", "blue pulse"], completed: ["Concluído", "green"], failed: ["Falhou", "red"], duplicate: ["Duplicado", "yellow"] };
const REVIEW = { unreviewed: ["Não revisado", ""], approved: ["Aprovado", "green"], needs_changes: ["Ajustes", "yellow"] };
const POLL_MS = 5000;

const state = { courses: [], stats: null, health: null, lastEventId: 0, drawerItem: null, drawerSig: null, timer: null };
const $ = (sel, el = document) => el.querySelector(sel);

// ------------------------------------------------------------------ utils
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
function age(iso) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const badge = ([label, cls]) => `<span class="badge ${cls}">${esc(label)}</span>`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)) : `HTTP ${res.status}`);
  return body;
}

/** Stepper compacto: concluídos verdes, estágio atual azul (processando), falha vermelha no próximo, futuros tracejados. */
function stepper(item, { label = true } = {}) {
  const idx = item.stage_index;
  const failIdx = item.status === "failed" ? Math.min(idx + 1, STAGES.length - 1) : -1;
  const cells = STAGES.map((s, i) => {
    let cls = "";
    if (s === "drafted") cls = "future";
    else if (i === failIdx) cls = "fail";
    else if (i < idx || (i === idx && item.status !== "processing")) cls = "done";
    else if (i === idx + 1 && item.status === "processing") cls = "current";
    return `<i class="${cls}" title="${STAGE_LABEL[s]}"></i>`;
  }).join("");
  const text = item.status === "failed" ? `falhou em ${STAGE_LABEL[STAGES[failIdx]]}` : STAGE_LABEL[item.stage];
  return `<span class="stepper">${cells}${label ? `<span class="lbl">${esc(text)}</span>` : ""}</span>`;
}

function stepsLarge(item) {
  const idx = item.stage_index;
  const failIdx = item.status === "failed" ? Math.min(idx + 1, STAGES.length - 1) : -1;
  return `<div class="steps-lg">${STAGES.map((s, i) => {
    const cls = s === "drafted" ? "future" : i === failIdx ? "fail" : i <= idx ? "done" : i === idx + 1 && item.status === "processing" ? "current" : "";
    return `<div class="${cls}">${STAGE_LABEL[s]}</div>`;
  }).join("")}</div>`;
}

/** Markdown mínimo e seguro: escapa tudo antes de aplicar a formatação. */
function renderMarkdown(src) {
  const lines = esc(src).split("\n");
  const out = [];
  let list = null, table = null, para = [], code = null;
  const inline = (t) => t
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<span class="wikilink">${b || a}</span>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/&lt;small&gt;(.*?)&lt;\/small&gt;/g, "<small>$1</small>");
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; }
    if (table) { out.push(`<table>${table.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("")}</table>`); table = null; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (code !== null) {
      if (line.startsWith("```")) { out.push(`<pre><code>${code.join("\n")}</code></pre>`); code = null; } else code.push(raw);
      continue;
    }
    if (line.startsWith("```")) { flush(); code = []; continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^\|.*\|$/.test(line)) {
      if (list || para.length) flush();
      if (/^\|[\s-:|]+\|$/.test(line)) continue;
      (table ??= []).push(line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
      continue;
    }
    if ((m = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/))) {
      if (para.length || table) flush();
      const tag = m[1] ? "ol" : "ul";
      if (!list || list.tag !== tag) { flush(); list = { tag, items: [] }; }
      list.items.push(m[2]);
      continue;
    }
    if ((m = line.match(/^&gt;\s?(.*)$/))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if (/^---+$/.test(line)) { flush(); out.push("<hr />"); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}

// ------------------------------------------------------------------ routing
function route() {
  const [path, query] = (location.hash.replace(/^#/, "") || "/dashboard").split("?");
  return { view: path.replace(/^\//, "") || "dashboard", params: new URLSearchParams(query || "") };
}
function go(view, params) {
  const q = params && params.toString();
  location.hash = `#/${view}${q ? `?${q}` : ""}`;
}

async function render() {
  const { view, params } = route();
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  try {
    if (view === "items") await renderItems(params);
    else if (view === "runs") await renderRuns();
    else await renderDashboard();
  } catch (e) {
    $("#view").innerHTML = `<div class="panel"><div class="empty">Erro ao carregar: ${esc(e.message)}</div></div>`;
  }
}

// ------------------------------------------------------------------ shared data
async function refreshShared() {
  const [health, stats, courses] = await Promise.all([api("/api/health"), api("/api/stats"), api("/api/courses")]);
  state.health = health;
  state.stats = stats;
  state.courses = courses;
  const h = $("#health");
  h.className = `health ${health.status === "ok" ? "ok" : "bad"}`;
  const sch = health.scheduler || {};
  const next = sch.next_run_at ? ` · próxima em ${Math.max(0, Math.round((new Date(sch.next_run_at) - Date.now()) / 1000))}s` : "";
  $(".label", h).textContent = health.status === "ok" ? `DB ok · ${sch.mode}${next}` : "Banco indisponível";
  h.title = health.error || `pgvector ${health.database?.pgvector} · coletor ${health.collector} · embeddings ${health.embeddings}`;
}

// ------------------------------------------------------------------ dashboard
function statCards(st) {
  const s = st.stats, bs = s.by_status, br = s.by_review;
  const cards = [
    ["Itens", s.items, `${state.courses.length} matérias`, "blue"],
    ["Concluídos", bs.completed || 0, `${s.documents} arquivos .md`, "green"],
    ["Fila / processando", (bs.queued || 0) + (bs.processing || 0), "aguardando worker", ""],
    ["Falhas", bs.failed || 0, "ver detalhes", (bs.failed || 0) ? "red" : ""],
    ["Para revisar", br.unreviewed || 0, `${br.approved || 0} aprovados · ${br.needs_changes || 0} ajustes`, "yellow"],
    ["Chunks", s.chunks, `${s.embedded_chunks} com embedding`, "purple"],
  ];
  return `<div class="stats">${cards.map(([k, v, sub, c]) => `<div class="stat ${c}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${esc(sub)}</div></div>`).join("")}</div>`;
}

function funnel(st) {
  const by = st.stats.by_stage;
  return `<div class="funnel">${STAGES.map((s) => `<a href="#/items?stage=${s}" class="${s === "drafted" ? "future" : ""}" title="${s === "drafted" ? "Próxima fase" : ""}">
      <div class="n">${by[s] || 0}</div><div class="l">${STAGE_LABEL[s]}</div></a>`).join("")}</div>`;
}

function itemRow(it, { compact = false } = {}) {
  return `<tr class="row ${state.drawerItem === it.id ? "selected" : ""}" data-item="${it.id}">
    <td class="muted nowrap" title="${esc(fmtDate(it.collected_at))}">${age(it.collected_at)}</td>
    <td class="title-cell"><div class="t1">${esc(it.title)}</div><div class="t2">${esc(it.source_id)}</div></td>
    ${compact ? "" : `<td class="muted hide-sm">${esc(it.module)}</td>`}
    <td class="hide-sm"><span class="type">${esc(it.item_type)}</span></td>
    <td>${stepper(it)}</td>
    <td>${badge(STATUS[it.status])}</td>
    <td class="hide-sm">${badge(REVIEW[it.review_status])}</td>
  </tr>`;
}

function eventRow(e, fresh) {
  const title = e.item_title ? `${e.course_name ? e.course_name + " › " : ""}${e.item_title}` : "pipeline";
  return `<div class="ev ${esc(e.level)} ${esc(e.kind)} ${fresh ? "fresh" : ""}" data-item="${e.item_id ?? ""}">
    <div class="bar"></div>
    <div><div class="m">${esc(e.message)}</div><div class="s">${esc(title)}${e.stage ? ` · ${STAGE_LABEL[e.stage]}` : ""}</div></div>
    <div class="age" title="${esc(fmtDate(e.created_at))}">${age(e.created_at)}</div>
  </div>`;
}

async function renderDashboard() {
  await refreshShared();
  const [recent, events] = await Promise.all([api("/api/items?limit=15"), api("/api/events?limit=40")]);
  const prevMax = state.lastEventId;
  state.lastEventId = events[0]?.id || prevMax;
  const sorted = [...recent.items].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  $("#view").innerHTML = `
    ${statCards(state.stats)}
    ${funnel(state.stats)}
    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><span class="title">Atividade recente</span><span class="meta"><a href="#/items">ver todos →</a></span></div>
        ${sorted.length ? `<table class="t"><thead><tr><th>Idade</th><th>Item</th><th class="hide-sm">Tipo</th><th>Estágio</th><th>Status</th><th class="hide-sm">Revisão</th></tr></thead>
          <tbody>${sorted.map((i) => itemRow(i, { compact: true })).join("")}</tbody></table>`
          : `<div class="empty">Nenhum item ainda. Coloque arquivos em <span class="mono">data/inbox/&lt;Disciplina&gt;/&lt;Aula&gt;/</span> e clique em <b>Executar agora</b>.</div>`}
      </section>
      <section class="panel">
        <div class="panel-head"><span class="title">Feed de eventos</span><span class="meta">ao vivo</span></div>
        <div class="feed">${events.map((e) => eventRow(e, prevMax && e.id > prevMax)).join("") || '<div class="empty">Sem eventos.</div>'}</div>
      </section>
    </div>`;
}

// ------------------------------------------------------------------ items
async function renderItems(params) {
  await refreshShared();
  const q = new URLSearchParams();
  for (const k of ["course_id", "stage", "status", "review_status", "item_type", "q", "offset"]) if (params.get(k)) q.set(k, params.get(k));
  q.set("limit", "100");
  const page = await api(`/api/items?${q}`);
  const grouped = params.get("group") !== "0";
  const opt = (pairs, cur) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("");
  const offset = Number(params.get("offset") || 0);

  let body = "";
  if (!page.items.length) body = `<tr><td colspan="7"><div class="empty">Nenhum item com esses filtros.</div></td></tr>`;
  else if (grouped) {
    let course = null;
    for (const it of page.items) {
      if (it.course !== course) {
        course = it.course;
        const n = page.items.filter((x) => x.course === course).length;
        body += `<tr class="group"><td colspan="7">${esc(course)}<span class="count">${n}</span></td></tr>`;
      }
      body += itemRow(it);
    }
  } else body = page.items.map((i) => itemRow(i)).join("");

  $("#view").innerHTML = `
    <section class="panel">
      <form class="filters" id="filters">
        <input class="input" name="q" placeholder="Buscar título, módulo ou arquivo…" value="${esc(params.get("q") || "")}" />
        <select class="select" name="course_id"><option value="">Todas as matérias</option>${opt(state.courses.map((c) => [c.id, `${c.name} (${c.items})`]), params.get("course_id"))}</select>
        <select class="select" name="stage"><option value="">Todos os estágios</option>${opt(STAGES.map((s) => [s, STAGE_LABEL[s]]), params.get("stage"))}</select>
        <select class="select" name="status"><option value="">Todos os status</option>${opt(Object.entries(STATUS).map(([k, v]) => [k, v[0]]), params.get("status"))}</select>
        <select class="select" name="review_status"><option value="">Revisão: todas</option>${opt(Object.entries(REVIEW).map(([k, v]) => [k, v[0]]), params.get("review_status"))}</select>
        <select class="select" name="item_type"><option value="">Tipo</option>${opt([["pdf", "PDF"], ["pptx", "PPTX"], ["html", "HTML"]], params.get("item_type"))}</select>
        <label class="toggle"><input type="checkbox" name="group" ${grouped ? "checked" : ""} /> Agrupar por matéria</label>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" id="clear-filters">Limpar</button>
      </form>
      <table class="t"><thead><tr><th>Idade</th><th>Item</th><th class="hide-sm">Módulo / aula</th><th class="hide-sm">Tipo</th><th>Estágio</th><th>Status</th><th class="hide-sm">Revisão</th></tr></thead>
        <tbody>${body}</tbody></table>
      <div class="pager"><span>${page.total} itens</span><span class="spacer" style="flex:1"></span>
        <button class="btn" data-page="-1" ${offset <= 0 ? "disabled" : ""}>‹ Anterior</button>
        <span>${page.total ? offset + 1 : 0}–${Math.min(offset + page.limit, page.total)}</span>
        <button class="btn" data-page="1" ${offset + page.limit >= page.total ? "disabled" : ""}>Próxima ›</button></div>
    </section>`;

  const form = $("#filters");
  const apply = () => {
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (v && k !== "group") p.set(k, v);
    if (!form.group.checked) p.set("group", "0");
    go("items", p);
  };
  form.addEventListener("change", apply);
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
  let debounce;
  form.q.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(apply, 350); });
  $("#clear-filters").addEventListener("click", () => go("items"));
  document.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", () => {
    const p = new URLSearchParams(params);
    p.set("offset", String(Math.max(0, offset + Number(b.dataset.page) * page.limit)));
    go("items", p);
  }));
  if (document.activeElement?.name !== "q" && params.get("q")) { form.q.focus(); form.q.setSelectionRange(form.q.value.length, form.q.value.length); }
}

// ------------------------------------------------------------------ runs
async function renderRuns() {
  await refreshShared();
  const runs = state.stats.runs;
  const st = { running: ["Rodando", "blue pulse"], succeeded: ["Sucesso", "green"], failed: ["Falhou", "red"], skipped: ["Ignorada", "gray"] };
  $("#view").innerHTML = `<section class="panel">
    <div class="panel-head"><span class="title">Execuções do pipeline</span><span class="meta">${esc(state.health?.scheduler?.mode || "")}${state.health?.scheduler?.interval_seconds ? ` · a cada ${state.health.scheduler.interval_seconds}s` : ""}</span></div>
    ${runs.length ? `<table class="t"><thead><tr><th>#</th><th>Início</th><th>Gatilho</th><th>Status</th><th>Descobertos</th><th>Processados</th><th>Falhas</th><th>Duração</th><th>Erro</th></tr></thead><tbody>
      ${runs.map((r) => {
        const d = r.stats.discovered || {};
        const disc = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—";
        return `<tr><td class="mono">${r.id}</td><td class="nowrap">${fmtDate(r.started_at)}</td><td>${esc(r.trigger)}</td><td>${badge(st[r.status] || [r.status, ""])}</td>
          <td class="muted">${esc(disc)}</td><td>${r.stats.processed ?? "—"}</td><td>${r.stats.failed ?? "—"}</td><td class="mono">${r.stats.duration_s != null ? r.stats.duration_s + "s" : "—"}</td><td class="muted">${esc(r.error || "")}</td></tr>`;
      }).join("")}</tbody></table>` : '<div class="empty">Nenhuma execução ainda.</div>'}</section>`;
}

// ------------------------------------------------------------------ drawer
async function openDrawer(id, { keepDoc = false, poll = false } = {}) {
  state.drawerItem = id;
  const d = await api(`/api/items/${id}`);
  const it = d.item;
  const sig = `${id}|${it.updated_at}|${it.status}|${it.stage}|${d.events.length}|${d.chunks}|${d.embedded_chunks}`;
  if (poll && sig === state.drawerSig) return; // nada mudou: não redesenha (preserva rolagem do .md)
  state.drawerSig = sig;
  const activeDoc = keepDoc ? $(".docs a.active")?.dataset.doc : null;
  $("#drawer-body").innerHTML = `
    <div class="d-head">
      <div style="flex:1;min-width:0"><h3 id="drawer-title">${esc(it.title)}</h3><div class="sub">${esc(it.course)} › ${esc(it.module)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">${badge(STATUS[it.status])}${badge(REVIEW[it.review_status])}<span class="type">${esc(it.item_type)}</span></div></div>
      <button class="btn btn-ghost" data-close aria-label="Fechar">✕</button>
    </div>
    <div class="d-sec"><h2 class="section">Pipeline</h2>${stepsLarge(it)}
      ${it.error ? `<div class="err" style="margin-top:10px">${esc(it.error)}</div>` : ""}
      ${it.duplicate_of_id ? `<p class="muted">Conteúdo idêntico ao <a href="#" data-open="${it.duplicate_of_id}">item #${it.duplicate_of_id}</a>.</p>` : ""}
      <div style="margin-top:10px"><button class="btn" id="reprocess" ${it.status === "duplicate" ? "disabled" : ""}>↻ Reprocessar</button></div></div>
    <div class="d-sec"><dl class="kv">
      <dt>Arquivo</dt><dd class="mono">${esc(it.source_id)}</dd>
      <dt>Tamanho</dt><dd>${fmtBytes(it.size_bytes)}</dd>
      <dt>Hash</dt><dd class="mono">${esc(it.content_hash.slice(0, 16))}…</dd>
      <dt>Coletado</dt><dd>${fmtDate(it.collected_at)}</dd>
      <dt>Processado</dt><dd>${fmtDate(it.processed_at)}</dd>
      <dt>Chunks</dt><dd>${d.chunks} (${d.embedded_chunks} com embedding)</dd>
      <dt>Tentativas</dt><dd>${it.attempts}</dd></dl></div>
    <div class="d-sec"><h2 class="section">Revisão</h2>
      <textarea id="review-note" placeholder="Observação (opcional)">${esc(it.review_note || "")}</textarea>
      <div class="review-actions">
        <button class="btn btn-green" data-review="approved">✓ Aprovar</button>
        <button class="btn btn-yellow" data-review="needs_changes">✎ Precisa de ajustes</button>
        <button class="btn btn-ghost" data-review="unreviewed">Limpar</button>
        ${it.reviewed_at ? `<span class="muted" style="align-self:center">revisado ${fmtDate(it.reviewed_at)}</span>` : ""}
      </div>
      <p class="muted" style="margin:10px 0 0">Rascunho/resumo do agente: disponível na próxima fase (estágio <b>Rascunho</b>).</p></div>
    <div class="d-sec"><h2 class="section">Partições .md (${d.documents.length})</h2>
      <div class="docs">${d.documents.map((doc) => `<a href="#" data-doc="${doc.id}"><span class="ord">${String(doc.ordinal).padStart(2, "0")}</span><span>${esc(doc.title)}</span><span class="loc">${esc(doc.locator)}</span></a>`).join("") || '<span class="muted">Nenhuma partição gerada ainda.</span>'}</div>
      <div id="doc-view" style="margin-top:10px"></div></div>
    <div class="d-sec"><h2 class="section">Linha do tempo</h2><ul class="timeline">
      ${d.events.map((e) => `<li><span class="when" title="${esc(fmtDate(e.created_at))}">${age(e.created_at)}</span><span class="${esc(e.level)}">${e.stage ? `<b>${STAGE_LABEL[e.stage]}</b> · ` : ""}${esc(e.message)}</span></li>`).join("")}
    </ul></div>`;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  document.querySelectorAll("tr.row").forEach((r) => r.classList.toggle("selected", Number(r.dataset.item) === id));
  const first = activeDoc || d.documents[0]?.id;
  if (first) await showDoc(first);
}

async function showDoc(docId) {
  document.querySelectorAll(".docs a").forEach((a) => a.classList.toggle("active", a.dataset.doc === String(docId)));
  const view = $("#doc-view");
  try {
    const doc = await api(`/api/documents/${docId}`);
    const fm = Object.entries(doc.frontmatter).filter(([k]) => k !== "tags").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
    view.innerHTML = `<div class="fm">${esc(fm)}</div><div class="md">${renderMarkdown(doc.markdown)}</div><div class="muted mono" style="margin-top:6px">${esc(doc.path)}</div>`;
  } catch (e) {
    view.innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

function closeDrawer() {
  state.drawerItem = null;
  state.drawerSig = null;
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  document.querySelectorAll("tr.row.selected").forEach((r) => r.classList.remove("selected"));
}

// ------------------------------------------------------------------ events
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-item],[data-close],[data-doc],[data-review],[data-open],#reprocess,#run-now");
  if (!t) return;
  if (t.matches("[data-close]")) return closeDrawer();
  if (t.matches("[data-doc]")) { e.preventDefault(); return showDoc(t.dataset.doc); }
  if (t.matches("[data-open]")) { e.preventDefault(); return openDrawer(Number(t.dataset.open)); }
  if (t.matches("[data-item]")) { if (t.dataset.item) openDrawer(Number(t.dataset.item)); return; }
  try {
    if (t.matches("[data-review]")) {
      await api(`/api/items/${state.drawerItem}/review`, { method: "PATCH", body: JSON.stringify({ status: t.dataset.review, note: $("#review-note").value || null }) });
      toast("Revisão registrada");
      await Promise.all([openDrawer(state.drawerItem, { keepDoc: true }), render()]);
    } else if (t.id === "reprocess") {
      const r = await api(`/api/items/${state.drawerItem}/reprocess`, { method: "POST" });
      toast(r.detail);
      await openDrawer(state.drawerItem, { keepDoc: true });
    } else if (t.id === "run-now") {
      t.disabled = true;
      const r = await api("/api/pipeline/run", { method: "POST" });
      toast(r.detail);
      setTimeout(() => { t.disabled = false; render(); }, 1200);
    }
  } catch (err) {
    toast(`Erro: ${err.message}`);
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
window.addEventListener("hashchange", render);

function schedulePoll() {
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (!document.hidden && !typing) {
      await render();
      if (state.drawerItem) await openDrawer(state.drawerItem, { keepDoc: true, poll: true }).catch(() => {});
    }
    schedulePoll();
  }, POLL_MS);
}

render().then(schedulePoll);
