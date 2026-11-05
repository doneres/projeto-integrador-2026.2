import type { RouteDetail } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { routeWith } from '@test/route-fixtures'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SessionProvider } from '@/hooks/session'
import { NetworkError } from '@/services/api-client'
import { HomeScreen } from './home-screen'

type Today = () => Promise<RouteDetail | null>

async function renderHome(today: Today = () => Promise.resolve(routeWith(['pending']))) {
  const data = createFakeAppData(undefined, { today })
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
    expect(screen.getByRole('header', { name: 'Rota do dia' })).toBeOnTheScreen()
  })

  it('Sair apaga o token do aparelho', async () => {
    const data = await renderHome()

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))

    await waitFor(async () => expect(await data.sessions.load()).toBeNull())
    expect(screen.queryByText('Olá, Ana Souza')).not.toBeOnTheScreen()
  })

  describe('rota do dia', () => {
    it('mostra o loader enquanto lê a rota', async () => {
      await renderHome(() => new Promise(() => {}))
      expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
      expect(screen.getByText('Carregando a rota do dia…')).toBeOnTheScreen()
    })

    it('lista as Visitas pela ordem da rota, com os quatro estados em texto', async () => {
      await renderHome(() =>
        Promise.resolve(routeWith(['pending', 'in_progress', 'completed', 'not_performed'])),
      )
      await waitFor(() => expect(screen.getByText('Mercado 1')).toBeOnTheScreen())

      const rows = screen.getAllByTestId('visit-row')
      expect(rows).toHaveLength(4)
      for (const [index, label] of [
        'Pendente',
        'Em andamento',
        'Concluída',
        'Não realizada',
      ].entries()) {
        expect(
          screen.getByLabelText(
            new RegExp(`^Visita ${index + 1}: Mercado ${index + 1},.*, ${label}$`),
          ),
        ).toBeOnTheScreen()
      }
      expect(screen.queryByText(/Sem rota hoje/)).not.toBeOnTheScreen()
    })

    it('sem rota hoje, mostra o estado vazio', async () => {
      await renderHome(() => Promise.resolve(null))
      await waitFor(() => expect(screen.getByText(/Sem rota hoje/)).toBeOnTheScreen())
      expect(screen.queryByTestId('visit-row')).not.toBeOnTheScreen()
      expect(screen.queryByLabelText('Carregando')).not.toBeOnTheScreen()
    })

    it('em erro, avisa e deixa tentar de novo até dar certo', async () => {
      const today = jest
        .fn<Promise<RouteDetail | null>, []>()
        .mockRejectedValueOnce(new NetworkError())
        .mockResolvedValueOnce(routeWith(['in_progress']))
      await renderHome(today)

      await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen())
      expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeOnTheScreen()
      expect(screen.queryByTestId('visit-row')).not.toBeOnTheScreen()

      await fireEvent.press(screen.getByRole('button', { name: 'Tentar carregar a rota de novo' }))

      await waitFor(() => expect(screen.getByText('Mercado 1')).toBeOnTheScreen())
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
      expect(today).toHaveBeenCalledTimes(2)
    })
  })
})
