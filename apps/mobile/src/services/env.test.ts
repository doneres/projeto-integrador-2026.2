import { readEnv } from './env'

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
