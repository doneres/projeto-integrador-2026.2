import { Pressable, Text, View } from 'react-native'
import type { RequiredAccessibility } from './accessibility'
import { MIN_TOUCH_TARGET } from './touch-target'

type ListItemProps = RequiredAccessibility<'button' | 'link'> & {
  title: string
  subtitle?: string
  onPress: () => void
}

export function ListItem({
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}: ListItemProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPress={onPress}
      style={{ minHeight: MIN_TOUCH_TARGET }}
      className="justify-center rounded-lg bg-surface px-4 py-3"
    >
      <View>
        <Text className="text-base font-semibold text-text">{title}</Text>
        {subtitle ? <Text className="text-sm text-textMuted">{subtitle}</Text> : null}
      </View>
    </Pressable>
  )
}
