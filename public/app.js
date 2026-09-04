const state = {
  skins: {},
  detailLibrary: {},
  matics: [],
  mode: "manual",
  selectedSkin: "imperium",
  filters: {
    faction: "all",
    role: "all",
    search: ""
  }
};

const els = {
  body: document.body,
  tabs: Array.from(document.querySelectorAll(".tab")),
  skins: Array.from(document.querySelectorAll(".skin")),
  form: document.getElementById("generator-form"),
  faction: document.getElementById("faction-select"),
  existing: document.getElementById("existing-select"),
  name: document.getElementById("name-input"),
  notes: document.getElementById("notes-input"),
  role: document.getElementById("role-select"),
  chassis: document.getElementById("chassis-select"),
  halo: document.getElementById("halo-select"),
  wings: document.getElementById("wings-select"),
  prop: document.getElementById("prop-select"),
  temperament: document.getElementById("temperament-select"),
  preview: document.getElementById("generator-preview"),
  status: document.getElementById("generator-status"),
  gallery: document.getElementById("gallery"),
  template: document.getElementById("gallery-card-template"),
  filterFaction: document.getElementById("filter-faction"),
  filterRole: document.getElementById("filter-role"),
  filterSearch: document.getElementById("filter-search"),
  rpsButtons: Array.from(document.querySelectorAll("[data-rps]")),
  playerChoice: document.getElementById("player-choice"),
  spiritChoice: document.getElementById("spirit-choice"),
  spiritName: document.getElementById("spirit-name"),
  rpsResult: document.getElementById("rps-result")
};

init();

async function init() {
  await loadData();
  bindEvents();
  renderAll();
}

async function loadData() {
  const response = await fetch("/api/matics");
  const payload = await response.json();
  state.skins = payload.skins;
  state.detailLibrary = payload.detailLibrary;
  state.matics = payload.matics;
}

function bindEvents() {
  els.tabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      syncModeUI();
    });
  });

  els.skins.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSkin = button.dataset.skinTarget;
      els.body.dataset.skin = state.selectedSkin;
      els.faction.value = state.selectedSkin;
      populateHierarchies();
      renderPreview();
      syncSkinUI();
    });
  });

  els.faction.addEventListener("change", () => {
    state.selectedSkin = els.faction.value;
    els.body.dataset.skin = state.selectedSkin;
    populateHierarchies();
    renderPreview();
    syncSkinUI();
  });

  [els.role, els.chassis, els.halo, els.wings, els.prop, els.temperament, els.name, els.notes].forEach((input) => {
    input.addEventListener("input", renderPreview);
    input.addEventListener("change", renderPreview);
  });

  els.existing.addEventListener("change", () => {
    if (state.mode === "adjust") {
      loadExistingIntoForm(els.existing.value);
    }
  });

  els.form.addEventListener("submit", handleGenerate);

  els.filterFaction.addEventListener("change", () => {
    state.filters.faction = els.filterFaction.value;
    renderGallery();
  });

  els.filterRole.addEventListener("change", () => {
    state.filters.role = els.filterRole.value;
    renderGallery();
  });

  els.filterSearch.addEventListener("input", () => {
    state.filters.search = els.filterSearch.value.toLowerCase();
    renderGallery();
  });

  els.rpsButtons.forEach((button) => {
    button.addEventListener("click", () => playRps(button.dataset.rps));
  });
}

function renderAll() {
  populateFactionSelect();
  populateExistingSelect();
  populateHierarchies();
  populateFilters();
  syncModeUI();
  syncSkinUI();
  renderPreview();
  renderGallery();
}

function populateFactionSelect() {
  els.faction.innerHTML = Object.entries(state.skins)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");
  els.faction.value = state.selectedSkin;
}

function populateExistingSelect() {
  const options = ['<option value="">Pick a vault unit</option>']
    .concat(state.matics.map((record) => `<option value="${record.serial}">${record.serial} // ${record.name}</option>`));
  els.existing.innerHTML = options.join("");
}

function populateHierarchies() {
  const details = state.detailLibrary[state.selectedSkin];
  fillSelect(els.role, details.roles);
  fillSelect(els.chassis, details.chassis);
  fillSelect(els.halo, details.halo);
  fillSelect(els.wings, details.wings);
  fillSelect(els.prop, details.prop);
  fillSelect(els.temperament, details.temperament);
}

function fillSelect(select, values) {
  const current = select.value;
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  select.value = values.includes(current) ? current : values[0];
}

function populateFilters() {
  els.filterFaction.innerHTML = ['<option value="all">All</option>']
    .concat(Object.entries(state.skins).map(([key, value]) => `<option value="${key}">${value.label}</option>`))
    .join("");

  const roles = Array.from(new Set(state.matics.map((record) => record.role))).sort();
  els.filterRole.innerHTML = ['<option value="all">All</option>']
    .concat(roles.map((role) => `<option value="${role}">${role}</option>`))
    .join("");
}

