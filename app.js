// ==============================
// ОСНОВНАЯ КОНФИГУРАЦИЯ
// ==============================

// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Раскрыть на весь экран

// Конфигурация
const CONFIG = {
    ADMIN_USERNAME: '@artem_shaveko',
    TON_WALLET: 'UQAthS8QDwBDsbohkCxqfL22NS4NrtV9QMC1jBj78bb-4pVe',
    MIN_DEPOSIT: 0.1,
    MIN_WITHDRAW: 1,
    BASE_WIN_CHANCE: 16.67, // 1/6 = 16.67%
    HIGH_BET_THRESHOLD: 1, // Ставки выше 1 TON удваивают шанс проигрыша
};

// Состояние приложения
let state = {
    balance: 0,
    selectedBetType: 'single',
    selectedNumbers: [],
    currentBet: 0.1,
    timer: 5,
    gameActive: false,
    maintenance: false,
    stats: {
        totalBets: 0,
        totalWins: 0,
        totalLosses: 0,
        totalWon: 0
    },
    user: {
        username: '',
        avatar: '',
        isAdmin: false
    }
};

// База данных в памяти (в реальном проекте заменить на серверную БД)
let database = {
    promoCodes: {},
    withdrawals: [],
    transactions: [],
    users: {}
};

// ==============================
// ИНИЦИАЛИЗАЦИЯ
// ==============================

document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    
    // Инициализация Telegram
    initTelegram();
    
    // Загрузка состояния
    loadState();
    
    // Обновление интерфейса
    updateUI();
    
    // Проверка админа
    checkAdmin();
    
    // Таймер для кубика
    startTimer();
});

function initTelegram() {
    try {
        const initData = tg.initDataUnsafe;
        console.log('Telegram init data:', initData);
        
        // Получаем данные пользователя
        if (initData.user) {
            state.user.username = initData.user.username || '';
            state.user.avatar = initData.user.photo_url || '';
            
            // Обновляем профиль в интерфейсе
            document.getElementById('username').textContent = state.user.username;
            
            if (state.user.avatar) {
                document.getElementById('userAvatar').innerHTML = 
                    `<img src="${state.user.avatar}" alt="Avatar" style="width:60px;height:60px;border-radius:50%;">`;
            }
            
            // Проверка на админа
            if (state.user.username.toLowerCase() === CONFIG.ADMIN_USERNAME.toLowerCase()) {
                state.user.isAdmin = true;
                document.getElementById('adminSection').classList.remove('hidden');
            }
            
            // Загрузка баланса пользователя
            loadUserBalance();
        }
    } catch (error) {
        console.error('Telegram init error:', error);
    }
}

// ==============================
// ИГРОВАЯ ЛОГИКА
// ==============================

function selectBetType(type) {
    state.selectedBetType = type;
    state.selectedNumbers = [];
    
    // Обновляем активные кнопки
    document.querySelectorAll('.bet-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.dataset.type === type) {
            opt.classList.add('active');
        }
    });
    
    // Обновляем список выбранных чисел
    updateSelectedNumbers();
    
    console.log('Selected bet type:', type);
}

function selectNumber(num) {
    if (state.selectedBetType === 'single') {
        state.selectedNumbers = [num];
    }
    updateNumberSelection();
    updateSelectedNumbers();
}

function selectDoubleNumber(num) {
    if (state.selectedBetType === 'double') {
        if (state.selectedNumbers.includes(num)) {
            state.selectedNumbers = state.selectedNumbers.filter(n => n !== num);
        } else if (state.selectedNumbers.length < 2) {
            state.selectedNumbers.push(num);
        }
    }
    updateNumberSelection();
    updateSelectedNumbers();
}

function selectTripleNumber(num) {
    if (state.selectedBetType === 'triple') {
        if (state.selectedNumbers.includes(num)) {
            state.selectedNumbers = state.selectedNumbers.filter(n => n !== num);
        } else if (state.selectedNumbers.length < 3) {
            state.selectedNumbers.push(num);
        }
    }
    updateNumberSelection();
    updateSelectedNumbers();
}

function updateNumberSelection() {
    // Снимаем выделение со всех чисел
    document.querySelectorAll('.number').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Выделяем выбранные числа
    state.selectedNumbers.forEach(num => {
        const el = document.querySelector(`.number[data-num="${num}"]`);
        if (el) el.classList.add('selected');
    });
}

