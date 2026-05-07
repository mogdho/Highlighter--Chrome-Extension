const DEFAULTS = {
  brightness: 20,
  transparency: 100,
  shortcutKey: "s",
  shortcutAlt: true,
  shortcutCtrl: false,
  shortcutShift: false
};

// DOM elements
const brightnessSlider = document.getElementById("brightness");
const transparencySlider = document.getElementById("transparency");
const brightnessVal = document.getElementById("brightness-val");
const transparencyVal = document.getElementById("transparency-val");
const previewHighlights = document.querySelectorAll(".preview-highlight");
const recorder = document.getElementById("shortcut-recorder");
const shortcutDisplay = document.getElementById("shortcut-display");

const viewMain = document.getElementById("view-main");
const viewData = document.getElementById("view-data");
const btnSavedData = document.getElementById("btn-saved-data");
const btnBack = document.getElementById("btn-back");
const sitesList = document.getElementById("sites-list");

let recording = false;

// ── Helpers ──

function getColor(brightness, transparency) {
  const lightness = 50 + (brightness / 100) * 45;
  const alpha = transparency / 100;
  return `hsla(60, 100%, ${lightness}%, ${alpha})`;
}

function formatShortcut(s) {
  const parts = [];
  if (s.shortcutCtrl) parts.push("Ctrl");
  if (s.shortcutAlt) parts.push("Alt");
  if (s.shortcutShift) parts.push("Shift");
  parts.push(s.shortcutKey.toUpperCase());
  return parts.join(" + ");
}

function updatePreview(brightness, transparency) {
  const color = getColor(brightness, transparency);
  previewHighlights.forEach(el => {
    el.style.backgroundColor = color;
  });
}

// ── Load saved settings ──

chrome.storage.sync.get(DEFAULTS, (s) => {
  brightnessSlider.value = s.brightness;
  transparencySlider.value = s.transparency;
  brightnessVal.textContent = s.brightness;
  transparencyVal.textContent = s.transparency;
  updatePreview(s.brightness, s.transparency);
  shortcutDisplay.textContent = formatShortcut(s);
});

// ── Sliders ──

brightnessSlider.addEventListener("input", () => {
  const val = parseInt(brightnessSlider.value);
  brightnessVal.textContent = val;
  updatePreview(val, parseInt(transparencySlider.value));
});

brightnessSlider.addEventListener("change", () => {
  chrome.storage.sync.set({ brightness: parseInt(brightnessSlider.value) });
});

transparencySlider.addEventListener("input", () => {
  const val = parseInt(transparencySlider.value);
  transparencyVal.textContent = val;
  updatePreview(parseInt(brightnessSlider.value), val);
});

transparencySlider.addEventListener("change", () => {
  chrome.storage.sync.set({ transparency: parseInt(transparencySlider.value) });
});

// ── Shortcut recorder ──

recorder.addEventListener("click", (e) => {
  e.stopPropagation();
  recording = true;
  recorder.classList.add("recording");
  shortcutDisplay.textContent = "Press keys\u2026";
});

document.addEventListener("keydown", (e) => {
  if (!recording) return;
  e.preventDefault();
  e.stopPropagation();

  if (["Alt", "Control", "Shift", "Meta"].includes(e.key)) return;

  const shortcutSettings = {
    shortcutKey: e.key.toLowerCase(),
    shortcutAlt: e.altKey,
    shortcutCtrl: e.ctrlKey,
    shortcutShift: e.shiftKey
  };

  chrome.storage.sync.set(shortcutSettings);
  shortcutDisplay.textContent = formatShortcut(shortcutSettings);

  recording = false;
  recorder.classList.remove("recording");
});

document.addEventListener("click", () => {
  if (!recording) return;
  recording = false;
  recorder.classList.remove("recording");
  chrome.storage.sync.get(DEFAULTS, (s) => {
    shortcutDisplay.textContent = formatShortcut(s);
  });
});

// ── View Navigation ──

btnSavedData.addEventListener("click", () => {
  viewMain.style.display = "none";
  viewData.style.display = "block";
  loadAndRenderSites();
});

btnBack.addEventListener("click", () => {
  viewData.style.display = "none";
  viewMain.style.display = "block";
});

// ── Saved Data Management (grouped by domain) ──

function getDomain(url) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function groupByDomain(highlights) {
  const grouped = {};
  for (const [url, items] of Object.entries(highlights)) {
    const domain = getDomain(url);
    if (!grouped[domain]) grouped[domain] = { urls: [], count: 0 };
    grouped[domain].urls.push(url);
    grouped[domain].count += items.length;
  }
  return grouped;
}

function renderSites(highlights) {
  const grouped = groupByDomain(highlights);
  const domains = Object.keys(grouped).sort();

  if (domains.length === 0) {
    sitesList.innerHTML = '<p class="sites-empty">No saved highlights</p>';
    return;
  }

  sitesList.innerHTML = "";

  for (const domain of domains) {
    const { count, urls } = grouped[domain];
    const row = document.createElement("div");
    row.className = "site-row";
    row.innerHTML = `
      <span class="site-domain" title="${urls.join('\n')}">${domain}</span>
      <span class="site-count">${count}</span>
      <button class="site-delete" title="Delete all from ${domain}">&times;</button>
    `;

    row.querySelector(".site-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      for (const url of urls) delete highlights[url];
      await chrome.storage.local.set({ highlights });
      renderSites(highlights);
    });

    sitesList.appendChild(row);
  }
}

function loadAndRenderSites() {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    renderSites(data.highlights);
  });
}
