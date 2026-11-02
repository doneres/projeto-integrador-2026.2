import type { Session } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { act, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { SessionProvider, useSession } from './session'

function Probe() {
  const { state, signIn, signOut } = useSession()
  return (
    <>
      <Text>{`status:${state.status}`}</Text>
      {state.status === 'signedIn' ? <Text>{`user:${state.session.user.name}`}</Text> : null}
      <Text onPress={() => signIn(sellerSession())}>entrar</Text>
      <Text onPress={() => signOut()}>sair</Text>
    </>
  )
}

async function renderProvider(data = createFakeAppData(), now?: () => Date) {
  await render(
    <SessionProvider data={data} now={now}>
      <Probe />
    </SessionProvider>,
  )
  return data
}

describe('SessionProvider', () => {
  it('começa carregando e termina sem sessão quando não há nada guardado', async () => {
    await renderProvider()
    await waitFor(() => expect(screen.getByText('status:signedOut')).toBeOnTheScreen())
  })

  it('restaura a sessão guardada no aparelho', async () => {
    const data = createFakeAppData()
    await data.sessions.save(sellerSession())
    await renderProvider(data)
    await waitFor(() => expect(screen.getByText('status:signedIn')).toBeOnTheScreen())
    expect(screen.getByText('user:Ana Souza')).toBeOnTheScreen()
  })

  it('entrar guarda a sessão no armazenamento', async () => {
    const data = await renderProvider()
    await waitFor(() => expect(screen.getByText('status:signedOut')).toBeOnTheScreen())

    await act(async () => screen.getByText('entrar').props.onPress())

    expect(screen.getByText('status:signedIn')).toBeOnTheScreen()
    await expect(data.sessions.load()).resolves.toEqual(sellerSession())
  })

  it('sair apaga o token', async () => {
    const data = createFakeAppData()
    await data.sessions.save(sellerSession())
    await renderProvider(data)
    await waitFor(() => expect(screen.getByText('status:signedIn')).toBeOnTheScreen())

    await act(async () => screen.getByText('sair').props.onPress())

    expect(screen.getByText('status:signedOut')).toBeOnTheScreen()
    await expect(data.sessions.load()).resolves.toBeNull()
  })

  it('um 401 da API limpa a sessão', async () => {
    const data = createFakeAppData()
    await data.sessions.save(sellerSession())
    await renderProvider(data)
    await waitFor(() => expect(screen.getByText('status:signedIn')).toBeOnTheScreen())

    await act(async () => data.emitUnauthorized())

    expect(screen.getByText('status:signedOut')).toBeOnTheScreen()
    await expect(data.sessions.load()).resolves.toBeNull()
  })

  it('falha ao ler o armazenamento seguro não trava o app na tela de carregamento', async () => {
    const data = createFakeAppData()
    data.sessions.load = jest.fn().mockRejectedValue(new Error('keystore indisponível'))
    await renderProvider(data)
    await waitFor(() => expect(screen.getByText('status:signedOut')).toBeOnTheScreen())
  })

  it('sair volta ao login mesmo se apagar o token falhar', async () => {
    const data = createFakeAppData()
    await data.sessions.save(sellerSession())
    await renderProvider(data)
    await waitFor(() => expect(screen.getByText('status:signedIn')).toBeOnTheScreen())
    data.sessions.clear = jest.fn().mockRejectedValue(new Error('keystore indisponível'))

    await act(async () => screen.getByText('sair').props.onPress())

    expect(screen.getByText('status:signedOut')).toBeOnTheScreen()
  })

  describe('validade de 8 horas', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
    afterEach(() => jest.useRealTimers())

    it('volta ao login quando a sessão vence com o app aberto', async () => {
      const session: Session = { ...sellerSession(), expiresAt: '2026-11-02T20:00:00.000Z' }
      jest.setSystemTime(new Date('2026-11-02T12:00:00.000Z'))
      const data = createFakeAppData()
      await data.sessions.save(session)
      await renderProvider(data, () => new Date())
      await waitFor(() => expect(screen.getByText('status:signedIn')).toBeOnTheScreen())

      await act(async () => {
        await jest.advanceTimersByTimeAsync(8 * 60 * 60 * 1000)
      })

      expect(screen.getByText('status:signedOut')).toBeOnTheScreen()
      await expect(data.sessions.load()).resolves.toBeNull()
    })
  })
})
