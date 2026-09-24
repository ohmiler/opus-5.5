/**
 * Recursively frees GPU resources owned by an Object3D tree.
 * Textures referenced by materials are disposed too.
 */
export function disposeObject(root) {
  if (!root) return
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    for (const material of materials) disposeMaterial(material)
  })
  root.removeFromParent()
}

export function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value && value.isTexture) value.dispose()
  }
  if (material.uniforms) {
    for (const u of Object.values(material.uniforms)) {
      if (u && u.value && u.value.isTexture) u.value.dispose()
    }
  }
  material.dispose()
}
