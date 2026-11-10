export type Coordinates = { latitude: number; longitude: number }

const EARTH_RADIUS_METERS = 6_371_000

const radians = (degrees: number) => (degrees * Math.PI) / 180

/** Distância em linha reta entre dois pontos, em metros (fórmula de haversine). */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}
