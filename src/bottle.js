import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export async function initBottle() {
  const container = document.querySelector("#bottle-canvas");
  const fallback = document.querySelector("#bottle-fallback");
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Transmission needs an actual scene background, not the transparent canvas.
  scene.background = new THREE.Color(0xf0efe7);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffcf3, 0x9fae98, 1.3));
  const key = new THREE.DirectionalLight(0xfff7e6, 2.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xeaf1e4, 1);
  fill.position.set(4, 1, 3);
  scene.add(fill);
  const pose = new THREE.Group();
  scene.add(pose);

  let visible = true;
  let disposed = false;
  let model;
  let cap;
  let closedCapY = 0;
  const motion = { progress: 0 };
  const media = gsap.matchMedia();
  const render = () => {
    if (visible && !disposed && model) renderer.render(scene, camera);
  };
  function update() {
    if (!model || !cap) return;
    const p = motion.progress;
    const mobile = window.innerWidth < 701;
    const lift = THREE.MathUtils.smoothstep(p, 0.32, 0.78);
    // glTF is Y-up. Cap translates in meters inside the exported root (scale 20).
    cap.position.y = closedCapY + 0.065 * lift;
    cap.rotation.z = -0.065 * lift;
    pose.rotation.set(0.055, -0.22 + p * Math.PI * 2, -0.19 + 0.31 * p);
    pose.position.set(mobile ? 0 : 0.78, -0.1 - lift * 0.44, 0);
    pose.scale.setScalar(1.12 - lift * 0.24);
    container.dataset.phase =
      lift < 0.01 ? "closed" : lift > 0.99 ? "open" : "opening";
    container.dataset.progress = p.toFixed(3);
    render();
  }
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    update();
  }
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) render();
  });
  visibilityObserver.observe(container);

  function disposeModel(object) {
    const geometries = new Set();
    const materials = new Set();
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
    materials.forEach((material) => material.dispose());
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    media.revert();
    sizeObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener("pagehide", onPageHide);
    disposeModel(model);
    environment.dispose();
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
    // Transmission thickness is local-space: match the 1 mm hollow shell.
    // The exported root scales it by 20; using the cap diameter magnifies the pump.
    const oldCapMaterial = cap.material;
    cap.material = new THREE.MeshPhysicalMaterial({
      color: 0xe4eedc,
      roughness: 0.025,
      metalness: 0,
      transmission: 1,
      opacity: 1,
      ior: 1.49,
      thickness: 0.001,
      attenuationColor: 0x658260,
      attenuationDistance: 0.15,
      envMapIntensity: 0.8,
    });
    oldCapMaterial.dispose();
    pose.add(model);
    media.add(
      {
        reduce: "(prefers-reduced-motion: reduce)",
        animate: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        motion.progress = 0;
        if (!context.conditions.reduce) {
          gsap.to(motion, {
            progress: 1,
            ease: "none",
            onUpdate: update,
            scrollTrigger: {
              trigger: ".product-story",
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              invalidateOnRefresh: true,
            },
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
}
