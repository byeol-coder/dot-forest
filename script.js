const DOT_WIDTH = 60;
const DOT_HEIGHT = 40;

const GAME_STATES = {
  INTRO: 'INTRO',
  GREETING: 'GREETING',
  FIRST_MISSION: 'FIRST_MISSION',
  MISSION_COMPLETE: 'MISSION_COMPLETE',
  FREE_PLAY: 'FREE_PLAY'
};

const ACTIONS = {
  PREVIOUS: 'PREVIOUS',
  NEXT: 'NEXT',
  READ_CURRENT: 'READ_CURRENT',
  INTERACT_OR_NEXT: 'INTERACT_OR_NEXT',
  READ_MISSION: 'READ_MISSION',
  READ_AROUND: 'READ_AROUND',
  HELP_OR_MENU: 'HELP_OR_MENU',
  SKIP_INTRO: 'SKIP_INTRO'
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
  Escape: ACTIONS.SKIP_INTRO
};

const PLACES = [
  { id: 'home', name: '내 집', braille: '내 집입니다', speech: '닷 빌리지에 처음 도착한 작은 집입니다.', hint: '작은 집과 길이 만나는 시작 지점입니다.' },
  { id: 'path', name: '작은 길', braille: '작은 길', speech: '마을을 이어주는 점선 길입니다.', hint: '왼쪽은 내 집, 오른쪽은 사과나무입니다.' },
  { id: 'tree', name: '사과나무', braille: '사과나무', speech: '둥근 수관과 짧은 줄기가 있는 사과나무입니다.', hint: '기능키 2로 나무를 만져볼 수 있어요.' },
  { id: 'plaza', name: '광장', braille: '광장입니다', speech: '마을 친구들이 모이는 둥근 광장입니다.', hint: '루미가 가까워지고 있습니다.' },
  { id: 'lumi', name: '루미', braille: '루미 근처', speech: '작은 토끼 친구 루미가 기다리고 있습니다.', hint: '기능키 2를 누르면 루미와 인사합니다.' },
  { id: 'flower', name: '꽃밭', braille: '꽃밭입니다', speech: '작은 십자 패턴의 꽃들이 모여 있습니다.', hint: '꽃밭은 다음 미션에서 다시 찾아올 수 있어요.' },
  { id: 'bridge', name: '다리', braille: '다리입니다', speech: '강을 건널 수 있는 굵은 점선 다리입니다.', hint: '다리는 강가로 이어집니다.' },
  { id: 'river', name: '강가', braille: '강가입니다', speech: '물결형 점선으로 표현된 강입니다.', hint: '강은 바로 건널 수 없고 다리를 이용해야 합니다.' }
];

let gameState = GAME_STATES.INTRO;
let introStep = 0;
let placeIndex = 0;
let missionComplete = false;
let dotCells = [];

const dotGrid = document.getElementById('dotGrid');
const brailleMessage = document.getElementById('brailleMessage');
const lumiSpeech = document.getElementById('lumiSpeech');
const missionText = document.getElementById('missionText');
const missionBanner = document.getElementById('missionBanner');
const pressHint = document.getElementById('pressHint');
const stateLabel = document.getElementById('stateLabel');
const placeLabel = document.getElementById('placeLabel');
const screenMode = document.getElementById('screenMode');
const screenHint = document.getElementById('screenHint');
const logList = document.getElementById('logList');

function init() {
  buildDotGrid();
  bindEvents();
  setScene({
    state: GAME_STATES.INTRO,
    matrix: createIntroMatrix(0),
    speech: '첫 번째 점이 깨어났어요. 기능키 2로 다음 장면을 열어볼까요?',
    braille: '점이 켜졌어요\n마을이 시작돼요',
    mission: '오프닝을 따라 마을이 깨어나는 모습을 확인해요.',
    place: '첫 번째 점',
    banner: 'MISSION START',
    hint: 'PRESS 기능키 2 TO START'
  });
  addLog('오프닝 시작: 첫 번째 점이 켜졌어요.');
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
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleDotPadAction(button.dataset.action));
  });

  window.addEventListener('keydown', (event) => {
    const action = keyboardToDotPadAction[event.key];
    if (!action) return;
    event.preventDefault();
    handleDotPadAction(action);
  });
}

