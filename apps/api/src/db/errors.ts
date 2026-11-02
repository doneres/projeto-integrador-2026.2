/** Código SQLSTATE do Postgres para violação de restrição unique. */
const UNIQUE_VIOLATION = '23505'

/**
 * O erro de uma consulta que violou a restrição/índice unique `constraint`. O Drizzle embrulha o
 * erro do Postgres em `cause`, então olha os dois níveis.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current = error; current && typeof current === 'object'; ) {
    const { code, constraint_name: name, cause } = current as Record<string, unknown>
    if (code === UNIQUE_VIOLATION && name === constraint) return true
    current = cause
  }
  return false
}
