import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const DOT_WIDTH = 60;
const DOT_HEIGHT = 40;
const WORLD_LIMIT_X = 26;
const WORLD_LIMIT_Z = 17;
const PANNING_STEP = 1.2;
const ITEM_COLLECT_DISTANCE = 2.25;

const ACTIONS = {
  PREVIOUS: 'PREVIOUS',
  NEXT: 'NEXT',
  READ_CURRENT: 'READ_CURRENT',
  INTERACT_OR_NEXT: 'INTERACT_OR_NEXT',
  READ_MISSION: 'READ_MISSION',
  READ_AROUND: 'READ_AROUND'
};

const keyboardToDotPadAction = {
  ArrowLeft: ACTIONS.PREVIOUS,
  ArrowRight: ACTIONS.NEXT,
  F1: ACTIONS.READ_CURRENT,
  F2: ACTIONS.INTERACT_OR_NEXT,
  F3: ACTIONS.READ_MISSION,
  F4: ACTIONS.READ_AROUND,
  '1': ACTIONS.READ_CURRENT,
  '2': ACTIONS.INTERACT_OR_NEXT,
  '3': ACTIONS.READ_MISSION,
  '4': ACTIONS.READ_AROUND,
  Enter: ACTIONS.INTERACT_OR_NEXT,
  ' ': ACTIONS.INTERACT_OR_NEXT
};

const dom = {
  gameCanvas: document.getElementById('gameCanvas'),
  tactileCanvas: document.getElementById('tactileCanvas'),
  liveStatus: document.getElementById('liveStatus') || document.querySelector('.live-status'),
  scoreText: document.getElementById('scoreText'),
  dotpadState: document.getElementById('dotpadState'),
  connectDotPad: document.getElementById('connectDotPad'),
  exportMatrix: document.getElementById('exportMatrix'),
  collectButton: document.getElementById('collectButton'),
  voiceButton: document.getElementById('voiceButton'),
  resetButton: document.getElementById('resetButton'),
};

const tactileCtx = dom.tactileCanvas ? dom.tactileCanvas.getContext('2d') : null;
const loader = new GLTFLoader();
const clock = new THREE.Clock();

let scene, camera, renderer, mixer;
let lumiRoot = null;
let actions = {};
let currentAction = null;
let dotlingPrototype = null;
let lastMatrix = [];
let dotPadConnected = false;
let speechRecognition = null;

const initialItems = [
  { id: 'dotling-1', x: -14, z: -7, collected: false },
  { id: 'dotling-2', x: -2, z: -11, collected: false },
  { id: 'dotling-3', x: 11, z: -5, collected: false },
  { id: 'dotling-4', x: 15, z: 7, collected: false },
  { id: 'dotling-5', x: -9, z: 9, collected: false },
];

const gameState = {
  player: { x: -20, z: 10, direction: 'down', animation: 'idle' },
  items: structuredClone(initialItems),
  itemMeshes: new Map(),
  obstacles: [
    { x: -20, z: -7, w: 5, d: 6 },
    { x: 1, z: 4, w: 6, d: 5 },
    { x: 20, z: -11, w: 5, d: 7 },
  ],
};

init();

async function init() {
  setupThreeScene();
  createForestWorld();
  setupEventListeners();
  setupSpeechRecognition();
  drawTactileFrame();
  announce('루미가 숲 입구에서 기다리고 있어요. 방향키나 패닝키 구조로 이동할 수 있습니다.');

  await Promise.allSettled([
    loadLumiCharacter(),
    loadDotlingModel(),
  ]);

  placeDotlings();
  updateScore();
  animate();
}

function setupThreeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7db2a0);
  scene.fog = new THREE.Fog(0x7db2a0, 26, 84);

  const width = dom.gameCanvas.clientWidth;
  const height = dom.gameCanvas.clientHeight;

  camera = new THREE.PerspectiveCamera(55, width / height, 0.2, 260);
  camera.position.set(0, 24, 30);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.gameCanvas.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x4d6f43, 2.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-18, 28, 18);
  sun.castShadow = true;
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);

  window.addEventListener('resize', onResize);
}

function createForestWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 48, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x72ad65, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 13, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xcdbb80, roughness: 0.9 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.015;
  path.receiveShadow = true;
  scene.add(path);

  // soft curved path markers
  for (let i = -24; i <= 24; i += 4) {
    const pebble = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.08, 10),
      new THREE.MeshStandardMaterial({ color: 0xe7d8a4, roughness: 0.9 })
    );
    pebble.position.set(i, 0.08, Math.sin(i * 0.25) * 2);
    pebble.castShadow = true;
    scene.add(pebble);
  }

  gameState.obstacles.forEach((obstacle, index) => {
    createTreeCluster(obstacle.x, obstacle.z, index);
  });

  for (let i = 0; i < 18; i++) {
    const x = -32 + Math.random() * 64;
    const z = -22 + Math.random() * 44;
    if (Math.abs(z) < 8 && Math.abs(x) < 28) continue;
    createTreeCluster(x, z, i + 5, 0.7);
  }
}

