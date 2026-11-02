import { z } from 'zod'
import { idSchema, instanteSchema, paginacaoSchema } from './comum'
import { documentoSchema } from './documento'
import { cepSchema, coordenadasSchema, requiredText, telefoneSchema, ufSchema } from './fields'

// Estes campos moraram aqui; seguem exportados para quem importa do contrato antigo.
export { type Coordenadas, cepSchema, coordenadasSchema, telefoneSchema, ufSchema } from './fields'

const textoObrigatorio = requiredText

export const enderecoSchema = z.object({
  cep: cepSchema,
  logradouro: textoObrigatorio('o logradouro', 150),
  numero: textoObrigatorio('o número (ou S/N)', 10),
  complemento: z.string().trim().max(100, 'Use no máximo 100 caracteres').optional(),
  bairro: textoObrigatorio('o bairro', 100),
  cidade: textoObrigatorio('a cidade', 100),
  uf: ufSchema,
})
export type Endereco = z.infer<typeof enderecoSchema>

export const tipoClienteSchema = z.enum(['carteira', 'prospeccao'])
export type TipoCliente = z.infer<typeof tipoClienteSchema>
export const statusClienteSchema = z.enum(['ativo', 'inativo'])
export type StatusCliente = z.infer<typeof statusClienteSchema>

/**
 * Cliente, com os campos da RF05 e os filtros da RF06.
 * Provisório: o modelo definitivo é decidido na issue #26 (modelo de domínio e de dados).
 */
export const clienteSchema = z.object({
  id: idSchema,
  razaoSocial: textoObrigatorio('a razão social', 150),
  nomeFantasia: textoObrigatorio('o nome fantasia', 150),
  documento: documentoSchema,
  telefone: telefoneSchema,
  contato: textoObrigatorio('o nome do contato', 100),
  endereco: enderecoSchema,
  localizacao: coordenadasSchema,
  tipo: tipoClienteSchema,
  status: statusClienteSchema,
  criadoEm: instanteSchema,
  atualizadoEm: instanteSchema,
})
export type Cliente = z.infer<typeof clienteSchema>

/** Corpo do POST /v1/clientes e do PUT /v1/clientes/{id}. O status muda por rota própria. */
export const dadosClienteSchema = clienteSchema.pick({
  razaoSocial: true,
  nomeFantasia: true,
  documento: true,
  telefone: true,
  contato: true,
  endereco: true,
  localizacao: true,
  tipo: true,
})
export type DadosCliente = z.infer<typeof dadosClienteSchema>

/** Corpo do PATCH /v1/clientes/{id}/status (inativar ou reativar). */
export const alteracaoStatusClienteSchema = z.object({ status: statusClienteSchema })
export type AlteracaoStatusCliente = z.infer<typeof alteracaoStatusClienteSchema>

/** Query do GET /v1/clientes: paginação, busca por nome ou CPF/CNPJ e filtros da RF06. */
export const filtrosClientesSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(100).optional(),
  status: statusClienteSchema.optional(),
  tipo: tipoClienteSchema.optional(),
  bairro: z.string().trim().max(100).optional(),
})
export type FiltrosClientes = z.infer<typeof filtrosClientesSchema>
