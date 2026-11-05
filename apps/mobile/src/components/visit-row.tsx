import type { RouteVisit, VisitStatus } from '@axis/contracts'
import { CircleCheck, CirclePlay, CircleX, Clock, type LucideIcon } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { MIN_TOUCH_TARGET } from './touch-target'

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  not_performed: 'Não realizada',
}

/** O estado nunca é só cor: cada um tem texto e um ícone de forma própria. */
const STATUS_ICON: Record<VisitStatus, { Icon: LucideIcon; color: string }> = {
  pending: { Icon: Clock, color: colors.textMuted },
  in_progress: { Icon: CirclePlay, color: colors.primary },
  completed: { Icon: CircleCheck, color: colors.text },
  not_performed: { Icon: CircleX, color: colors.danger },
}

function formatAddress({
  street,
  number,
  complement,
  district,
  city,
  state,
}: RouteVisit['customer']) {
  const line = complement ? `${street}, ${number} - ${complement}` : `${street}, ${number}`
  return `${line} · ${district} · ${city}/${state}`
}

/**
 * Uma Visita da rota do dia. Só mostra: o detalhe e o check-in entram nas próximas telas, e o
 * item é um único bloco para o leitor de tela (nome, endereço e estado numa fala só).
 */
export function VisitRow({ visit }: { visit: RouteVisit }) {
  const address = formatAddress(visit.customer)
  const label = VISIT_STATUS_LABEL[visit.status]
  const { Icon, color } = STATUS_ICON[visit.status]

  return (
    <View
      testID="visit-row"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Visita ${visit.position}: ${visit.customer.tradeName}, ${address}, ${label}`}
      style={{ minHeight: MIN_TOUCH_TARGET }}
      className="gap-1 rounded-lg bg-surface px-4 py-3"
    >
      <Text className="text-base font-semibold text-text">{visit.customer.tradeName}</Text>
      <Text className="text-sm text-textMuted">{address}</Text>
      <View className="flex-row items-center gap-2">
        <View testID={`visit-status-icon-${visit.status}`}>
          <Icon color={color} size={20} />
        </View>
        <Text className="text-sm font-semibold text-text">{label}</Text>
      </View>
    </View>
  )
}
