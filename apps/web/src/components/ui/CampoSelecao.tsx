import { type ComponentProps, useId } from 'react'

type Props = ComponentProps<'select'> & {
  rotulo: string
  opcoes: ReadonlyArray<readonly [valor: string, texto: string]>
}

/** Lista de seleção com rótulo ligado ao campo. */
export function CampoSelecao({ rotulo, opcoes, id, className, ...props }: Props) {
  const idGerado = useId()
  const idCampo = id ?? idGerado

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>
      <select
        id={idCampo}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
        {...props}
      >
        {opcoes.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  )
}
