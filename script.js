const DOT_WIDTH = 60;
const DOT_HEIGHT = 40;

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
  Enter: ACTIONS.INTERACT_OR_NEXT
};

const SCENES = [
  {
    id: 'entrance',
    name: '숲속 마을 입구',
    title: '숲속 마을 입구',
    sessionTitle: 'SESSION 00 · 숲속 마을 입구',
    message: '루미에게 다가가 인사를 나눠보세요.',
    guide: '기능키 2(선택/다음)를 누르면 대화가 시작됩니다.',
    speech: '안녕! 나는 루미야.<br>이 마을에 온 걸 환영해!',
    overlayStep: '□ 루미에게 다가가기',
    plain: '중앙 아래에 플레이어가 있고 오른쪽 위에 루미가 있습니다. 왼쪽 위에는 집, 아래쪽에는 길, 오른쪽에는 물가가 있습니다.',
    player: { left: '335px', top: '260px' },
    lumi: { left: '420px', top: '265px' }
  },
  {
    id: 'path',
    name: '흙길과 표지판',
    title: '흙길과 표지판',
    sessionTitle: 'SESSION 00 · 흙길과 표지판',
    message: '흙길을 따라 루미가 있는 광장으로 이동합니다.',
    guide: '다음 이동 패닝키로 광장 쪽을 살펴보세요.',
    speech: '표지판을 따라오면<br>루미가 있는 곳으로 갈 수 있어!',
    overlayStep: '□ 표지판 방향 확인',
    plain: '화면 아래쪽에 점선 길이 이어지고, 중앙에는 플레이어가 있습니다. 왼쪽에는 표지판, 오른쪽에는 미션 오브젝트가 있습니다.',
    player: { left: '285px', top: '265px' },
    lumi: { left: '420px', top: '265px' }
  },
  {
    id: 'lumi',
    name: '루미 앞',
    title: '루미와 첫 인사',
    sessionTitle: 'SESSION 01 · 루미와 첫 인사',
    message: '루미가 바로 앞에 있어요. 인사를 시작할 수 있습니다.',
    guide: '기능키 2를 눌러 루미와 대화하세요.',
    speech: '안녕! 나는 루미야.<br>기능키 2를 누르면 대화가 시작돼!',
    overlayStep: '□ 루미와 인사하기',
    plain: '왼쪽 아래에 플레이어가 있고 오른쪽 아래에 루미가 있습니다. 두 캐릭터 사이에는 충분한 여백이 있습니다. 위쪽에는 미션 별표가 있습니다.',
    player: { left: '340px', top: '268px' },
    lumi: { left: '435px', top: '272px' }
  },
  {
    id: 'bridge',
    name: '나무다리',
    title: '강가의 나무다리',
    sessionTitle: 'SESSION 00 · 강가의 나무다리',
    message: '강 위의 나무다리가 촉각 그래픽으로 출력됩니다.',
    guide: '기능키 4로 주변 설명을 들어보세요.',
    speech: '저 다리를 건너면<br>새로운 숲길이 나와!',
    overlayStep: '□ 다리 방향 확인',
    plain: '오른쪽에는 세로 물결 패턴의 물가가 있고, 가운데에는 나무다리가 있습니다. 플레이어는 다리 왼쪽에 있습니다.',
    player: { left: '515px', top: '260px' },
    lumi: { left: '420px', top: '265px' }
  }
];

let sceneIndex = 0;
let progress = 15;
let items = 3;
let soundEnabled = false;
let audioContext = null;
let dotCells = [];
let lastDtmsPage = null;

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
const lumiSprite = document.getElementById('lumiSprite');
const byteCount = document.getElementById('byteCount');
const hexCount = document.getElementById('hexCount');
const hexPreview = document.getElementById('hexPreview');
const plainTextPreview = document.getElementById('plainTextPreview');
const sessionTitleCard = document.getElementById('sessionTitleCard');
const missionOverlayStep = document.getElementById('missionOverlayStep');

