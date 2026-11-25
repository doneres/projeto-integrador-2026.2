import { type DashboardFilters, dashboardFiltersSchema } from '@axis/contracts'
import { Link, useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { IndicadorDeFrescor } from '../components/ui/IndicadorDeFrescor'
import { useDashboard } from '../features/dashboard/queries'
import { formatarData, formatarMes, hojeEmSaoPaulo } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'
import { formatarMoeda } from '../lib/formatacao'
import { useSessao } from '../lib/sessao'

function lerFiltros(parametros: URLSearchParams): DashboardFilters {
  const resultado = dashboardFiltersSchema.safeParse({
    date: hojeEmSaoPaulo(),
    ...Object.fromEntries(parametros),
  })
  return resultado.success ? resultado.data : { date: hojeEmSaoPaulo() }
}

/** Percentual inteiro de visitas concluídas sobre as planejadas (0% quando não há planejadas). */
export function percentualConcluido(concluidas: number, planejadas: number): number {
  if (planejadas <= 0) {
    return 0
  }
  return Math.round((concluidas / planejadas) * 100)
}

/**
 * Painel gerencial consolidado (#40, RF24, R9): visitas planejadas × realizadas, faturamento do
 * período e gráfico de visitas por vendedor. O Coordenador vê a sua Equipe; o Diretor vê todas.
 */
export function DashboardPage() {
  const sessao = useSessao()
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const papel = sessao?.user.role
  const temAcesso = papel === 'coordinator' || papel === 'director'
  const painel = useDashboard(filtros, temAcesso)

  if (papel === 'administrator') {
    return (
      <section className="rounded-md border border-border px-4 py-6 text-sm">
        <h2 className="font-medium">Painel comercial</h2>
        <p className="mt-1 text-text-muted">
          Os indicadores de visitas e faturamento são voltados ao Coordenador e ao Diretor. Use o
          menu lateral para gerenciar os cadastros e parâmetros do sistema.
        </p>
      </section>
    )
  }

  function mudarData(date: string) {
    const novos = new URLSearchParams(parametros)
    if (date) {
      novos.set('date', date)
    } else {
      novos.delete('date')
    }
    setParametros(novos)
  }

  const dados = temAcesso ? painel.data : undefined
  const maiorPlanejado = dados ? Math.max(1, ...dados.visitsBySeller.map((v) => v.planned)) : 1

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">
            {papel === 'director' ? 'Consolidado de todas as Equipes' : 'Consolidado da sua Equipe'}
          </p>
        </div>
        <Campo
          rotulo="Data das visitas"
          type="date"
          value={filtros.date ?? ''}
          onChange={(evento) => mudarData(evento.target.value)}
          className="w-44"
        />
      </div>

      <IndicadorDeFrescor
        atualizadoEm={painel.dataUpdatedAt}
        atualizando={painel.isFetching}
        comErro={painel.isError}
        onAtualizar={() => {
          painel.refetch()
        }}
      />

      {painel.isPending && <p className="text-sm text-text-muted">Carregando indicadores...</p>}

      {painel.isError && !dados && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          <span>{mensagemDeErro(painel.error)}</span>
          <Botao variante="secundario" onClick={() => painel.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {dados && (
        <>
          <section
            aria-label="Indicadores principais"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <article className="rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-text-muted">
                Visitas planejadas × realizadas ({formatarData(dados.date)})
              </h2>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {dados.visits.completed} de {dados.visits.planned}{' '}
                <span className="text-base font-normal text-text-muted">
                  ({percentualConcluido(dados.visits.completed, dados.visits.planned)}%)
                </span>
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {dados.visits.inProgress} em andamento · {dados.visits.pending} pendentes ·{' '}
                {dados.visits.notPerformed} não realizadas
              </p>
            </article>

            <article className="rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-text-muted">
                Faturamento do período ({formatarMes(dados.month)})
              </h2>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatarMoeda(dados.revenueCents)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {dados.ordersCount}{' '}
                {dados.ordersCount === 1 ? 'pedido emitido' : 'pedidos emitidos'} no mês
              </p>
            </article>

            <article className="rounded-md border border-border p-4 sm:col-span-2 lg:col-span-1">
              <h2 className="text-sm font-medium text-text-muted">Andamento das rotas do dia</h2>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {dados.visitsBySeller.filter((v) => v.planned > 0).length} de{' '}
                {dados.visitsBySeller.length}{' '}
                <span className="text-base font-normal text-text-muted">vendedores com rota</span>
              </p>
              <p className="mt-1 text-xs text-text-muted">
                <Link to={`/rotas?date=${dados.date}`} className="underline">
                  Ver rotas de {formatarData(dados.date)}
                </Link>
              </p>
            </article>
          </section>

          <section
            aria-labelledby="titulo-grafico-vendedores"
            className="rounded-md border border-border p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="titulo-grafico-vendedores" className="text-base font-medium">
                Visitas por vendedor em {formatarData(dados.date)}
              </h2>
              <span className="text-xs text-text-muted">
                Barra escura: realizadas · Barra clara: planejadas
              </span>
            </div>

            {dados.visitsBySeller.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">
                Nenhum vendedor ativo vinculado a este escopo.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {dados.visitsBySeller.map((item) => {
                  const larguraPlanejada = Math.round((item.planned / maiorPlanejado) * 100)
                  const larguraRealizada =
                    item.planned > 0 ? Math.round((item.completed / maiorPlanejado) * 100) : 0
                  return (
                    <li key={item.sellerId} className="flex flex-col gap-1.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          to={`/rotas?date=${dados.date}&sellerId=${item.sellerId}`}
                          className="font-medium hover:underline"
                        >
                          {item.sellerName}
                        </Link>
                        <span className="tabular-nums text-xs text-text-muted">
                          {item.completed} de {item.planned}{' '}
                          {item.planned === 1 ? 'realizada' : 'realizadas'}
                          {item.inProgress > 0 ? ` · ${item.inProgress} em andamento` : ''}
                          {item.notPerformed > 0 ? ` · ${item.notPerformed} não realizada` : ''}
                        </span>
                      </div>
                      <div
                        role="img"
                        aria-label={`${item.sellerName}: ${item.completed} de ${item.planned} visitas realizadas`}
                        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
                      >
                        {item.planned > 0 && (
                          <div
                            className="h-full rounded-full border border-border bg-surface"
                            style={{ width: `${larguraPlanejada}%` }}
                          />
                        )}
                        {item.completed > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-brand"
                            style={{ width: `${larguraRealizada}%` }}
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
