import { Check } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { colors } from '../theme/colors'
import type { RequiredAccessibility } from './accessibility'
import { MIN_TOUCH_TARGET } from './touch-target'

type CheckboxProps = RequiredAccessibility<'checkbox'> & {
  title: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Checkbox({
  title,
  checked,
  onCheckedChange,
  accessibilityLabel,
  accessibilityRole,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked }}
      onPress={() => onCheckedChange(!checked)}
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
      className="flex-row items-center gap-3 py-2"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded border-2 ${checked ? 'border-primary bg-primary' : 'border-border bg-background'}`}
      >
        {checked ? <Check size={16} color={colors.onPrimary} strokeWidth={3} /> : null}
      </View>
      <Text className="flex-1 text-base text-text">{title}</Text>
    </Pressable>
  )
}
