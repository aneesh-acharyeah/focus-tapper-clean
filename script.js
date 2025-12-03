
const startBtn = document.getElementById('startBtn');
const modeBtn = document.getElementById('modeBtn');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const circle = document.getElementById('circle');
const zone = document.getElementById('zone');
const message = document.getElementById('message');
const endBox = document.getElementById('end');
const finalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart');

let score = 0;
let high = Number(localStorage.getItem('ft_high') || 0);
let playing = false;
let mode = 'normal';

// Animation & timing handles
let rafId = null;
let shrinkStart = 0;
let shrinkDuration = 3000;
let startSize = 120;
let minZone = 40;
let maxZone = 140;
let currentSize = startSize;

// thresholds (fractions of zone radius)
const PERFECT_RADIUS_FACTOR = 0.5; // within 50% of zone radius => perfect
const NICE_RADIUS_FACTOR = 1.0;    // within full zone radius => nice

highEl.textContent = high;

// Utility
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function showMsg(text, t = 650){ message.textContent = text; if(t>0) setTimeout(()=> { if(message.textContent === text) message.textContent = ''; }, t); }
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

// Mode setup
function setMode(m){
  mode = m;
  modeBtn.textContent = `Mode: ${mode === 'normal' ? 'Normal' : 'Hard'}`;
  if(mode === 'hard'){
    minZone = 28;
    maxZone = 120;
    shrinkDuration = 2400;
  } else {
    minZone = 40;
    maxZone = 140;
    shrinkDuration = 3000;
  }
}

// Randomize initial zone position (small offset)
function positionZoneRandom(){
  const maxOffset = Math.max(0, Math.round((circle.clientWidth - currentSize)/2) - 8);
  const x = randInt(-maxOffset, maxOffset);
  const y = randInt(-maxOffset, maxOffset);
  zone.style.marginLeft = `${x}px`;
  zone.style.marginTop = `${y}px`;
}

// Start (or restart) an animated shrink round
function startRound(){
  // Prevent multiple starts
  if(playing) return;
  playing = true;
  score = (score === 0) ? 0 : score; // preserve score if continuing; starting fresh handled by startGame
  scoreEl.textContent = score;
  endBox.classList.add('hidden');
  message.textContent = '';

  // choose start size between 80%*maxZone and maxZone for variety
  startSize = randInt(Math.floor(maxZone*0.8), maxZone);
  currentSize = startSize;
  zone.style.width = `${currentSize}px`;
  zone.style.height = `${currentSize}px`;

  positionZoneRandom();

  cancelAnimationFrame(rafId);
  shrinkStart = performance.now();

  function animate(now){
    const elapsed = now - shrinkStart;
    const t = clamp(elapsed / shrinkDuration, 0, 1);
    // easeOutQuad for smoother feel
    const eased = 1 - (1 - t) * (1 - t);
    const size = Math.round(startSize - (startSize - minZone) * eased);
    currentSize = clamp(size, minZone, startSize);
    zone.style.width = `${currentSize}px`;
    zone.style.height = `${currentSize}px`;

    if(t < 1 && playing){
      rafId = requestAnimationFrame(animate);
    } else {
      // Shrunk fully — player failed to tap => game over
      playing = false;
      cancelAnimationFrame(rafId);
      handleGameOver();
    }
  }

  rafId = requestAnimationFrame(animate);
}

// Called when the user clicks/touches the circle
function handleTapEvent(e){
  if(!playing) return;

  // Determine tap coordinates (support touch)
  let clientX, clientY;
  if(e.touches && e.touches[0]){
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  // Zone center
  const zRect = zone.getBoundingClientRect();
  const zCenterX = zRect.left + zRect.width / 2;
  const zCenterY = zRect.top + zRect.height / 2;
  const dx = clientX - zCenterX;
  const dy = clientY - zCenterY;
  const dist = Math.hypot(dx, dy);

  const zoneRadius = zRect.width / 2;
  // scoring logic
  const perfectThreshold = zoneRadius * PERFECT_RADIUS_FACTOR;
  const niceThreshold = zoneRadius * NICE_RADIUS_FACTOR;

  // Distance-based result
  let result = 'miss';
  if(dist <= perfectThreshold) result = 'perfect';
  else if(dist <= niceThreshold) result = 'nice';
  else result = 'miss';

  if(result === 'miss'){
    // Penalize small points and end round
    score = Math.max(0, score - 2);
    scoreEl.textContent = score;
    showMsg('Miss', 500);
    // stop current animation and end
    playing = false;
    cancelAnimationFrame(rafId);
    handleGameOver();
    return;
  }

  // If we are here, it's a hit. Compute points: smaller zone -> higher points
  // scaleFactor: 1.0 for perfect small, <1 for larger zones
  const sizeFactor = clamp((startSize - currentSize) / (startSize - minZone + 1), 0, 1);
  // base values depend on result
  let gained = 0;
  if(result === 'perfect'){
    // reward small size + closeness
    gained = Math.max(6, Math.round(12 * (0.6 + sizeFactor * 0.9)));
    showMsg('Perfect!', 600);
    zone.classList.add('perfect-hit');
    setTimeout(()=> zone.classList.remove('perfect-hit'), 220);
  } else if(result === 'nice'){
    gained = Math.max(3, Math.round(6 * (0.4 + sizeFactor * 0.6)));
    showMsg('Nice', 420);
    zone.classList.add('nice-hit');
    setTimeout(()=> zone.classList.remove('nice-hit'), 160);
  }

  score += gained;
  scoreEl.textContent = score;

  // Prepare for next round: cancel current animation, reposition, then start new
  cancelAnimationFrame(rafId);
  playing = false;

  // tiny delay so user sees feedback
  setTimeout(()=>{
    // reset transform effects
    zone.style.transform = '';
    // start next round
    startRound();
  }, 160);
}

// Clean game over handler (shows end UI)
function handleGameOver(){
  finalScore.textContent = score;
  endBox.classList.remove('hidden');

  if(score > high){
    high = score;
    localStorage.setItem('ft_high', high);
    highEl.textContent = high;
    showMsg('New High Score!', 1200);
  }
}

// Full fresh game start (resets score)
function startGameFresh(){
  // stop any running animation
  cancelAnimationFrame(rafId);
  playing = false;
  score = 0;
  scoreEl.textContent = score;
  setTimeout(() => {
    startRound();
  }, 80);
}

// Event wiring (supports mouse + touch)
circle.addEventListener('click', handleTapEvent);
circle.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  handleTapEvent(ev);
}, { passive: false });

startBtn.addEventListener('click', () => {
  setMode(mode); // ensure params applied
  startGameFresh();
});

modeBtn.addEventListener('click', () => {
  setMode(mode === 'normal' ? 'hard' : 'normal');
});

restartBtn.addEventListener('click', () => {
  startGameFresh();
});

// init
setMode('normal');
highEl.textContent = high;
