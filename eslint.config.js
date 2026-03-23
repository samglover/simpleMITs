import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script', // Browser scripts, not ES modules
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        AbortController: 'readonly',
        // Third-party libraries loaded via script tags
        chance: 'readonly',
        $: 'readonly',
        // App globals defined in other script files
        // (add per-file /* global X */ comments for cross-file references)
      },
    },
  },
];
