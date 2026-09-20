import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { batchPump, createRenderQueue } from "./bottle-performance.js";

gsap.registerPlugin(ScrollTrigger);

function createStudioEnvironment() {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x93958e);
  const panels = [
    { size: [2.4, 5], position: [-3.5, 1.5, 4], strength: 4 },
    { size: [0.65, 4.5], position: [3, 0.7, 2], strength: 2.5 },
    { size: [3, 2], position: [0, 4, -1], strength: 2 },
    { size: [2.5, 5], position: [3, 0, -3], strength: 0.08 },
  ];
  for (const { size, position, strength } of panels) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(strength, strength, strength * 0.97),
        side: THREE.DoubleSide,
      }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  return studio;
}

// Filter the microscopic molded finish before it becomes subpixel, so it does
// not sparkle during scrolling. No image downloads or extra geometry needed.
function addMoldedFinish(material, pump) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFinishPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFinishPosition = position * 1000.0;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vFinishPosition;
        float finishHash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float finishNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(finishHash(i), finishHash(i+vec3(1,0,0)), f.x),
            mix(finishHash(i+vec3(0,1,0)), finishHash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(finishHash(i+vec3(0,0,1)), finishHash(i+vec3(1,0,1)), f.x),
            mix(finishHash(i+vec3(0,1,1)), finishHash(i+vec3(1,1,1)), f.x), f.y), f.z);
        }
      `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        vec3 finishP = vFinishPosition * ${pump ? "2.4" : "3.2"};
        float finishFootprint = max(length(dFdx(finishP)), length(dFdy(finishP)));
        float finishFilter = 1.0 - smoothstep(0.35, 1.6, finishFootprint);
        float finishGrain = (finishNoise(finishP) - 0.5) * finishFilter;
        roughnessFactor = clamp(roughnessFactor + finishGrain * 0.02, 0.0, 1.0);
      `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 finishDx = dFdx(-vViewPosition), finishDy = dFdy(-vViewPosition);
        vec3 finishR1 = cross(finishDy, normal), finishR2 = cross(normal, finishDx);
        float finishDet = dot(finishDx, finishR1);
        float finishHeight = finishGrain * ${pump ? "0.00012" : "0.00006"};
        vec3 finishGradient = sign(finishDet) *
          (dFdx(finishHeight) * finishR1 + dFdy(finishHeight) * finishR2);
        normal = normalize(abs(finishDet) * normal - finishGradient);
      `,
      );
  };
  material.customProgramCacheKey = () =>
    `molded-finish-${pump ? "pump" : "body"}-1`;
  material.needsUpdate = true;
}

export async function initBottle({ root = document, signal } = {}) {
  const container = root.querySelector("#bottle-canvas");
  const fallback = root.querySelector("#bottle-fallback");
  if (!container || container.querySelector("canvas")) return;
  container.dataset.status = "initializing";
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch (error) {
    container.dataset.status = "webgl-unavailable";
    console.warn("WebGL unavailable.", error);
    return;
  }
  renderer.setPixelRatio(
    Math.max(2, Math.min(window.devicePixelRatio || 1, 3)),
  );
  renderer.transmissionResolutionScale = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Transmission needs an actual scene background, not the transparent canvas.
  scene.background = new THREE.Color(0x0e2820);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = createStudioEnvironment();
  const environment = pmrem.fromScene(studio, 0.025, 0.1, 100, { size: 512 });
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  studio.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffcf7, 0x878b81, 0.45));
  const key = new THREE.DirectionalLight(0xfffaf2, 2.1);
  key.position.set(-3, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -3,
    right: 3,
    top: 4,
    bottom: -3,
    near: 0.1,
    far: 14,
  });
  key.shadow.normalBias = 0.005;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 2;
  key.shadow.blurSamples = 8;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf4f6f1, 0.35);
  fill.position.set(4, 1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe5efdf, 1.1);
  rim.position.set(2.5, 2, -3);
  scene.add(rim);
  const pose = new THREE.Group();
  scene.add(pose);

  let visible = false;
  let disposed = false;
  let model;
  let cap;
  let closedCapY = 0;
  const motion = { progress: 0 };
  const media = gsap.matchMedia();
  const renderQueue = createRenderQueue({
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (id) => window.cancelAnimationFrame(id),
    draw: () => {
      if (!disposed && model) renderer.render(scene, camera);
    },
  });
  renderQueue.setActive(false);
  const render = () => renderQueue.invalidate();
  function syncVisibility() {
    renderQueue.setActive(visible && !document.hidden && !!model);
  }
  document.addEventListener("visibilitychange", syncVisibility);
  let lastPose = "";
  function update() {
    if (!model || !cap) return;
    const p = motion.progress;
    const mobile = window.innerWidth < 701;
    const poseKey = `${p}:${mobile}:${camera.aspect}`;
    if (poseKey === lastPose) return;
    lastPose = poseKey;
    const lift = THREE.MathUtils.smoothstep(p, 0.32, 0.78);
    // glTF is Y-up. Cap translates in meters inside the exported root (scale 20).
    cap.position.y = closedCapY + 0.065 * lift;
    cap.rotation.z = -0.065 * lift;
    pose.rotation.set(0.055, 0.28 + p * Math.PI * 2, -0.19 + 0.31 * p);
    const framing = mobile ? 1 : Math.min(1, camera.aspect / 1.55);
    pose.position.set(mobile ? 0 : 0.78 * framing, -0.1 - lift * 0.44, 0);
    pose.scale.setScalar((1.12 - lift * 0.24) * framing);
    container.dataset.phase =
      lift < 0.01 ? "closed" : lift > 0.99 ? "open" : "opening";
    container.dataset.progress = p.toFixed(3);
    renderer.shadowMap.needsUpdate = true;
    render();
  }
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRatio = 0;
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || disposed) return;
    // Keep Retina detail after moving the window between displays. Supersample
    // 1x screens too, bounded by an 8 MP framebuffer and the device texture limit.
    const preferredRatio = Math.max(
      2,
      Math.min(window.devicePixelRatio || 1, 3),
    );
    const pixelRatio = Math.min(
      preferredRatio,
      Math.sqrt(8_000_000 / (width * height)),
      renderer.capabilities.maxTextureSize / Math.max(width, height),
    );
    if (
      width === lastWidth &&
      height === lastHeight &&
      pixelRatio === lastRatio
    )
      return;
    lastWidth = width;
    lastHeight = height;
    lastRatio = pixelRatio;
    if (renderer.getPixelRatio() !== pixelRatio)
      renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    container.dataset.pixelRatio = pixelRatio.toFixed(2);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    update();
    render();
  }
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(container);
  let densityQuery;
  function watchDensity() {
    densityQuery?.removeEventListener("change", onDensityChange);
    densityQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    );
    densityQuery.addEventListener("change", onDensityChange);
  }
  function onDensityChange() {
    resize();
    watchDensity();
  }
  watchDensity();
  window.addEventListener("resize", resize);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncVisibility();
  });
  visibilityObserver.observe(container);

  function disposeModel(object) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    object?.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of node.material
        ? Array.isArray(node.material)
          ? node.material
          : [node.material]
        : [])
        materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      for (const [key, value] of Object.entries(material)) {
        if (key !== "envMap" && value?.isTexture) textures.add(value);
      }
      material.dispose();
    });
    textures.forEach((texture) => texture.dispose());
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    renderQueue.dispose();
    document.removeEventListener("visibilitychange", syncVisibility);
    media.revert();
    sizeObserver.disconnect();
    densityQuery?.removeEventListener("change", onDensityChange);
    window.removeEventListener("resize", resize);
    visibilityObserver.disconnect();
    window.removeEventListener("pagehide", onPageHide);
    signal?.removeEventListener("abort", cleanup);
    disposeModel(model);
    environment.dispose();
    key.shadow.map?.dispose();
    key.shadow.mapPass?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  function onPageHide(event) {
    if (!event.persisted) cleanup();
  }
  window.addEventListener("pagehide", onPageHide);
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      fallback.hidden = false;
      cleanup();
    },
    { once: true },
  );

  signal?.addEventListener("abort", cleanup, { once: true });
  if (signal?.aborted) {
    cleanup();
    return cleanup;
  }

  try {
    const gltf = await new GLTFLoader().loadAsync(
      "/models/skinboost-comfort.glb",
    );
    if (disposed) {
      disposeModel(gltf.scene);
      return;
    }
    model = gltf.scene;
    cap = model.getObjectByName("Cap");
    if (!cap?.isMesh)
      throw new Error("The model must contain a separate Cap mesh.");
    closedCapY = cap.position.y;
    const finished = new Set();
    model.traverse((object) => {
      if (!object.isMesh || object === cap) return;
      const material = object.material;
      if (material.map) {
        material.map.anisotropy = Math.min(
          8,
          renderer.capabilities.getMaxAnisotropy(),
        );
        material.map.needsUpdate = true;
      }
      const pump = material.name.startsWith("Válvula");
      const body = object.name === "Body";
      object.castShadow = body || pump;
      object.receiveShadow = body || pump;
      if ((body || pump) && !finished.has(material)) {
        addMoldedFinish(material, pump);
        finished.add(material);
      }
    });
    // Transmission thickness is local-space: match the 1 mm hollow shell.
    // The exported root scales it by 20; using the cap diameter magnifies the pump.
    const oldCapMaterial = cap.material;
    cap.material = new THREE.MeshPhysicalMaterial({
      color: 0xeaf3df,
      roughness: 0.012,
      metalness: 0,
      transmission: 0.975,
      opacity: 1,
      ior: 1.49,
      thickness: 0.001,
      attenuationColor: 0xb2c3a2,
      attenuationDistance: 0.6,
      envMap: environment.texture,
      envMapIntensity: 2.8,
    });
    // The molded lip has a longer optical path than the straight 1 mm wall.
    // Tint only bevel-facing vertices; never tint the full-height side quads.
    const positions = cap.geometry.attributes.position;
    const normals = cap.geometry.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const rimTint = new THREE.Color(0x9aab8c);
    const white = new THREE.Color(0xffffff);
    const tint = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getZ(i));
      const bevel = THREE.MathUtils.smoothstep(
        Math.abs(normals.getY(i)),
        0.3,
        0.85,
      );
      const rim = THREE.MathUtils.smoothstep(radius, 0.0222, 0.0234) * bevel;
      tint.copy(white).lerp(rimTint, rim);
      tint.toArray(colors, i * 3);
    }
    cap.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    cap.material.vertexColors = true;
    oldCapMaterial.dispose();
    batchPump(model);
    pose.add(model);
    syncVisibility();
    media.add(
      {
        reduce: "(prefers-reduced-motion: reduce)",
        animate: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        motion.progress = 0;
        if (!context.conditions.reduce) {
          const syncScroll = (trigger) => {
            motion.progress = trigger.progress;
            update();
          };
          ScrollTrigger.create({
            trigger: root.querySelector(".product-story"),
            start: "top top",
            end: "bottom bottom",
            onUpdate: syncScroll,
            onRefresh: syncScroll,
          });
        }
        update();
      },
    );
    resize();
    fallback.hidden = true;
    container.dataset.status = "ready";
    container.dataset.model = "comfort";
    ScrollTrigger.refresh();
  } catch (error) {
    console.warn("The product preview is unavailable.", error);
    container.dataset.status = "unavailable";
    fallback.hidden = false;
    cleanup();
  }
  return cleanup;
}