function updateSelectedNumbers() {
    const numbersList = document.getElementById('numbersList');
    numbersList.innerHTML = '';
    
    state.selectedNumbers.forEach(num => {
        const span = document.createElement('span');
        span.textContent = num;
        numbersList.appendChild(span);
    });
    
    // Показываем/скрываем блок
    const container = document.getElementById('selectedNumbers');
    if (state.selectedNumbers.length > 0) {
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

function changeBet(amount) {
    const input = document.getElementById('betAmount');
    let current = parseFloat(input.value) || 0.1;
    let newValue = current + amount;
    
    if (newValue < 0.1) newValue = 0.1;
    if (newValue > state.balance) newValue = state.balance;
    
    input.value = newValue.toFixed(1);
    state.currentBet = newValue;
}

function setBet(amount) {
    const input = document.getElementById('betAmount');
    input.value = amount;
    state.currentBet = amount;
}

function placeBet() {
    // Проверки
    if (state.maintenance && !state.user.isAdmin) {
        showMaintenance();
        return;
    }
    
    if (state.gameActive) {
        showAlert('Дождитесь окончания текущей игры!');
        return;
    }
    
    if (state.selectedNumbers.length === 0) {
        showAlert('Выберите числа для ставки!');
        return;
    }
    
    const betAmount = parseFloat(document.getElementById('betAmount').value);
    
    if (isNaN(betAmount) || betAmount < 0.1) {
        showAlert('Минимальная ставка: 0.1 TON');
        return;
    }
    
    if (betAmount > state.balance) {
        showAlert('Недостаточно средств!');
        return;
    }
    
    // Списание средств
    state.balance -= betAmount;
    updateBalance();
    
    // Статистика
    state.stats.totalBets++;
    updateStats();
    
    // Блокируем кнопку
    const betBtn = document.getElementById('placeBetBtn');
    betBtn.disabled = true;
    betBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ставка принята...';
    
    // Запускаем таймер броска
    startRolling();
}

function startRolling() {
    state.gameActive = true;
    const timerElement = document.getElementById('timer');
    const diceElement = document.getElementById('dice');
    const rollingText = document.getElementById('rollingText');
    
    // Анимация кубика
    diceElement.classList.add('dice-rolling');
    
    let countdown = 5;
    const countdownInterval = setInterval(() => {
        timerElement.textContent = countdown;
        
        if (countdown === 0) {
            clearInterval(countdownInterval);
            
            // Показываем "Крутим..."
            rollingText.classList.remove('hidden');
            timerElement.classList.add('hidden');
            
            // Задержка перед броском
            setTimeout(() => {
                rollDice();
            }, 1000);
        }
        
        countdown--;
    }, 1000);
}

function rollDice() {
    const diceElement = document.getElementById('dice');
    const rollingText = document.getElementById('rollingText');
    const resultElement = document.getElementById('result');
    const resultMessage = document.getElementById('resultMessage');
    const resultDice = document.getElementById('resultDice');
    const resultWin = document.getElementById('resultWin');
    
    // Останавливаем анимацию
    diceElement.classList.remove('dice-rolling');
    rollingText.classList.add('hidden');
    
    // Генерация результата с учетом ставки
    let winChance = CONFIG.BASE_WIN_CHANCE;
    const betAmount = parseFloat(document.getElementById('betAmount').value);
    
    // Удваиваем шанс проигрыша для высоких ставок
    if (betAmount >= CONFIG.HIGH_BET_THRESHOLD) {
        winChance = CONFIG.BASE_WIN_CHANCE / 2;
    }
    
    // Генерируем случайное число от 1 до 6
    const diceResult = Math.floor(Math.random() * 6) + 1;
    
    // Обновляем отображение кубика
    updateDiceFace(diceResult);
    
    // Проверяем выигрыш
    let isWin = state.selectedNumbers.includes(diceResult);
    let multiplier = getMultiplier();
    let winAmount = 0;
    
    if (isWin) {
        winAmount = state.currentBet * multiplier;
        state.balance += winAmount;
        state.stats.totalWins++;
        state.stats.totalWon += winAmount;
        
        // Анимация победы
        resultMessage.innerHTML = `<span style="color:#2ecc71;">🎉 ПОБЕДА!</span>`;
        resultDice.textContent = `Выпало: ${diceResult}`;
        resultWin.textContent = `+${winAmount.toFixed(2)} TON`;
        
        // Вибрация в Telegram
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    } else {
        state.stats.totalLosses++;
        
        resultMessage.innerHTML = `<span style="color:#e74c3c;">💔 ПРОИГРЫШ</span>`;
        resultDice.textContent = `Выпало: ${diceResult}`;
        resultWin.textContent = `-${state.currentBet.toFixed(2)} TON`;
        
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }
    
    // Показываем результат
    resultElement.classList.remove('hidden');
    
    // Обновляем интерфейс
    updateBalance();
    updateStats();
    
    // Разблокируем кнопку через 3 секунды
    setTimeout(() => {
        state.gameActive = false;
        const betBtn = document.getElementById('placeBetBtn');
        betBtn.disabled = false;
        betBtn.innerHTML = '<i class="fas fa-play-circle"></i> Сделать ставку';
        
        // Скрываем результат через 5 секунд
        setTimeout(() => {
            resultElement.classList.add('hidden');
            resetTimer();
        }, 5000);
    }, 3000);
    
    // Сохраняем транзакцию
    saveTransaction({
        type: isWin ? 'win' : 'loss',
        amount: isWin ? winAmount : -state.currentBet,
        diceResult,
        numbers: state.selectedNumbers,
        timestamp: new Date().toISOString()
    });
}

function getMultiplier() {
    switch(state.selectedBetType) {
        case 'single': return 3;
        case 'double': return 1.5;
        case 'triple': return 1.25;
        default: return 1;
    }
}

function updateDiceFace(number) {
    const dice = document.getElementById('dice');
    dice.className = `dice dice-${number}`;
    
    // Обновляем точки на кубике
    const face = dice.querySelector('.dice-face');
    face.innerHTML = '';
    
    // Расположение точек для каждого числа
    const dotPositions = {
        1: ['center'],
        2: ['top-left', 'bottom-right'],
        3: ['top-left', 'center', 'bottom-right'],
        4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
        6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    };
    
    dotPositions[number].forEach(pos => {
        const dot = document.createElement('div');
        dot.className = `dot ${pos}`;
        face.appendChild(dot);
    });
}

// ==============================
// ТАЙМЕР И АВТОМАТИЧЕСКИЕ ФУНКЦИИ
// ==============================

function startTimer() {
    // Автозапуск таймера каждые 6 секунд
    setInterval(() => {
        if (!state.gameActive && state.timer === 0) {
            // Если игра не активна и таймер на 0, сбрасываем
            resetTimer();
        }
    }, 1000);
}

function updateTimer() {
    const timerElement = document.getElementById('timer');
    if (!state.gameActive) {
        if (state.timer === 0) {
            state.timer = 5;
        } else {
            state.timer--;
        }
        timerElement.textContent = state.timer;
    }
}

function resetTimer() {
    state.timer = 5;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = state.timer;
    timerElement.classList.remove('hidden');
}

// ==============================
// БАЛАНС И ПЛАТЕЖИ
// ==============================

function updateBalance() {
    document.getElementById('balance').textContent = state.balance.toFixed(2);
    document.getElementById('availableBalance').textContent = state.balance.toFixed(2);
    saveState();
}

function loadUserBalance() {
    // В реальном проекте здесь запрос к серверу
    // Пока используем localStorage
    const saved = localStorage.getItem(`balance_${state.user.username}`);
    if (saved) {
        state.balance = parseFloat(saved);
        updateBalance();
    }
}

function checkBalance() {
    // В реальном проекте проверяем транзакции на кошельке
    console.log('Checking balance updates...');
    
    // Симуляция проверки новых транзакций
    const newTransactions = Math.random() > 0.7; // 30% шанс новой транзакции
    
    if (newTransactions) {
        const amount = Math.random() * 10; // Случайная сумма до 10 TON
        state.balance += amount;
        updateBalance();
        
        if (amount > 0) {
            showAlert(`Зачислено ${amount.toFixed(2)} TON!`, 'success');
        }
    }
}

// ==============================
// ПОПОЛНЕНИЕ БАЛАНСА
// ==============================

function openDeposit() {
    document.getElementById('depositModal').classList.remove('hidden');
    
    // Проверка подключенного кошелька
    checkWalletConnection();
}

function closeDeposit() {
    document.getElementById('depositModal').classList.add('hidden');
}

function copyWalletAddress() {
    const address = CONFIG.TON_WALLET;
    navigator.clipboard.writeText(address).then(() => {
        showAlert('Адрес скопирован!', 'success');
    });
}

function setDeposit(amount) {
    document.getElementById('depositAmount').value = amount;
}

function processDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (isNaN(amount) || amount < CONFIG.MIN_DEPOSIT) {
        showAlert(`Минимальная сумма: ${CONFIG.MIN_DEPOSIT} TON`);
        return;
    }
    
    showAlert(`Переведите ${amount} TON на кошелек:\n${CONFIG.TON_WALLET}\n\nБаланс обновится через 30 секунд.`);
    
    // Сохраняем информацию о депозите
    saveTransaction({
        type: 'deposit_request',
        amount: amount,
        wallet: CONFIG.TON_WALLET,
        username: state.user.username,
        timestamp: new Date().toISOString()
    });
    
    closeModal('depositModal');
    
    // Запускаем проверку платежа
    setTimeout(checkPayment, 30000);
}

function checkPayment() {
    // В реальном проекте здесь API проверки транзакций
    // Пока симулируем успешный платеж в 50% случаев
    const success = Math.random() > 0.5;
    
    if (success) {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        state.balance += amount;
        updateBalance();
        
        showAlert(`Платеж подтвержден! Зачислено ${amount} TON`, 'success');
        
        saveTransaction({
            type: 'deposit_success',
            amount: amount,
            timestamp: new Date().toISOString()
        });
    }
}

// ==============================
// ВЫВОД СРЕДСТВ
// ==============================

function openWithdraw() {
    if (state.balance < CONFIG.MIN_WITHDRAW) {
        showAlert(`Минимальная сумма вывода: ${CONFIG.MIN_WITHDRAW} TON`);
        return;
    }
    
    document.getElementById('withdrawModal').classList.remove('hidden');
}

function requestWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const address = document.getElementById('withdrawAddress').value.trim();
    
    if (isNaN(amount) || amount < CONFIG.MIN_WITHDRAW) {
        showAlert(`Минимальная сумма: ${CONFIG.MIN_WITHDRAW} TON`);
        return;
    }
    
    if (amount > state.balance) {
        showAlert('Недостаточно средств!');
        return;
    }
    
    if (!address || address.length < 10) {
        showAlert('Введите корректный адрес кошелька TON');
        return;
    }
    
    // Резервируем средства
    state.balance -= amount;
    updateBalance();
    
    // Создаем запрос на вывод
    const withdrawal = {
        id: Date.now(),
        username: state.user.username,
        amount: amount,
        address: address,
        status: 'pending',
        timestamp: new Date().toISOString()
    };
    
    database.withdrawals.push(withdrawal);
    
    showAlert('Запрос на вывод отправлен! Ожидайте обработки.', 'success');
    
    saveTransaction({
        type: 'withdrawal_request',
        amount: -amount,
        address: address,
        timestamp: new Date().toISOString()
    });
    
    closeModal('withdrawModal');
}

