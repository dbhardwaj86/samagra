"use strict";
const $ = (s, r = document) => r.querySelector(s);
const main = $("#main");
const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
const openUrl = (p) => `/open?path=${encodeURIComponent(p)}`;
let FACETS = { kinds: [], subjects: [] };

// ---- theme ----
const theme = localStorage.getItem("tos-theme") || "light";
document.documentElement.dataset.theme = theme;
$("#themeBtn").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  localStorage.setItem("tos-theme", t);
};

// ---- helpers ----
async function jget(url) { const r = await fetch(url); return r.json(); }
function table(headers, rows) {
  return `<table class="grid"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("") || `<tr><td colspan="${headers.length}" class="empty">No results.</td></tr>`}</tbody></table>`;
}
function statusPill(s) {
  if (!s) return "";
  const cls = /done|approved|extracted|enriched/.test(s) ? "ok"
    : /pending|drafted/.test(s) ? "pending" : "warn";
  return `<span class="pill ${cls}">${esc(s)}</span>`;
}

// ---- tabs ----
const TABS = {
  overview: renderOverview, questions: renderQuestions, lectures: renderLectures,
  booklets: () => renderSourceTable("booklets", "Booklets", ["Title", "Folder", ""]),
  insp: () => renderSourceTable("insp", "INSP / Olympiad", ["Title", "Kind", ""]),
  sims: renderSims, pipelines: renderPipelines,
};
function activate(tab) {
  document.querySelectorAll("nav.side .tab").forEach(a =>
    a.classList.toggle("active", a.dataset.tab === tab));
  (TABS[tab] || renderOverview)();
  history.replaceState(null, "", "#" + tab);
}
document.querySelectorAll("nav.side .tab").forEach(a =>
  a.onclick = () => activate(a.dataset.tab));

// ---- overview ----
async function renderOverview() {
  main.innerHTML = `<h1 class="page">Overview</h1><p class="lede">Loading…</p>`;
  const ov = await jget("/api/overview");
  const order = ["qx", "textbook", "booklets", "insp", "sims", "questiondb"];
  const byName = Object.fromEntries(ov.sources.map(s => [s.source, s]));
  const cards = order.filter(n => byName[n]).map(n => {
    const s = byName[n], sm = s.summary || {};
    const head = (sm.questions ?? sm.chapters ?? sm.booklets ?? sm.sims ??
      ((sm.sets || 0) + (sm.papers || 0))) || (s.available ? s.n_artifacts : "—");
    let meta = "";
    if (n === "qx") meta = `${sm.documents} papers`;
    else if (n === "textbook") meta = Object.entries(sm.by_status || {}).map(([k, v]) => `${v} ${k}`).join(", ");
    else if (n === "insp") meta = `${sm.sets} sets · ${sm.papers} papers`;
    else if (n === "questiondb") meta = esc(sm.status || "");
    return `<div class="card ${s.available ? "" : "off"}">
      <div class="n">${esc(head)}</div><div class="lbl">${esc(s.label)}</div>
      <div class="meta">${meta}</div></div>`;
  }).join("");
  main.innerHTML = `<h1 class="page">Overview</h1>
    <p class="lede">Unified catalog across ${ov.sources.length} sources · refreshed ${esc(ov.refreshed_at || "never")}</p>
    <div class="cards">${cards}</div>`;
  // sidebar counts
  for (const s of ov.sources) {
    const el = $("#ct-" + s.source);
    if (el) el.textContent = s.n_artifacts || "";
  }
}

// ---- questions (QX live) ----
async function renderQuestions() {
  main.innerHTML = `<h1 class="page">Questions <span class="src">QX · live</span></h1>
    <div class="toolbar">
      <input id="qq" placeholder="Search question text…" style="min-width:280px">
      <input id="qchap" placeholder="Chapter filter…">
      <select id="qtype"><option value="">any type</option>
        ${["mcq_single", "integer", "numeric", "mcq_multi", "matrix_match", "assertion_reason", "comprehension", "true_false"]
      .map(t => `<option>${t}</option>`).join("")}</select>
      <button class="btn" id="qgo">Search</button></div>
    <div id="qres"><div class="empty">Enter a query and search.</div></div>`;
  const run = async () => {
    const q = $("#qq").value, chap = $("#qchap").value, t = $("#qtype").value;
    $("#qres").innerHTML = `<div class="empty">Searching…</div>`;
    const d = await jget(`/api/questions?q=${encodeURIComponent(q)}&chapter=${encodeURIComponent(chap)}&qtype=${encodeURIComponent(t)}&limit=80`);
    if (d.error) { $("#qres").innerHTML = `<div class="empty">${esc(d.error)}</div>`; return; }
    const rows = d.results.map(r => `<tr>
      <td>${esc(r.text || "")}</td><td>${esc(r.chapter || "-")}</td>
      <td><span class="pill">${esc(r.q_type || "")}</span></td>
      <td>${esc(r.difficulty || "")}</td><td class="src">${esc(r.slug || "")}</td></tr>`);
    $("#qres").innerHTML = table(["Question", "Chapter", "Type", "Diff", "Source"], rows)
      + `<p class="lede">${d.results.length} shown (live from QX builder index).</p>`;
  };
  $("#qgo").onclick = run; $("#qq").onkeydown = e => { if (e.key === "Enter") run(); };
  run();
}

