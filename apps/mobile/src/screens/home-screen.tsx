import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Button } from '@/components/button'
import { Notice } from '@/components/notice'
import { RouteFreshness } from '@/components/route-freshness'
import { VisitRow } from '@/components/visit-row'
import { useSession } from '@/hooks/session'
import { useTodayRoute } from '@/hooks/use-today-route'
import { colors } from '@/theme/colors'

const LOADING_MESSAGE = 'Carregando a rota do dia…'
const EMPTY_MESSAGE = 'Sem rota hoje. Quando o Coordenador montar a sua rota, ela aparece aqui.'

export function HomeScreen() {
  const { state: session, signOut } = useSession()
  const { state, updatedAt, refreshing, refreshError, refresh, retry } = useTodayRoute()
  const name = session.status === 'signedIn' ? session.session.user.name : null

  // O VoiceOver ignora accessibilityLiveRegion, que só vale no Android: anunciamos à mão.
  useEffect(() => {
    if (state.status === 'loading') AccessibilityInfo.announceForAccessibility(LOADING_MESSAGE)
    if (state.status === 'empty') AccessibilityInfo.announceForAccessibility(EMPTY_MESSAGE)
    if (state.status === 'error')
      AccessibilityInfo.announceForAccessibility(`Erro: ${state.message}`)
  }, [state])

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-3 px-6 py-8">
      <Text accessibilityRole="header" className="text-3xl font-bold text-primary">
        AXIS
      </Text>
      {name ? <Text className="text-base text-textMuted">{`Olá, ${name}`}</Text> : null}
      <Text accessibilityRole="header" className="text-xl font-semibold text-text">
        Rota do dia
      </Text>

      {updatedAt && (state.status === 'ready' || state.status === 'empty') ? (
        <RouteFreshness
          updatedAt={updatedAt}
          refreshing={refreshing}
          error={refreshError}
          onRefresh={refresh}
        />
      ) : null}

      {state.status === 'loading' ? (
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-3 rounded-lg bg-surface p-3"
        >
          <ActivityIndicator
            accessibilityRole="progressbar"
            accessibilityLabel="Carregando"
            color={colors.primary}
          />
          <Text className="flex-1 text-base text-text">{LOADING_MESSAGE}</Text>
        </View>
      ) : null}

      {state.status === 'empty' ? (
        <View accessibilityLiveRegion="polite" className="rounded-lg bg-surface p-4">
          <Text className="text-base text-text">{EMPTY_MESSAGE}</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <>
          <Notice message={state.message} />
          <Button
            title="Tentar de novo"
            accessibilityLabel="Tentar carregar a rota de novo"
            accessibilityRole="button"
            onPress={retry}
          />
        </>
      ) : null}

      {state.status === 'ready'
        ? state.route.visits.map((visit) => <VisitRow key={visit.id} visit={visit} />)
        : null}

      <View className="mt-4">
        <Button
          title="Sair"
          variant="secondary"
          accessibilityLabel="Sair da conta"
          accessibilityRole="button"
          onPress={() => void signOut()}
        />
      </View>
    </ScrollView>
  )
}
