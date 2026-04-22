class Game {

    static CONFIG = {
        maxLives:          3,
        jumpDuration:      500,
        invincibleDuration: 1200,
        pipe_hitbox_min_x: 20,
        pipe_hitbox_max_x: 100,
        pipeCollisionY:    90,
        coinMinBottom:     30,
        coinMaxBottom:     180,
        coinMinSpeed:      1.4,
        coinMaxSpeed:      2.6,
        coinMinInterval:   1200,
        coinMaxInterval:   3400,
        coinFirstDelay:    1500,
        loopInterval:      10,
        gameOverDelay:     600,
    };

    #el = {
        mario:      document.getElementById('mario'),
        pipe:       document.getElementById('pipe'),
        gameBoard:  document.getElementById('gameBoard'),
        startScreen: document.getElementById('startScreen'),
        gameOver:   document.getElementById('gameOver'),
        restartBtn: document.getElementById('restartBtn'),
        livesDisplay: document.getElementById('livesDisplay'),
        coinCount:  document.getElementById('coinCount'),
        finalCoins: document.getElementById('finalCoins'),
        coinPopup:  document.getElementById('coinPopup'),
        coinPopupText: document.getElementById('coinPopupText'),
    };

    #lives;
    #coins;
    #active = false;
    #jumping = false;
    #invincible = false;
    #coins_els = [];
    #loopId = null;
    #spawnId = null;
    #audio = null;

    constructor() {
        this.#bindInput();
        this.#showStartScreen();
    }

    #bindInput() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                this.#jump();
            }
        });

        document.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.#jump();
        }, { passive: false });

        this.#el.gameBoard.addEventListener('click', () => this.#jump());
        
        this.#el.startScreen.addEventListener('click', () => this.#startGame());

        this.#el.restartBtn.addEventListener('click', () => location.reload());
    }

    #showStartScreen() {
        this.#el.startScreen.removeAttribute('hidden');
    }

    #startGame() {
        this.#el.startScreen.setAttribute('hidden', 'true');
        
        this.#lives = Game.CONFIG.maxLives;
        this.#coins = 0;
        this.#active = true;
        this.#jumping = false;
        this.#invincible = false;

        document.body.classList.remove('afternoon', 'night');

        this.#audio = new Audio('sounds/sundtheme.mp3');
        this.#audio.loop = true;
        this.#audio.play().catch(e => console.log('Falha ao reproduzir áudio:', e));

        this.#el.coinCount.textContent = '0';
        this.#renderLives();

        this.#startLoop();
        this.#scheduleNextCoin(Game.CONFIG.coinFirstDelay);
    }

    #jump() {
        if (!this.#active || this.#jumping) return;

        this.#jumping = true;
        this.#el.mario.classList.add('mario--jumping');

        // Play jump sound
        const jumpSound = new Audio('sounds/jump.mp3');
        jumpSound.play().catch(e => console.log('Falha ao reproduzir som de pulo:', e));

        setTimeout(() => {
            this.#el.mario.classList.remove('mario--jumping');
            this.#jumping = false;
        }, Game.CONFIG.jumpDuration);
    }

    #startLoop() {
        this.#loopId = setInterval(() => {
            if (!this.#active) return;
            this.#checkPipeCollision();
            this.#checkCoinCollection();
        }, Game.CONFIG.loopInterval);
    }

    #checkPipeCollision() {
        if (this.#invincible) return;

        const pipeX = this.#el.pipe.offsetLeft;
        const marioY = parseFloat(window.getComputedStyle(this.#el.mario).bottom) || 0;

        const isInsideMarioHorizontal = pipeX <= Game.CONFIG.pipe_hitbox_max_x && pipeX > Game.CONFIG.pipe_hitbox_min_x; 
        const isBelowJumpHeight = marioY < Game.CONFIG.pipeCollisionY;

        if (isInsideMarioHorizontal && isBelowJumpHeight) {
            this.#handleHit();
        }
    }

    #handleHit() {
        this.#lives--;
        this.#renderLives();

        if (this.#lives <= 0) {
            this.#triggerGameOver();
            return;
        }

        this.#invincible = true;
        this.#el.mario.classList.add('mario--hit');

        setTimeout(() => {
            this.#el.mario.classList.remove('mario--hit');
            this.#invincible = false;
        }, Game.CONFIG.invincibleDuration);
    }

    #renderLives() {
        this.#el.livesDisplay.querySelectorAll('.heart').forEach((heart, i) => {
            heart.classList.toggle('lost', i >= this.#lives);
        });
    }

    #scheduleNextCoin(delay = null) {
        const { coinMinInterval, coinMaxInterval } = Game.CONFIG;
        const ms = delay ?? coinMinInterval + Math.random() * (coinMaxInterval - coinMinInterval);
        this.#spawnId = setTimeout(() => this.#spawnCoin(), ms);
    }

    #spawnCoin() {
        if (!this.#active) return;

        const { coinMinBottom, coinMaxBottom, coinMinSpeed, coinMaxSpeed } = Game.CONFIG;

        const coin = document.createElement('div');
        coin.className   = 'coin';
        coin.textContent = '🪙';
        coin.style.bottom = (coinMinBottom + Math.random() * (coinMaxBottom - coinMinBottom)) + 'px';
        coin.style.right  = '-40px';
        coin.style.setProperty('--coin-speed', (coinMinSpeed + Math.random() * (coinMaxSpeed - coinMinSpeed)).toFixed(2) + 's');

        coin.addEventListener('animationend', (e) => {
            if (e.animationName === 'pipe-slide') this.#removeCoin(coin);
        });

        this.#el.gameBoard.appendChild(coin);
        this.#coins_els.push(coin);
        this.#scheduleNextCoin();
    }

    #removeCoin(coin) {
        coin.remove();
        this.#coins_els = this.#coins_els.filter(c => c !== coin);
    }

    #checkCoinCollection() {
        const marioRect = this.#el.mario.getBoundingClientRect();

        this.#coins_els.forEach(coin => {
            if (coin.dataset.collected) return;

            const r = coin.getBoundingClientRect();
            const overlaps =
                marioRect.left   + 20 < r.right  &&
                marioRect.right  - 20 > r.left   &&
                marioRect.top    + 15 < r.bottom  &&
                marioRect.bottom - 10 > r.top;

            if (!overlaps) return;

            coin.dataset.collected = '1';
            coin.classList.add('coin--collected');

            this.#coins++;
            this.#el.coinCount.textContent = this.#coins;

            this.#updateEnvironment();

            // Play coin sound
            const coinSound = new Audio('sounds/coin.mp3');
            coinSound.play().catch(e => console.log('Falha ao reproduzir som da moeda:', e));

            this.#showCoinPopup();
            this.#spawnStars(r.left, r.top);

            this.#coins_els = this.#coins_els.filter(c => c !== coin);
            setTimeout(() => coin.remove(), 400);
        });
    }

    #updateEnvironment() {
        const body = document.body;
        body.classList.remove('afternoon', 'night');

        if (this.#coins >= 20) {
            body.classList.add('night');
        } else if (this.#coins >= 10) {
            body.classList.add('afternoon');
        }
    }

    #showCoinPopup() {
        const { coinPopup, coinPopupText } = this.#el;
        coinPopupText.textContent = '+1 🪙';
        coinPopup.removeAttribute('aria-hidden');
        coinPopup.classList.remove('coin-popup--visible');
        void coinPopup.offsetWidth;
        coinPopup.classList.add('coin-popup--visible');
        setTimeout(() => {
            coinPopup.setAttribute('aria-hidden', 'true');
        }, 800);
    }

    #spawnStars(x, y) {
        const icons = ['⭐', '✨', '💫'];

        for (let i = 0; i < 5; i++) {
            const star  = document.createElement('div');
            star.className   = 'star-particle';
            star.textContent = icons[Math.floor(Math.random() * icons.length)];
            star.style.left  = x + 'px';
            star.style.top   = y + 'px';

            const angle = Math.random() * 260 - 130;
            const dist  = 30 + Math.random() * 50;
            star.style.setProperty('--sx', Math.sin(angle * Math.PI / 180) * dist + 'px');
            star.style.setProperty('--sy', -Math.abs(Math.cos(angle * Math.PI / 180) * dist) + 'px');

            document.body.appendChild(star);
            setTimeout(() => star.remove(), 700);
        }
    }

    #triggerGameOver() {
        this.#active = false;

        if (this.#audio) {
            this.#audio.pause();
            this.#audio.currentTime = 0;
        }

        clearInterval(this.#loopId);
        clearTimeout(this.#spawnId);

        const pipeX = this.#el.pipe.offsetLeft;
        this.#el.pipe.style.animation = 'none';
        this.#el.pipe.style.left      = pipeX + 'px';

        const marioY = parseFloat(window.getComputedStyle(this.#el.mario).bottom) || 0;
        this.#el.mario.style.animation = 'none';
        this.#el.mario.style.bottom    = marioY + 'px';
        this.#el.mario.src             = 'img/game-over.png';

        this.#el.finalCoins.textContent = this.#coins;

        setTimeout(() => {
            this.#el.gameOver.removeAttribute('hidden');
        }, Game.CONFIG.gameOverDelay);
    }
}



document.addEventListener('DOMContentLoaded', () => new Game());