// ==============================
// ПРОМОКОДЫ
// ==============================

function openPromo() {
    document.getElementById('promoModal').classList.remove('hidden');
}

function activatePromo() {
    const code = document.getElementById('promoCode').value.trim().toUpperCase();
    const resultElement = document.getElementById('promoResult');
    
    if (!code) {
        resultElement.innerHTML = '<span style="color:#e74c3c;">Введите промокод!</span>';
        return;
    }
    
    // Проверка в базе данных
    const promo = database.promoCodes[code];
    
    if (!promo) {
        resultElement.innerHTML = '<span style="color:#e74c3c;">Промокод не найден!</span>';
        return;
    }
    
    if (promo.activations <= 0) {
        resultElement.innerHTML = '<span style="color:#e74c3c;">Промокод исчерпан!</span>';
        return;
    }
    
    if (promo.usedBy && promo.usedBy.includes(state.user.username)) {
        resultElement.innerHTML = '<span style="color:#e74c3c;">Вы уже активировали этот промокод!</span>';
        return;
    }
    
    // Активация промокода
    promo.activations--;
    if (!promo.usedBy) promo.usedBy = [];
    promo.usedBy.push(state.user.username);
    
    // Начисление средств
    state.balance += promo.amount;
    updateBalance();
    
    resultElement.innerHTML = `<span style="color:#2ecc71;">✅ Промокод активирован! +${promo.amount} TON</span>`;
    
    // Очистка через 3 секунды
    setTimeout(() => {
        document.getElementById('promoCode').value = '';
        resultElement.innerHTML = '';
        closeModal('promoModal');
    }, 3000);
    
    saveTransaction({
        type: 'promo_activated',
        code: code,
        amount: promo.amount,
        timestamp: new Date().toISOString()
    });
}

