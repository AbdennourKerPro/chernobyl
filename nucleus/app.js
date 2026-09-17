"use strict";

const STATUS_LABELS = {
  operating: "En service",
  construction: "En construction",
  pre_construction: "Pré-construction",
  announced: "Annoncé",
  mothballed: "À l’arrêt",
  shelved: "Suspendu",
  retired: "Retiré",
  cancelled: "Annulé",
};

const REACTOR_LABELS = {
  pwr: "Réacteur à eau pressurisée",
  bwr: "Réacteur à eau bouillante",
  phwr: "Réacteur à eau lourde",
  lwgr: "Réacteur graphite-eau",
  htgr: "Réacteur à haute température",
  fbr: "Réacteur à neutrons rapides",
  smr: "Petit réacteur modulaire",
  unknown: "Technologie non précisée",
};

const SCENARIOS = [
  {
    id: "loca",
    icon: "⌁",
    name: "Perte de refroidissement",
    subtitle: "Rupture primaire · barrières actives",
    severity: 2,
    reference: "Accident-type LOCA",
    sourceStrength: 0.16,
    releaseStart: 5,
    releaseDuration: 10,
    maxRange: 260,
    spread: 0.82,
    decayHours: 30,
    totalHours: 48,
    events: [
      { time: 0, label: "Perte de pression détectée" },
      { time: 0.25, label: "Arrêt automatique du réacteur" },
      { time: 1.2, label: "Injection de sécurité" },
      { time: 5, label: "Rejet filtré limité" },
      { time: 15, label: "Refroidissement stabilisé" },
      { time: 32, label: "Phase de surveillance" },
    ],
  },
  {
    id: "tmi",
    icon: "◉",
    name: "Fusion partielle contenue",
    subtitle: "Référence Three Mile Island",
    severity: 3,
    reference: "Fusion du cœur, confinement maintenu",
    sourceStrength: 0.28,
    releaseStart: 4,
    releaseDuration: 18,
    maxRange: 420,
    spread: 0.9,
    decayHours: 42,
    totalHours: 72,
    events: [
      { time: 0, label: "Défaillance du refroidissement" },
      { time: 0.8, label: "Niveau d’eau du cœur en baisse" },
      { time: 3, label: "Endommagement du combustible" },
      { time: 4, label: "Rejet contrôlé vers l’atmosphère" },
      { time: 12, label: "Fusion partielle du cœur" },
      { time: 30, label: "Confinement stabilisé" },
    ],
  },
  {
    id: "blackout",
    icon: "ϟ",
    name: "Black-out prolongé",
    subtitle: "Référence Fukushima Daiichi",
    severity: 4,
    reference: "Perte totale d’alimentation et éventage",
    sourceStrength: 0.58,
    releaseStart: 3,
    releaseDuration: 34,
    maxRange: 920,
    spread: 1.02,
    decayHours: 66,
    totalHours: 72,
    events: [
      { time: 0, label: "Perte des alimentations électriques" },
      { time: 1, label: "Refroidissement résiduel interrompu" },
      { time: 3, label: "Éventage du confinement" },
      { time: 7, label: "Endommagement sévère du cœur" },
      { time: 12, label: "Explosion d’hydrogène" },
      { time: 28, label: "Rejets atmosphériques intermittents" },
      { time: 54, label: "Refroidissement de fortune" },
    ],
  },
  {
    id: "graphite",
    icon: "☢",
    name: "Rupture du confinement",
    subtitle: "Enveloppe Tchernobyl · INES 7",
    severity: 5,
    reference: "Excursion de puissance et incendie graphite",
    sourceStrength: 1,
    releaseStart: 0.15,
    releaseDuration: 58,
    maxRange: 1650,
    spread: 1.16,
    decayHours: 96,
    totalHours: 96,
    events: [
      { time: 0, label: "Excursion rapide de puissance" },
      { time: 0.1, label: "Destruction du cœur" },
      { time: 0.2, label: "Incendie et rejet direct" },
      { time: 8, label: "Panache transporté à grande distance" },
      { time: 24, label: "Dépôts hétérogènes sous la pluie" },
      { time: 60, label: "Réduction progressive de l’incendie" },
    ],
  },
];

const STATUS_FILTERS = {
  current: new Set(["operating", "construction"]),
  future: new Set(["construction", "pre_construction", "announced"]),
  historical: new Set(["retired", "mothballed", "shelved", "cancelled"]),
  all: null,
};

const state = {
  plants: [],
  meta: null,
  countriesGeo: null,
  countryRecords: [],
  markerById: new Map(),
  selectedPlant: null,
  selectedScenario: SCENARIOS[2],
  impactedCountries: new Set(),
  particles: [],
  contourLayers: [],
  launched: false,
  running: false,
  simHours: 0,
  lastFrame: null,
  lastUiPaint: 0,
  lastCountryCalculation: -100,
  cameraCheckpoints: new Set(),
};

