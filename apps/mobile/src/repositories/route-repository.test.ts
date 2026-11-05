import { routeWith } from '@test/route-fixtures'
import { ApiRequestError, NetworkError } from '@/services/api-client'
import { createRouteRepository, ROUTE_TIMEOUT_MS } from './route-repository'

describe('createRouteRepository', () => {
  it('GET /v1/routes/today autenticado, com timeout de 90 s', async () => {
    const route = routeWith(['pending'])
    const request = jest.fn().mockResolvedValue(route)
    const repository = createRouteRepository({ request })

    await expect(repository.today()).resolves.toEqual(route)

    expect(ROUTE_TIMEOUT_MS).toBe(90_000)
    expect(request).toHaveBeenCalledWith('/v1/routes/today', { timeoutMs: 90_000 })
  })

  it('SEM_ROTA_HOJE vira null: dia sem rota não é erro', async () => {
    const error = new ApiRequestError(404, 'SEM_ROTA_HOJE', 'Não há rota montada para hoje')
    const repository = createRouteRepository({ request: jest.fn().mockRejectedValue(error) })
    await expect(repository.today()).resolves.toBeNull()
  })

  it('outro 404 continua sendo erro', async () => {
    const error = new ApiRequestError(404, 'NAO_ENCONTRADO', 'nada')
    const repository = createRouteRepository({ request: jest.fn().mockRejectedValue(error) })
    await expect(repository.today()).rejects.toBe(error)
  })

  it('repassa falha de rede', async () => {
    const error = new NetworkError()
    const repository = createRouteRepository({ request: jest.fn().mockRejectedValue(error) })
    await expect(repository.today()).rejects.toBe(error)
  })

  it('recusa resposta fora do contrato', async () => {
    const repository = createRouteRepository({
      request: jest.fn().mockResolvedValue({ id: 'x' }),
    })
    await expect(repository.today()).rejects.toThrow()
  })
})
