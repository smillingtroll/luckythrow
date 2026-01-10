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
                headers:
