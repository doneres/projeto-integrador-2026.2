import { Text, View } from 'react-native'

export function HomeScreen() {
  return (
    <View className="flex-1 justify-center gap-2 bg-background px-6">
      <Text accessibilityRole="header" className="text-3xl font-bold text-primary">
        AXIS
      </Text>
      <Text className="text-lg text-text">Rota do dia</Text>
      <Text className="text-base text-textMuted">As telas do Vendedor entram aqui.</Text>
    </View>
  )
}
