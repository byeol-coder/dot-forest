const DOT_WIDTH = 60;
const DOT_HEIGHT = 40;

const GAME_STATES = {
  TITLE: 'TITLE',
  INTRO: 'INTRO',
  GREETING: 'GREETING',
  HARDWARE_GUIDE: 'HARDWARE_GUIDE',
  TUTORIAL_PANNING: 'TUTORIAL_PANNING',
  TUTORIAL_FUNCTION_KEYS: 'TUTORIAL_FUNCTION_KEYS',
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

// 촉각 안전 원칙:
// 1) 한 화면의 주 오브젝트는 1개만 크게 표시
// 2) 주 오브젝트와 현재 포커스 표시는 4칸 이상 간격 유지
// 3) 전체 맵을 한 번에 보여주기보다 현재 장소 중심으로 갱신
// 4) 보조 정보는 하단 진행선/점자/음성으로 분리
const PLACES = [
  { id: 'home', name: '내 집', braille: '내 집입니다', speech: '닷 빌리지에 처음 도착한 작은 집입니다.', hint: '시작 지점입니다. 오른쪽 이동키로 다음 장소를 확인합니다.' },
  { id: 'path', name: '작은 길', braille: '작은 길', speech: '마을을 이어주는 점선 길입니다.', hint: '왼쪽은 내 집, 오른쪽은 사과나무입니다.' },
  { id: 'tree', name: '사과나무', braille: '사과나무', speech: '둥근 수관과 짧은 줄기가 있는 사과나무입니다.', hint: '기능키 2로 나무를 만져볼 수 있어요.' },
  { id: 'plaza', name: '광장', braille: '광장입니다', speech: '마을 친구들이 모이는 둥근 광장입니다.', hint: '루미가 가까워지고 있습니다.' },
  { id: 'lumi', name: '루미', braille: '루미 근처', speech: '작은 토끼 친구 루미가 기다리고 있습니다.', hint: '기능키 2를 누르면 루미와 인사합니다.' },
  { id: 'flower', name: '꽃밭', braille: '꽃밭입니다', speech: '작은 십자 패턴의 꽃들이 모여 있습니다.', hint: '꽃밭은 다음 미션에서 다시 찾아올 수 있어요.' },
  { id: 'bridge', name: '다리', braille: '다리입니다', speech: '강을 건널 수 있는 굵은 점선 다리입니다.', hint: '다리는 강가로 이어집니다.' },
  { id: 'river', name: '강가', braille: '강가입니다', speech: '물결형 점선으로 표현된 강입니다.', hint: '강은 바로 건널 수 없고 다리를 이용해야 합니다.' }
];

let gameState = GAME_STATES.TITLE;
let introStep = -1;
let placeIndex = 0;
let missionComplete = false;
let dotCells = [];
let soundEnabled = false;
let audioContext = null;

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
const stageBanner = document.getElementById('stageBanner');
const logList = document.getElementById('logList');
const soundToggle = document.getElementById('soundToggle');
const dotPadStatus = document.getElementById('dotPadStatus');

function init() {
  buildDotGrid();
  bindEvents();
  if (window.DotPadBridge) {
    window.DotPadBridge.connect().then((result) => {
      dotPadStatus.textContent = result.connected ? '하드웨어 연결' : '시뮬레이션 모드';
    });
  }
  showTitle();
}

function showTitle() {
  setScene({
    state: GAME_STATES.TITLE,
    matrix: createTitleMatrix(),
    speech: 'DOT VILLAGE ARCADE. 기능키 2를 누르면 게임이 시작됩니다. 촉각 화면은 겹치지 않도록 한 번에 하나의 주요 장면만 보여줍니다.',
    braille: 'PRESS 기능키2\nTO START',
    mission: '8비트 촉각 마을 게임이 곧 시작됩니다. 촉각 안전 모드로 한 장면씩 안내합니다.',
    place: '타이틀 화면',
    banner: 'TITLE SCREEN',
    stage: 'PRESS 기능키 2 TO START',
    hint: 'PRESS 기능키 2 TO START'
  });
  addLog('타이틀 화면: 기능키 2로 시작하세요. 촉각 안전 모드가 적용되었습니다.');
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
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '효과음 ON' : '효과음 OFF';
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    playSound('select');
  });
}

