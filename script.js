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

// 핵심 설계 원칙:
// 1. VISUAL GAME SCREEN은 따뜻한 숲속 생활형 어드벤처처럼 풍성하게 구성
// 2. DOT PAD 60x40 SCREEN은 시각장애 아이들이 혼동하지 않도록 한 화면에 주요 오브젝트 1개 중심으로 표시
// 3. 시각 장면과 촉각 변환 결과를 함께 보여주되, 촉각 출력은 겹치지 않게 구성
const PLACES = [
  { id: 'home', name: '내 집', braille: '내 집입니다', speech: '닷 빌리지에 처음 도착한 작은 오두막입니다.', hint: '시작 지점입니다. 오른쪽 이동키로 숲길을 확인합니다.', visualX: '16%', visualY: '25%' },
  { id: 'path', name: '돌길', braille: '돌길입니다', speech: '오두막에서 숲속 광장으로 이어지는 둥근 돌길입니다.', hint: '작은 동료들이 뒤를 따라오기 시작합니다.', visualX: '36%', visualY: '16%' },
  { id: 'tree', name: '열매나무', braille: '열매나무', speech: '붉은 열매가 달린 큰 나무입니다.', hint: '기능키 2로 나무를 만지면 열매 줍기 미션으로 확장할 수 있어요.', visualX: '31%', visualY: '31%' },
  { id: 'plaza', name: '숲속 광장', braille: '숲속 광장', speech: '꽃과 바위, 표지판이 있는 작은 광장입니다.', hint: '루미가 가까워지고 있습니다.', visualX: '49%', visualY: '25%' },
  { id: 'lumi', name: '루미', braille: '루미 근처', speech: '작은 토끼 친구 루미가 기다리고 있습니다.', hint: '기능키 2를 누르면 루미와 인사합니다.', visualX: '57%', visualY: '34%' },
  { id: 'flower', name: '꽃밭', braille: '꽃밭입니다', speech: '작은 꽃들이 모여 있는 미션 꽃밭입니다.', hint: '꽃밭은 물 주기 미션으로 확장할 수 있어요.', visualX: '72%', visualY: '18%' },
  { id: 'bridge', name: '나무다리', braille: '나무다리', speech: '강을 건널 수 있는 나무다리입니다.', hint: '다리를 건너면 물가 탐험으로 이어집니다.', visualX: '79%', visualY: '38%' },
  { id: 'river', name: '물가', braille: '물가입니다', speech: '흐르는 강과 돌이 있는 물가입니다.', hint: '강은 바로 건널 수 없고 다리를 이용해야 합니다.', visualX: '87%', visualY: '33%' }
];

let gameState = GAME_STATES.TITLE;
let introStep = -1;
let placeIndex = 0;
let missionComplete = false;
let dotCells = [];
let soundEnabled = false;
let audioContext = null;

const dotGrid = document.getElementById('dotGrid');
const visualGameScreen = document.getElementById('visualGameScreen');
const visualSceneName = document.getElementById('visualSceneName');
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
  if (gameState === GAME_STATES.TUTORIAL_PANNING && (action === ACTIONS.PREVIOUS || action === ACTIONS.NEXT)) return showTutorialFunctionKeys();

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

function showTitle() {
  setScene({
    state: GAME_STATES.TITLE,
    matrix: createTactileTitleMatrix(),
    visualId: 'title',
    speech: 'DOT VILLAGE ARCADE. 왼쪽은 풍성한 숲속 게임 화면, 오른쪽은 Dot Pad 촉각 변환 화면입니다. 기능키 2를 누르면 시작합니다.',
    braille: 'PRESS 기능키2\nTO START',
    mission: '숲속 게임 장면과 60×40 촉각 출력을 함께 확인합니다.',
    place: '타이틀 화면',
    banner: 'TITLE SCREEN',
    stage: 'PRESS 기능키 2 TO START',
    hint: 'PRESS 기능키 2 TO START'
  });
  addLog('타이틀 화면: 풍성한 시각 게임 화면과 명확한 촉각 화면을 함께 보여줍니다.');
}

