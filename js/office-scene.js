const officeHero = document.querySelector('[data-office-hero]');

const officeCanvasMount = officeHero
  ? officeHero.querySelector('[data-office-canvas]') || document.querySelector('[data-office-canvas]')
  : null;

if (officeHero && officeCanvasMount) {
  const statusElement = officeHero.querySelector('[data-office-status]')
    || document.querySelector('[data-office-status]');

  const showFallback = (message = '3D 场景暂不可用，已显示静态版本') => {
    officeHero.dataset.officeState = 'fallback';
    officeHero.classList.remove('is-webgl-ready', 'is-entering');
    officeHero.classList.add('is-entered');
    if (statusElement) statusElement.textContent = message;
  };

  import('../assets/vendor/three/three.module.min.js')
    .then((THREE) => initialiseCreatorStudio(THREE, officeHero))
    .catch((error) => {
      showFallback();
      console.warn('[MUZI studio] Three.js failed to load.', error);
    });
}

function initialiseCreatorStudio(THREE, host) {
  const canvasMount = host.querySelector('[data-office-canvas]')
    || document.querySelector('[data-office-canvas]');
  if (!canvasMount) return;

  const canvas = canvasMount instanceof HTMLCanvasElement
    ? canvasMount
    : canvasMount.appendChild(document.createElement('canvas'));
  const statusElement = host.querySelector('[data-office-status]')
    || document.querySelector('[data-office-status]');
  const screenButton = host.querySelector('[data-office-screen-button]')
    || document.querySelector('[data-office-screen-button]');
  const workflowButton = host.querySelector('[data-office-light-button]')
    || document.querySelector('[data-office-light-button]');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
  const lowPowerDevice = Boolean(
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || navigator.connection?.saveData
  );

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lowPowerDevice && !coarsePointerQuery.matches,
      powerPreference: lowPowerDevice ? 'low-power' : 'high-performance'
    });
  } catch (error) {
    host.dataset.officeState = 'fallback';
    host.classList.add('is-entered');
    if (statusElement) statusElement.textContent = '当前设备不支持 3D 场景';
    console.warn('[MUZI studio] WebGL renderer unavailable.', error);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const studio = new THREE.Group();
  const architecture = new THREE.Group();
  const observationZone = new THREE.Group();
  const cityGroup = new THREE.Group();
  const interactiveMeshes = [];
  const disposableGeometries = new Set();
  const disposableMaterials = new Set();
  const disposableTextures = [];
  const listeners = [];
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const cameraTarget = new THREE.Vector3(0.45, 2.25, -0.15);
  const finalCameraPosition = new THREE.Vector3(11.15, 7.3, 12.75);
  const introCameraPosition = new THREE.Vector3(13.35, 8.7, 16.0);
  const finalCameraTarget = new THREE.Vector3(0.45, 2.25, -0.15);
  const introCameraTarget = new THREE.Vector3(0.1, 2.05, -0.55);

  const timing = {
    startedAt: performance.now(),
    lastFrameAt: 0,
    lastInteractionAt: -Infinity,
    lastScreenDrawAt: 0,
    introStartedAt: 0,
    introDuration: 1750
  };

  let destroyed = false;
  let contextIsLost = false;
  let sceneIsVisible = true;
  let resizeObserver = null;
  let visibilityObserver = null;
  let animationFrame = 0;
  let resizeFrame = 0;
  let introComplete = reducedMotionQuery.matches;
  let dragState = null;
  let activeScreen = 0;
  let autoScreenTick = -1;
  let manualScreenUntil = 0;
  let workflowBoostUntil = 0;
  let hoveredAction = '';

  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = !lowPowerDevice;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.style.touchAction = 'pan-y';
  canvas.setAttribute('aria-label', 'MUZI 的 3D 创作者工作室。拖动可以观察空间，点击场景物件可以前往相应内容。');

  scene.add(studio);
  studio.add(architecture, observationZone, cityGroup);

  const palette = {
    shell: 0xe7edf3,
    wall: 0xdfe7ef,
    ceramic: 0xfbfcfd,
    blue: 0x6685ad,
    blueLight: 0xafc0d2,
    navy: 0x27384e,
    ink: 0x1f2b3a,
    metal: 0xc9d2dd,
    glass: 0xcfe0ee,
    skin: 0xd7a29a,
    skinLight: 0xe5b7ae,
    hair: 0x2c2d33,
    city: 0xb7c7d8
  };

  const material = (options) => {
    const MaterialType = lowPowerDevice ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
    const nextOptions = { roughness: 0.62, metalness: 0.02, ...options };
    if (lowPowerDevice) {
      delete nextOptions.clearcoat;
      delete nextOptions.clearcoatRoughness;
      delete nextOptions.transmission;
      delete nextOptions.thickness;
      delete nextOptions.ior;
    }
    const nextMaterial = new MaterialType(nextOptions);
    disposableMaterials.add(nextMaterial);
    return nextMaterial;
  };

  const materials = {
    shell: material({ color: palette.shell, roughness: 0.86 }),
    wall: material({ color: palette.wall, roughness: 0.91 }),
    ceramic: material({ color: palette.ceramic, roughness: 0.52, clearcoat: 0.1, clearcoatRoughness: 0.6 }),
    blue: material({ color: palette.blue, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.58 }),
    blueLight: material({ color: palette.blueLight, roughness: 0.72 }),
    navy: material({ color: palette.navy, roughness: 0.58 }),
    ink: material({ color: palette.ink, roughness: 0.4, metalness: 0.08 }),
    metal: material({ color: palette.metal, roughness: 0.28, metalness: 0.66, clearcoat: 0.18, clearcoatRoughness: 0.38 }),
    skin: material({ color: palette.skin, roughness: 0.72 }),
    skinLight: material({ color: palette.skinLight, roughness: 0.68 }),
    hair: material({ color: palette.hair, roughness: 0.46, clearcoat: 0.1, clearcoatRoughness: 0.55 }),
    city: material({ color: palette.city, roughness: 0.8 }),
    cityLight: material({ color: 0xe9f1f7, roughness: 0.74 }),
    glass: material({
      color: palette.glass,
      roughness: 0.1,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    }),
    acrylic: material({
      color: 0xc5d7e8,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    })
  };

  const rememberGeometry = (geometry) => {
    disposableGeometries.add(geometry);
    return geometry;
  };

  const addMesh = (geometry, meshMaterial, parent = studio, shadow = true) => {
    const mesh = new THREE.Mesh(rememberGeometry(geometry), meshMaterial);
    mesh.castShadow = Boolean(shadow && !lowPowerDevice);
    mesh.receiveShadow = Boolean(shadow);
    parent.add(mesh);
    return mesh;
  };

  const setTransform = (object, position, rotation = [0, 0, 0], scale = [1, 1, 1]) => {
    object.position.set(...position);
    object.rotation.set(...rotation);
    object.scale.set(...scale);
    return object;
  };

  const roundedShape = (width, height, radius) => {
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.min(radius, width / 2, height / 2);
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  };

  const roundedBox = (width, height, depth, radius, boxMaterial, bevel = 0.018, parent = studio) => {
    const geometry = rememberGeometry(new THREE.ExtrudeGeometry(
      roundedShape(width, height, radius),
      {
        depth,
        bevelEnabled: true,
        bevelSegments: lowPowerDevice ? 1 : 3,
        steps: 1,
        bevelSize: Math.min(bevel, radius * 0.38),
        bevelThickness: Math.min(bevel, depth * 0.3),
        curveSegments: lowPowerDevice ? 5 : 9
      }
    ));
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, boxMaterial);
    mesh.castShadow = !lowPowerDevice;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const addCylinderBetween = (start, end, radius, cylinderMaterial, parent = studio, radialSegments = 16) => {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = to.clone().sub(from);
    const cylinder = addMesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), lowPowerDevice ? 8 : radialSegments),
      cylinderMaterial,
      parent
    );
    cylinder.position.copy(from).add(to).multiplyScalar(0.5);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return cylinder;
  };

  const makeCanvasTexture = (width, height, draw) => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext('2d');
    draw(context, width, height);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    disposableTextures.push(texture);
    return { texture, canvas: textureCanvas, context };
  };

  const roundedRect2d = (context, x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  };

  const environmentTextureData = makeCanvasTexture(512, 256, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#dce6f0');
    gradient.addColorStop(1, '#8fa1b6');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(width * 0.2, height * 0.15, 4, width * 0.2, height * 0.15, width * 0.38);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  });
  environmentTextureData.texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environmentTextureData.texture;
  scene.environmentIntensity = 0.54;

  const screenPages = [
    { step: '01 / OBSERVE', title: '观察正在发生的事', note: 'Research signals', active: 0 },
    { step: '02 / DECIDE', title: '把证据变成判断', note: 'Product decisions', active: 1 },
    { step: '03 / VALIDATE', title: '用原型快速验证', note: 'Prototype in motion', active: 2 },
    { step: 'MUZI / BUILD', title: '正在构建下一件事', note: 'Creator studio online', active: 1 }
  ];
  const screenTextureData = makeCanvasTexture(1024, 640, () => {});

  const drawScreen = (pageIndex, phase = 0) => {
    const { context, canvas: textureCanvas, texture } = screenTextureData;
    const { width, height } = textureCanvas;
    const page = screenPages[pageIndex];
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#1f2b3a';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#aabdd3';
    context.font = '600 18px system-ui, -apple-system, sans-serif';
    context.fillText('MUZI / PRODUCT SYSTEM', 58, 58);
    context.fillStyle = '#718caf';
    context.beginPath();
    context.arc(width - 62, 52, 7 + Math.sin(phase * 2) * 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#edf3f8';
    context.font = '700 40px system-ui, -apple-system, "PingFang SC", sans-serif';
    context.fillText(page.title, 58, 142);
    context.fillStyle = '#91a5bb';
    context.font = '550 18px system-ui, -apple-system, sans-serif';
    context.fillText(page.step, 58, 185);

    ['观察', '判断', '验证'].forEach((label, index) => {
      const x = 58 + index * 300;
      const isActive = index === page.active;
      context.fillStyle = isActive ? '#718caf' : '#2b3b4e';
      roundedRect2d(context, x, 242, 262, 194, 22);
      context.fill();
      context.fillStyle = isActive ? '#ffffff' : '#a5b5c6';
      context.font = '650 22px system-ui, -apple-system, "PingFang SC", sans-serif';
      context.fillText(label, x + 24, 286);
      context.font = '500 15px system-ui, -apple-system, sans-serif';
      context.fillText(['12 signals', '4 decisions', '3 prototypes'][index], x + 24, 322);
      for (let row = 0; row < 3; row += 1) {
        context.fillStyle = isActive ? 'rgba(255,255,255,.54)' : '#425267';
        roundedRect2d(context, x + 24, 354 + row * 24, 122 + row * 34, 7, 4);
        context.fill();
      }
    });

    const travel = (Math.sin(phase * 0.85) + 1) / 2;
    context.fillStyle = '#3a4b60';
    roundedRect2d(context, 58, 500, 860, 8, 4);
    context.fill();
    context.fillStyle = '#8fa8c5';
    roundedRect2d(context, 58, 500, 180 + travel * 680, 8, 4);
    context.fill();
    context.fillStyle = '#aab9ca';
    context.font = '500 16px system-ui, -apple-system, sans-serif';
    context.fillText(page.note, 58, 558);
    context.fillStyle = '#718caf';
    context.font = '650 16px system-ui, -apple-system, sans-serif';
    context.fillText('SYSTEM ACTIVE', width - 190, 558);
    texture.needsUpdate = true;
  };

  drawScreen(activeScreen);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTextureData.texture, toneMapped: false });
  disposableMaterials.add(screenMaterial);

  const makeLabel = (eyebrow, title, width = 512, height = 156) => {
    const textureData = makeCanvasTexture(width, height, (context, w, h) => {
      context.clearRect(0, 0, w, h);
      context.fillStyle = 'rgba(251,252,253,.96)';
      roundedRect2d(context, 2, 2, w - 4, h - 4, 28);
      context.fill();
      context.strokeStyle = 'rgba(78,99,125,.17)';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#718caf';
      context.font = '650 21px system-ui, -apple-system, sans-serif';
      context.fillText(eyebrow, 34, 50);
      context.fillStyle = '#27384e';
      context.font = '650 29px system-ui, -apple-system, "PingFang SC", sans-serif';
      context.fillText(title, 34, 103);
    });
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: textureData.texture,
      transparent: true,
      toneMapped: false,
      depthWrite: false
    });
    disposableMaterials.add(labelMaterial);
    return labelMaterial;
  };

  // A complete architectural cutaway replaces the old floating furniture composition.
  const floor = roundedBox(9.2, 6.5, 0.34, 0.2, materials.shell, 0.028, architecture);
  setTransform(floor, [0, -0.18, 0], [Math.PI / 2, 0, 0]);
  const plinth = roundedBox(9.08, 6.38, 0.24, 0.18, materials.blueLight, 0.022, architecture);
  setTransform(plinth, [0, -0.38, 0.03], [Math.PI / 2, 0, 0]);

  const leftWall = addMesh(new THREE.BoxGeometry(0.24, 5.55, 6.05), materials.wall, architecture);
  setTransform(leftWall, [-4.46, 2.58, -0.12]);
  const backLeft = roundedBox(4.85, 5.45, 0.22, 0.18, materials.wall, 0.02, architecture);
  setTransform(backLeft, [-2.0, 2.58, -3.05]);
  const windowBottomWall = roundedBox(4.05, 1.56, 0.22, 0.16, materials.wall, 0.02, architecture);
  setTransform(windowBottomWall, [2.32, 0.63, -3.05]);
  const windowTopWall = roundedBox(4.05, 0.64, 0.22, 0.14, materials.wall, 0.018, architecture);
  setTransform(windowTopWall, [2.32, 5.08, -3.05]);
  const windowSideWall = roundedBox(0.62, 3.05, 0.22, 0.14, materials.wall, 0.018, architecture);
  setTransform(windowSideWall, [4.06, 3.1, -3.05]);
  const ceilingBeam = roundedBox(8.72, 0.24, 0.3, 0.1, materials.shell, 0.012, architecture);
  setTransform(ceilingBeam, [-0.05, 5.38, -2.92]);

  // Large cool window and a quiet two-layer city make the room feel inhabited without adding noise.
  const windowGlass = roundedBox(3.52, 3.25, 0.045, 0.18, materials.glass, 0.008, architecture);
  setTransform(windowGlass, [2.23, 3.08, -3.0]);
  windowGlass.castShadow = false;
  [
    [2.23, 4.72, -2.93, 3.62, 0.1],
    [2.23, 1.45, -2.93, 3.62, 0.1],
    [0.43, 3.08, -2.93, 0.1, 3.36],
    [4.03, 3.08, -2.93, 0.1, 3.36],
    [2.23, 3.08, -2.93, 0.07, 3.22]
  ].forEach(([x, y, z, width, height]) => {
    const frame = roundedBox(width, height, 0.08, 0.04, materials.metal, 0.008, architecture);
    setTransform(frame, [x, y, z]);
  });

  const citySpecs = [
    [0.82, 2.05, -3.45, 0.6, 1.7],
    [1.48, 2.34, -3.52, 0.78, 2.28],
    [2.28, 1.98, -3.48, 0.68, 1.55],
    [3.04, 2.58, -3.55, 0.82, 2.75],
    [3.7, 2.05, -3.5, 0.55, 1.66]
  ];
  citySpecs.forEach(([x, y, z, width, height], index) => {
    const block = roundedBox(width, height, 0.28, 0.07, index % 2 ? materials.cityLight : materials.city, 0.012, cityGroup);
    setTransform(block, [x, y, z]);
    if (!lowPowerDevice) {
      for (let row = 0; row < Math.max(2, Math.floor(height / 0.48)); row += 1) {
        const light = roundedBox(width * 0.5, 0.035, 0.014, 0.014, materials.ceramic, 0.003, cityGroup);
        setTransform(light, [x, y - height * 0.35 + row * 0.37, z + 0.155]);
        light.castShadow = false;
      }
    }
  });
  const cloud = new THREE.Group();
  [[0, 0, 0, 0.34], [0.38, 0.02, 0, 0.25], [-0.34, -0.02, 0, 0.23]].forEach(([x, y, z, radius]) => {
    const puff = addMesh(new THREE.SphereGeometry(radius, 16, 10), materials.ceramic, cloud, false);
    setTransform(puff, [x, y, z], [0, 0, 0], [1.5, 0.72, 0.55]);
  });
  setTransform(cloud, [1.1, 4.25, -3.28], [0, 0, 0], [0.72, 0.72, 0.72]);
  cityGroup.add(cloud);

  // The signal rail binds Observe → Decide → Validate into one spatial story.
  const signalRail = roundedBox(6.9, 0.055, 0.035, 0.026, materials.blue, 0.005, architecture);
  setTransform(signalRail, [-0.12, 0.035, 2.2], [Math.PI / 2, 0, 0]);
  signalRail.castShadow = false;
  const signalOrb = addMesh(new THREE.SphereGeometry(0.095, 18, 12), materials.ceramic, architecture, false);
  setTransform(signalOrb, [-3.42, 0.105, 2.2]);

  // Observation wall: research cards and an e-ink reader form the first layer.
  const observationPanel = roundedBox(2.5, 2.15, 0.12, 0.18, materials.ceramic, 0.018, observationZone);
  setTransform(observationPanel, [-2.63, 3.32, -2.85]);
  const observationLabel = addMesh(new THREE.PlaneGeometry(1.72, 0.53), makeLabel('01 / OBSERVE', '观察'), observationZone, false);
  setTransform(observationLabel, [-2.72, 4.07, -2.765]);
  observationLabel.userData.officeAction = 'writing';
  interactiveMeshes.push(observationLabel);
  const researchCards = [
    [-3.23, 3.26, 0.62, 0.72, materials.blueLight],
    [-2.48, 3.4, 0.72, 0.98, materials.shell],
    [-1.78, 3.12, 0.45, 0.68, materials.blue]
  ];
  researchCards.forEach(([x, y, width, height, cardMaterial], index) => {
    const card = roundedBox(width, height, 0.04, 0.07, cardMaterial, 0.007, observationZone);
    setTransform(card, [x, y, -2.74], [0, 0, index === 1 ? -0.035 : 0.025]);
    card.userData.officeAction = 'writing';
    interactiveMeshes.push(card);
    const lineCount = index === 1 ? 4 : 3;
    for (let row = 0; row < lineCount; row += 1) {
      const line = roundedBox(width * (0.42 + row * 0.08), 0.035, 0.014, 0.016, index === 2 ? materials.ceramic : materials.blue, 0.003, observationZone);
      setTransform(line, [x, y + height * 0.26 - row * 0.14, -2.708]);
      line.castShadow = false;
    }
  });
  const observationShelf = roundedBox(2.7, 0.4, 0.13, 0.08, materials.metal, 0.014, observationZone);
  setTransform(observationShelf, [-2.62, 2.12, -2.42], [Math.PI / 2, 0, 0]);
  const reader = roundedBox(0.82, 1.04, 0.075, 0.11, materials.navy, 0.014, observationZone);
  setTransform(reader, [-3.02, 2.62, -2.39], [0.04, -0.05, -0.035]);
  reader.userData.officeAction = 'writing';
  interactiveMeshes.push(reader);
  const readerPage = roundedBox(0.68, 0.88, 0.025, 0.075, materials.ceramic, 0.006, observationZone);
  setTransform(readerPage, [-3.02, 2.63, -2.335], [0.04, -0.05, -0.035]);
  readerPage.castShadow = false;

  // Suspended desktop removes the forest of legs and reads as a designed room system.
  const deskTop = roundedBox(5.65, 1.72, 0.16, 0.13, materials.ceramic, 0.024);
  setTransform(deskTop, [0.22, 1.98, -0.82], [Math.PI / 2, 0, 0]);
  const deskEdge = roundedBox(5.36, 0.075, 0.075, 0.035, materials.metal, 0.01);
  setTransform(deskEdge, [0.22, 1.88, 0.02]);
  [[-2.23, 1.15, -1.35], [2.67, 1.15, -1.35]].forEach((position) => {
    const support = roundedBox(0.14, 1.46, 0.5, 0.055, materials.metal, 0.014);
    setTransform(support, position);
  });
  const drawer = roundedBox(1.02, 0.74, 1.38, 0.13, materials.blueLight, 0.02);
  setTransform(drawer, [-2.02, 1.46, -0.86]);
  [-0.16, 0.15].forEach((offsetY) => {
    const groove = roundedBox(0.58, 0.035, 0.018, 0.016, materials.blue, 0.004);
    setTransform(groove, [-2.02, 1.5 + offsetY, -0.16]);
    groove.castShadow = false;
  });

  // Modern 24-inch all-in-one: thin metal shell, white bezel, dark high-contrast UI.
  const imac = new THREE.Group();
  roundedBox(3.08, 1.93, 0.095, 0.13, materials.metal, 0.018, imac);
  const imacBezel = roundedBox(2.94, 1.79, 0.032, 0.095, materials.ceramic, 0.009, imac);
  setTransform(imacBezel, [0, 0.025, 0.061]);
  const screen = roundedBox(2.75, 1.49, 0.014, 0.055, screenMaterial, 0.004, imac);
  setTransform(screen, [0, 0.11, 0.083]);
  screen.castShadow = false;
  screen.userData.officeAction = 'screen';
  interactiveMeshes.push(screen);
  const cameraDot = addMesh(new THREE.SphereGeometry(0.018, 10, 8), materials.ink, imac, false);
  setTransform(cameraDot, [0, 0.89, 0.084]);
  const imacNeck = roundedBox(0.25, 0.51, 0.1, 0.065, materials.metal, 0.014, imac);
  setTransform(imacNeck, [0, -1.02, -0.01]);
  const imacBase = roundedBox(1.28, 0.42, 0.075, 0.17, materials.metal, 0.014, imac);
  setTransform(imacBase, [0, -1.15, 0.2], [-Math.PI / 2, 0, 0]);
  setTransform(imac, [-0.12, 3.25, -1.25], [0, -0.035, 0]);
  studio.add(imac);

  const keyboard = new THREE.Group();
  const keyboardTray = roundedBox(1.96, 0.7, 0.07, 0.105, materials.ceramic, 0.014, keyboard);
  setTransform(keyboardTray, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const keyGeometry = rememberGeometry(new THREE.BoxGeometry(0.14, 0.028, 0.12));
  const keyCount = lowPowerDevice ? 24 : 36;
  const keys = new THREE.InstancedMesh(keyGeometry, materials.blueLight, keyCount);
  const keyMatrix = new THREE.Matrix4();
  const columns = lowPowerDevice ? 8 : 9;
  for (let index = 0; index < keyCount; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    keyMatrix.makeTranslation(-0.66 + column * 0.165, 0.055, -0.22 + row * 0.16);
    keys.setMatrixAt(index, keyMatrix);
  }
  keys.castShadow = !lowPowerDevice;
  keyboard.add(keys);
  setTransform(keyboard, [0.14, 2.09, -0.02], [0, -0.02, 0]);
  studio.add(keyboard);
  const trackpad = roundedBox(0.62, 0.53, 0.05, 0.09, materials.ceramic, 0.01);
  setTransform(trackpad, [1.55, 2.09, -0.02], [-Math.PI / 2, 0, 0.035]);
  const phone = roundedBox(0.36, 0.72, 0.055, 0.085, materials.navy, 0.01);
  setTransform(phone, [-1.73, 2.1, -0.02], [-Math.PI / 2, 0, -0.14]);
  phone.userData.officeAction = 'contact';
  interactiveMeshes.push(phone);

  // A restrained ergonomic chair with a real gap between desk, back and character.
  const chair = new THREE.Group();
  const chairSeat = roundedBox(1.28, 1.02, 0.16, 0.28, materials.navy, 0.025, chair);
  setTransform(chairSeat, [0, 1.08, 0], [Math.PI / 2, 0, 0]);
  const chairBackFrame = roundedBox(1.22, 1.58, 0.14, 0.32, materials.navy, 0.025, chair);
  setTransform(chairBackFrame, [0, 2.02, 0.48], [-0.1, 0, 0]);
  const chairMesh = roundedBox(0.92, 1.25, 0.035, 0.26, materials.blueLight, 0.009, chair);
  setTransform(chairMesh, [0, 2.02, 0.575], [-0.1, 0, 0]);
  chairMesh.castShadow = false;
  addCylinderBetween([0, 0.33, 0], [0, 0.98, 0], 0.078, materials.metal, chair);
  const chairHub = addMesh(new THREE.CylinderGeometry(0.13, 0.17, 0.14, 18), materials.navy, chair);
  setTransform(chairHub, [0, 0.26, 0]);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const endpoint = [Math.cos(angle) * 0.7, 0.16, Math.sin(angle) * 0.7];
    addCylinderBetween([0, 0.22, 0], endpoint, 0.032, materials.metal, chair, 12);
    const wheel = addMesh(new THREE.SphereGeometry(0.075, 10, 7), materials.navy, chair);
    setTransform(wheel, [endpoint[0], 0.075, endpoint[2]], [0, 0, 0], [1, 0.62, 1]);
  }
  setTransform(chair, [1.22, 0, 1.02], [0, -0.08, 0]);
  studio.add(chair);

  // Stylised MUZI character, seated and rigged with shoulder, elbow and head pivots.
  const character = new THREE.Group();
  const bodyPivot = new THREE.Group();
  character.add(bodyPivot);
  const pelvis = roundedBox(0.7, 0.36, 0.45, 0.16, materials.navy, 0.02, bodyPivot);
  setTransform(pelvis, [0, 1.5, 0.05]);
  const torso = roundedBox(0.84, 1.02, 0.47, 0.22, materials.blue, 0.024, bodyPivot);
  setTransform(torso, [0, 2.04, 0.01], [-0.045, 0, 0]);
  const collar = roundedBox(0.31, 0.12, 0.49, 0.055, materials.ceramic, 0.01, bodyPivot);
  setTransform(collar, [0, 2.49, -0.015]);
  const neck = addMesh(new THREE.CylinderGeometry(0.13, 0.15, 0.25, 18), materials.skin, bodyPivot);
  setTransform(neck, [0, 2.64, -0.02]);
  const headPivot = new THREE.Group();
  setTransform(headPivot, [0, 2.98, -0.02]);
  bodyPivot.add(headPivot);
  const hairBack = addMesh(new THREE.SphereGeometry(0.46, 24, 18), materials.hair, headPivot);
  setTransform(hairBack, [0, 0.03, 0.1], [0, 0, 0], [1.03, 1.18, 0.93]);
  const face = addMesh(new THREE.SphereGeometry(0.4, 24, 18), materials.skinLight, headPivot);
  setTransform(face, [0, 0.01, -0.1], [0, 0, 0], [0.93, 1.08, 0.82]);
  const hairSweep = addMesh(new THREE.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), materials.hair, headPivot);
  setTransform(hairSweep, [-0.08, 0.26, -0.18], [0.18, 0, -0.18], [1.12, 0.72, 0.74]);

  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  setTransform(leftShoulder, [-0.47, 2.35, -0.02]);
  setTransform(rightShoulder, [0.47, 2.35, -0.02]);
  bodyPivot.add(leftShoulder, rightShoulder);

  const buildArm = (shoulder, side) => {
    addCylinderBetween([0, 0, 0], [side * 0.08, -0.28, -0.3], 0.105, materials.blue, shoulder, 18);
    const elbowPivot = new THREE.Group();
    setTransform(elbowPivot, [side * 0.08, -0.28, -0.3]);
    shoulder.add(elbowPivot);
    addMesh(new THREE.SphereGeometry(0.11, 16, 10), materials.blue, elbowPivot);
    addCylinderBetween([0, 0, 0], [side * 0.2, -0.02, -0.44], 0.085, materials.skin, elbowPivot, 16);
    const hand = addMesh(new THREE.SphereGeometry(0.115, 16, 10), materials.skinLight, elbowPivot);
    setTransform(hand, [side * 0.2, -0.04, -0.47], [0, 0, 0], [1.12, 0.55, 1.38]);
    return { shoulder, elbow: elbowPivot, hand };
  };
  const leftArm = buildArm(leftShoulder, -1);
  const rightArm = buildArm(rightShoulder, 1);

  const buildLeg = (side) => {
    const leg = new THREE.Group();
    setTransform(leg, [side * 0.25, 1.38, 0.05]);
    bodyPivot.add(leg);
    addCylinderBetween([0, 0, 0], [side * 0.04, -0.42, -0.45], 0.14, materials.navy, leg, 18);
    const knee = addMesh(new THREE.SphereGeometry(0.15, 16, 10), materials.navy, leg);
    setTransform(knee, [side * 0.04, -0.43, -0.47]);
    addCylinderBetween([side * 0.04, -0.46, -0.47], [side * 0.05, -1.1, -0.45], 0.115, materials.navy, leg, 18);
    const shoe = roundedBox(0.3, 0.5, 0.16, 0.12, materials.ceramic, 0.018, leg);
    setTransform(shoe, [side * 0.05, -1.18, -0.58], [Math.PI / 2, 0, 0]);
  };
  buildLeg(-1);
  buildLeg(1);
  setTransform(character, [1.18, 0.02, 0.67], [0, -0.08, 0]);
  torso.userData.officeAction = 'about';
  face.userData.officeAction = 'about';
  interactiveMeshes.push(torso, face);
  studio.add(character);

  // Validation station creates a foreground layer and an unmistakable working motion.
  const validationStation = new THREE.Group();
  const stationBase = roundedBox(1.62, 1.28, 0.24, 0.22, materials.ceramic, 0.025, validationStation);
  setTransform(stationBase, [0, 0.14, 0], [Math.PI / 2, 0, 0]);
  const stationColumn = roundedBox(0.78, 1.15, 0.72, 0.16, materials.blue, 0.02, validationStation);
  setTransform(stationColumn, [0, 0.66, 0]);
  const validationLabel = addMesh(new THREE.PlaneGeometry(1.38, 0.42), makeLabel('03 / VALIDATE', '验证'), validationStation, false);
  setTransform(validationLabel, [0, 1.22, 0.38]);
  validationLabel.userData.officeAction = 'work';
  interactiveMeshes.push(validationLabel);
  const prototype = new THREE.Group();
  const prototypeRing = addMesh(new THREE.TorusGeometry(0.38, 0.045, 12, 36), materials.metal, prototype);
  setTransform(prototypeRing, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const prototypeCore = roundedBox(0.48, 0.48, 0.48, 0.12, materials.navy, 0.02, prototype);
  setTransform(prototypeCore, [0, 0, 0], [0.38, 0.42, 0.18]);
  [[0.48, 0, 0], [-0.48, 0, 0], [0, 0.48, 0]].forEach((position) => {
    const node = addMesh(new THREE.SphereGeometry(0.09, 16, 10), materials.ceramic, prototype);
    setTransform(node, position);
  });
  setTransform(prototype, [0, 1.9, 0]);
  prototypeRing.userData.officeAction = 'work';
  prototypeCore.userData.officeAction = 'work';
  interactiveMeshes.push(prototypeRing, prototypeCore);
  validationStation.add(prototype);
  setTransform(validationStation, [3.95, 0.02, 0.55], [0, -0.18, 0], [0.9, 0.9, 0.9]);
  studio.add(validationStation);

  const acrylicRoadmap = roundedBox(1.4, 1.78, 0.055, 0.16, materials.acrylic, 0.01);
  setTransform(acrylicRoadmap, [3.12, 2.55, -1.96], [0.02, -0.08, 0]);
  acrylicRoadmap.userData.officeAction = 'work';
  interactiveMeshes.push(acrylicRoadmap);
  for (let index = 0; index < 3; index += 1) {
    const roadmapLine = roundedBox(0.82 - index * 0.12, 0.06, 0.025, 0.028, index === 1 ? materials.blue : materials.ceramic, 0.005);
    setTransform(roadmapLine, [3.12, 2.9 - index * 0.36, -1.92]);
    roadmapLine.castShadow = false;
  }

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xa8b6c6, 0.96);
  scene.add(hemisphereLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.82);
  keyLight.position.set(-5.5, 10.5, 8.2);
  keyLight.castShadow = !lowPowerDevice;
  keyLight.shadow.mapSize.set(lowPowerDevice ? 512 : 1536, lowPowerDevice ? 512 : 1536);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 28;
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -5;
  keyLight.shadow.bias = -0.00018;
  keyLight.shadow.normalBias = 0.02;
  keyLight.target.position.set(0, 1.8, -0.4);
  scene.add(keyLight, keyLight.target);
  const windowLight = new THREE.DirectionalLight(0xd7e7f5, 0.74);
  windowLight.position.set(5.5, 5.5, -4.5);
  windowLight.target.position.set(0.6, 2.1, 0.4);
  scene.add(windowLight, windowLight.target);
  const rimLight = new THREE.DirectionalLight(0xb8cbe0, 0.54);
  rimLight.position.set(4, 6, 4);
  scene.add(rimLight);
  const screenLight = new THREE.PointLight(0xbfd6ee, 0.34, 4.2, 2);
  screenLight.position.set(-0.1, 3.15, -0.7);
  studio.add(screenLight);

  const actionLabels = {
    screen: 'iMac：切换工作流程',
    writing: '观察区：阅读文章',
    work: '验证台：查看项目',
    about: 'MUZI：了解我',
    contact: '手机：联系我'
  };

  const setStatus = (message) => {
    if (statusElement) statusElement.textContent = message;
  };

  const canRender = () => !destroyed && !contextIsLost && sceneIsVisible && !document.hidden;
  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
  const smoothStep = (edge0, edge1, value) => {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const applyResponsiveLayout = () => {
    const bounds = canvasMount.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(bounds.height || canvas.clientHeight || 1));
    const aspect = width / height;
    const portrait = aspect < 0.82;
    const dprLimit = lowPowerDevice || coarsePointerQuery.matches ? 1 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprLimit));
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    camera.fov = portrait ? 35 : 30;

    if (portrait) {
      studio.scale.setScalar(0.72);
      studio.position.set(0.2, 0.46, 0);
      observationZone.visible = false;
      validationStation.visible = false;
      acrylicRoadmap.visible = false;
      finalCameraPosition.set(9.8, 6.6, 12.6);
      introCameraPosition.set(11.7, 8.0, 15.7);
      finalCameraTarget.set(0.35, 2.25, -0.15);
      introCameraTarget.set(0.1, 2.1, -0.45);
    } else {
      studio.scale.setScalar(1);
      studio.position.set(1.35, 0, 0);
      observationZone.visible = true;
      validationStation.visible = true;
      acrylicRoadmap.visible = true;
      finalCameraPosition.set(11.15, 7.3, 12.75);
      introCameraPosition.set(13.35, 8.7, 16.0);
      finalCameraTarget.set(0.45, 2.25, -0.15);
      introCameraTarget.set(0.1, 2.05, -0.55);
    }
    camera.updateProjectionMatrix();
  };

  const switchScreen = () => {
    activeScreen = (activeScreen + 1) % screenPages.length;
    manualScreenUntil = performance.now() + 10000;
    drawScreen(activeScreen, (performance.now() - timing.startedAt) / 1000);
    setStatus(`iMac 已切换：${screenPages[activeScreen].title}`);
  };

  const goToSection = (selector, message) => {
    document.querySelector(selector)?.scrollIntoView({
      behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    setStatus(message);
  };

  const runAction = (action) => {
    if (action === 'screen') switchScreen();
    else if (action === 'writing') goToSection('#writing', '已前往文章');
    else if (action === 'work') goToSection('#work', '已前往精选项目');
    else if (action === 'about') goToSection('#about', '已前往个人介绍');
    else if (action === 'contact') goToSection('#contact', '已前往联系方式');
  };

  const findAction = (event) => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return '';
    pointerNdc.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(interactiveMeshes, true)[0];
    let object = hit?.object;
    while (object && !object.userData.officeAction) object = object.parent;
    return object?.userData.officeAction || '';
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    timing.lastInteractionAt = performance.now();
    dragState = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      targetX: pointerTarget.x,
      targetY: pointerTarget.y
    };
    canvas.setPointerCapture?.(event.pointerId);
    host.classList.add('is-dragging');
  };

  const handlePointerMove = (event) => {
    const bounds = canvas.getBoundingClientRect();
    timing.lastInteractionAt = performance.now();
    if (dragState?.id === event.pointerId) {
      const deltaX = (event.clientX - dragState.startX) / Math.max(bounds.width, 1);
      const deltaY = (event.clientY - dragState.startY) / Math.max(bounds.height, 1);
      pointerTarget.x = THREE.MathUtils.clamp(dragState.targetX - deltaX * 1.8, -0.72, 0.72);
      pointerTarget.y = THREE.MathUtils.clamp(dragState.targetY + deltaY * 1.3, -0.5, 0.5);
    } else if (!coarsePointerQuery.matches && !reducedMotionQuery.matches) {
      pointerTarget.x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 0.82, -0.42, 0.42);
      pointerTarget.y = THREE.MathUtils.clamp((0.5 - (event.clientY - bounds.top) / bounds.height) * 0.6, -0.3, 0.3);
    }
    const action = findAction(event);
    if (action !== hoveredAction) {
      hoveredAction = action;
      canvas.style.cursor = dragState ? 'grabbing' : action ? 'pointer' : 'grab';
      setStatus(action ? actionLabels[action] : '工作室正在运行 · 拖动视角，点击物件探索');
    }
  };

  const handlePointerUp = (event) => {
    if (!dragState || event.pointerId !== dragState.id) return;
    const moved = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    canvas.releasePointerCapture?.(event.pointerId);
    dragState = null;
    host.classList.remove('is-dragging');
    const action = findAction(event);
    canvas.style.cursor = action ? 'pointer' : 'grab';
    if (moved < 8 && action) runAction(action);
  };

  const handlePointerLeave = () => {
    if (!dragState) {
      hoveredAction = '';
      canvas.style.cursor = 'grab';
      setStatus('工作室正在运行 · 拖动视角，点击物件探索');
    }
  };

  const animateStudio = (now) => {
    animationFrame = 0;
    if (!canRender()) return;
    const elapsed = (now - timing.startedAt) / 1000;
    const frameInterval = 1000 / (lowPowerDevice ? 22 : 40);
    if (now - timing.lastFrameAt < frameInterval) {
      animationFrame = requestAnimationFrame(animateStudio);
      return;
    }

    if (!introComplete) {
      if (!timing.introStartedAt) timing.introStartedAt = now;
      const progress = THREE.MathUtils.clamp((now - timing.introStartedAt) / timing.introDuration, 0, 1);
      const eased = easeOutCubic(progress);
      camera.position.lerpVectors(introCameraPosition, finalCameraPosition, eased);
      cameraTarget.lerpVectors(introCameraTarget, finalCameraTarget, eased);
      if (progress >= 1) {
        introComplete = true;
        host.dataset.officeState = 'entered';
        setStatus('工作室正在运行 · 拖动视角，点击物件探索');
      }
    }

    pointerCurrent.lerp(pointerTarget, 0.09);
    if (now - timing.lastInteractionAt > 2600) pointerTarget.multiplyScalar(0.94);
    if (introComplete) {
      const cameraBreath = reducedMotionQuery.matches ? 0 : Math.sin(elapsed * 0.32) * 0.055;
      camera.position.set(
        finalCameraPosition.x + pointerCurrent.x * 0.7 + cameraBreath,
        finalCameraPosition.y + pointerCurrent.y * 0.36 + Math.sin(elapsed * 0.24) * 0.035,
        finalCameraPosition.z - Math.abs(pointerCurrent.x) * 0.14
      );
      cameraTarget.set(
        finalCameraTarget.x + pointerCurrent.x * 0.28,
        finalCameraTarget.y + pointerCurrent.y * 0.16,
        finalCameraTarget.z
      );
    }

    if (!reducedMotionQuery.matches) {
      const cycle = elapsed % 12;
      const typingWindow = 1 - smoothStep(4.4, 5.2, cycle) + smoothStep(10.0, 10.8, cycle);
      const typing = Math.sin(elapsed * 7.8) * 0.115 * Math.min(1, typingWindow);
      leftShoulder.rotation.x = -0.12 + typing;
      rightShoulder.rotation.x = -0.12 - typing * 0.82;
      leftArm.elbow.rotation.z = typing * 0.52;
      rightArm.elbow.rotation.z = -typing * 0.52;
      bodyPivot.position.y = Math.sin(elapsed * 1.45) * 0.012;
      torso.rotation.z = Math.sin(elapsed * 0.68) * 0.009;

      const headTurn = smoothStep(5.0, 6.3, cycle) - smoothStep(8.0, 9.4, cycle);
      headPivot.rotation.y = -0.14 - headTurn * 0.5;
      headPivot.rotation.x = Math.sin(elapsed * 0.76) * 0.025;
      chair.rotation.y = -0.08 + Math.sin(elapsed * 0.42) * 0.022;
      prototype.rotation.y += workflowBoostUntil > now ? 0.055 : 0.018;
      prototype.rotation.x = Math.sin(elapsed * 0.72) * 0.12;
      signalOrb.position.x = -3.42 + ((elapsed * (workflowBoostUntil > now ? 1.15 : 0.48)) % 1) * 6.6;
      signalOrb.scale.setScalar(0.92 + Math.sin(elapsed * 3.1) * 0.12);
      cloud.position.x = 1.1 + Math.sin(elapsed * 0.12) * 0.48;
      screenLight.intensity = 0.32 + Math.sin(elapsed * 1.2) * 0.035;
    }

    const nextAutoScreenTick = Math.floor(elapsed / 6);
    if (now > manualScreenUntil && nextAutoScreenTick !== autoScreenTick) {
      autoScreenTick = nextAutoScreenTick;
      activeScreen = nextAutoScreenTick % 3;
    }

    if (now - timing.lastScreenDrawAt > (lowPowerDevice ? 180 : 100)) {
      drawScreen(activeScreen, elapsed);
      timing.lastScreenDrawAt = now;
    }
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
    timing.lastFrameAt = now;
    animationFrame = requestAnimationFrame(animateStudio);
  };

  const requestResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      applyResponsiveLayout();
      if (introComplete) {
        camera.position.copy(finalCameraPosition);
        cameraTarget.copy(finalCameraTarget);
        camera.lookAt(cameraTarget);
      }
    });
  };

  const addListener = (target, eventName, handler, options) => {
    target?.addEventListener(eventName, handler, options);
    listeners.push(() => target?.removeEventListener(eventName, handler, options));
  };

  addListener(canvas, 'pointerdown', handlePointerDown);
  addListener(canvas, 'pointermove', handlePointerMove);
  addListener(canvas, 'pointerup', handlePointerUp);
  addListener(canvas, 'pointercancel', handlePointerUp);
  addListener(canvas, 'pointerleave', handlePointerLeave);
  addListener(screenButton, 'click', switchScreen);
  addListener(workflowButton, 'click', () => {
    workflowBoostUntil = performance.now() + 5000;
    activeScreen = (activeScreen + 1) % 3;
    drawScreen(activeScreen, (performance.now() - timing.startedAt) / 1000);
    setStatus('观察 → 判断 → 验证：工作流正在运行');
  });
  addListener(window, 'resize', requestResize, { passive: true });
  addListener(document, 'visibilitychange', () => {
    if (!document.hidden && canRender() && !animationFrame) animationFrame = requestAnimationFrame(animateStudio);
  });
  addListener(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    contextIsLost = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    setStatus('3D 场景连接暂时中断');
  });
  addListener(canvas, 'webglcontextrestored', () => {
    contextIsLost = false;
    setStatus('工作室已恢复');
    if (!animationFrame) animationFrame = requestAnimationFrame(animateStudio);
  });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(requestResize);
    resizeObserver.observe(canvasMount);
  }
  if ('IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      sceneIsVisible = Boolean(entry?.isIntersecting);
      if (sceneIsVisible && canRender() && !animationFrame) animationFrame = requestAnimationFrame(animateStudio);
      if (!sceneIsVisible && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }, { threshold: 0.02 });
    visibilityObserver.observe(host);
  }

  const destroy = () => {
    destroyed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    listeners.splice(0).forEach((remove) => remove());
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    disposableTextures.forEach((texture) => texture.dispose());
    disposableMaterials.forEach((nextMaterial) => nextMaterial.dispose());
    disposableGeometries.forEach((geometry) => geometry.dispose());
    renderer.dispose();
  };

  window.addEventListener('pagehide', destroy, { once: true });
  applyResponsiveLayout();
  camera.position.copy(reducedMotionQuery.matches ? finalCameraPosition : introCameraPosition);
  cameraTarget.copy(reducedMotionQuery.matches ? finalCameraTarget : introCameraTarget);
  camera.lookAt(cameraTarget);
  host.classList.add('is-webgl-ready', 'is-entered');
  host.dataset.officeState = reducedMotionQuery.matches ? 'entered' : 'intro';
  setStatus('工作室正在启动');
  animationFrame = requestAnimationFrame(animateStudio);

  window.__muziOfficeScene = {
    destroy,
    switchScreen,
    runWorkflow: () => {
      workflowBoostUntil = performance.now() + 5000;
    },
    getState: () => ({
      entered: introComplete,
      activeScreen,
      prototypeRotation: prototype.rotation.y,
      signalPosition: signalOrb.position.x,
      typingAngle: leftShoulder.rotation.x,
      headTurn: headPivot.rotation.y
    })
  };
}
