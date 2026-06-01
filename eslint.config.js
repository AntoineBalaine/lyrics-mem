import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    ignores: ['dist/', 'dist-public/', '.astro/', 'node_modules/'],
  },
];
