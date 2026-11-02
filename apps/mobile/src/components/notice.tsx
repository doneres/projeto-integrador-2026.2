import { CircleAlert } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { colors } from '../theme/colors'

type NoticeProps = {
  message: string
}

/** Aviso de erro da tela. O leitor de tela o anuncia assim que aparece. Nunca depende só da cor. */
export function Notice({ message }: NoticeProps) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="flex-row items-start gap-2 rounded-lg border-2 border-danger bg-surface p-3"
    >
      <CircleAlert color={colors.danger} size={20} />
      <Text className="flex-1 text-base text-danger">{`Erro: ${message}`}</Text>
    </View>
  )
}
