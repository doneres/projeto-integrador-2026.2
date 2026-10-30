import { Text, TextInput, type TextInputProps, View } from 'react-native'
import { colors } from '../theme/colors'
import type { RequiredAccessibility } from './accessibility'
import { MIN_TOUCH_TARGET } from './touch-target'

type TextFieldProps = RequiredAccessibility<'text' | 'search'> &
  Pick<TextInputProps, 'keyboardType' | 'secureTextEntry' | 'autoCapitalize' | 'placeholder'> & {
    label: string
    value: string
    onChangeText: (text: string) => void
    error?: string
  }

export function TextField({
  label,
  value,
  onChangeText,
  error,
  accessibilityLabel,
  accessibilityRole,
  ...inputProps
}: TextFieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        style={{ minHeight: MIN_TOUCH_TARGET }}
        className={`rounded-lg border-2 bg-background px-3 text-base text-text ${error ? 'border-danger' : 'border-border'}`}
      />
      {error ? <Text className="text-sm text-danger">{`Erro: ${error}`}</Text> : null}
    </View>
  )
}