function syncModeUI() {
  els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
  const disableHierarchy = state.mode === "random";
  [els.role, els.chassis, els.halo, els.wings, els.prop, els.temperament].forEach((select) => {
    select.disabled = disableHierarchy;
  });
  els.existing.disabled = state.mode !== "adjust";
  els.status.textContent =
    state.mode === "random"
      ? "Random mode pulls one legal combination from the current faction skin."
      : state.mode === "adjust"
        ? "Pick a vault unit, change any trait, and the server will issue a fresh serial only if the result is unique."
        : "Every unique configuration receives exactly one server serial.";
}

function syncSkinUI() {
  els.skins.forEach((button) => button.classList.toggle("is-active", button.dataset.skinTarget === state.selectedSkin));
}

function getCurrentSpec() {
  return {
    faction: els.faction.value,
    role: els.role.value,
    chassis: els.chassis.value,
    halo: els.halo.value,
    wings: els.wings.value,
    prop: els.prop.value,
    temperament: els.temperament.value
  };
}

function renderPreview() {
  const spec = getCurrentSpec();
  els.preview.innerHTML = `
    <span class="label">Preview</span>
    <strong>${els.name.value.trim() || autoName(spec)}</strong>
    <ul>
      <li>${spec.faction} skin // ${spec.role}</li>
      <li>${spec.chassis} chassis with ${spec.halo}</li>
      <li>${spec.wings}, ${spec.prop}, ${spec.temperament} temperament</li>
    </ul>
  `;
}

function autoName(spec) {
  return `${spec.chassis.replace(/\s+/g, "-")} ${spec.role}`;
}

async function handleGenerate(event) {
  event.preventDefault();

  const payload = state.mode === "random"
    ? {
        mode: "random",
        faction: els.faction.value,
        name: els.name.value,
        notes: els.notes.value
      }
    : {
        mode: "manual",
        spec: getCurrentSpec(),
        name: els.name.value,
        notes: els.notes.value
      };

  const response = await fetch("/api/matics/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    if (response.status === 409 && result.existing) {
      els.status.textContent = `Already sanctified as ${result.existing.serial} // ${result.existing.name}.`;
      loadExistingIntoForm(result.existing.serial);
      return;
    }
    els.status.textContent = result.message || "Generation failed.";
    return;
  }

  els.status.textContent = `Sanctified ${result.record.serial} // ${result.record.name}.`;
  els.name.value = "";
  els.notes.value = "";
  await refreshVault();
  loadExistingIntoForm(result.record.serial);
}

async function refreshVault() {
  await loadData();
  populateExistingSelect();
  populateFilters();
  renderGallery();
}

function loadExistingIntoForm(serial) {
  const record = state.matics.find((item) => item.serial === serial);
  if (!record) return;
  state.mode = "adjust";
  syncModeUI();
  state.selectedSkin = record.faction;
  els.body.dataset.skin = state.selectedSkin;
  els.faction.value = record.faction;
  populateHierarchies();
  els.role.value = record.role;
  els.chassis.value = record.chassis;
  els.halo.value = record.halo;
  els.wings.value = record.wings;
  els.prop.value = record.prop;
  els.temperament.value = record.temperament;
  els.name.value = record.name;
  els.notes.value = record.notes || "";
  els.existing.value = record.serial;
  renderPreview();
  syncSkinUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function playRps(choice) {
  els.playerChoice.textContent = choice;
  const response = await fetch("/api/rps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice })
  });
  const result = await response.json();
  if (!response.ok) {
    els.rpsResult.textContent = result.message || "Duel interrupted.";
    return;
  }

  els.spiritChoice.textContent = result.spiritChoice;
  els.spiritName.textContent = `${result.opponent.serial} // ${result.opponent.name}`;
  els.rpsResult.textContent =
    result.result === "win"
      ? "You won the rite."
      : result.result === "lose"
        ? "The spirit outplayed you."
        : "A draw. The machine demands another round.";
}

function renderGallery() {
  const records = state.matics.filter(matchesFilter);
  if (!records.length) {
    els.gallery.innerHTML = `<div class="panel"><p class="result">No Matics match the current filter.</p></div>`;
    return;
  }

  els.gallery.innerHTML = "";
  records.forEach((record) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".sheet").innerHTML = turnaroundSvg(record);
    node.querySelector(".serial").textContent = record.serial;
    node.querySelector(".faction-tag").textContent = state.skins[record.faction].label;
    node.querySelector(".name").textContent = record.name;
    node.querySelector(".summary").textContent = record.notes || `${record.role} configured for ${record.temperament.toLowerCase()} service.`;
    node.querySelector(".spec-grid").innerHTML = specGrid(record);
    node.querySelector(".adjust-button").addEventListener("click", () => loadExistingIntoForm(record.serial));
    els.gallery.appendChild(node);
  });
}

function matchesFilter(record) {
  const search = state.filters.search;
  return (
    (state.filters.faction === "all" || record.faction === state.filters.faction) &&
    (state.filters.role === "all" || record.role === state.filters.role) &&
    (!search || record.name.toLowerCase().includes(search) || record.serial.toLowerCase().includes(search))
  );
}

