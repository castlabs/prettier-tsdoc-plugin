import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      outDir: undefined,
      noEmit: false,
    }),
  ],
  external: [
    'prettier',
    '@microsoft/tsdoc',
    'prettier/parser-typescript',
    'prettier/parser-babel',
  ],
};
