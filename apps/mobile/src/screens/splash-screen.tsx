import { ActivityIndicator, Text, View } from 'react-native'
import { colors } from '@/theme/colors'

/** Enquanto o app lê a sessão guardada no aparelho (leva milissegundos, sem rede). */
export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <Text className="text-4xl font-bold text-primary">AXIS</Text>
      <ActivityIndicator accessibilityLabel="Carregando" color={colors.primary} />
    </View>
  )
}
