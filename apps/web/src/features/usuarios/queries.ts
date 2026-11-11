import {
  type Page,
  type PasswordReset,
  pageOf,
  type UserFilters,
  type UserInput,
  type UserStatusChange,
  type UserUpdateInput,
  type UserWithCoordinator,
  userSchema,
  userWithCoordinatorSchema,
} from '@axis/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiFetch } from '../../lib/api'
import { paraQueryString } from '../clientes/queries'

const paginaDeUsuariosSchema = pageOf(userWithCoordinatorSchema)
const respostaMensagemSchema = z.object({ message: z.string() })

export const usuariosKeys = {
  all: ['usuarios'] as const,
  lists: () => [...usuariosKeys.all, 'list'] as const,
  list: (filtros: UserFilters) => [...usuariosKeys.lists(), filtros] as const,
  detail: (id: string) => [...usuariosKeys.all, 'detail', id] as const,
  coordenadores: () => [...usuariosKeys.all, 'coordenadores'] as const,
}

export function useUsuarios(filtros: UserFilters) {
  return useQuery<Page<UserWithCoordinator>>({
    queryKey: usuariosKeys.list(filtros),
    queryFn: () => apiFetch(`/v1/users?${paraQueryString(filtros)}`, paginaDeUsuariosSchema),
    placeholderData: keepPreviousData,
  })
}

export function useUsuario(id: string | undefined) {
  return useQuery({
    queryKey: usuariosKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`/v1/users/${encodeURIComponent(id ?? '')}`, userWithCoordinatorSchema),
    enabled: Boolean(id),
  })
}

/** Busca os coordenadores ativos para o combo de seleção de vendedores. */
export function useCoordenadores() {
  return useQuery<Page<UserWithCoordinator>>({
    queryKey: usuariosKeys.coordenadores(),
    queryFn: () =>
      apiFetch(
        `/v1/users?${paraQueryString({ role: 'coordinator', active: true, perPage: 100 })}`,
        paginaDeUsuariosSchema,
      ),
    staleTime: 5 * 60 * 1000,
  })
}

/** Cadastra (sem id) ou edita (com id) um usuário do sistema. */
export function useSalvarUsuario(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: UserInput | UserUpdateInput) =>
      apiFetch(id ? `/v1/users/${encodeURIComponent(id)}` : '/v1/users', userSchema, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(dados),
      }),
    onSuccess: (usuario) => {
      queryClient.setQueryData(usuariosKeys.detail(usuario.id), usuario)
      queryClient.invalidateQueries({ queryKey: usuariosKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usuariosKeys.coordenadores() })
    },
  })
}

/** Ativa ou desativa uma conta no sistema. */
export function useAlterarStatusUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string } & UserStatusChange) =>
      apiFetch(`/v1/users/${encodeURIComponent(id)}/status`, userSchema, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: (usuario) => {
      queryClient.setQueryData(usuariosKeys.detail(usuario.id), usuario)
      queryClient.invalidateQueries({ queryKey: usuariosKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usuariosKeys.coordenadores() })
    },
  })
}

/** Redefine a senha de um usuário (RF03). */
export function useRedefinirSenha() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string } & PasswordReset) =>
      apiFetch(`/v1/users/${encodeURIComponent(id)}/password-reset`, respostaMensagemSchema, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
  })
}
