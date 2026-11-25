import { fireEvent, render, screen } from '@testing-library/react-native'
import { RouteFreshness, spokenClock, timeLabel } from './route-freshness'

const at = (hour: number, minute: number) => new Date(2026, 10, 12, hour, minute)

describe('hora da atualização', () => {
  it.each([
    [at(9, 5), '09:05'],
    [at(0, 0), '00:00'],
    [at(23, 59), '23:59'],
  ])('%s aparece como %s', (date, label) => {
    expect(timeLabel(date)).toBe(label)
  })

  it.each([
    [at(9, 5), '9 horas e 5 minutos'],
    [at(14, 0), '14 horas'],
    [at(1, 1), '1 hora e 1 minuto'],
    [at(0, 30), '0 horas e 30 minutos'],
  ])('%s é lido como "%s"', (date, spoken) => {
    expect(spokenClock(date)).toBe(spoken)
  })
})

describe('RouteFreshness', () => {
  const props = { refreshing: false, error: null, onRefresh: jest.fn() }

  it('mostra "Rota atualizada às HH:mm" e o TalkBack lê a hora por extenso', async () => {
    await render(<RouteFreshness {...props} updatedAt={at(9, 5)} />)
    expect(screen.getByText('Rota atualizada às 09:05')).toBeOnTheScreen()
    expect(screen.getByLabelText('Rota atualizada às 9 horas e 5 minutos')).toBeOnTheScreen()
  })

  it('o botão Atualizar chama onRefresh', async () => {
    const onRefresh = jest.fn()
    await render(<RouteFreshness {...props} onRefresh={onRefresh} updatedAt={at(9, 5)} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar a rota do dia' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('enquanto atualiza, o botão fica desabilitado e avisa', async () => {
    await render(<RouteFreshness {...props} refreshing updatedAt={at(9, 5)} />)
    expect(screen.getByRole('button', { name: 'Atualizar a rota do dia' })).toBeDisabled()
    expect(screen.getByText('Atualizando a rota…')).toBeOnTheScreen()
  })

  it('se a atualização falhou, avisa e diz que a rota é a das HH:mm', async () => {
    await render(
      <RouteFreshness
        {...props}
        error="Não foi possível conectar ao servidor."
        updatedAt={at(9, 5)}
      />,
    )
    expect(screen.getByRole('alert')).toBeOnTheScreen()
    expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeOnTheScreen()
    expect(screen.getByText('Rota atualizada às 09:05')).toBeOnTheScreen()
  })

  it('sem erro, não há alerta', async () => {
    await render(<RouteFreshness {...props} updatedAt={at(9, 5)} />)
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
  })
})
