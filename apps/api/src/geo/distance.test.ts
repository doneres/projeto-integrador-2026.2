import { describe, expect, it } from 'vitest'
import { distanceInMeters } from './distance'

describe('distanceInMeters', () => {
  const goiania = { latitude: -16.6869, longitude: -49.2648 }

  it('é zero entre um ponto e ele mesmo', () => {
    expect(distanceInMeters(goiania, goiania)).toBe(0)
  })

  it('um grau de latitude mede cerca de 111 km', () => {
    const distance = distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })
    expect(distance).toBeGreaterThan(111_000)
    expect(distance).toBeLessThan(111_400)
  })

  it('não depende do sentido', () => {
    const brasilia = { latitude: -15.7939, longitude: -47.8828 }
    expect(distanceInMeters(goiania, brasilia)).toBeCloseTo(distanceInMeters(brasilia, goiania), 6)
  })

  it('Goiânia a Brasília dá cerca de 175 km em linha reta', () => {
    const brasilia = { latitude: -15.7939, longitude: -47.8828 }
    const distance = distanceInMeters(goiania, brasilia)
    expect(distance).toBeGreaterThan(170_000)
    expect(distance).toBeLessThan(180_000)
  })
})
