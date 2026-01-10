require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключен'))
  .catch(err => console.error('❌ Ошибка подключения MongoDB:', err));

// Модели данных
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  balance: { type: Number, default: 1000 },
  totalWagered: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  crashPoint: { type: Number, required: true },
  players: [{
    telegramId: Number,
    bet: Number,
    cashout: Number,
    profit: Number,
    hasCashedOut: { type: Boolean, default: false }
  }],
  status: { type: String, enum: ['waiting', 'active', 'crashed', 'completed'], default: 'waiting' },
  createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  telegramId: Number,
  type: { type: String, enum: ['deposit', 'withdrawal', 'bet', 'win'] },
  amount: Number,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  transactionHash: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Game = mongoose.model('Game', GameSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Неверный токен' });
    req.user = user;
    next();
  });
};

// TON API клиент
const tonApi = axios.create({
  baseURL: process.env.TON_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.TON_API_KEY}`
  },
  timeout: parseInt(process.env.TON_API_TIMEOUT)
});

// API маршруты
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Регистрация/авторизация пользователя
app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    // Здесь должна быть проверка данных от Telegram
    // Для демо используем простую логику
    
    const user = await User.findOneAndUpdate(
      { telegramId: req.body.userId || 123456 },
      {
        $setOnInsert: {
          telegramId: req.body.userId || 123456,
          username: req.body.username || 'test_user',
          firstName: req.body.firstName || 'Test',
          balance: 1000
        }
      },
      { upsert: true, new: true }
    );

    const token = jwt.sign(
      { userId: user.telegramId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.telegramId,
        username: user.username,
        balance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// Получение баланса
app.get('/api/user/balance', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    res.json({ balance: user.balance });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения баланса' });
  }
});

// Создание новой игры
app.post('/api/game/create', authenticateToken, async (req, res) => {
  try {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const crashPoint = parseFloat((Math.random() * 10 + 1).toFixed(2)); // От 1x до 11x
    
    const game = new Game({
      gameId,
      crashPoint,
      status: 'waiting'
    });

    await game.save();
    
    res.json({
      success: true,
      gameId,
      crashPoint,
      message: 'Игра создана'
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания игры' });
  }
});

// Размещение ставки
app.post('/api/game/bet', authenticateToken, async (req, res) => {
  try {
    const { gameId, betAmount } = req.body;
    
    if (betAmount < process.env.MIN_BET || betAmount > process.env.MAX_BET) {
      return res.status(400).json({ 
        error: `Ставка должна быть от ${process.env.MIN_BET} до ${process.env.MAX_BET}` 
      });
    }

    const user = await User.findOne({ telegramId: req.user.userId });
    if (!user || user.balance < betAmount) {
      return res.status(400).json({ error: 'Недостаточно средств' });
    }

    const game = await Game.findOne({ gameId });
    if (!game || game.status !== 'waiting') {
      return res.status(400).json({ error: 'Игра недоступна для ставок' });
    }

    // Обновляем баланс пользователя
    user.balance -= betAmount;
    user.totalWagered += betAmount;
    await user.save();

    // Добавляем игрока в игру
    game.players.push({
      telegramId: user.telegramId,
      bet: betAmount,
      cashout: null,
      profit: null,
      hasCashedOut: false
    });
    
    await game.save();

    // Создаем транзакцию
    await Transaction.create({
      telegramId: user.telegramId,
      type: 'bet',
      amount: betAmount,
      status: 'completed'
    });

    res.json({
      success: true,
      newBalance: user.balance,
      message: 'Ставка принята'
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка размещения ставки' });
  }
});

// Получение активных игр
app.get('/api/game/active', async (req, res) => {
  try {
    const games = await Game.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения игр' });
  }
});

// История игр пользователя
app.get('/api/user/history', authenticateToken, async (req, res) => {
  try {
    const games = await Game.find({
      'players.telegramId': req.user.userId,
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(20);
    
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения истории' });
  }
});

// Депозит через TON
app.post('/api/wallet/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (amount < process.env.MIN_DEPOSIT) {
      return res.status(400).json({ 
        error: `Минимальный депозит: ${process.env.MIN_DEPOSIT} TON` 
      });
    }

    // В реальном приложении здесь создается адрес для депозита
    // и отслеживается транзакция в блокчейне
    
    const user = await User.findOne({ telegramId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Для демо сразу начисляем средства
    user.balance += parseFloat(amount);
    await user.save();

    await Transaction.create({
      telegramId: user.telegramId,
      type: 'deposit',
      amount: parseFloat(amount),
      status: 'completed'
    });

    res.json({
      success: true,
      newBalance: user.balance,
      message: 'Депозит успешен'
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка депозита' });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Backend URL: ${process.env.BACKEND_URL}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});
