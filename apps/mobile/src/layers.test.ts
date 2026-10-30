import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const SRC = join(__dirname)

/** Camadas de src/ e as camadas que cada uma pode importar (decisão #29: screens → hooks → repositories/services). */
const allowed: Record<string, string[]> = {
  screens: ['components', 'hooks', 'theme'],
  components: ['theme'],
  hooks: ['repositories', 'services'],
  repositories: ['services'],
  services: [],
  theme: [],
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1] as string)
}

/** Camada de src/ para a qual o import aponta, ou undefined se não for um import interno. */
function targetLayer(file: string, specifier: string): string | undefined {
  if (specifier.startsWith('@/')) return specifier.slice(2).split('/')[0]
  if (!specifier.startsWith('.')) return undefined
  const resolved = join(file, '..', specifier).slice(SRC.length + 1)
  return resolved.replaceAll(sep, '/').split('/')[0]
}

describe('camadas do app', () => {
  it.each(Object.keys(allowed))('%s só importa das camadas permitidas', (layer) => {
    const violations = sourceFiles(join(SRC, layer)).flatMap((file) =>
      importsOf(file)
        .map((specifier) => ({ file, target: targetLayer(file, specifier) }))
        .filter(
          ({ target }) =>
            target && target !== layer && !allowed[layer]?.includes(target) && target in allowed,
        )
        .map(({ file: f, target }) => `${f.slice(SRC.length + 1)} importa ${target}`),
    )
    expect(violations).toEqual([])
  })
})
