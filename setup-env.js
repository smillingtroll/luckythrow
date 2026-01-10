// setup-env.js - Автоматическое создание .env файла
const fs = require('fs');
const crypto = require('crypto');

console.log('🚀 Создание .env файла для Duck Crash Game...\n');

// Генерация случайных ключей
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');

const envContent = `# ========================================
# 🚀 DUCK CRASH GAME - КОНФИГУРАЦИЯ
# ========================================
# Сгенерировано автоматически
# ========================================

# 🌐 ОБЩИЕ НАСТРОЙКИ
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5500
BACKEND_URL=http://localhost:3000

# 🤖 TELEGRAM BOT
BOT_TOKEN=8261253450:AAF8G31LLmdUdShl92NN2pE6rLv3xCXSpzw
ADMIN_CHAT_ID=921171528

# 🏦 TON БЛОКЧЕЙН
TON_API_KEY=AH3BYVMJGMNYYRIAAAACOXJVHWAOYEEBEGAHOG27CX65TNU5P7QSPN4C562MYETM2YDRSAA
GAME_WALLET_ADDRESS=UQAthS8QDwBDsbohkCxqfL22NS4NrtV9QMC1jBj78bb-4pVe

# 📊 БАЗА ДАННЫХ MONGODB
MONGODB_URI=mongodb+srv://artemshaveko_db_user:<db_password>@duck.kfx1lfh.mongodb.net/duck-crash-game

# 🔧 НАСТРОЙКИ ИГРЫ
MIN_DEPOSIT=1.0
MIN_WITHDRAWAL=1.0
MAX_BET=100.0
MIN_BET=0.1

# Коэффициенты Краш
CRASH_MULTIPLIER_1=1.34
CRASH_MULTIPLIER_2=1.59
CRASH_MULTIPLIER_3=6.14
CRASH_MULTIPLIER_4=15.0
CRASH_MULTIPLIER_5=150.0

# 🔐 БЕЗОПАСНОСТЬ (сгенерировано автоматически)
JWT_SECRET=${jwtSecret}
SESSION_SECRET=${sessionSecret}
ENCRYPTION_KEY=${encryptionKey}

# 📡 API НАСТРОЙКИ
TON_API_URL=https://tonapi.io
TON_API_TIMEOUT=10000
REQUEST_LIMIT=100
CORS_ORIGIN=http://localhost:5500

# 🔧 РЕЖИМ ОТЛАДКИ
DEBUG_MODE=true
LOG_LEVEL=debug
ENABLE_SWAGGER=true
`;

// Сохраняем файл
fs.writeFileSync('.env', envContent);
fs.writeFileSync('.env.example', envContent.replace(/=.*$/gm, '=your_value_here'));

console.log('✅ Файл .env создан!');
console.log('✅ Файл .env.example создан (шаблон для GitHub)');
console.log('\n⚠️  ВАЖНО:');
console.log('1. Замените <db_password> в MONGODB_URI на ваш реальный пароль от MongoDB');
console.log('2. Не забудьте добавить .env в .gitignore!');
console.log('3. Для генерации новых ключей выполните: node setup-env.js');
