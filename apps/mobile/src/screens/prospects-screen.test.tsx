import type { Prospect } from '@axis/contracts'
import { createFakeAppData, sellerSession } from '@test/fake-app-data'
import { prospect } from '@test/prospect-fixtures'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { SessionProvider } from '@/hooks/session'
import { NetworkError } from '@/services/api-client'
import { ProspectsScreen } from './prospects-screen'

type List = () => Promise<Prospect[]>

async function renderScreen(list: List) {
  const data = createFakeAppData(undefined, undefined, { prospects: { list } })
  await data.sessions.save(sellerSession())
  await render(
    <SessionProvider data={data}>
      <ProspectsScreen />
    </SessionProvider>,
  )
}

afterEach(() => jest.restoreAllMocks())

describe('ProspectsScreen', () => {
  it('mostra o título e o loader enquanto lê', async () => {
    await renderScreen(() => new Promise(() => {}))
    expect(screen.getByRole('header', { name: 'Minhas prospecções' })).toBeOnTheScreen()
    expect(screen.getByLabelText('Carregando')).toBeOnTheScreen()
  })

  it('lista as Prospecções com o estado em texto e o motivo da Rejeitada', async () => {
    await renderScreen(() =>
      Promise.resolve([
        prospect(1, 'pending_approval'),
        prospect(2, 'active'),
        prospect(3, 'rejected', 'Fora da área atendida'),
      ]),
    )
    await waitFor(() => expect(screen.getAllByTestId('prospect-row')).toHaveLength(3))

    expect(screen.getByText('Pendente de aprovação')).toBeOnTheScreen()
    expect(screen.getByText('Aprovada')).toBeOnTheScreen()
    expect(screen.getByText('Rejeitada')).toBeOnTheScreen()
    expect(screen.getByText('Motivo: Fora da área atendida')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Carregando')).not.toBeOnTheScreen()
  })

  it('sem Prospecções, mostra o estado vazio', async () => {
    await renderScreen(() => Promise.resolve([]))
    await waitFor(() =>
      expect(screen.getByText(/ainda não cadastrou prospecções/)).toBeOnTheScreen(),
    )
    expect(screen.queryByTestId('prospect-row')).not.toBeOnTheScreen()
  })

  it('em erro, avisa e deixa tentar de novo até dar certo', async () => {
    const list = jest
      .fn<Promise<Prospect[]>, []>()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce([prospect(1, 'active')])
    await renderScreen(list)

    await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen())
    expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Tentar carregar as prospecções de novo' }),
    )

    await waitFor(() => expect(screen.getByTestId('prospect-row')).toBeOnTheScreen())
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('Voltar retorna à rota do dia', async () => {
    const back = jest.spyOn(router, 'back').mockImplementation(() => {})
    await renderScreen(() => Promise.resolve([]))

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para a rota do dia' }))

    expect(back).toHaveBeenCalledTimes(1)
  })
})