// ---- lectures (textbook) ----
async function renderLectures() {
  main.innerHTML = `<h1 class="page">Lectures</h1><p class="lede">Loading chapters…</p>`;
  const d = await jget("/api/search?source=textbook&limit=200");
  const byUnit = {};
  d.results.sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0));
  for (const r of d.results) (byUnit[r.unit || "—"] ??= []).push(r);
  let html = `<h1 class="page">Lectures <span class="src">physics-textbook</span></h1>
    <p class="lede">${d.results.length} chapters · click to preview the rendered lecture.</p>`;
  for (const [unit, items] of Object.entries(byUnit)) {
    const rows = items.map(r => {
      const slug = r.meta.slug || r.uid.split(":").pop();
      return `<tr><td>${r.meta.order || ""}</td>
        <td><a href="/lecture/${encodeURIComponent(slug)}" target="_blank">${esc(r.title)}</a></td>
        <td>${r.meta.sections ?? "—"} §</td><td>${statusPill(r.status)}</td></tr>`;
    });
    html += `<h3 style="margin:18px 0 8px">${esc(unit)}</h3>` +
      table(["#", "Chapter", "Sections", "Status"], rows);
  }
  main.innerHTML = html;
}

// ---- generic source table ----
async function renderSourceTable(source, title, headers) {
  main.innerHTML = `<h1 class="page">${esc(title)}</h1><p class="lede">Loading…</p>`;
  const d = await jget(`/api/search?source=${source}&limit=500`);
  const rows = d.results.map(r => {
    const folder = r.meta.folder || r.kind || "";
    const link = r.path ? `<a href="${openUrl(r.path)}" target="_blank">open</a>` : "";
    return `<tr><td>${esc(r.title)}</td><td>${esc(folder)}</td><td>${link}</td></tr>`;
  });
  main.innerHTML = `<h1 class="page">${esc(title)}</h1>
    <p class="lede">${d.results.length} item(s)</p>` + table(headers, rows);
}

// ---- sims ----
async function renderSims() {
  main.innerHTML = `<h1 class="page">Simulations</h1><p class="lede">Loading…</p>`;
  const d = await jget("/api/search?source=sims&limit=2000");
  const subjects = [...new Set(d.results.map(r => r.subject).filter(Boolean))].sort();
  const draw = (filter) => {
    const rows = d.results.filter(r => !filter || r.subject === filter).slice(0, 600).map(r =>
      `<tr><td><a href="${openUrl(r.path)}" target="_blank">${esc(r.title)}</a></td>
        <td>${esc(r.subject || "-")}</td><td>${esc(r.meta.grade || "-")}</td></tr>`);
    $("#simres").innerHTML = table(["Simulation", "Subject", "Grade"], rows) +
      `<p class="lede">${rows.length} shown of ${d.results.length}.</p>`;
  };
  main.innerHTML = `<h1 class="page">Simulations <span class="src">pratyaksh · read-only</span></h1>
    <div class="toolbar"><select id="simsubj"><option value="">all subjects</option>
      ${subjects.map(s => `<option>${esc(s)}</option>`).join("")}</select></div>
    <div id="simres"></div>`;
  $("#simsubj").onchange = e => draw(e.target.value);
  draw("");
}

// ---- pipelines ----
async function renderPipelines() {
  main.innerHTML = `<h1 class="page">Pipelines</h1><p class="lede">Loading…</p>`;
  const d = await jget("/api/pipelines");
  const pipes = d.pipelines.map(p => {
    const phases = Object.entries(p.phases).map(([name, ph]) =>
      `<div class="phase"><span class="dot ${ph.status}"></span>${esc(name)}
        ${ph.gate ? '<span class="gate">gate</span>' : ""}
        <span class="own">${esc(ph.owner || "")}</span></div>`).join("");
    return `<div class="pipe"><h3>${esc(p.label)}</h3>
      <div class="src">current: ${esc(p.current)}</div>${phases}</div>`;
  }).join("");
  main.innerHTML = `<h1 class="page">Pipelines</h1>
    <p class="lede">Phase state machine · gates pause for human approval (Phase D wires scheduling + notify).</p>
    <div class="pipes">${pipes}</div>`;
}

// ---- global search ----
async function globalSearch(q) {
  main.innerHTML = `<h1 class="page">Search: “${esc(q)}”</h1><p class="lede">Searching…</p>`;
  const d = await jget(`/api/search?q=${encodeURIComponent(q)}&limit=200`);
  const rows = d.results.map(r => {
    const slug = r.meta.slug || "";
    const link = r.source === "textbook" && slug
      ? `<a href="/lecture/${encodeURIComponent(slug)}" target="_blank">preview</a>`
      : (r.path ? `<a href="${openUrl(r.path)}" target="_blank">open</a>` : "");
    return `<tr><td class="src">${esc(r.source)}</td><td>${esc(r.kind)}</td>
      <td>${esc(r.title)}</td><td>${esc(r.subject || "-")}</td><td>${link}</td></tr>`;
  });
  main.innerHTML = `<h1 class="page">Search: “${esc(q)}”</h1>
    <p class="lede">${d.results.length} result(s) across all sources</p>` +
    table(["Source", "Kind", "Title", "Subject", ""], rows);
}
const gs = $("#globalSearch");
gs.onkeydown = e => {
  if (e.key === "Enter" && gs.value.trim()) globalSearch(gs.value.trim());
  if (e.key === "Escape") { gs.value = ""; activate("overview"); }
};

// ---- refresh ----
$("#refreshBtn").onclick = async () => {
  $("#refreshBtn").textContent = "↻ …";
  await fetch("/api/refresh", { method: "POST" });
  $("#refreshBtn").textContent = "↻ Refresh";
  activate("overview");
};

// ---- boot ----
(async () => {
  try { FACETS = await jget("/api/facets"); } catch { }
  const tab = (location.hash || "#overview").slice(1);
  activate(TABS[tab] ? tab : "overview");
})();