function createTreeCluster(x, z, seed = 0, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35 * scale, 0.5 * scale, 2.4 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x745432, roughness: 0.9 })
  );
  trunk.position.set(x, 1.2 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.DodecahedronGeometry((2.1 + (seed % 3) * 0.22) * scale),
    new THREE.MeshStandardMaterial({ color: seed % 2 ? 0x3f7f45 : 0x4f9652, roughness: 0.85 })
  );
  crown.position.set(x, 3.25 * scale, z);
  crown.castShadow = true;
  scene.add(crown);
}

async function loadLumiCharacter() {
  const walkGltf = await loader.loadAsync('./models/lumi_walk.glb');
  lumiRoot = walkGltf.scene;
  lumiRoot.name = 'Lumi';
  lumiRoot.scale.setScalar(2.8);
  lumiRoot.position.set(gameState.player.x, 0, gameState.player.z);
  lumiRoot.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  scene.add(lumiRoot);

  mixer = new THREE.AnimationMixer(lumiRoot);

  if (walkGltf.animations?.length) {
    actions.walk = mixer.clipAction(walkGltf.animations[0]);
  }

  try {
    const runGltf = await loader.loadAsync('./models/lumi_run.glb');
    if (runGltf.animations?.length) {
      actions.run = mixer.clipAction(runGltf.animations[0]);
      actions.collect = mixer.clipAction(runGltf.animations[0]);
    }
  } catch (error) {
    console.warn('Running animation could not be loaded. Fallback to walk.', error);
  }

  actions.idle = null;
  playAction('idle');
}

async function loadDotlingModel() {
  try {
    const gltf = await loader.loadAsync('./models/dotring.glb');
    dotlingPrototype = gltf.scene;
    dotlingPrototype.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  } catch (error) {
    console.warn('Dotling GLB could not be loaded. Primitive fallback will be used.', error);
  }
}

function placeDotlings() {
  gameState.itemMeshes.forEach((mesh) => scene.remove(mesh));
  gameState.itemMeshes.clear();

  gameState.items.forEach((item) => {
    let mesh;
    if (dotlingPrototype) {
      mesh = dotlingPrototype.clone(true);
      mesh.scale.setScalar(0.9);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf5b84b, emissive: 0x5a3200, emissiveIntensity: 0.15 })
      );
    }
    mesh.position.set(item.x, 0.45, item.z);
    mesh.name = item.id;
    scene.add(mesh);
    gameState.itemMeshes.set(item.id, mesh);
  });
}

function setupEventListeners() {
  document.addEventListener('keydown', (event) => {
    const action = keyboardToDotPadAction[event.key];
    if (!action) return;
    event.preventDefault();
    handleDotPadAction(action);
  });

  document.querySelectorAll('nav.controls [data-action]').forEach((button) => {
    button.addEventListener('click', () => handleDotPadAction(button.dataset.action));
  });

  if (dom.connectDotPad) dom.connectDotPad.addEventListener('click', connectDotPad);
  if (dom.exportMatrix) dom.exportMatrix.addEventListener('click', () => {
    console.table(lastMatrix);
    announce('현재 60×40 매트릭스를 브라우저 콘솔에 출력했습니다.');
  });
  if (dom.voiceButton) dom.voiceButton.addEventListener('click', startVoiceCommand);
  if (dom.resetButton) dom.resetButton.addEventListener('click', resetGame);
}

function handleDotPadAction(action) {
  if (action === ACTIONS.PREVIOUS) {
    movePlayerByPanningKey(-1);
    return;
  }

  if (action === ACTIONS.NEXT) {
    movePlayerByPanningKey(1);
    return;
  }

  if (action === ACTIONS.INTERACT_OR_NEXT) {
    collectOrInteract();
    return;
  }

  if (action === ACTIONS.READ_CURRENT) {
    announceCurrentPosition();
    return;
  }

  if (action === ACTIONS.READ_MISSION) {
    announceMission();
    return;
  }

  if (action === ACTIONS.READ_AROUND) {
    announceAround();
  }
}