const els = Object.fromEntries(
  [
    "headerPlantCount", "headerUnitCount", "headerCountryCount", "plantSearch", "searchResults",
    "countryFilter", "statusFilter", "plantCard", "plantStatus", "plantCountry", "plantName",
    "plantReactorCount", "plantUnits", "plantOperating", "plantCapacity", "unitList", "focusPlant",
    "scenarioList", "compatibilityNote", "windDirection", "windDirectionValue", "compassNeedle",
    "windSpeed", "windSpeedValue", "rainLevel", "rainLevelValue", "dispersionLevel", "dispersionValue",
    "launchSimulation", "zoomIn", "zoomOut", "resetView", "scenarioHud", "hudClock", "hudEvent",
    "impactPanel", "impactPlantName", "closeSimulation", "metricIndex", "metricLabel", "metricReach",
    "metricArea", "metricCountries", "timelineConsole", "playToggle", "playIcon", "timelineScenario",
    "timelineTime", "timeline", "timelineEvents", "playbackSpeed", "cinematicMode", "loadingScreen",
    "openMethod", "methodDialog", "datasetNote", "plumeCanvas",
  ].map((id) => [id, document.getElementById(id)])
);

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const map = L.map("map", {
  center: [27, 12],
  zoom: 2,
  minZoom: 2,
  maxZoom: 9,
  zoomControl: false,
  worldCopyJump: true,
  preferCanvas: true,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  subdomains: "abc",
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const countryLayer = L.geoJSON(null, {
  interactive: false,
  style: countryStyle,
}).addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const canvas = els.plumeCanvas;
const ctx = canvas.getContext("2d", { alpha: true });

function countryStyle(feature) {
  const code = feature && feature.id;
  const isSelected = state.selectedPlant && code === state.selectedPlant.country;
  const isImpacted = state.impactedCountries.has(code);
  if (isImpacted) {
    return {
      color: code === state.selectedPlant?.country ? "#f4d65c" : "#ff9d42",
      weight: code === state.selectedPlant?.country ? 1.35 : 0.9,
      opacity: 0.85,
      fillColor: "#ff5b4f",
      fillOpacity: 0.065,
    };
  }
  if (isSelected) {
    return { color: "#74e1cb", weight: 1.2, opacity: 0.85, fillColor: "#74e1cb", fillOpacity: 0.035 };
  }
  return { color: "#5f8179", weight: 0.45, opacity: 0.38, fillColor: "#0e201d", fillOpacity: 0.035 };
}

async function boot() {
  try {
    const [plantPayload, countriesGeo] = await Promise.all([
      fetchCompressedJson("./data/plants.json.gz", "./data/plants.json"),
      fetchCompressedJson("./data/countries.geojson.gz", "./data/countries.geojson"),
    ]);

    state.plants = plantPayload.plants;
    state.meta = plantPayload.meta;
    state.countriesGeo = countriesGeo;
    state.countryRecords = countriesGeo.features.map((feature) => ({
      feature,
      bbox: geometryBbox(feature.geometry),
    }));

    countryLayer.addData(countriesGeo);
    hydrateHeader();
    populateCountryFilter();
    renderScenarios();
    createMarkers();
    bindControls();

    const defaultPlant =
      state.plants.find((plant) => plant.name.toLowerCase().includes("gravelines")) ||
      state.plants.find((plant) => plant.country === "FRA" && plant.operatingCount > 0) ||
      state.plants.find((plant) => plant.operatingCount > 0) ||
      state.plants[0];
    selectPlant(defaultPlant, { focus: false });
    updateMarkerVisibility();
    updateWeatherReadouts();
    setTimeout(() => els.loadingScreen.classList.add("done"), 260);
    requestAnimationFrame(animationLoop);
  } catch (error) {
    console.error(error);
    els.loadingScreen.querySelector("p").textContent = "Chargement impossible";
    els.loadingScreen.querySelector("span").textContent = "Vérifiez que le site est servi par un serveur web.";
  }
}

async function fetchCompressedJson(compressedUrl, fallbackUrl) {
  if ("DecompressionStream" in window) {
    try {
      const response = await fetch(compressedUrl);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).json();
    } catch (error) {
      console.warn(`Fallback vers ${fallbackUrl}`, error);
    }
  }
  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error("Impossible de charger les données locales.");
  return response.json();
}

function hydrateHeader() {
  els.headerPlantCount.textContent = numberFormat.format(state.meta.plantCount);
  els.headerUnitCount.textContent = numberFormat.format(state.meta.unitCount);
  els.headerCountryCount.textContent = numberFormat.format(state.meta.countryCount);
  els.datasetNote.textContent = `Jeu de données : ${state.meta.release} · ${numberFormat.format(state.meta.unitCount)} unités · ${state.meta.license}.`;
}

function populateCountryFilter() {
  const countries = [...new Map(state.plants.map((plant) => [plant.country, plant.countryName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "fr"));
  for (const [code, name] of countries) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    els.countryFilter.append(option);
  }
}

function renderScenarios() {
  els.scenarioList.replaceChildren();
  for (const scenario of SCENARIOS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-card";
    button.dataset.scenarioId = scenario.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(scenario.id === state.selectedScenario.id));
    button.innerHTML = `
      <span class="scenario-icon" aria-hidden="true">${scenario.icon}</span>
      <span class="scenario-copy"><strong>${scenario.name}</strong><small>${scenario.subtitle}</small></span>
      <span class="severity-bars" data-level="${scenario.severity}" aria-label="Gravité ${scenario.severity} sur 5">
        <i></i><i></i><i></i><i></i><i></i>
      </span>`;
    button.addEventListener("click", () => selectScenario(scenario));
    els.scenarioList.append(button);
  }
  updateCompatibilityNote();
}

function selectScenario(scenario) {
  state.selectedScenario = scenario;
  for (const card of els.scenarioList.querySelectorAll(".scenario-card")) {
    card.setAttribute("aria-checked", String(card.dataset.scenarioId === scenario.id));
  }
  updateCompatibilityNote();
  if (state.launched) launchSimulation();
}

function updateCompatibilityNote() {
  if (!state.selectedPlant) return;
  const types = state.selectedPlant.reactorTypes.join(" ").toLowerCase();
  let warning = "";
  if (state.selectedScenario.id === "graphite" && !/(graphite|rbmk|lwgr)/.test(types)) {
    warning = "Cette enveloppe RBMK/Tchernobyl n’est pas physiquement représentative de ce réacteur. Elle sert ici de cas extrême comparatif.";
  } else if (state.selectedScenario.id === "tmi" && !/pressurized water/.test(types)) {
    warning = "Three Mile Island concernait un réacteur à eau pressurisée. La séquence est transposée ici à titre comparatif.";
  } else if (state.selectedScenario.id === "blackout" && !/boiling water/.test(types)) {
    warning = "La référence historique est un réacteur à eau bouillante, mais une perte totale d’alimentation peut concerner d’autres filières.";
  }
  els.compatibilityNote.classList.toggle("warning", Boolean(warning));
  els.compatibilityNote.querySelector("span").textContent = warning ? "!" : "✓";
  els.compatibilityNote.querySelector("p").textContent = warning || "Scénario cohérent avec la famille de réacteur sélectionnée.";
}

function createMarkers() {
  for (const plant of state.plants) {
    const marker = L.circleMarker([plant.lat, plant.lon], markerStyle(plant, false));
    marker.bindTooltip(
      `<b>${escapeHtml(plant.name)}</b><span>${escapeHtml(plant.countryName)} · ${plant.reactorCount} unité${plant.reactorCount > 1 ? "s" : ""} suivie${plant.reactorCount > 1 ? "s" : ""}</span>`,
      { className: "plant-tooltip", direction: "top", offset: [0, -5] }
    );
    marker.on("click", () => selectPlant(plant, { focus: true }));
    state.markerById.set(plant.id, marker);
  }
}

function markerStyle(plant, selected) {
  const primary = primaryStatus(plant);
  const color = primary === "operating" ? "#74e1cb" : primary === "construction" ? "#f4d65c" : "#788682";
  return {
    radius: selected ? 8.5 : Math.min(7, 2.8 + Math.sqrt(plant.reactorCount) * 1.25),
    color: selected ? "#ffffff" : color,
    weight: selected ? 2.1 : 1,
    opacity: selected ? 1 : 0.86,
    fillColor: color,
    fillOpacity: selected ? 0.95 : primary === "operating" ? 0.72 : 0.58,
  };
}

function primaryStatus(plant) {
  if (plant.operatingCount) return "operating";
  if (plant.constructionCount) return "construction";
  for (const status of ["pre_construction", "announced", "mothballed", "shelved", "retired", "cancelled"]) {
    if (plant.statusCounts[status]) return status;
  }
  return Object.keys(plant.statusCounts)[0] || "unknown";
}

function updateMarkerVisibility() {
  const country = els.countryFilter.value;
  const acceptedStatuses = STATUS_FILTERS[els.statusFilter.value];
  markerLayer.clearLayers();
  for (const plant of state.plants) {
    const countryOk = country === "all" || plant.country === country;
    const statusOk = !acceptedStatuses || Object.keys(plant.statusCounts).some((status) => acceptedStatuses.has(status));
    if (countryOk && statusOk) markerLayer.addLayer(state.markerById.get(plant.id));
  }
  refreshMarkerStyles();
}

function refreshMarkerStyles() {
  for (const plant of state.plants) {
    const marker = state.markerById.get(plant.id);
    marker.setStyle(markerStyle(plant, plant.id === state.selectedPlant?.id));
    if (plant.id === state.selectedPlant?.id && markerLayer.hasLayer(marker)) marker.bringToFront();
  }
}

function selectPlant(plant, { focus = true } = {}) {
  state.selectedPlant = plant;
  state.impactedCountries = new Set();
  renderPlantCard();
  refreshMarkerStyles();
  countryLayer.setStyle(countryStyle);
  updateCompatibilityNote();
  closeSearchResults();
  els.plantSearch.value = "";
  if (focus) map.flyTo([plant.lat, plant.lon], Math.max(map.getZoom(), 5), { duration: 1.25 });
  if (state.launched) launchSimulation();
}

function renderPlantCard() {
  const plant = state.selectedPlant;
  const primary = primaryStatus(plant);
  els.plantStatus.textContent = (STATUS_LABELS[primary] || primary).toUpperCase();
  els.plantStatus.className = "status-pill";
  if (primary === "construction") els.plantStatus.classList.add("construction");
  if (["retired", "cancelled", "shelved", "mothballed"].includes(primary)) els.plantStatus.classList.add("historical");
  els.plantCountry.textContent = plant.countryName;
  els.plantName.textContent = plant.name;
  els.plantReactorCount.textContent = plant.reactorCount;
  els.plantUnits.textContent = numberFormat.format(plant.reactorCount);
  els.plantOperating.textContent = numberFormat.format(plant.operatingCount);
  els.plantCapacity.textContent = plant.operatingCapacityMw
    ? `${formatCapacity(plant.operatingCapacityMw)}`
    : "—";

  els.unitList.replaceChildren();
  for (const unit of plant.units) {
    const row = document.createElement("div");
    row.className = "unit-row";
    const title = document.createElement("strong");
    title.textContent = unit.name;
    const status = document.createElement("b");
    status.textContent = STATUS_LABELS[unit.status] || unit.status;
    const detail = document.createElement("small");
    const type = REACTOR_LABELS[unit.type] || titleCase(unit.type.replaceAll("_", " "));
    detail.textContent = `${type}${unit.capacity ? ` · ${numberFormat.format(unit.capacity)} MW` : ""}`;
    row.append(title, status, detail);
    els.unitList.append(row);
  }
}

function bindControls() {
  els.focusPlant.addEventListener("click", () => {
    if (state.selectedPlant) map.flyTo([state.selectedPlant.lat, state.selectedPlant.lon], 6, { duration: 1.1 });
  });
  els.countryFilter.addEventListener("change", updateMarkerVisibility);
  els.statusFilter.addEventListener("change", updateMarkerVisibility);
  els.plantSearch.addEventListener("input", renderSearchResults);
  els.plantSearch.addEventListener("keydown", handleSearchKeys);
  document.addEventListener("keydown", handleGlobalKeys);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".plant-section")) closeSearchResults();
  });

  for (const input of [els.windDirection, els.windSpeed, els.rainLevel, els.dispersionLevel]) {
    input.addEventListener("input", () => {
      updateWeatherReadouts();
      if (state.launched) {
        updateContours();
        state.lastCountryCalculation = -100;
      }
    });
  }

  els.launchSimulation.addEventListener("click", launchSimulation);
  els.playToggle.addEventListener("click", togglePlayback);
  els.timeline.addEventListener("input", () => {
    state.simHours = Number(els.timeline.value);
    state.lastFrame = performance.now();
    state.lastCountryCalculation = -100;
    state.cameraCheckpoints.clear();
    updateSimulationUi(true);
  });
  els.closeSimulation.addEventListener("click", closeSimulation);
  els.zoomIn.addEventListener("click", () => map.zoomIn());
  els.zoomOut.addEventListener("click", () => map.zoomOut());
  els.resetView.addEventListener("click", () => map.flyTo([27, 12], 2, { duration: 1.2 }));
  els.openMethod.addEventListener("click", () => {
    if (typeof els.methodDialog.showModal === "function") els.methodDialog.showModal();
    else els.methodDialog.setAttribute("open", "");
  });
  map.on("move zoom resize", () => {
    if (state.launched) drawPlume();
  });
  window.addEventListener("resize", resizeCanvas);
}