function handleDotPadAction(action) {
  playSound(action === ACTIONS.INTERACT_OR_NEXT ? 'select' : 'move');

  if (action === ACTIONS.SKIP_INTRO) return startMission();

  if ([GAME_STATES.TITLE, GAME_STATES.INTRO, GAME_STATES.GREETING, GAME_STATES.HARDWARE_GUIDE, GAME_STATES.TUTORIAL_PANNING, GAME_STATES.TUTORIAL_FUNCTION_KEYS].includes(gameState)) {
    return handleStoryAction(action);
  }

  if (action === ACTIONS.PREVIOUS) return moveFocus(-1);
  if (action === ACTIONS.NEXT) return moveFocus(1);
  if (action === ACTIONS.INTERACT_OR_NEXT) return interact();
  if (action === ACTIONS.READ_CURRENT) return readCurrent();
  if (action === ACTIONS.READ_MISSION) return readMission();
  if (action === ACTIONS.READ_AROUND) return readAround();
  if (action === ACTIONS.HELP_OR_MENU) return readHelp();
}

function handleStoryAction(action) {
  if (action === ACTIONS.HELP_OR_MENU) return readHelp();

  if (gameState === GAME_STATES.TUTORIAL_PANNING && (action === ACTIONS.PREVIOUS || action === ACTIONS.NEXT)) {
    return showTutorialFunctionKeys();
  }

  if (action !== ACTIONS.INTERACT_OR_NEXT && action !== ACTIONS.NEXT) {
    announce('루미', '지금은 기능키 2로 다음 장면을 진행할 수 있어요.', '기능키 2로\n다음 진행');
    return;
  }

  if (gameState === GAME_STATES.TITLE) return showIntroStep(0);
  if (gameState === GAME_STATES.INTRO) return showIntroStep(introStep + 1);
  if (gameState === GAME_STATES.GREETING) return showHardwareGuide();
  if (gameState === GAME_STATES.HARDWARE_GUIDE) return showTutorialPanning();
  if (gameState === GAME_STATES.TUTORIAL_PANNING) return showTutorialFunctionKeys();
  if (gameState === GAME_STATES.TUTORIAL_FUNCTION_KEYS) return startMission();
}

function showIntroStep(step) {
  introStep = step;
  const scenes = [
    ['첫 번째 점이 깨어났어요. 화면 중앙에 점 하나만 표시합니다.', '점 1개 표시\n중앙 확인', '첫 번째 점', 'DOT LOADING', '첫 번째 점이 켜졌어요.'],
    ['작은 길이 생겼어요. 길만 단독으로 표시해서 방향을 익힙니다.', '점선 길 등장\n좌우 방향', '작은 길', 'DOT LOADING', '겹침 없이 점선 길만 나타났어요.'],
    ['작은 집이 나타났어요. 다른 오브젝트는 숨기고 집 형태만 보여줍니다.', '집 1개 표시\n모양 확인', '작은 집', 'DOT LOADING', '집이 단독 장면으로 나타났어요.'],
    ['강과 다리가 나타났어요. 강과 다리는 떨어진 위치에 배치해 구분합니다.', '강/다리 표시\n간격 유지', '강과 다리', 'DOT LOADING', '강과 다리를 간격을 두고 표시했어요.'],
    ['안녕! 나는 루미야. 지금은 루미 아이콘만 크게 표시해요. 기능키 2로 하드웨어 조작을 배워보자!', '루미만 표시\n함께 탐험', '루미 등장', 'LUMI APPEARS', '루미가 단독 장면으로 등장했어요.']
  ];

  gameState = step >= scenes.length - 1 ? GAME_STATES.GREETING : GAME_STATES.INTRO;
  const scene = scenes[step] || scenes[scenes.length - 1];
  setScene({
    state: gameState,
    matrix: createIntroMatrix(step),
    speech: scene[0],
    braille: scene[1],
    mission: '기능키 2를 눌러 8비트 촉각 마을을 한 장면씩 열어보세요.',
    place: scene[2],
    banner: scene[3],
    stage: step >= 4 ? 'LUMI APPEARS!' : 'DOT LOADING...',
    hint: '기능키 2로 계속'
  });
  addLog(scene[4]);
  if (step >= 4) speak('안녕! 나는 루미야. 닷 빌리지에 온 걸 환영해.');
}

