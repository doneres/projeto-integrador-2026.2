import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { useApiUrl } from '@/hooks/use-api-url'

type ApiUrlPanelProps = {
  onClose: () => void
}

/** Troca a URL da API dentro do app. Fica escondida atrás do toque longo no logo. */
export function ApiUrlPanel({ onClose }: ApiUrlPanelProps) {
  const { current, isCustom, loaded, error, save, reset, clearError, isInsecure } = useApiUrl()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (loaded) setDraft(current ?? '')
  }, [loaded, current])

  return (
    <View className="gap-3 rounded-lg bg-surface p-4">
      <Text accessibilityRole="header" className="text-lg font-semibold text-text">
        Endereço da API
      </Text>
      <Text className="text-sm text-textMuted">
        {isCustom
          ? 'Usando o endereço guardado neste aparelho.'
          : 'Usando o endereço do app. Troque aqui se o servidor mudou de lugar.'}
      </Text>
      <TextField
        label="URL da API"
        value={draft}
        onChangeText={(text) => {
          setDraft(text)
          clearError()
        }}
        error={error ?? undefined}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://axis-api.onrender.com"
        accessibilityLabel="URL da API"
        accessibilityRole="text"
      />
      {isInsecure(draft) ? (
        <Text className="text-sm text-text">
          Atenção: endereço sem https. O e-mail, a matrícula e a senha viajam sem criptografia. Use
          só na rede local de desenvolvimento.
        </Text>
      ) : null}
      <Button
        title="Salvar"
        accessibilityLabel="Salvar URL da API"
        accessibilityRole="button"
        onPress={() => void save(draft)}
      />
      {isCustom ? (
        <Button
          title="Usar a do app"
          variant="secondary"
          accessibilityLabel="Usar a URL do app"
          accessibilityRole="button"
          onPress={() => void reset()}
        />
      ) : null}
      <Button
        title="Fechar"
        variant="secondary"
        accessibilityLabel="Fechar configuração da API"
        accessibilityRole="button"
        onPress={onClose}
      />
    </View>
  )
}
