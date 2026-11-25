import {
  type LoanDetail,
  type LoanFilters,
  loanFiltersSchema,
  type PosMaterial,
  type PosMaterialFilters,
  posMaterialFiltersSchema,
} from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { useClientes } from '../features/clientes/queries'
import {
  type ErrosFormularioComodato,
  type ErrosFormularioMaterial,
  validarDadosComodato,
  validarDadosEncerramento,
  validarDadosMaterial,
} from '../features/materiais/formulario'
import {
  useAlterarStatusMaterial,
  useComodatos,
  useEncerrarComodato,
  useExcluirMaterial,
  useMateriais,
  useSalvarComodato,
  useSalvarMaterial,
} from '../features/materiais/queries'
import { formatarData, hojeEmSaoPaulo } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'
import { useSessao } from '../lib/sessao'

const POR_PAGINA = 10

type ConfirmacaoStatusMaterial = { id: string; nome: string; novoStatus: boolean }
type ConfirmacaoExclusaoMaterial = { id: string; nome: string }
type ConfirmacaoEncerramentoComodato = {
  id: string
  serialNumber: string
  materialNome: string
  clienteNome: string
  installedAt: string
}

type EstadoFormularioMaterial = {
  aberto: boolean
  id?: string
  name: string
  category: string
  erros: ErrosFormularioMaterial
}

const ESTADO_FORM_MATERIAL_INICIAL: EstadoFormularioMaterial = {
  aberto: false,
  name: '',
  category: '',
  erros: {},
}

type EstadoFormularioComodato = {
  aberto: boolean
  materialId: string
  customerId: string
  serialNumber: string
  installedAt: string
  erros: ErrosFormularioComodato
}

const ESTADO_FORM_COMODATO_INICIAL: EstadoFormularioComodato = {
  aberto: false,
  materialId: '',
  customerId: '',
  serialNumber: '',
  installedAt: '',
  erros: {},
}

function lerFiltrosMaterial(parametros: URLSearchParams): PosMaterialFilters {
  const entradas = Object.fromEntries(parametros)
  const resultado = posMaterialFiltersSchema.safeParse({
    page: entradas.page ? Number(entradas.page) : 1,
    perPage: POR_PAGINA,
    search: entradas.search || undefined,
    category: entradas.category || undefined,
    active: entradas.active || undefined,
  })
  return resultado.success
    ? resultado.data
    : { page: 1, perPage: POR_PAGINA, sortBy: 'name', order: 'asc' }
}

function lerFiltrosComodato(parametros: URLSearchParams): LoanFilters {
  const entradas = Object.fromEntries(parametros)
  const resultado = loanFiltersSchema.safeParse({
    page: entradas.page ? Number(entradas.page) : 1,
    perPage: POR_PAGINA,
    search: entradas.search || undefined,
    activeOnly: entradas.activeOnly || undefined,
  })
  return resultado.success
    ? resultado.data
    : { page: 1, perPage: POR_PAGINA, sortBy: 'installedAt', order: 'desc' }
}

