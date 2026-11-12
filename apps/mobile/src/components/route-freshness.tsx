import { Text, View } from 'react-native'
import { Button } from './button'
import { Notice } from './notice'

type RouteFreshnessProps = {
  /** Hora da última leitura bem-sucedida da rota. */
  updatedAt: Date
  refreshing: boolean
  /** Por que a última atualização falhou; `null` se não falhou. */
  error: string | null
  onRefresh: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "09:05", sempre com dois dígitos, na hora local do aparelho. */
export function timeLabel(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "9 horas e 5 minutos": o leitor de tela não lê "09:05" de forma confiável como hora. */
export function spokenClock(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hoursText = `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (minutes === 0) return hoursText
  return `${hoursText} e ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}

/**
 * Frescor da rota: a hora da última atualização e o botão "Atualizar". Sem rede, a hora continua
 * a da última leitura que deu certo e um aviso diz que a atualização falhou.
 */
export function RouteFreshness({ updatedAt, refreshing, error, onRefresh }: RouteFreshnessProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-3">
        <Text
          accessibilityLabel={`Rota atualizada às ${spokenClock(updatedAt)}`}
          className="flex-1 text-base text-textMuted"
        >
          {`Rota atualizada às ${timeLabel(updatedAt)}`}
        </Text>
        <Button
          title="Atualizar"
          variant="secondary"
          accessibilityLabel="Atualizar a rota do dia"
          accessibilityRole="button"
          disabled={refreshing}
          onPress={onRefresh}
        />
      </View>
      {refreshing ? (
        <Text accessibilityLiveRegion="polite" className="text-base text-textMuted">
          Atualizando a rota…
        </Text>
      ) : null}
      {error ? <Notice message={error} /> : null}
    </View>
  )
}
