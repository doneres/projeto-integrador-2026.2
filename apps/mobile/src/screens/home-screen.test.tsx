import { render, screen } from '@testing-library/react-native'
import { HomeScreen } from './home-screen'

describe('HomeScreen', () => {
  it('mostra o nome do app e o título da tela', async () => {
    await render(<HomeScreen />)
    expect(screen.getByRole('header', { name: 'AXIS' })).toBeOnTheScreen()
    expect(screen.getByText('Rota do dia')).toBeOnTheScreen()
  })
})
