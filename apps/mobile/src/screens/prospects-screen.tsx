import { router } from 'expo-router'
import { useEffect } from 'react'
import { AccessibilityInfo, ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Button } from '@/components/button'
import { Notice } from '@/components/notice'
import { ProspectRow } from '@/components/prospect-row'
import { useProspects } from '@/hooks/use-prospects'
import { colors } from '@/theme/colors'

const LOADING_MESSAGE = 'Carregando as prospecções…'
const EMPTY_MESSAGE =
  'Você ainda não cadastrou prospecções. Quando cadastrar, o resultado da aprovação aparece aqui.'

/** As Prospecções do Vendedor e o desfecho da aprovação de cada uma. */
export function ProspectsScreen() {
  const { state, retry } = useProspects()

  // O VoiceOver ignora accessibilityLiveRegion, que só vale no Android: anunciamos à mão.
  useEffect(() => {
    if (state.status === 'loading') AccessibilityInfo.announceForAccessibility(LOADING_MESSAGE)
    if (state.status === 'empty') AccessibilityInfo.announceForAccessibility(EMPTY_MESSAGE)
    if (state.status === 'error')
      AccessibilityInfo.announceForAccessibility(`Erro: ${state.message}`)
  }, [state])

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-3 px-6 py-8">
      <Text accessibilityRole="header" className="text-xl font-semibold text-text">
        Minhas prospecções
      </Text>

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
            accessibilityLabel="Tentar carregar as prospecções de novo"
            accessibilityRole="button"
            onPress={retry}
          />
        </>
      ) : null}

      {state.status === 'ready'
        ? state.prospects.map((prospect) => <ProspectRow key={prospect.id} prospect={prospect} />)
        : null}

      <View className="mt-4">
        <Button
          title="Voltar"
          variant="secondary"
          accessibilityLabel="Voltar para a rota do dia"
          accessibilityRole="button"
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  )
}
