import { getNetworkStateAsync } from 'expo-network'
import { deviceConnectivity } from './connectivity'

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }))

const networkState = jest.mocked(getNetworkStateAsync)

describe('deviceConnectivity', () => {
  it('com rede e internet alcançável, está online', async () => {
    networkState.mockResolvedValue({ isConnected: true, isInternetReachable: true } as never)
    expect(await deviceConnectivity.isOnline()).toBe(true)
  })

  it('sem conexão, está offline', async () => {
    networkState.mockResolvedValue({ isConnected: false, isInternetReachable: false } as never)
    expect(await deviceConnectivity.isOnline()).toBe(false)
  })

  it('conectado a um Wi-Fi sem internet, está offline', async () => {
    networkState.mockResolvedValue({ isConnected: true, isInternetReachable: false } as never)
    expect(await deviceConnectivity.isOnline()).toBe(false)
  })

  it('estado desconhecido ou módulo com defeito conta como online', async () => {
    networkState.mockResolvedValueOnce({} as never)
    expect(await deviceConnectivity.isOnline()).toBe(true)
    networkState.mockRejectedValueOnce(new Error('módulo'))
    expect(await deviceConnectivity.isOnline()).toBe(true)
  })
})
