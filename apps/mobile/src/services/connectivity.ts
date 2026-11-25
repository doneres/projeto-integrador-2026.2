import { getNetworkStateAsync } from 'expo-network'

/** Se o aparelho tem rede agora. */
export type Connectivity = {
  isOnline(): Promise<boolean>
}

/**
 * Rede do aparelho (`expo-network`). Na dúvida (estado desconhecido, módulo com defeito), diz que
 * há rede: tentar a leitura e falhar custa pouco, e não tentar deixaria a rota velha sem motivo.
 */
export const deviceConnectivity: Connectivity = {
  async isOnline() {
    try {
      const state = await getNetworkStateAsync()
      return state.isConnected !== false && state.isInternetReachable !== false
    } catch {
      return true
    }
  },
}
