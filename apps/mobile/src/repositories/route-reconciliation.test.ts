import { routeWith } from '@test/route-fixtures'
import { reconcileRoute } from './route-reconciliation'

const statuses = (route: ReturnType<typeof reconcileRoute>) => route?.visits.map((v) => v.status)

describe('reconcileRoute', () => {
  it('sem rota na tela, vale a lida', () => {
    const incoming = routeWith(['pending'])
    expect(reconcileRoute(null, incoming)).toBe(incoming)
  })

  it('sem Visita em andamento, vale a lida', () => {
    const incoming = routeWith(['completed', 'pending'])
    expect(reconcileRoute(routeWith(['pending', 'pending']), incoming)).toBe(incoming)
  })

  it('mantém a Visita em andamento e traz o resto do servidor', () => {
    const merged = reconcileRoute(
      routeWith(['in_progress', 'pending', 'pending']),
      routeWith(['pending', 'completed', 'pending']),
    )
    expect(statuses(merged)).toEqual(['in_progress', 'completed', 'pending'])
  })

  it('a Visita em andamento não some se a rota lida não a tem mais', () => {
    const merged = reconcileRoute(routeWith(['pending', 'in_progress']), routeWith(['pending']))
    expect(statuses(merged)).toEqual(['pending', 'in_progress'])
  })

  it('sem rota hoje no servidor, a Visita em andamento continua na tela', () => {
    const merged = reconcileRoute(routeWith(['pending', 'in_progress']), null)
    expect(statuses(merged)).toEqual(['in_progress'])
  })

  it('sem rota hoje e sem Visita em andamento, a rota some', () => {
    expect(reconcileRoute(routeWith(['pending']), null)).toBeNull()
  })

  it.each(['completed', 'not_performed'] as const)(
    'se o servidor já encerrou a Visita (%s), vale o servidor',
    (status) => {
      const merged = reconcileRoute(routeWith(['in_progress']), routeWith([status]))
      expect(statuses(merged)).toEqual([status])
    },
  )
})
