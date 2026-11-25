import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INTERVALO_CONSULTA_VIVA_MS, opcoesDeConsultaViva } from './query-client'

// Comportamento das consultas "vivas" (#61): exercitado pelo efeito (quantas buscas acontecem),
// com relógio falso, sem olhar a configuração por dentro.
//
// O TanStack Query desliga o refetchInterval quando não há `window` (trata como servidor). Os
// testes rodam em Node, então um `window` mínimo é criado antes de a biblioteca ser carregada.
vi.hoisted(() => {
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
})

describe('consulta viva', () => {
  let cliente: QueryClient

  beforeEach(() => {
    vi.useFakeTimers()
    focusManager.setFocused(true)
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // No app quem faz isso é o QueryClientProvider: liga o refetch ao voltar o foco.
    cliente.mount()
  })

  afterEach(() => {
    cliente.unmount()
    cliente.clear()
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  })

  function observar(buscar: () => Promise<number>) {
    const observador = new QueryObserver(cliente, {
      ...opcoesDeConsultaViva,
      queryKey: ['viva'],
      queryFn: buscar,
    })
    const cancelar = observador.subscribe(() => {})
    return { observador, cancelar }
  }

  it('repete a busca a cada 30 s com a aba visível', async () => {
    const buscar = vi.fn().mockResolvedValue(1)
    const { cancelar } = observar(buscar)
    await vi.advanceTimersByTimeAsync(0)
    expect(buscar).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_VIVA_MS)
    expect(buscar).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_VIVA_MS)
    expect(buscar).toHaveBeenCalledTimes(3)
    cancelar()
  })

  it('não repete com a aba escondida e busca na hora ao voltar o foco', async () => {
    const buscar = vi.fn().mockResolvedValue(1)
    const { cancelar } = observar(buscar)
    await vi.advanceTimersByTimeAsync(0)
    expect(buscar).toHaveBeenCalledTimes(1)

    focusManager.setFocused(false)
    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_VIVA_MS * 3)
    expect(buscar).toHaveBeenCalledTimes(1)

    focusManager.setFocused(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(buscar).toHaveBeenCalledTimes(2)
    cancelar()
  })

  it('com a API falhando mantém o último dado e volta a atualizar quando ela volta', async () => {
    const buscar = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('fora do ar'))
      .mockResolvedValue(2)
    const { observador, cancelar } = observar(buscar)
    await vi.advanceTimersByTimeAsync(0)
    expect(observador.getCurrentResult().data).toBe(1)
    const primeiraAtualizacao = observador.getCurrentResult().dataUpdatedAt

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_VIVA_MS)
    const comFalha = observador.getCurrentResult()
    expect(comFalha.isError).toBe(true)
    expect(comFalha.data).toBe(1)
    expect(comFalha.dataUpdatedAt).toBe(primeiraAtualizacao)

    await vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_VIVA_MS)
    const recuperada = observador.getCurrentResult()
    expect(recuperada.isError).toBe(false)
    expect(recuperada.data).toBe(2)
    cancelar()
  })
})
