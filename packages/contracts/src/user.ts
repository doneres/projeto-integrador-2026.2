import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'
import { paginationSchema } from './pagination'

// Contrato em inglês de usuário e login (ADR 0001, modelo de dados #26, RF01, RF02, RF03, #20, #45).

export const roleSchema = z.enum(['seller', 'coordinator', 'director', 'administrator'])
export type Role = z.infer<typeof roleSchema>

/** Perfis que usam o painel web. O vendedor usa o app mobile (RF02). */
export const PANEL_ROLES: readonly Role[] = ['coordinator', 'director', 'administrator']

export const userSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  /** Matrícula: também serve para entrar. */
  registration: z.string().trim().min(1),
  role: roleSchema,
  /** Só o vendedor tem coordenador. */
  coordinatorId: idSchema.nullable(),
  /** Conta ativa confere acesso no login e a cada requisição (#20). */
  active: z.boolean().default(true),
})
export type User = z.infer<typeof userSchema>

export const userWithCoordinatorSchema = userSchema.extend({
  coordinatorName: z.string().nullable().optional(),
})
export type UserWithCoordinator = z.infer<typeof userWithCoordinatorSchema>

/**
 * Corpo do POST /v1/users (#45): Administrador cadastra nova conta no sistema (R2).
 * Vendedor exige coordenador obrigatório; outros perfis não admitem coordenador.
 */
export const userInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe o nome completo')
      .max(150, 'Use no máximo 150 caracteres'),
    email: z.string().trim().email('Informe um e-mail válido').max(150),
    registration: z
      .string()
      .trim()
      .min(1, 'Informe a matrícula')
      .max(50, 'Use no máximo 50 caracteres'),
    role: roleSchema,
    coordinatorId: idSchema.nullable().optional(),
    password: z
      .string()
      .min(6, 'A senha deve ter no mínimo 6 caracteres')
      .max(128, 'A senha tem no máximo 128 caracteres')
      .optional(),
  })
  .refine((u) => (u.role === 'seller' ? Boolean(u.coordinatorId) : true), {
    message: 'Vendedores devem ser vinculados a um Coordenador',
    path: ['coordinatorId'],
  })
  .transform((u) => ({
    ...u,
    coordinatorId: u.role === 'seller' ? (u.coordinatorId ?? null) : null,
  }))
export type UserInput = z.infer<typeof userInputSchema>

/**
 * Corpo do PUT /v1/users/{id} (#45): Administrador edita dados da conta.
 */
export const userUpdateInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe o nome completo')
      .max(150, 'Use no máximo 150 caracteres'),
    email: z.string().trim().email('Informe um e-mail válido').max(150),
    registration: z
      .string()
      .trim()
      .min(1, 'Informe a matrícula')
      .max(50, 'Use no máximo 50 caracteres'),
    role: roleSchema,
    coordinatorId: idSchema.nullable().optional(),
  })
  .refine((u) => (u.role === 'seller' ? Boolean(u.coordinatorId) : true), {
    message: 'Vendedores devem ser vinculados a um Coordenador',
    path: ['coordinatorId'],
  })
  .transform((u) => ({
    ...u,
    coordinatorId: u.role === 'seller' ? (u.coordinatorId ?? null) : null,
  }))
export type UserUpdateInput = z.infer<typeof userUpdateInputSchema>

/** Corpo do PATCH /v1/users/{id}/status: Administrador ativa ou desativa uma conta (#20, #45). */
export const userStatusChangeSchema = z.object({
  active: z.boolean(),
})
export type UserStatusChange = z.infer<typeof userStatusChangeSchema>

/** Corpo do POST /v1/users/{id}/password-reset: Administrador redefine senha do usuário (RF03, #20, #45). */
export const passwordResetSchema = z.object({
  newPassword: z
    .string()
    .min(6, 'A nova senha deve ter no mínimo 6 caracteres')
    .max(128, 'A senha tem no máximo 128 caracteres'),
})
export type PasswordReset = z.infer<typeof passwordResetSchema>

export const userSortFieldSchema = z.enum(['name', 'email', 'registration', 'role'])
export type UserSortField = z.infer<typeof userSortFieldSchema>

/**
 * Query do GET /v1/users (#45, #79): paginação e filtros por perfil, busca, status ativo e coordenador.
 */
export const userFiltersSchema = paginationSchema.extend({
  role: roleSchema.optional(),
  search: z.string().trim().max(100).optional(),
  active: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  coordinatorId: idSchema.optional(),
  sortBy: userSortFieldSchema.default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type UserFilters = z.infer<typeof userFiltersSchema>

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
