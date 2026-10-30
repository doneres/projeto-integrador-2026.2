import { Pressable, Text } from 'react-native'
import type { RequiredAccessibility } from './accessibility'
import { MIN_TOUCH_TARGET } from './touch-target'

type Variant = 'primary' | 'secondary' | 'danger'

type ButtonProps = RequiredAccessibility<'button' | 'link'> & {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
}

const containerStyles: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'border-2 border-primary bg-background',
  danger: 'bg-danger',
}

const textStyles: Record<Variant, string> = {
  primary: 'text-onPrimary',
  secondary: 'text-primary',
  danger: 'text-onDanger',
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityRole,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
      className={`items-center justify-center rounded-lg px-4 py-3 ${containerStyles[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`text-base font-semibold ${textStyles[variant]}`}>{title}</Text>
    </Pressable>
  )
}
