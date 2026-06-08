const DOT_WIDTH = 60;
const DOT_HEIGHT = 40;
const MOVE_DURATION = 220;
const FOLLOW_DELAY = 95;

const ACTIONS = {
  PREVIOUS: 'PREVIOUS',
  NEXT: 'NEXT',
  READ_CURRENT: 'READ_CURRENT',
  INTERACT_OR_NEXT: 'INTERACT_OR_NEXT',
  READ_MISSION: 'READ_MISSION',
  READ_AROUND: 'READ_AROUND',
  HELP_OR_MENU: 'HELP_OR_MENU'
};

const keyboardToDotPadAction = {
  ArrowLeft: ACTIONS.PREVIOUS,
  ArrowRight: ACTIONS.NEXT,
  '1': ACTIONS.READ_CURRENT,
  '2': ACTIONS.INTERACT_OR_NEXT,
  '3': ACTIONS.READ_MISSION,
  '4': ACTIONS.READ_AROUND,
  '5': ACTIONS.HELP_OR_MENU,
  Enter: ACTIONS.INTERACT_OR_NEXT,
  ' ': ACTIONS.INTERACT_OR_NEXT
};

const SCENES = [
  {
    id: 'lumi',
    name: '루미와 첫 인사',
    title: '루미와 첫 인사',
    sessionTitle: 'SESSION 01 · 루미와 첫 인사',
    message: '좌우 패닝키로 루미에게 다가가 인사를 나눠보세요.',
    guide: '캐릭터가 움직일 때 Dot Pad 60×40 출력도 함께 갱신됩니다.',
    speech: '안녕! 나는 루미야.<br>이 마을에 온 걸 환영해!',
    overlayStep: '□ 루미에게 다가가기',
    plain: '화면 아래쪽 길 위에서 플레이어가 오른쪽의 루미를 향해 이동합니다. 루미와 플레이어 사이에는 여백이 있고 위쪽에는 미션 별표가 있습니다.'
  }
];

// Visual-only mode에서 배경 이미지 중앙의 기존 루미/도트링과 겹치지 않도록,
// 조작 캐릭터는 좌측 하단 흙길 레이어를 따라 작게 이동합니다.
const PLAYER_PATH = [
  { label: '왼쪽 숲길 입구', left: 126, top: 522, dot: [13, 32], companion: [[82, 576], [102, 548], [62, 552], [148, 574]], direction: 'right' },
  { label: '아래쪽 흙길', left: 206, top: 526, dot: [21, 32], companion: [[160, 580], [182, 550], [136, 556], [226, 578]], direction: 'right' },
  { label: '중앙 아래 갈림길', left: 286, top: 520, dot: [29, 31], companion: [[240, 574], [262, 546], [218, 552], [308, 572]], direction: 'right' },
  { label: '토토 앞 숲길', left: 366, top: 512, dot: [37, 31], companion: [[320, 566], [344, 540], [298, 548], [386, 566]], nearLumi: true, direction: 'right' }
];

let sceneIndex = 0;
let playerStep = 0;
let progress = 15;
let items = 3;
let greetedLumi = false;
let soundEnabled = false;
let audioContext = null;
let dotCells = [];
let lastDtmsPage = null;

const syncState = {
  previousStep: 0,
  currentStep: 0,
  direction: 'right',
  animState: 'idle',
  isMoving: false,
  trail: []
};

const dotGrid = document.getElementById('dotGrid');
const gameScreen = document.getElementById('gameScreen');
const guideMessage = document.getElementById('guideMessage');
const nextGuide = document.getElementById('nextGuide');
const topLocation = document.getElementById('topLocation');
const tactileScene = document.getElementById('tactileScene');
const tactilePosition = document.getElementById('tactilePosition');
const tactileState = document.getElementById('tactileState');
const sceneBadge = document.getElementById('sceneBadge');
const itemCount = document.getElementById('itemCount');
const sideItems = document.getElementById('sideItems');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const expBar = document.getElementById('expBar');
const expText = document.getElementById('expText');
const speechBubble = document.getElementById('speechBubble');
const actionChip = document.getElementById('actionChip');
const soundToggle = document.getElementById('soundToggle');
const playerSprite = document.getElementById('playerSprite');
const byteCount = document.getElementById('byteCount');
const hexCount = document.getElementById('hexCount');
const hexPreview = document.getElementById('hexPreview');
const plainTextPreview = document.getElementById('plainTextPreview');
const sessionTitleCard = document.getElementById('sessionTitleCard');
const missionOverlayStep = document.getElementById('missionOverlayStep');

