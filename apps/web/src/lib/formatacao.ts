// Máscaras só para exibição: o contrato guarda CPF/CNPJ, CEP e telefone sem máscara.

export function formatarDocumento(documento: string): string {
  if (/^\d{11}$/.test(documento)) {
    return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  if (/^[0-9A-Z]{12}\d{2}$/.test(documento)) {
    return documento.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  }
  return documento
}

export function formatarCep(cep: string): string {
  return /^\d{8}$/.test(cep) ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep
}

export function formatarTelefone(telefone: string): string {
  if (/^\d{11}$/.test(telefone)) {
    return telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }
  if (/^\d{10}$/.test(telefone)) {
    return telefone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  }
  return telefone
}
