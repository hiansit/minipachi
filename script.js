const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
];
const statusDisplay = document.getElementById('statusDisplay');
const jackpotOverlay = document.getElementById('jackpotOverlay');
const jackpotText = document.getElementById('jackpotText');
const body = document.body;

const symbols = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
let isSpinning = false;
let autoPlayTimer = null;

// Audio Context
let audioCtx = null;
let isAudioEnabled = false;

// 画面のどこかをクリックしたときにAudioを初期化し、抽選を開始する
document.addEventListener('click', () => {
    if (!isAudioEnabled) {
        initAudio();
        statusDisplay.textContent = 'SYSTEM READY...';
        if (!isSpinning) {
            startLottery();
        }
    }
}, { once: true });

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    isAudioEnabled = true;
}

// ========================
// 効果音生成 (Web Audio API)
// ========================

// リール停止音（シャコン！）
function playStopSound() {
    if (!isAudioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

// スピニング中の音（ポロロロ...）
let spinInterval = null;
function startSpinSound() {
    if (!isAudioEnabled || !audioCtx) return;
    spinInterval = setInterval(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(Math.random() * 200 + 400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }, 60);
}

function stopSpinSound() {
    if (spinInterval) {
        clearInterval(spinInterval);
        spinInterval = null;
    }
}

// リーチ時のドキドキ音（徐々に速くなる心音風）
let reachInterval = null;
function playReachSound(duration) {
    if (!isAudioEnabled || !audioCtx) return;
    let intervalTime = 400; // 初期テンポ

    function beat() {
        if (!isAudioEnabled || !audioCtx) return;

        // ドッ（低めの音）
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);

        // クン（少し遅れてさらに低めの音）
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(70, audioCtx.currentTime + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.35);

        gain2.gain.setValueAtTime(0, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(audioCtx.currentTime + 0.15);
        osc2.stop(audioCtx.currentTime + 0.35);

        intervalTime = Math.max(120, intervalTime * 0.85); // テンポアップ
        reachInterval = setTimeout(beat, intervalTime);
    }

    beat();

    // リーチ演出が終わるタイミングで音を止める
    setTimeout(() => {
        clearTimeout(reachInterval);
    }, duration);
}

// 大当たり音（ファンファーレ風のアルペジオ）
function playWinSound() {
    if (!isAudioEnabled || !audioCtx) return;
    const notes = [
        { f: 523.25, t: 0 },   // C5
        { f: 659.25, t: 0.1 }, // E5
        { f: 783.99, t: 0.2 }, // G5
        { f: 1046.50, t: 0.3 },// C6
        { f: 783.99, t: 0.4 }, // G5
        { f: 1046.50, t: 0.6 } // C6 (Long)
    ];

    notes.forEach((note, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.f, audioCtx.currentTime + note.t);

        let dur = (idx === notes.length - 1) ? 1.5 : 0.15; // 最後の音だけ長く伸ばす

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime + note.t);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.t + dur);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + note.t);
        osc.stop(audioCtx.currentTime + note.t + dur);
    });
}