function renderSearchResults() {
  const query = normalize(els.plantSearch.value.trim());
  if (!query) {
    closeSearchResults();
    return;
  }
  const country = els.countryFilter.value;
  const matches = state.plants
    .filter((plant) => country === "all" || plant.country === country)
    .map((plant) => {
      const haystack = normalize(`${plant.name} ${plant.fullName} ${plant.countryName}`);
      const starts = normalize(plant.name).startsWith(query) ? 0 : 1;
      return { plant, match: haystack.includes(query), score: starts };
    })
    .filter((entry) => entry.match)
    .sort((a, b) => a.score - b.score || b.plant.operatingCount - a.plant.operatingCount || a.plant.name.localeCompare(b.plant.name, "fr"))
    .slice(0, 9);

  els.searchResults.replaceChildren();
  for (const { plant } of matches) {
    const result = document.createElement("button");
    result.type = "button";
    result.className = "search-result";
    result.setAttribute("role", "option");
    result.setAttribute("aria-selected", "false");
    const name = document.createElement("strong");
    name.textContent = plant.name;
    const countryName = document.createElement("small");
    countryName.textContent = `${plant.countryName} · ${STATUS_LABELS[primaryStatus(plant)] || primaryStatus(plant)}`;
    const count = document.createElement("b");
    count.textContent = `${plant.reactorCount} R`;
    result.append(name, countryName, count);
    result.addEventListener("click", () => selectPlant(plant, { focus: true }));
    els.searchResults.append(result);
  }
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-result";
    empty.textContent = "Aucun site trouvé";
    els.searchResults.append(empty);
  }
  els.searchResults.hidden = false;
}

