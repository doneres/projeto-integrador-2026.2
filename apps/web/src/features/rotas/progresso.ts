import type { CheckInStatus, RouteDetail, RouteVisit, VisitStatus } from '@axis/contracts'

// A rota não tem status próprio (modelo de dados #26): o "status" mostrado na lista é o progresso
// das Visitas, contado a partir do `status` derivado que a API devolve em cada uma.

export const ROTULO_VISITA: Record<VisitStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  not_performed: 'Não realizada',
}

export type Progresso = Record<VisitStatus, number> & {
  total: number
  /** Quantidade de Visitas com Check-in Fora do Raio (`checkInStatus = 'out_of_radius'`). */
  foraDoRaio: number
}

export function progressoDaRota(
  visitas: ReadonlyArray<{ status: VisitStatus; checkInStatus?: CheckInStatus | null }>,
): Progresso {
  const progresso: Progresso = {
    total: visitas.length,
    pending: 0,
    in_progress: 0,
    completed: 0,
    not_performed: 0,
    foraDoRaio: 0,
  }
  for (const visita of visitas) {
    progresso[visita.status] += 1
    if (visita.checkInStatus === 'out_of_radius') {
      progresso.foraDoRaio += 1
    }
  }
  return progresso
}

/** Ex.: "2 de 5 concluídas · 1 em andamento · 1 não realizada". Omite as contagens zeradas. */
export function resumoDoProgresso(progresso: Progresso): string {
  const partes = [
    `${progresso.completed} de ${progresso.total} ${progresso.total === 1 ? 'concluída' : 'concluídas'}`,
  ]
  if (progresso.in_progress > 0) {
    partes.push(`${progresso.in_progress} em andamento`)
  }
  if (progresso.not_performed > 0) {
    partes.push(
      `${progresso.not_performed} ${progresso.not_performed === 1 ? 'não realizada' : 'não realizadas'}`,
    )
  }
  return partes.join(' · ')
}

export type FlagDeAuditoria = {
  rotaId: string
  sellerId: string
  visita: RouteVisit
}

/**
 * Extrai todas as Visitas com Flag de auditoria (`checkInStatus = 'out_of_radius'`) das rotas
 * carregadas na tela (#62).
 */
export function flagsDeAuditoriaDasRotas(
  detalhes: ReadonlyArray<RouteDetail | undefined>,
): FlagDeAuditoria[] {
  const flags: FlagDeAuditoria[] = []
  for (const rota of detalhes) {
    if (!rota) {
      continue
    }
    for (const visita of rota.visits) {
      if (visita.checkInStatus === 'out_of_radius') {
        flags.push({ rotaId: rota.id, sellerId: rota.sellerId, visita })
      }
    }
  }
  return flags
}
