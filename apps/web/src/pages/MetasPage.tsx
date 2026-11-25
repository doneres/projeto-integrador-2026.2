import type { GoalFilters, SellerScoreSummary } from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { IndicadorDeFrescor } from '../components/ui/IndicadorDeFrescor'
import {
  centavosParaReais,
  type ErrosFormularioMeta,
  validarDadosMeta,
} from '../features/metas/formulario'
import { useMetas, useSalvarMeta } from '../features/metas/queries'
import { formatarMes, hojeEmSaoPaulo } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'
import { formatarMoeda } from '../lib/formatacao'
import { useSessao } from '../lib/sessao'

type EstadoFormularioMeta = {
  aberto: boolean
  sellerId: string
  sellerName: string
  month: string
  faturamentoReais: string
  visitas: string
  novosClientes: string
  erros: ErrosFormularioMeta
}

const ESTADO_FORM_INICIAL: EstadoFormularioMeta = {
  aberto: false,
  sellerId: '',
  sellerName: '',
  month: '',
  faturamentoReais: '',
  visitas: '',
  novosClientes: '',
  erros: {},
}

function lerMes(parametros: URLSearchParams): string {
  const mesParam = parametros.get('month')
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    return mesParam
  }
  return hojeEmSaoPaulo().slice(0, 7)
}

/**
 * Tela de Metas e Score Ponderado da RN02 (#43, #63, RF18, RF23):
 * - O Diretor define metas mensais por vendedor (faturamento, visitas, novos clientes).
 * - O realizado e o Score se atualizam sozinhos a cada 30 segundos com indicador de frescor.
 * - Score com teto de 100% por indicador e pesos configuráveis (50/30/20).
 * - Preserva o formulário aberto mesmo durante os ciclos de polling automático.
 */
