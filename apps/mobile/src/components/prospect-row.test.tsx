import { prospect } from '@test/prospect-fixtures'
import { render, screen } from '@testing-library/react-native'
import { ProspectRow } from './prospect-row'
import { MIN_TOUCH_TARGET } from './touch-target'

describe('ProspectRow', () => {
  it.each([
    ['pending_approval', 'Pendente de aprovação'],
    ['active', 'Aprovada'],
    ['rejected', 'Rejeitada'],
  ] as const)('%s aparece em texto, com um ícone próprio', async (status, label) => {
    await render(<ProspectRow prospect={prospect(1, status)} />)
    expect(screen.getByText(label)).toBeOnTheScreen()
    expect(screen.getByTestId(`prospect-status-icon-${status}`)).toBeOnTheScreen()
  })

  it('Rejeitada mostra o motivo, e o leitor de tela o lê junto', async () => {
    await render(<ProspectRow prospect={prospect(1, 'rejected', 'Fora da área atendida')} />)
    expect(screen.getByText('Motivo: Fora da área atendida')).toBeOnTheScreen()
    expect(
      screen.getByLabelText('Prospecção Prospecção 1, Rejeitada, Motivo: Fora da área atendida'),
    ).toBeOnTheScreen()
  })

  it('Pendente e Aprovada não mostram motivo', async () => {
    await render(<ProspectRow prospect={prospect(1, 'pending_approval')} />)
    expect(screen.queryByText(/Motivo/)).not.toBeOnTheScreen()
  })

  it('é um bloco só, com a área de toque mínima', async () => {
    await render(<ProspectRow prospect={prospect(1, 'active')} />)
    expect(screen.getByLabelText('Prospecção Prospecção 1, Aprovada')).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
    })
  })
})