function movePlayerByPanningKey(direction) {
  if (!lumiRoot) return;

  const nextX = THREE.MathUtils.clamp(gameState.player.x + direction * PANNING_STEP, -WORLD_LIMIT_X, WORLD_LIMIT_X);
  if (isBlocked(nextX, gameState.player.z)) {
    playAction('idle');
    announce('앞에 나무 장애물이 있어요. 다른 방향으로 이동해 주세요.', true);
    return;
  }

  gameState.player.x = nextX;
  gameState.player.direction = direction > 0 ? 'right' : 'left';
  updateLumiTransform(gameState.player.direction);
  lumiRoot.position.x = gameState.player.x;

  playAction('walk');
  announce(`루미가 ${direction > 0 ? '오른쪽으로' : '왼쪽으로'} 이동했습니다.`);
  checkNearbyHint();
  drawTactileFrame();
  sendDotPadFrame(lastMatrix);

  clearTimeout(movePlayerByPanningKey.idleTimer);
  movePlayerByPanningKey.idleTimer = setTimeout(() => playAction('idle'), 450);
}

function collectOrInteract() {
  collectNearbyDotling();
}

function announce(message) {
  const safeMessage = String(message ?? "");
  const ids = ["statusMessage", "missionText", "guideMessage", "nextGuide", "dotStatus", "liveStatus"];
  const candidates = [];

  if (typeof dom !== "undefined" && dom) {
    ids.forEach((id) => {
      if (dom[id]) candidates.push(dom[id]);
    });
  }

  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) candidates.push(element);
  });

  const targets = [...new Set(candidates)];

  if (targets.length === 0) {
    console.warn("[Dot Forest] 안내 메시지를 표시할 요소가 없습니다:", safeMessage);
    return;
  }

  targets.forEach((target) => {
    target.textContent = safeMessage;
  });

  console.log("[Dot Forest]", safeMessage);
}

function announceMission() {
  announce('현재 미션은 루미와 첫 인사입니다. 도트링을 수집하며 숲을 탐험해 보세요.');
}

function announceAround() {
  announce('주변에는 나무와 작은 길이 있습니다. 왼쪽/오른쪽 패닝키로 루미를 이동할 수 있어요.');
}

function isBlocked(x, z) {
  return gameState.obstacles.some((obstacle) => {
    const halfW = obstacle.w / 2 + 0.8;
    const halfD = obstacle.d / 2 + 0.8;
    return x > obstacle.x - halfW && x < obstacle.x + halfW && z > obstacle.z - halfD && z < obstacle.z + halfD;
  });
}

function updateLumiTransform(direction) {
  if (!lumiRoot) return;
  lumiRoot.position.set(gameState.player.x, 0, gameState.player.z);

  const rotations = {
    up: Math.PI,
    down: 0,
    left: -Math.PI / 2,
    right: Math.PI / 2,
  };
  lumiRoot.rotation.y = rotations[direction] ?? 0;
}

function playAction(name) {
  if (!mixer) return;
  if (name === 'idle') {
    if (currentAction) currentAction.fadeOut(0.2);
    currentAction = null;
    return;
  }

  const nextAction = actions[name] || actions.walk || actions.run;
  if (!nextAction || nextAction === currentAction) return;

  if (currentAction) currentAction.fadeOut(0.15);
  nextAction.reset().fadeIn(0.15).play();
  currentAction = nextAction;
}

function collectNearbyDotling() {
  const target = gameState.items.find((item) => !item.collected && distance2D(item, gameState.player) <= ITEM_COLLECT_DISTANCE);
  if (!target) {
    announce('가까운 곳에 먹을 수 있는 도트링이 없어요. 조금 더 다가가 보세요.', true);
    return;
  }

  target.collected = true;
  const mesh = gameState.itemMeshes.get(target.id);
  if (mesh) mesh.visible = false;

  playAction('collect');
  announce('도트링을 획득했습니다! 촉각 프리뷰에서 해당 점형이 사라졌습니다.', true);
  updateScore();
  drawTactileFrame();
  sendDotPadFrame(lastMatrix);

  if (gameState.items.every((item) => item.collected)) {
    announce('모든 도트링을 모았습니다. 루미와 도트링들이 숲 탐험을 완료했어요!', true);
  }
}