// ハズレ音（ブーーンという下降音）
function playLoseSound() {
    if (!isAudioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// ========================
// スロットのロジック
// ========================

// 乱数生成
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// リールを回転させるアニメーションエフェクト
function spinReel(reelElem, duration, targetSymbol) {
    return new Promise((resolve) => {
        reelElem.classList.add('spinning');

        let interval = setInterval(() => {
            reelElem.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            // 縦ブレのアニメーション
            reelElem.style.transform = `translateY(${getRandomInt(-30, 30)}px)`;
        }, 30);

        setTimeout(() => {
            clearInterval(interval);
            reelElem.classList.remove('spinning');
            reelElem.style.transform = `translateY(0)`;

            // 最終結果をセット
            reelElem.textContent = targetSymbol;

            // 7の場合は色を赤字にするなどの特別感
            if (targetSymbol === '7') {
                reelElem.style.color = '#ff0000';
                reelElem.style.textShadow = '0 0 10px #ff0000, 3px 3px 5px rgba(0,0,0,0.5)';
            } else {
                reelElem.style.color = '#222';
                reelElem.style.textShadow = '3px 3px 5px rgba(0,0,0,0.4)';
            }

            // 停止した瞬間に音を鳴らす
            playStopSound();

            resolve(targetSymbol);
        }, duration);
    });
}

// 抽選処理
async function startLottery() {
    if (isSpinning) return;
    if (!isAudioEnabled) return; // 音声有効化前（未クリック）は回さない

    isSpinning = true;
    clearTimeout(autoPlayTimer); // 進行中のタイマーをキャンセル

    statusDisplay.textContent = '★ 抽 選 中 ★';
    // 点滅エフェクト
    statusDisplay.style.animation = 'neon-pulse 0.5s infinite alternate';
    statusDisplay.style.color = 'var(--neon-green)';

    startSpinSound();

    // 当たり判定 (見栄えのため確率は約25%の高確率設定)
    const isWin = Math.random() < 0.25;
    // 当たりのうち、30%は「777」のプレミアム演出
    const isPremium = isWin && Math.random() < 0.3;
    const winSymbol = isWin ? (isPremium ? '7' : symbols[getRandomInt(0, symbols.length - 1)]) : null;

    let target1, target2, target3;

    // リーチ演出を発生させやすくする（ハズレでも1/3の確率でリーチになるように調整）
    const isFakeReach = !isWin && Math.random() < 0.33;

    if (isWin) {
        target1 = winSymbol;
        target2 = winSymbol;
        target3 = winSymbol;
    } else if (isFakeReach) {
        target1 = symbols[getRandomInt(0, symbols.length - 1)];
        target2 = target1;
        target3 = symbols[getRandomInt(0, symbols.length - 1)];
        if (target1 === target3) {
            target3 = target3 === '9' ? '1' : String(Number(target3) + 1);
        }
    } else {
        target1 = symbols[getRandomInt(0, symbols.length - 1)];
        target2 = symbols[getRandomInt(0, symbols.length - 1)];
        target3 = symbols[getRandomInt(0, symbols.length - 1)];
        // バラケ目に調整
        if (target1 === target2) {
            target2 = target2 === '9' ? '1' : String(Number(target2) + 1);
        }
    }

    const p1 = spinReel(reels[0], 2000, target1);
    const p2 = spinReel(reels[1], 2500, target2);

    // 前2つが同じシンボルなら最後は長く回して期待感を煽る
    const isReach = target1 === target2;
    let reachWaitDuration = isReach ? 5500 : 3000;

    if (isReach) {
        setTimeout(() => {
            stopSpinSound();
            statusDisplay.textContent = '!! リ ー チ !!';
            statusDisplay.style.color = 'var(--neon-red)';
            statusDisplay.style.animation = 'neon-pulse 0.2s infinite alternate';

            // リーチ音再生 (最後のスピン時間 - 今までの時間)
            playReachSound(reachWaitDuration - 2500);
        }, 2500);
    }

    const p3 = spinReel(reels[2], reachWaitDuration, target3);

    const results = await Promise.all([p1, p2, p3]);

    if (!isReach) stopSpinSound();

    isSpinning = false;
    statusDisplay.style.animation = 'none';
    checkResult(results);
}

// 結果判定
function checkResult(results) {
    if (results[0] === results[1] && results[1] === results[2]) {
        playWinSound();
        if (results[0] === '7') {
            triggerJackpot('SUPER<br>JACKPOT<br>777 !!');
        } else {
            triggerJackpot(`大 当 た り<br>${results[0]} ${results[1]} ${results[2]} !!`);
        }
    } else {
        playLoseSound();
        statusDisplay.textContent = 'ハズレ...';
        statusDisplay.style.color = '#777';
        scheduleNextLottery();
    }
}

// 大当たり演出
function triggerJackpot(messageText) {
    statusDisplay.textContent = '!!!!! JACKPOT !!!!!';
    statusDisplay.style.color = 'var(--neon-red)';
    statusDisplay.style.animation = 'title-flicker 0.5s infinite';

    jackpotText.innerHTML = messageText;
    jackpotOverlay.classList.remove('hidden');
    body.classList.add('jackpot-active');

    playConfetti();

    // 演出終了後に再開
    setTimeout(() => {
        jackpotOverlay.classList.add('hidden');
        body.classList.remove('jackpot-active');
        statusDisplay.style.animation = 'none';
        statusDisplay.textContent = 'SYSTEM READY...';
        statusDisplay.style.color = 'var(--neon-blue)';

        // 当たり終了後に次の抽選をセット
        scheduleNextLottery();
    }, 8000);
}

// 紙吹雪エフェクト (canvas-confetti)
function playConfetti() {
    let duration = 6 * 1000; // 6秒
    let animationEnd = Date.now() + duration;
    let defaults = { startVelocity: 40, spread: 360, ticks: 100, zIndex: 200 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    let interval = setInterval(function () {
        let timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        let particleCount = 60 * (timeLeft / duration);
        // 左下と右下からバンバン吹き上げさせる
        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
        }));
        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
        }));
    }, 250);
}

// 次の抽選をランダムな間隔で予約（ガジェットのオートプレイ機能）
function scheduleNextLottery() {
    // 3秒 〜 8秒のランダムな間隔で自動的に開始
    const nextInterval = getRandomInt(3000, 8000);

    autoPlayTimer = setTimeout(() => {
        startLottery();
    }, nextInterval);
}

// クリック（タップ）でも手動で回せるようにする
reels.forEach(r => {
    r.parentElement.addEventListener('click', (e) => {
        e.stopPropagation(); // documentのclickイベントと重複しないように
        if (!isAudioEnabled) {
            initAudio();
        }
        if (!isSpinning && jackpotOverlay.classList.contains('hidden')) {
            startLottery();
        }
    });
});
