import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
];
