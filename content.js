// ── Default Settings ──
const DEFAULTS = {
  brightness: 20,
  transparency: 100,
  shortcutKey: "s",
  shortcutAlt: true,
  shortcutCtrl: false,
  shortcutShift: false
};

const CONTEXT_LEN = 32;
let settings = { ...DEFAULTS };

const settingsReady = new Promise((resolve) => {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    resolve();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
  }
});

function getHighlightColor() {
  const lightness = 50 + (settings.brightness / 100) * 45;
  const alpha = settings.transparency / 100;
  return `hsla(60, 100%, ${lightness}%, ${alpha})`;
}

// ── Text-Quote Anchoring ──

let _textIndexCache = null;

function buildTextIndex() {
  if (_textIndexCache) return _textIndexCache;

  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  let fullText = "";
  const nodeMap = [];
  for (const tn of textNodes) {
    const start = fullText.length;
    fullText += tn.textContent;
    nodeMap.push({ node: tn, start, end: fullText.length });
  }

  _textIndexCache = { fullText, nodeMap };
  return _textIndexCache;
}

function invalidateTextIndex() {
  _textIndexCache = null;
}

function nodeAtOffset(nodeMap, offset) {
  for (const e of nodeMap) {
    if (offset >= e.start && offset < e.end) return { node: e.node, offset: offset - e.start };
    if (offset === e.end) return { node: e.node, offset: e.node.textContent.length };
  }
  return null;
}

function createAnchor(range) {
  const text = range.toString();
  const { fullText, nodeMap } = buildTextIndex();

  let globalStart = 0;
  for (const e of nodeMap) {
    if (e.node === range.startContainer) { globalStart = e.start + range.startOffset; break; }
  }

  return {
    text,
    prefix: fullText.substring(Math.max(0, globalStart - CONTEXT_LEN), globalStart),
    suffix: fullText.substring(globalStart + text.length, globalStart + text.length + CONTEXT_LEN)
  };
}

function findAnchorInDOM(anchor) {
  const { fullText, nodeMap } = buildTextIndex();
  const { text, prefix, suffix } = anchor;

  const matches = [];
  let idx = 0;
  while ((idx = fullText.indexOf(text, idx)) !== -1) { matches.push(idx); idx++; }
  if (matches.length === 0) return null;

  let bestMatch = matches[0], bestScore = -1;
  for (const m of matches) {
    let score = 0;
    if (prefix) {
      const actual = fullText.substring(Math.max(0, m - prefix.length), m);
      for (let i = 0; i < Math.min(prefix.length, actual.length); i++) {
        if (prefix[prefix.length - 1 - i] === actual[actual.length - 1 - i]) score++; else break;
      }
    }
    if (suffix) {
      const actual = fullText.substring(m + text.length, m + text.length + suffix.length);
      for (let i = 0; i < Math.min(suffix.length, actual.length); i++) {
        if (suffix[i] === actual[i]) score++; else break;
      }
    }
    if (score > bestScore) { bestScore = score; bestMatch = m; }
  }

  const s = nodeAtOffset(nodeMap, bestMatch);
  const e = nodeAtOffset(nodeMap, bestMatch + text.length);
  if (!s || !e) return null;

  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  return range;
}

// ── Storage ──

function getPageKey() { return window.location.href.split("#")[0]; }

async function saveHighlight(id, anchor) {
  const key = getPageKey();
  const data = await chrome.storage.local.get({ highlights: {} });
  const h = data.highlights;
  if (!h[key]) h[key] = [];
  h[key].push({ id, ...anchor });
  await chrome.storage.local.set({ highlights: h });
}

async function removeHighlightFromStorage(id) {
  const key = getPageKey();
  const data = await chrome.storage.local.get({ highlights: {} });
  const h = data.highlights;
  if (h[key]) {
    h[key] = h[key].filter(x => x.id !== id);
    if (h[key].length === 0) delete h[key];
    await chrome.storage.local.set({ highlights: h });
  }
}

async function loadHighlights() {
  const key = getPageKey();
  const data = await chrome.storage.local.get({ highlights: {} });
  return data.highlights[key] || [];
}

// ── DOM Operations ──

function createMark(color, id) {
  const mark = document.createElement("mark");
  mark.style.backgroundColor = color;
  mark.style.color = "#1a1a1a";
  mark.style.padding = "0";
  mark.style.cursor = "pointer";
  mark.dataset.highlighter = "true";
  mark.dataset.highlighterId = id;
  return mark;
}

function getTextNodesInRange(range) {
  const result = [];
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!range.intersectsNode(node)) continue;
    const startOffset = node === range.startContainer ? range.startOffset : 0;
    const endOffset = node === range.endContainer ? range.endOffset : node.length;
    if (node.textContent.substring(startOffset, endOffset).trim() === "") continue;
    result.push({ node, startOffset, endOffset });
  }
  return result;
}

