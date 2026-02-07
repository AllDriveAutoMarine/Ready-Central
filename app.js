// Ready Central — local-first app
const STORAGE_KEYS = {
  drivers: "rc_drivers_v1",
  logs: "rc_logs_v1"
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove("show"), 2400);
}

function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}

function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- Sticky hero collapse (smooth, non-jumpy) ---
const hero = document.querySelector(".hero");
let collapsed = false;
let ticking = false;

function setCollapsed(next) {
  if (!hero || next === collapsed) return;
  collapsed = next;
  hero.classList.toggle("is-collapsed", collapsed);
}

function onScroll() {
  if (ticking) return;
  ticking = true;

  requestAnimationFrame(() => {
    setCollapsed(window.scrollY > 60);
    ticking = false;
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Collapse immediately when user clicks a tab or any data-nav button
document.querySelectorAll(".tab, [data-nav]").forEach((el) => {
  el.addEventListener("click", () => setCollapsed(true));
});

// State
let drivers = load(STORAGE_KEYS.drivers, []);
let logs = load(STORAGE_KEYS.logs, []);

// Tabs (match AllDrive feel: click to swap sections)
function setActiveTab(name){
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $$(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  // update hash for shareability
  const el = document.getElementById(`tab-${name}`);
  if(el) history.replaceState(null, "", `#tab-${name}`);
}

function bindTabs(){
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setActiveTab(btn.dataset.tab));
  });

  // “data-nav” buttons inside content
  $$("[data-nav]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const target = el.getAttribute("data-nav");
      setActiveTab(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // hash load
  const hash = location.hash || "";
  const match = hash.match(/#tab-([a-z-]+)/i);
  if(match && match[1]){
    const name = match[1];
    if($(`.tab[data-tab="${name}"]`)) setActiveTab(name);
  }
}

// Render drivers into lists + dropdowns
function renderDrivers(){
  const list = $("#driverList");
  if(list){
    if(drivers.length === 0){
      list.innerHTML = `<div class="item"><div><h4>No drivers saved yet</h4><p>Add a driver above.</p></div></div>`;
    } else {
      list.innerHTML = drivers.map(d => `
        <div class="item">
          <div>
            <h4>${escapeHtml(d.name)}</h4>
            <div class="meta">
              License: ${d.license || "—"} &nbsp; | &nbsp; Med: ${d.med || "—"}
            </div>
            ${d.notes ? `<p>${escapeHtml(d.notes)}</p>` : `<p class="muted">No notes.</p>`}
          </div>
          <div class="actions">
            <button class="smallbtn" data-edit="${d.id}">Edit</button>
            <button class="smallbtn danger" data-del="${d.id}">Delete</button>
          </div>
        </div>
      `).join("");
    }

    // bind edit/delete
    $$("[data-del]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const id = b.getAttribute("data-del");
        if(!confirm("Delete this driver?")) return;
        drivers = drivers.filter(x=>x.id !== id);
        // also remove logs tied to driver? keep them but mark unknown
        save(STORAGE_KEYS.drivers, drivers);
        renderAll();
        toast("Driver deleted.");
      });
    });

    $$("[data-edit]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const id = b.getAttribute("data-edit");
        const d = drivers.find(x=>x.id === id);
        if(!d) return;
        $("#d_name").value = d.name;
        $("#d_license").value = d.license || "";
        $("#d_med").value = d.med || "";
        $("#d_notes").value = d.notes || "";
        $("#driverForm").dataset.editing = id;
        toast("Editing driver — click Save Driver to update.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // dropdowns
  const opts = drivers.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  ["#cl_driver", "#rc_driver", "#l_driver"].forEach(sel=>{
    const el = $(sel);
    if(!el) return;
    el.innerHTML = drivers.length
      ? `<option value="">Select driver</option>${opts}`
      : `<option value="">No drivers saved</option>`;
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Drivers form
function bindDriverForm(){
  const form = $("#driverForm");
  const clearBtn = $("#driverClear");
  if(!form) return;

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const name = $("#d_name").value.trim();
    const license = $("#d_license").value || "";
    const med = $("#d_med").value || "";
    const notes = $("#d_notes").value.trim();

    if(!name){
      toast("Driver name is required.");
      return;
    }

    const editing = form.dataset.editing;
    if(editing){
      drivers = drivers.map(d => d.id === editing ? { ...d, name, license, med, notes } : d);
      delete form.dataset.editing;
      toast("Driver updated.");
    } else {
      drivers.unshift({ id: uid(), name, license, med, notes, createdAt: new Date().toISOString() });
      toast("Driver saved.");
    }

    save(STORAGE_KEYS.drivers, drivers);
    form.reset();
    renderAll();
  });

  clearBtn?.addEventListener("click", ()=>{
    form.reset();
    delete form.dataset.editing;
    toast("Cleared.");
  });
}

// Checklist
function bindChecklist(){
  const saveBtn = $("#saveChecklist");
  const resetBtn = $("#resetChecklist");

  saveBtn?.addEventListener("click", ()=>{
    const driverId = $("#cl_driver")?.value || "";
    if(!driverId){
      toast("Select a driver first.");
      return;
    }
    const driverName = drivers.find(d=>d.id===driverId)?.name || "Unknown";

    const checks = $$("#tab-checklist input[type='checkbox']");
    const done = checks.filter(c=>c.checked).map(c=>c.dataset.item);
    const total = checks.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;

    logs.unshift({
      id: uid(),
      driverId,
      driverName,
      date: new Date().toISOString().slice(0,10),
      type: "Checklist",
      notes: `Checklist completion: ${pct}%\n- ` + (done.length ? done.join("\n- ") : "No items checked"),
      createdAt: new Date().toISOString()
    });

    save(STORAGE_KEYS.logs, logs);
    toast("Checklist saved to Activity Log.");
    renderLogs();
  });

  resetBtn?.addEventListener("click", ()=>{
    $$("#tab-checklist input[type='checkbox']").forEach(c=>c.checked=false);
    toast("Checklist reset.");
  });
}

// Calculator
function bindCalc(){
  $("#calcBtn")?.addEventListener("click", ()=>{
    const driverId = $("#rc_driver")?.value || "";
    if(!driverId){
      toast("Select a driver first.");
      return;
    }
    const docs = parseFloat($("#rc_docs").value);
    const fatigue = parseFloat($("#rc_fatigue").value);
    const check = Math.max(0, Math.min(100, parseFloat($("#rc_check").value || "0")));

    // score formula (simple + explainable)
    // base = checklist% * docs * fatigue
    const score = Math.round(check * docs * fatigue);

    let status = "GO";
    let note = "Good to roll.";
    if(score < 80){ status = "CAUTION"; note = "Review checklist/docs and confirm readiness."; }
    if(score < 60){ status = "HOLD"; note = "High risk of delay or compliance issue. Fix before departure."; }

    const driverName = drivers.find(d=>d.id===driverId)?.name || "Unknown";
    const out = $("#calcResult");
    out.innerHTML = `
      <div><strong>Driver:</strong> ${escapeHtml(driverName)}</div>
      <div><strong>Readiness Score:</strong> ${score}/100</div>
      <div><strong>Status:</strong> ${status}</div>
      <div class="muted" style="margin-top:8px;">${note}</div>
    `;

    // Optional: add a log entry
    logs.unshift({
      id: uid(),
      driverId,
      driverName,
      date: new Date().toISOString().slice(0,10),
      type: "Note",
      notes: `Readiness calc: ${score}/100 (${status})`,
      createdAt: new Date().toISOString()
    });
    save(STORAGE_KEYS.logs, logs);
    renderLogs();
    toast("Calculated and saved to logs.");
  });
}

// Logs
function renderLogs(){
  const list = $("#logList");
  if(!list) return;

  if(logs.length === 0){
    list.innerHTML = `<div class="item"><div><h4>No activity logged yet</h4><p>Add an entry above or save a checklist.</p></div></div>`;
    return;
  }

  list.innerHTML = logs.map(l => `
    <div class="item">
      <div>
        <h4>${escapeHtml(l.type)} — ${escapeHtml(l.driverName || "Unknown")}</h4>
        <div class="meta">${escapeHtml(l.date || "")}</div>
        <p>${escapeHtml(l.notes || "")}</p>
      </div>
      <div class="actions">
        <button class="smallbtn danger" data-logdel="${l.id}">Delete</button>
      </div>
    </div>
  `).join("");

  $$("[data-logdel]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-logdel");
      if(!confirm("Delete this log entry?")) return;
      logs = logs.filter(x=>x.id !== id);
      save(STORAGE_KEYS.logs, logs);
      renderLogs();
      toast("Log deleted.");
    });
  });
}

function bindLogForm(){
  const form = $("#logForm");
  const clearBtn = $("#logClear");
  if(!form) return;

  // default date today
  const d = $("#l_date");
  if(d && !d.value) d.value = new Date().toISOString().slice(0,10);

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const driverId = $("#l_driver").value || "";
    if(!driverId){
      toast("Select a driver.");
      return;
    }
    const driverName = drivers.find(d=>d.id===driverId)?.name || "Unknown";
    const date = $("#l_date").value;
    const type = $("#l_type").value;
    const notes = $("#l_notes").value.trim();

    logs.unshift({ id: uid(), driverId, driverName, date, type, notes, createdAt: new Date().toISOString() });
    save(STORAGE_KEYS.logs, logs);
    form.reset();
    $("#l_date").value = new Date().toISOString().slice(0,10);
    renderLogs();
    toast("Log entry added.");
  });

  clearBtn?.addEventListener("click", ()=>{
    form.reset();
    $("#l_date").value = new Date().toISOString().slice(0,10);
    toast("Cleared.");
  });

  $("#clearLogs")?.addEventListener("click", ()=>{
    if(!confirm("Clear all logs?")) return;
    logs = [];
    save(STORAGE_KEYS.logs, logs);
    renderLogs();
    toast("Logs cleared.");
  });

  $("#downloadLogsCsv")?.addEventListener("click", ()=>{
    const csv = logsToCSV(logs);
    downloadFile(`ready-central-logs-${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv");
    toast("CSV download started.");
  });
}

function logsToCSV(arr){
  const header = ["date","type","driver","notes"].join(",");
  const rows = arr.map(l => [
    safeCSV(l.date),
    safeCSV(l.type),
    safeCSV(l.driverName),
    safeCSV((l.notes || "").replaceAll("\n","  "))
  ].join(","));
  return [header, ...rows].join("\n");
}

function safeCSV(v){
  const s = String(v ?? "");
  const escaped = s.replaceAll('"','""');
  return `"${escaped}"`;
}

function downloadFile(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export/Import
function bindExportImport(){
  $("#exportJson")?.addEventListener("click", ()=>{
    const data = { version: 1, exportedAt: new Date().toISOString(), drivers, logs };
    const json = JSON.stringify(data, null, 2);
    $("#jsonBox").value = json;
    downloadFile(`ready-central-export-${new Date().toISOString().slice(0,10)}.json`, json, "application/json");
    toast("Exported JSON.");
  });

  $("#copyJson")?.addEventListener("click", async ()=>{
    const box = $("#jsonBox");
    const text = box.value.trim();
    if(!text){
      toast("Nothing to copy. Click Export JSON first.");
      return;
    }
    try{
      await navigator.clipboard.writeText(text);
      toast("Copied JSON to clipboard.");
    }catch{
      box.focus();
      box.select();
      document.execCommand("copy");
      toast("Copied (fallback).");
    }
  });

  $("#importJson")?.addEventListener("click", ()=>{
    const text = $("#importBox").value.trim();
    if(!text){
      toast("Paste JSON first.");
      return;
    }
    try{
      const data = JSON.parse(text);
      if(!data || !Array.isArray(data.drivers) || !Array.isArray(data.logs)){
        toast("Invalid JSON format.");
        return;
      }
      drivers = data.drivers;
      logs = data.logs;
      save(STORAGE_KEYS.drivers, drivers);
      save(STORAGE_KEYS.logs, logs);
      $("#importBox").value = "";
      renderAll();
      toast("Import complete.");
    }catch{
      toast("Import failed (bad JSON).");
    }
  });

  $("#clearAll")?.addEventListener("click", ()=>{
    if(!confirm("Clear ALL local data (drivers + logs)?")) return;
    drivers = [];
    logs = [];
    localStorage.removeItem(STORAGE_KEYS.drivers);
    localStorage.removeItem(STORAGE_KEYS.logs);
    $("#jsonBox").value = "";
    $("#importBox").value = "";
    renderAll();
    toast("All local data cleared.");
  });
}

function renderAll(){
  renderDrivers();
  renderLogs();
}

// Init
(function init(){
  bindTabs();
  bindDriverForm();
  bindChecklist();
  bindCalc();
  bindLogForm();
  bindExportImport();
  renderAll();

  const year = $("#year");
  if(year) year.textContent = new Date().getFullYear();
})();

// --- Collapse hero on scroll + on tab click (sticky compact header) ---
const hero = document.querySelector(".hero");

function setCollapsed(collapsed) {
  if (!hero) return;
  hero.classList.toggle("is-collapsed", collapsed);
}

// Collapse after a small scroll threshold
function onScroll() {
  setCollapsed(window.scrollY > 40);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Also collapse immediately when user clicks a tab (feels app-like)
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setCollapsed(true));
});

// Optional: collapse when user clicks any "data-nav" button too
document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => setCollapsed(true));
});
