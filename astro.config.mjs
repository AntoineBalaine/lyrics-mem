import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://perken.tv',
  base: '/lyrics',
  trailingSlash: 'ignore',
});
