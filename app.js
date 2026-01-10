class DuckCrashGame {
    constructor() {
        this.tg = null;
        this.user = null;
        this.token = null;
        this.currentGame = null;
        this.balance = 0;
        this.gameInterval = null;
        this.currentMultiplier = 1.0;
        this.isGameActive = false;
        
        this.init();
    }

    async init() {
        // Инициализация Telegram Web App
        this.tg = window.Telegram.WebApp;
        this.tg.expand();
        this.tg.enableClosingConfirmation();
        
        // Авторизация
        await this.authenticate();
        
        // Загрузка данных
        await this.loadUserData();
        await this.loadGameHistory();
        
        // Обновляем UI
        this.updateUI();
        
        // Начинаем симуляцию игры
        this.startGameSimulation();
    }

    async authenticate() {
        try {
            const initData = this.tg.initData;
            const user = this.tg.initDataUnsafe.user;
            
            const response = await fetch('http://localhost:3000/api/auth/telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initData,
                    userId: user?.id || 921171528,
                    username: user?.username || 'artemshaveko',
                    firstName: user?.first_name || 'Artem'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('auth_token', data.token);
            } else {
                // Для демо используем тестовые данные
                this.user = {
                    id: 921171528,
                    username: 'artemshaveko',
                    balance: 1000
                };
                this.token = 'demo_token';
            }
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            // Для демо используем тестовые данные
            this.user = {
                id: 921171528,
                username: 'demo_user',
                balance: 1000
            };
            this.token = 'demo_token';
        }
    }

    async loadUserData() {
        try {
            const response = await fetch('http://localhost:3000/api/user/balance', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            this.balance = data.balance || 1000;
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.balance = 1000; // Значение по умолчанию
        }
    }

    async placeBet() {
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        
        if (!betAmount || betAmount <= 0) {
            this.showAlert('Введите сумму ставки', 'error');
            return;
        }
        
        if (betAmount > this.balance) {
            this.showAlert('Недостаточно средств', 'error');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3000/api/game/bet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    gameId: this.currentGame?.gameId || `game_${Date.now()}`,
                    betAmount
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.balance = data.newBalance;
                this.updateUI();
                this.showAlert('Ставка принята!', 'success');
                this.isGameActive = true;
            } else {
                this.showAlert(data.error || 'Ошибка ставки', 'error');
            }
        } catch (error) {
            console.error('Ошибка ставки:', error);
            this.showAlert('Ошибка соединения', 'error');
        }
    }

    async cashOut() {
        if (!this.isGameActive) {
            this.showAlert('Нет активной ставки', 'error');
            return;
        }
        
        const multiplier = this.currentMultiplier;
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        const profit = betAmount * multiplier;
        
        // Обновляем баланс (в реальном приложении здесь запрос к API)
        this.balance += profit - betAmount;
        this.isGameActive = false;
        
        this.updateUI();
        this.showAlert(`Вы успешно вывели ${profit.toFixed(2)} TON!`, 'success');
        
        // Добавляем запись в историю
        this.addToHistory(betAmount, multiplier, profit);
    }

    startGameSimulation() {
        this.gameInterval = setInterval(() => {
            if (this.isGameActive) {
                // Увеличиваем множитель
                this.currentMultiplier += 0.01;
                
                // Случайный краш
                if (Math.random() < 0.003) { // 0.3% шанс краша
                    this.isGameActive = false;
                    this.showAlert('Игра завершилась!', 'info');
                    this.currentMultiplier = 1.0;
                }
                
                // Проверка автовывода
                const autoCashout = parseFloat(document.getElementById('autoCashout').value);
                if (autoCashout && this.currentMultiplier >= autoCashout) {
                    this.cashOut();
                }
            } else {
                // Сбрасываем множитель если нет активной игры
                if (this.currentMultiplier > 1.0) {
                    this.currentMultiplier = Math.max(1.0, this.currentMultiplier - 0.1);
                }
            }
            
            // Обновляем отображение множителя
            document.getElementById('multiplier').textContent = this.currentMultiplier.toFixed(2) + 'x';
            
            // Анимация цвета
            const multiplierElement = document.getElementById('multiplier');
            if (this.currentMultiplier > 2) {
                multiplierElement.style.color = '#4ade80';
            } else if (this.currentMultiplier > 1.5) {
                multiplierElement.style.color = '#fbbf24';
            } else {
                multiplierElement.style.color = '#ffd700';
            }
        }, 50);
    }

    async loadGameHistory() {
        try {
            const response = await fetch('http://localhost:3000/api/user/history', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const games = await response.json();
            this.displayHistory(games);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            // Демо данные
            this.displayHistory([
                { gameId: 'game1', crashPoint: 2.5, players: [] },
                { gameId: 'game2', crashPoint: 1.8, players: [] },
                { gameId: 'game3', crashPoint: 5.2, players: [] }
            ]);
        }
    }

    displayHistory(games) {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        games.slice(0, 5).forEach(game => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span>Игра #${game.gameId.substring(0, 8)}</span>
                <span class="${game.crashPoint > 2 ? 'profit' : 'loss'}">
                    ${game.crashPoint.toFixed(2)}x
                </span>
            `;
            historyList.appendChild(item);
        });
    }

    addToHistory(bet, multiplier, profit) {
        const historyList = document.getElementById('historyList');
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span>Ставка ${bet.toFixed(2)} TON</span>
            <span class="profit">${multiplier.toFixed(2)}x (${profit.toFixed(2)} TON)</span>
        `;
        
        historyList.insertBefore(item, historyList.firstChild);
        
        // Ограничиваем количество записей
        if (historyList.children.length > 5) {
            historyList.removeChild(historyList.lastChild);
        }
    }

    setBetAmount(amount) {
        document.getElementById('betAmount').value = amount;
    }

    showDeposit() {
        document.getElementById('depositModal').style.display = 'flex';
    }

    showWithdraw() {
        document.getElementById('withdrawModal').style.display = 'flex';
    }

    showHistory() {
        // Прокручиваем к истории
        document.querySelector('.game-history').scrollIntoView({ behavior: 'smooth' });
    }

    async processDeposit() {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        
        if (!amount || amount < 1) {
            this.showAlert('Минимальный депозит 1 TON', 'error');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3000/api/wallet/deposit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.balance = data.newBalance;
                this.updateUI();
                this.closeModal('depositModal');
                this.showAlert('Депозит успешен!', 'success');
                document.getElementById('depositAmount').value = '';
            } else {
                this.showAlert(data.error, 'error');
            }
        } catch (error) {
            console.error('Ошибка депозита:', error);
            this.showAlert('Ошибка соединения', 'error');
        }
    }

    async processWithdrawal() {
        const address = document.getElementById('withdrawAddress').value;
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        
        if (!address || address.length < 48) {
            this.showAlert('Введите корректный адрес TON', 'error');
            return;
        }
        
        if (!amount || amount < 1) {
            this.showAlert('Минимальный вывод 1 TON', 'error');
            return;
        }
        
        if (amount > this.balance) {
            this.showAlert('Недостаточно средств', 'error');
            return;
        }
        
        // В реальном приложении здесь запрос к API
        this.balance -= amount;
        this.updateUI();
        this.closeModal('withdrawModal');
        this.showAlert('Запрос на вывод отправлен!', 'success');
        
        // Очищаем поля
        document.getElementById('withdrawAddress').value = '';
        document.getElementById('withdrawAmount').value = '';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    updateUI() {
        // Обновляем имя пользователя
        if (this.user) {
            document.getElementById('username').textContent = this.user.username;
        }
        
        // Обновляем баланс
        document.getElementById('balance').textContent = this.balance.toFixed(2);
        
        // Обновляем статус кнопок
        const betButton = document.querySelector('.btn-bet');
        const cashoutButton = document.querySelector('.btn-cashout');
        
        if (this.isGameActive) {
            betButton.disabled = true;
            cashoutButton.disabled = false;
            betButton.style.opacity = '0.5';
            cashoutButton.style.opacity = '1';
        } else {
            betButton.disabled = false;
            cashoutButton.disabled = true;
            betButton.style.opacity = '1';
            cashoutButton.style.opacity = '0.5';
        }
    }

    showAlert(message, type = 'info') {
        // Создаем элемент алерта
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(alert);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            alert.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(alert);
            }, 300);
        }, 3000);
    }
}

// Стили для анимации алертов
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Глобальные функции для кнопок
let game;

window.onload = function() {
    game = new DuckCrashGame();
};

window.placeBet = function() {
    game.placeBet();
};

window.cashOut = function() {
    game.cashOut();
};

window.setBetAmount = function(amount) {
    game.setBetAmount(amount);
};

window.showDeposit = function() {
    game.showDeposit();
};

window.showWithdraw = function() {
    game.showWithdraw();
};

window.showHistory = function() {
    game.showHistory();
};

window.processDeposit = function() {
    game.processDeposit();
};

window.processWithdrawal = function() {
    game.processWithdrawal();
};

window.closeModal = function(modalId) {
    game.closeModal(modalId);
};
