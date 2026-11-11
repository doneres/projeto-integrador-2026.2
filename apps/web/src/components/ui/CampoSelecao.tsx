import { type ComponentProps, useId } from 'react'

type Props = ComponentProps<'select'> & {
  rotulo: string
  opcoes: ReadonlyArray<readonly [valor: string, texto: string]>
  erro?: string
  dica?: string
}

/** Lista de seleção com rótulo ligado ao campo e suporte a acessibilidade (R11). */
export function CampoSelecao({ rotulo, opcoes, erro, dica, id, className, ...props }: Props) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idDescricao = `${idCampo}-descricao`
  const descricao = erro ?? dica

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <label htmlFor={idCampo} className="text-sm font-medium">
        {rotulo}
      </label>
      <select
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao ? idDescricao : undefined}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-erro"
        {...props}
      >
        {opcoes.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      {descricao && (
        <p id={idDescricao} className={`text-xs ${erro ? 'text-erro' : 'text-text-muted'}`}>
          {descricao}
        </p>
      )}
    </div>
  )
}
