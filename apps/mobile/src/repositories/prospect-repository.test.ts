import { prospect, snapshotWith } from '@test/prospect-fixtures'
import { NetworkError } from '@/services/api-client'
import { createProspectRepository, PROSPECT_TIMEOUT_MS } from './prospect-repository'

describe('createProspectRepository', () => {
  it('GET /v1/sync/snapshot autenticado, com timeout de 90 s, e devolve as Prospecções', async () => {
    const prospects = [prospect(1, 'pending_approval'), prospect(2, 'rejected', 'Duplicada')]
    const request = jest.fn().mockResolvedValue(snapshotWith(prospects))
    const repository = createProspectRepository({ request })

    await expect(repository.list()).resolves.toEqual(prospects)

    expect(PROSPECT_TIMEOUT_MS).toBe(90_000)
    expect(request).toHaveBeenCalledWith('/v1/sync/snapshot', { timeoutMs: 90_000 })
  })

  it('sem Prospecções, a lista é vazia', async () => {
    const repository = createProspectRepository({
      request: jest.fn().mockResolvedValue(snapshotWith([])),
    })
    await expect(repository.list()).resolves.toEqual([])
  })

  it('repassa falha de rede', async () => {
    const error = new NetworkError()
    const repository = createProspectRepository({ request: jest.fn().mockRejectedValue(error) })
    await expect(repository.list()).rejects.toBe(error)
  })

  it('recusa resposta fora do contrato', async () => {
    const repository = createProspectRepository({
      request: jest.fn().mockResolvedValue({ prospects: 'x' }),
    })
    await expect(repository.list()).rejects.toThrow()
  })
})
