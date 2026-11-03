import {
  apenasDigitos,
  type Customer,
  customerInputSchema,
  normalizarDocumento,
} from '@axis/contracts'
import { z } from 'zod'
import { formatarCep, formatarDocumento, formatarTelefone } from '../../lib/formatacao'

function numeroDecimal(nome: string) {
  return z
    .string()
    .trim()
    .min(1, `Informe a ${nome}`)
    .transform((valor) => Number(valor.replace(',', '.')))
    .pipe(z.number({ error: `A ${nome} deve ser um número. Ex.: -16.6869` }))
}

const campos = customerInputSchema.shape

/**
 * Formulário de cliente: aceita o que o usuário digita (com máscara, vírgula decimal)
 * e entrega os dados no formato do contrato. As regras de validação vêm do @axis/contracts.
 * Os nomes dos campos são os da API (ADR 0001), para que os erros de campo que ela devolve
 * (ex.: `zipCode`) caiam direto no campo certo do formulário.
 */
export const formularioClienteSchema = z.object({
  legalName: campos.legalName,
  tradeName: campos.tradeName,
  document: z.string().transform(normalizarDocumento).pipe(campos.document),
  phone: z.string().transform(apenasDigitos).pipe(campos.phone),
  contactName: campos.contactName,
  zipCode: z.string().transform(apenasDigitos).pipe(campos.zipCode),
  street: campos.street,
  number: campos.number,
  complement: z
    .string()
    .trim()
    .max(100, 'Use no máximo 100 caracteres')
    .transform((valor) => valor || undefined),
  district: campos.district,
  city: campos.city,
  state: z.string().trim().toUpperCase().pipe(campos.state),
  latitude: numeroDecimal('latitude').pipe(campos.latitude),
  longitude: numeroDecimal('longitude').pipe(campos.longitude),
})

export type ValoresFormularioCliente = z.input<typeof formularioClienteSchema>
/** Saída do formulário: já é o corpo do POST/PUT /v1/customers (`CustomerInput`). */
export type DadosFormularioCliente = z.output<typeof formularioClienteSchema>

export const VALORES_INICIAIS: ValoresFormularioCliente = {
  legalName: '',
  tradeName: '',
  document: '',
  phone: '',
  contactName: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  latitude: '',
  longitude: '',
}

/** Valores do formulário a partir de um cliente salvo, com as máscaras de exibição. */
export function valoresDoCliente(cliente: Customer): ValoresFormularioCliente {
  return {
    legalName: cliente.legalName,
    tradeName: cliente.tradeName,
    document: formatarDocumento(cliente.document),
    phone: formatarTelefone(cliente.phone),
    contactName: cliente.contactName,
    zipCode: formatarCep(cliente.zipCode),
    street: cliente.street,
    number: cliente.number,
    complement: cliente.complement ?? '',
    district: cliente.district,
    city: cliente.city,
    state: cliente.state,
    latitude: String(cliente.latitude),
    longitude: String(cliente.longitude),
  }
}
