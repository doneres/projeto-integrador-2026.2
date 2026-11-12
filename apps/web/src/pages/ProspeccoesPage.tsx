import {
  type Customer,
  type CustomerFilters,
  type CustomerStatus,
  customerFiltersSchema,
} from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { IndicadorDeFrescor } from '../components/ui/IndicadorDeFrescor'
import {
  useAprovarProspeccao,
  useProspeccoes,
  useRejeitarProspeccao,
} from '../features/clientes/queries'
import { useVendedores } from '../features/rotas/queries'
import { formatarData, formatarHora } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'
import { formatarDocumento } from '../lib/formatacao'
import { useSessao } from '../lib/sessao'

const POR_PAGINA = 10

type AbaStatus = 'pending_approval' | 'active' | 'rejected' | 'todas'

const ROTULO_STATUS: Record<CustomerStatus, string> = {
  pending_approval: 'Aguardando aprovação',
  active: 'Aprovada',
  rejected: 'Rejeitada',
  inactive: 'Inativa',
}

const BADGE_STATUS: Record<CustomerStatus, string> = {
  pending_approval:
    'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  active:
    'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  rejected:
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
  inactive:
    'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
}

function lerFiltros(parametros: URLSearchParams): CustomerFilters {
  const entradas = Object.fromEntries(parametros)
  // Por padrão a tela abre nas prospecções que aguardam aprovação
  const statusPadrao = entradas.status === undefined ? 'pending_approval' : entradas.status
  const resultado = customerFiltersSchema.safeParse({
    ...entradas,
    status: statusPadrao === '' ? undefined : statusPadrao,
    origin: 'prospect',
    perPage: POR_PAGINA,
  })
  return resultado.success
    ? resultado.data
    : customerFiltersSchema.parse({
        status: 'pending_approval',
        origin: 'prospect',
        perPage: POR_PAGINA,
      })
}

function formatarDataCriacao(iso: string): string {
  try {
    const dataIso = iso.slice(0, 10)
    return `${formatarData(dataIso)} às ${formatarHora(iso)}`
  } catch {
    return iso
  }
}

