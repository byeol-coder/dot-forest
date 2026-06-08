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
  { id: 'entrance', name: '숲속 마을 입구', message: '루미에게 다가가 인사를 나눠보세요.', guide: '기능키 2(선택/다음)를 누르면 대화가 시작됩니다.' },
  { id: 'path', name: '흙길과 표지판', message: '흙길을 따라 루미가 있는 광장으로 이동합니다.', guide: '다음 이동 패닝키로 광장 쪽을 살펴보세요.' },
  { id: 'lumi', name: '루미 앞', message: '루미가 바로 앞에 있어요. 인사를 시작할 수 있습니다.', guide: '기능키 2를 눌러 루미와 대화하세요.' },
  { id: 'bridge', name: '나무다리', message: '강 위의 나무다리가 촉각 그래픽으로 출력됩니다.', guide: '기능키 4로 주변 설명을 들어보세요.' }
];

let sceneIndex = 0;
let progress = 15;
let items = 3;
let soundEnabled = false;
let audioContext = null;
let dotCells = [];

const dotGrid = document.getElementById('dotGrid');
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

function init() {
  buildDotGrid();
  bindEvents();
  renderScene();
}

function buildDotGrid() {
  dotGrid.innerHTML = '';
  dotCells = [];
  for (let y = 0; y < DOT_HEIGHT; y++) {
    for (let x = 0; x < DOT_WIDTH; x++) {
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
    setMessage('이전 장면으로 이동했습니다.', '현재 장면의 촉각 출력이 다시 갱신됩니다.');
    playSound('move');
  }
  if (action === ACTIONS.NEXT) {
    sceneIndex = Math.min(SCENES.length - 1, sceneIndex + 1);
    setMessage('다음 장면으로 이동했습니다.', 'Dot Pad 60×40 출력이 새 장면으로 전환됩니다.');
    playSound('move');
  }
  if (action === ACTIONS.INTERACT_OR_NEXT) {
    progress = Math.min(100, progress + 18);
    items = Math.min(20, items + 1);
    setMessage('루미와 대화를 시작했어요!', 'MISSION 01 진행률이 올라가고 촉각 출력에 루미 위치가 강조됩니다.');
    speechBubble.innerHTML = '반가워! 이제 함께<br>숲속 마을을 탐험하자!';
    actionChip.textContent = 'F2 대화 완료';
    playSound('clear');
  }
  if (action === ACTIONS.READ_CURRENT) {
    setMessage(`현재 위치는 ${SCENES[sceneIndex].name}입니다.`, '캐릭터는 Dot Pad 출력 기준 중앙에 있습니다.');
    playSound('select');
  }
  if (action === ACTIONS.READ_MISSION) {
    setMessage('MISSION 01. 루미와 첫 인사', '루미에게 다가가 기능키 2로 대화를 시작하세요.');
    playSound('select');
  }
  if (action === ACTIONS.READ_AROUND) {
    setMessage('주변에는 오두막, 흙길, 꽃밭, 강, 나무다리가 있습니다.', 'Dot Pad에서는 핵심 오브젝트만 단순 패턴으로 출력됩니다.');
    playSound('select');
  }
  if (action === ACTIONS.HELP_OR_MENU) {
    setMessage('F1 현재 위치, F2 선택, F3 미션, F4 주변 설명, F5 도움말입니다.', '좌우 패닝키로 이전/다음 장면을 탐색합니다.');
    playSound('select');
  }
  renderScene();
}

function renderScene() {
  const scene = SCENES[sceneIndex];
  topLocation.textContent = scene.name;
  tactileScene.textContent = scene.name;
  sceneBadge.textContent = scene.name;
  itemCount.textContent = String(items).padStart(2, '0');
  sideItems.textContent = String(items).padStart(2, '0');
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `${progress}%`;
  expBar.style.width = `${Math.min(100, progress + 10)}%`;
  expText.textContent = `EXP ${Math.min(100, progress + 10)}%`;
  tactileState.textContent = scene.id === 'lumi' ? 'Lumi Detected ✅' : '정상 출력 중 ✅';
  tactilePosition.textContent = scene.id === 'bridge' ? '우측 하단' : '중앙';
  if (guideMessage.textContent.trim() === '') setMessage(scene.message, scene.guide);

  playerSprite.style.left = scene.id === 'bridge' ? '515px' : scene.id === 'lumi' ? '365px' : scene.id === 'path' ? '285px' : '335px';
  lumiSprite.style.left = scene.id === 'lumi' ? '445px' : '420px';

  const matrix = createTactileMatrix(scene.id);
  renderMatrix(matrix);
  sendToDotPad(matrix);
}

function setMessage(main, sub) {
  guideMessage.textContent = main;
  nextGuide.textContent = sub;
}

function renderMatrix(matrix) {
  for (let y = 0; y < DOT_HEIGHT; y++) {
    for (let x = 0; x < DOT_WIDTH; x++) {
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
  let err = dx + dy, x = x1, y = y1, c = 0;
  while (true) {
    if (!dotted || c % 2 === 0) point(m, x, y, v);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    c++;
  }
}
function rect(m, x, y, w, h, v = 1) { for (let i = 0; i < w; i++) { point(m, x + i, y, v); point(m, x + i, y + h - 1, v); } for (let j = 0; j < h; j++) { point(m, x, y + j, v); point(m, x + w - 1, y + j, v); } }
function drawHouse(m, x, y, v = 1) { line(m, x, y + 7, x + 8, y, v); line(m, x + 8, y, x + 16, y + 7, v); rect(m, x + 2, y + 7, 13, 11, v); rect(m, x + 7, y + 12, 4, 6, v); }
function drawTree(m, x, y, v = 1) { for (let yy = -4; yy <= 4; yy++) for (let xx = -5; xx <= 5; xx++) if (xx * xx + yy * yy <= 22) point(m, x + xx, y + yy, v); line(m, x, y + 4, x, y + 11, v); }
function drawLumi(m, x, y, v = 4) { line(m, x - 3, y - 8, x - 3, y - 3, v); line(m, x + 3, y - 8, x + 3, y - 3, v); rect(m, x - 5, y - 3, 11, 9, v); point(m, x - 2, y, v); point(m, x + 2, y, v); point(m, x, y + 4, v); }
function drawPlayer(m, x, y) { for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) point(m, x + xx, y + yy, 3); }
function drawWater(m, x, y, h, v = 1) { for (let yy = 0; yy < h; yy++) { point(m, x + (yy % 4), y + yy, v); point(m, x + 5 + ((yy + 2) % 4), y + yy, v); } }
function drawBridge(m, x, y, v = 2) { for (let yy = 0; yy < 5; yy++) line(m, x, y + yy, x + 15, y + yy, v, yy % 2 === 1); }
function drawStar(m, x, y, v = 2) { point(m, x, y - 3, v); point(m, x, y + 3, v); point(m, x - 3, y, v); point(m, x + 3, y, v); point(m, x, y, v); point(m, x - 2, y - 2, v); point(m, x + 2, y - 2, v); point(m, x - 2, y + 2, v); point(m, x + 2, y + 2, v); }

function createTactileMatrix(sceneId) {
  const m = blankMatrix();
  line(m, 7, 29, 52, 29, 1, true);
  drawHouse(m, 6, 7, sceneId === 'entrance' ? 2 : 1);
  drawTree(m, 33, 12, 1);
  drawWater(m, 51, 5, 30, sceneId === 'bridge' ? 2 : 1);
  drawBridge(m, 43, 28, sceneId === 'bridge' ? 4 : 2);
  if (sceneId === 'path') drawStar(m, 24, 28, 2);
  drawLumi(m, 38, 19, sceneId === 'lumi' ? 4 : 1);
  drawPlayer(m, sceneId === 'bridge' ? 45 : sceneId === 'lumi' ? 32 : 27, 28);
  if (sceneId === 'lumi') drawStar(m, 38, 8, 4);
  return m;
}

function mapDotPadKeyToAction(keyCode) { return window.DotPadBridge ? window.DotPadBridge.mapKeyToAction(keyCode, ACTIONS) : null; }
function sendToDotPad(matrix) { if (window.DotPadBridge) return window.DotPadBridge.sendGraphic(matrix); console.log('60x40 matrix', matrix.map(row => row.map(v => v > 0 ? 1 : 0))); }
function playSound(type) {
  if (!soundEnabled) return;
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;
  const notes = type === 'clear' ? [523, 659, 784, 1046] : type === 'select' ? [660, 880] : [330];
  notes.forEach((freq, i) => { const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(freq, now + i * .08); gain.gain.setValueAtTime(.0001, now + i * .08); gain.gain.exponentialRampToValueAtTime(.07, now + i * .08 + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .08 + .07); osc.connect(gain).connect(audioContext.destination); osc.start(now + i * .08); osc.stop(now + i * .08 + .08); });
}

init();