function init() {
  buildDotGrid();
  bindEvents();
  seedTrail();
  setMessage('좌우 패닝키로 루미에게 다가가 보세요.', '루미 근처에 도착하면 기능키 2로 대화를 시작할 수 있습니다.');
  renderScene();
}

function buildDotGrid() {
  dotGrid.innerHTML = '';
  dotCells = [];
  for (let y = 0; y < DOT_HEIGHT; y += 1) {
    for (let x = 0; x < DOT_WIDTH; x += 1) {
      const cell = document.createElement('span');
      cell.className = 'dot-cell';
      cell.setAttribute('aria-hidden', 'true');
      dotGrid.appendChild(cell);
      dotCells.push(cell);
    }
  }
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => handleDotPadAction(button.dataset.action));
  });
  window.addEventListener('keydown', event => {
    const action = keyboardToDotPadAction[event.key];
    if (!action) return;
    event.preventDefault();
    handleDotPadAction(action);
  });
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊 효과음 ON' : '🔊 효과음 OFF';
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    playSound('select');
  });
}

function handleDotPadAction(action) {
  if (action === ACTIONS.PREVIOUS) {
    movePlayer(-1);
    return;
  }
  if (action === ACTIONS.NEXT) {
    movePlayer(1);
    return;
  }
  if (action === ACTIONS.INTERACT_OR_NEXT) {
    talkToLumi();
    return;
  }
  if (action === ACTIONS.READ_CURRENT) {
    const step = PLAYER_PATH[playerStep];
    setMessage(`현재 위치는 ${step.label}입니다.`, `Dot Pad 기준 플레이어 위치는 ${step.dot[0]}열, ${step.dot[1]}행 근처입니다.`);
    playSound('select');
  }
  if (action === ACTIONS.READ_MISSION) {
    setMessage('MISSION 01. 루미와 첫 인사', '좌우 패닝키로 루미 근처까지 이동한 뒤 기능키 2로 인사하세요.');
    playSound('select');
  }
  if (action === ACTIONS.READ_AROUND) {
    setMessage('주변에는 오두막, 흙길, 꽃밭, 강, 나무다리가 있습니다.', 'Dot Pad에는 장식 요소를 제외하고 플레이어, 루미, 길, 미션 오브젝트만 명확히 출력됩니다.');
    playSound('select');
  }
  if (action === ACTIONS.HELP_OR_MENU) {
    setMessage('좌우 패닝키로 캐릭터가 이동합니다.', 'F1 현재 위치, F2 대화, F3 미션, F4 주변 설명, F5 도움말입니다.');
    playSound('select');
  }
}

function movePlayer(delta) {
  if (syncState.isMoving) return;

  const nextStep = Math.max(0, Math.min(PLAYER_PATH.length - 1, playerStep + delta));
  if (nextStep === playerStep) {
    syncState.direction = delta < 0 ? 'left' : 'right';
    syncState.animState = 'blocked';
    applyAnimationState();
    addReactionEffect('blocked');
    window.setTimeout(() => {
      syncState.animState = 'idle';
      applyAnimationState();
    }, 280);

    setMessage(delta < 0 ? '더 왼쪽으로는 이동할 수 없습니다.' : '루미가 바로 앞에 있습니다.', delta > 0 ? '기능키 2를 눌러 루미와 인사하세요.' : '오른쪽 패닝키로 루미에게 다가가세요.');
    playSound('select');
    return;
  }

  const previousStep = playerStep;
  const previous = PLAYER_PATH[previousStep];
  playerStep = nextStep;
  const step = PLAYER_PATH[playerStep];

  syncState.previousStep = previousStep;
  syncState.currentStep = playerStep;
  syncState.direction = delta > 0 ? 'right' : 'left';
  syncState.animState = 'walk';
  syncState.isMoving = true;
  pushTrail(previous);

  renderScene();

  addStepEffect(previous.left, previous.top);
  setMessage(`${step.label}으로 이동했습니다.`, step.nearLumi ? '루미가 가까이에 있습니다. 기능키 2로 인사하세요.' : '오른쪽 패닝키를 누르면 루미에게 더 가까워집니다.');
  playSound('move');

  window.setTimeout(() => {
    syncState.animState = 'idle';
    syncState.isMoving = false;
    applyAnimationState();
  }, MOVE_DURATION);
}