// ==============================
// АДМИН-ПАНЕЛЬ
// ==============================

function checkAdmin() {
    if (state.user.isAdmin) {
        console.log('Admin user detected');
        document.getElementById('adminSection').classList.remove('hidden');
        document.getElementById('toggleAppBtn').innerHTML = 
            `<i class="fas fa-power-off"></i><span>Выключить</span>`;
    }
}

function openCreatePromo() {
    if (!state.user.isAdmin) return;
    
    document.getElementById('createPromoModal').classList.remove('hidden');
    updatePromoPreview();
}

function updatePromoPreview() {
    if (!state.user.isAdmin) return;
    
    const code = document.getElementById('promoName')?.value || 'WELCOME2024';
    const activations = document.getElementById('promoActivations')?.value || 1;
    const amount = document.getElementById('promoAmount')?.value || 0.1;
    
    document.getElementById('previewCode').textContent = code;
    document.getElementById('previewActivations').textContent = activations;
    document.getElementById('previewAmount').textContent = amount;
}

function createPromo() {
    if (!state.user.isAdmin) return;
    
    const code = document.getElementById('promoName').value.trim().toUpperCase();
    const activations = parseInt(document.getElementById('promoActivations').value);
    const amount = parseFloat(document.getElementById('promoAmount').value);
    
    if (!code) {
        showAlert('Введите код промокода!');
        return;
    }
    
    if (activations < 1 || activations > 1000000) {
        showAlert('Количество активаций от 1 до 1,000,000');
        return;
    }
    
    if (amount < 0.1) {
        showAlert('Минимальная сумма: 0.1 TON');
        return;
    }
    
    // Создаем промокод
    database.promoCodes[code] = {
        code: code,
        activations: activations,
        amount: amount,
        createdBy: state.user.username,
        createdAt: new Date().toISOString(),
        usedBy: []
    };
    
    showAlert(`Промокод "${code}" создан успешно!`, 'success');
    
    // Очищаем форму
    document.getElementById('promoName').value = '';
    document.getElementById('promoActivations').value = 1;
    document.getElementById('promoAmount').value = 0.1;
    
    closeModal('createPromoModal');
}

