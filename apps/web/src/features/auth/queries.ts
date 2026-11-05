import { type LoginBody, sessionSchema } from '@axis/contracts'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

export function useLogin() {
  return useMutation({
    mutationFn: (dados: LoginBody) =>
      apiFetch('/v1/auth/login', sessionSchema, { method: 'POST', body: JSON.stringify(dados) }),
  })
}
