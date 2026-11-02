import type { LoginBody, Session } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ApiRequestError, NetworkError, RequestTimeoutError } from '@/services/api-client'
import { ApiUrlMissingError } from '@/services/api-url'
import { SessionProvider } from './session'
import { useLogin, WAKING_DELAY_MS } from './use-login'

async function setup(login: (body: LoginBody) => Promise<Session>) {
  const data = createFakeAppData({ login })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider data={data}>{children}</SessionProvider>
  )
  const hook = await renderHook(() => useLogin(), { wrapper })
  return { data, ...hook }
}

type Hook = Awaited<ReturnType<typeof setup>>['result']

async function fill(result: Hook, id: string, password: string) {
  await act(async () => {
    result.current.setIdentifier(id)
    result.current.setPassword(password)
  })
}

async function submit(result: Hook) {
  let outcome: Awaited<ReturnType<Hook['current']['submit']>> | undefined
  await act(async () => {
    outcome = await result.current.submit()
  })
  return outcome
}

describe('useLogin', () => {
  it('valida com o schema do contrato e não chama a API', async () => {
    const login = jest.fn()
    const { result } = await setup(login)

    const outcome = await submit(result)

    expect(login).not.toHaveBeenCalled()
    expect(result.current.fieldErrors).toEqual({
      identifier: 'Informe o e-mail ou a matrícula',
      password: 'Informe a senha',
    })
    expect(outcome).toEqual({ ok: false, focus: 'identifier' })
  })

  it('manda o foco para a senha quando só ela está vazia', async () => {
    const { result } = await setup(jest.fn())
    await fill(result, '2001', '')
    const outcome = await submit(result)
    expect(outcome).toEqual({ ok: false, focus: 'password' })
    expect(result.current.fieldErrors).toEqual({ password: 'Informe a senha' })
  })

  it('login válido de Vendedor guarda a sessão', async () => {
    const login = jest.fn().mockResolvedValue(sellerSession())
    const { result, data } = await setup(login)
    await fill(result, '  2001 ', 'axis-demo-2026')

    const outcome = await submit(result)

    expect(outcome).toEqual({ ok: true })
    expect(login).toHaveBeenCalledWith({ identifier: '2001', password: 'axis-demo-2026' })
    await expect(data.sessions.load()).resolves.toEqual(sellerSession())
    expect(result.current.status).toBe('idle')
    expect(result.current.formError).toBeNull()
  })

  it('credenciais inválidas mostram a mensagem da API e não guardam sessão', async () => {
    const login = jest
      .fn()
      .mockRejectedValue(
        new ApiRequestError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail, matrícula ou senha incorretos'),
      )
    const { result, data } = await setup(login)
    await fill(result, '2001', 'senha-errada')

    const outcome = await submit(result)

    expect(result.current.formError).toBe('E-mail, matrícula ou senha incorretos')
    expect(outcome).toEqual({ ok: false, focus: 'form' })
    expect(result.current.status).toBe('idle')
    await expect(data.sessions.load()).resolves.toBeNull()
  })

  it.each([
    ['Coordenador', 'coordinator'],
    ['Diretor', 'director'],
    ['Administrador', 'administrator'],
  ] as const)(
    'perfil %s recebe a mensagem de que o app é do Vendedor e não entra',
    async (_name, role) => {
      const login = jest.fn().mockResolvedValue(sellerSession({ role }))
      const { result, data } = await setup(login)
      await fill(result, 'chefe@axis.test', 'axis-demo-2026')

      await submit(result)

      expect(result.current.formError).toBe(
        'Este aplicativo é do Vendedor. Use o painel web para entrar com o seu perfil.',
      )
      await expect(data.sessions.load()).resolves.toBeNull()
    },
  )

  it('sem conexão explica que não alcançou o servidor', async () => {
    const { result } = await setup(jest.fn().mockRejectedValue(new NetworkError()))
    await fill(result, '2001', 'axis-demo-2026')
    await submit(result)
    expect(result.current.formError).toBe(
      'Não foi possível conectar ao servidor. Confira a conexão e a URL da API.',
    )
  })

  it('sem URL da API configurada manda o Vendedor ao toque longo no logo', async () => {
    const { result } = await setup(jest.fn().mockRejectedValue(new ApiUrlMissingError()))
    await fill(result, '2001', 'axis-demo-2026')
    await submit(result)
    expect(result.current.formError).toBe(
      'A URL da API não está configurada. Faça um toque longo no logo AXIS e informe o endereço.',
    )
  })

  it('estouro dos 90 s explica que o servidor não respondeu', async () => {
    const { result } = await setup(jest.fn().mockRejectedValue(new RequestTimeoutError()))
    await fill(result, '2001', 'axis-demo-2026')
    await submit(result)
    expect(result.current.formError).toBe(
      'O servidor não respondeu a tempo. Tente de novo em instantes.',
    )
  })

  it('limite de tentativas (429) mostra a mensagem da API', async () => {
    const error = new ApiRequestError(
      429,
      'MUITAS_TENTATIVAS',
      'Muitas tentativas de login. Tente de novo em instantes',
    )
    const { result } = await setup(jest.fn().mockRejectedValue(error))
    await fill(result, '2001', 'axis-demo-2026')
    await submit(result)
    expect(result.current.formError).toBe('Muitas tentativas de login. Tente de novo em instantes')
  })

  describe('API dormindo (Render Free)', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }))
    afterEach(() => jest.useRealTimers())

    it('mostra "acordando o servidor" se a resposta demora, e volta ao normal ao terminar', async () => {
      let finish: (session: Session) => void = () => undefined
      const login = jest.fn(
        () =>
          new Promise<Session>((resolve) => {
            finish = resolve
          }),
      )
      const { result } = await setup(login)
      await fill(result, '2001', 'axis-demo-2026')

      await act(async () => {
        void result.current.submit()
      })
      expect(result.current.status).toBe('submitting')

      await act(async () => {
        await jest.advanceTimersByTimeAsync(WAKING_DELAY_MS - 1)
      })
      expect(result.current.status).toBe('submitting')

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1)
      })
      expect(result.current.status).toBe('waking')

      await act(async () => {
        finish(sellerSession())
      })
      await waitFor(() => expect(result.current.status).toBe('idle'))
    })

    it('ignora um segundo envio enquanto o primeiro não terminou', async () => {
      const login = jest.fn(() => new Promise<Session>(() => undefined))
      const { result } = await setup(login)
      await fill(result, '2001', 'axis-demo-2026')

      await act(async () => {
        void result.current.submit()
      })
      await act(async () => {
        await result.current.submit()
      })

      expect(login).toHaveBeenCalledTimes(1)
    })
  })
})
