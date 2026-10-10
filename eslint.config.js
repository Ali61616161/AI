// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Function'lar ve Deno testleri `deno lint` ile denetlenir (npm run functions:check).
    ignores: ['dist/*', 'dist-preview/*', 'supabase/functions/**', '**/*.test.ts'],
  },
]);
