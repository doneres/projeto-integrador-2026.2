import type { SellerScoreSummary } from '@axis/contracts'
import { createFakeAppData, type FakeExtras, sellerSession } from '@test/fake-app-data'
import { scoreSummary } from '@test/score-fixtures'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import type { ScoreRepository } from '@/repositories/score-repository'
import { NetworkError } from '@/services/api-client'
import { createSendQueue } from '@/services/send-queue'
import { SessionProvider, useSession } from './session'
import { useSellerScore } from './use-seller-score'

type Read = jest.Mock<Promise<SellerScoreSummary>, []>

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

/** Repositório de Score falso, com cache por Vendedor como o de verdade. */
function fakeScores(read: Read, now: () => Date): ScoreRepository {
  const cache = new Map<string, { summary: SellerScoreSummary; readAt: Date }>()
  return {
    async read() {
      const summary = await read()
      cache.set(summary.sellerId, { summary, readAt: now() })
      return summary
    },
    cached: (sellerId) => cache.get(sellerId) ?? null,
  }
}

/** O hook vive no grupo autenticado do app: só renderiza depois que a sessão foi restaurada. */
function SignedIn({ children }: { children: ReactNode }) {
  const { state } = useSession()
  return state.status === 'signedIn' ? children : null
}

const wrapperFor =
  (data: ReturnType<typeof createFakeAppData>) =>
  ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>
      <SignedIn>{children}</SignedIn>
    </SessionProvider>
  )

async function setup(read: Read, extras: Pick<FakeExtras, 'connectivity'> = {}) {
  const clock = fakeClock(at(9, 0))
  const sendQueue = createSendQueue()
  const data = createFakeAppData(undefined, undefined, {
    ...extras,
    now: clock.now,
    sendQueue,
    scores: fakeScores(read, clock.now),
  })
  await data.sessions.save(sellerSession())
  const rendered = await renderHook(() => useSellerScore(), { wrapper: wrapperFor(data) })
  // O hook só monta quando a sessão é restaurada.
  await waitFor(() => expect(rendered.result.current).not.toBeNull())
  return { ...rendered, clock, data, queue: sendQueue }
}

/** Troca o AppState do React Native por um que o teste controla. */
function mockAppState() {
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

const offline = { isOnline: async () => false }

/** A fila de verdade será uma `SendQueueControl`; aqui o teste a empurra pelo `setStatus`. */
const drive = (queue: ReturnType<typeof createSendQueue>, status: 'idle' | 'pending' | 'error') =>
  act(async () => queue.setStatus(status))

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('useSellerScore: leitura do servidor', () => {
  it('lê o Score ao abrir e guarda a hora da leitura, lida do relógio', async () => {
    const summary = scoreSummary({ score: 84 })
    const read: Read = jest.fn().mockResolvedValue(summary)
    const { result } = await setup(read)

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    expect(result.current.state).toEqual({ status: 'ready', summary })
    expect(result.current.updatedAt).toEqual(at(9, 0))
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('falha na primeira leitura: erro e sem hora', async () => {
    const read: Read = jest.fn().mockRejectedValue(new NetworkError())
    const { result } = await setup(read)

    await waitFor(() => expect(result.current.state.status).toBe('error'))

    expect(result.current.updatedAt).toBeNull()
  })

  it('ao reabrir a tela, mostra o último valor do cache enquanto relê', async () => {
    const summary = scoreSummary({ score: 84 })
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(summary)
      .mockReturnValueOnce(new Promise(() => {}))
    const first = await setup(read)
    await waitFor(() => expect(first.result.current.state.status).toBe('ready'))
    await first.unmount()

    const second = await renderHook(() => useSellerScore(), { wrapper: wrapperFor(first.data) })
    await waitFor(() => expect(second.result.current).not.toBeNull())

    await waitFor(() => expect(second.result.current.state.status).toBe('ready'))
    expect(second.result.current.refreshing).toBe(true)
    expect(second.result.current.updatedAt).toEqual(at(9, 0))
  })

  it('se o Vendedor da sessão muda com a tela montada, o Score do anterior sai', async () => {
    const brunoId = '0198f2a0-7c1e-7000-8000-0000000000bb'
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary({ score: 84 }))
      .mockReturnValueOnce(new Promise(() => {}))
    const clock = fakeClock(at(9, 0))
    const data = createFakeAppData(undefined, undefined, {
      now: clock.now,
      scores: fakeScores(read, clock.now),
    })
    await data.sessions.save(sellerSession())
    const { result } = await renderHook(
      () => ({ score: useSellerScore(), session: useSession() }),
      { wrapper: wrapperFor(data) },
    )
    await waitFor(() => expect(result.current?.score.state.status).toBe('ready'))

    await act(async () => result.current.session.signIn(sellerSession({ id: brunoId })))

    expect(result.current.score.state).toEqual({ status: 'loading' })
    expect(result.current.score.updatedAt).toBeNull()
  })
})

describe('useSellerScore: fila de envio', () => {
  it('a fila esvaziando com sucesso relê o Score e traz o valor novo', async () => {
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary({ score: 60 }))
      .mockResolvedValueOnce(scoreSummary({ score: 72 }))
    const { result, queue, clock } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await drive(queue, 'pending')
    clock.set(at(9, 5))
    await drive(queue, 'idle')

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'ready',
        summary: scoreSummary({ score: 72 }),
      }),
    )
    expect(result.current.updatedAt).toEqual(at(9, 5))
  })

  it('a fila com pendência não relê', async () => {
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await drive(queue, 'pending')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('a fila em erro não relê, nem ao tentar de novo e falhar outra vez', async () => {
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await drive(queue, 'pending')
    await drive(queue, 'error')
    await drive(queue, 'pending')
    await drive(queue, 'error')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('a fila que se recupera do erro e envia tudo relê uma vez, só no fim', async () => {
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await drive(queue, 'pending')
    await drive(queue, 'error')
    await drive(queue, 'pending')
    expect(read).toHaveBeenCalledTimes(1)
    await drive(queue, 'idle')

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it('a fila esvaziando durante uma leitura em andamento descarta a leitura antiga', async () => {
    let finishOld: (summary: SellerScoreSummary) => void = () => {}
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary({ score: 60 }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve
        }),
      )
      .mockResolvedValueOnce(scoreSummary({ score: 72 }))
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => result.current.refresh())

    await drive(queue, 'pending')
    await drive(queue, 'idle')
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    await act(async () => finishOld(scoreSummary({ score: 60 })))

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'ready',
        summary: scoreSummary({ score: 72 }),
      }),
    )
  })

  it('para de ouvir a fila quando a tela sai', async () => {
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue, unmount } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await unmount()

    await drive(queue, 'pending')
    await drive(queue, 'idle')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('se a releitura depois da fila falha, mantém o valor e a hora, e avisa', async () => {
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary({ score: 60 }))
      .mockRejectedValueOnce(new NetworkError())
    const { result, queue, clock } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(10, 0))
    await drive(queue, 'pending')
    await drive(queue, 'idle')

    await waitFor(() => expect(result.current.refreshError).not.toBeNull())
    expect(result.current.state).toEqual({ status: 'ready', summary: scoreSummary({ score: 60 }) })
    expect(result.current.updatedAt).toEqual(at(9, 0))
  })
})

