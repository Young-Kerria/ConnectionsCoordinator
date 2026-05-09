/**
 * app.js
 * Connections Coordinator — application logic.
 * Depends on: data.js (COLOR_STYLES, COLOR_ORDER, SAMPLE_TILES)
 */

'use strict';

/* ── DOM references ─────────────────────────────────────────────────────── */

const setup        = document.getElementById('setup');
const boardSection = document.getElementById('board-section');
const tilesInput   = document.getElementById('tiles-input');
const grid         = document.getElementById('grid');
const err          = document.getElementById('err');
const themeToggle  = document.getElementById('theme-toggle');
const colorBar     = document.getElementById('color-bar');

/* ── State ──────────────────────────────────────────────────────────────── */

/** Currently active color for painting tiles. 'none' means painting is off. */
let activeColor = 'none';

/** The tile element currently being dragged, or null. */
let dragSrcEl = null;

/* ── ResizeObservers ────────────────────────────────────────────────────── */

/** Re-runs fitFont() on each tile whenever it changes size. */
const roFont = new ResizeObserver(entries => {
  entries.forEach(e => fitFont(e.target));
});

/* ── Tile sizing ────────────────────────────────────────────────────────── */

/** Steps font down from --tile-font baseline until text fits, min 7.5px. */
function fitFont(el) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && size > 7.5) {
    size -= 0.5;
    el.style.fontSize = `${size}px`;
  }
}

/* ── Color application ──────────────────────────────────────────────────── */

/** Applies color styles to a tile and records the color in dataset. */
function applyColor(el, color) {
  const s = COLOR_STYLES[color] ?? COLOR_STYLES.none;
  el.style.background = s.bg;
  el.style.color      = s.fg;
  el.style.border     = s.bd;
  el.dataset.color    = color;
}

/* ── Tile factory ───────────────────────────────────────────────────────── */

/** Creates a fully wired tile DOM element. */
function makeTile(label, color = 'none') {
  const el = document.createElement('div');
  el.className  = 'tile';
  el.textContent = label;
  el.draggable  = true;
  el.tabIndex   = 0;
  applyColor(el, color);

  /* ── Click: paint / unpaint ── */
  el.addEventListener('click', () => {
    if (activeColor === 'none') return;
    const next = el.dataset.color === activeColor ? 'none' : activeColor;
    applyColor(el, next);
  });

  /* ── Keyboard: space / enter triggers paint ── */
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      el.click();
    }
  });

  /* ── Drag & drop ── */
  el.addEventListener('dragstart', e => {
    dragSrcEl = el;
    setTimeout(() => el.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragSrcEl = null;
  });

  el.addEventListener('dragover', e => {
    e.preventDefault();
    if (el !== dragSrcEl) el.classList.add('drag-over');
  });

  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (!dragSrcEl || dragSrcEl === el) return;

    // Swap the two tile nodes in the DOM without re-rendering
    const aNext = dragSrcEl.nextSibling === el ? el.nextSibling : dragSrcEl.nextSibling;
    grid.insertBefore(dragSrcEl, el.nextSibling);
    grid.insertBefore(el, aNext);

    [dragSrcEl, el].forEach(t => {
      t.classList.remove('just-swapped');
      void t.offsetWidth;
      t.classList.add('just-swapped');
    });
  });

  return el;
}

/* ── Color picker ───────────────────────────────────────────────────────── */

/** Order of swatches in the picker. 'none' is the off swatch. */
const SWATCHES = ['none', 'yellow', 'green', 'blue', 'purple'];

