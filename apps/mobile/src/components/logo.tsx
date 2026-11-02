import { Pressable, Text } from 'react-native'
import { MIN_TOUCH_TARGET } from './touch-target'

type LogoProps = {
  /** Toque longo: abre as configurações escondidas do app. */
  onLongPress?: () => void
  accessibilityHint?: string
}

export function Logo({ onLongPress, accessibilityHint }: LogoProps) {
  return (
    <Pressable
      accessibilityLabel="AXIS"
      accessibilityRole={onLongPress ? 'button' : 'header'}
      accessibilityHint={accessibilityHint}
      accessibilityActions={onLongPress ? [{ name: 'longpress' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress?.()
      }}
      onLongPress={onLongPress}
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
      className="self-start justify-center"
    >
      <Text className="text-4xl font-bold text-primary">AXIS</Text>
    </Pressable>
  )
}