export function MateriaisPage() {
  const sessao = useSessao()
  const eAdmin = sessao?.user.role === 'administrator'
  const eCoordenador = sessao?.user.role === 'coordinator'

  const [parametros, setParametros] = useSearchParams()
  const abaAtiva = parametros.get('aba') === 'comodatos' ? 'comodatos' : 'materiais'

  // Filtros
  const filtrosMaterial = lerFiltrosMaterial(parametros)
  const filtrosComodato = lerFiltrosComodato(parametros)

  // Queries
  const materiais = useMateriais(filtrosMaterial)
  const comodatos = useComodatos(filtrosComodato)

  // Queries auxiliares para selects do comodato
  const clientesAtivosQuery = useClientes({
    page: 1,
    perPage: 100,
    sortBy: 'tradeName',
    order: 'asc',
    status: 'active',
  })
  const materiaisAtivosQuery = useMateriais({
    page: 1,
    perPage: 100,
    sortBy: 'name',
    order: 'asc',
    active: true,
  })

  const opcoesClientes: ReadonlyArray<readonly [string, string]> = [
    ['', 'Selecione um cliente ativo...'],
    ...(clientesAtivosQuery.data?.items.map(
      (c) => [c.id, `${c.tradeName} (${c.city}/${c.state})`] as const,
    ) ?? []),
  ]

  const opcoesMateriais: ReadonlyArray<readonly [string, string]> = [
    ['', 'Selecione um material ativo do catálogo...'],
    ...(materiaisAtivosQuery.data?.items.map((m) => [m.id, `${m.name} (${m.category})`] as const) ??
      []),
  ]

  // Mutations
  const salvarMaterial = useSalvarMaterial()
  const alterarStatusMaterial = useAlterarStatusMaterial()
  const excluirMaterial = useExcluirMaterial()
  const salvarComodato = useSalvarComodato()
  const encerrarComodato = useEncerrarComodato()

  // Estados locais dos formulários e confirmações
  const [formMaterial, setFormMaterial] = useState<EstadoFormularioMaterial>(
    ESTADO_FORM_MATERIAL_INICIAL,
  )
  const [confirmacaoStatus, setConfirmacaoStatus] = useState<ConfirmacaoStatusMaterial | null>(null)
  const [confirmacaoExclusao, setConfirmacaoExclusao] =
    useState<ConfirmacaoExclusaoMaterial | null>(null)

  const [formComodato, setFormComodato] = useState<EstadoFormularioComodato>(
    ESTADO_FORM_COMODATO_INICIAL,
  )
  const [confirmacaoEncerramento, setConfirmacaoEncerramento] =
    useState<ConfirmacaoEncerramentoComodato | null>(null)
  const [dataEncerramento, setDataEncerramento] = useState<string>('')
  const [erroEncerramento, setErroEncerramento] = useState<string | null>(null)

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)

  function mudarAba(novaAba: 'materiais' | 'comodatos') {
    const novos = new URLSearchParams()
    if (novaAba === 'comodatos') {
      novos.set('aba', 'comodatos')
    }
    setParametros(novos)
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

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

  function buscarMateriais(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicarFiltros({
      search: String(dados.get('search') ?? '').trim(),
      category: String(dados.get('category') ?? '').trim(),
    })
  }

  function buscarComodatos(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicarFiltros({
      search: String(dados.get('search') ?? '').trim(),
    })
  }

  function limparFiltros() {
    const novos = new URLSearchParams()
    if (abaAtiva === 'comodatos') {
      novos.set('aba', 'comodatos')
    }
    setParametros(novos)
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('page', String(pagina))
    setParametros(novos)
  }

  // Ações de Material
  function abrirNovoMaterial() {
    setFormMaterial({
      aberto: true,
      name: '',
      category: '',
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function abrirEdicaoMaterial(material: PosMaterial) {
    setFormMaterial({
      aberto: true,
      id: material.id,
      name: material.name,
      category: material.category,
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function salvarDadosMaterial(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const { dados, erros } = validarDadosMaterial({
      name: formMaterial.name,
      category: formMaterial.category,
    })

    if (!dados || Object.keys(erros).length > 0) {
      setFormMaterial((f) => ({ ...f, erros }))
      return
    }

    salvarMaterial.mutate(
      { id: formMaterial.id, ...dados },
      {
        onSuccess: (salvo) => {
          setFormMaterial(ESTADO_FORM_MATERIAL_INICIAL)
          setMensagemSucesso(
            formMaterial.id
              ? `Material "${salvo.name}" atualizado com sucesso!`
              : `Material "${salvo.name}" cadastrado com sucesso!`,
          )
        },
        onError: (err) => {
          setErroOperacao(mensagemDeErro(err))
        },
      },
    )
  }

  function confirmarMudancaStatus() {
    if (!confirmacaoStatus) return
    alterarStatusMaterial.mutate(
      { id: confirmacaoStatus.id, active: confirmacaoStatus.novoStatus },
      {
        onSuccess: (atualizado) => {
          setConfirmacaoStatus(null)
          setMensagemSucesso(
            atualizado.active
              ? `Material "${atualizado.name}" reativado no catálogo.`
              : `Material "${atualizado.name}" inativado com sucesso.`,
          )
        },
        onError: (err) => {
          setConfirmacaoStatus(null)
          setErroOperacao(mensagemDeErro(err))
        },
      },
    )
  }

  function confirmarExclusaoMaterial() {
    if (!confirmacaoExclusao) return
    excluirMaterial.mutate(confirmacaoExclusao.id, {
      onSuccess: () => {
        setMensagemSucesso(`Material "${confirmacaoExclusao.nome}" excluído com sucesso.`)
        setConfirmacaoExclusao(null)
      },
      onError: (err) => {
        setConfirmacaoExclusao(null)
        setErroOperacao(mensagemDeErro(err))
      },
    })
  }

  // Ações de Comodato
  function abrirNovoComodato() {
    setFormComodato({
      aberto: true,
      materialId: '',
      customerId: '',
      serialNumber: '',
      installedAt: hojeEmSaoPaulo(),
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function salvarDadosComodato(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const { dados, erros } = validarDadosComodato({
      materialId: formComodato.materialId,
      customerId: formComodato.customerId,
      serialNumber: formComodato.serialNumber,
      installedAt: formComodato.installedAt,
    })

    if (!dados || Object.keys(erros).length > 0) {
      setFormComodato((f) => ({ ...f, erros }))
      return
    }

    salvarComodato.mutate(dados, {
      onSuccess: (salvo) => {
        setFormComodato(ESTADO_FORM_COMODATO_INICIAL)
        setMensagemSucesso(`Comodato de patrimônio "${salvo.serialNumber}" registrado com sucesso!`)
      },
      onError: (err) => {
        setErroOperacao(mensagemDeErro(err))
      },
    })
  }

  function abrirEncerramento(comodato: LoanDetail) {
    setConfirmacaoEncerramento({
      id: comodato.id,
      serialNumber: comodato.serialNumber,
      materialNome: comodato.material?.name ?? 'Material',
      clienteNome: comodato.customer?.tradeName ?? 'Cliente',
      installedAt: comodato.installedAt,
    })
    setDataEncerramento(hojeEmSaoPaulo())
    setErroEncerramento(null)
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function confirmarEncerramento() {
    if (!confirmacaoEncerramento) return
    const { dados, erros } = validarDadosEncerramento({
      endedAt: dataEncerramento,
      installedAt: confirmacaoEncerramento.installedAt,
    })

    if (!dados || erros.endedAt) {
      setErroEncerramento(erros.endedAt ?? 'Data inválida')
      return
    }

    encerrarComodato.mutate(
      { id: confirmacaoEncerramento.id, endedAt: dados.endedAt },
      {
        onSuccess: (atualizado) => {
          setConfirmacaoEncerramento(null)
          setMensagemSucesso(
            `Comodato "${atualizado.serialNumber}" encerrado em ${formatarData(dados.endedAt)}. Histórico preservado para auditoria.`,
          )
        },
        onError: (err) => {
          setErroOperacao(mensagemDeErro(err))
        },
      },
    )
  }

  const paginaMateriais = materiais.data
  const paginaComodatos = comodatos.data

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Materiais de PDV e Comodato</h1>
            <p className="text-sm text-text-muted">
              Controle do catálogo de materiais e comodatos instalados em clientes (RF16, RF17).
            </p>
          </div>
          {eAdmin && abaAtiva === 'materiais' && (
            <Botao onClick={abrirNovoMaterial} disabled={formMaterial.aberto}>
              + Novo material
            </Botao>
          )}
          {eAdmin && abaAtiva === 'comodatos' && (
            <Botao onClick={abrirNovoComodato} disabled={formComodato.aberto}>
              + Novo comodato
            </Botao>
          )}
        </div>

        {/* Abas */}
        <div className="mt-4 flex gap-4 border-b border-border text-sm font-medium">
          <button
            type="button"
            onClick={() => mudarAba('materiais')}
            className={`border-b-2 pb-2 transition-colors ${
              abaAtiva === 'materiais'
                ? 'border-brand font-semibold text-brand'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Catálogo de Materiais
          </button>
          <button
            type="button"
            onClick={() => mudarAba('comodatos')}
            className={`border-b-2 pb-2 transition-colors ${
              abaAtiva === 'comodatos'
                ? 'border-brand font-semibold text-brand'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Comodatos por Cliente
          </button>
        </div>

        {!eAdmin && (
          <div
            role="status"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>Modo somente leitura:</strong> Você está conectado como{' '}
            {eCoordenador ? 'Coordenador' : 'usuário sem perfil de Administrador'}. Apenas o
            Administrador pode cadastrar materiais, encerrar comodatos ou alterar status.
            {eCoordenador && ' Os comodatos exibidos limitam-se aos clientes da sua equipe.'}
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

      {/* ======================================================== */}
      {/* ABA 1: CATÁLOGO DE MATERIAIS */}
      {/* ======================================================== */}
      {abaAtiva === 'materiais' && (
        <section aria-label="Catálogo de materiais de PDV" className="flex flex-col gap-6">
          {/* Formulário de Criação / Edição de Material */}
          {formMaterial.aberto && (
            <section
              aria-label={formMaterial.id ? 'Editar material' : 'Novo material'}
              className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-lg font-bold">
                  {formMaterial.id ? 'Editar Material de PDV' : 'Cadastrar Material de PDV'}
                </h2>
                <button
                  type="button"
                  className="text-sm text-text-muted hover:text-text"
                  onClick={() => setFormMaterial(ESTADO_FORM_MATERIAL_INICIAL)}
                >
                  ✕ Cancelar
                </button>
              </div>

              <form onSubmit={salvarDadosMaterial} className="mt-4 flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Campo
                      rotulo="Nome do material *"
                      id="material-nome"
                      value={formMaterial.name}
                      onChange={(e) =>
                        setFormMaterial((f) => ({
                          ...f,
                          name: e.target.value,
                          erros: { ...f.erros, name: undefined },
                        }))
                      }
                      placeholder="Ex.: Geladeira Expositora Slim 1 Porta"
                      erro={formMaterial.erros.name}
                      required
                    />
                  </div>

                  <div>
                    <Campo
                      rotulo="Categoria *"
                      id="material-categoria"
                      value={formMaterial.category}
                      onChange={(e) =>
                        setFormMaterial((f) => ({
                          ...f,
                          category: e.target.value,
                          erros: { ...f.erros, category: undefined },
                        }))
                      }
                      placeholder="Ex.: Geladeiras, Freezers, Banners, Displays"
                      erro={formMaterial.erros.category}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={() => setFormMaterial(ESTADO_FORM_MATERIAL_INICIAL)}
                  >
                    Cancelar
                  </Botao>
                  <Botao type="submit" disabled={salvarMaterial.isPending}>
                    {salvarMaterial.isPending ? 'Salvando...' : 'Salvar material'}
                  </Botao>
                </div>
              </form>
            </section>
          )}

          {/* Modal de Confirmação de Mudança de Status */}
          {confirmacaoStatus && (
            <div
              role="alertdialog"
              className="flex flex-col gap-3 rounded-lg border-2 border-brand bg-surface p-4 shadow-md md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-text">
                  {confirmacaoStatus.novoStatus
                    ? `Reativar o material "${confirmacaoStatus.nome}"?`
                    : `Inativar o material "${confirmacaoStatus.nome}"?`}
                </p>
                <p className="text-xs text-text-muted">
                  {confirmacaoStatus.novoStatus
                    ? 'O material voltará a ficar disponível para novos comodatos.'
                    : 'Materiais inativados não podem ser associados a novos comodatos.'}
                </p>
              </div>
              <div className="flex gap-2">
                <Botao onClick={confirmarMudancaStatus} disabled={alterarStatusMaterial.isPending}>
                  {alterarStatusMaterial.isPending ? 'Salvando...' : 'Confirmar'}
                </Botao>
                <Botao
                  variante="secundario"
                  onClick={() => setConfirmacaoStatus(null)}
                  disabled={alterarStatusMaterial.isPending}
                >
                  Cancelar
                </Botao>
              </div>
            </div>
          )}

          {/* Modal de Confirmação de Exclusão Real */}
          {confirmacaoExclusao && (
            <div
              role="alertdialog"
              className="flex flex-col gap-3 rounded-lg border-2 border-rose-500 bg-rose-50 p-4 shadow-md dark:bg-rose-950 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-rose-900 dark:text-rose-100">
                  Excluir permanentemente o material "{confirmacaoExclusao.nome}"?
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  A exclusão real só é permitida se não houver comodatos ativos vinculados (regra do
                  modelo de dados).
                </p>
              </div>
              <div className="flex gap-2">
                <Botao
                  onClick={confirmarExclusaoMaterial}
                  disabled={excluirMaterial.isPending}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {excluirMaterial.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
                </Botao>
                <Botao
                  variante="secundario"
                  onClick={() => setConfirmacaoExclusao(null)}
                  disabled={excluirMaterial.isPending}
                >
                  Cancelar
                </Botao>
              </div>
            </div>
          )}

          {/* Filtros */}
          <form
            onSubmit={buscarMateriais}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <div className="min-w-64 flex-1">
              <Campo
                rotulo="Buscar por nome ou categoria"
                name="search"
                defaultValue={filtrosMaterial.search ?? ''}
                placeholder="Ex.: Geladeira, Banner..."
              />
            </div>

            <div className="w-48">
              <CampoSelecao
                rotulo="Status"
                name="active"
                value={filtrosMaterial.active === undefined ? '' : String(filtrosMaterial.active)}
                onChange={(e) => aplicarFiltros({ active: e.target.value })}
                opcoes={[
                  ['', 'Todos'],
                  ['true', 'Ativos'],
                  ['false', 'Inativos'],
                ]}
              />
            </div>

            <div className="flex gap-2">
              <Botao type="submit">Buscar</Botao>
              {(filtrosMaterial.search || filtrosMaterial.active !== undefined) && (
                <Botao type="button" variante="secundario" onClick={limparFiltros}>
                  Limpar
                </Botao>
              )}
            </div>
          </form>

          {/* Tabela de Materiais */}
          {materiais.isPending && (
            <div aria-busy="true" className="flex flex-col gap-3">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-40 animate-pulse rounded bg-muted" />
            </div>
          )}

          {paginaMateriais && (
            <>
              {paginaMateriais.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-text-muted">
                  Nenhum material encontrado no catálogo.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 font-semibold text-text-muted">
                        <th className="p-3">Nome do material</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Cadastrado em</th>
                        {eAdmin && <th className="p-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginaMateriais.items.map((mat) => (
                        <tr key={mat.id} className="hover:bg-muted/20">
                          <td className="p-3 font-medium text-text">{mat.name}</td>
                          <td className="p-3 text-text-muted">{mat.category}</td>
                          <td className="p-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                mat.active
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}
                            >
                              {mat.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="p-3 text-text-muted">
                            {formatarData(mat.createdAt.slice(0, 10))}
                          </td>
                          {eAdmin && (
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => abrirEdicaoMaterial(mat)}
                                  className="text-xs font-semibold text-brand hover:underline"
                                >
                                  Editar
                                </button>
                                <span className="text-border">|</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmacaoStatus({
                                      id: mat.id,
                                      nome: mat.name,
                                      novoStatus: !mat.active,
                                    })
                                  }
                                  className="text-xs font-semibold text-text-muted hover:underline"
                                >
                                  {mat.active ? 'Inativar' : 'Reativar'}
                                </button>
                                <span className="text-border">|</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmacaoExclusao({
                                      id: mat.id,
                                      nome: mat.name,
                                    })
                                  }
                                  className="text-xs font-semibold text-rose-600 hover:underline"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginação */}
              {paginaMateriais.total > POR_PAGINA && (
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <span>
                    Total: {paginaMateriais.total} materiais (Página {paginaMateriais.page} de{' '}
                    {Math.ceil(paginaMateriais.total / POR_PAGINA)})
                  </span>
                  <div className="flex gap-2">
                    <Botao
                      variante="secundario"
                      disabled={paginaMateriais.page <= 1}
                      onClick={() => irParaPagina(paginaMateriais.page - 1)}
                    >
                      Anterior
                    </Botao>
                    <Botao
                      variante="secundario"
                      disabled={
                        paginaMateriais.page >= Math.ceil(paginaMateriais.total / POR_PAGINA)
                      }
                      onClick={() => irParaPagina(paginaMateriais.page + 1)}
                    >
                      Próxima
                    </Botao>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* ABA 2: COMODATOS POR CLIENTE */}
      {/* ======================================================== */}
      {abaAtiva === 'comodatos' && (
        <section aria-label="Comodatos por cliente" className="flex flex-col gap-6">
          {/* Formulário de Novo Comodato */}
          {formComodato.aberto && (
            <section
              aria-label="Registrar comodato"
              className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-lg font-bold">Registrar Novo Comodato</h2>
                <button
                  type="button"
                  className="text-sm text-text-muted hover:text-text"
                  onClick={() => setFormComodato(ESTADO_FORM_COMODATO_INICIAL)}
                >
                  ✕ Cancelar
                </button>
              </div>

              <form onSubmit={salvarDadosComodato} className="mt-4 flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <CampoSelecao
                      rotulo="Cliente *"
                      id="comodato-cliente"
                      value={formComodato.customerId}
                      onChange={(e) =>
                        setFormComodato((f) => ({
                          ...f,
                          customerId: e.target.value,
                          erros: { ...f.erros, customerId: undefined },
                        }))
                      }
                      erro={formComodato.erros.customerId}
                      opcoes={opcoesClientes}
                      required
                    />
                  </div>

                  <div>
                    <CampoSelecao
                      rotulo="Material de PDV *"
                      id="comodato-material"
                      value={formComodato.materialId}
                      onChange={(e) =>
                        setFormComodato((f) => ({
                          ...f,
                          materialId: e.target.value,
                          erros: { ...f.erros, materialId: undefined },
                        }))
                      }
                      erro={formComodato.erros.materialId}
                      opcoes={opcoesMateriais}
                      required
                    />
                  </div>

                  <div>
                    <Campo
                      rotulo="Patrimônio / Nº de Série *"
                      id="comodato-serial"
                      value={formComodato.serialNumber}
                      onChange={(e) =>
                        setFormComodato((f) => ({
                          ...f,
                          serialNumber: e.target.value,
                          erros: { ...f.erros, serialNumber: undefined },
                        }))
                      }
                      placeholder="Ex.: GEL-2026-0042"
                      erro={formComodato.erros.serialNumber}
                      required
                    />
                  </div>

                  <div>
                    <Campo
                      rotulo="Data de Instalação *"
                      id="comodato-instalacao"
                      type="date"
                      value={formComodato.installedAt}
                      onChange={(e) =>
                        setFormComodato((f) => ({
                          ...f,
                          installedAt: e.target.value,
                          erros: { ...f.erros, installedAt: undefined },
                        }))
                      }
                      erro={formComodato.erros.installedAt}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={() => setFormComodato(ESTADO_FORM_COMODATO_INICIAL)}
                  >
                    Cancelar
                  </Botao>
                  <Botao type="submit" disabled={salvarComodato.isPending}>
                    {salvarComodato.isPending ? 'Registrando...' : 'Registrar comodato'}
                  </Botao>
                </div>
              </form>
            </section>
          )}

          {/* Modal de Encerramento de Comodato */}
          {confirmacaoEncerramento && (
            <div
              role="dialog"
              aria-label="Encerrar comodato"
              className="rounded-lg border-2 border-brand bg-surface p-5 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-lg font-bold">Encerrar Comodato</h2>
                <button
                  type="button"
                  className="text-sm text-text-muted hover:text-text"
                  onClick={() => setConfirmacaoEncerramento(null)}
                >
                  ✕ Cancelar
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 text-sm">
                <div className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                  <p>
                    <strong>Patrimônio:</strong> {confirmacaoEncerramento.serialNumber}
                  </p>
                  <p>
                    <strong>Material:</strong> {confirmacaoEncerramento.materialNome}
                  </p>
                  <p>
                    <strong>Cliente:</strong> {confirmacaoEncerramento.clienteNome}
                  </p>
                  <p>
                    <strong>Instalado em:</strong>{' '}
                    {formatarData(confirmacaoEncerramento.installedAt)}
                  </p>
                </div>

                <p className="text-xs text-text-muted">
                  O encerramento do comodato registra a data final e libera o material no catálogo
                  mantendo o histórico de auditoria intacto (RF17).
                </p>

                <div className="max-w-xs">
                  <Campo
                    rotulo="Data de encerramento *"
                    type="date"
                    value={dataEncerramento}
                    onChange={(e) => {
                      setDataEncerramento(e.target.value)
                      setErroEncerramento(null)
                    }}
                    erro={erroEncerramento ?? undefined}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={() => setConfirmacaoEncerramento(null)}
                    disabled={encerrarComodato.isPending}
                  >
                    Cancelar
                  </Botao>
                  <Botao
                    onClick={confirmarEncerramento}
                    disabled={encerrarComodato.isPending}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {encerrarComodato.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
                  </Botao>
                </div>
              </div>
            </div>
          )}

          {/* Filtros de Comodatos */}
          <form
            onSubmit={buscarComodatos}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <div className="min-w-64 flex-1">
              <Campo
                rotulo="Buscar por patrimônio, cliente ou material"
                name="search"
                defaultValue={filtrosComodato.search ?? ''}
                placeholder="Ex.: GEL-001, Mercado Central..."
              />
            </div>

            <div className="w-52">
              <CampoSelecao
                rotulo="Situação"
                name="activeOnly"
                value={
                  filtrosComodato.activeOnly === undefined ? '' : String(filtrosComodato.activeOnly)
                }
                onChange={(e) => aplicarFiltros({ activeOnly: e.target.value })}
                opcoes={[
                  ['', 'Todos'],
                  ['true', 'Somente ativos'],
                  ['false', 'Todos (inclui encerrados)'],
                ]}
              />
            </div>

            <div className="flex gap-2">
              <Botao type="submit">Buscar</Botao>
              {(filtrosComodato.search || filtrosComodato.activeOnly !== undefined) && (
                <Botao type="button" variante="secundario" onClick={limparFiltros}>
                  Limpar
                </Botao>
              )}
            </div>
          </form>

          {/* Tabela de Comodatos */}
          {comodatos.isPending && (
            <div aria-busy="true" className="flex flex-col gap-3">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-40 animate-pulse rounded bg-muted" />
            </div>
          )}

          {paginaComodatos && (
            <>
              {paginaComodatos.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-text-muted">
                  Nenhum comodato encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 font-semibold text-text-muted">
                        <th className="p-3">Patrimônio / Série</th>
                        <th className="p-3">Material</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Instalação</th>
                        <th className="p-3">Situação</th>
                        {eAdmin && <th className="p-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginaComodatos.items.map((com) => {
                        const estaAtivo = com.endedAt === null
                        return (
                          <tr key={com.id} className="hover:bg-muted/20">
                            <td className="p-3 font-semibold text-text">{com.serialNumber}</td>
                            <td className="p-3">
                              <div className="font-medium text-text">
                                {com.material?.name ?? 'Material não identificado'}
                              </div>
                              <div className="text-xs text-text-muted">
                                {com.material?.category}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-text">
                                {com.customer?.tradeName ?? 'Cliente não identificado'}
                              </div>
                              <div className="text-xs text-text-muted">
                                {com.customer?.city}/{com.customer?.state}
                              </div>
                            </td>
                            <td className="p-3 text-text-muted">{formatarData(com.installedAt)}</td>
                            <td className="p-3">
                              {estaAtivo ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  Ativo
                                </span>
                              ) : (
                                <span className="inline-flex flex-col text-xs text-text-muted">
                                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                                    Encerrado
                                  </span>
                                  <span>em {formatarData(com.endedAt as string)}</span>
                                </span>
                              )}
                            </td>
                            {eAdmin && (
                              <td className="p-3 text-right">
                                {estaAtivo ? (
                                  <button
                                    type="button"
                                    onClick={() => abrirEncerramento(com)}
                                    className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                                  >
                                    Encerrar comodato
                                  </button>
                                ) : (
                                  <span className="text-xs text-text-muted">—</span>
                                )}
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
              {paginaComodatos.total > POR_PAGINA && (
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <span>
                    Total: {paginaComodatos.total} comodatos (Página {paginaComodatos.page} de{' '}
                    {Math.ceil(paginaComodatos.total / POR_PAGINA)})
                  </span>
                  <div className="flex gap-2">
                    <Botao
                      variante="secundario"
                      disabled={paginaComodatos.page <= 1}
                      onClick={() => irParaPagina(paginaComodatos.page - 1)}
                    >
                      Anterior
                    </Botao>
                    <Botao
                      variante="secundario"
                      disabled={
                        paginaComodatos.page >= Math.ceil(paginaComodatos.total / POR_PAGINA)
                      }
                      onClick={() => irParaPagina(paginaComodatos.page + 1)}
                    >
                      Próxima
                    </Botao>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