function showHardwareGuide() {
  setScene({
    state: GAME_STATES.HARDWARE_GUIDE,
    matrix: createHardwareGuideMatrix(),
    speech: '이 화면은 실제 닷 패드 키 구조만 단순하게 보여줍니다. 왼쪽 이동키, 기능키 다섯 개, 오른쪽 이동키가 서로 겹치지 않습니다.',
    braille: '좌/기능키/우\n간격 확인',
    mission: '하드웨어 키 위치를 촉각적으로 익혀요. 각 키는 분리된 블록으로 표시합니다.',
    place: '하드웨어 안내',
    banner: 'HARDWARE GUIDE',
    stage: 'HARDWARE GUIDE',
    hint: '기능키 2로 다음'
  });
  addLog('하드웨어 안내: 좌/기능키/우 키 영역을 분리해서 표시합니다.');
}

function showTutorialPanning() {
  setScene({
    state: GAME_STATES.TUTORIAL_PANNING,
    matrix: createPanningTutorialMatrix(),
    speech: '좌측 이동키는 이전 장소, 우측 이동키는 다음 장소입니다. 화면에는 이동 방향과 현재 포커스만 표시합니다.',
    braille: '좌/우 이동키\n포커스 이동',
    mission: '튜토리얼: 좌측/우측 이동키로 장소 포커스를 이동합니다.',
    place: '패닝키 튜토리얼',
    banner: 'TUTORIAL 01',
    stage: 'TRY LEFT OR RIGHT KEY',
    hint: '좌/우 이동키를 눌러보기'
  });
  addLog('튜토리얼 01: 현재 포커스와 좌우 방향만 표시합니다.');
}

function showTutorialFunctionKeys() {
  setScene({
    state: GAME_STATES.TUTORIAL_FUNCTION_KEYS,
    matrix: createFunctionKeyTutorialMatrix(),
    speech: '좋아요! 기능키 1은 현재 위치, 2는 선택과 인사, 3은 미션, 4는 주변 설명, 5는 도움말입니다. 기능키는 서로 떨어진 5개 블록으로 표시됩니다.',
    braille: '기능키 1-5\n분리 표시',
    mission: '튜토리얼: 기능키 1~5 역할을 확인합니다. 기능키 2를 누르면 첫 미션이 시작됩니다.',
    place: '기능키 튜토리얼',
    banner: 'TUTORIAL 02',
    stage: 'PRESS 기능키 2 FOR MISSION',
    hint: '기능키 2로 미션 시작'
  });
  addLog('튜토리얼 02: 기능키 1~5를 겹치지 않는 독립 블록으로 안내합니다.');
}

