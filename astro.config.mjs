// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://yem.sh',
  base: '/',
  trailingSlash: 'always',
  // React is only used for the React Bits islands on /v3/.
  integrations: [react()],
});
