import { delay, http, HttpResponse } from 'msw'
import { clientesMock } from './data'

// Cada handler imita um endpoint do contrato da API (/v1/...).
export const handlers = [
  http.get('/v1/clientes', async () => {
    await delay(300)
    return HttpResponse.json(clientesMock)
  }),
]
