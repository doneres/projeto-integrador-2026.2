import type { Prospect } from '@axis/contracts'
import { CircleCheck, CircleX, Clock, type LucideIcon } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { MIN_TOUCH_TARGET } from './touch-target'

type ProspectStatus = Prospect['status']

export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  pending_approval: 'Pendente de aprovação',
  active: 'Aprovada',
  rejected: 'Rejeitada',
  // Uma Prospecção aprovada que o Coordenador depois inativou: para o Vendedor, continua aprovada.
  inactive: 'Aprovada (cliente inativo)',
}

/** O estado nunca é só cor: cada um tem texto e um ícone de forma própria. */
const STATUS_ICON: Record<ProspectStatus, { Icon: LucideIcon; color: string }> = {
  pending_approval: { Icon: Clock, color: colors.textMuted },
  active: { Icon: CircleCheck, color: colors.text },
  rejected: { Icon: CircleX, color: colors.danger },
  inactive: { Icon: CircleCheck, color: colors.textMuted },
}

/**
 * Uma Prospecção do Vendedor, com o estado da aprovação e, se Rejeitada, o motivo. Só mostra, num
 * único bloco para o leitor de tela.
 */
export function ProspectRow({ prospect }: { prospect: Prospect }) {
  const label = PROSPECT_STATUS_LABEL[prospect.status]
  const reason = prospect.status === 'rejected' ? prospect.rejectionReason : null
  const { Icon, color } = STATUS_ICON[prospect.status]
  const spoken = [prospect.tradeName, label, reason ? `Motivo: ${reason}` : null]
    .filter(Boolean)
    .join(', ')

  return (
    <View
      testID="prospect-row"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Prospecção ${spoken}`}
      style={{ minHeight: MIN_TOUCH_TARGET }}
      className="gap-1 rounded-lg bg-surface px-4 py-3"
    >
      <Text className="text-base font-semibold text-text">{prospect.tradeName}</Text>
      <Text className="text-sm text-textMuted">{`${prospect.district} · ${prospect.city}/${prospect.state}`}</Text>
      <View className="flex-row items-center gap-2">
        <View testID={`prospect-status-icon-${prospect.status}`}>
          <Icon color={color} size={20} />
        </View>
        <Text className="text-sm font-semibold text-text">{label}</Text>
      </View>
      {reason ? <Text className="text-sm text-danger">{`Motivo: ${reason}`}</Text> : null}
    </View>
  )
}
