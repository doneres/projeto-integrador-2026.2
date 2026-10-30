/**
 * Tokens de cor do app. Fonte única: o Tailwind lê este arquivo (tailwind.config.ts).
 * Todo par de texto abaixo precisa de contraste de pelo menos 4,5:1 (RNF03); o teste
 * em contrast.test.ts garante.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  textMuted: '#4B5563',
  primary: '#1D4ED8',
  onPrimary: '#FFFFFF',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  /** Contorno de campos e caixas de seleção: componente de interface exige 3:1. */
  border: '#6B7280',
} as const

export type ColorToken = keyof typeof colors

/** Pares [texto, fundo] que aparecem juntos nas telas. */
export const textPairs = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['onPrimary', 'primary'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['onDanger', 'danger'],
] as const satisfies readonly (readonly [ColorToken, ColorToken])[]