function openWithdrawalRequests() {
    if (!state.user.isAdmin) return;
    
    document.getElementById('withdrawRequestsModal').classList.remove('hidden');
    updateWithdrawalRequests();
}

function updateWithdrawalRequests() {
    const list = document.getElementById('requestsList');
    list.innerHTML = '';
    
    const pending = database.withdrawals.filter(w => w.status === 'pending');
    
    if (pending.length === 0) {
        list.innerHTML = '<p>Нет активных запросов</p>';
        return;
    }
    
    pending.forEach(request => {
        const item = document.createElement('div');
        item.className = 'request-item';
        item.innerHTML = `
            <div class="request-header">
                <strong>${request.username}</strong>
                <span>${request.amount} TON</span>
            </div>
            <div class="request-address">
                <code>${request.address}</code>
                <button onclick="copyToClipboard('${request.address}')">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="request-actions">
                <button onclick="approveWithdrawal(${request.id})" class="btn-approve">
                    <i class="fas fa-check"></i> Одобрить
                </button>
                <button onclick="rejectWithdrawal(${request.id})" class="btn-reject">
                    <i class="fas fa-times"></i> Отклонить
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function approveWithdrawal(id) {
    const request = database.withdrawals.find(w => w.id === id);
    if (request) {
        request.status = 'approved';
        showAlert(`Вывод для ${request.username} одобрен!`);
        updateWithdrawalRequests();
    }
}

function rejectWithdrawal(id) {
    const request = database.withdrawals.find(w => w.id === id);
    if (request) {
        // Возвращаем средства
        const userState = JSON.parse(localStorage.getItem(`state_${request.username}`) || '{}');
        if (userState.balance) {
            userState.balance += request.amount;
            localStorage.setItem(`state_${request.username}`, JSON.stringify(userState));
        }
        
        request.status = 'rejected';
        showAlert(`Вывод для ${request.username} отклонен!`);
        updateWithdrawalRequests();
    }
}

function toggleAppMode() {
    if (!state.user.isAdmin) return;
    
    state.maintenance = !state.maintenance;
    
    const btn = document.getElementById('toggleAppBtn');
    if (state.maintenance) {
        btn.innerHTML = '<i class="fas fa-power-on"></i><span>Включить</span>';
        showMaintenance();
        showAlert('Приложение выключено для других пользователей', 'warning');
    } else {
        btn.innerHTML = '<i class="fas fa-power-off"></i><span>Выключить</span>';
        hideMaintenance();
        showAlert('Приложение включено для всех', 'success');
    }
}

function showMaintenance() {
    if (state.maintenance && !state.user.isAdmin) {
        document.getElementById('maintenanceModal').classList.remove('hidden');
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.querySelector('.bottom-nav').classList.add('hidden');
    }
}

function hideMaintenance() {
    document.getElementById('maintenanceModal').classList.add('hidden');
    document.querySelector('.bottom-nav').classList.remove('hidden');
    openSection('games');
}

// ==============================
// УТИЛИТЫ И ИНТЕРФЕЙС
// ==============================

function openSection(section) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    
    // Скрываем меню и инвентарь, если открываем игры
    if (section === 'games') {
        document.getElementById('menuSection').classList.add('hidden');
        document.getElementById('inventorySection').classList.add('hidden');
    }
    
    // Показываем выбранную секцию
    const target = document.getElementById(`${section}Section`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    // Обновляем активные кнопки меню
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.onclick.toString().includes(section)) {
            btn.classList.add('active');
        }
    });
}

function closeMenu() {
    openSection('games');
}

function closeInventory() {
    openSection('games');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showAlert(message, type = 'info') {
    if (tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
    
    // Стилизованное уведомление для браузера
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 10px;
        z-index: 10000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Скопировано!', 'success');
    });
}

function updateUI() {
    updateBalance();
    updateStats();
}

function updateStats() {
    document.getElementById('totalBets').textContent = state.stats.totalBets;
    document.getElementById('totalWins').textContent = state.stats.totalWins;
    document.getElementById('totalLosses').textContent = state.stats.totalLosses;
    document.getElementById('totalWon').textContent = `${state.stats.totalWon.toFixed(2)} TON`;
}

function saveState() {
    if (state.user.username) {
        localStorage.setItem(`state_${state.user.username}`, JSON.stringify(state));
        localStorage.setItem(`balance_${state.user.username}`, state.balance.toString());
    }
    localStorage.setItem('database', JSON.stringify(database));
}

function loadState() {
    if (state.user.username) {
        const saved = localStorage.getItem(`state_${state.user.username}`);
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
        }
    }
    
    const savedDB = localStorage.getItem('database');
    if (savedDB) {
        database = JSON.parse(savedDB);
    }
}

function saveTransaction(transaction) {
    if (!database.transactions) database.transactions = [];
    database.transactions.push(transaction);
    saveState();
}

// ==============================
// WALLET CONNECT (TON)
// ==============================

function checkWalletConnection() {
    // Заглушка для TON Connect
    // В реальном проекте используйте @tonconnect/ui
    
    const isConnected = localStorage.getItem('ton_wallet_connected') === 'true';
    
    if (isConnected) {
        document.getElementById('walletConnect').classList.add('hidden');
        document.getElementById('walletConnected').classList.remove('hidden');
        
        const address = localStorage.getItem('ton_wallet_address');
        document.getElementById('walletAddress').textContent = 
            address ? `${address.slice(0, 10)}...${address.slice(-10)}` : '...';
    }
}

function connectWallet() {
    // В реальном проекте инициализируйте TON Connect здесь
    showAlert('Для пополнения просто переведите TON на указанный кошелек', 'info');
    
    // Симуляция подключения
    localStorage.setItem('ton_wallet_connected', 'true');
    localStorage.setItem('ton_wallet_address', 'UQ' + Date.now().toString(36));
    
    checkWalletConnection();
}

// ==============================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
// ==============================

// CSS для точек кубика
const style = document.createElement('style');
style.textContent = `
.dot.top-left { top: 20%; left: 20%; }
.dot.top-right { top: 20%; right: 20%; }
.dot.middle-left { top: 50%; left: 20%; transform: translateY(-50%); }
.dot.middle-right { top: 50%;
