import { type ComponentRef, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Button } from '@/components/button'
import { Logo } from '@/components/logo'
import { Notice } from '@/components/notice'
import { TextField, type TextFieldHandle } from '@/components/text-field'
import { useLogin } from '@/hooks/use-login'
import { colors } from '@/theme/colors'
import { ApiUrlPanel } from './api-url-panel'

type BusyStatus = 'submitting' | 'waking'

const LOADING_MESSAGE: Record<BusyStatus, string> = {
  submitting: 'Entrando…',
  waking:
    'Acordando o servidor… Se ele estava dormindo, pode levar até um minuto. Aguarde, não feche o app.',
}

export function LoginScreen() {
  const login = useLogin()
  const [showApiUrl, setShowApiUrl] = useState(false)
  const identifierRef = useRef<TextFieldHandle>(null)
  const passwordRef = useRef<TextFieldHandle>(null)
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const { status, formError } = login

  // O VoiceOver ignora accessibilityLiveRegion, que só vale no Android: anunciamos à mão.
  useEffect(() => {
    if (status !== 'idle') AccessibilityInfo.announceForAccessibility(LOADING_MESSAGE[status])
  }, [status])
  useEffect(() => {
    if (formError) AccessibilityInfo.announceForAccessibility(`Erro: ${formError}`)
  }, [formError])

  // O painel abre no fim da tela: leva a rolagem até ele para o teclado não escondê-lo.
  useEffect(() => {
    if (showApiUrl) scrollRef.current?.scrollToEnd({ animated: true })
  }, [showApiUrl])

  async function handleSubmit() {
    const result = await login.submit()
    if (result.ok) return
    if (result.focus === 'identifier') identifierRef.current?.focus()
    if (result.focus === 'password') passwordRef.current?.focus()
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        contentContainerClassName="flex-grow justify-center gap-4 px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <Logo
          onLongPress={() => setShowApiUrl(true)}
          accessibilityHint="Toque longo para trocar o endereço da API"
        />
        <Text accessibilityRole="header" className="text-2xl font-semibold text-text">
          Entrar
        </Text>
        <Text className="text-base text-textMuted">
          Use o e-mail ou a matrícula e a senha da sua conta de Vendedor.
        </Text>

        <TextField
          label="E-mail ou matrícula"
          value={login.identifier}
          onChangeText={login.setIdentifier}
          error={login.fieldErrors.identifier}
          inputRef={identifierRef}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabel="E-mail ou matrícula"
          accessibilityRole="text"
        />
        <TextField
          label="Senha"
          value={login.password}
          onChangeText={login.setPassword}
          error={login.fieldErrors.password}
          inputRef={passwordRef}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={() => void handleSubmit()}
          accessibilityLabel="Senha"
          accessibilityRole="text"
        />

        {formError ? <Notice message={formError} /> : null}

        {status !== 'idle' ? (
          <View
            accessibilityLiveRegion="polite"
            className="flex-row items-center gap-3 rounded-lg bg-surface p-3"
          >
            <ActivityIndicator
              accessibilityRole="progressbar"
              accessibilityLabel="Carregando"
              color={colors.primary}
            />
            <Text className="flex-1 text-base text-text">{LOADING_MESSAGE[status]}</Text>
          </View>
        ) : null}

        <Button
          title="Entrar"
          disabled={status !== 'idle'}
          accessibilityLabel="Entrar"
          accessibilityRole="button"
          onPress={() => void handleSubmit()}
        />

        {showApiUrl ? <ApiUrlPanel onClose={() => setShowApiUrl(false)} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
