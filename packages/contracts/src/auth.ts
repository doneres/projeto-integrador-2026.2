import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'

/** Perfis propostos na issue #20. Provisório até a decisão. */
export const perfilSchema = z.enum(['vendedor', 'coordenador', 'diretor', 'administrador'])
export type Perfil = z.infer<typeof perfilSchema>

/** Perfis que usam o painel web. O vendedor usa o app mobile (RF02). */
export const PERFIS_DO_PAINEL: readonly Perfil[] = ['coordenador', 'diretor', 'administrador']

export const usuarioSchema = z.object({
  id: idSchema,
  nome: z.string().trim().min(1),
  email: z.email(),
  matricula: z.string().trim().min(1),
  perfil: perfilSchema,
})
export type Usuario = z.infer<typeof usuarioSchema>

/** Corpo do POST /v1/auth/login (RF01): e-mail ou matrícula, e senha. */
export const loginSchema = z.object({
  identificador: z.string().trim().min(1, 'Informe o e-mail ou a matrícula'),
  senha: z.string().min(8, 'A senha tem no mínimo 8 caracteres'),
})
export type DadosLogin = z.infer<typeof loginSchema>

/** Resposta do login: token JWT, fim da validade e usuário autenticado. */
export const sessaoSchema = z.object({
  token: z.string().min(1),
  expiraEm: instanteSchema,
  usuario: usuarioSchema,
})
export type Sessao = z.infer<typeof sessaoSchema>
