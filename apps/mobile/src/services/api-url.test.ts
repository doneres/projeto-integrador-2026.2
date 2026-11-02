import { createApiUrlSettings, InvalidApiUrlError } from './api-url'
import { createMemoryStore } from './key-value-store'

describe('createApiUrlSettings', () => {
  it('sem URL guardada vale a do ambiente do build', async () => {
    const settings = createApiUrlSettings(createMemoryStore(), () => 'http://env.test')
    await expect(settings.resolve()).resolves.toBe('http://env.test')
    await expect(settings.getOverride()).resolves.toBeNull()
  })

  it('a URL guardada no aparelho vale mais que a do ambiente', async () => {
    const settings = createApiUrlSettings(createMemoryStore(), () => 'http://env.test')
    await settings.setOverride('https://axis-api.onrender.com/')
    await expect(settings.resolve()).resolves.toBe('https://axis-api.onrender.com')
    await expect(settings.getOverride()).resolves.toBe('https://axis-api.onrender.com')
  })

  it('a URL fica no armazenamento e sobrevive a uma nova instância', async () => {
    const store = createMemoryStore()
    await createApiUrlSettings(store, () => 'http://env.test').setOverride('http://10.0.0.5:3000')
    const again = createApiUrlSettings(store, () => 'http://env.test')
    await expect(again.resolve()).resolves.toBe('http://10.0.0.5:3000')
  })

  it('limpar a URL guardada volta para a do ambiente', async () => {
    const settings = createApiUrlSettings(createMemoryStore(), () => 'http://env.test')
    await settings.setOverride('http://10.0.0.5:3000')
    await settings.clearOverride()
    await expect(settings.resolve()).resolves.toBe('http://env.test')
  })

  it('recusa URL inválida sem guardar nada', async () => {
    const settings = createApiUrlSettings(createMemoryStore(), () => 'http://env.test')
    await expect(settings.setOverride('localhost:3000')).rejects.toBeInstanceOf(InvalidApiUrlError)
    await expect(settings.getOverride()).resolves.toBeNull()
  })

  it('a URL guardada funciona mesmo sem URL no ambiente', async () => {
    const settings = createApiUrlSettings(createMemoryStore(), () => {
      throw new Error('ambiente ausente')
    })
    await settings.setOverride('http://10.0.0.5:3000')
    await expect(settings.resolve()).resolves.toBe('http://10.0.0.5:3000')
  })
})
