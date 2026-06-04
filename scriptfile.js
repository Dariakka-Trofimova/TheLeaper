(function() {
    function initGame() {
        // ========== ДАННЫЕ О ПРЫГУНАХ ==========
        const skinsData = {
            default: {
                name: 'Лосяш',
                image: 'losyash.png',
                unlockScore: 0
            },
            pin: {
                name: 'Пин',
                image: 'pin.png',
                unlockScore: 300
            },
            barash: {
                name: 'Бараш',
                image: 'barash.png',
                unlockScore: 500
            },
            carich: {
                name: 'Кар-Карыч',
                image: 'carich.png',
                unlockScore: 800
            },
            yozhik: {
                name: 'Ёжик',
                image: 'yozhik.png',
                unlockScore: 1200
            }
        };

        // ========== DOM ЭЛЕМЕНТЫ ==========
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
        
        // ========== ПЕРЕМЕННЫЕ ==========
        let currentSkin = 'default';
        let currentPlayer = 'Гость';
        let unlockedSkins = {
            default: true,
            pin: false,
            barash: false,
            carich: false,
            yozhik: false
        };
        
        let playerRecords = [];
        let canvas, ctx;
        let W, H;
        let platforms = [];
        let player = {
            x: 0, y: 0, width: 40, height: 40,
            vy: 0, vx: 0, grounded: false, charType: 'default'
        };
        let cameraY = 0;
        let score = 0;
        let bestScore = 0;
        let gameOver = false;
        let gameLoopId = null;
        
        // ========== ФИЗИКА: ЕЩЁ ВЫШЕ И МЕДЛЕННЕЕ (в 1.5 раза) ==========
        const GRAVITY = 0.185;           // Было 0.28 - теперь ещё медленнее
        const JUMP_POWER = -13.5;        // Увеличена сила прыжка для высоты
        const MOVE_SPEED = 4.8;
        const PLATFORM_WIDTH = 70;
        const PLATFORM_HEIGHT = 16;
        
        // МАКСИМАЛЬНАЯ ВЫСОТА ПРЫЖКА (для проверки достижимости платформ)
        const MAX_JUMP_HEIGHT = 280;      // Пикселей за прыжок
        
        // Для отслеживания пройденных платформ
        let passedPlatformIds = new Set();
        let platformIdCounter = 0;
        
        let leftPressed = false, rightPressed = false;
        
        // ========== ОТРИСОВКА СКИНОВ В МОДАЛЬНОМ ОКНЕ ==========
        function renderSkinsList() {
            if (!skinsContainer) return;
            
            skinsContainer.innerHTML = '';
            
            for (const [skinId, skin] of Object.entries(skinsData)) {
                const isUnlocked = unlockedSkins[skinId];
                const isSelected = currentSkin === skinId;
                
                const skinItem = document.createElement('div');
                skinItem.className = `skin-item ${isUnlocked ? '' : 'locked'} ${isSelected && isUnlocked ? 'selected' : ''}`;
                skinItem.dataset.skin = skinId;
                
                skinItem.innerHTML = `
                    <img src="${skin.image}" alt="${skin.name}" class="skin-image" onerror="this.style.display='none'">
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-status ${isUnlocked ? 'unlocked' : 'locked'}">
                        ${isUnlocked ? '✓ доступен' : `🔒 ${skin.unlockScore} очков`}
                    </div>
                `;
                
                if (isUnlocked) {
                    skinItem.addEventListener('click', () => {
                        selectSkin(skinId);
                    });
                } else {
                    skinItem.addEventListener('click', () => {
                        showUnlockMessage(`🔒 Разблокируйте ${skin.name} за ${skin.unlockScore} очков!`);
                    });
                }
                
                skinsContainer.appendChild(skinItem);
            }
        }
        
        function selectSkin(skinId) {
            if (unlockedSkins[skinId]) {
                currentSkin = skinId;
                
                const selectedSkin = skinsData[currentSkin];
                const skinImg = skinLabelBtn?.querySelector('img');
                if (skinImg && selectedSkin) {
                    skinImg.src = selectedSkin.image;
                    skinImg.alt = selectedSkin.name;
                }
                
                renderSkinsList();
                closeSkinModal();
                
                if (player) {
                    player.charType = skinId;
                }
                
                showUnlockMessage(`✨ Выбран прыгун: ${selectedSkin.name}`);
                saveData();
            }
        }
        
        // ========== ФУНКЦИИ МОДАЛЬНОГО ОКНА ==========
        function openSkinModal() {
            if (skinModal) {
                renderSkinsList();
                skinModal.classList.remove('hidden');
            }
        }
        
        function closeSkinModal() {
            if (skinModal) {
                skinModal.classList.add('hidden');
            }
        }
        
        // ========== ЗАГРУЗКА ДАННЫХ ==========
        function loadData() {
            const storedBest = localStorage.getItem('jumpBestScore');
            if (storedBest) bestScore = parseInt(storedBest) || 0;
            
            const storedUnlocked = localStorage.getItem('unlockedSkins');
            if (storedUnlocked) {
                try {
                    let data = JSON.parse(storedUnlocked);
                    Object.assign(unlockedSkins, data);
                } catch(e) {}
            }
            
            const storedRecords = localStorage.getItem('playerRecords');
            if (storedRecords) {
                try {
                    playerRecords = JSON.parse(storedRecords);
                    if (!Array.isArray(playerRecords)) playerRecords = [];
                } catch(e) { playerRecords = []; }
            }
            
            const savedName = localStorage.getItem('lastPlayerName');
            if (savedName && playerNameInput) playerNameInput.value = savedName;
            
            const savedSkin = localStorage.getItem('currentSkin');
            if (savedSkin && unlockedSkins[savedSkin]) {
                currentSkin = savedSkin;
                const skinImg = skinLabelBtn?.querySelector('img');
                if (skinImg && skinsData[currentSkin]) {
                    skinImg.src = skinsData[currentSkin].image;
                }
            }
            
            const bestScoreSpan = document.getElementById('bestScore');
            if (bestScoreSpan) bestScoreSpan.innerText = bestScore;
        }
        
        function saveData() {
            localStorage.setItem('jumpBestScore', bestScore);
            localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
            localStorage.setItem('playerRecords', JSON.stringify(playerRecords));
            localStorage.setItem('currentSkin', currentSkin);
            if (currentPlayer) localStorage.setItem('lastPlayerName', currentPlayer);
        }
        
        function checkUnlockByScore(score) {
            for (const [skinId, skin] of Object.entries(skinsData)) {
                if (!unlockedSkins[skinId] && score >= skin.unlockScore) {
                    unlockedSkins[skinId] = true;
                    showUnlockMessage(`🎉 ${skin.name} разблокирован!`);
                    saveData();
                }
            }
        }
        
        function showUnlockMessage(msg) {
            const toast = document.createElement('div');
            toast.className = 'unlock-toast';
            toast.textContent = msg;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffcc44;
                color: black;
                padding: 12px 24px;
                border-radius: 50px;
                font-weight: bold;
                z-index: 3000;
                animation: fadeOut 2s ease forwards;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
        
        // ========== ИГРОВАЯ ЛОГИКА ==========
        function initCanvas() {
            canvas = document.getElementById('gameCanvas');
            if (!canvas) return;
            ctx = canvas.getContext('2d');
            
            const container = document.querySelector('.game-container');
            if (!container) return;
            const width = container.clientWidth;
            const height = container.clientHeight - 55;
            
            canvas.width = width;
            canvas.height = height;
            W = width;
            H = height;
            
            resetGameLogic();
        }
        
        // ФУНКЦИЯ ДЛЯ ПРОВЕРКИ, ДОСТИЖИМА ЛИ ПЛАТФОРМА
        function isPlatformReachable(currentY, targetY) {
            return (currentY - targetY) <= MAX_JUMP_HEIGHT;
        }
        
        function generateInitialPlatforms() {
            let platList = [];
            platformIdCounter = 0;
            
            // Стартовая платформа
            platList.push({
                id: platformIdCounter++,
                x: W/2 - PLATFORM_WIDTH/2,
                y: H - 60,
                w: PLATFORM_WIDTH,
                h: PLATFORM_HEIGHT,
                dangerous: false,
                counted: true
            });
            
            let lastY = H - 60;
            let attempts = 0;
            
            // Генерация платформ с гарантированной достижимостью
            for (let i = 1; i < 14; i++) {
                let randX = Math.random() * (W - PLATFORM_WIDTH);
                let yPos = lastY - 75 - Math.random() * 40;
                
                // Гарантируем, что платформа в пределах прыжка
                while (!isPlatformReachable(lastY, yPos) && attempts < 10) {
                    yPos = lastY - 65 - Math.random() * 35;
                    attempts++;
                }
                
                // Если платформа слишком далеко - корректируем
                if (lastY - yPos > MAX_JUMP_HEIGHT) {
                    yPos = lastY - MAX_JUMP_HEIGHT + 30;
                }
                
                let dangerous = (Math.random() < 0.15); // Уменьшил шанс опасных платформ
                
                platList.push({
                    id: platformIdCounter++,
                    x: randX,
                    y: yPos,
                    w: PLATFORM_WIDTH,
                    h: PLATFORM_HEIGHT,
                    dangerous: dangerous,
                    counted: false
                });
                
                lastY = yPos;
            }
            return platList;
        }
        
        function resetGameLogic() {
            if (!W || !H) return;
            gameOver = false;
            score = 0;
            passedPlatformIds.clear();
            
            const currentScoreSpan = document.getElementById('currentScore');
            if (currentScoreSpan) currentScoreSpan.innerText = '0';
            
            player.x = W/2 - player.width/2;
            player.y = H - 100;
            player.vy = 0;
            player.vx = 0;
            player.charType = currentSkin;
            cameraY = 0;
            
            platforms = generateInitialPlatforms();
            
            // Добавляем дополнительные платформы выше с гарантией достижимости
            let lastY = Math.min(...platforms.map(p => p.y));
            
            for (let i = 0; i < 10; i++) {
                let randX = Math.random() * (W - PLATFORM_WIDTH);
                let newY = lastY - 70 - Math.random() * 35;
                
                // Корректируем для достижимости
                if (lastY - newY > MAX_JUMP_HEIGHT) {
                    newY = lastY - MAX_JUMP_HEIGHT + 40;
                }
                
                platforms.push({
                    id: platformIdCounter++,
                    x: randX,
                    y: newY,
                    w: PLATFORM_WIDTH,
                    h: PLATFORM_HEIGHT,
                    dangerous: Math.random() < 0.12,
                    counted: false
                });
                lastY = newY;
            }
            
            if (gameOverlay) gameOverlay.classList.add('hidden');
        }
        
        function updatePlatforms() {
            // Удаляем платформы, которые ушли далеко вверх
            platforms = platforms.filter(p => p.y + p.h > cameraY - 200);
            
            // Находим самую верхнюю платформу
            let highestY = Math.min(...platforms.map(p => p.y), 10000);
            
            // Генерируем новые платформы с гарантией достижимости
            while (highestY > cameraY - 500) {
                let randX = Math.random() * (W - PLATFORM_WIDTH);
                let newY = highestY - 70 - Math.random() * 35;
                
                // Проверяем достижимость
                if (highestY - newY > MAX_JUMP_HEIGHT) {
                    newY = highestY - MAX_JUMP_HEIGHT + 45;
                }
                
                let dangerous = (Math.random() < 0.12);
                platforms.push({
                    id: platformIdCounter++,
                    x: randX,
                    y: newY,
                    w: PLATFORM_WIDTH,
                    h: PLATFORM_HEIGHT,
                    dangerous: dangerous,
                    counted: false
                });
                highestY = newY;
            }
        }
        
        function updatePlayer() {
            if (!W || !H) return;
            
            // Горизонтальное движение
            player.vx *= 0.98;
            player.x += player.vx;
            if (player.x < 5) player.x = 5;
            if (player.x + player.width > W - 5) player.x = W - player.width - 5;
            
            // Вертикальное движение
            player.vy += GRAVITY;
            player.y += player.vy;
            
            // Проверка столкновений с платформами
            player.grounded = false;
            
            for (let plat of platforms) {
                if (player.vy >= 0 && 
                    player.y + player.height > plat.y &&
                    player.y + player.height < plat.y + plat.h + 12 &&
                    player.x + player.width > plat.x &&
                    player.x < plat.x + plat.w) {
                    
                    // Опасная платформа -> смерть
                    if (plat.dangerous) {
                        gameOver = true;
                        endGame();
                        return;
                    }
                    
                    // Приземление на платформу
                    player.y = plat.y - player.height;
                    player.vy = JUMP_POWER;
                    player.grounded = true;
                    
                    // НАЧИСЛЕНИЕ ОЧКОВ ТОЛЬКО ЗА НОВЫЕ ПЛАТФОРМЫ
                    if (!plat.counted && !passedPlatformIds.has(plat.id)) {
                        plat.counted = true;
                        passedPlatformIds.add(plat.id);
                        score += 20;
                        
                        const currentScoreSpan = document.getElementById('currentScore');
                        if (currentScoreSpan) currentScoreSpan.innerText = score;
                        
                        checkUnlockByScore(score);
                        
                        if (score > bestScore) {
                            bestScore = score;
                            const bestScoreSpan = document.getElementById('bestScore');
                            if (bestScoreSpan) bestScoreSpan.innerText = bestScore;
                            saveData();
                        }
                    }
                    break;
                }
            }
            
            // ========== ИСПРАВЛЕННАЯ ПРОВЕРКА ПАДЕНИЯ ВНИЗ ==========
            // Если игрок упал ниже самой нижней платформы или ниже камеры + отступ
            const lowestPlatform = Math.max(...platforms.map(p => p.y + p.h), 0);
            const fallThreshold = Math.max(cameraY + H + 80, lowestPlatform + 100);
            
            if (player.y + player.height > fallThreshold || player.y + player.height > cameraY + H + 120) {
                gameOver = true;
                endGame();
                return;
            }
            
            // Если игрок улетел слишком высоко за пределы экрана (вверх)
            if (player.y + player.height < cameraY - 200) {
                gameOver = true;
                endGame();
                return;
            }
            
            // Обновление камеры
            let targetCam = player.y + player.height / 2 - H / 2;
            if (targetCam < 0) targetCam = 0;
            cameraY = cameraY + (targetCam - cameraY) * 0.12;
            if (cameraY < 0) cameraY = 0;
        }
        
        function endGame() {
            if (gameOver) return;
            gameOver = true;
            if (finalScoreSpan) finalScoreSpan.innerText = score;
            if (gameOverlay) gameOverlay.classList.remove('hidden');
            
            if (score > 0) {
                playerRecords.push({ name: currentPlayer, score: score, skin: currentSkin, date: Date.now() });
                playerRecords.sort((a,b) => b.score - a.score);
                playerRecords = playerRecords.slice(0, 10);
                if (score > bestScore) {
                    bestScore = score;
                    localStorage.setItem('jumpBestScore', bestScore);
                }
                saveData();
            }
        }
        
        function drawPlayer() {
            let playerScreenY = player.y - cameraY;
            
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(player.x, playerScreenY, player.width, player.height);
            
            const skinData = skinsData[player.charType] || skinsData.default;
            const img = new Image();
            img.src = skinData.image;
            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, player.x, playerScreenY, player.width, player.height);
            }
        }
        
        function draw() {
            if (!ctx || !W || !H) return;
            ctx.clearRect(0, 0, W, H);
            
            // Динамический фон
            let bgShift = (cameraY * 0.02) % 360;
            let hue1 = (180 + bgShift) % 360;
            let hue2 = (260 + bgShift * 1.3) % 360;
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, `hsl(${hue1}, 70%, 12%)`);
            grad.addColorStop(1, `hsl(${hue2}, 80%, 18%)`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            
            // Частицы
            for (let i = 0; i < 60; i++) {
                let sx = (i * 131) % W;
                let sy = (cameraY * 0.3 + i * 41) % H;
                ctx.fillStyle = `hsla(${Date.now() * 0.003 + i * 10}, 80%, 65%, 0.3)`;
                ctx.beginPath();
                ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Платформы
            for (let plat of platforms) {
                let screenY = plat.y - cameraY;
                if (screenY + plat.h < 0 || screenY > H) continue;
                
                if (plat.dangerous) {
                    let pulse = (Math.sin(Date.now() * 0.012) + 1) / 2;
                    ctx.fillStyle = `rgb(220, ${40 + pulse * 50}, 40)`;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = "red";
                } else {
                    let gradPlat = ctx.createLinearGradient(plat.x, screenY, plat.x + plat.w, screenY + plat.h);
                    gradPlat.addColorStop(0, '#6eff9e');
                    gradPlat.addColorStop(1, '#2ecc71');
                    ctx.fillStyle = gradPlat;
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = "#b3ffd0";
                }
                ctx.fillRect(plat.x, screenY, plat.w, plat.h);
                ctx.shadowBlur = 0;
                
                if (plat.dangerous) {
                    ctx.fillStyle = "#ffaaaa";
                    ctx.font = "bold 14px monospace";
                    ctx.fillText("💀", plat.x + plat.w/2 - 7, screenY - 5);
                }
            }
            
            drawPlayer();
            
            // Эффект прыжка (след)
            if (player.vy < -5) {
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.ellipse(player.x + player.width/2, player.y - cameraY + player.height, 8, 4, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
        
        function handleInput() {
            if (leftPressed) player.vx = -MOVE_SPEED;
            if (rightPressed) player.vx = MOVE_SPEED;
            if (!leftPressed && !rightPressed) player.vx *= 0.92;
        }
        
        function startGameLoop() {
            function loop() {
                if (!gameOver && W && H) {
                    handleInput();
                    updatePlayer();
                    updatePlatforms();
                    draw();
                } else if (W && H) {
                    draw();
                }
                gameLoopId = requestAnimationFrame(loop);
            }
            gameLoopId = requestAnimationFrame(loop);
        }
        
        // ========== УПРАВЛЕНИЕ ==========
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
                    const touchX = (e.touches[0].clientX - rect.left) * (W / rect.width);
                    if (touchX < W / 2) leftPressed = true;
                    else rightPressed = true;
                });
                canvas.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    leftPressed = false;
                    rightPressed = false;
                });
                canvas.addEventListener('mousedown', (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = (e.clientX - rect.left) * (W / rect.width);
                    if (mouseX < W / 2) leftPressed = true;
                    else rightPressed = true;
                });
                window.addEventListener('mouseup', () => { leftPressed = false; rightPressed = false; });
            }
        }
        
        // ========== НАВИГАЦИЯ ==========
        function showGame() {
            if (mainMenu) mainMenu.style.display = 'none';
            if (gameScreen) gameScreen.classList.remove('hidden');
            
            const skinSelection = document.getElementById('skinSelection');
            if (skinSelection) {
                skinSelection.style.opacity = '0';
                skinSelection.style.visibility = 'hidden';
                skinSelection.style.pointerEvents = 'none';
            }
            
            currentPlayer = playerNameInput ? (playerNameInput.value.trim() || 'Гость') : 'Гость';
            if (currentPlayerNameSpan) currentPlayerNameSpan.innerText = currentPlayer;
            
            setTimeout(() => {
                initCanvas();
                setupControls();
                startGameLoop();
                
                window.addEventListener('resize', () => {
                    if (gameScreen && !gameScreen.classList.contains('hidden')) {
                        initCanvas();
                        resetGameLogic();
                    }
                });
            }, 100);
        }
        
        function showMainMenu() {
            if (mainMenu) mainMenu.style.display = 'flex';
            if (gameScreen) gameScreen.classList.add('hidden');
            if (gameLoopId) cancelAnimationFrame(gameLoopId);
            gameOver = true;
            
            const skinSelection = document.getElementById('skinSelection');
            if (skinSelection) {
                skinSelection.style.opacity = '1';
                skinSelection.style.visibility = 'visible';
                skinSelection.style.pointerEvents = 'auto';
            }
        }
        
        // ========== СОБЫТИЯ ==========
        if (startBtn) startBtn.addEventListener('click', showGame);
        if (retryBtn) retryBtn.addEventListener('click', () => {
            resetGameLogic();
            if (gameOverlay) gameOverlay.classList.add('hidden');
            gameOver = false;
        });
        if (exitToMenuBtn) exitToMenuBtn.addEventListener('click', showMainMenu);
        if (skinLabelBtn) skinLabelBtn.addEventListener('click', openSkinModal);
        if (closeSkinModalBtn) closeSkinModalBtn.addEventListener('click', closeSkinModal);
        if (skinModal) {
            skinModal.addEventListener('click', (e) => {
                if (e.target === skinModal) closeSkinModal();
            });
        }
        
        // ========== ЗАПУСК ==========
        loadData();
    }
    
    // Запускаем игру после полной загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }
})();