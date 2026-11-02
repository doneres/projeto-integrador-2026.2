import { useCallback, useEffect, useState } from 'react'
import { InvalidApiUrlError, isInsecureApiUrl } from '@/services/api-url'
import { useSession } from './session'

/** Lê e troca a URL da API guardada no aparelho (sem ela, vale a do ambiente do build). */
export function useApiUrl() {
  const { data } = useSession()
  const [current, setCurrent] = useState<string | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const override = await data.apiUrl.getOverride()
    setIsCustom(override !== null)
    try {
      setCurrent(override ?? (await data.apiUrl.resolve()))
    } catch {
      // Sem URL guardada e sem URL no ambiente do build.
      setCurrent(null)
    }
    setLoaded(true)
  }, [data])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (url: string) => {
      try {
        await data.apiUrl.setOverride(url)
        setError(null)
        await refresh()
        return true
      } catch (e) {
        setError(e instanceof InvalidApiUrlError ? e.message : 'Não foi possível guardar a URL.')
        return false
      }
    },
    [data, refresh],
  )

  const reset = useCallback(async () => {
    await data.apiUrl.clearOverride()
    setError(null)
    await refresh()
  }, [data, refresh])

  const clearError = useCallback(() => setError(null), [])

  return { current, isCustom, loaded, error, save, reset, clearError, isInsecure: isInsecureApiUrl }
}
