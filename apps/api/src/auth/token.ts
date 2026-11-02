import { idSchema } from '@axis/contracts'
import { jwtVerify, SignJWT } from 'jose'

/** Duração fixa da sessão (RF04): sem refresh token. */
export const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60

const ALGORITHM = 'HS256'

export type SignedToken = { token: string; expiresAt: Date }

/** Assina o JWT da sessão. O token só carrega o id do usuário; perfil e situação vêm do banco. */
export async function signToken(
  secret: string,
  userId: string,
  now = new Date(),
): Promise<SignedToken> {
  const issuedAt = Math.floor(now.getTime() / 1000)
  const expiresAtSeconds = issuedAt + TOKEN_LIFETIME_SECONDS
  const token = await new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .sign(new TextEncoder().encode(secret))
  return { token, expiresAt: new Date(expiresAtSeconds * 1000) }
}

/** Devolve o id do usuário do token, ou `null` se for inválido, adulterado, vencido ou sem UUID. */
export async function verifyToken(secret: string, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALGORITHM],
      requiredClaims: ['sub', 'exp'],
    })
    // Um sub que não é UUID nem chegaria ao banco: o Postgres recusaria a consulta (500).
    const parsed = idSchema.safeParse(payload.sub)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
