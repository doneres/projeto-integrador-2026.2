import { parseApiUrl, readEnv } from './env'

describe('readEnv', () => {
  it('devolve a URL da API sem a barra final', () => {
    expect(readEnv({ EXPO_PUBLIC_API_URL: 'http://192.168.0.10:3000/' })).toEqual({
      apiUrl: 'http://192.168.0.10:3000',
    })
  })

  it('falha com mensagem clara quando a URL falta', () => {
    expect(() => readEnv({})).toThrow('EXPO_PUBLIC_API_URL')
  })

  it('falha quando a URL é inválida', () => {
    expect(() => readEnv({ EXPO_PUBLIC_API_URL: 'localhost:3000' })).toThrow('EXPO_PUBLIC_API_URL')
  })
})

describe('parseApiUrl', () => {
  it('aceita URL http(s) e tira espaços e a barra final', () => {
    expect(parseApiUrl('  https://axis-api.onrender.com/ ')).toBe('https://axis-api.onrender.com')
  })

  it('recusa o que não é URL completa', () => {
    expect(parseApiUrl('localhost:3000')).toBeNull()
    expect(parseApiUrl('')).toBeNull()
    expect(parseApiUrl('ftp://servidor')).toBeNull()
  })
})
