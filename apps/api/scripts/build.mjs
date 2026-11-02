// Empacota a API em dist/server.js. As dependências de terceiros ficam de fora (o servidor as
// lê do node_modules); só @axis/contracts entra no pacote, porque é TypeScript sem etapa de build.
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { dependencies } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const external = Object.keys(dependencies).filter((name) => name !== '@axis/contracts')

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external,
  logLevel: 'info',
})
