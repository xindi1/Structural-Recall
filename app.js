/* Structural Recall v1
   - Local-first storage (localStorage)
   - Chronological spine + free capture
   - Atomic entries with visibility flags
*/

const STORE_KEY = "sr_v1_store";
const PREFS_KEY = "sr_v1_prefs";

const $ = (id) => document.getElementById(id);

function nowISO() {
  return new Date().toISOString();
}

function safeParseJSON(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function loadStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    return { entries: [] };
  }
  const parsed = safeParseJSON(raw);
  if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
  return parsed;
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function loadPrefs() {
  const raw = localStorage.getItem(PREFS_KEY);
  const parsed = raw ? safeParseJSON(raw) : null;
  return parsed && typeof parsed.currentYear === "number"
    ? parsed
    : { currentYear: 1988 };
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function makeId() {
  // short deterministic-ish id: YYMMDD-HHMMSS-rand
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const id =
    pad(d.getFullYear() % 100) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    "-" +
    Math.random().toString(16).slice(2, 6);
  return id.toUpperCase();
}

function entriesForYear(store, year) {
  return store.entries
    .filter((e) => e.yearPrimary === year)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit" });
}

function visibilityBadge(vis) {
  if (vis === "Private") return "🔒 Private";
  if (vis === "Restricted") return "⚖️ Restricted";
  return "🌐 Publishable";
}

function renderConsole() {
  const store = loadStore();
  const prefs = loadPrefs();
  const year = prefs.currentYear;

  $("yearValue").textContent = String(year);

  const list = entriesForYear(store, year);
  $("yearMeta").textContent = `Entries: ${list.length}`;

  const last = list[0]?.createdAt ? formatDateShort(list[0].createdAt) : "—";
  $("yearMeta2").textContent = `Last added: ${last}`;

  // keep modal year in sync
  $("yearPrimary").value = String(year);
}

function openModal() {
  const modal = $("modal");
  // default year and reasonable defaults
  $("yearPrimary").value = String(loadPrefs().currentYear);
  $("title").value = "";
  $("yearRange").value = "";
  $("age").value = "";
  $("location").value = "";
  $("who").value = "";
  $("coreEvent").value = "";
  $("sensory").value = "";
  $("tone").value = "";
  $("tags").value = "";
  $("related").value = "";
  $("sourceType").value = "Personal Recall";
  $("confidence").value = "Moderate";
  $("visibility").value = "Private";

  modal.showModal();
}

function closeModal() {
  $("modal").close();
}

function addEntryFromForm({ createStubs }) {
  const store = loadStore();

  const yearPrimary = Number($("yearPrimary").value);
  if (!Number.isFinite(yearPrimary)) {
    alert("Year (primary) is required.");
    return;
  }

  const title = $("title").value.trim();
  if (!title) {
    alert("Working Title is required.");
    return;
  }

  const entry = {
    id: makeId(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    yearPrimary,
    yearRange: $("yearRange").value.trim(),
    age: $("age").value.trim(),
    location: $("location").value.trim(),
    who: $("who").value.trim(),
    sourceType: $("sourceType").value,
    confidence: $("confidence").value,
    visibility: $("visibility").value,
    title,
    coreEvent: $("coreEvent").value.trim(),
    sensory: $("sensory").value.trim(),
    tone: $("tone").value.trim(),
    tags: $("tags").value.split(",").map(s => s.trim()).filter(Boolean),
    relatedNotes: $("related").value.trim(),
    relatedIds: []
  };

  store.entries.push(entry);

  // Optional: create related “stub” entries based on year mentions in relatedNotes
  if (createStubs && entry.relatedNotes) {
    const years = extractYears(entry.relatedNotes);
    years.forEach((y) => {
      const stub = {
        id: makeId(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        yearPrimary: y,
        yearRange: "",
        age: "",
        location: "",
        who: "",
        sourceType: "Personal Recall",
        confidence: "Low",
        visibility: "Private",
        title: `STUB — related to ${entry.id}`,
        coreEvent: `Memory stub created from related notes of ${entry.id}. Details TBD.`,
        sensory: "",
        tone: "",
        tags: ["Stub"],
        relatedNotes: `Origin: ${entry.id}`,
        relatedIds: [entry.id]
      };
      store.entries.push(stub);
      entry.relatedIds.push(stub.id);
    });
  }

  saveStore(store);

  // update current year to the entry's primary year (optional behavior)
  const prefs = loadPrefs();
  prefs.currentYear = yearPrimary;
  savePrefs(prefs);

  closeModal();
  hideAllPanels();
  renderConsole();
}

function extractYears(text) {
  // simple regex for years 1900–2099
  const matches = text.match(/\b(19\d{2}|20\d{2})\b/g) || [];
  const uniq = Array.from(new Set(matches.map(Number))).filter((n) => n >= 1900 && n <= 2100);
  return uniq;
}

function hideAllPanels() {
  $("yearEntries").classList.add("hidden");
  $("timeline").classList.add("hidden");
}

function showYearEntries() {
  hideAllPanels();
  const store = loadStore();
  const year = loadPrefs().currentYear;
  $("entriesYearLabel").textContent = String(year);

  const list = entriesForYear(store, year);
  const wrap = $("entriesList");
  wrap.innerHTML = "";

  if (list.length === 0) {
    wrap.innerHTML = `<div class="entry"><div class="entry__meta">No entries yet for ${year}. Add one.</div></div>`;
    $("yearEntries").classList.remove("hidden");
    return;
  }

  list.forEach((e) => {
    const el = document.createElement("div");
    el.className = "entry";
    el.innerHTML = `
      <div class="entry__top">
        <div>
          <div class="entry__title">${escapeHtml(e.title)}</div>
          <div class="entry__meta">
            ${escapeHtml(e.sourceType)} • ${escapeHtml(e.confidence)} • ${visibilityBadge(e.visibility)}
            ${e.yearRange ? ` • Range: ${escapeHtml(e.yearRange)}` : ""}
            ${e.location ? ` • ${escapeHtml(e.location)}` : ""}
          </div>
        </div>
        <div class="badges">
          <span class="badge">ID: ${escapeHtml(e.id)}</span>
          <span class="badge">${formatDateShort(e.createdAt)}</span>
        </div>
      </div>

      <div class="entry__body">
        ${e.who ? `<div><strong>Who:</strong> ${escapeHtml(e.who)}</div>` : ""}
        ${e.coreEvent ? `<div style="margin-top:8px"><strong>Core:</strong><br>${escapeHtml(e.coreEvent).replace(/\n/g,"<br>")}</div>` : ""}
        ${e.sensory ? `<div style="margin-top:8px"><strong>Sensory:</strong><br>${escapeHtml(e.sensory).replace(/\n/g,"<br>")}</div>` : ""}
        ${e.tone ? `<div style="margin-top:8px"><strong>Tone:</strong> ${escapeHtml(e.tone)}</div>` : ""}
        ${(e.tags && e.tags.length) ? `<div style="margin-top:8px"><strong>Tags:</strong> ${e.tags.map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join(" ")}</div>` : ""}
        ${e.relatedNotes ? `<div style="margin-top:8px"><strong>Related Notes:</strong> ${escapeHtml(e.relatedNotes)}</div>` : ""}
        ${(e.relatedIds && e.relatedIds.length) ? `<div style="margin-top:8px"><strong>Related IDs:</strong> ${e.relatedIds.map(id=>`<span class="badge">${escapeHtml(id)}</span>`).join(" ")}</div>` : ""}
        <div class="entry__btnrow">
          <button class="btn btn--ghost" data-copy="${escapeHtml(e.id)}" type="button">Copy ID</button>
          <button class="btn btn--ghost" data-jump="${escapeHtml(String(e.yearPrimary))}" type="button">Jump to Year</button>
        </div>
      </div>
    `;

    el.addEventListener("click", (evt) => {
      // prevent click on inner buttons from toggling twice
      const target = evt.target;
      if (target && target.matches("button")) return;
      el.classList.toggle("open");
    });

    // Button actions
    el.querySelectorAll("button[data-copy]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
        btn.textContent = "Copied";
        setTimeout(()=> btn.textContent = "Copy ID", 900);
      });
    });

    el.querySelectorAll("button[data-jump]").forEach(btn => {
      btn.addEventListener("click", () => {
        const y = Number(btn.getAttribute("data-jump"));
        const prefs = loadPrefs();
        prefs.currentYear = y;
        savePrefs(prefs);
        renderConsole();
        showYearEntries();
      });
    });

    wrap.appendChild(el);
  });

  $("yearEntries").classList.remove("hidden");
}

