import type { ComponentProps } from 'react'

type Variante = 'primario' | 'secundario'

const CLASSES_POR_VARIANTE: Record<Variante, string> = {
  primario: 'bg-brand text-brand-foreground hover:opacity-90',
  secundario: 'border border-brand bg-surface text-text hover:bg-muted',
}

/** Classes do botão, para usar também em links com cara de botão. */
export function classesDeBotao(variante: Variante = 'primario'): string {
  return `inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${CLASSES_POR_VARIANTE[variante]}`
}

type Props = ComponentProps<'button'> & { variante?: Variante }

export function Botao({ variante = 'primario', className, type = 'button', ...props }: Props) {
  return (
    <button type={type} className={`${classesDeBotao(variante)} ${className ?? ''}`} {...props} />
  )
}
