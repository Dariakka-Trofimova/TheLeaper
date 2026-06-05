// ========== ИСПРАВЛЕННАЯ ВЕРСИЯ С БЕСКОНЕЧНОЙ КАМЕРОЙ ==========
document.addEventListener('DOMContentLoaded', function() {
    const skinsData = {
        default: { name: 'Лосяш', image: 'losyash.png', unlockScore: 0 },
        pin: { name: 'Пин', image: 'pin.png', unlockScore: 300 },
        barash: { name: 'Бараш', image: 'barash.png', unlockScore: 500 },
        carich: { name: 'Кар-Карыч', image: 'carich.png', unlockScore: 800 },
        yozhik: { name: 'Ёжик', image: 'yozhik.png', unlockScore: 1200 }
    };

    const mainMenu = document.getElementById('mainMenu');
    const gameScreen = document.getElementById('gameScreen');
    const startBtn = document.getElementById('startGameBtn');
    const playerNameInput = document.getElementById('playerName');
    const retryBtn = document.getElementById('retryBtn');
    const exitToMenuBtn = document.getElementById('exitToMenuBtn');
    const gameOverlay = document.getElementById('gameOverlay');
    const finalScoreSpan = document.getElementById('finalScore');
    const currentPlayerNameSpan = document.getElementById('currentPlayerName');
    const skinModal = document.getElementById('skinModal');
    const skinsContainer = document.getElementById('skinsContainer');
    const closeSkinModalBtn = document.getElementById('closeSkinModal');
    const skinLabelBtn = document.getElementById('skin-label');
    
    let currentSkin = 'default';
    let currentPlayer = 'Гость';
    let unlockedSkins = { default: true, pin: false, barash: false, carich: false, yozhik: false };
    let playerRecords = [];
    let canvas, ctx;
    let gameRunning = true;
    let animationId = null;
    let countdownActive = false;
    let countdownValue = 3;
    
    let VIEWPORT_W = 500;
    let VIEWPORT_H = 700;
    
    const WORLD_WIDTH = 3000;
    
    let platforms = [];
    let nextPlatformId = 1;
    let passedPlatforms = new Set();
    let score = 0;
    let bestScore = 0;
    
    let player = {
        x: VIEWPORT_W/2 - 20,
        y: VIEWPORT_H - 100,
        width: 40,
        height: 40,
        vx: 0,
        vy: 0
    };
    
    let cameraX = 0;
    let cameraY = 0;
    
    const GRAVITY = 0.18;
    const JUMP_POWER = -10.5;
    const MOVE_SPEED = 5.2;
    const MAX_JUMP_HEIGHT = 230;
    
    let leftPressed = false;
    let rightPressed = false;
    
    function saveGameData() {
        localStorage.setItem('jumpBestScore', bestScore);
        localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
        localStorage.setItem('playerRecords', JSON.stringify(playerRecords));
        localStorage.setItem('currentSkin', currentSkin);
        if (currentPlayer) localStorage.setItem('lastPlayerName', currentPlayer);
    }
    
    function loadGameData() {
        const storedBest = localStorage.getItem('jumpBestScore');
        if (storedBest) bestScore = parseInt(storedBest) || 0;
        const bestScoreSpan = document.getElementById('bestScore');
        if (bestScoreSpan) bestScoreSpan.innerText = bestScore;
        
        const storedUnlocked = localStorage.getItem('unlockedSkins');
        if (storedUnlocked) {
            try {
                Object.assign(unlockedSkins, JSON.parse(storedUnlocked));
            } catch(e) {}
        }
        
        const storedRecords = localStorage.getItem('playerRecords');
        if (storedRecords) {
            try {
                playerRecords = JSON.parse(storedRecords);
            } catch(e) {}
        }
        
        const savedName = localStorage.getItem('lastPlayerName');
        if (savedName && playerNameInput) playerNameInput.value = savedName;
        
        const savedSkin = localStorage.getItem('currentSkin');
        if (savedSkin && unlockedSkins[savedSkin]) {
            currentSkin = savedSkin;
            const skinImg = skinLabelBtn?.querySelector('img');
            if (skinImg && skinsData[currentSkin]) skinImg.src = skinsData[currentSkin].image;
        }
    }
    
    function showMessage(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#ffcc44; color:black; padding:12px 24px; border-radius:50px; font-weight:bold; z-index:3000; animation:fadeOut 2s ease forwards;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
    
    // ========== ИСПРАВЛЕННАЯ КАМЕРА ==========
    function updateCamera() {
        // Игрок должен быть на 35% от верха экрана (чуть выше центра)
        let targetCameraY = player.y + player.height/2 - VIEWPORT_H * 0.35;
        
        // Игрок по центру по горизонтали
        let targetCameraX = player.x + player.width/2 - VIEWPORT_W/2;
        
        // Плавное движение камеры
        cameraX = cameraX + (targetCameraX - cameraX) * 0.12;
        cameraY = cameraY + (targetCameraY - cameraY) * 0.12;
        
        // Только горизонтальные границы
        if (cameraX < 0) cameraX = 0;
        if (cameraX > WORLD_WIDTH - VIEWPORT_W) cameraX = WORLD_WIDTH - VIEWPORT_W;
        
        // НЕТ ВЕРТИКАЛЬНЫХ ГРАНИЦ! Камера может уходить в минус бесконечно
    }
    
    function drawBackground() {
        // Фон двигается вместе с камерой (создаёт эффект бесконечности)
        let hue1 = (180 + Math.abs(cameraY) * 0.03) % 360;
        let hue2 = (260 + Math.abs(cameraY) * 0.05) % 360;
        const grad = ctx.createLinearGradient(0, 0, 0, VIEWPORT_H);
        grad.addColorStop(0, `hsl(${hue1}, 80%, 8%)`);
        grad.addColorStop(0.5, `hsl(${hue2}, 70%, 12%)`);
        grad.addColorStop(1, `hsl(${(hue1 + 40) % 360}, 85%, 6%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
        
        for (let i = 0; i < 200; i++) {
            const starX = (i * 131 + cameraX * 0.3) % VIEWPORT_W;
            const starY = (Math.abs(cameraY) * 0.1 + i * 23) % VIEWPORT_H;
            const twinkle = 0.3 + Math.sin(Date.now() * 0.002 + i) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 200, ${twinkle})`;
            ctx.fillRect(starX, starY, 2, 2);
        }
        
        for (let i = 0; i < 50; i++) {
            const starX = (i * 277 + cameraX * 0.2) % VIEWPORT_W;
            const starY = (Math.abs(cameraY) * 0.05 + i * 53) % VIEWPORT_H;
            const twinkle = 0.5 + Math.sin(Date.now() * 0.001 + i) * 0.4;
            ctx.fillStyle = `rgba(255, 220, 150, ${twinkle})`;
            ctx.beginPath();
            ctx.arc(starX, starY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    function generatePlatformsAtLevel(yPos, existingPlatforms) {
        const newPlatforms = [];
        const numPlatforms = 2 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < numPlatforms; i++) {
            let attempts = 0;
            let xPos;
            let validPosition = false;
            
            while (!validPosition && attempts < 30) {
                xPos = 80 + Math.random() * (WORLD_WIDTH - 160);
                let overlap = false;
                
                for (let p of [...existingPlatforms, ...newPlatforms]) {
                    if (Math.abs(p.y - yPos) < 45 && Math.abs(p.x - xPos) < 75) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    validPosition = true;
                }
                attempts++;
            }
            
            newPlatforms.push({
                id: nextPlatformId++,
                x: xPos,
                y: yPos,
                w: 70,
                h: 16,
                dangerous: Math.random() < 0.1,
                counted: false
            });
        }
        
        return newPlatforms;
    }
    
    function initPlatforms() {
        platforms = [];
        nextPlatformId = 1;
        passedPlatforms.clear();
        
        platforms.push({
            id: nextPlatformId++,
            x: VIEWPORT_W/2 - 35,
            y: VIEWPORT_H - 60,
            w: 70,
            h: 16,
            dangerous: false,
            counted: true
        });
        
        let currentY = VIEWPORT_H - 60;
        
        for (let level = 0; level < 150; level++) {
            let step = 45 + Math.random() * 40;
            let newY = currentY - step;
            
            if (step > MAX_JUMP_HEIGHT - 50) {
                newY = currentY - (MAX_JUMP_HEIGHT - 60);
            }
            
            const levelPlatforms = generatePlatformsAtLevel(newY, platforms);
            platforms.push(...levelPlatforms);
            currentY = newY;
        }
    }
    
    function updatePlatforms() {
        if (!gameRunning) return;
        
        // Удаляем платформы, которые слишком далеко внизу
        platforms = platforms.filter(p => p.y + p.h > cameraY - 600);
        
        let highestY = Math.min(...platforms.map(p => p.y));
        let neededHeight = cameraY - 800;
        
        let generationCount = 0;
        while (highestY > neededHeight && generationCount < 30) {
            let step = 45 + Math.random() * 40;
            let newY = highestY - step;
            
            if (step > MAX_JUMP_HEIGHT - 50) {
                newY = highestY - (MAX_JUMP_HEIGHT - 60);
            }
            
            const levelPlatforms = generatePlatformsAtLevel(newY, platforms);
            platforms.push(...levelPlatforms);
            highestY = newY;
            generationCount++;
        }
        
        if (platforms.length < 50) {
            let lastY = highestY;
            for (let i = 0; i < 30; i++) {
                let step = 45 + Math.random() * 40;
                let newY = lastY - step;
                if (step > MAX_JUMP_HEIGHT - 50) {
                    newY = lastY - (MAX_JUMP_HEIGHT - 60);
                }
                const levelPlatforms = generatePlatformsAtLevel(newY, platforms);
                platforms.push(...levelPlatforms);
                lastY = newY;
            }
        }
        
        if (platforms.length > 500) {
            platforms = platforms.slice(-500);
        }
    }
    
    function updatePlayer() {
        if (!gameRunning) return;
        
        player.vx *= 0.98;
        if (leftPressed) player.vx = -MOVE_SPEED;
        if (rightPressed) player.vx = MOVE_SPEED;
        player.x += player.vx;
        
        if (player.x < 15) player.x = 15;
        if (player.x + player.width > WORLD_WIDTH - 15) player.x = WORLD_WIDTH - player.width - 15;
        
        player.vy += GRAVITY;
        player.y += player.vy;
        
        for (let plat of platforms) {
            if (player.vy >= 0 && 
                player.y + player.height > plat.y - 5 &&
                player.y + player.height < plat.y + plat.h + 10 &&
                player.x + player.width > plat.x &&
                player.x < plat.x + plat.w) {
                
                if (plat.dangerous) {
                    gameRunning = false;
                    showGameOver();
                    return;
                }
                
                player.y = plat.y - player.height;
                player.vy = JUMP_POWER;
                
                if (!plat.counted && !passedPlatforms.has(plat.id)) {
                    plat.counted = true;
                    passedPlatforms.add(plat.id);
                    score += 20;
                    document.getElementById('currentScore').innerText = score;
                    
                    for (const [skinId, skin] of Object.entries(skinsData)) {
                        if (!unlockedSkins[skinId] && score >= skin.unlockScore) {
                            unlockedSkins[skinId] = true;
                            showMessage(`🎉 ${skin.name} разблокирован!`);
                            saveGameData();
                            renderSkinsList();
                        }
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        document.getElementById('bestScore').innerText = bestScore;
                        saveGameData();
                    }
                }
                break;
            }
        }
        
        if (!gameRunning) return;
        
        let lowestPlatformY = -Infinity;
        for (let plat of platforms) {
            if (plat.y > lowestPlatformY) {
                lowestPlatformY = plat.y;
            }
        }
        
        if (player.y > lowestPlatformY + 200) {
            gameRunning = false;
            showGameOver();
            return;
        }
        
        if (player.y + player.height > cameraY + VIEWPORT_H + 100) {
            gameRunning = false;
            showGameOver();
            return;
        }
    }
    
    function showGameOver() {
        if (finalScoreSpan) {
            finalScoreSpan.innerText = score;
        }
        
        if (gameOverlay) {
            gameOverlay.classList.remove('hidden');
        }
        
        if (score > 0) {
            playerRecords.push({ name: currentPlayer, score: score, skin: currentSkin, date: Date.now() });
            playerRecords.sort((a,b) => b.score - a.score);
            playerRecords = playerRecords.slice(0, 10);
            saveGameData();
        }
    }
    
    function drawCountdown() {
        if (!ctx) return;
        
        ctx.font = 'bold 80px monospace';
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (countdownValue > 0) {
            ctx.fillText(countdownValue, VIEWPORT_W / 2, VIEWPORT_H / 2);
        } else {
            ctx.fillText('GO!', VIEWPORT_W / 2, VIEWPORT_H / 2);
        }
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowBlur = 0;
    }
    
    function draw() {
        if (!ctx) return;
        
        drawBackground();
        
        for (let plat of platforms) {
            let screenX = plat.x - cameraX;
            let screenY = plat.y - cameraY;
            
            if (screenX + plat.w < -50 || screenX > VIEWPORT_W + 50) continue;
            if (screenY + plat.h < -50 || screenY > VIEWPORT_H + 50) continue;
            
            if (plat.dangerous) {
                let pulse = (Math.sin(Date.now() * 0.008) + 1) / 2;
                ctx.fillStyle = `rgb(220, ${40 + pulse * 50}, 40)`;
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'red';
            } else {
                let gradPlat = ctx.createLinearGradient(screenX, screenY, screenX + plat.w, screenY + plat.h);
                gradPlat.addColorStop(0, '#6eff9e');
                gradPlat.addColorStop(1, '#2ecc71');
                ctx.fillStyle = gradPlat;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#6eff9e';
            }
            ctx.fillRect(screenX, screenY, plat.w, plat.h);
            ctx.shadowBlur = 0;
            
            if (plat.dangerous) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px monospace';
                ctx.fillText('💀', screenX + plat.w/2 - 8, screenY - 5);
            }
        }
        
        let playerScreenX = player.x - cameraX;
        let playerScreenY = player.y - cameraY;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(playerScreenX, playerScreenY, player.width, player.height);
        
        const skinData = skinsData[player.charType] || skinsData.default;
        const img = new Image();
        img.src = skinData.image;
        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, playerScreenX, playerScreenY, player.width, player.height);
        } else {
            ctx.fillStyle = '#222';
            ctx.font = '28px monospace';
            ctx.fillText('😀', playerScreenX + 6, playerScreenY + 32);
        }
        ctx.shadowBlur = 0;
        
        if (player.vy < -3 && gameRunning && !countdownActive) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(playerScreenX + player.width/2, playerScreenY + player.height + 5, 10, 5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Платформ: ' + platforms.length, 10, 20);
        ctx.fillText('Счёт: ' + score, 10, 35);
        ctx.fillText('Камера Y: ' + Math.floor(cameraY), 10, 50);
        ctx.fillText('Игрок Y: ' + Math.floor(player.y), 10, 65);
        
        if (countdownActive) {
            drawCountdown();
        }
    }
    
    function startCountdown() {
        countdownActive = true;
        countdownValue = 3;
        gameRunning = false;
        
        const countdownInterval = setInterval(() => {
            countdownValue--;
            
            if (countdownValue < 0) {
                clearInterval(countdownInterval);
                countdownActive = false;
                gameRunning = true;
                resetGame();
            }
        }, 1000);
    }
    
    function resetGame() {
        gameRunning = true;
        score = 0;
        passedPlatforms.clear();
        document.getElementById('currentScore').innerText = '0';
        
        player.x = VIEWPORT_W/2 - 20;
        player.y = VIEWPORT_H - 100;
        player.vx = 0;
        player.vy = 0;
        player.charType = currentSkin;
        
        cameraX = 0;
        cameraY = 0;
        
        initPlatforms();
        
        if (gameOverlay) {
            gameOverlay.classList.add('hidden');
        }
    }
    
    function gameLoop() {
        if (gameRunning && !countdownActive) {
            updatePlayer();
            updateCamera();
            updatePlatforms();
            draw();
        } else {
            draw();
        }
        animationId = requestAnimationFrame(gameLoop);
    }
    
    function initCanvas() {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        
        const container = document.querySelector('.game-container');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight - 55;
            canvas.width = width;
            canvas.height = height;
            VIEWPORT_W = width;
            VIEWPORT_H = height;
        } else {
            canvas.width = 500;
            canvas.height = 700;
            VIEWPORT_W = 500;
            VIEWPORT_H = 700;
        }
        
        initPlatforms();
    }
    
    function setupControls() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'a') {
                leftPressed = true;
                e.preventDefault();
            } else if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'd') {
                rightPressed = true;
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'Left' || e.key === 'a') leftPressed = false;
            if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === 'd') rightPressed = false;
        });
        
        if (canvas) {
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const touchX = (e.touches[0].clientX - rect.left) * (VIEWPORT_W / rect.width);
                leftPressed = touchX < VIEWPORT_W / 2;
                rightPressed = touchX >= VIEWPORT_W / 2;
            });
            
            canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                leftPressed = false;
                rightPressed = false;
            });
            
            canvas.addEventListener('mousedown', (e) => {
                const rect = canvas.getBoundingClientRect();
                const mouseX = (e.clientX - rect.left) * (VIEWPORT_W / rect.width);
                leftPressed = mouseX < VIEWPORT_W / 2;
                rightPressed = mouseX >= VIEWPORT_W / 2;
            });
            
            window.addEventListener('mouseup', () => {
                leftPressed = false;
                rightPressed = false;
            });
        }
    }
    
    function renderSkinsList() {
        if (!skinsContainer) return;
        skinsContainer.innerHTML = '';
        
        for (const [skinId, skin] of Object.entries(skinsData)) {
            const isUnlocked = unlockedSkins[skinId];
            const isSelected = currentSkin === skinId;
            const skinItem = document.createElement('div');
            skinItem.className = `skin-item ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
            skinItem.innerHTML = `
                <img src="${skin.image}" alt="${skin.name}" class="skin-image">
                <div class="skin-name">${skin.name}</div>
                <div class="skin-status">${isUnlocked ? '✓ доступен' : `🔒 ${skin.unlockScore} очков`}</div>
            `;
            if (isUnlocked) {
                skinItem.addEventListener('click', () => {
                    currentSkin = skinId;
                    player.charType = skinId;
                    const skinImg = skinLabelBtn?.querySelector('img');
                    if (skinImg) skinImg.src = skin.image;
                    renderSkinsList();
                    closeSkinModal();
                    showMessage(`✨ Выбран ${skin.name}`);
                    saveGameData();
                });
            }
            skinsContainer.appendChild(skinItem);
        }
    }
    
    function openSkinModal() {
        renderSkinsList();
        if (skinModal) skinModal.classList.remove('hidden');
    }
    
    function closeSkinModal() {
        if (skinModal) skinModal.classList.add('hidden');
    }
    
    function showGame() {
        if (mainMenu) mainMenu.style.display = 'none';
        if (gameScreen) gameScreen.classList.remove('hidden');
        
        const skinSelection = document.getElementById('skinSelection');
        if (skinSelection) {
            skinSelection.style.opacity = '0';
            skinSelection.style.visibility = 'hidden';
        }
        
        currentPlayer = playerNameInput ? (playerNameInput.value.trim() || 'Гость') : 'Гость';
        if (currentPlayerNameSpan) currentPlayerNameSpan.innerText = currentPlayer;
        
        setTimeout(() => {
            initCanvas();
            setupControls();
            
            if (animationId) cancelAnimationFrame(animationId);
            gameLoop();
            
            startCountdown();
        }, 50);
    }
    
    function showMainMenu() {
        if (mainMenu) mainMenu.style.display = 'flex';
        if (gameScreen) gameScreen.classList.add('hidden');
        if (animationId) cancelAnimationFrame(animationId);
        countdownActive = false;
        gameRunning = true;
        
        const skinSelection = document.getElementById('skinSelection');
        if (skinSelection) {
            skinSelection.style.opacity = '1';
            skinSelection.style.visibility = 'visible';
        }
    }
    
    if (startBtn) startBtn.addEventListener('click', showGame);
    
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (gameOverlay) gameOverlay.classList.add('hidden');
            startCountdown();
        });
    }
    
    if (exitToMenuBtn) {
        exitToMenuBtn.addEventListener('click', () => {
            showMainMenu();
        });
    }
    
    if (skinLabelBtn) skinLabelBtn.addEventListener('click', openSkinModal);
    if (closeSkinModalBtn) closeSkinModalBtn.addEventListener('click', closeSkinModal);
    if (skinModal) skinModal.addEventListener('click', (e) => {
        if (e.target === skinModal) closeSkinModal();
    });
    
    loadGameData();
    renderSkinsList();
});