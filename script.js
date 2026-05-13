// ==========================
// HELPER & STATE
// ==========================
const $ = id => document.getElementById(id);
const fmt = s => Math.floor(s/60)+":"+String(s%60).padStart(2,'0');

let timerInt     = null;
let time         = 1200;
let running      = false;
let period       = 1;

let homeScore = 0;
let awayScore = 0;
let foulHome  = 0;
let foulAway  = 0;
let toHome    = 1;
let toAway    = 1;

// Timeout countdown state
let toInt          = null;
let toStartTime    = null;
let toDuration     = 60;
let toTeam         = null;
let toActive       = false;
let toWarningFired = false;

// Timer timestamp state
let timerStartTime   = null;
let timerStartValue  = 0;

// Duration state
let selectedDuration = 20; // menit

let audioReady = false;
let audioCtx   = null;
const audioBuffers = {};

// ==========================
// AUDIO SYSTEM
// ==========================
async function initAudio() {
    if (audioReady) return;
    audioReady = true;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const files = {
            buzzer:      'assets/sounds/buzzer.mp3',
            foulSound:   'assets/sounds/foul.mp3',
            warningSound:'assets/sounds/warning.mp3',
            timeoutSound:'assets/sounds/timeout.mp3',
        };
        await Promise.all(Object.entries(files).map(async ([key, url]) => {
            try {
                const res = await fetch(url);
                const arr = await res.arrayBuffer();
                audioBuffers[key] = await audioCtx.decodeAudioData(arr);
            } catch(e) { console.warn(`Audio "${key}" gagal:`, e); }
        }));
    } catch(e) {
        console.warn('AudioContext tidak tersedia:', e);
        audioCtx = null;
    }
}

function playSound(id) {
    if (audioCtx && audioBuffers[id]) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const src = audioCtx.createBufferSource();
        src.buffer = audioBuffers[id];
        src.connect(audioCtx.destination);
        src.start(0);
        return;
    }
    const el = $(id);
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(e => console.log('Audio blocked:', e));
}

function unlockAudio() {
    if (!audioReady) initAudio();
    else if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

// ==========================
// NOTIFIKASI & EFEK
// ==========================
function notif(msg) {
    const el = $('notifEl');
    if (!el) return;
    el.innerText = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.style.display = 'none', 2500);
}

function flashGoal() {
    document.body.classList.add('goal-flash');
    setTimeout(() => document.body.classList.remove('goal-flash'), 500);
}

const hName = () => $('homeName').value.trim() || 'HOME';
const aName = () => $('awayName').value.trim() || 'AWAY';

// ==========================
// UI SYNC
// ==========================
function syncUI() {
    $('homeScore').innerText = homeScore;
    $('awayScore').innerText = awayScore;
    $('foulHomeChip').innerText = foulHome;
    $('foulAwayChip').innerText = foulAway;
    $('toHomeChip').innerText   = toHome;
    $('toAwayChip').innerText   = toAway;
    if ($('foulH')) $('foulH').innerText = foulHome;
    if ($('foulA')) $('foulA').innerText = foulAway;
    if ($('toH'))   $('toH').innerText   = toHome;
    if ($('toA'))   $('toA').innerText   = toAway;
    $('foulHomeChip').classList.toggle('warn', foulHome >= 5);
    $('foulAwayChip').classList.toggle('warn', foulAway >= 5);
}

function updateTimerDisplay() {
    $('timer').innerText  = fmt(time);
    $('timer').className  = 'timer-big ' + (running ? 'running' : 'paused');
}

// ==========================
// DURATION PICKER
// ==========================
function initDurationPicker() {
    const btns = document.querySelectorAll('.dur-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.val) === 20) btn.classList.add('active');

        btn.addEventListener('click', () => {
            if (running) return;
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDuration = parseInt(btn.dataset.val);
            stopTimer();
            time = selectedDuration * 60;
            updateTimerDisplay();
            notif(`⏱ Durasi diubah ke ${selectedDuration} menit`);
        });
    });
}

