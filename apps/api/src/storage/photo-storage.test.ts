import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createCloudinaryStorage,
  createDiskStorage,
  createPhotoStorageFromEnv,
  photoKey,
} from './photo-storage'

describe('createDiskStorage', () => {
  let root: string
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'axis-storage-'))
  })
  afterAll(() => rm(root, { recursive: true, force: true }))

  it('grava o arquivo sob a chave, em subpastas, e devolve a chave', async () => {
    const storage = createDiskStorage(root)
    const key = photoKey('a.jpg')
    expect(await storage.put(key, new Uint8Array([1, 2, 3]), 'image/jpeg')).toBe(key)
    expect([...(await readFile(join(root, key)))]).toEqual([1, 2, 3])
  })

  it('recusa uma chave que sai da pasta', async () => {
    const storage = createDiskStorage(root)
    await expect(storage.put('../fora.jpg', new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(
      /fora da pasta/,
    )
  })
})

describe('createCloudinaryStorage', () => {
  const config = { cloudName: 'demo', apiKey: 'key', apiSecret: 'segredo' }
  const now = () => new Date('2026-11-20T15:00:00Z')

  it('faz o upload assinado, com o public_id sem a extensão', async () => {
    let seen: { url: string; form: FormData } | undefined
    const fetchImpl = (async (url: string, init: { body: FormData }) => {
      seen = { url, form: init.body }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const key = await createCloudinaryStorage(config, fetchImpl, now).put(
      photoKey('geladeira.jpg'),
      new Uint8Array([1, 2]),
      'image/jpeg',
    )

    expect(key).toBe('photos/geladeira.jpg')
    expect(seen?.url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload')
    const timestamp = String(Math.floor(now().getTime() / 1000))
    expect(seen?.form.get('public_id')).toBe('photos/geladeira')
    expect(seen?.form.get('timestamp')).toBe(timestamp)
    expect(seen?.form.get('signature')).toBe(
      createHash('sha1')
        .update(`overwrite=true&public_id=photos/geladeira&timestamp=${timestamp}segredo`)
        .digest('hex'),
    )
  })

  it('lança quando o Cloudinary recusa', async () => {
    const fetchImpl = (async () => new Response('', { status: 401 })) as unknown as typeof fetch
    await expect(
      createCloudinaryStorage(config, fetchImpl, now).put(
        'a.jpg',
        new Uint8Array([1]),
        'image/jpeg',
      ),
    ).rejects.toThrow(/401/)
  })
})

describe('createPhotoStorageFromEnv', () => {
  it('sem Cloudinary, usa o disco; em produção sem Cloudinary, recusa', () => {
    expect(createPhotoStorageFromEnv({})).toBeDefined()
    expect(() => createPhotoStorageFromEnv({}, 'production')).toThrow(/CLOUDINARY/)
  })

  it('configuração do Cloudinary pela metade é erro e diz o que falta', () => {
    expect(() => createPhotoStorageFromEnv({ CLOUDINARY_CLOUD_NAME: 'x' })).toThrow(
      /CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET/,
    )
  })

  it('com as três variáveis, usa o Cloudinary', () => {
    expect(
      createPhotoStorageFromEnv({
        CLOUDINARY_CLOUD_NAME: 'x',
        CLOUDINARY_API_KEY: 'y',
        CLOUDINARY_API_SECRET: 'z',
      }),
    ).toBeDefined()
  })
})