function startMission() {
  gameState = GAME_STATES.FIRST_MISSION;
  introStep = 99;
  placeIndex = 0;
  missionComplete = false;
  document.querySelector('.app').dataset.state = 'first_mission';
  document.body.classList.remove('mission-clear');
  stageBanner.textContent = 'MISSION START!';
  renderPlace();
  addLog('MISSION 01 시작: 한 화면에 현재 장소 하나만 크게 표시합니다. 좌우 이동키로 루미를 찾으세요.');
  speak('미션 01. 루미와 첫 인사. 좌우 이동키로 루미를 찾고 기능키 2로 인사하세요.');
  playSound('start');
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
    speech: isLumi ? '루미가 가까이에 있습니다. 기능키 2를 눌러 인사하세요. 화면에는 루미와 현재 포커스만 분리해서 표시합니다.' : `${place.name}. ${place.speech}`,
    braille: isLumi ? '루미 근처\n기능키2 인사' : `${place.braille}\n${placeIndex + 1}/${PLACES.length} 지점`,
    mission: missionComplete ? '자유 탐색 모드입니다. 좌우 이동키로 마을을 한 장소씩 둘러보세요.' : '좌/우 이동키로 루미를 찾고 기능키 2로 인사하세요. 현재 장소만 촉각 화면에 표시됩니다.',
    place: place.name,
    banner: missionComplete ? 'FREE PLAY' : 'MISSION 01',
    stage: isLumi ? 'PRESS 기능키 2 TO SAY HELLO' : '',
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
      speech: '반가워! 이제 이 마을을 함께 둘러보자. 미션 완료! 축하 표시는 화면 양쪽에 분리해서 표시합니다.',
      braille: '미션 완료!\n루미와 인사함',
      mission: 'MISSION CLEAR! 루미와 첫 인사를 나눴어요.',
      place: '루미',
      banner: 'MISSION CLEAR!',
      stage: 'MISSION CLEAR!',
      hint: '기능키 2로 자유 탐색'
    });
    addLog('MISSION CLEAR: 루미와 첫 인사를 나눴어요.');
    speak('미션 완료. 루미와 첫 인사를 나눴어요.');
    playSound('clear');
    return;
  }

  if (gameState === GAME_STATES.MISSION_COMPLETE) {
    gameState = GAME_STATES.FREE_PLAY;
    renderPlace();
    speak('자유 탐색 모드입니다.');
    return;
  }

  const place = PLACES[placeIndex];
  if (place.id === 'tree') announce('사과나무', '톡톡! 사과나무를 만졌어요. 다음 버전에서는 사과를 얻을 수 있어요.', '사과나무 터치\n다음버전 수확');
  else if (place.id === 'home') announce('내 집', '내 집입니다. 오늘의 모험을 시작한 장소예요.', '내 집입니다\n시작 장소');
  else if (place.id === 'flower') announce('꽃밭', '작은 꽃밭입니다. 다음 미션에서는 물을 줄 수 있어요.', '꽃밭입니다\n다음미션 예정');
  else announce(place.name, '지금은 상호작용할 수 없어요. 좌우 이동키로 다른 장소를 찾아보세요.', '상호작용 없음\n좌우로 이동');
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
  if ([GAME_STATES.TITLE, GAME_STATES.INTRO, GAME_STATES.GREETING, GAME_STATES.HARDWARE_GUIDE, GAME_STATES.TUTORIAL_PANNING, GAME_STATES.TUTORIAL_FUNCTION_KEYS].includes(gameState)) {
    announce('주변 설명', '현재 화면은 안내 장면입니다. 그래픽을 겹치지 않게 한 장면씩 보여주고 있어요.', '안내 장면\n단일 그래픽');
    return;
  }
  const prev = PLACES[placeIndex - 1]?.name || '왼쪽 끝';
  const next = PLACES[placeIndex + 1]?.name || '오른쪽 끝';
  announce('주변 설명', `왼쪽에는 ${prev}, 오른쪽에는 ${next}이 있습니다.`, `왼쪽:${prev}\n오른쪽:${next}`);
}
function readHelp() {
  announce('도움말', '좌측 삼각 이동키는 이전 장소, 우측 삼각 이동키는 다음 장소입니다. 촉각 화면에는 한 번에 하나의 주요 오브젝트만 표시합니다.', '한 화면 1개\n좌/우 이동');
}
function announce(title, speech, braille) {
  lumiSpeech.textContent = `${title}: ${speech}`;
  brailleMessage.innerHTML = braille.replace(/\n/g, '<br>');
  addLog(`${title}: ${speech}`);
  speak(speech);
}
function setScene({ state, matrix, speech, braille, mission, place, banner, stage, hint }) {
  gameState = state;
  renderMatrix(matrix);
  sendToDotPad(matrix);
  lumiSpeech.textContent = speech;
  brailleMessage.innerHTML = braille.replace(/\n/g, '<br>');
  missionText.textContent = mission;
  missionBanner.textContent = banner;
  stageBanner.textContent = stage || '';
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
function blankMatrix() { return Array.from({ length: DOT_HEIGHT }, () => Array(DOT_WIDTH).fill(0)); }

// TITLE/INTRO: 한 장면에 하나의 핵심 요소만 표시
function createTitleMatrix() {
  const m = blankMatrix();
  drawLumi(m, 30, 16, 4);
  line(m, 20, 31, 40, 31, 2, true);
  return m;
}
function createIntroMatrix(step) {
  const m = blankMatrix();
  if (step === 0) point(m, 30, 20, 2);
  else if (step === 1) line(m, 12, 22, 48, 22, 1, true);
  else if (step === 2) drawHouse(m, 24, 10, 1);
  else if (step === 3) { drawRiver(m, 18, 6, 26, 1); drawBridge(m, 34, 20, 2); }
  else drawLumi(m, 30, 17, 4);
  return m;
}
function createHardwareGuideMatrix() {
  const m = blankMatrix();
  // 실제 하드웨어 구조를 세 구역으로 분리: 좌측키 / 기능키 / 우측키
  drawLeftTriangle(m, 10, 22, 3);
  for (let i = 0; i < 5; i += 1) rect(m, 20 + i * 5, 18, 3, 7, i === 1 ? 4 : 2);
  drawRightTriangle(m, 50, 22, 3);
  return m;
}
function createPanningTutorialMatrix() {
  const m = blankMatrix();
  drawLeftTriangle(m, 12, 20, 3);
  drawFocusMarker(m, 30, 20, 2);
  drawRightTriangle(m, 48, 20, 3);
  return m;
}
function createFunctionKeyTutorialMatrix() {
  const m = blankMatrix();
  for (let i = 0; i < 5; i += 1) rect(m, 13 + i * 8, 14, 4, 10, i === 1 ? 4 : 2);
  return m;
}

// PLAY: 전체 맵 대신 현재 장소 1개 + 하단 진행선만 표시
function createVillageMatrix(focusId) {
  const m = blankMatrix();
  drawCurrentPlace(m, focusId);
  drawProgressRail(m, PLACES.findIndex(place => place.id === focusId));
  return m;
}
function drawCurrentPlace(m, focusId) {
  const centerX = 30;
  const centerY = 13;
  const value = focusId === 'lumi' ? 4 : 1;
  if (focusId === 'home') drawHouse(m, 24, 7, value);
  else if (focusId === 'path') line(m, 15, centerY, 45, centerY, value, true);
  else if (focusId === 'tree') drawTree(m, centerX, 11, value);
  else if (focusId === 'plaza') drawPlaza(m, centerX, centerY, value);
  else if (focusId === 'lumi') drawLumi(m, centerX, 14, value);
  else if (focusId === 'flower') drawFlowers(m, 21, 11, value);
  else if (focusId === 'bridge') drawBridge(m, 25, 13, value);
  else if (focusId === 'river') drawRiver(m, 28, 5, 22, value);
  drawFocusMarker(m, 30, 29, 3);
}
function drawProgressRail(m, currentIndex) {
  line(m, 8, 34, 52, 34, 1, true);
  PLACES.forEach((_, index) => {
    const x = 8 + Math.round((44 / (PLACES.length - 1)) * index);
    rect(m, x - 1, 32, 3, 5, index === currentIndex ? 4 : 1);
  });
}
function createMissionClearMatrix() {
  const m = blankMatrix();
  drawLumi(m, 30, 14, 4);
  heart(m, 8, 9, 2);
  heart(m, 45, 9, 2);
  drawFocusMarker(m, 30, 29, 3);
  return m;
}
function point(m, x, y, value = 1) { if (x >= 0 && x < DOT_WIDTH && y >= 0 && y < DOT_HEIGHT) m[y][x] = value; }
function line(m, x1, y1, x2, y2, value = 1, dotted = false) {
  const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx + dy, x = x1, y = y1, count = 0;
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
  for (let i=0;i<w;i++){ point(m,x+i,y,value); point(m,x+i,y+h-1,value); }
  for (let j=0;j<h;j++){ point(m,x,y+j,value); point(m,x+w-1,y+j,value); }
}
function drawHouse(m, x, y, value = 1) {
  line(m,x,y+6,x+6,y,value); line(m,x+6,y,x+12,y+6,value); rect(m,x+2,y+6,9,9,value); rect(m,x+5,y+10,3,5,value);
}
function drawTree(m, x, y, value = 1) {
  for(let yy=-4;yy<=4;yy++) for(let xx=-5;xx<=5;xx++) if(xx*xx+yy*yy<=18) point(m,x+xx,y+yy,value);
  line(m,x,y+4,x,y+10,value); line(m,x-2,y+10,x+2,y+10,value);
}
function drawFlowers(m, x, y, value = 1) {
  [[0,0],[8,0],[16,0],[4,7],[12,7]].forEach(([sx,sy]) => {
    point(m,x+sx,y+sy,value); point(m,x+sx-1,y+sy,value); point(m,x+sx+1,y+sy,value); point(m,x+sx,y+sy-1,value); point(m,x+sx,y+sy+1,value);
  });
}
function drawRiver(m, x, y, h, value = 1) { for(let yy=0; yy<h; yy++){ const wave = yy % 4; point(m,x+wave,y+yy,value); point(m,x+6+((wave+2)%4),y+yy,value); } }
function drawBridge(m, x, y, value = 2) { for(let yy=0; yy<7; yy++) line(m,x,y+yy,x+11,y+yy,value,yy%2===1); }
function drawPlaza(m, cx, cy, value = 1) { for(let a=0; a<360; a+=18){ const rad=a*Math.PI/180; point(m,Math.round(cx+Math.cos(rad)*9),Math.round(cy+Math.sin(rad)*6),value); } point(m,cx,cy,value); }
function drawLumi(m, x, y, value = 1) {
  line(m,x-3,y-8,x-3,y-3,value); line(m,x+3,y-8,x+3,y-3,value);
  rect(m,x-5,y-3,11,8,value); point(m,x-2,y,value); point(m,x+2,y,value); point(m,x,y+4,value);
}
function drawFocusMarker(m, x, y, value = 3) {
  // 현재 포커스는 오브젝트와 겹치지 않도록 하단에 독립 표시
  rect(m, x - 3, y - 2, 7, 5, value);
  point(m, x, y, 0);
}
function drawLeftTriangle(m, x, y, value = 3) { line(m, x+4, y-6, x-4, y, value); line(m, x-4, y, x+4, y+6, value); line(m, x+4, y-6, x+4, y+6, value); }
function drawRightTriangle(m, x, y, value = 3) { line(m, x-4, y-6, x+4, y, value); line(m, x+4, y, x-4, y+6, value); line(m, x-4, y-6, x-4, y+6, value); }
function heart(m, x, y, value = 4) { [[0,0,1,0,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]].forEach((row,yy)=>row.forEach((v,xx)=>{ if(v) point(m,x+xx,y+yy,value); })); }
function mapDotPadKeyToAction(keyCode) { return window.DotPadBridge ? window.DotPadBridge.mapKeyToAction(keyCode, ACTIONS) : null; }
function sendToDotPad(matrix) { if (window.DotPadBridge) return window.DotPadBridge.sendGraphic(matrix); const binaryMatrix = matrix.map(row => row.map(value => value > 0 ? 1 : 0)); console.log('Send 60x40 binary matrix to Dot Pad:', binaryMatrix); }
function speak(text) { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ko-KR'; utterance.rate = 1; window.speechSynthesis.speak(utterance); }
function playSound(type) {
  if (!soundEnabled) return;
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;
  const notes = type === 'clear' ? [523, 659, 784, 1046] : type === 'start' ? [392, 523, 659] : type === 'select' ? [660, 880] : [330];
  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + index * 0.08);
    gain.gain.setValueAtTime(0.0001, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.08 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.07);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.08);
  });
}

init();