export function MetasPage() {
  const sessao = useSessao()
  const papel = sessao?.user.role
  const eDiretor = papel === 'director'
  const temAcesso = papel === 'director' || papel === 'coordinator' || papel === 'administrator'

  const [parametros, setParametros] = useSearchParams()
  const mesAtual = lerMes(parametros)
  const filtros: GoalFilters = { month: mesAtual }

  // Consulta viva com polling de 30s
  const consulta = useMetas(filtros, temAcesso)
  const salvarMeta = useSalvarMeta()

  const [formulario, setFormulario] = useState<EstadoFormularioMeta>(ESTADO_FORM_INICIAL)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)

  function mudarMes(novoMes: string) {
    const novos = new URLSearchParams(parametros)
    if (novoMes) {
      novos.set('month', novoMes)
    } else {
      novos.delete('month')
    }
    setParametros(novos)
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function abrirEdicaoMeta(vendedor: SellerScoreSummary) {
    setFormulario({
      aberto: true,
      sellerId: vendedor.sellerId,
      sellerName: vendedor.sellerName,
      month: mesAtual,
      faturamentoReais: centavosParaReais(vendedor.revenue.target),
      visitas: vendedor.visits.target !== null ? String(vendedor.visits.target) : '',
      novosClientes:
        vendedor.newCustomers.target !== null ? String(vendedor.newCustomers.target) : '',
      erros: {},
    })
    setMensagemSucesso(null)
    setErroOperacao(null)
  }

  function fecharFormulario() {
    setFormulario(ESTADO_FORM_INICIAL)
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const { dados, erros } = validarDadosMeta({
      faturamentoReais: formulario.faturamentoReais,
      visitas: formulario.visitas,
      novosClientes: formulario.novosClientes,
    })

    if (!dados || Object.keys(erros).length > 0) {
      setFormulario((f) => ({ ...f, erros }))
      return
    }

    salvarMeta.mutate(
      {
        sellerId: formulario.sellerId,
        month: formulario.month,
        dados,
      },
      {
        onSuccess: () => {
          fecharFormulario()
          setMensagemSucesso(
            `Meta de ${formulario.sellerName} atualizada para ${formatarMes(formulario.month)}.`,
          )
        },
        onError: (err) => {
          setErroOperacao(mensagemDeErro(err))
        },
      },
    )
  }

  const dados = consulta.data

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Metas e Score Comercial</h1>
            <p className="text-sm text-text-muted">
              Definição de metas mensais e acompanhamento do Score ponderado com teto de 100% (RF18,
              RF23, RN02).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filtro-mes" className="text-sm font-medium">
                Mês civil:
              </label>
              <input
                id="filtro-mes"
                type="month"
                value={mesAtual}
                onChange={(e) => mudarMes(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>

        <IndicadorDeFrescor
          atualizadoEm={consulta.dataUpdatedAt}
          atualizando={consulta.isFetching}
          comErro={consulta.isError}
          onAtualizar={() => consulta.refetch()}
        />

        {!eDiretor && (
          <div
            role="status"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>Modo somente leitura:</strong> Você está conectado como{' '}
            {papel === 'coordinator' ? 'Coordenador' : 'usuário sem perfil de Diretor'}. Apenas o
            Diretor Comercial pode definir ou alterar metas mensais de vendedores (RN02).
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

      {/* Formulário Modal de Edição de Meta (Diretor) */}
      {formulario.aberto && (
        <section
          aria-label={`Definir meta para ${formulario.sellerName}`}
          className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold">Definir Metas Mensais</h2>
              <p className="text-xs text-text-muted">
                Vendedor: <strong>{formulario.sellerName}</strong> · Mês:{' '}
                <strong>{formatarMes(formulario.month)}</strong>
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text"
              onClick={fecharFormulario}
            >
              ✕ Cancelar
            </button>
          </div>

          <form onSubmit={salvar} className="mt-4 flex flex-col gap-4 text-sm">
            <p className="text-xs text-text-muted">
              Deixe em branco qualquer indicador que não deva ter meta definida para este vendedor
              no mês.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Campo
                  rotulo="Meta de Faturamento (R$)"
                  id="meta-faturamento"
                  value={formulario.faturamentoReais}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      faturamentoReais: e.target.value,
                      erros: { ...f.erros, revenueTargetCents: undefined },
                    }))
                  }
                  placeholder="Ex.: 15.000,00"
                  erro={formulario.erros.revenueTargetCents}
                />
                <span className="text-xs text-text-muted">Peso no Score: 50%</span>
              </div>

              <div>
                <Campo
                  rotulo="Meta de Visitas Realizadas"
                  id="meta-visitas"
                  type="number"
                  min="0"
                  value={formulario.visitas}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      visitas: e.target.value,
                      erros: { ...f.erros, visitsTarget: undefined },
                    }))
                  }
                  placeholder="Ex.: 30"
                  erro={formulario.erros.visitsTarget}
                />
                <span className="text-xs text-text-muted">Peso no Score: 30%</span>
              </div>

              <div>
                <Campo
                  rotulo="Meta de Novos Clientes"
                  id="meta-clientes"
                  type="number"
                  min="0"
                  value={formulario.novosClientes}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      novosClientes: e.target.value,
                      erros: { ...f.erros, newCustomersTarget: undefined },
                    }))
                  }
                  placeholder="Ex.: 4"
                  erro={formulario.erros.newCustomersTarget}
                />
                <span className="text-xs text-text-muted">Peso no Score: 20%</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Botao type="button" variante="secundario" onClick={fecharFormulario}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={salvarMeta.isPending}>
                {salvarMeta.isPending ? 'Salvando...' : 'Salvar meta'}
              </Botao>
            </div>
          </form>
        </section>
      )}

      {/* Regras e Pesos */}
      <section
        aria-label="Regras de cálculo do Score"
        className="rounded-lg border border-border bg-muted/30 p-4 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-text">Fórmula RN02:</strong>{' '}
            <span className="text-text-muted">
              Score = 50% Faturamento + 30% Visitas Realizadas + 20% Novos Clientes (com teto de
              100% por indicador).
            </span>
          </div>
          {dados && dados.overallScore !== null && (
            <div className="rounded bg-brand/10 px-3 py-1 font-semibold text-brand">
              Média Geral da Força de Vendas: {dados.overallScore}%
            </div>
          )}
        </div>
      </section>

      {/* Estado de carregamento */}
      {consulta.isPending && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded bg-muted" />
        </div>
      )}

      {/* Erro */}
      {consulta.isError && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <p className="font-semibold">Erro ao carregar as metas do mês.</p>
          <p className="mt-1">{mensagemDeErro(consulta.error)}</p>
          <Botao variante="secundario" className="mt-3" onClick={() => consulta.refetch()}>
            Tentar novamente
          </Botao>
        </div>
      )}

      {/* Tabela de Vendedores, Metas e Score */}
      {dados && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 font-semibold text-text-muted">
                <th className="p-3">Vendedor</th>
                <th className="p-3">Equipe / Coordenador</th>
                <th className="p-3">Faturamento (R$)</th>
                <th className="p-3">Visitas Realizadas</th>
                <th className="p-3">Novos Clientes</th>
                <th className="p-3 text-center">Score RN02</th>
                {eDiretor && <th className="p-3 text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dados.sellers.map((vendedor) => {
                const score = vendedor.score
                return (
                  <tr key={vendedor.sellerId} className="hover:bg-muted/20">
                    <td className="p-3 font-medium text-text">{vendedor.sellerName}</td>

                    <td className="p-3 text-text-muted">
                      {vendedor.coordinatorName ?? 'Sem equipe'}
                    </td>

                    {/* Faturamento */}
                    <td className="p-3">
                      <div className="font-semibold text-text">
                        {formatarMoeda(vendedor.revenue.realized)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {vendedor.revenue.target !== null ? (
                          <span>
                            Meta: {formatarMoeda(vendedor.revenue.target)}{' '}
                            <strong className="text-text">({vendedor.revenue.percent}%)</strong>
                          </span>
                        ) : (
                          <span className="italic">Sem meta</span>
                        )}
                      </div>
                    </td>

                    {/* Visitas */}
                    <td className="p-3">
                      <div className="font-semibold text-text">{vendedor.visits.realized}</div>
                      <div className="text-xs text-text-muted">
                        {vendedor.visits.target !== null ? (
                          <span>
                            Meta: {vendedor.visits.target}{' '}
                            <strong className="text-text">({vendedor.visits.percent}%)</strong>
                          </span>
                        ) : (
                          <span className="italic">Sem meta</span>
                        )}
                      </div>
                    </td>

                    {/* Novos Clientes */}
                    <td className="p-3">
                      <div className="font-semibold text-text">
                        {vendedor.newCustomers.realized}
                      </div>
                      <div className="text-xs text-text-muted">
                        {vendedor.newCustomers.target !== null ? (
                          <span>
                            Meta: {vendedor.newCustomers.target}{' '}
                            <strong className="text-text">
                              ({vendedor.newCustomers.percent}%)
                            </strong>
                          </span>
                        ) : (
                          <span className="italic">Sem meta</span>
                        )}
                      </div>
                    </td>

                    {/* Score Ponderado RN02 */}
                    <td className="p-3 text-center">
                      {score !== null ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              score >= 100
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : score >= 70
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {score}%
                          </span>
                          <span className="mt-0.5 text-[10px] text-text-muted">teto 100%</span>
                        </div>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-text-muted">
                          Sem meta
                        </span>
                      )}
                    </td>

                    {/* Ação (Diretor) */}
                    {eDiretor && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => abrirEdicaoMeta(vendedor)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          {vendedor.hasGoal ? 'Editar meta' : 'Definir meta'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
