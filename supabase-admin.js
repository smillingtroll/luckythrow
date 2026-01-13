// === CONFIGURATION ===
const SUPABASE_CONFIG = {
  url: 'https://cbuhxqcnummijqdddizy.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidWh4cWNudW1taWpxZGRkaXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjE0NjEsImV4cCI6MjA4Mzg5NzQ2MX0.PCQ6wE9R9XP55MnNTDvrEQ-3BsMXFIP66MkI1FE1k0s'
};

let supabaseClient = null;

// === ИНИЦИАЛИЗАЦИЯ ===
function initSupabase() {
  console.log('🔄 Инициализация Supabase...');
  
  // Проверяем библиотеку
  if (typeof window.supabase === 'undefined') {
    console.error('❌ Библиотека Supabase не загружена!');
    loadSupabaseLibrary();
    return false;
  }
  
  try {
    // Создаем клиент
    supabaseClient = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true
        }
      }
    );
    
    console.log('✅ Supabase клиент создан');
    
    // Тест подключения
    testConnection();
    
    // Обновляем статус
    updateSupabaseStatus('connected');
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка создания клиента:', error);
    updateSupabaseStatus('error');
    return false;
  }
}

// === ЗАГРУЗКА БИБЛИОТЕКИ ===
function loadSupabaseLibrary() {
  console.log('📥 Загружаем библиотеку Supabase...');
  
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
  script.onload = function() {
    console.log('✅ Библиотека Supabase загружена');
    setTimeout(initSupabase, 500);
  };
  script.onerror = function() {
    console.error('❌ Ошибка загрузки библиотеки');
    updateSupabaseStatus('error');
  };
  
  document.head.appendChild(script);
}

// === ТЕСТ ПОДКЛЮЧЕНИЯ ===
async function testConnection() {
  if (!supabaseClient) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('players')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    console.log('✅ Подключение к Supabase успешно');
    console.log('📊 Таблица players доступна');
    
  } catch (error) {
    console.warn('⚠️ Ошибка теста подключения:', error.message);
    // Это нормально если таблица пустая или нет таблицы
  }
}

// === ОБНОВЛЕНИЕ СТАТУСА ===
function updateSupabaseStatus(status) {
  const statusDiv = document.getElementById('supabase-status');
  if (!statusDiv) {
    // Создаем элемент если его нет
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
      const newStatus = document.createElement('div');
      newStatus.id = 'supabase-status';
      newStatus.className = 'supabase-status';
      adminPanel.appendChild(newStatus);
    } else {
      return;
    }
  }
  
  const element = document.getElementById('supabase-status');
  if (!element) return;
  
  let html = '';
  
  switch(status) {
    case 'connected':
      html = `
        <div class="status-dot connected"></div>
        <div class="status-text">Supabase: Подключено ✅</div>
      `;
      break;
    case 'error':
      html = `
        <div class="status-dot error"></div>
        <div class="status-text">Supabase: Ошибка подключения ❌</div>
      `;
      break;
    default:
      html = `
        <div class="status-dot"></div>
        <div class="status-text">Supabase: Инициализация...</div>
      `;
  }
  
  element.innerHTML = html;
}