function handleDotPadAction(action) {
  if (action === ACTIONS.SKIP_INTRO) {
    startMission();
    return;
  }

  if (gameState === GAME_STATES.INTRO || gameState === GAME_STATES.GREETING) {
    handleIntroAction(action);
    return;
  }

  if (action === ACTIONS.PREVIOUS) return moveFocus(-1);
  if (action === ACTIONS.NEXT) return moveFocus(1);
  if (action === ACTIONS.INTERACT_OR_NEXT) return interact();
  if (action === ACTIONS.READ_CURRENT) return readCurrent();
  if (action === ACTIONS.READ_MISSION) return readMission();
  if (action === ACTIONS.READ_AROUND) return readAround();
  if (action === ACTIONS.HELP_OR_MENU) return readHelp();
}

function handleIntroAction(action) {
  if (action === ACTIONS.HELP_OR_MENU) return readHelp();

  if (action !== ACTIONS.INTERACT_OR_NEXT && action !== ACTIONS.NEXT) {
    announce('루미', '오프닝 중에는 기능키 2로 다음 장면을 진행할 수 있어요.', '기능키 2로\n다음 진행');
    return;
  }

  introStep += 1;

  if (introStep === 1) {
    setScene({
      state: GAME_STATES.INTRO,
      matrix: createIntroMatrix(1),
      speech: '작은 길이 생기고, 마을의 불빛이 하나씩 켜집니다.',
      braille: '작은 길 등장\n불빛이 켜짐',
      mission: '기능키 2를 눌러 마을을 조금 더 열어보세요.',
      place: '작은 길',
      banner: 'DOT LOADING',
      hint: '기능키 2로 계속'
    });
    addLog('작은 점선 길이 나타났어요.');
  } else if (introStep === 2) {
    setScene({
      state: GAME_STATES.INTRO,
      matrix: createIntroMatrix(2),
      speech: '집과 나무가 나타났어요. 닷 빌리지의 모습이 보이기 시작합니다.',
      braille: '집과 나무 등장\n마을이 보여요',
      mission: '마을의 기본 구조가 생기고 있어요.',
      place: '집과 나무',
      banner: 'DOT LOADING',
      hint: '기능키 2로 계속'
    });
    addLog('집과 나무가 나타났어요.');
  } else if (introStep === 3) {
    setScene({
      state: GAME_STATES.INTRO,
      matrix: createIntroMatrix(3),
      speech: '강과 다리가 나타났어요. 손끝으로 건널 수 있는 길을 찾아보세요.',
      braille: '강과 다리 등장\n길을 찾아요',
      mission: '강은 바로 건널 수 없고, 다리를 통해 이동합니다.',
      place: '강과 다리',
      banner: 'DOT LOADING',
      hint: '기능키 2로 계속'
    });
    addLog('강과 다리가 나타났어요.');
  } else if (introStep === 4) {
    gameState = GAME_STATES.GREETING;
    setScene({
      state: GAME_STATES.GREETING,
      matrix: createIntroMatrix(4),
      speech: '안녕! 나는 루미야. 닷 빌리지에 온 걸 환영해. 기능키 2로 첫 미션을 시작해줘!',
      braille: '루미: 안녕!\n함께 탐험해요',
      mission: '루미가 당신을 기다리고 있어요.',
      place: '루미 등장',
      banner: 'LUMI APPEARS',
      hint: 'PRESS 기능키 2'
    });
    addLog('루미가 등장했어요.');
    speak('안녕! 나는 루미야. 닷 빌리지에 온 걸 환영해.');
  } else {
    startMission();
  }
}

function startMission() {
  gameState = GAME_STATES.FIRST_MISSION;
  introStep = 99;
  placeIndex = 0;
  missionComplete = false;
  document.body.classList.remove('mission-clear');
  renderPlace();
  addLog('MISSION 01 시작: 좌우 이동키로 루미를 찾고 기능키 2로 인사하세요.');
  speak('미션 01. 루미와 첫 인사. 좌우 이동키로 루미를 찾고 기능키 2로 인사하세요.');
}

