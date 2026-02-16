const globals = require('globals');

module.exports = [
  // Ignore junk
  {
    ignores: ['node_modules/**', 'coverage/**', 'cache/**', '.scannerwork/**'],
  },

  // App code (Node/CommonJS)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {},
  },

  // Tests (Node + Jest)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {},
  },
];
