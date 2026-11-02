import type { LoginBody, Session } from '@axis/contracts'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createFakeAppData, type FakeAppData, sellerSession } from '@/hooks/fake-app-data'
import { SessionProvider } from '@/hooks/session'
import { WAKING_DELAY_MS } from '@/hooks/use-login'
import { ApiRequestError } from '@/services/api-client'
import { LoginScreen } from './login-screen'

async function renderLogin(login: (body: LoginBody) => Promise<Session> = jest.fn()) {
  const data: FakeAppData = createFakeAppData({ login })
  await render(
    <SessionProvider data={data}>
      <LoginScreen />
    </SessionProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeOnTheScreen())
  return data
}

async function typeCredentials(identifier: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('E-mail ou matrícula'), identifier)
  await fireEvent.changeText(screen.getByLabelText('Senha'), password)
}

describe('LoginScreen', () => {
  it('mostra os campos de e-mail ou matrícula e senha, e o botão Entrar', async () => {
    await renderLogin()
    expect(screen.getByRole('header', { name: 'Entrar' })).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail ou matrícula')).toBeOnTheScreen()
    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', true)
  })

  it('campos vazios mostram os erros do contrato e não chamam a API', async () => {
    const login = jest.fn()
    await renderLogin(login)

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Erro: Informe o e-mail ou a matrícula')).toBeOnTheScreen()
    expect(screen.getByText('Erro: Informe a senha')).toBeOnTheScreen()
    expect(login).not.toHaveBeenCalled()
  })

  it('login válido guarda a sessão do Vendedor', async () => {
    const login = jest.fn().mockResolvedValue(sellerSession())
    const data = await renderLogin(login)
    await typeCredentials('2001', 'axis-demo-2026')

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(async () => expect(await data.sessions.load()).toEqual(sellerSession()))
    expect(login).toHaveBeenCalledWith({ identifier: '2001', password: 'axis-demo-2026' })
  })

  it('credenciais inválidas aparecem como alerta acessível', async () => {
    const login = jest
      .fn()
      .mockRejectedValue(
        new ApiRequestError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail, matrícula ou senha incorretos'),
      )
    await renderLogin(login)
    await typeCredentials('2001', 'senha-errada')

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/E-mail, matrícula ou senha incorretos/)
    expect(alert).toHaveProp('accessibilityLiveRegion', 'assertive')
  })

  it('perfil que não é Vendedor vê que o app é do Vendedor', async () => {
    const login = jest.fn().mockResolvedValue(sellerSession({ role: 'coordinator' }))
    const data = await renderLogin(login)
    await typeCredentials('chefe@axis.test', 'axis-demo-2026')

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Este aplicativo é do Vendedor/)
    await expect(data.sessions.load()).resolves.toBeNull()
  })

  describe('carregando', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
    afterEach(() => jest.useRealTimers())

    it('mostra o loader, desabilita o botão e explica a demora quando a API está dormindo', async () => {
      await renderLogin(() => new Promise<Session>(() => undefined))
      await typeCredentials('2001', 'axis-demo-2026')

      await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

      expect(screen.getByText('Entrando…')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
      expect(screen.queryByText(/Acordando o servidor/)).not.toBeOnTheScreen()

      await act(async () => {
        await jest.advanceTimersByTimeAsync(WAKING_DELAY_MS)
      })

      expect(screen.getByText(/Acordando o servidor/)).toBeOnTheScreen()
      expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
    })
  })

  describe('URL da API (toque longo no logo)', () => {
    it('fica escondida até o toque longo no logo', async () => {
      await renderLogin()
      expect(screen.queryByLabelText('URL da API')).not.toBeOnTheScreen()

      await fireEvent(screen.getByLabelText('AXIS'), 'longPress')

      expect(screen.getByLabelText('URL da API')).toBeOnTheScreen()
      expect(screen.getByLabelText('URL da API')).toHaveDisplayValue('http://env.test')
    })

    it('guarda a URL nova no aparelho', async () => {
      const data = await renderLogin()
      await fireEvent(screen.getByLabelText('AXIS'), 'longPress')

      await fireEvent.changeText(
        screen.getByLabelText('URL da API'),
        'https://axis-api.onrender.com',
      )
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar URL da API' }))

      await waitFor(async () =>
        expect(await data.apiUrl.resolve()).toBe('https://axis-api.onrender.com'),
      )
    })

    it('recusa URL inválida com mensagem no campo', async () => {
      await renderLogin()
      await fireEvent(screen.getByLabelText('AXIS'), 'longPress')

      await fireEvent.changeText(screen.getByLabelText('URL da API'), 'localhost:3000')
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar URL da API' }))

      expect(
        await screen.findByText(
          'Erro: Informe uma URL completa, como https://axis-api.onrender.com',
        ),
      ).toBeOnTheScreen()
    })

    it('usar a do app apaga a URL guardada', async () => {
      const data = await renderLogin()
      await data.apiUrl.setOverride('http://10.0.0.5:3000')
      await fireEvent(screen.getByLabelText('AXIS'), 'longPress')
      await waitFor(() =>
        expect(screen.getByLabelText('URL da API')).toHaveDisplayValue('http://10.0.0.5:3000'),
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Usar a URL do app' }))

      await waitFor(async () => expect(await data.apiUrl.getOverride()).toBeNull())
    })
  })
})