function moveFocus(delta) {
  const nextIndex = Math.max(0, Math.min(PLACES.length - 1, placeIndex + delta));
  if (nextIndex === placeIndex) {
    const message = delta < 0 ? '가장 왼쪽 장소입니다.' : '가장 오른쪽 장소입니다.';
    announce('루미', message, '끝 지점입니다\n반대키로 이동');
    return;
  }
  placeIndex = nextIndex;
  renderPlace();
}

function renderPlace() {
  const place = PLACES[placeIndex];
  const isLumi = place.id === 'lumi';

  setScene({
    state: gameState,
    matrix: createVillageMatrix(place.id),
    speech: isLumi ? '루미가 가까이에 있습니다. 기능키 2를 눌러 인사하세요.' : `${place.name}. ${place.speech}`,
    braille: isLumi ? '루미 근처\n기능키2 인사' : `${place.braille}\n${placeIndex + 1}/${PLACES.length} 지점`,
    mission: missionComplete ? '자유 탐색 모드입니다. 좌우 이동키로 마을을 둘러보세요.' : '좌/우 이동키로 루미를 찾고 기능키 2로 인사하세요.',
    place: place.name,
    banner: missionComplete ? 'FREE PLAY' : 'MISSION 01',
    hint: isLumi ? 'PRESS 기능키 2 TO SAY HELLO' : '좌/우 이동키로 탐색'
  });
  addLog(`현재 장소: ${place.name}. ${place.hint}`);
}

function interact() {
  if (gameState === GAME_STATES.FIRST_MISSION && PLACES[placeIndex].id === 'lumi') {
    missionComplete = true;
    gameState = GAME_STATES.MISSION_COMPLETE;
    document.body.classList.add('mission-clear');
    setScene({
      state: GAME_STATES.MISSION_COMPLETE,
      matrix: createMissionClearMatrix(),
      speech: '반가워! 이제 이 마을을 함께 둘러보자. 미션 완료!',
      braille: '미션 완료!\n루미와 인사함',
      mission: 'MISSION CLEAR! 루미와 첫 인사를 나눴어요.',
      place: '루미',
      banner: 'MISSION CLEAR!',
      hint: '기능키 2로 자유 탐색'
    });
    addLog('MISSION CLEAR: 루미와 첫 인사를 나눴어요.');
    speak('미션 완료. 루미와 첫 인사를 나눴어요.');
    return;
  }

  if (gameState === GAME_STATES.MISSION_COMPLETE) {
    gameState = GAME_STATES.FREE_PLAY;
    renderPlace();
    speak('자유 탐색 모드입니다.');
    return;
  }

  const place = PLACES[placeIndex];
  if (place.id === 'tree') {
    announce('사과나무', '톡톡! 사과나무를 만졌어요. 다음 버전에서는 사과를 얻을 수 있어요.', '사과나무 터치\n다음버전 수확');
  } else if (place.id === 'home') {
    announce('내 집', '내 집입니다. 오늘의 모험을 시작한 장소예요.', '내 집입니다\n시작 장소');
  } else if (place.id === 'flower') {
    announce('꽃밭', '작은 꽃밭입니다. 다음 미션에서는 물을 줄 수 있어요.', '꽃밭입니다\n다음미션 예정');
  } else {
    announce(place.name, '지금은 상호작용할 수 없어요. 좌우 이동키로 다른 장소를 찾아보세요.', '상호작용 없음\n좌우로 이동');
  }
}

function readCurrent() {
  const place = PLACES[placeIndex] || { name: '오프닝', speech: '마을이 시작되고 있습니다.', braille: '오프닝' };
  announce('현재 위치', `${place.name}. ${place.speech}`, `${place.braille}\n기능키1 안내`);
}

function readMission() {
  const text = missionComplete ? '미션 완료. 이제 자유 탐색을 할 수 있어요.' : '미션 01. 루미와 첫 인사. 좌우 이동키로 루미를 찾고 기능키 2로 인사하세요.';
  announce('미션', text, missionComplete ? '미션 완료\n자유 탐색' : '미션: 루미찾기\n기능키2 인사');
}