function talkToLumi() {
  if (syncState.isMoving) return;

  if (!PLAYER_PATH[playerStep].nearLumi) {
    syncState.animState = 'interact';
    applyAnimationState();
    addReactionEffect('spark');
    setMessage('아직 루미와 거리가 있습니다.', '오른쪽 패닝키로 루미 근처까지 이동한 뒤 기능키 2를 눌러주세요.');
    playSound('select');
    window.setTimeout(() => {
      syncState.animState = 'idle';
      applyAnimationState();
    }, 520);
    return;
  }

  greetedLumi = true;
  progress = Math.max(progress, 45);
  items = Math.max(items, 4);
  syncState.animState = 'success';
  applyAnimationState();
  addReactionEffect('heart');
  speechBubble.innerHTML = '반가워! 이제 함께<br>숲속 마을을 탐험하자!';
  actionChip.textContent = 'F2 대화 완료';
  missionOverlayStep.textContent = '☑ 루미와 첫 인사 완료';
  setMessage('루미와 첫 인사를 나눴어요!', 'MISSION 01 진행률이 올라가고 Dot Pad 출력에 루미 위치가 강조됩니다.');
  playSound('clear');
  renderScene();

  window.setTimeout(() => {
    syncState.animState = 'idle';
    applyAnimationState();
  }, 900);
}

function applyAnimationState() {
  if (!playerSprite) return;
  playerSprite.classList.remove('is-moving', 'is-idle', 'is-interacting', 'is-blocked', 'is-success', 'face-left', 'face-right');
  playerSprite.classList.add(`face-${syncState.direction}`);
  if (syncState.animState === 'walk') playerSprite.classList.add('is-moving');
  if (syncState.animState === 'idle') playerSprite.classList.add('is-idle');
  if (syncState.animState === 'interact') playerSprite.classList.add('is-interacting');
  if (syncState.animState === 'blocked') playerSprite.classList.add('is-blocked');
  if (syncState.animState === 'success') playerSprite.classList.add('is-success');
  gameScreen.dataset.motion = syncState.animState;
  gameScreen.dataset.direction = syncState.direction;
}

function addStepEffect(left, top) {
  const effect = document.createElement('div');
  effect.className = 'step-effect';
  effect.style.left = `${left + 24}px`;
  effect.style.top = `${top + 38}px`;
  gameScreen.appendChild(effect);
  window.setTimeout(() => effect.remove(), 560);
}

function addReactionEffect(type = 'spark') {
  const step = PLAYER_PATH[playerStep];
  const effect = document.createElement('div');
  effect.className = `reaction-effect ${type}`;
  effect.textContent = type === 'heart' ? '♥' : type === 'blocked' ? '!' : '✦';
  effect.style.left = `${step.left + 24}px`;
  effect.style.top = `${step.top - 18}px`;
  gameScreen.appendChild(effect);
  window.setTimeout(() => effect.remove(), 900);
}

function seedTrail() {
  syncState.trail = [];
  for (let i = 0; i < 8; i += 1) pushTrail(PLAYER_PATH[0]);
}

function pushTrail(step) {
  syncState.trail.unshift({
    left: step.left,
    top: step.top,
    dot: [...step.dot],
    companion: step.companion.map(pos => [...pos])
  });
  syncState.trail = syncState.trail.slice(0, 16);
}

function getFollowCompanion(index, fallback) {
  const trailIndex = (index + 1) * 2;
  const follow = syncState.trail[trailIndex];
  if (!follow) return fallback;
  const offsetX = -32 - index * 7;
  const offsetY = 28 + (index % 2) * -20;
  return [follow.left + offsetX, follow.top + offsetY];
}