function showIntroStep(step) {
  introStep = step;
  const scenes = [
    ['첫 번째 점이 깨어났어요. 시각 화면에는 숲속 밤하늘과 마을이 보이고, 촉각 화면에는 첫 점 하나가 켜집니다.', '첫 점 켜짐\n마을 시작', '첫 번째 점', 'DOT LOADING', 'dot'],
    ['작은 돌길이 생깁니다. 시각 화면은 숲길과 동료들을 보여주고, 촉각 화면은 단순 점선 길만 보여줍니다.', '돌길 등장\n단순 점선', '돌길', 'DOT LOADING', 'path'],
    ['오두막과 열매나무가 보입니다. 촉각 화면은 혼동을 줄이기 위해 집 하나만 크게 보여줍니다.', '오두막 등장\n하나만 표시', '오두막', 'DOT LOADING', 'home'],
    ['강과 다리가 나타났어요. 시각 화면은 물가와 다리, 촉각 화면은 다리 형태만 분리해서 보여줍니다.', '다리 등장\n분리 표시', '나무다리', 'DOT LOADING', 'bridge'],
    ['안녕! 나는 루미야. 작은 동료들과 함께 마을을 탐험해보자. 촉각 화면에는 루미만 크게 표시할게요.', '루미: 안녕!\n하나만 표시', '루미 등장', 'LUMI APPEARS', 'lumi']
  ];
  const scene = scenes[step] || scenes[scenes.length - 1];
  gameState = step >= 4 ? GAME_STATES.GREETING : GAME_STATES.INTRO;
  setScene({
    state: gameState,
    matrix: createTactileSceneMatrix(scene[4]),
    visualId: scene[4],
    speech: scene[0],
    braille: scene[1],
    mission: '시각 게임 화면은 풍성하게, 촉각 화면은 한 장면씩 명확하게 보여줍니다.',
    place: scene[2],
    banner: scene[3],
    stage: step >= 4 ? 'LUMI APPEARS!' : 'DOT LOADING...',
    hint: '기능키 2로 계속'
  });
  addLog(`${scene[2]} 장면: 시각 화면은 풍성하게, 촉각 화면은 핵심 오브젝트 1개만 표시합니다.`);
  if (step >= 4) speak('안녕! 나는 루미야. 작은 동료들과 함께 마을을 탐험해보자.');
}

function showHardwareGuide() {
  setScene({
    state: GAME_STATES.HARDWARE_GUIDE,
    matrix: createHardwareGuideMatrix(),
    visualId: 'hardware',
    speech: '이 게임은 실제 닷 패드처럼 좌측 이동키, 기능키 1부터 5, 우측 이동키로 플레이합니다.',
    braille: '좌/기능키/우\n구조를 익혀요',
    mission: '조작부는 실제 Dot Pad 키 배열을 기준으로 구성했습니다.',
    place: '하드웨어 안내',
    banner: 'HARDWARE GUIDE',
    stage: 'HARDWARE GUIDE',
    hint: '기능키 2로 다음'
  });
  addLog('하드웨어 안내: 좌측 이동키·기능키 5개·우측 이동키 구조를 소개합니다.');
}

function showTutorialPanning() {
  setScene({
    state: GAME_STATES.TUTORIAL_PANNING,
    matrix: createPanningTutorialMatrix(),
    visualId: 'path',
    speech: '좌측 이동키는 이전 장소, 우측 이동키는 다음 장소입니다. 좌우 이동키 중 하나를 눌러보세요.',
    braille: '좌/우 이동키\n눌러보세요',
    mission: '튜토리얼: 장소 포커스를 좌우로 이동합니다.',
    place: '패닝키 튜토리얼',
    banner: 'TUTORIAL 01',
    stage: 'TRY LEFT OR RIGHT KEY',
    hint: '좌/우 이동키를 눌러보기'
  });
  addLog('튜토리얼 01: 좌/우 이동키로 장소를 이동합니다.');
}

