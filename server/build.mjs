// Bündelt den Server inkl. @zauberbuch/shared; alle übrigen npm-Pakete bleiben extern.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-deps',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@zauberbuch/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
