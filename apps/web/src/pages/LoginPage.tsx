import { type DadosLogin, loginSchema, PERFIS_DO_PAINEL } from '@axis/contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { useLogin } from '../features/auth/queries'
import { mensagemDeErro } from '../lib/erros'
import { iniciarSessao, sessaoValida, useSessao } from '../lib/sessao'

export function LoginPage() {
  const sessao = useSessao()
  const local = useLocation()
  const login = useLogin()
  const [aviso, setAviso] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosLogin>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identificador: '', senha: '' },
  })

  const voltarPara = (local.state as { voltarPara?: string } | null)?.voltarPara ?? '/'
  if (sessaoValida(sessao)) {
    return <Navigate to={voltarPara} replace />
  }

  const entrar = handleSubmit((dados) => {
    setAviso(null)
    login.mutate(dados, {
      onSuccess: (novaSessao) => {
        if (!PERFIS_DO_PAINEL.includes(novaSessao.usuario.perfil)) {
          setAviso('Seu perfil usa o AXIS pelo app do vendedor. O painel web é para a gestão.')
          return
        }
        iniciarSessao(novaSessao)
      },
    })
  })

  const mensagem = aviso ?? (login.isError ? mensagemDeErro(login.error) : null)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <section
        aria-labelledby="titulo-login"
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-8"
      >
        <h1 id="titulo-login" className="text-3xl font-bold">
          AXIS
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Painel de gestão. Entre com sua conta corporativa.
        </p>
        <form onSubmit={entrar} noValidate className="mt-6 flex flex-col gap-4">
          <Campo
            rotulo="E-mail ou matrícula"
            autoComplete="username"
            placeholder="nome@empresa.com ou nº de registro"
            erro={errors.identificador?.message}
            {...register('identificador')}
          />
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="Mínimo de 8 caracteres"
            erro={errors.senha?.message}
            {...register('senha')}
          />
          {mensagem && (
            <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {mensagem}
            </p>
          )}
          <Botao type="submit" disabled={login.isPending}>
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </Botao>
        </form>
        <p className="mt-4 text-xs text-text-muted">
          Esqueceu a senha? Fale com o administrador do sistema.
        </p>
      </section>
    </main>
  )
}