function showTutorialFunctionKeys() {
  setScene({
    state: GAME_STATES.TUTORIAL_FUNCTION_KEYS,
    matrix: createFunctionKeyTutorialMatrix(),
    visualId: 'lumi',
    speech: '좋아요! 기능키 1은 현재 위치, 2는 선택과 인사, 3은 미션, 4는 주변 설명, 5는 도움말입니다.',
    braille: '기능키 1-5\n역할을 익혀요',
    mission: '튜토리얼: 기능키 1~5 역할을 확인합니다. 기능키 2를 누르면 첫 미션이 시작됩니다.',
    place: '기능키 튜토리얼',
    banner: 'TUTORIAL 02',
    stage: 'PRESS 기능키 2 FOR MISSION',
    hint: '기능키 2로 미션 시작'
  });
  addLog('튜토리얼 02: 기능키 역할 안내 완료.');
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
    matrix: createTactileSceneMatrix(place.id, placeIndex),
    visualId: place.id,
    speech: isLumi ? '루미가 가까이에 있습니다. 기능키 2를 눌러 인사하세요.' : `${place.name}. ${place.speech}`,
    braille: isLumi ? '루미 근처\n기능키2 인사' : `${place.braille}\n${placeIndex + 1}/${PLACES.length} 지점`,
    mission: missionComplete ? '자유 탐색 모드입니다. 좌우 이동키로 마을을 둘러보세요.' : '좌/우 이동키로 루미를 찾고 기능키 2로 인사하세요.',
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
      visualId: 'clear',
      speech: '반가워! 이제 이 마을을 함께 둘러보자. 미션 완료!',
      braille: '미션 완료!\n루미와 인사함',
      mission: 'MISSION CLEAR! 루미와 첫 인사를 나눴어요. 다음 미션은 열매 줍기, 다리 건너기, 꽃밭 찾기로 확장할 수 있어요.',
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
  if (place.id === 'tree') announce('열매나무', '톡톡! 열매나무를 만졌어요. 다음 버전에서는 열매 줍기 미션을 할 수 있어요.', '열매나무 터치\n다음미션 예정');
  else if (place.id === 'home') announce('내 집', '내 집입니다. 오늘의 모험을 시작한 작은 오두막이에요.', '내 집입니다\n시작 장소');
  else if (place.id === 'flower') announce('꽃밭', '작은 꽃밭입니다. 다음 미션에서는 꽃에 물을 줄 수 있어요.', '꽃밭입니다\n물주기 예정');
  else if (place.id === 'bridge') announce('나무다리', '나무다리입니다. 다음 버전에서는 다리 건너기 미션을 할 수 있어요.', '나무다리\n건너기 예정');
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
    announce('주변 설명', '왼쪽 시각 화면은 숲속 마을을 풍성하게 보여주고, 오른쪽 촉각 화면은 핵심 오브젝트만 단순하게 보여줍니다.', '시각은 풍성\n촉각은 단순');
    return;
  }
  const prev = PLACES[placeIndex - 1]?.name || '왼쪽 끝';
  const next = PLACES[placeIndex + 1]?.name || '오른쪽 끝';
  announce('주변 설명', `왼쪽에는 ${prev}, 오른쪽에는 ${next}이 있습니다.`, `왼쪽:${prev}\n오른쪽:${next}`);
}
function readHelp() {
  announce('도움말', '시각 화면은 숲속 게임 분위기를 보여주고, Dot Pad 화면은 아이들이 혼동하지 않도록 현재 장소의 핵심 촉각 오브젝트 하나만 보여줍니다.', '시각은 풍성\n촉각은 단순');
}
function announce(title, speech, braille) {
  lumiSpeech.textContent = `${title}: ${speech}`;
  brailleMessage.innerHTML = braille.replace(/\n/g, '<br>');
  addLog(`${title}: ${speech}`);
  speak(speech);
}
function setScene({ state, matrix, visualId, speech, braille, mission, place, banner, stage, hint }) {
  gameState = state;
  renderMatrix(matrix);
  renderVisualScene(visualId, place);
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
  visualSceneName.textContent = place;
  document.querySelector('.app').dataset.state = state.toLowerCase();
}
function addLog(message) {
  const item = document.createElement('li');
  item.textContent = message;
  logList.prepend(item);
  while (logList.children.length > 8) logList.removeChild(logList.lastElementChild);
}

