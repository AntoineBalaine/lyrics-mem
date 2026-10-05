import { defineConfig } from 'astro/config';

const isPublic = process.env.LYRICS_MODE === 'public';

export default defineConfig({
  output: 'static',
  site: isPublic ? 'https://public-lyrics.perken.tv' : 'https://lyrics.perken.tv',
  outDir: isPublic ? './dist-public' : './dist',
  vite: {
    // Because the parser is linked from a sibling folder and built as
    // CommonJS, the dev server would send it to the browser as it is, and
    // the browser cannot read named exports from that. Listing it here
    // makes Vite convert it, as it already does for packages in node_modules.
    optimizeDeps: {
      include: ['abcls-parser', 'abcls-parser/types/abcjs-ast', 'abcls-parser/music-theory/numberNotation'],
    },
    server: {
      allowedHosts: ['debianhome.local'],
    },
  },
});
