import type { RouteDetail } from '@axis/contracts'
import { createFakeAppData, type FakeExtras, sellerSession } from '@test/fake-app-data'
import { routeWith } from '@test/route-fixtures'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { NetworkError } from '@/services/api-client'
import { SessionProvider } from './session'
import { useTodayRoute } from './use-today-route'

type Today = jest.Mock<Promise<RouteDetail | null>, []>

async function setup(today: () => Promise<RouteDetail | null>, extras?: FakeExtras) {
  const data = createFakeAppData(undefined, { today }, extras)
  await data.sessions.save(sellerSession())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>{children}</SessionProvider>
  )
  return renderHook(() => useTodayRoute(), { wrapper })
}

/** Troca o AppState do React Native por um que o teste controla. */
function mockAppState() {
  // A sessão também escuta o AppState: todos os ouvintes recebem a mudança.
  const listeners = new Set<(state: AppStateStatus) => void>()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listeners.add(handler)
    return { remove: () => listeners.delete(handler) } as ReturnType<
      typeof AppState.addEventListener
    >
  })
  return {
    change: (state: AppStateStatus) =>
      act(async () => {
        for (const listener of [...listeners]) listener(state)
      }),
  }
}

const at = (hour: number, minute: number) => new Date(2026, 10, 12, hour, minute)

/** Relógio que o teste avança com `set`. */
function fakeClock(start: Date) {
  let current = start
  return {
    now: () => current,
    set: (date: Date) => {
      current = date
    },
  }
}

const offline = { isOnline: async () => false }

function visitStatuses(result: { current: ReturnType<typeof useTodayRoute> }) {
  const { state } = result.current
  return state.status === 'ready' ? state.route.visits.map((visit) => visit.status) : null
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('useTodayRoute: hora da última atualização', () => {
  it('guarda a hora da leitura bem-sucedida, lida do relógio', async () => {
    const clock = fakeClock(at(9, 5))
    const { result } = await setup(() => Promise.resolve(routeWith(['pending'])), clock)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.updatedAt).toEqual(at(9, 5))
  })

  it('o estado vazio também é uma leitura bem-sucedida, com hora', async () => {
    const clock = fakeClock(at(7, 30))
    const { result } = await setup(() => Promise.resolve(null), clock)
    await waitFor(() => expect(result.current.state.status).toBe('empty'))
    expect(result.current.updatedAt).toEqual(at(7, 30))
  })

  it('sem leitura bem-sucedida não há hora', async () => {
    const { result } = await setup(() => Promise.reject(new NetworkError()))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.updatedAt).toBeNull()
  })
})

