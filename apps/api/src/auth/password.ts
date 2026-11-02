import { hash, verify } from '@node-rs/argon2'

/** argon2id com os parâmetros padrão da biblioteca (os recomendados pela OWASP). */
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}

// Criado ao carregar o módulo, para que nenhum login pague o custo de gerá-lo.
const decoyHash = hashPassword('decoy-password')

/**
 * Gasta o mesmo tempo de uma conferência de senha. O login chama quando a conta não existe, para
 * que "e-mail inexistente" demore o mesmo que "senha errada" e a resposta não entregue qual é.
 */
export async function verifyDecoyPassword(password: string): Promise<void> {
  await verifyPassword(await decoyHash, password)
}
