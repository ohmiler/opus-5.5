import * as THREE from 'three'

/**
 * Analytic ray / sphere picking. Five exact sphere tests per frame are far
 * cheaper (and more forgiving at the silhouette) than triangle raycasting.
 */
export class Picker {
  constructor(camera, planets) {
    this.camera = camera
    this.planets = planets
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
  }

  pick(clientX, clientY, viewport, padding = 1.2) {
    this.ndc.set((clientX / viewport.width) * 2 - 1, -(clientY / viewport.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    let best = null
    let bestT = Infinity
    for (const planet of this.planets) {
      const t = planet.intersect(this.raycaster.ray, padding)
      if (t !== null && t < bestT) {
        bestT = t
        best = planet
      }
    }
    return best
  }
}