function renderScene() {
  const scene = SCENES[sceneIndex];
  const step = PLAYER_PATH[playerStep];
  gameScreen.dataset.session = scene.id;
  topLocation.textContent = step.label;
  tactileScene.textContent = scene.name;
  sceneBadge.textContent = scene.name;
  sessionTitleCard.textContent = scene.sessionTitle;
  if (!greetedLumi) missionOverlayStep.textContent = step.nearLumi ? '□ 기능키 2로 인사하기' : '□ 루미에게 다가가기';
  itemCount.textContent = String(items).padStart(2, '0');
  sideItems.textContent = String(items).padStart(2, '0');
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `${progress}%`;
  expBar.style.width = `${Math.min(100, progress + 10)}%`;
  expText.textContent = `EXP ${Math.min(100, progress + 10)}%`;
  tactileState.textContent = step.nearLumi ? 'Lumi Detected ✅' : syncState.isMoving ? 'Synced Moving ✅' : 'Player Ready ✅';
  tactilePosition.textContent = step.label;

  gameScreen.style.setProperty('--player-left', `${step.left}px`);
  gameScreen.style.setProperty('--player-top', `${step.top}px`);

  step.companion.forEach((pos, index) => {
    const followPos = getFollowCompanion(index, pos);
    gameScreen.style.setProperty(`--companion-${index + 1}-left`, `${followPos[0]}px`);
    gameScreen.style.setProperty(`--companion-${index + 1}-top`, `${followPos[1]}px`);
  });

  applyAnimationState();

  const matrix = createTactileMatrix(scene.id, step);
  renderMatrix(matrix);
  lastDtmsPage = sendToDotPad(matrix, {
    page: playerStep + 1,
    title: scene.title,
    plain: createPlainText(step)
  });
  updateDtmsPreview(lastDtmsPage, { plain: createPlainText(step) });
}

function createPlainText(step) {
  return step.nearLumi
    ? '플레이어가 루미 근처에 있습니다. 아래쪽에는 길이 있고, 오른쪽에는 루미가 강조되어 있습니다. 기능키 2로 인사할 수 있습니다.'
    : `플레이어가 ${step.label}에 있습니다. 아래쪽에는 점선 길이 있고, 오른쪽 방향에 루미가 있습니다.`;
}

function setMessage(main, sub) {
  guideMessage.textContent = main;
  nextGuide.textContent = sub;
}

function updateDtmsPreview(result, scene) {
  const page = result?.page || result;
  const graphic = page?.items?.[0]?.graphic;
  if (!graphic) return;
  byteCount.textContent = String(graphic.byteLength || 300);
  hexCount.textContent = String(graphic.hexLength || graphic.data.length);
  plainTextPreview.textContent = page.text?.plain || scene.plain;
  hexPreview.textContent = `${graphic.data.slice(0, 120)}…`;
}

function renderMatrix(matrix) {
  for (let y = 0; y < DOT_HEIGHT; y += 1) {
    for (let x = 0; x < DOT_WIDTH; x += 1) {
      const value = matrix[y][x];
      const cell = dotCells[y * DOT_WIDTH + x];
      cell.className = 'dot-cell';
      if (value === 1) cell.classList.add('on');
      if (value === 2) cell.classList.add('strong');
      if (value === 3) cell.classList.add('player');
      if (value === 4) cell.classList.add('interactive');
    }
  }
}

