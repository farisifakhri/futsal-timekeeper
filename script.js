// ==========================
// HELPER
// ==========================
const $ = id => document.getElementById(id);
const fmt = s => Math.floor(s/60)+":"+String(s%60).padStart(2,'0');

// ==========================
// STATE
// ==========================
let timerInt = null;
let time = 1200;
let running = false;
let period = 1;

let homeScore = 0;
let awayScore = 0;
let foulHome = 0;
let foulAway = 0;
let toHome = 1;
let toAway = 1;
let toInt = null;

let audioReady = false;

// ==========================
// AUDIO SYSTEM 🔊
// ==========================
const tryPlay = id => {
    const el = $(id);
    if (!el) return;

    el.currentTime = 0;
    el.volume = 1;

    const p = el.play();
    if (p !== undefined) {
        p.catch(() => {}); // biar gak error di console
    }
};

function unlockAudio() {
    if (audioReady) return;

    ['buzzer','foulSound','warningSound','htSound','ftSound'].forEach(id => {
        const el = $(id);
        if (el) {
            el.play().then(() => {
                el.pause();
                el.currentTime = 0;
            }).catch(() => {});
        }
    });

    audioReady = true;
}

// ==========================
// UTIL
// ==========================
const hName = () => $('homeName').value.trim() || 'HOME';
const aName = () => $('awayName').value.trim() || 'AWAY';

function notif(msg){
    const el = $('notifEl');
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(()=> el.style.display = 'none', 2000);
}

function flashGoal(){
    document.body.classList.add('goal-flash');
    setTimeout(()=> document.body.classList.remove('goal-flash'), 400);
}

// ==========================
// UI SYNC
// ==========================
function syncUI(){
    $('homeScore').innerText = homeScore;
    $('awayScore').innerText = awayScore;

    $('foulHomeChip').innerText = foulHome;
    $('foulAwayChip').innerText = foulAway;

    $('toHomeChip').innerText = toHome;
    $('toAwayChip').innerText = toAway;

    $('foulHomeChip').classList.toggle('warn', foulHome >= 5);
    $('foulAwayChip').classList.toggle('warn', foulAway >= 5);
}

function updateTimerDisplay(){
    $('timer').innerText = fmt(time);
    $('timer').className = 'timer-big ' + (running ? 'running' : 'paused');
}

// ==========================
// TIMER ENGINE
// ==========================
function startTimer(){
    if (running) return;

    unlockAudio(); // 🔊 penting

    running = true;
    updateTimerDisplay();

    timerInt = setInterval(() => {
        if (time > 0) {
            time--;
            updateTimerDisplay();
        } else {
            stopTimer();
            handleEndMatch();
        }
    }, 1000);
}

function stopTimer(){
    clearInterval(timerInt);
    running = false;
    updateTimerDisplay();
}

function resetTimer(){
    stopTimer();
    time = parseInt($('duration').value) * 60;
    updateTimerDisplay();
}

// ==========================
// MATCH FLOW
// ==========================
function handleEndMatch(){
    if (period === 1) {
        tryPlay('htSound');
        notif('⏸ HALF TIME');

        setTimeout(() => {
            period = 2;
            $('periodBadge').innerText = 'BABAK 2';

            foulHome = 0;
            foulAway = 0;

            resetTimer();
            syncUI();

            notif('▶ BABAK 2 DIMULAI');
        }, 3000);

    } else {
        tryPlay('ftSound');
        notif('🏁 FULL TIME');
    }
}

// ==========================
// TIMEOUT
// ==========================
function handleTO(team){
    if (team === 'home' && toHome <= 0) return notif('❌ Timeout Habis');
    if (team === 'away' && toAway <= 0) return notif('❌ Timeout Habis');

    if (team === 'home') toHome--;
    else toAway--;

    stopTimer();
    tryPlay('buzzer');

    let count = 60;
    $('toCountdown').innerText = '⏱ TO: ' + count;

    clearInterval(toInt);
    toInt = setInterval(() => {
        count--;

        if (count > 0) {
            $('toCountdown').innerText = '⏱ TO: ' + count;

            if (count === 10) {
                tryPlay('warningSound');
            }
        } else {
            clearInterval(toInt);
            $('toCountdown').innerText = '';
            tryPlay('buzzer');
        }
    }, 1000);

    syncUI();
}

// ==========================
// EVENT LISTENER
// ==========================
document.addEventListener('DOMContentLoaded', () => {

    // duration auto update
    $('duration').addEventListener('change', resetTimer);

    // timer buttons
    $('startBtn').onclick = startTimer;
    $('pauseBtn').onclick = stopTimer;
    $('resetBtn').onclick = resetTimer;

    // goal
    $('goalHome').onclick = () => {
        unlockAudio();
        homeScore++;
        syncUI();
        flashGoal();
        tryPlay('buzzer');
        notif('⚽ GOAL ' + hName());
    };

    $('goalAway').onclick = () => {
        unlockAudio();
        awayScore++;
        syncUI();
        flashGoal();
        tryPlay('buzzer');
        notif('⚽ GOAL ' + aName());
    };

    // foul
    $('foulAddH').onclick = () => {
        foulHome++;
        syncUI();
        if (foulHome >= 5) tryPlay('foulSound');
    };

    $('foulAddA').onclick = () => {
        foulAway++;
        syncUI();
        if (foulAway >= 5) tryPlay('foulSound');
    };

    // timeout
    $('toBtnH').onclick = () => handleTO('home');
    $('toBtnA').onclick = () => handleTO('away');

    // init
    syncUI();
    resetTimer();
});