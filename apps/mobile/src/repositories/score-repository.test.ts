import { goalsReport, scoreSummary } from '@test/score-fixtures'
import { ApiRequestError, NetworkError } from '@/services/api-client'
import { createScoreRepository, SCORE_TIMEOUT_MS } from './score-repository'

const at = (hour: number) => new Date(2026, 10, 12, hour, 0)

describe('createScoreRepository', () => {
  it('GET /v1/goals autenticado, com timeout de 90 s, e devolve o Score do próprio Vendedor', async () => {
    const summary = scoreSummary({ score: 72 })
    const request = jest.fn().mockResolvedValue(goalsReport([summary]))
    const repository = createScoreRepository({ request }, () => at(9))

    await expect(repository.read()).resolves.toEqual(summary)

    expect(SCORE_TIMEOUT_MS).toBe(90_000)
    expect(request).toHaveBeenCalledWith('/v1/goals', { timeoutMs: 90_000 })
  })

  it('resposta sem o Vendedor (conta inativa) é erro, não um Score zerado', async () => {
    const request = jest.fn().mockResolvedValue(goalsReport([]))
    const repository = createScoreRepository({ request }, () => at(9))
    await expect(repository.read()).rejects.toThrow()
  })

  it('recusa resposta fora do contrato', async () => {
    const request = jest.fn().mockResolvedValue({ month: 'x' })
    const repository = createScoreRepository({ request }, () => at(9))
    await expect(repository.read()).rejects.toThrow()
  })

  it('repassa falha de rede e erro da API', async () => {
    const network = new NetworkError()
    const refused = new ApiRequestError(403, 'PROIBIDO', 'sem acesso')
    await expect(
      createScoreRepository({ request: jest.fn().mockRejectedValue(network) }, () => at(9)).read(),
    ).rejects.toBe(network)
    await expect(
      createScoreRepository({ request: jest.fn().mockRejectedValue(refused) }, () => at(9)).read(),
    ).rejects.toBe(refused)
  })

  describe('cache de leitura', () => {
    it('guarda a última leitura bem-sucedida, com a hora, por Vendedor', async () => {
      const summary = scoreSummary()
      const repository = createScoreRepository(
        { request: jest.fn().mockResolvedValue(goalsReport([summary])) },
        () => at(9),
      )
      expect(repository.cached(summary.sellerId)).toBeNull()

      await repository.read()

      expect(repository.cached(summary.sellerId)).toEqual({ summary, readAt: at(9) })
    })

    it('uma leitura que falha não apaga o cache', async () => {
      const summary = scoreSummary()
      const request = jest
        .fn()
        .mockResolvedValueOnce(goalsReport([summary]))
        .mockRejectedValueOnce(new NetworkError())
      const repository = createScoreRepository({ request }, () => at(9))
      await repository.read()
      await repository.read().catch(() => {})

      expect(repository.cached(summary.sellerId)?.summary).toEqual(summary)
    })

    it('não mostra o Score de um Vendedor para outro no mesmo aparelho', async () => {
      const ana = scoreSummary({ sellerId: '0198f2a0-7c1e-7000-8000-0000000000aa' })
      const repository = createScoreRepository(
        { request: jest.fn().mockResolvedValue(goalsReport([ana])) },
        () => at(9),
      )
      await repository.read()

      expect(repository.cached('0198f2a0-7c1e-7000-8000-0000000000bb')).toBeNull()
    })
  })
})