describe('useSellerScore: foreground', () => {
  it('ao voltar ao foreground com rede, relê o Score', async () => {
    const appState = mockAppState()
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await appState.change('background')
    await appState.change('active')

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it('ao voltar ao foreground sem rede, não relê e mantém o valor e a hora', async () => {
    const appState = mockAppState()
    const read: Read = jest.fn().mockResolvedValue(scoreSummary({ score: 84 }))
    const { result, clock } = await setup(read, { connectivity: offline })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(11, 0))
    await appState.change('active')

    expect(read).toHaveBeenCalledTimes(1)
    expect(result.current.updatedAt).toEqual(at(9, 0))
    expect(result.current.state).toEqual({ status: 'ready', summary: scoreSummary({ score: 84 }) })
  })

  it('ir para segundo plano não relê', async () => {
    const appState = mockAppState()
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await appState.change('background')
    await appState.change('inactive')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('voltar ao foreground com uma leitura já em andamento não abre outra', async () => {
    const appState = mockAppState()
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary())
      .mockReturnValue(new Promise(() => {}))
    const { result } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await appState.change('active')
    await appState.change('active')

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })
})

describe('useSellerScore: sem polling', () => {
  it('o tempo passando sozinho não faz nova leitura, com a fila ociosa, pendente ou em erro', async () => {
    jest.useFakeTimers()
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
    })
    await drive(queue, 'pending')
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
    })
    await drive(queue, 'error')
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
    })

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('com o relógio falso, a fila esvaziando relê no mesmo instante, sem esperar um intervalo', async () => {
    jest.useFakeTimers()
    const read: Read = jest.fn().mockResolvedValue(scoreSummary())
    const { result, queue } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await drive(queue, 'pending')
    await drive(queue, 'idle')

    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('useSellerScore: Atualizar', () => {
  it('refresh relê sem esconder o valor e troca a hora quando termina', async () => {
    let finish: (summary: SellerScoreSummary) => void = () => {}
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary({ score: 60 }))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
    const { result, clock } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    clock.set(at(9, 40))
    await act(async () => result.current.refresh())
    expect(result.current.refreshing).toBe(true)
    expect(result.current.state.status).toBe('ready')
    expect(result.current.updatedAt).toEqual(at(9, 0))

    await act(async () => finish(scoreSummary({ score: 90 })))
    expect(result.current.refreshing).toBe(false)
    expect(result.current.updatedAt).toEqual(at(9, 40))
  })

  it('uma atualização bem-sucedida limpa o aviso da anterior', async () => {
    const read: Read = jest
      .fn()
      .mockResolvedValueOnce(scoreSummary())
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(scoreSummary())
    const { result } = await setup(read)
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => result.current.refresh())
    await waitFor(() => expect(result.current.refreshError).not.toBeNull())

    await act(async () => result.current.refresh())

    await waitFor(() => expect(result.current.refreshError).toBeNull())
  })
})
