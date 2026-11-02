import { createFakeAppData } from '@test/fake-app-data'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { SessionProvider } from './session'
import { useApiUrl } from './use-api-url'

async function setup() {
  const data = createFakeAppData()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>{children}</SessionProvider>
  )
  const hook = await renderHook(() => useApiUrl(), { wrapper })
  await waitFor(() => expect(hook.result.current.loaded).toBe(true))
  return { data, ...hook }
}

describe('useApiUrl', () => {
  it('começa mostrando a URL do ambiente do build', async () => {
    const { result } = await setup()
    expect(result.current.current).toBe('http://env.test')
    expect(result.current.isCustom).toBe(false)
  })

  it('guarda a nova URL no aparelho e passa a usá-la', async () => {
    const { result, data } = await setup()

    let saved = false
    await act(async () => {
      saved = await result.current.save('https://axis-api.onrender.com/')
    })

    expect(saved).toBe(true)
    expect(result.current.current).toBe('https://axis-api.onrender.com')
    expect(result.current.isCustom).toBe(true)
    await expect(data.apiUrl.resolve()).resolves.toBe('https://axis-api.onrender.com')
  })

  it('recusa URL inválida com mensagem e mantém a anterior', async () => {
    const { result } = await setup()

    let saved = true
    await act(async () => {
      saved = await result.current.save('localhost:3000')
    })

    expect(saved).toBe(false)
    expect(result.current.error).toBe(
      'Informe uma URL completa, como https://axis-api.onrender.com',
    )
    expect(result.current.current).toBe('http://env.test')
  })

  it('restaurar volta para a URL do ambiente', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.save('http://10.0.0.5:3000')
    })

    await act(async () => {
      await result.current.reset()
    })

    expect(result.current.current).toBe('http://env.test')
    expect(result.current.isCustom).toBe(false)
  })
})