function readAround() {
  if (gameState === GAME_STATES.INTRO || gameState === GAME_STATES.GREETING) {
    announce('주변 설명', '점들이 켜지며 작은 마을이 만들어지고 있어요.', '마을 생성중\n기능키2 계속');
    return;
  }
  const prev = PLACES[placeIndex - 1]?.name || '왼쪽 끝';
  const next = PLACES[placeIndex + 1]?.name || '오른쪽 끝';
  announce('주변 설명', `왼쪽에는 ${prev}, 오른쪽에는 ${next}이 있습니다.`, `왼쪽:${prev}\n오른쪽:${next}`);
}

function readHelp() {
  announce('도움말', '좌측 삼각 이동키는 이전 장소, 우측 삼각 이동키는 다음 장소입니다. 기능키 2는 선택 또는 인사입니다.', '좌/우 이동\n기능키2 선택');
}

function announce(title, speech, braille) {
  lumiSpeech.textContent = `${title}: ${speech}`;
  brailleMessage.innerHTML = braille.replace(/\n/g, '<br>');
  addLog(`${title}: ${speech}`);
  speak(speech);
}

function setScene({ state, matrix, speech, braille, mission, place, banner, hint }) {
  gameState = state;
  renderMatrix(matrix);
  sendToDotPad(matrix);
  lumiSpeech.textContent = speech;
  brailleMessage.innerHTML = braille.replace(/\n/g, '<br>');
  missionText.textContent = mission;
  missionBanner.textContent = banner;
  pressHint.textContent = hint;
  stateLabel.textContent = state;
  placeLabel.textContent = place;
  screenMode.textContent = state;
  screenHint.textContent = hint;
  document.querySelector('.app').dataset.state = state.toLowerCase();
}

