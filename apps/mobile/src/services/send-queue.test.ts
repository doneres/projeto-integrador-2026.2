import { createSendQueue, type SendQueueStatus, wasDrained } from './send-queue'

describe('wasDrained', () => {
  it.each<[SendQueueStatus, SendQueueStatus, boolean]>([
    ['pending', 'idle', true],
    ['pending', 'error', false],
    ['pending', 'pending', false],
    ['error', 'idle', false],
    ['error', 'pending', false],
    ['idle', 'pending', false],
    ['idle', 'idle', false],
  ])('%s → %s: esvaziou com sucesso = %s', (previous, next, expected) => {
    expect(wasDrained(previous, next)).toBe(expected)
  })
})

describe('createSendQueue', () => {
  it('começa ociosa e avisa cada mudança de estado, uma vez', () => {
    const queue = createSendQueue()
    const heard: SendQueueStatus[] = []
    queue.subscribe((status) => heard.push(status))

    expect(queue.status()).toBe('idle')
    queue.setStatus('pending')
    queue.setStatus('pending')
    queue.setStatus('idle')

    expect(heard).toEqual(['pending', 'idle'])
    expect(queue.status()).toBe('idle')
  })

  it('quem cancela a inscrição para de ouvir', () => {
    const queue = createSendQueue()
    const listener = jest.fn()
    const unsubscribe = queue.subscribe(listener)
    unsubscribe()
    queue.setStatus('pending')
    expect(listener).not.toHaveBeenCalled()
  })
})