function handleSearchKeys(event) {
  const options = [...els.searchResults.querySelectorAll("button.search-result")];
  if (!options.length || els.searchResults.hidden) return;
  const current = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = current < 0 ? 0 : (current + delta + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute("aria-selected", String(index === next)));
    options[next].scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter") {
    event.preventDefault();
    (options[current >= 0 ? current : 0] || options[0]).click();
  } else if (event.key === "Escape") {
    closeSearchResults();
  }
}

function handleGlobalKeys(event) {
  const tag = document.activeElement?.tagName;
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) {
    event.preventDefault();
    els.plantSearch.focus();
  }
  if (event.code === "Space" && state.launched && !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) {
    event.preventDefault();
    togglePlayback();
  }
}

function closeSearchResults() {
  els.searchResults.hidden = true;
}

function updateWeatherReadouts() {
  const direction = Number(els.windDirection.value);
  const speed = Number(els.windSpeed.value);
  const rain = Number(els.rainLevel.value);
  const dispersion = Number(els.dispersionLevel.value);
  els.windDirectionValue.textContent = `${String(direction).padStart(3, "0")}° · ${cardinal(direction)}`;
  els.compassNeedle.style.transform = `rotate(${direction}deg)`;
  els.windSpeedValue.textContent = `${speed} km/h`;
  els.rainLevelValue.textContent = `${rain} %`;
  els.dispersionValue.textContent = dispersion < 30 ? "Stable" : dispersion < 68 ? "Moyenne" : "Forte";
  for (const input of [els.windDirection, els.windSpeed, els.rainLevel, els.dispersionLevel]) setRangeProgress(input);
}