function renderVisualScene(visualId, label = '') {
  const place = PLACES.find((item) => item.id === visualId) || PLACES[placeIndex] || PLACES[0];
  const caption = visualId === 'clear' ? 'MISSION CLEAR!' : visualId === 'title' ? 'PRESS 기능키 2 TO START' : label;
  const focusX = place.visualX || '50%';
  const focusY = place.visualY || '22%';
  visualGameScreen.style.setProperty('--focus-x', focusX);
  visualGameScreen.style.setProperty('--focus-y', focusY);
  visualGameScreen.style.setProperty('--player-x', `calc(${focusX} - 24px)`);
  visualGameScreen.style.setProperty('--player-y', `calc(${focusY} - 10px)`);
  visualGameScreen.innerHTML = `
    <div class="visual-caption">${caption}</div>
    <div class="visual-sprite v-sky-cloud"></div>
    <div class="visual-sprite v-path"></div>
    <div class="visual-sprite v-river"></div>
    <div class="visual-sprite v-bridge"></div>
    <div class="visual-sprite v-orchard-tree v-tree-a"></div>
    <div class="visual-sprite v-orchard-tree v-tree-b"></div>
    <div class="visual-sprite v-orchard-tree v-tree-c"></div>
    <div class="visual-sprite v-apple a1"></div>
    <div class="visual-sprite v-apple a2"></div>
    <div class="visual-sprite v-apple a3"></div>
    <div class="visual-sprite v-house"></div>
    <div class="visual-sprite v-flower"></div>
    <div class="visual-sprite v-rock r1"></div>
    <div class="visual-sprite v-rock r2"></div>
    <div class="visual-sprite v-rock r3"></div>
    <div class="visual-sprite v-berry b1"></div>
    <div class="visual-sprite v-berry b2"></div>
    <div class="visual-sprite v-berry b3"></div>
    <div class="visual-sprite v-signpost"></div>
    <div class="visual-sprite v-mission-item coin"></div>
    <div class="visual-sprite v-mission-item leaf"></div>
    <div class="visual-sprite v-lumi"></div>
    <div class="visual-sprite v-buddy buddy-1"></div>
    <div class="visual-sprite v-buddy buddy-2"></div>
    <div class="visual-sprite v-buddy buddy-3"></div>
    <div class="visual-sprite v-player"></div>
    <div class="visual-sprite v-focus-ring"></div>
  `;
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

function createTactileTitleMatrix() {
  const m = blankMatrix();
  point(m, 30, 18, 2);
  drawSafeProgress(m, 0);
  return m;
}
function createTactileSceneMatrix(id, index = 0) {
  const m = blankMatrix();
  if (id === 'dot') point(m, 30, 18, 2);
  else if (id === 'path') drawSafePath(m);
  else if (id === 'home') drawSafeHouse(m);
  else if (id === 'tree') drawSafeTree(m);
  else if (id === 'plaza') drawSafePlaza(m);
  else if (id === 'lumi') drawSafeLumi(m);
  else if (id === 'flower') drawSafeFlower(m);
  else if (id === 'bridge') drawSafeBridge(m);
  else if (id === 'river') drawSafeRiver(m);
  else drawSafePath(m);
  drawSafeProgress(m, typeof index === 'number' ? index : 0);
  return m;
}
function createHardwareGuideMatrix() {
  const m = blankMatrix();
  line(m, 8, 20, 16, 16, 3); line(m, 8, 20, 16, 24, 3);
  line(m, 52, 20, 44, 16, 3); line(m, 52, 20, 44, 24, 3);
  for (let i = 0; i < 5; i += 1) rect(m, 21 + i * 4, 18, 2, 4, 2);
  drawSafeProgress(m, 1);
  return m;
}
function createPanningTutorialMatrix() {
  const m = blankMatrix();
  line(m, 14, 18, 8, 20, 3); line(m, 8, 20, 14, 22, 3);
  line(m, 46, 18, 52, 20, 3); line(m, 52, 20, 46, 22, 3);
  line(m, 18, 20, 42, 20, 1, true);
  drawSafeProgress(m, 2);
  return m;
}
function createFunctionKeyTutorialMatrix() {
  const m = blankMatrix();
  for (let i = 0; i < 5; i += 1) rect(m, 14 + i * 7, 16, 4, 8, i === 1 ? 4 : 2);
  drawSafeProgress(m, 3);
  return m;
}
function createMissionClearMatrix() {
  const m = blankMatrix();
  drawSafeLumi(m, 24, 15, 4);
  heart(m, 38, 14, 2);
  drawSafeProgress(m, 4);
  return m;
}

// Safe tactile patterns: one large object per 60x40 screen.
function drawSafeProgress(m, activeIndex) {
  const count = 8;
  const startX = 12;
  for (let i = 0; i < count; i += 1) {
    const x = startX + i * 5;
    rect(m, x, 34, 2, 2, i === activeIndex ? 3 : 1);
  }
}
function drawSafePath(m) { line(m, 10, 18, 50, 18, 1, true); line(m, 10, 22, 50, 22, 1, true); }
function drawSafeHouse(m) { line(m, 20, 17, 30, 8, 1); line(m, 30, 8, 40, 17, 1); rect(m, 21, 17, 18, 12, 1); rect(m, 28, 22, 4, 7, 2); }
function drawSafeTree(m) { for (let yy=-6; yy<=6; yy++) for (let xx=-9; xx<=9; xx++) if (xx*xx + yy*yy <= 60) point(m, 30+xx, 14+yy, 1); rect(m, 28, 21, 5, 10, 2); point(m,25,11,4); point(m,35,10,4); }
function drawSafePlaza(m) { for(let a=0; a<360; a+=12){ const r=a*Math.PI/180; point(m, Math.round(30+Math.cos(r)*14), Math.round(18+Math.sin(r)*9), 1); } point(m,30,18,2); }
function drawSafeLumi(m, x=30, y=18, value=4) { line(m,x-4,y-12,x-4,y-4,value); line(m,x+4,y-12,x+4,y-4,value); rect(m,x-8,y-4,17,12,value); point(m,x-4,y+1,value); point(m,x+4,y+1,value); line(m,x-2,y+6,x+2,y+6,value); }
function drawSafeFlower(m) { const centers = [[24,15],[32,15],[28,23],[38,22]]; centers.forEach(([x,y]) => { point(m,x,y,2); point(m,x-2,y,1); point(m,x+2,y,1); point(m,x,y-2,1); point(m,x,y+2,1); }); }
function drawSafeBridge(m) { for(let y=14; y<26; y+=2) line(m,16,y,44,y,1); line(m,18,12,18,28,2); line(m,42,12,42,28,2); }
function drawSafeRiver(m) { for(let y=8; y<30; y++) { const wave = y % 5; point(m,24+wave,y,1); point(m,32+((wave+2)%5),y,1); point(m,40+((wave+4)%5),y,1); } }

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
function rect(m, x, y, w, h, value = 1) { for (let i=0;i<w;i++){ point(m,x+i,y,value); point(m,x+i,y+h-1,value); } for (let j=0;j<h;j++){ point(m,x,y+j,value); point(m,x+w-1,y+j,value); } }
function heart(m, x, y, value = 4) { [[0,0,1,0,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]].forEach((row,yy)=>row.forEach((v,xx)=>{ if(v) point(m,x+xx,y+yy,value); })); }
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
