import type { VisitStatus } from '@axis/contracts'

// A rota não tem status próprio (modelo de dados #26): o "status" mostrado na lista é o progresso
// das Visitas, contado a partir do `status` derivado que a API devolve em cada uma.

export const ROTULO_VISITA: Record<VisitStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  not_performed: 'Não realizada',
}

export type Progresso = Record<VisitStatus, number> & { total: number }

export function progressoDaRota(visitas: ReadonlyArray<{ status: VisitStatus }>): Progresso {
  const progresso: Progresso = {
    total: visitas.length,
    pending: 0,
    in_progress: 0,
    completed: 0,
    not_performed: 0,
  }
  for (const visita of visitas) {
    progresso[visita.status] += 1
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
