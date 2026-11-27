// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*'] },
  {
    settings: {
      // "@/..." resolves to the shared code in ../src (see metro.config.js / tsconfig paths)
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
  },
]);
