/**
 * data.js
 * Static data consumed by app.js.
 * Edit SAMPLE_TILES to change the built-in demo puzzle.
 */

/**
 * Color definitions for tile painting.
 * Each entry maps a color name to its background, foreground, and border styles.
 * "none" represents an unpainted tile and uses CSS variables so it
 * inherits the current theme automatically.
 *
 * @type {Record<string, { bg: string, fg: string, bd: string }>}
 */
const COLOR_STYLES = {
  none:   { bg: 'var(--bg-tile)',   fg: 'var(--fg-primary)', bd: 'var(--border-tile)' },
  yellow: { bg: '#F9DF6D', fg: '#3D3000', bd: '2px solid #C9AF00' },
  green:  { bg: '#A0C35A', fg: '#1A3300', bd: '2px solid #6A9030' },
  blue:   { bg: '#B0C4EF', fg: '#0D1F4A', bd: '2px solid #607AB8' },
  purple: { bg: '#BA81C5', fg: '#2D0A40', bd: '2px solid #8A4F98' },
};

/**
 * Color names in the order they should appear after "Sort by color".
 * "none" (uncolored) always goes last.
 *
 * @type {string[]}
 */
const COLOR_ORDER = ['yellow', 'green', 'blue', 'purple', 'none'];

/**
 * Built-in sample puzzle tiles.
 * These are shuffled on load so the order is never revealed.
 *
 * @type {string[]}
 */
const SAMPLE_TILES = [
  'ROGER',      'JOHN',       'EARL',       'ELEANOR',
  'REV',        'THU',        'ROO',        'SIX',
  'MARTIAL',    'WARFARIN',   'SEVICHE',    'EIGENVECTOR',
  'MYRRH',      'SEEKS',      'SAVANT',     'ACE',
];
