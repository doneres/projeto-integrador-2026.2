import type { ComponentRef, Ref } from 'react'
import { Text, TextInput, type TextInputProps, View } from 'react-native'
import { colors } from '../theme/colors'
import type { RequiredAccessibility } from './accessibility'
import { MIN_TOUCH_TARGET } from './touch-target'

/** O que a tela pode fazer com o campo (por exemplo, `focus()`). */
export type TextFieldHandle = ComponentRef<typeof TextInput>

type TextFieldProps = RequiredAccessibility<'text' | 'search'> &
  Pick<
    TextInputProps,
    | 'keyboardType'
    | 'secureTextEntry'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'autoComplete'
    | 'placeholder'
    | 'returnKeyType'
    | 'onSubmitEditing'
    | 'editable'
  > & {
    label: string
    value: string
    onChangeText: (text: string) => void
    error?: string
    /** Permite à tela mover o foco para o campo (por exemplo, o primeiro campo inválido). */
    inputRef?: Ref<TextFieldHandle>
  }

export function TextField({
  label,
  value,
  onChangeText,
  error,
  inputRef,
  accessibilityLabel,
  accessibilityRole,
  ...inputProps
}: TextFieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <TextInput
        {...inputProps}
        ref={inputRef}
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
