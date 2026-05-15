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

/* ── Constants ──────────────────────────────────────────────────────────── */

/** NYT Connections is 4×4 */
const TILES_PER_PUZZLE = 16;

/** Pointer movement (in px) past which a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 6;

/** Stagger between successive tile fade-ins, in milliseconds. */
const TILE_FADE_STAGGER_MS = 28;

/** Duration of each tile's fade-in transition. */
const TILE_FADE_DURATION = '0.25s';

/** Starting vertical offset (px) for the tile fade-in. */
const TILE_FADE_OFFSET_PX = 8;

/** Minimum font size (px) that fitFont will shrink to. */
const FIT_FONT_MIN_PX = 7.5;

/** Step (px) by which fitFont decreases the font size each iteration. */
const FIT_FONT_STEP_PX = 0.5;

/* ── State ──────────────────────────────────────────────────────────────── */

/** Active color for painting tiles. */
let activeColor = 'none';

/* ── ResizeObservers ────────────────────────────────────────────────────── */

/** Re-runs fitFont() on each tile whenever it changes size. */
const roFont = new ResizeObserver(entries => {
  entries.forEach(e => fitFont(e.target));
});

/* ── Tile sizing ────────────────────────────────────────────────────────── */

/** Steps font down from the CSS baseline until text fits, bounded by FIT_FONT_MIN_PX. */
function fitFont(el) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && size > FIT_FONT_MIN_PX) {
    size -= FIT_FONT_STEP_PX;
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

/** Clears the .drag-over highlight from any tile in the grid. */
function clearDragOver() {
  grid.querySelectorAll('.tile.drag-over').forEach(t => t.classList.remove('drag-over'));
}

/** Plays the just-swapped pop animation on a pair of tiles. */
function playSwapAnimation(a, b) {
  [a, b].forEach(t => {
    t.classList.remove('just-swapped');
    void t.offsetWidth;
    t.classList.add('just-swapped');
  });
}

/** Creates a fully wired tile DOM element. */
function makeTile(label, color = 'none') {
  const el = document.createElement('div');
  el.className  = 'tile';
  el.textContent = label;
  el.tabIndex   = 0;
  applyColor(el, color);

  let pointerStartX = 0;
  let pointerStartY = 0;
  let dragging = false;

  /* ── Click: paint / unpaint (skipped if a drag occurred) ── */
  el.addEventListener('click', () => {
    if (dragging) return;
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

  /* ── Pointer-based drag (mouse, touch, pen) ── */
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    dragging = false;
    el.classList.add('pressed');
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;

    if (!dragging) {
      const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
      if (dist < DRAG_THRESHOLD) return;
      dragging = true;
      el.classList.add('dragging');
    }

    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tile');
    clearDragOver();
    if (target && target !== el) target.classList.add('drag-over');
  });

  el.addEventListener('pointerup', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('pressed');
    if (!dragging) return;

    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tile');
    clearDragOver();
    el.classList.remove('dragging');

    if (target && target !== el && target.parentElement === grid && el.parentElement === grid) {
      // Swap el and target in the grid by remembering both original next-siblings.
      const aNext = el.nextSibling;
      const bNext = target.nextSibling;
      grid.insertBefore(el, bNext);
      grid.insertBefore(target, aNext);
      playSwapAnimation(el, target);
    }

    // Keep `dragging` true through the click event that follows pointerup,
    // so the click handler skips its paint logic.
    setTimeout(() => { dragging = false; }, 0);
  });

  el.addEventListener('pointercancel', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('pressed');
    el.classList.remove('dragging');
    clearDragOver();
    dragging = false;
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

/** Reveals a collapsed .panel. */
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

  if (parsed.length !== TILES_PER_PUZZLE) {
    err.textContent = `Need exactly ${TILES_PER_PUZZLE} tiles. Got ${parsed.length}.`;
    return;
  }
  err.textContent = '';

  hidePanel(setup, () => {
    roFont.disconnect();
    grid.innerHTML = '';

    parsed.forEach((label, i) => {
      const el = makeTile(label);
      el.style.opacity   = '0';
      el.style.transform = `translateY(${TILE_FADE_OFFSET_PX}px)`;
      grid.appendChild(el);
      roFont.observe(el);

      setTimeout(() => {
        el.style.transition = `opacity ${TILE_FADE_DURATION} ease, transform ${TILE_FADE_DURATION} ease`;
        el.style.opacity    = '1';
        el.style.transform  = 'translateY(0)';
        requestAnimationFrame(() => fitFont(el));
      }, i * TILE_FADE_STAGGER_MS);
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

function isDarkMode() {
  return document.documentElement.dataset.theme === 'dark';
}

function syncThemeLabel() {
  themeToggle.textContent = isDarkMode() ? 'Light' : 'Dark';
}

function toggleTheme() {
  const next = isDarkMode() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next === 'dark' ? 'dark' : '';
  localStorage.setItem('theme', next);
  syncThemeLabel();
}

/* ── Initialization ─────────────────────────────────────────────────────── */

buildSwatches();
syncThemeLabel();
showPanel(setup);
