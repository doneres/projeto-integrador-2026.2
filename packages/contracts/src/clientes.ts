import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'

/** UF brasileira em maiúsculas. Ex.: GO */
export const ufSchema = z.string().regex(/^[A-Z]{2}$/, 'A UF deve ter 2 letras maiúsculas')

/** CEP só com dígitos; a máscara 00000-000 é responsabilidade da interface. */
export const cepSchema = z.string().regex(/^\d{8}$/, 'O CEP deve ter 8 dígitos')

/** CPF (11 dígitos) ou CNPJ (14 dígitos), só com dígitos. */
export const documentoSchema = z
  .string()
  .regex(/^(\d{11}|\d{14})$/, 'Informe um CPF (11 dígitos) ou um CNPJ (14 dígitos)')

/** Telefone com DDD, só com dígitos: 10 (fixo) ou 11 (celular). */
export const telefoneSchema = z
  .string()
  .regex(/^\d{10,11}$/, 'O telefone deve ter DDD e 8 ou 9 dígitos')

export const enderecoSchema = z.object({
  cep: cepSchema,
  logradouro: z.string().trim().min(1).max(150),
  numero: z.string().trim().min(1).max(10),
  complemento: z.string().trim().max(100).optional(),
  bairro: z.string().trim().min(1).max(100),
  cidade: z.string().trim().min(1).max(100),
  uf: ufSchema,
})
export type Endereco = z.infer<typeof enderecoSchema>

/** Coordenadas em graus decimais (WGS 84), usadas na validação do check-in (RN01). */
export const coordenadasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
export type Coordenadas = z.infer<typeof coordenadasSchema>

export const tipoClienteSchema = z.enum(['carteira', 'prospeccao'])
export const statusClienteSchema = z.enum(['ativo', 'inativo'])

/**
 * Cliente, com os campos da RF05 e os filtros da RF06.
 * Provisório: o modelo definitivo é decidido na issue #26 (modelo de domínio e de dados).
 */
export const clienteSchema = z.object({
  id: idSchema,
  razaoSocial: z.string().trim().min(1).max(150),
  nomeFantasia: z.string().trim().min(1).max(150),
  documento: documentoSchema,
  telefone: telefoneSchema,
  contato: z.string().trim().min(1).max(100),
  endereco: enderecoSchema,
  localizacao: coordenadasSchema,
  tipo: tipoClienteSchema,
  status: statusClienteSchema,
  criadoEm: instanteSchema,
  atualizadoEm: instanteSchema,
})
export type Cliente = z.infer<typeof clienteSchema>
