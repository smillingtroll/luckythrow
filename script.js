// Инициализация приложения
let tg = window.Telegram.WebApp;
let currentUser = null;
let gameData = {
    balance: 10, // Начальный баланс в TON
    userId: null,
    selectedGame: null,
    betType: null,
    selectedNumbers: [],
    betAmount: 0.1,
    diceResult: null,
    crashMultiplier: 1.00,
    crashGameActive: false,
    isAdmin: false,
    promoCode: null
};

// Промокоды (в реальном приложении это должно быть на сервере)
let promoCodeDatabase = [
    {
        code: "WELCOME",
        activations: 1000,
        prize: 5,
        usedBy: []
    },
    {
        code: "BONUS10",
        activations: 500,
        prize: 10,
        usedBy: []
    }
];

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initUser();
    updateUI();
    
    // Инициализация Telegram Web App
    if (tg) {
        tg.expand();
        tg.enableClosingConfirmation();
    }
});

// Инициализация пользователя
function initUser() {
    // Генерация или получение ID пользователя
    let userId = localStorage.getItem('user_id');
    if (!userId) {
        userId = 'USER_' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('user_id', userId);
    }
    
    // Получение баланса
    let balance = localStorage.getItem('balance');
    if (balance) {
        gameData.balance = parseFloat(balance);
    }
    
    // Проверка админки
    let adminStatus = localStorage.getItem('is_admin');
    gameData.isAdmin = adminStatus === 'true';
    
    gameData.userId = userId;
    
    // Проверка пользователя на админа по ID
    if (userId === 'USER_ARTEM') {
        gameData.isAdmin = true;
        localStorage.setItem('is_admin', 'true');
    }
}

// Обновление интерфейса
function updateUI() {
    // Обновление баланса
    document.getElementById('balance').textContent = gameData.balance.toFixed(2) + ' TON';
    document.getElementById('user-id').textContent = 'ID: ' + gameData.userId;
    document.getElementById('menu-user-id').textContent = gameData.userId;
    
    // Обновление кнопки игры в кости
    const playButton = document.getElementById('play-button');
    playButton.disabled = !gameData.betType || gameData.selectedNumbers.length === 0 || gameData.betAmount <= 0;
    
    // Обновление выбранных чисел
    document.querySelectorAll('.number').forEach(num => {
        num.classList.remove('selected');
    });
    gameData.selectedNumbers.forEach(num => {
        const numElement = document.querySelector(`.number[data-value="${num}"]`);
        if (numElement) numElement.classList.add('selected');
    });
    
    // Обновление выбранного типа ставки
    document.querySelectorAll('.bet-type').forEach(type => {
        type.classList.remove('selected');
    });
    if (gameData.betType) {
        const typeElement = document.querySelector(`.bet-type[data-type="${gameData.betType}"]`);
        if (typeElement) typeElement.classList.add('selected');
    }
    
    // Обновление суммы ставки
    document.getElementById('bet-amount').value = gameData.betAmount.toFixed(1);
    document.getElementById('crash-bet-amount').value = gameData.betAmount.toFixed(1);
    
    // Обновление мультипликатора краша
    document.getElementById('crash-multiplier').textContent = gameData.crashMultiplier.toFixed(2) + 'x';
}

// Навигация
function showGamesSection() {
    hideAllSections();
    document.getElementById('games
