import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SessionProvider } from '@/hooks/session'
import { HomeScreen } from './home-screen'

async function renderHome() {
  const data = createFakeAppData()
  await data.sessions.save(sellerSession())
  await render(
    <SessionProvider data={data}>
      <HomeScreen />
    </SessionProvider>,
  )
  await waitFor(() => expect(screen.getByText('Olá, Ana Souza')).toBeOnTheScreen())
  return data
}

describe('HomeScreen', () => {
  it('mostra o nome do app, o Vendedor e o título da tela', async () => {
    await renderHome()
    expect(screen.getByRole('header', { name: 'AXIS' })).toBeOnTheScreen()
    expect(screen.getByText('Rota do dia')).toBeOnTheScreen()
  })

  it('Sair apaga o token do aparelho', async () => {
    const data = await renderHome()

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))

    await waitFor(async () => expect(await data.sessions.load()).toBeNull())
    expect(screen.queryByText('Olá, Ana Souza')).not.toBeOnTheScreen()
  })
})
