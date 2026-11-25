import type { Outcome, RouteVisit } from '@axis/contracts'
import { Link, useLocation, useParams } from 'react-router'
import { IndicadorDeFrescor } from '../components/ui/IndicadorDeFrescor'
import { progressoDaRota, ROTULO_VISITA, resumoDoProgresso } from '../features/rotas/progresso'
import { useRota, useVendedores } from '../features/rotas/queries'
import { formatarData, formatarHora } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'

const ROTULO_DESFECHO: Record<Outcome, string> = {
  sale_made: 'Venda realizada',
  audit_only: 'Só auditoria',
  customer_closed: 'Cliente fechado',
  not_performed: 'Não realizada',
}

function CheckIn({ visita }: { visita: RouteVisit }) {
  if (!visita.checkedInAt) {
    return <span className="text-text-muted">—</span>
  }
  const hora = formatarHora(visita.checkedInAt)
  // Flag de auditoria (modelo de dados #26): check-in fora do raio, com a justificativa.
  if (visita.checkInStatus === 'out_of_radius') {
    return (
      <div className="flex flex-col gap-1">
        <span>
          {hora}{' '}
          <span className="rounded border border-erro px-1.5 py-0.5 text-xs font-medium text-erro">
            Fora do raio ({Math.round(visita.checkInDistanceMeters ?? 0)} m)
          </span>
        </span>
        {visita.checkInJustification && (
          <span className="text-xs text-text-muted">“{visita.checkInJustification}”</span>
        )}
      </div>
    )
  }
  return <span>{hora}</span>
}

/** Visitas de uma rota na ordem, com o estado e as Flags de auditoria ao vivo (#39, #62). */
export function RotaDetalhePage() {
  const { id } = useParams()
  const rota = useRota(id)
  const vendedores = useVendedores()
  const mensagem = (useLocation().state as { mensagem?: string } | null)?.mensagem

  if (rota.isPending) {
    return <p className="text-sm text-text-muted">Carregando rota...</p>
  }
  if (rota.isError && !rota.data) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span>{mensagemDeErro(rota.error)}</span>
        <Link to="/rotas" className="underline">
          Voltar para as rotas
        </Link>
      </div>
    )
  }

  const { data } = rota
  if (!data) {
    return null
  }
  const vendedor = vendedores.data?.items.find((v) => v.id === data.sellerId)?.name ?? 'Vendedor'
  const progresso = progressoDaRota(data.visits)

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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">
            {vendedor} · {formatarData(data.date)}
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span>{resumoDoProgresso(progresso)}</span>
            {progresso.foraDoRaio > 0 && (
              <span className="rounded border border-erro px-1.5 py-0.5 text-xs font-medium text-erro">
                {progresso.foraDoRaio}{' '}
                {progresso.foraDoRaio === 1 ? 'flag fora do raio' : 'flags fora do raio'}
              </span>
            )}
          </p>
        </div>
        <Link to={`/rotas?date=${data.date}`} className="text-sm underline">
          Voltar para as rotas do dia
        </Link>
      </div>

      <IndicadorDeFrescor
        atualizadoEm={rota.dataUpdatedAt}
        atualizando={rota.isFetching}
        comErro={rota.isError}
        onAtualizar={() => {
          rota.refetch()
        }}
      />

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Visitas da rota, na ordem</caption>
          <thead className="bg-muted text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Cliente
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Check-in
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Desfecho
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.visits.map((visita) => (
              <tr key={visita.id}>
                <td className="px-4 py-3 tabular-nums text-text-muted">{visita.position}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{visita.customer.tradeName}</p>
                  <p className="text-text-muted">
                    {visita.customer.district} · {visita.customer.city}
                  </p>
                </td>
                <td className="px-4 py-3">{ROTULO_VISITA[visita.status]}</td>
                <td className="px-4 py-3">
                  <CheckIn visita={visita} />
                </td>
                <td className="px-4 py-3">
                  {visita.outcome ? (
                    <div className="flex flex-col gap-1">
                      <span>{ROTULO_DESFECHO[visita.outcome]}</span>
                      {visita.outcomeJustification && (
                        <span className="text-xs text-text-muted">
                          “{visita.outcomeJustification}”
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