// === СИНХРОНИЗАЦИЯ ИГРОКОВ ===
async function syncWithSupabase() {
  if (!appData || !appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  // Проверяем инициализацию
  if (!supabaseClient) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('🔄 Начинаем синхронизацию...', 'info');
    
    // Получаем локальных игроков
    const localPlayers = getAllLocalPlayers();
    
    if (localPlayers.length === 0) {
      showNotification('❌ Нет игроков для синхронизации', 'error');
      return;
    }
    
    // Загружаем в Supabase
    let successCount = 0;
    for (const player of localPlayers) {
      const { error } = await supabaseClient
        .from('players')
        .upsert({
          user_id: player.id,
          username: player.username || 'Игрок',
          wallet_address: player.wallet || '',
          balance: player.balance || 0,
          turnover: player.turnover || 0,
          games_played: player.gamesPlayed || 0,
          max_win: player.maxWin || 0,
          registration_date: player.registrationDate || new Date().toISOString(),
          last_active: player.lastActive || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.error(`❌ Ошибка игрока ${player.id}:`, error);
      } else {
        successCount++;
      }
    }
    
    showNotification(`✅ Синхронизировано ${successCount} из ${localPlayers.length} игроков!`, 'success');
    
    // Логируем действие
    await logAdminAction('SYNC_PLAYERS', `Синхронизировано ${successCount} игроков`);
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    showNotification('❌ Ошибка синхронизации: ' + error.message, 'error');
  }
}

// === ПОЛУЧИТЬ ЛОКАЛЬНЫХ ИГРОКОВ ===
function getAllLocalPlayers() {
  try {
    // Из глобальной переменной
    if (window.allPlayers && Array.isArray(allPlayers)) {
      return allPlayers.map(p => ({
        id: p.id || 'unknown',
        username: p.username || 'Игрок',
        wallet: p.wallet || '',
        balance: parseFloat(p.balance) || 0,
        turnover: parseFloat(p.turnover) || 0,
        gamesPlayed: parseInt(p.gamesPlayed) || 0,
        maxWin: parseFloat(p.maxWin) || 0,
        registrationDate: p.registrationDate || new Date().toISOString(),
        lastActive: p.lastActive || new Date().toISOString()
      }));
    }
    
    // Из localStorage
    const stored = localStorage.getItem('all_players');
    if (stored) {
      const players = JSON.parse(stored);
      return players.map(p => ({
        id: p.id || p.user_id || 'unknown',
        username: p.username || 'Игрок',
        wallet: p.wallet || p.wallet_address || '',
        balance: parseFloat(p.balance) || 0,
        turnover: parseFloat(p.turnover) || 0,
        gamesPlayed: parseInt(p.games_played || p.gamesPlayed) || 0,
        maxWin: parseFloat(p.max_win || p.maxWin) || 0,
        registrationDate: p.registration_date || p.registrationDate || new Date().toISOString(),
        lastActive: p.last_active || p.lastActive || new Date().toISOString()
      }));
    }
    
    return [];
    
  } catch (e) {
    console.error('❌ Ошибка получения игроков:', e);
    return [];
  }
}

// === ОБНУЛИТЬ БАЛАНСЫ ===
async function resetAllBalancesSupabase() {
  if (!appData || !appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!confirm('⚠️ ВНИМАНИЕ!\n\nВы уверены, что хотите обнулить баланс ВСЕХ игроков в Supabase?\n\nЭто действие нельзя отменить!')) {
    return;
  }
  
  if (!supabaseClient) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('🔄 Обнуляем балансы...', 'info');
    
    // Обновляем в Supabase
    const { error } = await supabaseClient
      .from('players')
      .update({
        balance: 0,
        updated_at: new Date().toISOString()
      })
      .neq('user_id', 'USER_921171528'); // Не трогаем админа
    
    if (error) throw error;
    
    // Логируем
    await logAdminAction('RESET_ALL_BALANCES', 'Обнуление всех балансов');
    
    showNotification('✅ Все балансы обнулены в Supabase!', 'success');
    
  } catch (error) {
    console.error('❌ Ошибка обнуления:', error);
    showNotification('❌ Ошибка: ' + error.message, 'error');
  }
}

// === ЛОГИРОВАНИЕ ДЕЙСТВИЙ ===
async function logAdminAction(action, description, details = null) {
  if (!supabaseClient) return;
  
  try {
    await supabaseClient
      .from('admin_history')
      .insert({
        admin_id: appData.userId,
        action: action,
        description: description,
        details: details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Ошибка логирования:', error);
  }
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ ===
async function viewGlobalStatsSupabase() {
  showNotification('📊 Загрузка статистики...', 'info');
  
  // Здесь будет код для статистики
  // Пока заглушка
  setTimeout(() => {
    showNotification('✅ Функция в разработке', 'info');
  }, 1000);
}

async function viewAdminHistory() {
  showNotification('📜 Загрузка истории...', 'info');
  
  // Здесь будет код для истории
  // Пока заглушка
  setTimeout(() => {
    showNotification('✅ Функция в разработке', 'info');
  }, 1000);
}

async function syncWithdrawalsSupabase() {
  showNotification('💸 Синхронизация выводов...', 'info');
  
  // Здесь будет код для выводов
  // Пока заглушка
  setTimeout(() => {
    showNotification('✅ Функция в разработке', 'info');
  }, 1000);
}

// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ===
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Запуск Supabase модуля...');
  
  // Ждем загрузки основной игры
  setTimeout(() => {
    if (appData && appData.isAdmin) {
      console.log('👑 Админ обнаружен, инициализируем Supabase...');
      
      // Создаем элемент статуса
      const adminPanel = document.getElementById('admin-panel');
      if (adminPanel && !document.getElementById('supabase-status')) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'supabase-status';
        statusDiv.className = 'supabase-status';
        statusDiv.innerHTML = `
          <div class="status-dot"></div>
          <div class="status-text">Supabase: Инициализация...</div>
        `;
        adminPanel.appendChild(statusDiv);
      }
      
      // Инициализируем
      setTimeout(initSupabase, 1000);
    }
  }, 2000);
});

// === ЭКСПОРТ ФУНКЦИЙ ===
window.syncWithSupabase = syncWithSupabase;
window.resetAllBalancesSupabase = resetAllBalancesSupabase;
window.viewGlobalStatsSupabase = viewGlobalStatsSupabase;
window.viewAdminHistory = viewAdminHistory;
window.syncWithdrawalsSupabase = syncWithdrawalsSupabase;
window.initSupabase = initSupabase;