// ==========================
// EDITABLE TIMER
// ==========================
function initEditableTimer() {
    const timerEl = $('timer');

    timerEl.addEventListener('dblclick', () => {
        if (running) return notif('⚠️ Pause dulu sebelum edit waktu');
        timerEl.contentEditable = 'true';
        timerEl.classList.add('editing');
        timerEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(timerEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });

    timerEl.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') { e.preventDefault(); timerEl.blur(); }
        if (e.code === 'Escape') {
            timerEl.contentEditable = 'false';
            timerEl.classList.remove('editing');
            updateTimerDisplay(); // revert
        }
        // Only allow digits and colon
        if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && !/[\d:]/.test(e.key)) {
            e.preventDefault();
        }
    });

    timerEl.addEventListener('blur', () => {
        timerEl.contentEditable = 'false';
        timerEl.classList.remove('editing');

        const raw = timerEl.innerText.trim();
        // Parse MM:SS or plain seconds
        let parsed = null;
        const matchColon = raw.match(/^(\d{1,2}):(\d{2})$/);
        const matchNum   = raw.match(/^\d+$/);

        if (matchColon) {
            const mins = parseInt(matchColon[1]);
            const secs = parseInt(matchColon[2]);
            if (secs < 60) parsed = mins * 60 + secs;
        } else if (matchNum) {
            parsed = parseInt(raw);
        }

        const MAX = 20 * 60; // 1200 detik
        if (parsed !== null && parsed > 0) {
            time = Math.min(parsed, MAX);
            if (parsed > MAX) notif('⚠️ Maksimal 20 menit! Diset ke 20:00');
            else notif(`⏱ Waktu diubah ke ${fmt(time)}`);
        } else {
            notif('⚠️ Format tidak valid. Gunakan MM:SS');
        }
        updateTimerDisplay();
    });
}

