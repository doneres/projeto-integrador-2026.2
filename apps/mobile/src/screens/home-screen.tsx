import { Text, View } from 'react-native'
import { Button } from '@/components/button'
import { useSession } from '@/hooks/session'

export function HomeScreen() {
  const { state, signOut } = useSession()
  const name = state.status === 'signedIn' ? state.session.user.name : null

  return (
    <View className="flex-1 justify-center gap-2 bg-background px-6">
      <Text accessibilityRole="header" className="text-3xl font-bold text-primary">
        AXIS
      </Text>
      {name ? <Text className="text-base text-textMuted">{`Olá, ${name}`}</Text> : null}
      <Text className="text-lg text-text">Rota do dia</Text>
      <Text className="text-base text-textMuted">As telas do Vendedor entram aqui.</Text>
      <View className="mt-4">
        <Button
          title="Sair"
          variant="secondary"
          accessibilityLabel="Sair da conta"
          accessibilityRole="button"
          onPress={() => void signOut()}
        />
      </View>
    </View>
  )
}
