import {
  apenasDigitos,
  type Cliente,
  cepSchema,
  coordenadasSchema,
  type DadosCliente,
  dadosClienteSchema,
  documentoSchema,
  enderecoSchema,
  normalizarDocumento,
  type TipoCliente,
  telefoneSchema,
  ufSchema,
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

/**
 * Formulário de cliente: aceita o que o usuário digita (com máscara, vírgula decimal)
 * e entrega os dados no formato do contrato. As regras de validação vêm do @axis/contracts.
 */
export const formularioClienteSchema = z.object({
  razaoSocial: dadosClienteSchema.shape.razaoSocial,
  nomeFantasia: dadosClienteSchema.shape.nomeFantasia,
  documento: z.string().transform(normalizarDocumento).pipe(documentoSchema),
  telefone: z.string().transform(apenasDigitos).pipe(telefoneSchema),
  contato: dadosClienteSchema.shape.contato,
  endereco: z.object({
    cep: z.string().transform(apenasDigitos).pipe(cepSchema),
    logradouro: enderecoSchema.shape.logradouro,
    numero: enderecoSchema.shape.numero,
    complemento: z
      .string()
      .trim()
      .max(100, 'Use no máximo 100 caracteres')
      .transform((valor) => valor || undefined),
    bairro: enderecoSchema.shape.bairro,
    cidade: enderecoSchema.shape.cidade,
    uf: z.string().trim().toUpperCase().pipe(ufSchema),
  }),
  localizacao: z.object({
    latitude: numeroDecimal('latitude').pipe(coordenadasSchema.shape.latitude),
    longitude: numeroDecimal('longitude').pipe(coordenadasSchema.shape.longitude),
  }),
})

export type ValoresFormularioCliente = z.input<typeof formularioClienteSchema>
export type DadosFormularioCliente = z.output<typeof formularioClienteSchema>

export const VALORES_INICIAIS: ValoresFormularioCliente = {
  razaoSocial: '',
  nomeFantasia: '',
  documento: '',
  telefone: '',
  contato: '',
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  },
  localizacao: { latitude: '', longitude: '' },
}

/** Valores do formulário a partir de um cliente salvo, com as máscaras de exibição. */
export function valoresDoCliente(cliente: Cliente): ValoresFormularioCliente {
  return {
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    documento: formatarDocumento(cliente.documento),
    telefone: formatarTelefone(cliente.telefone),
    contato: cliente.contato,
    endereco: {
      ...cliente.endereco,
      cep: formatarCep(cliente.endereco.cep),
      complemento: cliente.endereco.complemento ?? '',
    },
    localizacao: {
      latitude: String(cliente.localizacao.latitude),
      longitude: String(cliente.localizacao.longitude),
    },
  }
}

/** Corpo enviado à API. Clientes cadastrados pelo painel entram na carteira. */
export function paraDadosCliente(valores: DadosFormularioCliente, tipo: TipoCliente): DadosCliente {
  return { ...valores, tipo }
}
