/**
 * app.js
 * Connections Coordinator — application logic.
 * Depends on: data.js (COLOR_STYLES, COLOR_ORDER, SAMPLE_TILES)
 */

'use strict';

/* ── State ──────────────────────────────────────────────────────────────── */

/** Currently active color for painting tiles. 'none' means painting is off. */
let activeColor = 'none';

/** Whether dark mode is currently enabled. */
let darkMode = false;

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
  el.style.fontSize = '';  // reset to --tile-font CSS variable
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
    const grid  = document.getElementById('grid');
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

/* ── Board lifecycle ────────────────────────────────────────────────────── */

/** Parses newline- or comma-separated input into uppercase tile labels. */
function parseTiles(raw) {
  return raw.split(/[\n,]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
}

/** Validates input, renders the board, and hooks up ResizeObservers. */
function loadBoard() {
  const parsed = parseTiles(document.getElementById('tiles-input').value);
  const err    = document.getElementById('err');

  if (parsed.length !== 16) {
    err.textContent = `Need exactly 16 tiles. Got ${parsed.length}.`;
    return;
  }
  err.textContent = '';

  const grid = document.getElementById('grid');
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
      requestAnimationFrame(() => {
        fitFont(el);
      });
    }, i * 28);
  });

  document.getElementById('setup').style.display        = 'none';
  document.getElementById('board-section').style.display = 'flex';
}

/** Populates the textarea with the sample puzzle (shuffled). */
function loadSample() {
  const tiles = [...SAMPLE_TILES];
  shuffleArray(tiles);
  document.getElementById('tiles-input').value = tiles.join('\n');
}

/** Tears down the board and returns to the setup screen. */
function resetBoard() {
  roFont.disconnect();
  document.getElementById('board-section').style.display = 'none';
  document.getElementById('setup').style.display         = 'flex';
  document.getElementById('tiles-input').value           = '';
  document.getElementById('grid').innerHTML              = '';
}

/* ── Tile helpers ───────────────────────────────────────────────────────── */

/** @returns {HTMLElement[]} All current tile elements in grid order. */
function getTiles() {
  return [...document.querySelectorAll('#grid .tile')];
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
  const grid = document.getElementById('grid');
  shuffleArray(getTiles()).forEach(el => grid.appendChild(el));
}

/** Randomises only uncolored tile positions, leaving colored tiles in place. */
function shuffleUncolored() {
  const grid = document.getElementById('grid');
  const all  = getTiles();
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
  const grid   = document.getElementById('grid');
  const groups = Object.fromEntries(COLOR_ORDER.map(c => [c, []]));
  getTiles().forEach(el => groups[el.dataset.color ?? 'none'].push(el));
  shuffleArray(groups.none);
  COLOR_ORDER.flatMap(c => groups[c]).forEach(el => grid.appendChild(el));
}

/** Resets every tile to uncolored. */
function clearColors() {
  getTiles().forEach(el => applyColor(el, 'none'));
}

/* ── UI controls ────────────────────────────────────────────────────────── */

/** Sets the active painting color and updates swatch UI. */
function selectColor(swatchEl, color) {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  swatchEl.classList.add('active');
  activeColor = color;
}

/** Toggles light/dark mode. */
function toggleTheme() {
  darkMode = !darkMode;
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
  document.getElementById('theme-toggle').textContent = darkMode ? 'Light' : 'Dark';
}
