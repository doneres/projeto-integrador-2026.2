import { type ComponentProps, useId } from 'react'

type Props = ComponentProps<'input'> & {
  rotulo: string
  erro?: string
  dica?: string
}

/** Campo de texto com rótulo, dica e erro ligados ao input, para leitores de tela (R11). */
export function Campo({ rotulo, erro, dica, id, className, ...props }: Props) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idDescricao = `${idCampo}-descricao`
  const descricao = erro ?? dica

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao ? idDescricao : undefined}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-erro"
        {...props}
      />
      {descricao && (
        <p id={idDescricao} className={`text-xs ${erro ? 'text-erro' : 'text-text-muted'}`}>
          {descricao}
        </p>
      )}
    </div>
  )
}