export function ProspeccoesPage() {
  const sessao = useSessao()
  const eCoordenador = sessao?.user.role === 'coordinator'
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)

  // Consulta viva: revalida a cada 30 segundos (ADR tempo real)
  const prospeccoes = useProspeccoes(filtros, { vivo: true })
  const vendedores = useVendedores()
  const aprovar = useAprovarProspeccao()
  const rejeitar = useRejeitarProspeccao()

  const [clienteAprovando, setClienteAprovando] = useState<Customer | null>(null)
  const [clienteRejeitando, setClienteRejeitando] = useState<Customer | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [erroValidacaoMotivo, setErroValidacaoMotivo] = useState<string | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)

  const statusAtual: AbaStatus =
    filtros.status === 'pending_approval'
      ? 'pending_approval'
      : filtros.status === 'active'
        ? 'active'
        : filtros.status === 'rejected'
          ? 'rejected'
          : 'todas'

  function mudarAba(novaAba: AbaStatus) {
    const novos = new URLSearchParams(parametros)
    if (novaAba === 'todas') {
      novos.set('status', '')
    } else {
      novos.set('status', novaAba)
    }
    novos.delete('page')
    setParametros(novos)
    setMensagemSucesso(null)
  }

  function aplicarBusca(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    const novos = new URLSearchParams(parametros)
    const busca = String(dados.get('search') ?? '').trim()
    const bairro = String(dados.get('district') ?? '').trim()

    if (busca) novos.set('search', busca)
    else novos.delete('search')

    if (bairro) novos.set('district', bairro)
    else novos.delete('district')

    novos.delete('page')
    setParametros(novos)
  }

  function limparFiltros() {
    const novos = new URLSearchParams()
    novos.set('status', 'pending_approval')
    setParametros(novos)
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('page', String(pagina))
    setParametros(novos)
  }

  function iniciarAprovacao(cliente: Customer) {
    setClienteRejeitando(null)
    setClienteAprovando(cliente)
    setMensagemSucesso(null)
  }

  function confirmarAprovacao() {
    if (!clienteAprovando) return
    aprovar.mutate(clienteAprovando.id, {
      onSuccess: (aprovado) => {
        setClienteAprovando(null)
        setMensagemSucesso(`Prospecção de "${aprovado.tradeName}" aprovada com sucesso!`)
      },
    })
  }

  function iniciarRejeicao(cliente: Customer) {
    setClienteAprovando(null)
    setClienteRejeitando(cliente)
    setMotivoRejeicao('')
    setErroValidacaoMotivo(null)
    setMensagemSucesso(null)
  }

  function confirmarRejeicao() {
    if (!clienteRejeitando) return
    const motivoLimpo = motivoRejeicao.trim()
    if (!motivoLimpo) {
      setErroValidacaoMotivo('Informe o motivo da rejeição para prosseguir.')
      return
    }
    if (motivoLimpo.length > 500) {
      setErroValidacaoMotivo('O motivo deve ter no máximo 500 caracteres.')
      return
    }
    rejeitar.mutate(
      { id: clienteRejeitando.id, reason: motivoLimpo },
      {
        onSuccess: (rejeitado) => {
          setClienteRejeitando(null)
          setMotivoRejeicao('')
          setMensagemSucesso(`Prospecção de "${rejeitado.tradeName}" rejeitada.`)
        },
      },
    )
  }

  const mapaVendedores = new Map(vendedores.data?.items.map((v) => [v.id, v.name]) ?? [])
  const pagina = prospeccoes.data
  const primeiro = pagina ? (pagina.page - 1) * pagina.perPage + 1 : 0
  const ultimo = pagina ? primeiro + pagina.items.length - 1 : 0
  const temFiltrosAtivos = Boolean(filtros.search || filtros.district)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Aprovação de Prospecções</h1>
            <p className="text-sm text-text-muted">
              Avaliação e homologação de novos clientes cadastrados em campo pela força de vendas
              (RF09, RN04).
            </p>
          </div>
          <IndicadorDeFrescor
            atualizadoEm={prospeccoes.dataUpdatedAt}
            atualizando={prospeccoes.isFetching}
            comErro={prospeccoes.isError}
            onAtualizar={() => prospeccoes.refetch()}
          />
        </div>

        {!eCoordenador && (
          <div
            role="status"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>Modo somente leitura:</strong> Você está conectado com um perfil diferente de
            Coordenador. Apenas o coordenador da equipe pode aprovar ou rejeitar prospecções.
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
      </header>

      {/* Abas de Navegação de Status */}
      <nav
        aria-label="Filtrar por status"
        className="flex flex-wrap gap-2 border-b border-border pb-2"
      >
        <button
          type="button"
          onClick={() => mudarAba('pending_approval')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusAtual === 'pending_approval'
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'bg-muted text-text-muted hover:bg-surface'
          }`}
        >
          Aguardando aprovação
        </button>
        <button
          type="button"
          onClick={() => mudarAba('active')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusAtual === 'active'
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'bg-muted text-text-muted hover:bg-surface'
          }`}
        >
          Aprovadas
        </button>
        <button
          type="button"
          onClick={() => mudarAba('rejected')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusAtual === 'rejected'
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'bg-muted text-text-muted hover:bg-surface'
          }`}
        >
          Rejeitadas
        </button>
        <button
          type="button"
          onClick={() => mudarAba('todas')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusAtual === 'todas'
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'bg-muted text-text-muted hover:bg-surface'
          }`}
        >
          Todas
        </button>
      </nav>

      {/* Barra de Busca e Filtros */}
      <form
        onSubmit={aplicarBusca}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 text-sm"
      >
        <div className="min-w-64 flex-1">
          <Campo
            rotulo="Buscar prospecção"
            id="filtro-busca"
            name="search"
            defaultValue={filtros.search ?? ''}
            placeholder="Nome fantasia, razão social ou CPF/CNPJ..."
          />
        </div>
        <div className="w-48">
          <Campo
            rotulo="Bairro"
            id="filtro-bairro"
            name="district"
            defaultValue={filtros.district ?? ''}
            placeholder="Ex.: Setor Bueno"
          />
        </div>
        <div className="flex gap-2">
          <Botao type="submit">Buscar</Botao>
          {temFiltrosAtivos && (
            <Botao type="button" variante="secundario" onClick={limparFiltros}>
              Limpar
            </Botao>
          )}
        </div>
      </form>

      {/* Modal / Caixa de Aprovação */}
      {clienteAprovando && (
        <section
          aria-label="Confirmar aprovação de prospecção"
          className="rounded-lg border-2 border-emerald-500 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950"
        >
          <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
            Confirmar aprovação de prospecção
          </h2>
          <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
            Deseja aprovar o cliente <strong>{clienteAprovando.tradeName}</strong> (
            {formatarDocumento(clienteAprovando.document)})?
          </p>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
            Conforme a <strong>RN04</strong>, ao ser aprovada, a prospecção se torna um cliente
            ativo da sua equipe, ficando habilitada para entrar em rotas e receber visitas
            comerciais e pedidos em campo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao onClick={confirmarAprovacao} disabled={aprovar.isPending}>
              {aprovar.isPending ? 'Aprovando...' : 'Confirmar aprovação'}
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => setClienteAprovando(null)}
              disabled={aprovar.isPending}
            >
              Cancelar
            </Botao>
          </div>
          {aprovar.isError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {mensagemDeErro(aprovar.error)}
            </p>
          )}
        </section>
      )}

      {/* Modal / Caixa de Rejeição */}
      {clienteRejeitando && (
        <section
          aria-label="Confirmar rejeição de prospecção"
          className="rounded-lg border-2 border-rose-500 bg-rose-50 p-5 dark:border-rose-700 dark:bg-rose-950"
        >
          <h2 className="text-base font-bold text-rose-950 dark:text-rose-100">
            Rejeitar prospecção
          </h2>
          <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">
            Você está rejeitando a prospecção de <strong>{clienteRejeitando.tradeName}</strong>. A
            prospecção continuará registrada no histórico da equipe (RN04) com o motivo informado
            abaixo.
          </p>

          <div className="mt-3 flex flex-col gap-1">
            <label
              htmlFor="motivo-rejeicao"
              className="text-xs font-bold text-rose-950 dark:text-rose-100"
            >
              Motivo da rejeição (obrigatório) *
            </label>
            <textarea
              id="motivo-rejeicao"
              rows={3}
              className="rounded-md border border-rose-300 bg-white p-2 text-sm text-zinc-900 shadow-sm focus:border-rose-500 focus:outline-none dark:border-rose-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="Ex.: Estabelecimento fora da rota da equipe / CNPJ incompatível / Inconsistência nos dados de contato..."
              value={motivoRejeicao}
              maxLength={500}
              onChange={(e) => {
                setMotivoRejeicao(e.target.value)
                setErroValidacaoMotivo(null)
              }}
            />
            <div className="flex justify-between text-xs text-rose-800 dark:text-rose-300">
              <span>
                {erroValidacaoMotivo && <strong role="alert">{erroValidacaoMotivo}</strong>}
              </span>
              <span>{motivoRejeicao.length}/500 caracteres</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={confirmarRejeicao}
              disabled={rejeitar.isPending}
            >
              {rejeitar.isPending ? 'Rejeitando...' : 'Confirmar rejeição'}
            </button>
            <Botao
              variante="secundario"
              onClick={() => {
                setClienteRejeitando(null)
                setMotivoRejeicao('')
                setErroValidacaoMotivo(null)
              }}
              disabled={rejeitar.isPending}
            >
              Cancelar
            </Botao>
          </div>
          {rejeitar.isError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {mensagemDeErro(rejeitar.error)}
            </p>
          )}
        </section>
      )}

      {/* Conteúdo Principal */}
      {prospeccoes.isPending && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded bg-muted" />
        </div>
      )}

      {prospeccoes.isError && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <p className="font-semibold">Erro ao carregar as prospecções.</p>
          <p className="mt-1">{mensagemDeErro(prospeccoes.error)}</p>
          <Botao variante="secundario" className="mt-3" onClick={() => prospeccoes.refetch()}>
            Tentar novamente
          </Botao>
        </div>
      )}

      {pagina && (
        <>
          {pagina.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <span className="text-3xl" aria-hidden="true">
                📋
              </span>
              <h2 className="mt-2 text-base font-bold">Nenhuma prospecção encontrada</h2>
              <p className="mt-1 max-w-md text-sm text-text-muted">
                {statusAtual === 'pending_approval'
                  ? 'Não há prospecções pendentes de avaliação no momento. Conforme os vendedores cadastrarem clientes em campo e sincronizarem seus aparelhos, eles surgirão aqui.'
                  : 'Nenhum registro encontrado para a combinação atual de filtros selecionados.'}
              </p>
              {temFiltrosAtivos && (
                <Botao variante="secundario" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Botao>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Lista de clientes prospectados em campo</caption>
                <thead className="border-b border-border bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Cliente / Documento
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Contato & Endereço
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Cadastrado por
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagina.items.map((item) => {
                    const nomeVendedor =
                      mapaVendedores.get(item.createdById) ?? 'Vendedor da equipe'
                    const pendente = item.status === 'pending_approval'

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-text">{item.tradeName}</div>
                          <div className="text-xs text-text-muted">{item.legalName}</div>
                          <div className="mt-1 font-mono text-xs">
                            {formatarDocumento(item.document)}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="text-xs">
                            <strong>{item.contactName}</strong> · {item.phone}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            {item.street}, {item.number}
                            {item.complement ? ` - ${item.complement}` : ''}
                          </div>
                          <div className="text-xs text-text-muted">
                            {item.district} · {item.city}/{item.state}
                          </div>
                          <div className="mt-1">
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                              title="Ver localização no mapa"
                            >
                              📍 {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                            </a>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top text-xs">
                          <div className="font-medium text-text">{nomeVendedor}</div>
                          <div className="text-text-muted">
                            {formatarDataCriacao(item.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              BADGE_STATUS[item.status]
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.status === 'pending_approval'
                                  ? 'bg-amber-500'
                                  : item.status === 'active'
                                    ? 'bg-emerald-500'
                                    : item.status === 'rejected'
                                      ? 'bg-rose-500'
                                      : 'bg-zinc-400'
                              }`}
                            />
                            {ROTULO_STATUS[item.status]}
                          </span>

                          {item.status === 'rejected' && item.rejectionReason && (
                            <div className="mt-2 max-w-xs rounded border border-rose-200 bg-rose-50/70 p-2 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
                              <span className="font-semibold">Motivo:</span> {item.rejectionReason}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top text-right">
                          {pendente ? (
                            <div className="flex justify-end gap-2">
                              <Botao
                                className="px-3 py-1 text-xs"
                                onClick={() => iniciarAprovacao(item)}
                                disabled={!eCoordenador}
                                title={
                                  eCoordenador
                                    ? 'Aprovar prospecção'
                                    : 'Apenas coordenadores podem aprovar'
                                }
                              >
                                Aprovar
                              </Botao>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-900"
                                onClick={() => iniciarRejeicao(item)}
                                disabled={!eCoordenador}
                                title={
                                  eCoordenador
                                    ? 'Rejeitar prospecção com motivo'
                                    : 'Apenas coordenadores podem rejeitar'
                                }
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {pagina.total > 0 && (
            <nav
              aria-label="Paginação"
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <span className="text-text-muted">
                {primeiro}–{ultimo} de {pagina.total}{' '}
                {pagina.total === 1 ? 'prospecção' : 'prospecções'}
              </span>
              <div className="flex gap-2">
                <Botao
                  variante="secundario"
                  disabled={pagina.page <= 1}
                  onClick={() => irParaPagina(pagina.page - 1)}
                >
                  Anterior
                </Botao>
                <Botao
                  variante="secundario"
                  disabled={ultimo >= pagina.total}
                  onClick={() => irParaPagina(pagina.page + 1)}
                >
                  Próxima
                </Botao>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
