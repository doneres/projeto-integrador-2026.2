import { join } from 'node:path'
import { createFakeAppData, type FakeAppData, sellerSession } from '@test/fake-app-data'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import * as appDataModule from '@/repositories/app-data'

// A primeira renderização compila a árvore inteira de rotas e passa dos 5 s padrão.
jest.setTimeout(30_000)

const APP_DIR = join(__dirname, '..', 'app')

async function renderApp(signedIn: boolean): Promise<FakeAppData> {
  const data = createFakeAppData()
  if (signedIn) await data.sessions.save(sellerSession())
  jest.spyOn(appDataModule, 'getAppData').mockReturnValue(data)
  await renderRouter(APP_DIR)
  return data
}

afterEach(() => jest.restoreAllMocks())

describe('rotas autenticadas', () => {
  it('sem sessão, abrir o app leva ao login', async () => {
    await renderApp(false)
    await waitFor(() => expect(screen.getByRole('header', { name: 'Entrar' })).toBeOnTheScreen())
  })

  it('com sessão guardada, o app abre direto na rota do dia', async () => {
    await renderApp(true)
    await waitFor(() => expect(screen.getByText('Rota do dia')).toBeOnTheScreen())
    expect(screen.queryByRole('header', { name: 'Entrar' })).not.toBeOnTheScreen()
  })

  it('as prospecções abrem a partir da rota do dia e o Voltar retorna a ela', async () => {
    await renderApp(true)
    await waitFor(() => expect(screen.getByText('Rota do dia')).toBeOnTheScreen())

    await fireEvent.press(screen.getByRole('button', { name: 'Ver minhas prospecções' }))
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Minhas prospecções' })).toBeOnTheScreen(),
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para a rota do dia' }))
    await waitFor(() => expect(screen.getByText('Rota do dia')).toBeOnTheScreen())
  })

  it('um 401 volta ao login e apaga o token', async () => {
    const data = await renderApp(true)
    await waitFor(() => expect(screen.getByText('Rota do dia')).toBeOnTheScreen())

    await act(async () => data.emitUnauthorized())

    await waitFor(() => expect(screen.getByRole('header', { name: 'Entrar' })).toBeOnTheScreen())
    await expect(data.sessions.load()).resolves.toBeNull()
  })

  it('Sair volta ao login', async () => {
    await renderApp(true)
    await waitFor(() => expect(screen.getByText('Rota do dia')).toBeOnTheScreen())

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }))

    await waitFor(() => expect(screen.getByRole('header', { name: 'Entrar' })).toBeOnTheScreen())
  })
})
