import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Browser/DOM globals that gameplay code in src/core must never touch.
const browserGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'AudioContext',
  'HTMLElement',
  'HTMLCanvasElement',
  'Image',
  'Event',
  'EventTarget',
  'MouseEvent',
  'KeyboardEvent',
  'Gamepad',
];

export default tseslint.config(
  {
    ignores: [
      '.claude/worktrees',
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      'docs/reference',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Architecture boundary: core is pure, deterministic TypeScript.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'src/core must not import three.' },
            {
              group: ['**/render', '**/render/**'],
              message: 'src/core must not import src/render.',
            },
            {
              group: ['**/audio', '**/audio/**'],
              message: 'src/core must not import src/audio.',
            },
            {
              group: ['**/app', '**/app/**', '**/input', '**/input/**', '**/dev', '**/dev/**'],
              message: 'src/core must not import app, input or dev code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...browserGlobals.map((name) => ({
          name,
          message: 'src/core must not use DOM/browser APIs.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG (src/core/rng).' },
        { object: 'Date', property: 'now', message: 'Core is driven by the fixed timestep only.' },
      ],
    },
  },
);
