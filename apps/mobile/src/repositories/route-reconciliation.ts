import type { RouteDetail, VisitStatus } from '@axis/contracts'

/** O que o servidor já encerrou vale mais que a Visita em andamento que a tela ainda mostra. */
const SERVER_WINS: VisitStatus[] = ['completed', 'not_performed']

/**
 * Junta a rota recém-lida com a que está na tela. Uma Visita em andamento é do Vendedor, que está
 * no meio do atendimento: a atualização não a devolve a Pendente nem a faz sumir. Se o servidor já
 * a encerrou (Concluída ou Não realizada), vale o servidor. O resto da rota vem do servidor.
 * `incoming` é `null` quando o Coordenador não tem rota para hoje.
 *
 * Quando a fila de operações existir (#27), as Visitas com operação pendente entram na mesma
 * regra: o snapshot nunca sobrescreve o que ainda não foi enviado.
 */
export function reconcileRoute(
  current: RouteDetail | null,
  incoming: RouteDetail | null,
): RouteDetail | null {
  const protectedVisits = (current?.visits ?? []).filter((visit) => {
    if (visit.status !== 'in_progress') return false
    const fromServer = incoming?.visits.find((candidate) => candidate.id === visit.id)
    return !fromServer || !SERVER_WINS.includes(fromServer.status)
  })
  if (!current || protectedVisits.length === 0) return incoming

  const base = incoming ?? current
  const protectedIds = new Set(protectedVisits.map((visit) => visit.id))
  const visits = [
    ...(incoming?.visits ?? []).filter((visit) => !protectedIds.has(visit.id)),
    ...protectedVisits,
  ].sort((a, b) => a.position - b.position)
  return { ...base, visits }
}