/** SVG checkmark shown on the active swatch. Stroke inherits via currentColor. */
const CHECK_SVG = `
  <svg class="chk" viewBox="0 0 11 11" fill="none" aria-hidden="true">
    <polyline points="1,5.5 4,8.5 10,2" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

/** Builds the color picker swatches into #color-bar. */
function buildSwatches() {
  SWATCHES.forEach((color, i) => {
    const el = document.createElement('span');
    el.className   = `swatch sw-${color}${i === 0 ? ' active' : ''}`;
    el.tabIndex    = 0;
    el.dataset.color = color;
    el.innerHTML   = `${CHECK_SVG}${color === 'none' ? 'off' : color}`;

    el.addEventListener('click', () => selectColor(el, color));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectColor(el, color);
      }
    });

    colorBar.appendChild(el);
  });
}

/** Sets the active painting color and updates swatch UI. */
function selectColor(swatchEl, color) {
  colorBar.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  swatchEl.classList.add('active');
  activeColor = color;
}

/* ── Panel transitions ──────────────────────────────────────────────────── */

/** Reveals a collapsed .panel. Forces reflow so the animation always plays. */
function showPanel(panel) {
  void panel.offsetHeight;
  panel.classList.add('panel-open');
}

/** Hides an open .panel. Optional callback runs when the transition ends.
 *  Filters out bubbled transitionend events from descendants (e.g. button
 *  hover/active transitions) so the callback only fires when the panel
 *  itself finishes collapsing. */
function hidePanel(panel, onHidden) {
  panel.classList.remove('panel-open');
  if (!onHidden) return;

  function handleEnd(e) {
    if (e.target !== panel || e.propertyName !== 'grid-template-rows') return;
    panel.removeEventListener('transitionend', handleEnd);
    onHidden();
  }
  panel.addEventListener('transitionend', handleEnd);
}

/* ── Board lifecycle ────────────────────────────────────────────────────── */

/** Parses newline- or comma-separated input into uppercase tile labels. */
function parseTiles(raw) {
  return raw.split(/[\n,]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
}

/** Validates input, renders the board, and hooks up ResizeObservers. */
function loadBoard() {
  const parsed = parseTiles(tilesInput.value);

  if (parsed.length !== 16) {
    err.textContent = `Need exactly 16 tiles. Got ${parsed.length}.`;
    return;
  }
  err.textContent = '';

  hidePanel(setup, () => {
    roFont.disconnect();
    grid.innerHTML = '';

    parsed.forEach((label, i) => {
      const el = makeTile(label);
      el.style.opacity   = '0';
      el.style.transform = 'translateY(8px)';
      grid.appendChild(el);
      roFont.observe(el);

      setTimeout(() => {
        el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        el.style.opacity    = '1';
        el.style.transform  = 'translateY(0)';
        requestAnimationFrame(() => fitFont(el));
      }, i * 28);
    });

    showPanel(boardSection);
  });
}

/** Populates the textarea with the sample puzzle (shuffled). */
function loadSample() {
  const tiles = [...SAMPLE_TILES];
  shuffleArray(tiles);
  tilesInput.value = tiles.join('\n');
}

/** Tears down the board and returns to the setup screen. */
function resetBoard() {
  hidePanel(boardSection, () => {
    roFont.disconnect();
    tilesInput.value = '';
    grid.innerHTML   = '';
    showPanel(setup);
  });
}

/* ── Tile helpers ───────────────────────────────────────────────────────── */

/** @returns {HTMLElement[]} All current tile elements in grid order. */
function getTiles() {
  return [...grid.querySelectorAll('.tile')];
}

/** Fisher-Yates in-place shuffle. */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Randomises all tile positions. */
function shuffleAll() {
  shuffleArray(getTiles()).forEach(el => grid.appendChild(el));
}

/** Randomises only uncolored tile positions, leaving colored tiles in place. */
function shuffleUncolored() {
  const all     = getTiles();
  const indices = all
    .map((el, i) => (el.dataset.color === 'none' ? i : -1))
    .filter(i => i >= 0);

  if (indices.length < 2) return;

  const shuffled = shuffleArray(indices.map(i => all[i]));
  const result   = [...all];
  indices.forEach((idx, i) => { result[idx] = shuffled[i]; });
  result.forEach(el => grid.appendChild(el));
}

/** Sorts tiles yellow → green → blue → purple → uncolored (shuffled). */
function sortByColor() {
  const groups = Object.fromEntries(COLOR_ORDER.map(c => [c, []]));
  getTiles().forEach(el => groups[el.dataset.color ?? 'none'].push(el));
  shuffleArray(groups.none);
  COLOR_ORDER.flatMap(c => groups[c]).forEach(el => grid.appendChild(el));
}

/** Resets every tile to uncolored. */
function clearColors() {
  getTiles().forEach(el => applyColor(el, 'none'));
}

/* ── Theme ──────────────────────────────────────────────────────────────── */

/** Toggles light/dark mode. Source of truth is data-theme on <html>. */
function toggleTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? '' : 'dark';
  themeToggle.textContent = isDark ? 'Dark' : 'Light';
}

/* ── Initialization ─────────────────────────────────────────────────────── */

buildSwatches();
showPanel(setup);