// ==========================
// FULLSCREEN
// ==========================
function initFullscreen() {
    const btn          = $('fsToggle');
    const iconExpand   = $('fsIconExpand');
    const iconCompress = $('fsIconCompress');

    function updateFsIcon() {
        const isFs = !!(
            document.fullscreenElement        ||
            document.webkitFullscreenElement  ||
            document.mozFullScreenElement     ||
            document.msFullscreenElement
        );
        iconExpand.style.display   = isFs ? 'none' : '';
        iconCompress.style.display = isFs ? ''     : 'none';
    }

    btn.addEventListener('click', () => {
        const el = document.documentElement;
        const isFs = !!(
            document.fullscreenElement        ||
            document.webkitFullscreenElement  ||
            document.mozFullScreenElement     ||
            document.msFullscreenElement
        );

        if (!isFs) {
            if      (el.requestFullscreen)            el.requestFullscreen();
            else if (el.webkitRequestFullscreen)      el.webkitRequestFullscreen();
            else if (el.mozRequestFullScreen)         el.mozRequestFullScreen();
            else if (el.msRequestFullscreen)          el.msRequestFullscreen();
        } else {
            if      (document.exitFullscreen)         document.exitFullscreen();
            else if (document.webkitExitFullscreen)   document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen)    document.mozCancelFullScreen();
            else if (document.msExitFullscreen)       document.msExitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange',       updateFsIcon);
    document.addEventListener('webkitfullscreenchange', updateFsIcon);
    document.addEventListener('mozfullscreenchange',    updateFsIcon);
    document.addEventListener('MSFullscreenChange',     updateFsIcon);
}

// ==========================
// TIMER ENGINE
// ==========================
function startTimer() {
    if (running) return;
    unlockAudio();
    running         = true;
    timerStartTime  = performance.now();
    timerStartValue = time;
    updateTimerDisplay();
    timerInt = setInterval(tickTimer, 250);
}

function tickTimer() {
    if (!running) return;
    const elapsed = (performance.now() - timerStartTime) / 1000;
    const newTime = Math.max(0, Math.round(timerStartValue - elapsed));
    if (newTime !== time) { time = newTime; updateTimerDisplay(); }
    if (time <= 0) { stopTimer(); handleEndMatch(); }
}

function stopTimer() {
    clearInterval(timerInt);
    timerInt = null;
    running  = false;
    updateTimerDisplay();
}

// ==========================
// RESET & MATCH FLOW
// ==========================
function resetAll() {
    stopTimer();
    stopTimeout();
    time      = selectedDuration * 60;
    homeScore = 0; awayScore = 0;
    foulHome  = 0; foulAway  = 0;
    toHome    = 1; toAway    = 1;
    period    = 1;
    $('periodBadge').innerText = 'BABAK 1';
    $('toCountdown').innerText = '';
    syncUI();
    updateTimerDisplay();
    notif('🔄 PERTANDINGAN DIRESET');
}

function handleEndMatch() {
    playSound('buzzer');
    notif(period === 1 ? '⏸ BABAK 1 SELESAI' : '🏁 PERTANDINGAN SELESAI');
}

function nextPeriod() {
    if (period === 1) {
        period = 2;
        $('periodBadge').innerText = 'BABAK 2';
        foulHome = 0; foulAway = 0;
        toHome   = 1; toAway   = 1;
        stopTimer();
        time = selectedDuration * 60;
        syncUI();
        updateTimerDisplay();
        notif('▶ SIAP UNTUK BABAK 2');
    }
}

// ==========================
// TIMEOUT LOGIC
// ==========================
function stopTimeout() {
    clearInterval(toInt);
    toInt          = null;
    toActive       = false;
    toStartTime    = null;
    toWarningFired = false;
    if ($('toCountdown')) $('toCountdown').innerText = '';
}

function handleTO(team) {
    if (team === 'home' && toHome <= 0) return notif('❌ Jatah Timeout Home Habis');
    if (team === 'away' && toAway <= 0) return notif('❌ Jatah Timeout Away Habis');
    if (toActive) return notif('⚠️ Timeout sedang berjalan!');

    stopTimer();
    if (team === 'home') toHome--; else toAway--;
    playSound('timeoutSound');

    toActive       = true;
    toTeam         = team;
    toStartTime    = performance.now();
    toWarningFired = false;

    $('toCountdown').innerText = `⏱ TIMEOUT ${team.toUpperCase()}: ${toDuration}`;
    clearInterval(toInt);
    toInt = setInterval(tickTimeout, 250);
    syncUI();
}

function tickTimeout() {
    if (!toActive) return;
    const elapsed   = (performance.now() - toStartTime) / 1000;
    const remaining = Math.max(0, Math.round(toDuration - elapsed));
    $('toCountdown').innerText = `⏱ TIMEOUT ${toTeam.toUpperCase()}: ${remaining}`;
    if (remaining <= 10 && !toWarningFired) {
        toWarningFired = true;
        playSound('warningSound');
        notif('⚠️ 10 DETIK TERSISA!');
    }
    if (remaining <= 0) {
        stopTimeout();
        playSound('buzzer');
        notif('WAKTU TIMEOUT HABIS!');
    }
}

// ==========================
// EVENT LISTENERS
// ==========================
document.addEventListener('DOMContentLoaded', () => {

    initDurationPicker();
    initFullscreen();
    initEditableTimer();

    $('startBtn').onclick = startTimer;
    $('pauseBtn').onclick = stopTimer;
    $('resetBtn').onclick = resetAll;
    $('nextBtn').onclick  = nextPeriod;

    $('goalHome').onclick = () => {
        unlockAudio(); homeScore++; syncUI(); flashGoal(); notif('⚽ GOAL ' + hName());
    };
    $('goalAway').onclick = () => {
        unlockAudio(); awayScore++; syncUI(); flashGoal(); notif('⚽ GOAL ' + aName());
    };

    $('foulAddH').onclick = () => {
        unlockAudio(); foulHome++; syncUI();
        if (foulHome === 5) { playSound('foulSound'); notif('⚠️ FOUL KE-5 HOME! (Titik Dua)'); }
    };
    $('foulAddA').onclick = () => {
        unlockAudio(); foulAway++; syncUI();
        if (foulAway === 5) { playSound('foulSound'); notif('⚠️ FOUL KE-5 AWAY! (Titik Dua)'); }
    };

    $('toBtnH').onclick = () => { unlockAudio(); handleTO('home'); };
    $('toBtnA').onclick = () => { unlockAudio(); handleTO('away'); };

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        switch (e.code) {
            case 'Space':  e.preventDefault(); running ? stopTimer() : startTimer(); break;
            case 'KeyH':   $('goalHome').click();  break;
            case 'KeyA':   $('goalAway').click();  break;
            case 'KeyF':   $('foulAddH').click();  break;
            case 'KeyJ':   $('foulAddA').click();  break;
            case 'Digit1': $('toBtnH').click();    break;
            case 'Digit2': $('toBtnA').click();    break;
            case 'KeyR':   $('resetBtn').click();  break;
            case 'KeyQ':   $('fsToggle').click();  break;
        }
    });

    syncUI();
    updateTimerDisplay();
});