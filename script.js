// ── Config ──────────────────────────────────────────────────────────────────

const DIFFICULTIES = {
    easy:   { cols: 4, rows: 3, label: 'Easy' },
    medium: { cols: 4, rows: 4, label: 'Medium' },
    hard:   { cols: 6, rows: 4, label: 'Hard' }
};

const EMOJIS = [
    '💗','🌸','🎀','🧸','🌷','🩰','💄','🦩',
    '🦋','🌺','🍑','🦄','🍰','💅','🪩','🫧',
    '🪷','🩷','🌙','⭐','🍓','💝','🎊','🐚'
];

const WIN_EMOJIS = ['🎉','🥳','✨','🌟','💖'];

// ── State ────────────────────────────────────────────────────────────────────

let state = {
    difficulty: 'medium',
    gameStarted: false,
    flippedCards: [],
    matchedPairs: 0,
    totalPairs: 0,
    moves: 0,
    time: 0,
    streak: 0,
    maxStreak: 0,
    timerInterval: null,
    isLocked: false,
    soundEnabled: true
};

// ── Audio ─────────────────────────────────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playSound(type) {
    if (!state.soundEnabled) return;
    try {
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;

        if (type === 'flip') {
            tone(ctx, 'sine', 700, 0.07, now, 0.08, 550);
        } else if (type === 'match') {
            [[523.25, 0], [659.25, 0.1], [783.99, 0.2]].forEach(([freq, delay]) => {
                tone(ctx, 'sine', freq, 0.12, now + delay, 0.35, freq * 0.9);
            });
        } else if (type === 'mismatch') {
            tone(ctx, 'sawtooth', 280, 0.07, now, 0.22, 200);
        } else if (type === 'win') {
            [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36]].forEach(([freq, delay]) => {
                tone(ctx, 'sine', freq, 0.15, now + delay, 0.45, freq);
            });
        }
    } catch (_) {}
}

function tone(ctx, type, freq, vol, start, duration, endFreq) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.01);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── LocalStorage ──────────────────────────────────────────────────────────────

function getBest(difficulty) {
    const raw = localStorage.getItem(`pink-memory-best-${difficulty}`);
    return raw ? JSON.parse(raw) : null;
}

function saveBest(difficulty, moves, time) {
    const prev = getBest(difficulty);
    if (!prev || moves < prev.moves || (moves === prev.moves && time < prev.time)) {
        localStorage.setItem(`pink-memory-best-${difficulty}`, JSON.stringify({ moves, time }));
        return true;
    }
    return false;
}

// ── Board ─────────────────────────────────────────────────────────────────────

function buildBoard() {
    const { cols, rows } = DIFFICULTIES[state.difficulty];
    const totalCards = cols * rows;
    const numPairs = totalCards / 2;
    state.totalPairs = numPairs;
    state.matchedPairs = 0;

    const picked = pickRandom(EMOJIS, numPairs);
    const items = shuffle([...picked, ...picked]);

    const board = document.getElementById('board');
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    board.setAttribute('data-cols', cols);

    board.innerHTML = items.map((emoji, i) => `
        <div class="card" data-index="${i}" data-emoji="${emoji}">
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back">${emoji}</div>
            </div>
        </div>
    `).join('');
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.time++;
        document.getElementById('timer').textContent = formatTime(state.time);
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
}

// ── UI Updates ────────────────────────────────────────────────────────────────

function updateStats() {
    const movesEl = document.getElementById('moves');
    const streakEl = document.getElementById('streak');

    movesEl.textContent = state.moves;
    streakEl.textContent = state.streak;

    streakEl.classList.toggle('streak-on', state.streak >= 2);

    const best = getBest(state.difficulty);
    document.getElementById('best').textContent = best ? best.moves : '--';
    document.getElementById('best-display').textContent =
        best ? `Best: ${best.moves} moves in ${formatTime(best.time)}` : 'Tap a card to start!';
}

