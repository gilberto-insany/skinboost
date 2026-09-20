import { test } from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { batchPump, createRenderQueue } from "../src/bottle-performance.js";

test("pump batching preserves world-space vertices, cap and shared geometry", () => {
  const model = new Group();
  model.position.set(1, 2, 3);
  model.scale.setScalar(20);
  const parent = new Group();
  parent.rotation.z = 0.2;
  model.add(parent);
  const material = new MeshStandardMaterial();
  material.name = "Válvula • verde sálvia acetinado";
  const geometry = new BoxGeometry(0.01, 0.02, 0.01);
  const parts = [0, 1, 2, 3, 4].map((index) => {
    const part = new Mesh(geometry, material);
    part.position.set(index * 0.001, index * 0.02, 0);
    parent.add(part);
    return part;
  });
  parts[0].geometry = geometry.clone();
  parts[0].geometry.deleteAttribute("uv");
  const cap = new Mesh(geometry, new MeshStandardMaterial());
  cap.name = "Cap";
  model.add(cap);
  model.updateMatrixWorld(true);
  const vertices = (mesh) => {
    const positions = mesh.geometry.attributes.position;
    return Array.from({ length: positions.count }, (_, index) =>
      new Vector3()
        .fromBufferAttribute(positions, index)
        .applyMatrix4(mesh.matrixWorld),
    );
  };
  const before = parts.flatMap(vertices);
  let sharedDisposed = false;
  geometry.addEventListener("dispose", () => (sharedDisposed = true));
  batchPump(model);
  model.updateMatrixWorld(true);
  const pump = model.getObjectByName("PumpAssembly");
  const after = vertices(pump);
  assert.equal(after.length, before.length);
  before.forEach((vertex, index) =>
    assert.ok(vertex.distanceTo(after[index]) < 0.000001),
  );
  assert.equal(model.getObjectByName("Cap"), cap);
  assert.equal(pump.material, material);
  assert.equal(pump.geometry.index.count, geometry.index.count * 5);
  assert.equal(sharedDisposed, false);
  assert.ok(parts.every((part) => part.parent === null));
});

test("render queue coalesces events, suspends hidden work and cancels on teardown", () => {
  const callbacks = new Map();
  let id = 0;
  let draws = 0;
  const queue = createRenderQueue({
    draw: () => draws++,
    request: (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    cancel: (frame) => callbacks.delete(frame),
  });
  const flush = () => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback());
  };
  for (let i = 0; i < 20; i++) queue.invalidate();
  assert.equal(callbacks.size, 1);
  flush();
  assert.equal(draws, 1);
  queue.invalidate();
  queue.setActive(false);
  assert.equal(callbacks.size, 0);
  queue.invalidate();
  flush();
  assert.equal(draws, 1);
  queue.setActive(true);
  flush();
  assert.equal(draws, 2);
  queue.setActive(true);
  assert.equal(callbacks.size, 0);
  queue.invalidate();
  queue.dispose();
  flush();
  queue.invalidate();
  assert.equal(callbacks.size, 0);
  assert.equal(draws, 2);
});