function checkNearbyHint() {
  const nearby = gameState.items.find((item) => !item.collected && distance2D(item, gameState.player) <= 4);
  if (nearby) {
    announce('도트링이 가까이에 있어요. 먹기 버튼을 눌러보세요.');
  }
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function updateScore() {
  const collected = gameState.items.filter((item) => item.collected).length;
  if (dom.scoreText) dom.scoreText.textContent = `${collected} / ${gameState.items.length}`;
  const itemCount = document.getElementById('itemCount');
  if (itemCount) itemCount.textContent = String(collected).padStart(2, '0');
  const sideItems = document.getElementById('sideItems');
  if (sideItems) sideItems.textContent = String(collected).padStart(2, '0');
}

function createDotPadMatrix() {
  const matrix = Array.from({ length: DOT_HEIGHT }, () => Array(DOT_WIDTH).fill(0));

  drawPath(matrix);
  drawObstacles(matrix);
  drawItems(matrix);
  drawPlayer(matrix);

  return matrix;
}

function worldToDot(x, z) {
  const dotX = Math.round(THREE.MathUtils.mapLinear(x, -WORLD_LIMIT_X, WORLD_LIMIT_X, 2, DOT_WIDTH - 3));
  const dotY = Math.round(THREE.MathUtils.mapLinear(z, -WORLD_LIMIT_Z, WORLD_LIMIT_Z, 2, DOT_HEIGHT - 3));
  return { x: dotX, y: dotY };
}

function setDot(matrix, x, y, value = 1) {
  if (y >= 0 && y < DOT_HEIGHT && x >= 0 && x < DOT_WIDTH) matrix[y][x] = value;
}

function drawPath(matrix) {
  const centerY = Math.floor(DOT_HEIGHT / 2);
  for (let x = 2; x < DOT_WIDTH - 2; x++) {
    const offset = Math.round(Math.sin(x * 0.21) * 2);
    for (let y = centerY - 3 + offset; y <= centerY + 3 + offset; y++) {
      if ((x + y) % 2 === 0) setDot(matrix, x, y, 1);
    }
  }
}

function drawObstacles(matrix) {
  gameState.obstacles.forEach((obstacle) => {
    const min = worldToDot(obstacle.x - obstacle.w / 2, obstacle.z - obstacle.d / 2);
    const max = worldToDot(obstacle.x + obstacle.w / 2, obstacle.z + obstacle.d / 2);
    for (let y = Math.min(min.y, max.y); y <= Math.max(min.y, max.y); y++) {
      for (let x = Math.min(min.x, max.x); x <= Math.max(min.x, max.x); x++) {
        setDot(matrix, x, y, 1);
      }
    }
  });
}

function drawItems(matrix) {
  gameState.items.filter((item) => !item.collected).forEach((item) => {
    const p = worldToDot(item.x, item.z);
    const shape = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ];
    drawShape(matrix, shape, p.x - 1, p.y - 1);
  });
}

function drawPlayer(matrix) {
  const p = worldToDot(gameState.player.x, gameState.player.z);
  const shape = [
    [0, 1, 1, 1, 0],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
  ];
  drawShape(matrix, shape, p.x - 2, p.y - 2);
}

function drawShape(matrix, shape, originX, originY) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) setDot(matrix, originX + x, originY + y, 1);
    }
  }
}

function drawTactileFrame() {
  if (!dom.tactileCanvas || !tactileCtx) return;

  const rect = dom.tactileCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  dom.tactileCanvas.width = Math.floor(rect.width * dpr);
  dom.tactileCanvas.height = Math.floor(rect.height * dpr);
  tactileCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  lastMatrix = createDotPadMatrix();
  const cellW = rect.width / DOT_WIDTH;
  const cellH = rect.height / DOT_HEIGHT;

  tactileCtx.fillStyle = '#162217';
  tactileCtx.fillRect(0, 0, rect.width, rect.height);

  for (let y = 0; y < DOT_HEIGHT; y++) {
    for (let x = 0; x < DOT_WIDTH; x++) {
      if (lastMatrix[y][x]) {
        tactileCtx.fillStyle = '#e8f2d7';
        tactileCtx.beginPath();
        tactileCtx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, Math.min(cellW, cellH) * 0.33, 0, Math.PI * 2);
        tactileCtx.fill();
      }
    }
  }

  drawTactileGrid(cellW, cellH, rect.width, rect.height);
}

function drawTactileGrid(cellW, cellH, width, height) {
  tactileCtx.strokeStyle = 'rgba(255,255,255,0.055)';
  tactileCtx.lineWidth = 1;
  for (let x = 0; x <= DOT_WIDTH; x += 5) {
    tactileCtx.beginPath();
    tactileCtx.moveTo(x * cellW, 0);
    tactileCtx.lineTo(x * cellW, height);
    tactileCtx.stroke();
  }
  for (let y = 0; y <= DOT_HEIGHT; y += 5) {
    tactileCtx.beginPath();
    tactileCtx.moveTo(0, y * cellH);
    tactileCtx.lineTo(width, y * cellH);
    tactileCtx.stroke();
  }
}

