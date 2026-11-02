import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider, useSession } from '@/hooks/session'
import { SplashScreen } from '@/screens/splash-screen'

function RootNavigator() {
  const { state } = useSession()
  if (state.status === 'loading') return <SplashScreen />

  // Rotas protegidas: sem sessão só existe o login; com sessão, só o app. Ao perder a sessão
  // (sair, 401, validade de 8 h), o Expo Router volta sozinho para a primeira rota liberada.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'signedIn'}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  )
}
