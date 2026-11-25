import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

/**
 * Porta de armazenamento das Fotos: a API e o seed só conhecem esta interface. Em desenvolvimento
 * o adaptador grava em disco; em produção, no Cloudinary. O banco guarda só a `storageKey`.
 */
export interface PhotoStorage {
  /** Grava o arquivo sob a chave e devolve a mesma chave. Gravar de novo substitui. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>
}

/** Chave de uma Foto do seed: previsível, para rodar o seed de novo não gerar arquivos novos. */
export const photoKey = (name: string) => `photos/${name}`

/** Disco local: a chave vira um caminho dentro de `root`, e nunca sai dele. */
export function createDiskStorage(root: string): PhotoStorage {
  const base = resolve(root)
  return {
    async put(key, bytes) {
      const target = resolve(join(base, key))
      if (target !== base && !target.startsWith(base + sep)) {
        throw new Error(`Chave fora da pasta de armazenamento: ${key}`)
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
      return key
    },
  }
}

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

/**
 * Cloudinary, por upload assinado (REST). A chave vira o `public_id` (sem a extensão), no formato
 * em que o arquivo foi enviado. `fetchImpl` existe para os testes.
 */
export function createCloudinaryStorage(
  { cloudName, apiKey, apiSecret }: CloudinaryConfig,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): PhotoStorage {
  return {
    async put(key, bytes, contentType) {
      const publicId = key.replace(/\.[^./]+$/, '')
      const timestamp = String(Math.floor(now().getTime() / 1000))
      // A assinatura cobre os parâmetros em ordem alfabética, sem o arquivo, a chave e o tipo.
      const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`
      const signature = createHash('sha1')
        .update(toSign + apiSecret)
        .digest('hex')

      const form = new FormData()
      form.set('file', new Blob([bytes as BlobPart], { type: contentType }), key)
      form.set('api_key', apiKey)
      form.set('timestamp', timestamp)
      form.set('public_id', publicId)
      form.set('overwrite', 'true')
      form.set('signature', signature)

      const response = await fetchImpl(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: form },
      )
      if (!response.ok) {
        throw new Error(`Cloudinary recusou o upload de ${key}: HTTP ${response.status}`)
      }
      return key
    },
  }
}

/**
 * Escolhe o adaptador pelo ambiente: com `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e
 * `CLOUDINARY_API_SECRET` é o Cloudinary; sem nenhuma, o disco em `STORAGE_DIR` (padrão
 * `.storage`). Configuração pela metade é erro: melhor falhar do que gravar no lugar errado.
 */
export function createPhotoStorageFromEnv(
  source: Record<string, string | undefined>,
  nodeEnv: string = source.NODE_ENV ?? 'development',
): PhotoStorage {
  const names = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
  const given = names.filter((name) => source[name])
  if (given.length === names.length) {
    return createCloudinaryStorage({
      cloudName: source.CLOUDINARY_CLOUD_NAME as string,
      apiKey: source.CLOUDINARY_API_KEY as string,
      apiSecret: source.CLOUDINARY_API_SECRET as string,
    })
  }
  if (given.length > 0) {
    const missing = names.filter((name) => !source[name]).join(', ')
    throw new Error(`Configuração do Cloudinary incompleta: falta ${missing}`)
  }
  if (nodeEnv === 'production') {
    throw new Error('Em produção as Fotos vão para o Cloudinary: defina as variáveis CLOUDINARY_*')
  }
  return createDiskStorage(source.STORAGE_DIR ?? '.storage')
}
