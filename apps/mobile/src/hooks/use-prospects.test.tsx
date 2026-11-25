import type { Prospect } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { prospect } from '@test/prospect-fixtures'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { NetworkError, RequestTimeoutError } from '@/services/api-client'
import { ApiUrlMissingError } from '@/services/api-url'
import { SessionProvider } from './session'
import { useProspects } from './use-prospects'

async function setup(list: () => Promise<Prospect[]>) {
  const data = createFakeAppData(undefined, undefined, { prospects: { list } })
  await data.sessions.save(sellerSession())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>{children}</SessionProvider>
  )
  return renderHook(() => useProspects(), { wrapper })
}

describe('useProspects', () => {
  it('carrega enquanto a leitura não termina e depois entrega as Prospecções', async () => {
    const prospects = [prospect(1, 'pending_approval'), prospect(2, 'active')]
    let finish: (value: Prospect[]) => void = () => {}
    const { result } = await setup(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )

    expect(result.current.state).toEqual({ status: 'loading' })
    await act(async () => finish(prospects))
    expect(result.current.state).toEqual({ status: 'ready', prospects })
  })

  it('sem Prospecções, o estado é vazio', async () => {
    const { result } = await setup(() => Promise.resolve([]))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'empty' }))
  })

  it.each([
    ['sem conexão', new NetworkError(), 'Não foi possível conectar ao servidor'],
    ['prazo', new RequestTimeoutError(), 'O servidor não respondeu a tempo'],
    ['URL da API ausente', new ApiUrlMissingError(), 'A URL da API não está configurada'],
    ['resposta inválida', new Error('zod'), 'Não foi possível carregar as prospecções'],
  ])('%s vira uma mensagem de erro', async (_name, error, message) => {
    const { result } = await setup(() => Promise.reject(error))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    const { state } = result.current
    expect(state.status === 'error' && state.message).toContain(message)
  })

  it('tentar de novo volta a carregar e refaz a leitura', async () => {
    const list = jest
      .fn<Promise<Prospect[]>, []>()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce([prospect(1, 'pending_approval')])
    const { result } = await setup(list)
    await waitFor(() => expect(result.current.state.status).toBe('error'))

    await act(async () => result.current.retry())

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('uma resposta antiga não sobrescreve a da nova tentativa', async () => {
    let resolveFirst: (value: Prospect[]) => void = () => {}
    const list = jest
      .fn<Promise<Prospect[]>, []>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValueOnce([prospect(1, 'active')])
    const { result } = await setup(list)

    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => resolveFirst([]))

    expect(result.current.state.status).toBe('ready')
  })
})
