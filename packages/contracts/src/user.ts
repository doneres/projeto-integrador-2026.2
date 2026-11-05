import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'

// Contrato em inglês de usuário e login (ADR 0001, modelo de dados #26).

export const roleSchema = z.enum(['seller', 'coordinator', 'director', 'administrator'])
export type Role = z.infer<typeof roleSchema>

/** Perfis que usam o painel web. O vendedor usa o app mobile (RF02). */
export const PANEL_ROLES: readonly Role[] = ['coordinator', 'director', 'administrator']

export const userSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  email: z.email(),
  /** Matrícula: também serve para entrar. */
  registration: z.string().trim().min(1),
  role: roleSchema,
  /** Só o vendedor tem coordenador. */
  coordinatorId: idSchema.nullable(),
})
export type User = z.infer<typeof userSchema>

/** Corpo do POST /v1/auth/login: e-mail ou matrícula, e senha. */
export const loginBodySchema = z.object({
  identifier: z.string().trim().min(1, 'Informe o e-mail ou a matrícula'),
  // O teto evita que uma senha de megabytes faça o argon2 gastar CPU à toa.
  password: z.string().min(1, 'Informe a senha').max(128, 'A senha tem no máximo 128 caracteres'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

/** Resposta do login: JWT de 8 h, fim da validade e usuário autenticado. */
export const sessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: instanteSchema,
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>
