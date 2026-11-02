import type { Session } from '@axis/contracts'
import { createMemoryStore } from '@/services/key-value-store'
import { createSessionRepository } from './session-repository'

const NOW = new Date('2026-11-02T12:00:00.000Z')

const session: Session = {
  token: 'jwt-123',
  expiresAt: '2026-11-02T20:00:00.000Z',
  user: {
    id: '0198f2a0-7c1e-7000-8000-000000000001',
    name: 'Ana Souza',
    email: 'ana@axis.test',
    registration: '2001',
    role: 'seller',
    coordinatorId: '0198f2a0-7c1e-7000-8000-000000000002',
  },
}

describe('createSessionRepository', () => {
  it('guarda a sessão e a devolve numa nova instância (sessão persistida)', async () => {
    const store = createMemoryStore()
    await createSessionRepository(store, () => NOW).save(session)
    await expect(createSessionRepository(store, () => NOW).load()).resolves.toEqual(session)
  })

  it('sem sessão guardada devolve null', async () => {
    await expect(createSessionRepository(createMemoryStore(), () => NOW).load()).resolves.toBeNull()
  })

  it('limpar apaga o token do armazenamento', async () => {
    const store = createMemoryStore()
    const repository = createSessionRepository(store, () => NOW)
    await repository.save(session)
    await repository.clear()
    await expect(repository.load()).resolves.toBeNull()
    await expect(store.get('axis.session')).resolves.toBeNull()
  })

  it('sessão vencida não é devolvida e é apagada', async () => {
    const store = createMemoryStore()
    await createSessionRepository(store, () => NOW).save(session)
    const later = () => new Date('2026-11-02T20:00:00.000Z')
    await expect(createSessionRepository(store, later).load()).resolves.toBeNull()
    await expect(store.get('axis.session')).resolves.toBeNull()
  })

  it('conteúdo corrompido no armazenamento é descartado', async () => {
    const store = createMemoryStore({ 'axis.session': '{nao e json' })
    await expect(createSessionRepository(store, () => NOW).load()).resolves.toBeNull()
    await expect(store.get('axis.session')).resolves.toBeNull()
  })
})
