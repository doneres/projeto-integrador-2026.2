import { type RouteFilters, routeFiltersSchema } from '@axis/contracts'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Botao, classesDeBotao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { progressoDaRota, resumoDoProgresso } from '../features/rotas/progresso'
import { useDetalhesDasRotas, useRotas, useVendedores } from '../features/rotas/queries'
import { formatarData, hojeEmSaoPaulo } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'

const POR_PAGINA = 20

/** Filtros na URL, como em Clientes. Sem data na URL, a lista abre no dia de hoje. */
function lerFiltros(parametros: URLSearchParams): RouteFilters {
  const resultado = routeFiltersSchema.safeParse({
    date: hojeEmSaoPaulo(),
    ...Object.fromEntries(parametros),
    perPage: POR_PAGINA,
  })
  return resultado.success
    ? resultado.data
    : routeFiltersSchema.parse({ date: hojeEmSaoPaulo(), perPage: POR_PAGINA })
}

/** Lista de rotas do Coordenador (#39): por dia e vendedor, com o progresso das Visitas. */
export function RotasPage() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const rotas = useRotas(filtros)
  const vendedores = useVendedores()
  const detalhes = useDetalhesDasRotas(rotas.data?.items.map((r) => r.id) ?? [])
  const mensagem = (useLocation().state as { mensagem?: string } | null)?.mensagem

  const nomeDoVendedor = (id: string) =>
    vendedores.data?.items.find((v) => v.id === id)?.name ?? 'Vendedor'
  const opcoesVendedor = [
    ['', 'Todos'] as const,
    ...(vendedores.data?.items.map((v) => [v.id, v.name] as const) ?? []),
  ]

  function aplicar(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(parametros)
    for (const [chave, valor] of Object.entries(mudancas)) {
      novos.set(chave, valor)
      if (!valor && chave !== 'date') {
        novos.delete(chave)
      }
    }
    novos.delete('page')
    setParametros(novos)
  }

  const pagina = rotas.data

  return (
    <div className="flex flex-col gap-4">
      {mensagem && (
        <p
          aria-live="polite"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {mensagem}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Campo
          rotulo="Data"
          type="date"
          value={filtros.date ?? ''}
          onChange={(evento) => aplicar({ date: evento.target.value })}
          className="w-44"
        />
        <CampoSelecao
          rotulo="Vendedor"
          opcoes={opcoesVendedor}
          value={filtros.sellerId ?? ''}
          onChange={(evento) => aplicar({ sellerId: evento.target.value })}
        />
        <Link
          to={`/rotas/nova${filtros.date ? `?date=${filtros.date}` : ''}`}
          className={classesDeBotao('primario')}
        >
          + Nova rota
        </Link>
      </div>

      {rotas.isPending && <p className="text-sm text-text-muted">Carregando rotas...</p>}

      {rotas.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          <span>{mensagemDeErro(rotas.error)}</span>
          <Botao variante="secundario" onClick={() => rotas.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {pagina && pagina.items.length === 0 && (
        <div className="rounded-md border border-border px-4 py-6 text-sm">
          <p>
            Nenhuma rota
            {filtros.date ? ` em ${formatarData(filtros.date)}` : ''}
            {filtros.sellerId ? ` para ${nomeDoVendedor(filtros.sellerId)}` : ''}.{' '}
            <Link
              to={`/rotas/nova${filtros.date ? `?date=${filtros.date}` : ''}`}
              className="underline"
            >
              Montar uma rota
            </Link>
          </p>
        </div>
      )}

      {pagina && pagina.items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Rotas{rotas.isFetching ? ' (atualizando)' : ''}</caption>
            <thead className="bg-muted text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Data
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Vendedor
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Visitas
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagina.items.map((rota, indice) => {
                const detalhe = detalhes[indice]?.data
                const nome = nomeDoVendedor(rota.sellerId)
                return (
                  <tr key={rota.id}>
                    <td className="px-4 py-3 tabular-nums">{formatarData(rota.date)}</td>
                    <td className="px-4 py-3 font-medium">{nome}</td>
                    <td className="px-4 py-3">
                      {detalhe
                        ? resumoDoProgresso(progressoDaRota(detalhe.visits))
                        : 'Carregando...'}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/rotas/${rota.id}`} className="underline">
                        Ver rota
                        <span className="sr-only">
                          {' '}
                          de {nome} em {formatarData(rota.date)}
                        </span>
                      </Link>
                    </td>
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