function popStat(id) {
    const el = document.getElementById(id);
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function calcStars(difficulty, moves) {
    const { cols, rows } = DIFFICULTIES[difficulty];
    const pairs = (cols * rows) / 2;
    if (moves <= pairs * 2.5) return 3;
    if (moves <= pairs * 4)   return 2;
    return 1;
}

function showStars(count) {
    for (let i = 1; i <= 3; i++) {
        const star = document.getElementById(`star${i}`);
        star.classList.toggle('earned', i <= count);
    }
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function launchConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    const colors = ['#ff9dcc', '#ffd6e8', '#ff6eb4', '#ffffff', '#ffb3de', '#ffe066', '#ff88c4'];

    for (let i = 0; i < 90; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const size = Math.random() * 10 + 6;
        el.style.cssText = `
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${size}px;
            height: ${size * (Math.random() > 0.5 ? 1 : 0.4)}px;
            border-radius: ${Math.random() > 0.4 ? '50%' : '2px'};
            animation-duration: ${Math.random() * 1.8 + 2}s;
            animation-delay: ${Math.random() * 0.8}s;
        `;
        container.appendChild(el);
    }

    setTimeout(() => container.innerHTML = '', 4500);
}

// ── Win Screen ────────────────────────────────────────────────────────────────

function showWin() {
    stopTimer();
    playSound('win');
    launchConfetti();

    const isNewBest = saveBest(state.difficulty, state.moves, state.time);
    const stars = calcStars(state.difficulty, state.moves);

    document.getElementById('win-emoji').textContent =
        WIN_EMOJIS[Math.floor(Math.random() * WIN_EMOJIS.length)];

    document.getElementById('win-stats').innerHTML = `
        <div>
            <span class="win-stat-label">Moves</span>
            <span class="win-stat-value">${state.moves}</span>
        </div>
        <div>
            <span class="win-stat-label">Time</span>
            <span class="win-stat-value">${formatTime(state.time)}</span>
        </div>
        <div>
            <span class="win-stat-label">Best Streak</span>
            <span class="win-stat-value">${state.maxStreak}🔥</span>
        </div>
        <div>
            <span class="win-stat-label">Difficulty</span>
            <span class="win-stat-value">${DIFFICULTIES[state.difficulty].label}</span>
        </div>
    `;

    document.getElementById('best-badge').textContent =
        isNewBest ? '🏆 New Best Score!' : '';

    showStars(stars);

    const modal = document.getElementById('win-modal');
    modal.classList.add('visible');

    updateStats();
}

// ── Card Flip Logic ───────────────────────────────────────────────────────────

function flipCard(card) {
    if (state.isLocked) return;
    if (card.classList.contains('flipped')) return;
    if (card.classList.contains('matched')) return;
    if (state.flippedCards.length >= 2) return;

    if (!state.gameStarted) {
        state.gameStarted = true;
        startTimer();
    }

    playSound('flip');
    card.classList.add('flipped');
    state.flippedCards.push(card);

    if (state.flippedCards.length === 2) {
        state.moves++;
        popStat('moves');
        updateStats();
        checkMatch();
    }
}

function checkMatch() {
    const [a, b] = state.flippedCards;

    if (a.dataset.emoji === b.dataset.emoji) {
        // Match!
        a.classList.add('matched');
        b.classList.add('matched');
        state.matchedPairs++;
        state.streak++;
        if (state.streak > state.maxStreak) state.maxStreak = state.streak;

        popStat('streak');
        updateStats();
        playSound('match');

        state.flippedCards = [];

        if (state.matchedPairs === state.totalPairs) {
            setTimeout(showWin, 500);
        }
    } else {
        // No match — shake and flip back
        state.streak = 0;
        state.isLocked = true;

        setTimeout(() => {
            a.classList.add('shake');
            b.classList.add('shake');
            playSound('mismatch');
        }, 50);

        setTimeout(() => {
            a.classList.remove('flipped', 'shake');
            b.classList.remove('flipped', 'shake');
            state.flippedCards = [];
            state.isLocked = false;
            updateStats();
        }, 900);
    }
}

// ── New Game ──────────────────────────────────────────────────────────────────

function newGame() {
    stopTimer();
    document.getElementById('win-modal').classList.remove('visible');

    state.gameStarted = false;
    state.flippedCards = [];
    state.matchedPairs = 0;
    state.moves = 0;
    state.time = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.isLocked = false;

    document.getElementById('timer').textContent = '0:00';
    document.getElementById('streak').classList.remove('streak-on');

    buildBoard();
    updateStats();
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function attachEvents() {
    // Card clicks — delegate from board
    document.getElementById('board').addEventListener('click', e => {
        const card = e.target.closest('.card');
        if (card) flipCard(card);
    });

    // New game button
    document.getElementById('new-game-btn').addEventListener('click', newGame);

    // Play again
    document.getElementById('play-again-btn').addEventListener('click', newGame);

    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.diff === state.difficulty) return;
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.difficulty = btn.dataset.diff;
            newGame();
        });
    });

    // Sound toggle
    document.getElementById('sound-btn').addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        document.getElementById('sound-btn').textContent = state.soundEnabled ? '🔊' : '🔇';
        document.getElementById('sound-btn').classList.toggle('muted', !state.soundEnabled);
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    buildBoard();
    updateStats();
    attachEvents();
}

init();