function setRangeProgress(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const progress = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function launchSimulation() {
  if (!state.selectedPlant) return;
  state.launched = true;
  state.running = true;
  state.simHours = 0;
  state.lastFrame = performance.now();
  state.lastCountryCalculation = -100;
  state.cameraCheckpoints.clear();
  state.impactedCountries = new Set();
  state.particles = createParticles(`${state.selectedPlant.id}:${state.selectedScenario.id}`, 760 + state.selectedScenario.severity * 100);
  createContours();
  renderTimelineEvents();

  els.scenarioHud.hidden = false;
  els.impactPanel.hidden = false;
  els.timelineConsole.hidden = false;
  els.impactPlantName.textContent = state.selectedPlant.name;
  els.timelineScenario.textContent = state.selectedScenario.name;
  els.timeline.max = String(state.selectedScenario.totalHours);
  els.timeline.value = "0";
  els.playIcon.textContent = "Ⅱ";
  els.launchSimulation.querySelector("small").textContent = "ACTIF";
  els.launchSimulation.querySelector("span:nth-child(2)").lastChild.textContent = " Relancer la simulation";
  map.flyTo([state.selectedPlant.lat, state.selectedPlant.lon], 7, { duration: 1.4 });
  updateSimulationUi(true);
}

function closeSimulation() {
  state.launched = false;
  state.running = false;
  state.simHours = 0;
  state.impactedCountries = new Set();
  for (const layer of state.contourLayers) map.removeLayer(layer);
  state.contourLayers = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  els.scenarioHud.hidden = true;
  els.impactPanel.hidden = true;
  els.timelineConsole.hidden = true;
  els.launchSimulation.querySelector("small").textContent = "PRÊT";
  els.launchSimulation.querySelector("span:nth-child(2)").lastChild.textContent = " Lancer la simulation";
  countryLayer.setStyle(countryStyle);
}

function togglePlayback() {
  if (!state.launched) return;
  if (state.simHours >= state.selectedScenario.totalHours) state.simHours = 0;
  state.running = !state.running;
  state.lastFrame = performance.now();
  els.playIcon.textContent = state.running ? "Ⅱ" : "▶";
}

function createContours() {
  for (const layer of state.contourLayers) map.removeLayer(layer);
  const styles = [
    { color: "#74e1cb", fillColor: "#74e1cb", fillOpacity: 0.035, weight: 1, dashArray: "5 7" },
    { color: "#f4d65c", fillColor: "#f4d65c", fillOpacity: 0.045, weight: 1 },
    { color: "#ff5b4f", fillColor: "#ff5b4f", fillOpacity: 0.07, weight: 1.1 },
  ];
  state.contourLayers = styles.map((style) => L.polygon([], { ...style, interactive: false }).addTo(map));
}

function createParticles(seedText, count) {
  const random = mulberry32(hashString(seedText));
  const particles = [];
  for (let index = 0; index < count; index += 1) {
    particles.push({
      releaseUnit: Math.pow(random(), 1.18),
      speed: 0.52 + random() * 0.72,
      cross: gaussian(random),
      wobble: gaussian(random),
      deposition: random(),
      fade: random(),
      size: 0.55 + random() * 1.25,
    });
  }
  return particles;
}

function animationLoop(timestamp) {
  if (state.launched) {
    if (state.running) {
      const deltaSeconds = Math.min(0.08, Math.max(0, (timestamp - (state.lastFrame || timestamp)) / 1000));
      const speed = Number(els.playbackSpeed.value);
      state.simHours = Math.min(state.selectedScenario.totalHours, state.simHours + deltaSeconds * speed);
      if (state.simHours >= state.selectedScenario.totalHours) {
        state.running = false;
        els.playIcon.textContent = "▶";
      }
    }
    state.lastFrame = timestamp;
    drawPlume();
    if (timestamp - state.lastUiPaint > 70) {
      updateSimulationUi(false);
      state.lastUiPaint = timestamp;
    }
  }
  requestAnimationFrame(animationLoop);
}

function drawPlume() {
  resizeCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  if (!state.launched || !state.selectedPlant) return;

  const scenario = state.selectedScenario;
  const releaseActive = state.simHours >= scenario.releaseStart;
  drawAccidentPulse();
  if (!releaseActive) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rain = Number(els.rainLevel.value) / 100;
  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    const position = particlePosition(particle);
    if (!position) continue;
    const point = map.latLngToContainerPoint([position.lat, position.lon]);
    if (point.x < -30 || point.y < -30 || point.x > width + 30 || point.y > height + 30) continue;
    const intensity = clamp(position.intensity, 0, 1);
    const radius = (2.5 + intensity * 8.5 + rain * (position.deposited ? 5 : 0)) * particle.size;
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    const color = intensity > 0.58 ? "255,91,79" : intensity > 0.3 ? "244,214,92" : "116,225,203";
    gradient.addColorStop(0, `rgba(${color},${0.12 + intensity * 0.22})`);
    gradient.addColorStop(0.38, `rgba(${color},${0.055 + intensity * 0.08})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAccidentPulse() {
  if (state.simHours > 1.8) return;
  const center = map.latLngToContainerPoint([state.selectedPlant.lat, state.selectedPlant.lon]);
  const pulseProgress = clamp(state.simHours / 1.8, 0, 1);
  const radiusKm = 4 + pulseProgress * (18 + state.selectedScenario.severity * 5);
  const radiusPx = kmToPixels(radiusKm, state.selectedPlant.lat, state.selectedPlant.lon);
  ctx.save();
  ctx.strokeStyle = `rgba(255, ${170 - state.selectedScenario.severity * 12}, 70, ${0.78 * (1 - pulseProgress)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(4, radiusPx));
  glow.addColorStop(0, `rgba(255,91,79,${0.2 * (1 - pulseProgress)})`);
  glow.addColorStop(1, "rgba(255,91,79,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, Math.max(4, radiusPx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function particlePosition(particle) {
  const scenario = state.selectedScenario;
  const releaseAt = scenario.releaseStart + particle.releaseUnit * scenario.releaseDuration;
  const age = state.simHours - releaseAt;
  if (age < 0) return null;
  const wind = Number(els.windSpeed.value);
  const rain = Number(els.rainLevel.value) / 100;
  const instability = 0.55 + Number(els.dispersionLevel.value) / 67;
  const direction = Number(els.windDirection.value);
  const depositionTime = (5 + particle.deposition * 44) / (0.45 + rain * 2.1);
  const travelAge = rain > 0.04 ? Math.min(age, depositionTime) : age;
  const along = wind * travelAge * particle.speed;
  const plumeWidth = (2.5 + Math.sqrt(Math.max(1, along)) * 2.15 * state.selectedScenario.spread * instability);
  const cross = particle.cross * plumeWidth + Math.sin(age * 0.45 + particle.wobble) * plumeWidth * 0.08;
  const deposited = rain > 0.04 && age > depositionTime;
  const decay = Math.exp(-age / scenario.decayHours);
  const distanceDilution = 1 / (1 + along / (420 + scenario.sourceStrength * 300));
  const depositionBoost = deposited ? 0.85 + rain * 0.8 : 1;
  const intensity = scenario.sourceStrength * (0.45 + (1 - particle.fade) * 0.75) * decay * distanceDilution * depositionBoost;
  const location = offsetLatLng(state.selectedPlant.lat, state.selectedPlant.lon, along, cross, direction);
  return { ...location, intensity, deposited, along };
}

function updateSimulationUi(forceCountryCalculation) {
  const scenario = state.selectedScenario;
  const totalHours = scenario.totalHours;
  const currentEvent = [...scenario.events].reverse().find((event) => event.time <= state.simHours) || scenario.events[0];
  const metrics = plumeMetrics();
  const clock = formatClock(state.simHours);

  els.hudClock.textContent = `T+ ${clock}`;
  els.hudEvent.textContent = currentEvent.label;
  els.timeline.value = String(state.simHours);
  setRangeProgress(els.timeline);
  els.timelineTime.textContent = `${clock.replace(" h ", ":")} / ${totalHours} h`;

  const index = relativeIndex(metrics);
  els.metricIndex.textContent = String(Math.round(index));
  els.metricLabel.textContent = indexLabel(index, state.simHours < scenario.releaseStart);
  els.metricReach.textContent = `${numberFormat.format(metrics.reach)} km`;
  els.metricArea.textContent = metrics.area < 1 ? "0 km²" : `${compactNumber(metrics.area)} km²`;

  if (forceCountryCalculation || Math.abs(state.simHours - state.lastCountryCalculation) > 0.6) {
    state.impactedCountries = calculateImpactedCountries(metrics);
    state.lastCountryCalculation = state.simHours;
    countryLayer.setStyle(countryStyle);
    const names = [...state.impactedCountries]
      .map((code) => countryName(code))
      .filter(Boolean)
      .slice(0, 4);
    const extra = Math.max(0, state.impactedCountries.size - names.length);
    els.metricCountries.textContent = names.length ? `${names.join(" · ")}${extra ? ` +${extra}` : ""}` : "—";
  }

  updateContours(metrics);
  maybeMoveCamera(metrics);
}

function plumeMetrics() {
  const scenario = state.selectedScenario;
  const activeHours = Math.max(0, state.simHours - scenario.releaseStart);
  const wind = Number(els.windSpeed.value);
  const rain = Number(els.rainLevel.value) / 100;
  const instability = 0.55 + Number(els.dispersionLevel.value) / 67;
  if (activeHours <= 0) return { reach: 0, width: 0, area: 0, activeHours: 0, releaseFraction: 0 };
  const releaseFraction = clamp(activeHours / Math.max(2, scenario.releaseDuration * 0.72), 0, 1);
  const windLimit = scenario.maxRange * Math.pow(wind / 35, 0.66);
  const reach = Math.min(windLimit, wind * activeHours * (0.78 + scenario.sourceStrength * 0.14));
  const width = Math.max(5, Math.sqrt(Math.max(1, reach)) * 3.2 * scenario.spread * instability * (1 - rain * 0.12));
  const area = Math.PI * Math.max(1, reach * 0.52) * Math.max(1, width);
  return { reach, width, area, activeHours, releaseFraction };
}

function relativeIndex(metrics) {
  if (!metrics.releaseFraction) return 0;
  const rain = Number(els.rainLevel.value) / 100;
  const dilution = 0.78 + rain * 0.28;
  return clamp(state.selectedScenario.sourceStrength * 100 * metrics.releaseFraction * dilution, 0, 100);
}

function indexLabel(index, beforeRelease) {
  if (beforeRelease) return "Rejet atmosphérique non commencé";
  if (index < 15) return "Dispersion relative faible";
  if (index < 35) return "Dispersion relative modérée";
  if (index < 62) return "Dispersion relative importante";
  if (index < 84) return "Dispersion relative très importante";
  return "Enveloppe maximale du modèle";
}

function updateContours(metrics = plumeMetrics()) {
  if (!state.contourLayers.length) return;
  if (metrics.reach < 1) {
    state.contourLayers.forEach((layer) => layer.setLatLngs([]));
    return;
  }
  const factors = [1, 0.64, 0.34];
  state.contourLayers.forEach((layer, index) => {
    const factor = factors[index];
    layer.setLatLngs(plumeEllipse(metrics.reach * factor, metrics.width * (0.48 + factor * 0.52)));
  });
}

function plumeEllipse(reach, width) {
  const points = [];
  const center = reach * 0.47;
  const major = reach * 0.53;
  const direction = Number(els.windDirection.value);
  for (let index = 0; index <= 64; index += 1) {
    const angle = (index / 64) * Math.PI * 2;
    const along = center + major * Math.cos(angle);
    const cross = width * Math.sin(angle) * (0.62 + 0.38 * Math.max(0, along / Math.max(1, reach)));
    const point = offsetLatLng(state.selectedPlant.lat, state.selectedPlant.lon, along, cross, direction);
    points.push([point.lat, point.lon]);
  }
  return points;
}

function calculateImpactedCountries(metrics) {
  const impacted = new Set();
  if (metrics.reach < 1) return impacted;
  const direction = Number(els.windDirection.value);
  const alongSteps = 18;
  for (let index = 0; index <= alongSteps; index += 1) {
    const ratio = index / alongSteps;
    const along = metrics.reach * ratio;
    const localWidth = metrics.width * Math.sin(Math.PI * Math.min(0.98, ratio)) * (0.45 + ratio * 0.55);
    for (const crossFactor of [0, -0.85, 0.85]) {
      const point = offsetLatLng(state.selectedPlant.lat, state.selectedPlant.lon, along, localWidth * crossFactor, direction);
      const code = countryAt(point.lon, point.lat);
      if (code) impacted.add(code);
    }
  }
  if (!impacted.size && state.selectedPlant.country) impacted.add(state.selectedPlant.country);
  return impacted;
}

function countryAt(lon, lat) {
  for (const record of state.countryRecords) {
    const [minLon, minLat, maxLon, maxLat] = record.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (pointInGeometry([lon, lat], record.feature.geometry)) return record.feature.id;
  }
  return null;
}

function maybeMoveCamera(metrics) {
  if (!els.cinematicMode.checked || !state.running) return;
  const checkpoints = [0.15, 3, 9, 20, 42, 70].filter((value) => value <= state.selectedScenario.totalHours);
  const checkpoint = [...checkpoints].reverse().find((value) => state.simHours >= value);
  if (checkpoint === undefined || state.cameraCheckpoints.has(checkpoint)) return;
  state.cameraCheckpoints.add(checkpoint);
  if (checkpoint <= 0.15 || metrics.reach < 4) {
    map.flyTo([state.selectedPlant.lat, state.selectedPlant.lon], 7, { duration: 1.1 });
    return;
  }
  const points = plumeEllipse(metrics.reach, Math.max(8, metrics.width));
  points.push([state.selectedPlant.lat, state.selectedPlant.lon]);
  const sidePadding = window.innerWidth <= 820 ? 70 : 330;
  map.flyToBounds(L.latLngBounds(points), {
    paddingTopLeft: [70, 70],
    paddingBottomRight: [sidePadding, 120],
    maxZoom: 6,
    duration: 1.3,
  });
}

function renderTimelineEvents() {
  els.timelineEvents.replaceChildren();
  for (const event of state.selectedScenario.events) {
    const marker = document.createElement("i");
    marker.style.left = `${(event.time / state.selectedScenario.totalHours) * 100}%`;
    marker.title = `${formatClock(event.time)} · ${event.label}`;
    els.timelineEvents.append(marker);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function offsetLatLng(lat, lon, alongKm, crossKm, directionDegrees) {
  const radians = (directionDegrees * Math.PI) / 180;
  const east = Math.sin(radians) * alongKm + Math.cos(radians) * crossKm;
  const north = Math.cos(radians) * alongKm - Math.sin(radians) * crossKm;
  const nextLat = lat + north / 110.574;
  const lonScale = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const nextLon = lon + east / (111.32 * lonScale);
  return { lat: clamp(nextLat, -85, 85), lon: normalizeLongitude(nextLon) };
}

function kmToPixels(km, lat, lon) {
  const origin = map.latLngToContainerPoint([lat, lon]);
  const offset = map.latLngToContainerPoint([lat + km / 110.574, lon]);
  return Math.max(1, Math.abs(origin.y - offset.y));
}

function geometryBbox(geometry) {
  const values = [];
  collectCoordinates(geometry.coordinates, values);
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of values) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}

function collectCoordinates(value, output) {
  if (typeof value?.[0] === "number") {
    output.push(value);
    return;
  }
  for (const child of value || []) collectCoordinates(child, output);
}

function pointInGeometry(point, geometry) {
  if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  return false;
}

function pointInPolygon(point, polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(point, polygon[index])) return false;
  }
  return true;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function countryName(code) {
  const plant = state.plants.find((item) => item.country === code);
  if (plant) return plant.countryName;
  return state.countriesGeo.features.find((feature) => feature.id === code)?.properties?.name || code;
}

function formatCapacity(mw) {
  return mw >= 1000 ? `${(mw / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} GW` : `${numberFormat.format(mw)} MW`;
}

function compactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (value >= 10_000) return `${Math.round(value / 1000).toLocaleString("fr-FR")} k`;
  return numberFormat.format(value);
}

function formatClock(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.floor((hours - whole) * 60);
  return `${String(whole).padStart(2, "0")} h ${String(minutes).padStart(2, "0")}`;
}

function cardinal(degrees) {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return names[Math.round(degrees / 22.5) % 16];
}

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeLongitude(value) {
  let result = value;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const first = Math.max(Number.EPSILON, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

boot();
