import {
  type Role,
  type UserFilters,
  type UserWithCoordinator,
  userFiltersSchema,
} from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { IndicadorDeFrescor } from '../components/ui/IndicadorDeFrescor'
import {
  type ErrosFormularioUsuario,
  type ErrosRedefinicaoSenha,
  validarCriacaoUsuario,
  validarEdicaoUsuario,
  validarRedefinicaoSenha,
} from '../features/usuarios/formulario'
import {
  useAlterarStatusUsuario,
  useCoordenadores,
  useRedefinirSenha,
  useSalvarUsuario,
  useUsuarios,
} from '../features/usuarios/queries'
import { ApiError } from '../lib/api'
import { mensagemDeErro } from '../lib/erros'
import { useSessao } from '../lib/sessao'

const POR_PAGINA = 10

const ROTULOS_PERFIL: Record<Role, string> = {
  administrator: 'Administrador',
  director: 'Diretor',
  coordinator: 'Coordenador',
  seller: 'Vendedor',
}

const OPCOES_PERFIL: ReadonlyArray<readonly [string, string]> = [
  ['seller', 'Vendedor'],
  ['coordinator', 'Coordenador'],
  ['director', 'Diretor'],
  ['administrator', 'Administrador'],
]

const OPCOES_FILTRO_PERFIL: ReadonlyArray<readonly [string, string]> = [
  ['', 'Todos os perfis'],
  ['seller', 'Vendedores'],
  ['coordinator', 'Coordenadores'],
  ['director', 'Diretores'],
  ['administrator', 'Administradores'],
]

const OPCOES_FILTRO_STATUS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Todos os status'],
  ['true', 'Ativos'],
  ['false', 'Desativados'],
]

const OPCOES_ORDENACAO: ReadonlyArray<readonly [string, string]> = [
  ['name', 'Nome'],
  ['email', 'E-mail'],
  ['registration', 'Matrícula'],
  ['role', 'Perfil'],
]

const OPCOES_DIRECAO: ReadonlyArray<readonly [string, string]> = [
  ['asc', 'Crescente (A-Z)'],
  ['desc', 'Decrescente (Z-A)'],
]

type ConfirmacaoStatus = {
  id: string
  nome: string
  novoStatus: boolean
}

type EstadoFormulario = {
  aberto: boolean
  id?: string
  name: string
  email: string
  registration: string
  role: Role
  coordinatorId: string
  password?: string
  erros: ErrosFormularioUsuario
}

const ESTADO_FORMULARIO_INICIAL: EstadoFormulario = {
  aberto: false,
  name: '',
  email: '',
  registration: '',
  role: 'seller',
  coordinatorId: '',
  password: '',
  erros: {},
}

type EstadoRedefinicaoSenha = {
  aberto: boolean
  id: string
  nome: string
  newPassword: string
  confirmPassword: string
  erros: ErrosRedefinicaoSenha
}

const ESTADO_REDEFINICAO_INICIAL: EstadoRedefinicaoSenha = {
  aberto: false,
  id: '',
  nome: '',
  newPassword: '',
  confirmPassword: '',
  erros: {},
}

function lerFiltros(parametros: URLSearchParams): UserFilters {
  const entradas = Object.fromEntries(parametros)
  const resultado = userFiltersSchema.safeParse({
    ...entradas,
    active: entradas.active === '' ? undefined : entradas.active,
    perPage: POR_PAGINA,
  })
  return resultado.success ? resultado.data : userFiltersSchema.parse({ perPage: POR_PAGINA })
}