function blankMatrix() { return Array.from({ length: DOT_HEIGHT }, () => Array(DOT_WIDTH).fill(0)); }
function point(m, x, y, v = 1) { if (x >= 0 && x < DOT_WIDTH && y >= 0 && y < DOT_HEIGHT) m[y][x] = v; }
function line(m, x1, y1, x2, y2, v = 1, dotted = false) {
  const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx + dy, x = x1, y = y1, count = 0;
  while (true) {
    if (!dotted || count % 2 === 0) point(m, x, y, v);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    count += 1;
  }
}
function rect(m, x, y, w, h, v = 1) {
  for (let i = 0; i < w; i += 1) { point(m, x + i, y, v); point(m, x + i, y + h - 1, v); }
  for (let j = 0; j < h; j += 1) { point(m, x, y + j, v); point(m, x + w - 1, y + j, v); }
}
function block(m, x, y, w, h, v = 1, checker = false) { for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) if (!checker || (xx + yy) % 2 === 0) point(m, x + xx, y + yy, v); }
function drawHouse(m, x, y, v = 1) { line(m, x, y + 7, x + 9, y, v); line(m, x + 9, y, x + 18, y + 7, v); rect(m, x + 2, y + 7, 15, 10, v); rect(m, x + 8, y + 12, 4, 5, v); }
function drawTree(m, x, y, v = 1) { for (let yy = -4; yy <= 4; yy += 1) for (let xx = -5; xx <= 5; xx += 1) if (xx * xx + yy * yy <= 22) point(m, x + xx, y + yy, v); line(m, x, y + 5, x, y + 12, v); }
function drawLumi(m, x, y, v = 4) { line(m, x - 3, y - 8, x - 3, y - 3, v); line(m, x + 3, y - 8, x + 3, y - 3, v); rect(m, x - 5, y - 3, 11, 9, v); point(m, x - 2, y, v); point(m, x + 2, y, v); point(m, x, y + 4, v); }
function drawPlayer(m, x, y) { for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) point(m, x + xx, y + yy, 3); }
function drawDotling(m, x, y) { block(m, x, y, 2, 2, 2); point(m, x + 1, y - 1, 2); }
function drawStar(m, x, y, v = 2) { point(m, x, y - 3, v); point(m, x, y + 3, v); point(m, x - 3, y, v); point(m, x + 3, y, v); point(m, x, y, v); point(m, x - 2, y - 2, v); point(m, x + 2, y - 2, v); point(m, x - 2, y + 2, v); point(m, x + 2, y + 2, v); }
function drawHeart(m, x, y, v = 4) {
  [[0,0],[1,0],[3,0],[4,0],[-1,1],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[0,2],[1,2],[2,2],[3,2],[4,2],[1,3],[2,3],[3,3],[2,4]].forEach(([px, py]) => point(m, x + px, y + py, v));
}
function createTactileMatrix(sceneId, step = PLAYER_PATH[playerStep]) {
  const m = blankMatrix();
  line(m, 9, 34, 47, 32, 1, true);
  drawTree(m, 10, 12, 1);
  if (syncState.isMoving) {
    const previous = PLAYER_PATH[syncState.previousStep];
    drawPlayerGhost(m, previous.dot[0], previous.dot[1]);
  }
  drawPlayer(m, step.dot[0], step.dot[1]);
  syncState.trail.slice(2, 6).forEach((trail, index) => drawDotling(m, trail.dot[0] - 2 - index * 2, trail.dot[1] + 1));
  drawLumi(m, 47, 27, 4);
  drawStar(m, 48, 13, step.nearLumi ? 4 : 2);
  if (step.nearLumi) rect(m, 41, 19, 13, 16, 2);
  if (greetedLumi) drawHeart(m, 50, 7, 4);
  return m;
}
function drawPlayerGhost(m, x, y) { for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if ((xx + yy) % 2 === 0) point(m, x + xx, y + yy, 2); }
function sendToDotPad(matrix, scene = SCENES[sceneIndex]) {
  if (window.DotPadBridge) return window.DotPadBridge.sendGraphic(matrix, { page: scene.page || playerStep + 1, title: scene.title, textPlain: scene.plain });
  const binaryMatrix = matrix.map(row => row.map(value => value > 0 ? 1 : 0));
  console.log('60x40 matrix', binaryMatrix);
  return { page: { text: { plain: scene.plain }, items: [{ graphic: { byteLength: 300, hexLength: 600, data: matrixToHex(binaryMatrix) } }] } };
}
function matrixToHex(binaryMatrix) {
  const bits = binaryMatrix.flat();
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | (bits[i + b] || 0);
    bytes.push(byte);
  }
  return bytes.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function playSound(type) {
  if (!soundEnabled) return;
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;
  const notes = type === 'clear' ? [523, 659, 784, 1046] : type === 'select' ? [660, 880] : [330];
  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * .08);
    gain.gain.setValueAtTime(.0001, now + i * .08);
    gain.gain.exponentialRampToValueAtTime(.08, now + i * .08 + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + i * .08 + .07);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now + i * .08);
    osc.stop(now + i * .08 + .08);
  });
}

init();