function init() {
  buildDotGrid();
  bindEvents();
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
    sceneIndex = Math.max(0, sceneIndex - 1);
    setMessage('이전 장면으로 이동했습니다.', '현재 장면의 DTMS 촉각 출력이 다시 갱신됩니다.');
    playSound('move');
  }
  if (action === ACTIONS.NEXT) {
    sceneIndex = Math.min(SCENES.length - 1, sceneIndex + 1);
    setMessage('다음 장면으로 이동했습니다.', 'Dot Pad 60×40 출력이 새 DTMS page로 전환됩니다.');
    playSound('move');
  }
  if (action === ACTIONS.INTERACT_OR_NEXT) {
    progress = Math.min(100, progress + 18);
    items = Math.min(20, items + 1);
    sceneIndex = 2;
    setMessage('루미와 대화를 시작했어요!', 'MISSION 01 진행률이 올라가고 촉각 출력에 루미 위치가 강조됩니다.');
    speechBubble.innerHTML = '반가워! 이제 함께<br>숲속 마을을 탐험하자!';
    actionChip.textContent = 'F2 대화 완료';
    playSound('clear');
  }
  if (action === ACTIONS.READ_CURRENT) {
    setMessage(`현재 위치는 ${SCENES[sceneIndex].name}입니다.`, SCENES[sceneIndex].plain);
    playSound('select');
  }
  if (action === ACTIONS.READ_MISSION) {
    setMessage('MISSION 01. 루미와 첫 인사', '루미에게 다가가 기능키 2로 대화를 시작하세요.');
    playSound('select');
  }
  if (action === ACTIONS.READ_AROUND) {
    setMessage('주변에는 오두막, 흙길, 꽃밭, 강, 나무다리가 있습니다.', 'Dot Pad에는 장식 요소를 제외하고 핵심 오브젝트만 단순 패턴으로 출력됩니다.');
    playSound('select');
  }
  if (action === ACTIONS.HELP_OR_MENU) {
    setMessage('F1 현재 위치, F2 선택, F3 미션, F4 주변 설명, F5 도움말입니다.', '좌우 패닝키로 이전/다음 DTMS page를 탐색합니다.');
    playSound('select');
  }
  renderScene();
}

function renderScene() {
  const scene = SCENES[sceneIndex];
  gameScreen.dataset.session = scene.id;
  topLocation.textContent = scene.name;
  tactileScene.textContent = scene.name;
  sceneBadge.textContent = scene.name;
  sessionTitleCard.textContent = scene.sessionTitle;
  missionOverlayStep.textContent = scene.overlayStep;
  itemCount.textContent = String(items).padStart(2, '0');
  sideItems.textContent = String(items).padStart(2, '0');
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `${progress}%`;
  expBar.style.width = `${Math.min(100, progress + 10)}%`;
  expText.textContent = `EXP ${Math.min(100, progress + 10)}%`;
  tactileState.textContent = scene.id === 'lumi' ? 'Lumi Detected ✅' : 'DTMS page ready ✅';
  tactilePosition.textContent = scene.id === 'bridge' ? '좌측 다리 입구' : scene.id === 'lumi' ? '좌측 하단' : '중앙 하단';
  speechBubble.innerHTML = scene.speech;

  playerSprite.style.left = scene.player.left;
  playerSprite.style.top = scene.player.top;
  lumiSprite.style.left = scene.lumi.left;
  lumiSprite.style.top = scene.lumi.top;

  if (guideMessage.textContent.trim() === '') setMessage(scene.message, scene.guide);

  const matrix = createTactileMatrix(scene.id);
  renderMatrix(matrix);
  lastDtmsPage = sendToDotPad(matrix, scene);
  updateDtmsPreview(lastDtmsPage, scene);
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

function blankMatrix() {
  return Array.from({ length: DOT_HEIGHT }, () => Array(DOT_WIDTH).fill(0));
}

function point(m, x, y, v = 1) {
  if (x >= 0 && x < DOT_WIDTH && y >= 0 && y < DOT_HEIGHT) m[y][x] = v;
}

function line(m, x1, y1, x2, y2, v = 1, dotted = false) {
  const dx = Math.abs(x2 - x1);
  const dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let x = x1;
  let y = y1;
  let count = 0;
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
  for (let i = 0; i < w; i += 1) {
    point(m, x + i, y, v);
    point(m, x + i, y + h - 1, v);
  }
  for (let j = 0; j < h; j += 1) {
    point(m, x, y + j, v);
    point(m, x + w - 1, y + j, v);
  }
}

function block(m, x, y, w, h, v = 1, checker = false) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      if (!checker || (xx + yy) % 2 === 0) point(m, x + xx, y + yy, v);
    }
  }
}

function drawHouse(m, x, y, v = 1) {
  line(m, x, y + 7, x + 9, y, v);
  line(m, x + 9, y, x + 18, y + 7, v);
  rect(m, x + 2, y + 7, 15, 10, v);
  rect(m, x + 8, y + 12, 4, 5, v);
}

