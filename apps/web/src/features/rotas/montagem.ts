// Seleção e ordem dos clientes ao montar a rota. A ordem da lista vira a `position` de cada
// Visita (createRouteBodySchema). Funções puras: devolvem uma lista nova.

/** Marca (vai para o fim da ordem) ou desmarca um cliente. */
export function alternarCliente(ordem: readonly string[], id: string): string[] {
  return ordem.includes(id) ? ordem.filter((atual) => atual !== id) : [...ordem, id]
}

/** Move o cliente uma posição para cima (-1) ou para baixo (+1). Nas pontas, não faz nada. */
export function moverCliente(ordem: readonly string[], id: string, direcao: -1 | 1): string[] {
  const origem = ordem.indexOf(id)
  const destino = origem + direcao
  if (origem === -1 || destino < 0 || destino >= ordem.length) {
    return [...ordem]
  }
  const nova = [...ordem]
  ;[nova[origem], nova[destino]] = [nova[destino], nova[origem]]
  return nova
}