function showTimeline() {
  hideAllPanels();
  $("timeline").classList.remove("hidden");
  renderGrid();
}

function renderGrid() {
  const store = loadStore();
  const from = Number($("fromYear").value);
  const to = Number($("toYear").value);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    alert("Invalid year range for grid.");
    return;
  }

  const counts = new Map();
  store.entries.forEach((e) => {
    counts.set(e.yearPrimary, (counts.get(e.yearPrimary) || 0) + 1);
  });

  const grid = $("yearGrid");
  grid.innerHTML = "";

  for (let y = from; y <= to; y++) {
    const c = counts.get(y) || 0;
    const cell = document.createElement("div");
    cell.className = "yearCell";
    cell.innerHTML = `
      <div class="yearCell__yr">${y}</div>
      <div class="yearCell__count">${c} entr${c === 1 ? "y" : "ies"}</div>
    `;
    cell.addEventListener("click", () => {
      const prefs = loadPrefs();
      prefs.currentYear = y;
      savePrefs(prefs);
      renderConsole();
      hideAllPanels();
      showYearEntries();
    });
    grid.appendChild(cell);
  }
}

function exportJSON() {
  const store = loadStore();
  const prefs = loadPrefs();
  const payload = {
    version: "sr_v1",
    exportedAt: nowISO(),
    prefs,
    store
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `structural-recall-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = safeParseJSON(String(reader.result));
    if (!parsed || !parsed.store || !parsed.store.entries) {
      alert("Invalid import file.");
      return;
    }

    // Basic compatibility
    const entries = parsed.store.entries;
    if (!Array.isArray(entries)) {
      alert("Invalid entries format.");
      return;
    }

    saveStore({ entries });
    if (parsed.prefs && typeof parsed.prefs.currentYear === "number") {
      savePrefs({ currentYear: parsed.prefs.currentYear });
    }

    hideAllPanels();
    renderConsole();
    alert("Import complete.");
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// PWA install
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

// Wiring
function init() {
  registerSW();
  renderConsole();

  $("btnPrevYear").addEventListener("click", () => {
    const prefs = loadPrefs();
    prefs.currentYear -= 1;
    savePrefs(prefs);
    renderConsole();
  });

  $("btnNextYear").addEventListener("click", () => {
    const prefs = loadPrefs();
    prefs.currentYear += 1;
    savePrefs(prefs);
    renderConsole();
  });

  $("btnAddMemory").addEventListener("click", openModal);
  $("btnViewYear").addEventListener("click", showYearEntries);
  $("btnCloseYear").addEventListener("click", hideAllPanels);

  $("btnTimeline").addEventListener("click", showTimeline);
  $("btnCloseTimeline").addEventListener("click", hideAllPanels);
  $("btnRenderGrid").addEventListener("click", renderGrid);

  $("btnExport").addEventListener("click", exportJSON);
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importJSON(file);
    e.target.value = "";
  });

  $("btnModalClose").addEventListener("click", closeModal);
  $("btnCancel").addEventListener("click", closeModal);

  $("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addEntryFromForm({ createStubs: false });
  });

  $("btnSaveStub").addEventListener("click", () => {
    addEntryFromForm({ createStubs: true });
  });
}

document.addEventListener("DOMContentLoaded", init);