function drawTree(m, x, y, v = 1) {
  for (let yy = -4; yy <= 4; yy += 1) {
    for (let xx = -5; xx <= 5; xx += 1) {
      if (xx * xx + yy * yy <= 22) point(m, x + xx, y + yy, v);
    }
  }
  line(m, x, y + 5, x, y + 12, v);
}

function drawLumi(m, x, y, v = 4) {
  line(m, x - 3, y - 8, x - 3, y - 3, v);
  line(m, x + 3, y - 8, x + 3, y - 3, v);
  rect(m, x - 5, y - 3, 11, 9, v);
  point(m, x - 2, y, v);
  point(m, x + 2, y, v);
  point(m, x, y + 4, v);
}

function drawPlayer(m, x, y) {
  for (let yy = -2; yy <= 2; yy += 1) {
    for (let xx = -2; xx <= 2; xx += 1) point(m, x + xx, y + yy, 3);
  }
}

function drawWater(m, x, y, h, v = 1) {
  for (let yy = 0; yy < h; yy += 1) {
    point(m, x + (yy % 4), y + yy, v);
    point(m, x + 5 + ((yy + 2) % 4), y + yy, v);
  }
}

function drawBridge(m, x, y, v = 2) {
  for (let yy = 0; yy < 5; yy += 1) line(m, x, y + yy, x + 15, y + yy, v, yy % 2 === 1);
}

function drawStar(m, x, y, v = 2) {
  point(m, x, y - 3, v);
  point(m, x, y + 3, v);
  point(m, x - 3, y, v);
  point(m, x + 3, y, v);
  point(m, x, y, v);
  point(m, x - 2, y - 2, v);
  point(m, x + 2, y - 2, v);
  point(m, x - 2, y + 2, v);
  point(m, x + 2, y + 2, v);
}

function drawSign(m, x, y, v = 2) {
  rect(m, x, y, 7, 5, v);
  line(m, x + 3, y + 5, x + 3, y + 9, v);
}

function drawObstacle(m, x, y, v = 2) {
  block(m, x, y, 6, 5, v, true);
}

function createTactileMatrix(sceneId) {
  const m = blankMatrix();
  // Core rule: do not copy visual pixel art. Extract only tactile-readable structure.
  // Keep at least 1 pin of whitespace between meaningful objects where possible.
  if (sceneId === 'entrance') {
    drawHouse(m, 5, 4, 1);
    drawTree(m, 28, 11, 1);
    line(m, 8, 31, 44, 31, 1, true);
    drawPlayer(m, 28, 31);
    drawLumi(m, 42, 23, 4);
    drawWater(m, 53, 7, 28, 1);
    drawStar(m, 43, 12, 2);
    return m;
  }
  if (sceneId === 'path') {
    line(m, 5, 29, 55, 29, 1, true);
    line(m, 8, 33, 50, 33, 1, true);
    drawPlayer(m, 30, 29);
    drawSign(m, 12, 17, 2);
    drawObstacle(m, 46, 23, 2);
    drawStar(m, 42, 16, 4);
    return m;
  }
  if (sceneId === 'lumi') {
    line(m, 10, 31, 50, 31, 1, true);
    drawPlayer(m, 22, 31);
    drawLumi(m, 39, 26, 4);
    drawStar(m, 39, 12, 2);
    // One low-density tree as context, safely separated from characters.
    drawTree(m, 12, 12, 1);
    return m;
  }
  if (sceneId === 'bridge') {
    drawWater(m, 50, 4, 32, 1);
    drawBridge(m, 35, 26, 2);
    drawPlayer(m, 30, 28);
    drawObstacle(m, 15, 22, 2);
    line(m, 5, 31, 30, 31, 1, true);
    return m;
  }
  return createTactileMatrix('entrance');
}

function mapDotPadKeyToAction(keyCode) {
  return window.DotPadBridge ? window.DotPadBridge.mapKeyToAction(keyCode, ACTIONS) : null;
}

function sendToDotPad(matrix, scene = SCENES[sceneIndex]) {
  if (window.DotPadBridge) {
    return window.DotPadBridge.sendGraphic(matrix, {
      page: sceneIndex + 1,
      title: scene.title,
      textPlain: scene.plain
    });
  }
  const binaryMatrix = matrix.map(row => row.map(value => value > 0 ? 1 : 0));
  console.log('60x40 matrix', binaryMatrix);
  return { page: { text: { plain: scene.plain }, items: [{ graphic: { byteLength: 300, hexLength: 600, data: '' } }] } };
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
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0.0001, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.07, now + i * 0.08 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.07);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.08);
  });
}

init();
