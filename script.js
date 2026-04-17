// ==========================
// HELPER & STATE
// ==========================
const $ = id => document.getElementById(id);
const fmt = s => Math.floor(s/60)+":"+String(s%60).padStart(2,'0');

let timerInt = null;
let time = 1200; // Default 20 menit (1200 detik)
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
        p.catch(e => console.log("Audio blocked by browser, click first:", e));
    }
};

function unlockAudio() {
    if (audioReady) return;
    // Mainkan sebentar lalu pause agar browser mengizinkan pemutaran audio
    ['buzzer', 'foulSound', 'warningSound', 'timeoutSound'].forEach(id => {
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
// NOTIFIKASI & EFEK VISUAL
// ==========================
function notif(msg){
    const el = $('notifEl');
    if(el) {
        el.innerText = msg;
        el.style.display = 'block';
        setTimeout(()=> el.style.display = 'none', 2500);
    }
}

function flashGoal(){
    document.body.classList.add('goal-flash');
    setTimeout(()=> document.body.classList.remove('goal-flash'), 400);
}

const hName = () => $('homeName').value.trim() || 'HOME';
const aName = () => $('awayName').value.trim() || 'AWAY';

// ==========================
// UI SYNC
// ==========================
function syncUI(){
    // Update Skor Atas
    $('homeScore').innerText = homeScore;
    $('awayScore').innerText = awayScore;

    // Update Chip Atas
    $('foulHomeChip').innerText = foulHome;
    $('foulAwayChip').innerText = foulAway;
    $('toHomeChip').innerText = toHome;
    $('toAwayChip').innerText = toAway;

    // Update Strip Card Bawah
    if($('foulH')) $('foulH').innerText = foulHome;
    if($('foulA')) $('foulA').innerText = foulAway;
    if($('toH')) $('toH').innerText = toHome;
    if($('toA')) $('toA').innerText = toAway;

    // Efek Merah (Warning) jika foul sudah 5 atau lebih
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
    unlockAudio();
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

// ==========================
// RESET & MATCH FLOW
// ==========================
function resetAll(){
    stopTimer();
    clearInterval(toInt); // Matikan timer timeout jika sedang berjalan
    
    time = parseInt($('duration').value) * 60 || 1200;
    homeScore = 0;
    awayScore = 0;
    foulHome = 0;
    foulAway = 0;
    toHome = 1;
    toAway = 1;
    period = 1;

    $('periodBadge').innerText = 'BABAK 1';
    $('toCountdown').innerText = '';
    
    syncUI();
    updateTimerDisplay();
    notif('🔄 PERTANDINGAN DIRESET');
}

function handleEndMatch(){
    tryPlay('buzzer');
    if (period === 1) {
        notif('⏸ BABAK 1 SELESAI');
    } else {
        notif('🏁 PERTANDINGAN SELESAI');
    }
}

function nextPeriod() {
    if (period === 1) {
        period = 2;
        $('periodBadge').innerText = 'BABAK 2';
        
        // Reset foul & timeout sesuai aturan futsal (jatah per babak)
        foulHome = 0; 
        foulAway = 0;
        toHome = 1;
        toAway = 1;
        
        stopTimer();
        time = parseInt($('duration').value) * 60; // Kembalikan waktu ke menit awal
        
        syncUI();
        updateTimerDisplay();
        notif('▶ SIAP UNTUK BABAK 2');
    }
}

// ==========================
// TIMEOUT LOGIC (60 Detik)
// ==========================
function handleTO(team){
    if (team === 'home' && toHome <= 0) return notif('❌ Jatah Timeout Home Habis');
    if (team === 'away' && toAway <= 0) return notif('❌ Jatah Timeout Away Habis');

    stopTimer(); // Hentikan waktu pertandingan utama
    
    if (team === 'home') toHome--; else toAway--;
    tryPlay('timeoutSound'); // Bunyi saat pelatih minta timeout
    
    let count = 60;
    $('toCountdown').innerText = `⏱ TIMEOUT ${team.toUpperCase()}: ${count}`;

    clearInterval(toInt);
    toInt = setInterval(() => {
        count--;
        if (count > 0) {
            $('toCountdown').innerText = `⏱ TIMEOUT ${team.toUpperCase()}: ${count}`;
            
            // Peringatan 10 detik terakhir
            if (count === 10) tryPlay('warningSound'); 
        } else {
            // Waktu timeout habis
            clearInterval(toInt);
            $('toCountdown').innerText = '';
            tryPlay('buzzer'); // Buzzer panjang untuk kembali ke lapangan
            notif('WAKTU TIMEOUT HABIS!');
        }
    }, 1000);
    
    syncUI();
}

// ==========================
// EVENT LISTENERS
// ==========================
document.addEventListener('DOMContentLoaded', () => {

    // Durasi otomatis reset waktu jika diubah
    $('duration').addEventListener('change', () => {
        stopTimer();
        time = parseInt($('duration').value) * 60;
        updateTimerDisplay();
    });

    // Kontrol Timer Atas
    $('startBtn').onclick = startTimer;
    $('pauseBtn').onclick = stopTimer;
    $('resetBtn').onclick = resetAll;
    $('nextBtn').onclick = nextPeriod;

    // Aksi Gol
    $('goalHome').onclick = () => { 
        unlockAudio(); homeScore++; syncUI(); flashGoal(); tryPlay('buzzer'); notif('⚽ GOAL ' + hName()); 
    };
    $('goalAway').onclick = () => { 
        unlockAudio(); awayScore++; syncUI(); flashGoal(); tryPlay('buzzer'); notif('⚽ GOAL ' + aName()); 
    };

    // Aksi Foul
    $('foulAddH').onclick = () => { 
        foulHome++; syncUI(); 
        if (foulHome === 5) { tryPlay('foulSound'); notif('⚠️ FOUL KE-5 HOME! (Titik Dua)'); }
    };
    $('foulAddA').onclick = () => { 
        foulAway++; syncUI(); 
        if (foulAway === 5) { tryPlay('foulSound'); notif('⚠️ FOUL KE-5 AWAY! (Titik Dua)'); }
    };

    // Aksi Timeout Bawah
    $('toBtnH').onclick = () => handleTO('home');
    $('toBtnA').onclick = () => handleTO('away');

    // Shortcut Keyboard (Sesuai README)
    document.addEventListener('keydown', (e) => {
        // Abaikan shortcut jika sedang mengetik nama tim
        if (e.target.tagName === 'INPUT') return; 
        
        switch(e.code) {
            case 'Space': e.preventDefault(); running ? stopTimer() : startTimer(); break;
            case 'KeyH': $('goalHome').click(); break;
            case 'KeyA': $('goalAway').click(); break;
            case 'KeyF': $('foulAddH').click(); break;
            case 'KeyJ': $('foulAddA').click(); break;
            case 'Digit1': $('toBtnH').click(); break;
            case 'Digit2': $('toBtnA').click(); break;
            case 'KeyR': $('resetBtn').click(); break;
        }
    });

    // Inisialisasi awal UI
    syncUI();
    updateTimerDisplay();
});