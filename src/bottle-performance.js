import { Float32BufferAttribute, Matrix4, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The pump parts never move relative to each other. Bake only their transforms,
// preserving every vertex, normal and material; the animated cap stays separate.
export function batchPump(model) {
  model.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(model.matrixWorld).invert();
  const groups = new Map();
  model.traverse((object) => {
    if (
      !object.isMesh ||
      object.children.length ||
      !object.material?.name?.startsWith("Válvula")
    )
      return;
    const group = groups.get(object.material) || [];
    group.push(object);
    groups.set(object.material, group);
  });
  for (const [material, parts] of groups) {
    if (parts.length < 2) continue;
    const copies = parts.map((part) =>
      part.geometry
        .clone()
        .applyMatrix4(
          new Matrix4().multiplyMatrices(inverse, part.matrixWorld),
        ),
    );
    // Blender's nozzle has UVs; the lathed pump parts do not. This untextured
    // material does not sample UVs, but the merged vertex layout must match.
    if (copies.some((copy) => copy.hasAttribute("uv"))) {
      for (const copy of copies) {
        if (!copy.hasAttribute("uv"))
          copy.setAttribute(
            "uv",
            new Float32BufferAttribute(copy.attributes.position.count * 2, 2),
          );
      }
    }
    const geometry = mergeGeometries(copies);
    copies.forEach((copy) => copy.dispose());
    if (!geometry) continue;
    const pump = new Mesh(geometry, material);
    pump.name = "PumpAssembly";
    pump.castShadow = true;
    pump.receiveShadow = true;
    model.add(pump);
    const originals = new Set(parts.map((part) => part.geometry));
    parts.forEach((part) => part.removeFromParent());
    // A geometry can be shared with a mesh outside this batch.
    model.traverse((object) => originals.delete(object.geometry));
    originals.forEach((original) => original.dispose());
  }
}

// One requested frame, regardless of how many scroll/resize callbacks fire.
export function createRenderQueue({ draw, request, cancel }) {
  let frame = null;
  let dirty = false;
  let active = true;
  let disposed = false;
  function schedule() {
    if (disposed || !active || !dirty || frame !== null) return;
    frame = request(() => {
      frame = null;
      if (disposed || !active || !dirty) return;
      dirty = false;
      draw();
    });
  }
  return {
    invalidate() {
      dirty = true;
      schedule();
    },
    setActive(value) {
      active = value;
      if (!active && frame !== null) {
        cancel(frame);
        frame = null;
      }
      schedule();
    },
    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}
