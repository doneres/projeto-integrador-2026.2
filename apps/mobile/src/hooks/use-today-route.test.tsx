import type { RouteDetail } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { routeWith } from '@test/route-fixtures'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ApiRequestError, NetworkError, RequestTimeoutError } from '@/services/api-client'
import { ApiUrlMissingError } from '@/services/api-url'
import { SessionProvider } from './session'
import { useTodayRoute } from './use-today-route'

async function setup(today: () => Promise<RouteDetail | null>) {
  const data = createFakeAppData(undefined, { today })
  await data.sessions.save(sellerSession())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>{children}</SessionProvider>
  )
  return renderHook(() => useTodayRoute(), { wrapper })
}

describe('useTodayRoute', () => {
  it('carrega enquanto a leitura não termina e depois entrega a rota com as Visitas', async () => {
    const route = routeWith(['pending', 'completed'])
    let finish: (route: RouteDetail) => void = () => {}
    const { result } = await setup(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )

    expect(result.current.state).toEqual({ status: 'loading' })
    await act(async () => finish(route))
    expect(result.current.state).toEqual({ status: 'ready', route })
  })

  it('sem rota hoje, o estado é vazio', async () => {
    const { result } = await setup(() => Promise.resolve(null))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'empty' }))
  })

  it('rota sem Visitas também é vazio', async () => {
    const { result } = await setup(() => Promise.resolve(routeWith([])))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'empty' }))
  })

  it.each([
    ['sem conexão', new NetworkError(), 'Não foi possível conectar ao servidor'],
    ['prazo', new RequestTimeoutError(), 'O servidor não respondeu a tempo'],
    ['URL da API ausente', new ApiUrlMissingError(), 'A URL da API não está configurada'],
    [
      'erro do servidor',
      new ApiRequestError(500, undefined, 'x'),
      'Não foi possível carregar a rota',
    ],
    ['resposta inválida', new Error('zod'), 'Não foi possível carregar a rota'],
  ])('%s vira uma mensagem de erro', async (_name, error, message) => {
    const { result } = await setup(() => Promise.reject(error))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    const { state } = result.current
    expect(state.status === 'error' && state.message).toContain(message)
  })

  it('tentar de novo volta a carregar e refaz a leitura', async () => {
    const today = jest
      .fn<Promise<RouteDetail | null>, []>()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(routeWith(['in_progress']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('error'))

    await act(async () => result.current.retry())

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(today).toHaveBeenCalledTimes(2)
  })

  it('uma resposta antiga não sobrescreve a da nova tentativa', async () => {
    let resolveFirst: (route: RouteDetail | null) => void = () => {}
    const today = jest
      .fn<Promise<RouteDetail | null>, []>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValueOnce(routeWith(['pending']))
    const { result } = await setup(today)

    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => resolveFirst(null))

    expect(result.current.state.status).toBe('ready')
  })
})
