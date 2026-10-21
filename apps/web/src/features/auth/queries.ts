import { type DadosLogin, sessaoSchema } from '@axis/contracts'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

export function useLogin() {
  return useMutation({
    mutationFn: (dados: DadosLogin) =>
      apiFetch('/v1/auth/login', sessaoSchema, { method: 'POST', body: JSON.stringify(dados) }),
  })
}