export function UsuariosPage() {
  const sessao = useSessao()
  const eAdmin = sessao?.user.role === 'administrator'

  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)

  const usuarios = useUsuarios(filtros)
  const coordenadores = useCoordenadores()
  const salvarUsuario = useSalvarUsuario()
  const alterarStatus = useAlterarStatusUsuario()
  const redefinirSenha = useRedefinirSenha()

  const [formulario, setFormulario] = useState<EstadoFormulario>(ESTADO_FORMULARIO_INICIAL)
  const [confirmacaoStatus, setConfirmacaoStatus] = useState<ConfirmacaoStatus | null>(null)
  const [redefinicao, setRedefinicao] = useState<EstadoRedefinicaoSenha>(ESTADO_REDEFINICAO_INICIAL)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)

  function aplicarFiltros(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(parametros)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) {
        novos.set(chave, valor)
      } else {
        novos.delete(chave)
      }
    }
    novos.delete('page')
    setParametros(novos)
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicarFiltros({
      search: String(dados.get('search') ?? '').trim(),
      role: String(dados.get('role') ?? '').trim(),
      active: String(dados.get('active') ?? '').trim(),
      sortBy: String(dados.get('sortBy') ?? 'name').trim(),
      order: String(dados.get('order') ?? 'asc').trim(),
    })
  }

  function limparFiltros() {
    setParametros(new URLSearchParams())
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('page', String(pagina))
    setParametros(novos)
  }

  function abrirNovo() {
    const primeiroCoordenadorId = coordenadores.data?.items[0]?.id ?? ''
    setFormulario({
      ...ESTADO_FORMULARIO_INICIAL,
      aberto: true,
      coordinatorId: primeiroCoordenadorId,
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function abrirEditar(u: UserWithCoordinator) {
    setFormulario({
      aberto: true,
      id: u.id,
      name: u.name,
      email: u.email,
      registration: u.registration,
      role: u.role,
      coordinatorId: u.coordinatorId ?? coordenadores.data?.items[0]?.id ?? '',
      password: '',
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function fecharFormulario() {
    setFormulario(ESTADO_FORMULARIO_INICIAL)
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroOperacao(null)

    if (formulario.id) {
      const { dados, erros } = validarEdicaoUsuario({
        name: formulario.name,
        email: formulario.email,
        registration: formulario.registration,
        role: formulario.role,
        coordinatorId: formulario.coordinatorId,
      })
      if (!dados || Object.keys(erros).length > 0) {
        setFormulario((f) => ({ ...f, erros }))
        return
      }

      salvarUsuario.mutate(dados, {
        onSuccess: (salvo) => {
          fecharFormulario()
          setMensagemSucesso(`Usuário "${salvo.name}" atualizado com sucesso!`)
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.codigo === 'EMAIL_JA_CADASTRADO') {
              setFormulario((f) => ({
                ...f,
                erros: { ...f.erros, email: 'Este e-mail já está em uso.' },
              }))
              return
            }
            if (err.codigo === 'MATRICULA_JA_CADASTRADA') {
              setFormulario((f) => ({
                ...f,
                erros: { ...f.erros, registration: 'Esta matrícula já está cadastrada.' },
              }))
              return
            }
            if (err.codigo === 'COORDENADOR_COM_VENDEDORES') {
              setFormulario((f) => ({
                ...f,
                erros: {
                  ...f.erros,
                  role: 'Não é possível alterar o perfil de um coordenador que possui vendedores vinculados.',
                },
              }))
              return
            }
          }
          setErroOperacao(mensagemDeErro(err))
        },
      })
    } else {
      const { dados, erros } = validarCriacaoUsuario({
        name: formulario.name,
        email: formulario.email,
        registration: formulario.registration,
        role: formulario.role,
        coordinatorId: formulario.coordinatorId,
        password: formulario.password,
      })
      if (!dados || Object.keys(erros).length > 0) {
        setFormulario((f) => ({ ...f, erros }))
        return
      }

      salvarUsuario.mutate(dados, {
        onSuccess: (salvo) => {
          fecharFormulario()
          setMensagemSucesso(`Usuário "${salvo.name}" cadastrado com sucesso!`)
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.codigo === 'EMAIL_JA_CADASTRADO') {
              setFormulario((f) => ({
                ...f,
                erros: { ...f.erros, email: 'Este e-mail já está em uso.' },
              }))
              return
            }
            if (err.codigo === 'MATRICULA_JA_CADASTRADA') {
              setFormulario((f) => ({
                ...f,
                erros: { ...f.erros, registration: 'Esta matrícula já está cadastrada.' },
              }))
              return
            }
          }
          setErroOperacao(mensagemDeErro(err))
        },
      })
    }
  }

  function confirmarMudancaStatus() {
    if (!confirmacaoStatus) return
    alterarStatus.mutate(
      { id: confirmacaoStatus.id, active: confirmacaoStatus.novoStatus },
      {
        onSuccess: (atualizado) => {
          setConfirmacaoStatus(null)
          setMensagemSucesso(
            atualizado.active
              ? `Conta de "${atualizado.name}" reativada com sucesso.`
              : `Conta de "${atualizado.name}" desativada. O usuário teve seu acesso bloqueado.`,
          )
        },
        onError: (err) => {
          setErroOperacao(mensagemDeErro(err))
          setConfirmacaoStatus(null)
        },
      },
    )
  }

  function abrirRedefinicaoSenha(u: UserWithCoordinator) {
    setRedefinicao({
      aberto: true,
      id: u.id,
      nome: u.name,
      newPassword: '',
      confirmPassword: '',
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function fecharRedefinicaoSenha() {
    setRedefinicao(ESTADO_REDEFINICAO_INICIAL)
  }

  function submeterRedefinicaoSenha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroOperacao(null)

    const { dados, erros } = validarRedefinicaoSenha({
      newPassword: redefinicao.newPassword,
      confirmPassword: redefinicao.confirmPassword,
    })

    if (!dados || Object.keys(erros).length > 0) {
      setRedefinicao((r) => ({ ...r, erros }))
      return
    }

    redefinirSenha.mutate(
      { id: redefinicao.id, newPassword: dados.newPassword },
      {
        onSuccess: () => {
          const nomeUsuario = redefinicao.nome
          fecharRedefinicaoSenha()
          setMensagemSucesso(`Senha do usuário "${nomeUsuario}" redefinida com sucesso!`)
        },
        onError: (err) => {
          setErroOperacao(mensagemDeErro(err))
        },
      },
    )
  }

  const opcoesCoordenadores: ReadonlyArray<readonly [string, string]> = [
    ['', 'Selecione um coordenador...'],
    ...(coordenadores.data?.items ?? []).map((c) => [c.id, `${c.name} (${c.email})`] as const),
  ]

  const pagina = usuarios.data
  const primeiro = pagina ? (pagina.page - 1) * pagina.perPage + 1 : 0
  const ultimo = pagina ? primeiro + pagina.items.length - 1 : 0
  const temFiltrosAtivos = Boolean(
    filtros.search ||
      filtros.role ||
      filtros.active !== undefined ||
      filtros.sortBy !== 'name' ||
      filtros.order !== 'asc',
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários e Perfis</h1>
            <p className="text-sm text-text-muted">
              Gestão de contas, vinculação de vendedores a coordenadores e redefinição de senhas
              (RF01, RF02, RF03).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <IndicadorDeFrescor
              atualizadoEm={usuarios.dataUpdatedAt}
              atualizando={usuarios.isFetching}
              comErro={Boolean(usuarios.error)}
              onAtualizar={() => usuarios.refetch()}
            />
            {eAdmin && (
              <Botao onClick={abrirNovo} disabled={formulario.aberto}>
                + Novo usuário
              </Botao>
            )}
          </div>
        </div>

        {!eAdmin && (
          <div
            role="status"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>Modo somente leitura:</strong> Você está conectado com um perfil sem permissão
            de gestão. Apenas o Administrador pode cadastrar contas, editar perfis, alterar status e
            redefinir senhas.
          </div>
        )}

        {mensagemSucesso && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <span>{mensagemSucesso}</span>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => setMensagemSucesso(null)}
            >
              Fechar
            </button>
          </div>
        )}

        {erroOperacao && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            <span>{erroOperacao}</span>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => setErroOperacao(null)}
            >
              Fechar
            </button>
          </div>
        )}
      </header>

      {/* Formulário Modal de Criação / Edição de Usuário */}
      {formulario.aberto && (
        <section
          aria-label={formulario.id ? 'Editar usuário' : 'Novo usuário'}
          className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-bold">
              {formulario.id ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
            </h2>
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text"
              onClick={fecharFormulario}
            >
              ✕ Cancelar
            </button>
          </div>

          <form onSubmit={salvar} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo
                rotulo="Nome completo *"
                name="name"
                value={formulario.name}
                onChange={(e) =>
                  setFormulario((f) => ({
                    ...f,
                    name: e.target.value,
                    erros: { ...f.erros, name: undefined },
                  }))
                }
                erro={formulario.erros.name}
                placeholder="Ex.: Alice Rocha"
                required
              />

              <Campo
                rotulo="E-mail *"
                type="email"
                name="email"
                value={formulario.email}
                onChange={(e) =>
                  setFormulario((f) => ({
                    ...f,
                    email: e.target.value,
                    erros: { ...f.erros, email: undefined },
                  }))
                }
                erro={formulario.erros.email}
                placeholder="alice@axis.example"
                required
              />

              <Campo
                rotulo="Matrícula *"
                name="registration"
                value={formulario.registration}
                onChange={(e) =>
                  setFormulario((f) => ({
                    ...f,
                    registration: e.target.value,
                    erros: { ...f.erros, registration: undefined },
                  }))
                }
                erro={formulario.erros.registration}
                placeholder="Ex.: 4001"
                required
              />

              <CampoSelecao
                rotulo="Perfil de acesso *"
                name="role"
                value={formulario.role}
                onChange={(e) =>
                  setFormulario((f) => ({
                    ...f,
                    role: e.target.value as Role,
                    erros: { ...f.erros, role: undefined },
                  }))
                }
                opcoes={OPCOES_PERFIL}
                erro={formulario.erros.role}
                required
              />
            </div>

            {/* Vínculo de coordenador: obrigatório para vendedor; escondido para outros */}
            {formulario.role === 'seller' && (
              <div className="rounded-md border border-border bg-surface-muted/40 p-4">
                <CampoSelecao
                  rotulo="Coordenador responsável (Equipe) *"
                  name="coordinatorId"
                  value={formulario.coordinatorId}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      coordinatorId: e.target.value,
                      erros: { ...f.erros, coordinatorId: undefined },
                    }))
                  }
                  opcoes={opcoesCoordenadores}
                  erro={formulario.erros.coordinatorId}
                  dica="O vendedor responderá à equipe deste coordenador."
                  required
                />
              </div>
            )}

            {/* Senha inicial opcional apenas no cadastro de nova conta */}
            {!formulario.id && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Campo
                  rotulo="Senha inicial (opcional)"
                  type="password"
                  name="password"
                  value={formulario.password ?? ''}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      password: e.target.value,
                      erros: { ...f.erros, password: undefined },
                    }))
                  }
                  erro={formulario.erros.password}
                  dica="Mínimo 6 caracteres. Se omitida, usará a senha padrão do ambiente."
                  placeholder="••••••"
                />
              </div>
            )}

            <div className="mt-2 flex items-center justify-end gap-3 border-t border-border pt-4">
              <Botao type="button" variante="secundario" onClick={fecharFormulario}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={salvarUsuario.isPending}>
                {salvarUsuario.isPending
                  ? 'Salvando...'
                  : formulario.id
                    ? 'Salvar Alterações'
                    : 'Cadastrar Usuário'}
              </Botao>
            </div>
          </form>
        </section>
      )}

      {/* Modal de Redefinição de Senha */}
      {redefinicao.aberto && (
        <section
          aria-label={`Redefinir senha de ${redefinicao.nome}`}
          className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold">Redefinir Senha</h2>
              <p className="text-sm text-text-muted">
                Usuário: <strong>{redefinicao.nome}</strong> (RF03)
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text"
              onClick={fecharRedefinicaoSenha}
            >
              ✕ Cancelar
            </button>
          </div>

          <form onSubmit={submeterRedefinicaoSenha} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo
                rotulo="Nova senha *"
                type="password"
                name="newPassword"
                value={redefinicao.newPassword}
                onChange={(e) =>
                  setRedefinicao((r) => ({
                    ...r,
                    newPassword: e.target.value,
                    erros: { ...r.erros, newPassword: undefined },
                  }))
                }
                erro={redefinicao.erros.newPassword}
                dica="Deve ter entre 6 e 128 caracteres."
                placeholder="••••••"
                required
              />

              <Campo
                rotulo="Confirmar nova senha *"
                type="password"
                name="confirmPassword"
                value={redefinicao.confirmPassword}
                onChange={(e) =>
                  setRedefinicao((r) => ({
                    ...r,
                    confirmPassword: e.target.value,
                    erros: { ...r.erros, confirmPassword: undefined },
                  }))
                }
                erro={redefinicao.erros.confirmPassword}
                placeholder="••••••"
                required
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 border-t border-border pt-4">
              <Botao type="button" variante="secundario" onClick={fecharRedefinicaoSenha}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={redefinirSenha.isPending}>
                {redefinirSenha.isPending ? 'Redefinindo...' : 'Salvar Nova Senha'}
              </Botao>
            </div>
          </form>
        </section>
      )}

      {/* Modal de Confirmação de Mudança de Status */}
      {confirmacaoStatus && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmacao-status"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
            <h2 id="titulo-confirmacao-status" className="text-lg font-bold">
              {confirmacaoStatus.novoStatus ? 'Reativar conta' : 'Desativar conta'}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {confirmacaoStatus.novoStatus
                ? `Tem certeza que deseja reativar a conta de "${confirmacaoStatus.nome}"? O usuário voltará a ter permissão de login no sistema.`
                : `Tem certeza que deseja desativar a conta de "${confirmacaoStatus.nome}"? O usuário será desconectado e impedido de autenticar.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setConfirmacaoStatus(null)}
                disabled={alterarStatus.isPending}
              >
                Cancelar
              </Botao>
              <Botao
                type="button"
                onClick={confirmarMudancaStatus}
                disabled={alterarStatus.isPending}
              >
                {alterarStatus.isPending
                  ? 'Processando...'
                  : confirmacaoStatus.novoStatus
                    ? 'Confirmar Reativação'
                    : 'Confirmar Desativação'}
              </Botao>
            </div>
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <section aria-label="Filtros de usuários" className="rounded-lg border border-border p-4">
        <form onSubmit={buscar} className="grid grid-cols-1 gap-3 md:grid-cols-6 items-end">
          <div className="md:col-span-2">
            <Campo
              rotulo="Buscar por nome, e-mail ou matrícula"
              name="search"
              defaultValue={filtros.search ?? ''}
              placeholder="Digite o termo e pressione Buscar..."
            />
          </div>

          <div>
            <CampoSelecao
              rotulo="Perfil"
              name="role"
              defaultValue={filtros.role ?? ''}
              opcoes={OPCOES_FILTRO_PERFIL}
            />
          </div>

          <div>
            <CampoSelecao
              rotulo="Status"
              name="active"
              defaultValue={filtros.active === undefined ? '' : filtros.active ? 'true' : 'false'}
              opcoes={OPCOES_FILTRO_STATUS}
            />
          </div>

          <div>
            <CampoSelecao
              rotulo="Ordenar por"
              name="sortBy"
              defaultValue={filtros.sortBy ?? 'name'}
              opcoes={OPCOES_ORDENACAO}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <CampoSelecao
                rotulo="Ordem"
                name="order"
                defaultValue={filtros.order ?? 'asc'}
                opcoes={OPCOES_DIRECAO}
              />
            </div>
            <Botao type="submit" className="self-end">
              Buscar
            </Botao>
          </div>
        </form>

        {temFiltrosAtivos && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
            <span className="text-text-muted">Filtros aplicados.</span>
            <button
              type="button"
              onClick={limparFiltros}
              className="font-medium text-brand hover:underline"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </section>

      {/* Listagem de Usuários */}
      <section aria-label="Lista de usuários" className="flex flex-col gap-3">
        {usuarios.isLoading ? (
          <p className="text-sm text-text-muted">Carregando usuários...</p>
        ) : usuarios.isError ? (
          <div
            role="alert"
            className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            Não foi possível carregar os usuários: {mensagemDeErro(usuarios.error)}
          </div>
        ) : !pagina || pagina.items.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center text-sm text-text-muted">
            Nenhum usuário encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-xs font-semibold uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nome
                  </th>
                  <th scope="col" className="px-4 py-3">
                    E-mail
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Matrícula
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Perfil
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Coordenador / Equipe
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  {eAdmin && (
                    <th scope="col" className="px-4 py-3 text-right">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagina.items.map((u) => {
                  const eProprioUsuario = sessao?.user.id === u.id
                  return (
                    <tr key={u.id} className="hover:bg-surface-muted/20">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {eProprioUsuario && (
                          <span className="ml-2 text-xs font-normal text-text-muted">(você)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-xs">{u.registration}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === 'administrator'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : u.role === 'director'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : u.role === 'coordinator'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {ROTULOS_PERFIL[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {u.role === 'seller' ? (
                          u.coordinatorName ? (
                            <span className="font-medium text-text">{u.coordinatorName}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">Não vinculado</span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      {eAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-brand hover:underline"
                              onClick={() => abrirEditar(u)}
                            >
                              Editar
                            </button>
                            <span className="text-border">|</span>
                            <button
                              type="button"
                              className={`text-xs font-medium ${
                                eProprioUsuario
                                  ? 'cursor-not-allowed text-text-muted opacity-50'
                                  : u.active
                                    ? 'text-rose-600 hover:underline dark:text-rose-400'
                                    : 'text-emerald-600 hover:underline dark:text-emerald-400'
                              }`}
                              disabled={eProprioUsuario}
                              title={
                                eProprioUsuario
                                  ? 'Você não pode desativar a sua própria conta conectada'
                                  : undefined
                              }
                              onClick={() =>
                                setConfirmacaoStatus({
                                  id: u.id,
                                  nome: u.name,
                                  novoStatus: !u.active,
                                })
                              }
                            >
                              {u.active ? 'Desativar' : 'Ativar'}
                            </button>
                            <span className="text-border">|</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-text-muted hover:text-text hover:underline"
                              onClick={() => abrirRedefinicaoSenha(u)}
                            >
                              Redefinir senha
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagina && pagina.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-text-muted">
            <span>
              Mostrando <strong>{primeiro}</strong> a <strong>{ultimo}</strong> de{' '}
              <strong>{pagina.total}</strong> usuários
            </span>
            <div className="flex gap-2">
              <Botao
                variante="secundario"
                onClick={() => irParaPagina(pagina.page - 1)}
                disabled={pagina.page <= 1}
              >
                Anterior
              </Botao>
              <span className="flex items-center px-2 font-medium">Página {pagina.page}</span>
              <Botao
                variante="secundario"
                onClick={() => irParaPagina(pagina.page + 1)}
                disabled={pagina.page * pagina.perPage >= pagina.total}
              >
                Próxima
              </Botao>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