function wrapRangeInMark(range, color, id) {
  try {
    const mark = createMark(color, id);
    range.surroundContents(mark);
  } catch {
    for (const { node, startOffset, endOffset } of getTextNodesInRange(range)) {
      const mark = createMark(color, id);
      const r = document.createRange();
      r.setStart(node, startOffset);
      r.setEnd(node, endOffset);
      r.surroundContents(mark);
    }
  }
}

// ── Highlight & Restore ──

async function highlightSelection() {
  await settingsReady;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (range.toString().trim() === "") return;

  const id = crypto.randomUUID();
  invalidateTextIndex(); // ensure fresh index for current DOM state
  const anchor = createAnchor(range); // capture BEFORE DOM modification
  invalidateTextIndex(); // DOM will change after wrapping
  wrapRangeInMark(range, getHighlightColor(), id);
  await saveHighlight(id, anchor);
  selection.removeAllRanges();
}

let pendingHighlights = [];

async function restoreHighlights() {
  await settingsReady;
  const saved = await loadHighlights();
  if (saved.length === 0) return;

  const color = getHighlightColor();
  pendingHighlights = [];

  // Build text index once for the entire restore cycle
  invalidateTextIndex();

  for (const item of saved) {
    const range = findAnchorInDOM(item);
    if (range) {
      invalidateTextIndex(); // DOM changes after each wrap
      wrapRangeInMark(range, color, item.id);
    } else {
      pendingHighlights.push(item);
    }
  }

  invalidateTextIndex(); // clear stale cache after cycle
  if (pendingHighlights.length > 0) watchForPending();
}

let _pendingObserver = null;
let _pendingTimeout = null;

function watchForPending() {
  // Disconnect any existing observer to prevent stacking
  if (_pendingObserver) {
    _pendingObserver.disconnect();
    _pendingObserver = null;
  }
  if (_pendingTimeout) {
    clearTimeout(_pendingTimeout);
    _pendingTimeout = null;
  }

  let debounce;
  _pendingObserver = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (pendingHighlights.length === 0) { _pendingObserver.disconnect(); _pendingObserver = null; return; }

      invalidateTextIndex(); // DOM changed, need fresh index
      const color = getHighlightColor();
      const still = [];
      for (const item of pendingHighlights) {
        const range = findAnchorInDOM(item);
        if (range) {
          invalidateTextIndex(); // DOM changes after each wrap
          wrapRangeInMark(range, color, item.id);
        }
        else still.push(item);
      }
      pendingHighlights = still;
      invalidateTextIndex(); // clear stale cache
      if (still.length === 0) { _pendingObserver.disconnect(); _pendingObserver = null; }
    }, 500);
  });

  _pendingObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Give up after 15 seconds
  _pendingTimeout = setTimeout(() => {
    if (_pendingObserver) { _pendingObserver.disconnect(); _pendingObserver = null; }
    pendingHighlights = [];
    _pendingTimeout = null;
  }, 15000);
}

// ── Event Listeners ──

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight") highlightSelection();
});

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;

  if (
    e.key.toLowerCase() === settings.shortcutKey.toLowerCase() &&
    e.altKey === settings.shortcutAlt &&
    e.ctrlKey === settings.shortcutCtrl &&
    e.shiftKey === settings.shortcutShift
  ) {
    e.preventDefault();
    highlightSelection();
  }
});

document.addEventListener("click", async (e) => {
  const mark = e.target.closest('mark[data-highlighter="true"]');
  if (!mark) return;

  const id = mark.dataset.highlighterId;
  const parent = mark.parentNode;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();

  if (id) await removeHighlightFromStorage(id);
});

// Restore saved highlights on page load
restoreHighlights();

// ── SPA Navigation Detection ──
// injected.js runs in the MAIN world (registered in manifest.json)
// and intercepts history.pushState/replaceState, dispatching a custom
// 'hltr-urlchange' event that this content script can hear.

let currentUrl = window.location.href;

function clearExistingHighlights() {
  document.querySelectorAll('mark[data-highlighter="true"]').forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function onUrlChange() {
  const newUrl = window.location.href;
  if (newUrl === currentUrl) return;
  currentUrl = newUrl;

  // Delay to let new page content render
  setTimeout(() => {
    clearExistingHighlights();
    restoreHighlights();
  }, 500);
}

// Listen for the custom event from injected.js (MAIN world)
window.addEventListener("hltr-urlchange", onUrlChange);

// Back/forward navigation
window.addEventListener("popstate", onUrlChange);
