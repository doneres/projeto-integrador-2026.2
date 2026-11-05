import { z } from 'zod'
import { idSchema, instanteSchema } from './comum'
import { documentoSchema } from './documento'
import {
  cepSchema,
  latitudeSchema,
  longitudeSchema,
  requiredText,
  telefoneSchema,
  ufSchema,
} from './fields'
import { paginationSchema } from './pagination'

// Cliente conforme o modelo de dados (#26) e o ADR 0001.

/** `portfolio`: cadastrado pelo Coordenador. `prospect`: cadastrado em campo pelo Vendedor. Imutável. */
export const customerOriginSchema = z.enum(['portfolio', 'prospect'])
export type CustomerOrigin = z.infer<typeof customerOriginSchema>

export const customerStatusSchema = z.enum(['pending_approval', 'active', 'rejected', 'inactive'])
export type CustomerStatus = z.infer<typeof customerStatusSchema>

const reasonSchema = z.string().trim().min(1, 'Informe o motivo da rejeição').max(500)
const complementSchema = z.string().trim().max(100, 'Use no máximo 100 caracteres')

// O objeto sem refinamentos: o Zod não deixa derivar (pick, omit) de um schema refinado.
const customerObjectSchema = z.object({
  id: idSchema,
  legalName: requiredText('a razão social', 150),
  tradeName: requiredText('o nome fantasia', 150),
  document: documentoSchema,
  phone: telefoneSchema,
  contactName: requiredText('o nome do contato', 100),
  zipCode: cepSchema,
  street: requiredText('o logradouro', 150),
  number: requiredText('o número (ou S/N)', 10),
  complement: complementSchema.nullable(),
  district: requiredText('o bairro', 100),
  city: requiredText('a cidade', 100),
  state: ufSchema,
  // A localização é obrigatória: o check-in compara a posição do vendedor com ela (RN01).
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  origin: customerOriginSchema,
  status: customerStatusSchema,
  /** Dono do cliente (a Equipe). Numa prospecção, o coordenador do vendedor no cadastro. */
  coordinatorId: idSchema,
  createdById: idSchema,
  /** Preenchidos na aprovação; `approvedAt` define o mês do "novo cliente". */
  approvedById: idSchema.nullable(),
  approvedAt: instanteSchema.nullable(),
  rejectionReason: reasonSchema.nullable(),
  createdAt: instanteSchema,
  updatedAt: instanteSchema,
})

export const customerSchema = customerObjectSchema.superRefine((customer, ctx) => {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message })

  if (customer.status === 'rejected' && !customer.rejectionReason) {
    issue('rejectionReason', 'Informe o motivo da rejeição')
  }
  if (customer.status !== 'rejected' && customer.rejectionReason) {
    issue('rejectionReason', 'O motivo só existe em prospecção rejeitada')
  }
  if (Boolean(customer.approvedAt) !== Boolean(customer.approvedById)) {
    issue('approvedAt', 'A aprovação grava quem aprovou e quando, juntos')
  }
})
export type Customer = z.infer<typeof customerSchema>

/**
 * Corpo do POST /v1/customers e do PUT /v1/customers/{id}. Origem e estado não vêm do cliente da
 * API: nascem da regra (carteira ativa, prospecção pendente) e mudam por rotas próprias.
 * A prospecção criada offline também envia `id` e `occurredAt`; isso entra com o sync (#27).
 */
export const customerInputSchema = customerObjectSchema
  .pick({
    legalName: true,
    tradeName: true,
    document: true,
    phone: true,
    contactName: true,
    zipCode: true,
    street: true,
    number: true,
    district: true,
    city: true,
    state: true,
    latitude: true,
    longitude: true,
  })
  .extend({ complement: complementSchema.optional() })
export type CustomerInput = z.infer<typeof customerInputSchema>

/** Corpo do PATCH /v1/customers/{id}/status: inativar ou reativar um cliente ativo. */
export const customerStatusChangeSchema = z.object({ status: z.enum(['active', 'inactive']) })
export type CustomerStatusChange = z.infer<typeof customerStatusChangeSchema>

/** Corpo da rejeição de uma prospecção: o motivo fica no histórico. */
export const customerRejectionSchema = z.object({ reason: reasonSchema })
export type CustomerRejection = z.infer<typeof customerRejectionSchema>

/** Campos pelos quais a listagem de clientes pode ser ordenada. */
export const customerSortFieldSchema = z.enum([
  'tradeName',
  'legalName',
  'city',
  'district',
  'createdAt',
])
export type CustomerSortField = z.infer<typeof customerSortFieldSchema>

/**
 * Query do GET /v1/customers: paginação, busca por nome ou CPF/CNPJ, filtros e ordenação
 * (nome fantasia crescente por padrão).
 */
export const customerFiltersSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: customerStatusSchema.optional(),
  origin: customerOriginSchema.optional(),
  district: z.string().trim().max(100).optional(),
  sortBy: customerSortFieldSchema.default('tradeName'),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type CustomerFilters = z.infer<typeof customerFiltersSchema>