function specGrid(record) {
  const items = [
    ["Role", record.role],
    ["Chassis", record.chassis],
    ["Halo", record.halo],
    ["Wings", record.wings],
    ["Prop", record.prop],
    ["Temperament", record.temperament]
  ];
  return items.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function turnaroundSvg(record) {
  const fill = state.skins[record.faction].accent;
  const line = "#101010";
  const wingType = wingGlyph(record.wings);
  return `
    <svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" aria-label="Turnaround for ${record.name}">
      <rect x="4" y="4" width="252" height="252" rx="16" fill="#f9f4e8" stroke="#111" stroke-width="2"/>
      <text x="20" y="26" font-family="Arial, sans-serif" font-size="10" fill="#111">${record.serial}</text>
      <g transform="translate(28,54)">
        ${panelGlyph(record, "FRONT", fill, line, wingType, false)}
      </g>
      <g transform="translate(108,54)">
        ${panelGlyph(record, "SIDE", fill, line, wingType, true)}
      </g>
      <g transform="translate(188,54)">
        ${panelGlyph(record, "BACK", fill, line, wingType, false, true)}
      </g>
      <text x="20" y="236" font-family="Arial, sans-serif" font-size="10" fill="#111">${record.role} // ${record.chassis}</text>
    </svg>
  `;
}

function panelGlyph(record, label, fill, line, wings, side, back) {
  const eye = side ? `<circle cx="16" cy="24" r="2" fill="${line}"/>` : `<circle cx="12" cy="24" r="2" fill="${line}"/><circle cx="20" cy="24" r="2" fill="${line}"/>`;
  const mouth = `<path d="M12 31 Q16 34 20 31" stroke="${line}" stroke-width="2" fill="none"/>`;
  const propX = side ? 34 : 40;
  return `
    <text x="0" y="-8" font-family="Arial, sans-serif" font-size="9" fill="#111">${label}</text>
    <ellipse cx="16" cy="18" rx="13" ry="12" fill="${fill}" stroke="${line}" stroke-width="2"/>
    <circle cx="16" cy="2" r="7" fill="none" stroke="${line}" stroke-width="2"/>
    ${eye}
    ${!back ? mouth : ""}
    <path d="M16 30 C7 32 5 42 8 55 L10 76 C11 84 21 84 22 76 L24 55 C27 42 25 32 16 30Z" fill="${fill}" stroke="${line}" stroke-width="2"/>
    ${wings}
    ${propGlyph(record.prop, propX)}
  `;
}

function wingGlyph(wings) {
  if (/ribbon/i.test(wings)) {
    return `<path d="M3 43 Q-12 50 0 62" stroke="#101010" stroke-width="2" fill="none"/><path d="M29 43 Q44 50 32 62" stroke="#101010" stroke-width="2" fill="none"/>`;
  }
  if (/censer|drone/i.test(wings)) {
    return `<circle cx="2" cy="56" r="5" fill="none" stroke="#101010" stroke-width="2"/><circle cx="30" cy="56" r="5" fill="none" stroke="#101010" stroke-width="2"/>`;
  }
  if (/fin|insect/i.test(wings)) {
    return `<path d="M2 44 Q-8 52 1 67 Q8 58 7 47Z" fill="none" stroke="#101010" stroke-width="2"/><path d="M30 44 Q40 52 31 67 Q24 58 25 47Z" fill="none" stroke="#101010" stroke-width="2"/>`;
  }
  return `<path d="M4 46 Q-8 54 3 63 Q8 57 8 49Z" fill="none" stroke="#101010" stroke-width="2"/><path d="M28 46 Q40 54 29 63 Q24 57 24 49Z" fill="none" stroke="#101010" stroke-width="2"/>`;
}

function propGlyph(prop, x) {
  if (/crate|seed/i.test(prop)) {
    return `<rect x="${x}" y="48" width="16" height="14" rx="2" fill="none" stroke="#101010" stroke-width="2"/>`;
  }
  if (/bell|gong|chime/i.test(prop)) {
    return `<path d="M${x} 46 Q${x} 34 ${x + 10} 34 Q${x + 20} 34 ${x + 20} 46 L${x} 46Z" fill="none" stroke="#101010" stroke-width="2"/>`;
  }
  if (/mallet|bonker|staff/i.test(prop)) {
    return `<rect x="${x}" y="38" width="12" height="8" rx="2" fill="none" stroke="#101010" stroke-width="2"/><path d="M${x + 6} 46 L${x + 6} 72" stroke="#101010" stroke-width="2"/>`;
  }
  if (/stapler|ledger|slates/i.test(prop)) {
    return `<rect x="${x}" y="40" width="18" height="10" rx="2" fill="none" stroke="#101010" stroke-width="2"/><path d="M${x} 52 L${x + 18} 52" stroke="#101010" stroke-width="2"/>`;
  }
  return `<circle cx="${x}" cy="48" r="9" fill="none" stroke="#101010" stroke-width="2"/>`;
}