describe('useTodayRoute: botão Atualizar', () => {
  it('relê a rota sem esconder a lista e troca a hora quando termina', async () => {
    const clock = fakeClock(at(9, 0))
    let finish: (route: RouteDetail) => void = () => {}
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['pending']))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
    const { result } = await setup(today, clock)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(9, 40))
    await act(async () => result.current.refresh())
    expect(result.current.refreshing).toBe(true)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.updatedAt).toEqual(at(9, 0))

    await act(async () => finish(routeWith(['pending', 'pending'])))
    expect(result.current.refreshing).toBe(false)
    expect(result.current.updatedAt).toEqual(at(9, 40))
    expect(visitStatuses(result)).toEqual(['pending', 'pending'])
  })

  it('apertar de novo enquanto a leitura não terminou não abre outra', async () => {
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['pending']))
      .mockReturnValue(new Promise(() => {}))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => result.current.refresh())
    await act(async () => result.current.refresh())

    expect(today).toHaveBeenCalledTimes(2)
  })

  it('sem rede, mantém a última rota e a hora, e avisa', async () => {
    const clock = fakeClock(at(9, 0))
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['pending']))
      .mockRejectedValueOnce(new NetworkError())
    const { result } = await setup(today, clock)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(10, 0))
    await act(async () => result.current.refresh())

    await waitFor(() => expect(result.current.refreshError).not.toBeNull())
    expect(result.current.refreshing).toBe(false)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.updatedAt).toEqual(at(9, 0))
    expect(result.current.refreshError).toContain('Não foi possível conectar ao servidor')
  })

  it('uma atualização bem-sucedida limpa o aviso da anterior', async () => {
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['pending']))
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(routeWith(['pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => result.current.refresh())
    await waitFor(() => expect(result.current.refreshError).not.toBeNull())

    await act(async () => result.current.refresh())

    await waitFor(() => expect(result.current.refreshError).toBeNull())
  })

  it('sem rota hoje, também atualiza e traz a rota que apareceu', async () => {
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(routeWith(['pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('empty'))

    await act(async () => result.current.refresh())

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
  })
})

describe('useTodayRoute: gatilhos', () => {
  it('lê a rota ao abrir (o login leva a essa tela), uma vez só', async () => {
    const today: Today = jest.fn().mockResolvedValue(routeWith([]))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('empty'))
    expect(today).toHaveBeenCalledTimes(1)
  })

  it('ao voltar ao foreground com rede, relê a rota', async () => {
    const appState = mockAppState()
    const today: Today = jest.fn().mockResolvedValue(routeWith(['pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await appState.change('background')
    await appState.change('active')

    await waitFor(() => expect(today).toHaveBeenCalledTimes(2))
  })

  it('ao voltar ao foreground sem rede, não relê e mantém a rota e a hora', async () => {
    const appState = mockAppState()
    const clock = fakeClock(at(9, 0))
    const today: Today = jest.fn().mockResolvedValue(routeWith(['pending']))
    const { result } = await setup(today, { ...clock, connectivity: offline })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(11, 0))
    await appState.change('active')

    expect(today).toHaveBeenCalledTimes(1)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.updatedAt).toEqual(at(9, 0))
  })

  it('ir para segundo plano não relê', async () => {
    const appState = mockAppState()
    const today: Today = jest.fn().mockResolvedValue(routeWith(['pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await appState.change('background')
    await appState.change('inactive')

    expect(today).toHaveBeenCalledTimes(1)
  })

  it('se a leitura ao voltar falha, mantém a rota e a hora', async () => {
    const appState = mockAppState()
    const clock = fakeClock(at(9, 0))
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['pending']))
      .mockRejectedValueOnce(new NetworkError())
    const { result } = await setup(today, clock)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(11, 0))
    await appState.change('active')

    await waitFor(() => expect(result.current.refreshError).not.toBeNull())
    expect(result.current.state.status).toBe('ready')
    expect(result.current.updatedAt).toEqual(at(9, 0))
  })

  it('não lê em intervalo: o tempo passando sozinho não faz nova leitura', async () => {
    jest.useFakeTimers()
    const today: Today = jest.fn().mockResolvedValue(routeWith(['pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
    })

    expect(today).toHaveBeenCalledTimes(1)
  })
})

describe('useTodayRoute: Visita em andamento', () => {
  it('a atualização não troca a Visita em andamento', async () => {
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['in_progress', 'pending']))
      .mockResolvedValueOnce(routeWith(['pending', 'pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => result.current.refresh())

    await waitFor(() => expect(today).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(visitStatuses(result)).toEqual(['in_progress', 'pending'])
  })

  it('traz do servidor o que mudou nas outras Visitas e as Visitas novas', async () => {
    const today: Today = jest
      .fn()
      .mockResolvedValueOnce(routeWith(['in_progress', 'pending']))
      .mockResolvedValueOnce(routeWith(['in_progress', 'completed', 'pending']))
    const { result } = await setup(today)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => result.current.refresh())

    await waitFor(() => expect(result.current.refreshing).toBe(false))
    expect(visitStatuses(result)).toEqual(['in_progress', 'completed', 'pending'])
  })
})
