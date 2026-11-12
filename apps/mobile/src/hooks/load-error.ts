import { NetworkError, RequestTimeoutError } from '@/services/api-client'
import { ApiUrlMissingError } from '@/services/api-url'

/** O aviso de uma leitura da API que falhou. `fallback` diz o que não carregou, para os demais erros. */
export function loadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiUrlMissingError) {
    return 'A URL da API não está configurada. Saia da conta e informe o endereço com um toque longo no logo AXIS.'
  }
  if (error instanceof RequestTimeoutError) {
    return 'O servidor não respondeu a tempo. Tente de novo em instantes.'
  }
  if (error instanceof NetworkError) {
    return 'Não foi possível conectar ao servidor. Confira a conexão e tente de novo.'
  }
  return fallback
}
