import { defineConfig } from 'astro/config';

const isPublic = process.env.LYRICS_MODE === 'public';

export default defineConfig({
  output: 'static',
  site: isPublic ? 'https://public-lyrics.perken.tv' : 'https://lyrics.perken.tv',
  outDir: isPublic ? './dist-public' : './dist',
  vite: {
    server: {
      allowedHosts: ['debianhome.local'],
    },
  },
});
