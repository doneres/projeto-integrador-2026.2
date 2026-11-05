import type { VisitStatus } from '@axis/contracts'
import { routeVisit } from '@test/route-fixtures'
import { render, screen } from '@testing-library/react-native'
import { MIN_TOUCH_TARGET } from './touch-target'
import { VISIT_STATUS_LABEL, VisitRow } from './visit-row'

const statuses: VisitStatus[] = ['pending', 'in_progress', 'completed', 'not_performed']

describe('VisitRow', () => {
  it('mostra o nome do Cliente, o endereço e o estado em texto', async () => {
    await render(<VisitRow visit={routeVisit(1, 'pending')} />)

    expect(screen.getByText('Mercado 1')).toBeOnTheScreen()
    expect(screen.getByText('Rua das Flores, 10 · Centro · São Paulo/SP')).toBeOnTheScreen()
    expect(screen.getByText('Pendente')).toBeOnTheScreen()
  })

  it.each([
    ['pending', 'Pendente'],
    ['in_progress', 'Em andamento'],
    ['completed', 'Concluída'],
    ['not_performed', 'Não realizada'],
  ] as const)(
    'o estado %s aparece como "%s", com rótulo para o leitor de tela',
    async (status, label) => {
      expect(VISIT_STATUS_LABEL[status]).toBe(label)
      await render(<VisitRow visit={routeVisit(1, status)} />)

      expect(screen.getByText(label)).toBeOnTheScreen()
      expect(
        screen.getByLabelText(
          `Visita 1: Mercado 1, Rua das Flores, 10 · Centro · São Paulo/SP, ${label}`,
        ),
      ).toBeOnTheScreen()
    },
  )

  it.each(statuses)('o estado %s tem um ícone, além do texto', async (status) => {
    await render(<VisitRow visit={routeVisit(1, status)} />)
    expect(screen.getByTestId(`visit-status-icon-${status}`)).toBeOnTheScreen()
  })

  it('mantém a altura mínima de 48 dp', async () => {
    await render(<VisitRow visit={routeVisit(1, 'pending')} />)
    expect(screen.getByTestId('visit-row')).toHaveStyle({ minHeight: MIN_TOUCH_TARGET })
  })

  it('inclui o complemento no endereço quando existe', async () => {
    const visit = routeVisit(1, 'pending')
    visit.customer.complement = 'Sala 2'
    await render(<VisitRow visit={visit} />)
    expect(
      screen.getByText('Rua das Flores, 10 - Sala 2 · Centro · São Paulo/SP'),
    ).toBeOnTheScreen()
  })
})
