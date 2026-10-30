import type { AccessibilityRole } from 'react-native'

/**
 * Rótulo e papel de acessibilidade obrigatórios (RNF03). Os componentes base exigem os dois
 * no TypeScript, e as telas usam só eles em vez de `Pressable` solto.
 */
export type RequiredAccessibility<Role extends AccessibilityRole> = {
  accessibilityLabel: string
  accessibilityRole: Role
}
