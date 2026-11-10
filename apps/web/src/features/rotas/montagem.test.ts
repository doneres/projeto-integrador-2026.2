import { describe, expect, it } from 'vitest'
import { alternarCliente, moverCliente } from './montagem'

describe('alternarCliente', () => {
  it('marca no fim da ordem e desmarca', () => {
    expect(alternarCliente(['a'], 'b')).toEqual(['a', 'b'])
    expect(alternarCliente(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('moverCliente', () => {
  it('troca de posição com o vizinho', () => {
    expect(moverCliente(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moverCliente(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  })

  it('não sai das pontas', () => {
    expect(moverCliente(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
    expect(moverCliente(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
  })
})
