// Frees the GPU memory of a three.js object tree: geometries, materials, their
// textures, and skinning bone textures. Call it when you remove something for good.
export function disposeObject(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.skeleton) node.skeleton.dispose();
    if (node.isInstancedMesh) node.dispose();
    if (!node.material) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
