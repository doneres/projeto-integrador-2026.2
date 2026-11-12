import { formatarHora, formatarHoraComSegundos } from '../../lib/datas'
import { Botao } from './Botao'

export type EstadoDeFrescor = {
  /** Instante (ms) da última busca bem-sucedida (`dataUpdatedAt` do TanStack Query). 0 se nunca buscou. */
  atualizadoEm: number
  /** Há uma busca em andamento (`isFetching`). */
  atualizando: boolean
  /** A última tentativa falhou (`isError`), mas pode haver dado anterior na tela. */
  comErro: boolean
}

/**
 * Texto do indicador de frescor (#61, #62, #63):
 * - Com erro depois de já ter buscado: "Atualizado às HH:mm:ss · sem atualizar desde HH:mm"
 * - Normal depois de buscar: "Atualizado às HH:mm:ss"
 */
export function textoDeFrescor({ atualizadoEm, comErro }: EstadoDeFrescor): string | null {
  if (atualizadoEm <= 0) {
    return null
  }
  const base = `Atualizado às ${formatarHoraComSegundos(atualizadoEm)}`
  if (comErro) {
    return `${base} · sem atualizar desde ${formatarHora(atualizadoEm)}`
  }
  return base
}

type Props = EstadoDeFrescor & {
  onAtualizar: () => void
}

/**
 * Barra discreta de frescor das telas ao vivo (#52, #61, #62, #63): mostra a hora da última busca
 * bem-sucedida, o aviso de defasagem quando a API falha mantendo o último dado, a nota sobre
 * vendedores offline e o botão "Atualizar" para forçar a releitura imediata.
 */
export function IndicadorDeFrescor({ atualizadoEm, atualizando, comErro, onAtualizar }: Props) {
  const texto = textoDeFrescor({ atualizadoEm, atualizando, comErro })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-text-muted">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
        {texto && (
          <span className={comErro ? 'font-medium text-erro' : 'tabular-nums'}>{texto}</span>
        )}
        {atualizando && <span>Atualizando...</span>}
        <span>Visitas feitas sem sinal aparecem quando o Vendedor sincronizar.</span>
      </div>
      <Botao
        variante="secundario"
        className="px-2.5 py-1 text-xs"
        disabled={atualizando}
        onClick={onAtualizar}
      >
        Atualizar
      </Botao>
    </div>
  )
}