function addLog(message) {
  const item = document.createElement('li');
  item.textContent = message;
  logList.prepend(item);
  while (logList.children.length > 8) logList.removeChild(logList.lastElementChild);
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

function createIntroMatrix(step) {
  const m = blankMatrix();
  if (step >= 0) point(m, 30, 20, 2);
  if (step >= 1) {
    line(m, 8, 22, 52, 22, 1, true);
    line(m, 16, 18, 44, 18, 1, true);
  }
  if (step >= 2) {
    drawHouse(m, 8, 9, 1);
    drawTree(m, 23, 9, 1);
    drawTree(m, 42, 10, 1);
    drawFlowers(m, 14, 29, 1);
  }
  if (step >= 3) {
    drawRiver(m, 48, 4, 34, 1);
    drawBridge(m, 44, 22, 2);
  }
  if (step >= 4) {
    drawLumi(m, 30, 17, 4);
    rect(m, 27, 14, 8, 10, 2);
  }
  return m;
}

function createVillageMatrix(focusId) {
  const m = blankMatrix();
  line(m, 6, 24, 54, 24, 1, true);
  line(m, 18, 18, 44, 18, 1, true);
  drawHouse(m, 6, 8, focusId === 'home' ? 4 : 1);
  drawTree(m, 20, 10, focusId === 'tree' ? 4 : 1);
  drawPlaza(m, 29, 19, focusId === 'plaza' ? 4 : 1);
  drawLumi(m, 34, 16, focusId === 'lumi' ? 4 : 1);
  drawFlowers(m, 39, 7, focusId === 'flower' ? 4 : 1);
  drawRiver(m, 50, 3, 34, focusId === 'river' ? 4 : 1);
  drawBridge(m, 46, 23, focusId === 'bridge' ? 4 : 2);

  const focusPoint = {
    home: [11, 20], path: [20, 24], tree: [22, 20], plaza: [30, 24],
    lumi: [34, 24], flower: [40, 18], bridge: [47, 24], river: [52, 20]
  }[focusId] || [30, 24];
  drawPlayer(m, focusPoint[0], focusPoint[1]);
  return m;
}

function createMissionClearMatrix() {
  const m = createVillageMatrix('lumi');
  heart(m, 48, 8, 4);
  heart(m, 12, 30, 2);
  return m;
}

function point(m, x, y, value = 1) {
  if (x >= 0 && x < DOT_WIDTH && y >= 0 && y < DOT_HEIGHT) m[y][x] = value;
}

function line(m, x1, y1, x2, y2, value = 1, dotted = false) {
  const dx = Math.abs(x2 - x1);
  const dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let x = x1;
  let y = y1;
  let count = 0;
  while (true) {
    if (!dotted || count % 2 === 0) point(m, x, y, value);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    count += 1;
  }
}

function rect(m, x, y, w, h, value = 1) {
  for (let i = 0; i < w; i += 1) {
    point(m, x + i, y, value);
    point(m, x + i, y + h - 1, value);
  }
  for (let j = 0; j < h; j += 1) {
    point(m, x, y + j, value);
    point(m, x + w - 1, y + j, value);
  }
}

function drawHouse(m, x, y, value = 1) {
  line(m, x, y + 5, x + 5, y, value);
  line(m, x + 5, y, x + 10, y + 5, value);
  rect(m, x + 1, y + 5, 9, 8, value);
  rect(m, x + 4, y + 8, 3, 5, value);
}

function drawTree(m, x, y, value = 1) {
  for (let yy = -3; yy <= 3; yy += 1) {
    for (let xx = -4; xx <= 4; xx += 1) {
      if (xx * xx + yy * yy <= 13) point(m, x + xx, y + yy, value);
    }
  }
  line(m, x, y + 3, x, y + 8, value);
  line(m, x - 1, y + 8, x + 1, y + 8, value);
}

function drawFlowers(m, x, y, value = 1) {
  const spots = [[0,0], [5,1], [10,0], [2,5], [8,5]];
  spots.forEach(([sx, sy]) => {
    point(m, x + sx, y + sy, value);
    point(m, x + sx - 1, y + sy, value);
    point(m, x + sx + 1, y + sy, value);
    point(m, x + sx, y + sy - 1, value);
    point(m, x + sx, y + sy + 1, value);
  });
}

function drawRiver(m, x, y, h, value = 1) {
  for (let yy = 0; yy < h; yy += 1) {
    const wave = yy % 4;
    point(m, x + wave, y + yy, value);
    point(m, x + 3 + ((wave + 2) % 4), y + yy, value);
  }
}

function drawBridge(m, x, y, value = 2) {
  for (let yy = 0; yy < 5; yy += 1) line(m, x, y + yy, x + 9, y + yy, value, yy % 2 === 1);
}

function drawPlaza(m, cx, cy, value = 1) {
  for (let a = 0; a < 360; a += 18) {
    const rad = a * Math.PI / 180;
    point(m, Math.round(cx + Math.cos(rad) * 7), Math.round(cy + Math.sin(rad) * 5), value);
  }
  point(m, cx, cy, value);
}

function drawLumi(m, x, y, value = 1) {
  line(m, x - 2, y - 6, x - 2, y - 2, value);
  line(m, x + 2, y - 6, x + 2, y - 2, value);
  rect(m, x - 4, y - 2, 9, 7, value);
  point(m, x - 2, y + 0, value);
  point(m, x + 2, y + 0, value);
  point(m, x, y + 3, value);
}

function drawPlayer(m, x, y) {
  for (let yy = -1; yy <= 1; yy += 1) {
    for (let xx = -1; xx <= 1; xx += 1) point(m, x + xx, y + yy, 3);
  }
}

function heart(m, x, y, value = 4) {
  const shape = [[0,0,1,0,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]];
  shape.forEach((row, yy) => row.forEach((v, xx) => { if (v) point(m, x + xx, y + yy, value); }));
}

function mapDotPadKeyToAction(keyCode) {
  const hardwareMap = {
    LEFT_TRIANGLE: ACTIONS.PREVIOUS,
    RIGHT_TRIANGLE: ACTIONS.NEXT,
    FUNCTION_1: ACTIONS.READ_CURRENT,
    FUNCTION_2: ACTIONS.INTERACT_OR_NEXT,
    FUNCTION_3: ACTIONS.READ_MISSION,
    FUNCTION_4: ACTIONS.READ_AROUND,
    FUNCTION_5: ACTIONS.HELP_OR_MENU
  };
  return hardwareMap[keyCode] || null;
}

function sendToDotPad(matrix) {
  const binaryMatrix = matrix.map(row => row.map(value => value > 0 ? 1 : 0));
  console.log('Send 60x40 binary matrix to Dot Pad:', binaryMatrix);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

init();