async function connectDotPad() {
  dotPadConnected = !dotPadConnected;
  dom.dotpadState.textContent = dotPadConnected ? 'DotPad 연결 준비됨' : 'DotPad 미연결';
  dom.dotpadState.classList.toggle('connected', dotPadConnected);
  announce(dotPadConnected
    ? 'DotPad 연결 준비 상태입니다. 실제 SDK가 연결되면 sendDotPadFrame 함수에서 핀 데이터를 전송합니다.'
    : 'DotPad 연결을 해제했습니다.');
}

function sendDotPadFrame(matrix) {
  // DotPadSDK-1.0.0.js 연결 지점입니다.
  // 예: window.DotPadSDK.sendGraphic(matrixToDeviceBytes(matrix));
  // 현재 MVP에서는 실제 하드웨어 연결 전 단계이므로 콘솔/상태 갱신만 수행합니다.
  if (!dotPadConnected) return;
  const bytes = matrixToPackedBytes(matrix);
  console.log('DotPad frame ready:', { matrix, bytes, hex: bytesToHex(bytes) });
}

function matrixToPackedBytes(matrix) {
  // 60×40 = 2400 bits = 300 bytes. 8핀을 1바이트로 pack합니다.
  const bits = matrix.flat();
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, index) => {
    if (bit) bytes[Math.floor(index / 8)] |= (1 << (7 - (index % 8)));
  });
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    dom.voiceButton.disabled = true;
    dom.voiceButton.textContent = '음성 미지원';
    return;
  }

  speechRecognition = new Recognition();
  speechRecognition.lang = 'ko-KR';
  speechRecognition.interimResults = false;
  speechRecognition.continuous = false;

  speechRecognition.addEventListener('result', (event) => {
    const text = event.results[0][0].transcript.trim();
    handleVoiceCommand(text);
  });
  speechRecognition.addEventListener('end', () => dom.voiceButton.classList.remove('listening'));
}

function startVoiceCommand() {
  if (!speechRecognition) {
    announce('이 브라우저에서는 음성 명령을 지원하지 않습니다.', true);
    return;
  }
  dom.voiceButton.classList.add('listening');
  announce('음성 명령을 듣고 있습니다. 왼쪽, 오른쪽, 먹기 중 하나를 말해 주세요.');
  speechRecognition.start();
}

function handleVoiceCommand(text) {
  const normalized = text.replaceAll(' ', '');
  if (normalized.includes('왼')) return handleDotPadAction(ACTIONS.PREVIOUS);
  if (normalized.includes('오른')) return handleDotPadAction(ACTIONS.NEXT);
  if (normalized.includes('먹') || normalized.includes('수집')) return collectOrInteract();
  announce(`인식한 명령은 ${text}입니다. 지원하는 명령이 아니에요.`, true);
}

function resetGame() {
  gameState.player = { x: -20, z: 10, direction: 'down', animation: 'idle' };
  gameState.items = structuredClone(initialItems);
  updateLumiTransform('down');
  placeDotlings();
  updateScore();
  drawTactileFrame();
  sendDotPadFrame(lastMatrix);
  announce('게임을 다시 시작했습니다. 루미가 숲 입구로 돌아왔어요.', true);
}

function announce(message, speak = false) {
  dom.liveStatus.textContent = message;
  if (speak && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  }
}

function directionToKorean(direction) {
  return ({ up: '앞으로', down: '뒤로', left: '왼쪽으로', right: '오른쪽으로' })[direction] || '이동';
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  gameState.itemMeshes.forEach((mesh, id) => {
    const item = gameState.items.find((entry) => entry.id === id);
    if (item?.collected) return;
    mesh.rotation.y += delta * 0.8;
    mesh.position.y = 0.45 + Math.sin(clock.elapsedTime * 2.2 + item.x) * 0.08;
  });

  if (lumiRoot) {
    const targetX = gameState.player.x;
    const targetZ = gameState.player.z + 28;
    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (24 - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.lookAt(gameState.player.x, 1.6, gameState.player.z);
  }

  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer || !camera) return;
  const width = dom.gameCanvas.clientWidth;
  const height = dom.gameCanvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  drawTactileFrame();
}

// 외부 SDK/하드웨어 이벤트 연결 예시:
// window.handleDotPadPanningKey = (direction) => {
//   if (direction === 'left') handleDotPadAction(ACTIONS.PREVIOUS);
//   if (direction === 'right') handleDotPadAction(ACTIONS.NEXT);
// };
