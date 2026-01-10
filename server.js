const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/duckcrash';
const GAME_WALLET = 'UQAthS8QDwBDsbohkCxqfL22NS4NrtV9QMC1jBj78bb-4pVe';
const TON_API_KEY = process.env.TON_API_KEY;

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Подключение к MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB подключен'))
    .catch(err => console.error('MongoDB ошибка:', err));

// Модели данных
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    telegramId: String,
    username: String,
    walletAddress: String,
    balance: { type: Number, default: 0 },
    totalDeposited: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    registrationDate: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'bet', 'win'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
    transactionHash: String,
    walletAddress: String,
    gameId: String,
    createdAt: { type: Date, default: Date.now },
    confirmedAt: Date
});

const gameSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['crash'], required: true },
    crashPoint: { type: Number, required: true },
    maxMultiplier: Number,
    players: [{
        userId: String,
        betAmount: Number,
        cashoutMultiplier: Number,
        winAmount: Number,
        isWin: Boolean
    }],
    startedAt: { type: Date, default: Date.now },
    endedAt: Date
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Game = mongoose.model('Game', gameSchema);

// === API РОУТЫ ===

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
    try {
        const { userId, telegramData, walletAddress } = req.body;
        
        let user = await User.findOne({ userId });
        
        if (!user) {
            user = new User({
                userId,
                telegramId: telegramData?.id,
                username: telegramData?.username || telegramData?.first_name,
                walletAddress,
                balance: 0
            });
            await user.save();
            
            // Отправляем приветственное сообщение
            if (telegramData?.id) {
                bot.sendMessage(telegramData.id, 
                    '🎮 Добро пожаловать в Duck Crash!\n\n' +
                    'Для начала игры пополните баланс и сделайте ставку.\n' +
                    'Удачи! 🦆'
                );
            }
        } else {
            user.lastActive = new Date();
            if (walletAddress) user.walletAddress = walletAddress;
            await user.save();
        }
        
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получение баланса
app.get('/api/balance/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Обновление баланса
app.post('/api/update-balance', async (req, res) => {
    try {
        const { userId, amount, type, gameId } = req.body;
        
        const user = await User.findOne({ userId });
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        
        // Проверяем достаточно ли средств для списания
        if (amount < 0 && Math.abs(amount) > user.balance) {
            return res.json({ success: false, error: 'Недостаточно средств' });
        }
        
        user.balance += amount;
        user.lastActive = new Date();
        
        if (amount > 0 && type === 'win') {
            user.totalWon += amount;
        }
        
        await user.save();
        
        // Записываем транзакцию
        const transaction = new Transaction({
            userId,
            type: amount > 0 ? 'win' : 'bet',
            amount: Math.abs(amount),
            status: 'confirmed',
            gameId
        });
        await transaction.save();
        
        res.json({ success: true, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Сохранение адреса кошелька
app.post('/api/save-wallet', async (req, res) => {
    try {
        const { userId, walletAddress } = req.body;
        
        await User.updateOne(
            { userId },
            { 
                $set: { 
                    walletAddress,
                    lastActive: new Date()
                }
            }
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Проверка депозитов
app.get('/api/check-deposits/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // Получаем последние транзакции кошелька через TON API
        const response = await axios.get(
            `https://tonapi.io/v2/blockchain/accounts/${walletAddress}/transactions`,
            {
                headers: { 
                    'Authorization': `Bearer ${TON_API_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        const transactions = response.data.transactions || [];
        const deposits = [];
        
        // Фильтруем транзакции на наш кошелек
        for (const tx of transactions) {
            if (tx.in_msg?.destination === GAME_WALLET && tx.in_msg?.value) {
                const amount = tx.in_msg.value / 1000000000; // Конвертируем наноTON в TON
                
                // Проверяем не было ли уже зачислено
                const existingTx = await Transaction.findOne({ 
                    transactionHash: tx.transaction_id.hash,
                    type: 'deposit'
                });
                
                if (!existingTx && amount >= 1) { // Минимум 1 TON
                    deposits.push({
                        hash: tx.transaction_id.hash,
                        amount: amount,
                        timestamp: new Date(tx.utime * 1000)
                    });
                }
            }
        }
        
        if (deposits.length > 0) {
            // Находим пользователя по кошельку
            const user = await User.findOne({ walletAddress });
            
            if (user) {
                let totalDeposited = 0;
                
                for (const deposit of deposits) {
                    // Зачисляем баланс
                    user.balance += deposit.amount;
                    user.totalDeposited += deposit.amount;
                    
                    // Записываем транзакцию
                    const transaction = new Transaction({
                        userId: user.userId,
                        type: 'deposit',
                        amount: deposit.amount,
                        status: 'confirmed',
                        transactionHash: deposit.hash,
                        walletAddress,
                        confirmedAt: new Date()
                    });
                    await transaction.save();
                    
                    totalDeposited += deposit.amount;
                }
                
                await user.save();
                
                // Уведомляем пользователя
                if (user.telegramId) {
                    bot.sendMessage(
                        user.telegramId,
                        `✅ Ваш депозит ${totalDeposited.toFixed(2)} TON подтвержден!\n` +
                        `Новый баланс: ${user.balance.toFixed(2)} TON\n\n` +
                        `Удачи в игре! 🦆`
                    );
                }
                
                res.json({ 
                    success: true, 
                    deposits: deposits,
                    newBalance: user.balance 
                });
                return;
            }
        }
        
        res.json({ success: true, deposits: [] });
    } catch (error) {
        console.error('Ошибка проверки депозитов:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Запрос на вывод
app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, amount, walletAddress } = req.body;
        
        const user = await User.findOne({ userId });
        if (!user) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        
        if (amount < 1) {
            return res.json({ success: false, error: 'Минимальная сумма вывода 1 TON' });
        }
        
        if (amount > user.balance) {
            return res.json({ success: false, error: 'Недостаточно средств' });
        }
        
        if (user.walletAddress !== walletAddress) {
            return res.json({ success: false, error: 'Кошелек не совпадает' });
        }
        
        // Создаем транзакцию вывода
        const transaction = new Transaction({
            userId,
            type: 'withdrawal',
            amount,
            status: 'pending',
            walletAddress
        });
        await transaction.save();
        
        // Резервируем средства
        user.balance -= amount;
        await user.save();
        
        // Уведомляем админа
        const adminChatId = 'YOUR_ADMIN_CHAT_ID'; // Замените на ваш ID
        bot.sendMessage(
            adminChatId,
            `🔄 Новый запрос на вывод:\n` +
            `👤 Пользователь: @${user.username || userId}\n` +
            `💰 Сумма: ${amount} TON\n` +
            `👛 Кошелек: ${walletAddress}\n` +
            `📊 Баланс до: ${(user.balance + amount).toFixed(2)} TON\n` +
            `📊 Баланс после: ${user.balance.toFixed(2)} TON\n\n` +
            `ID транзакции: ${transaction._id}`
        );
        
        // Уведомляем пользователя
        if (user.telegramId) {
            bot.sendMessage(
                user.telegramId,
                `📨 Ваш запрос на вывод ${amount} TON принят!\n` +
                `⏳ Средства будут отправлены в течение 24 часов.\n` +
                `👛 Адрес: ${walletAddress}\n\n` +
                `Текущий баланс: ${user.balance.toFixed(2)} TON`
            );
        }
        
        res.json({ success: true, transactionId: transaction._id });
    } catch (error) {
        console.error('Ошибка вывода:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получение статистики
app.get('/api/stats/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        const transactions = await Transaction.find({ 
            userId: req.params.userId,
            status: 'confirmed'
        }).sort({ createdAt: -1 }).limit(10);
        
        const games = await Game.find({ 
            'players.userId': req.params.userId 
        }).sort({ startedAt: -1 }).limit(5);
        
        res.json({
            success: true,
            user,
            recentTransactions: transactions,
            recentGames: games
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// === КОМАНДЫ БОТА ===

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    const user = await User.findOne({ telegramId: userId });
    const balance = user ? user.balance : 0;
    
    bot.sendMessage(
        chatId,
        `🦆 Добро пожаловать в Duck Crash!\n\n` +
        `💰 Ваш баланс: ${balance.toFixed(2)} TON\n\n` +
        `🎮 Чтобы начать играть:\n` +
        `1. Откройте игру через кнопку Меню\n` +
        `2. Подключите TON кошелек\n` +
        `3. Пополните баланс\n` +
        `4. Делайте ставки и выигрывайте!\n\n` +
        `📊 Минимальная ставка: 0.1 TON\n` +
        `💰 Минимальный вывод: 1 TON\n\n` +
        `Удачи! 🍀`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🎮 Открыть игру', web_app: { url: 'https://ваш-домен.com' } }
                ]]
            }
        }
    );
});

// Команда /balance
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    const user = await User.findOne({ telegramId: userId });
    
    if (user) {
        bot.sendMessage(
            chatId,
            `💰 Ваш баланс: ${user.balance.toFixed(2)} TON\n` +
            `📥 Всего пополнено: ${user.totalDeposited.toFixed(2)} TON\n` +
            `📤 Всего выведено: ${user.totalWithdrawn.toFixed(2)} TON\n` +
            `🏆 Выиграно: ${user.totalWon.toFixed(2)} TON\n` +
            `🎮 Игр сыграно: ${user.gamesPlayed}\n\n` +
            `Для пополнения откройте игру через кнопку Меню`
        );
    } else {
        bot.sendMessage(chatId, 'Вы еще не зарегистрированы в игре. Нажмите /start');
    }
});

// Админ команды
bot.onText(/\/admin (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = 'YOUR_ADMIN_ID'; // Замените на ваш ID
    
    if (msg.from.id.toString() !== adminId) {
        return bot.sendMessage(chatId, '⛔ У вас нет прав администратора');
    }
    
    const command = match[1];
    
    if (command === 'stats') {
        const totalUsers = await User.countDocuments();
        const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
        const todayDeposits = await Transaction.aggregate([
            { 
                $match: { 
                    type: 'deposit',
                    createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        bot.sendMessage(
            chatId,
            `📊 Статистика игры:\n\n` +
            `👥 Пользователей: ${totalUsers}\n` +
            `💰 Общий баланс: ${totalBalance[0]?.total.toFixed(2) || 0} TON\n` +
            `📥 Депозитов сегодня: ${todayDeposits[0]?.total.toFixed(2) || 0} TON\n` +
            `🕒 Сервер: ${new Date().toLocaleString()}`
        );
    }
    
    if (command.startsWith('withdraw ')) {
        const parts = command.split(' ');
        const transactionId = parts[1];
        
        const transaction = await Transaction.findById(transactionId);
        
        if (!transaction) {
            return bot.sendMessage(chatId, '❌ Транзакция не найдена');
        }
        
        if (transaction.status !== 'pending') {
            return bot.sendMessage(chatId, `❌ Статус транзакции: ${transaction.status}`);
        }
        
        // Здесь должна быть логика отправки TON через tonapi.io или tonkeeper
        
        transaction.status = 'confirmed';
        transaction.confirmedAt = new Date();
        await transaction.save();
        
        const user = await User.findOne({ userId: transaction.userId });
        if (user) {
            user.totalWithdrawn += transaction.amount;
            await user.save();
            
            bot.sendMessage(
                user.telegramId,
                `✅ Ваш вывод ${transaction.amount} TON выполнен!\n` +
                `👛 Средства отправлены на кошелек: ${transaction.walletAddress}\n\n` +
                `Спасибо за игру! 🦆`
            );
        }
        
        bot.sendMessage(chatId, `✅ Вывод ${transaction.amount} TON выполнен`);
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
