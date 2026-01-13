// === CONFIGURATION ===
const SUPABASE_CONFIG = {
  url: 'https://cbuhxqcnummijqdddizy.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidWh4cWNudW1taWpxZGRkaXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjE0NjEsImV4cCI6MjA4Mzg5NzQ2MX0.PCQ6wE9R9XP55MnNTDvrEQ-3BsMXFIP66MkI1FE1k0s'
};

let supabaseClient = null;

// === ИНИЦИАЛИЗАЦИЯ ===
function initSupabase() {
  console.log('🔄 Инициализация Supabase...');
  
  // Проверяем, есть ли URL и ключ
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    console.error('❌ Не указаны URL или ключ Supabase!');
    updateSupabaseStatus('error');
    return false;
  }
  
  // Проверяем библиотеку
  if (typeof window.supabase === 'undefined') {
    console.warn('⚠️ Библиотека Supabase не загружена, загружаем...');
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
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-admin-panel'
          }
        }
      }
    );
    
    console.log('✅ Supabase клиент создан');
    console.log('📋 URL:', SUPABASE_CONFIG.url);
    
    // Тест подключения
    testConnection();
    
    // Обновляем статус
    updateSupabaseStatus('connected');
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка создания клиента:', error);
    console.error('Проверьте URL и ключ в конфигурации');
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
    setTimeout(() => {
      if (!initSupabase()) {
        console.error('❌ Не удалось инициализировать после загрузки библиотеки');
      }
    }, 300);
  };
  script.onerror = function() {
    console.error('❌ Ошибка загрузки библиотеки Supabase');
    updateSupabaseStatus('error');
  };
  
  document.head.appendChild(script);
}

// === ТЕСТ ПОДКЛЮЧЕНИЯ ===
async function testConnection() {
  if (!supabaseClient) {
    console.warn('⚠️ Клиент Supabase не создан для теста');
    return;
  }
  
  try {
    console.log('🔍 Тестируем подключение к Supabase...');
    
    // Способ 1: Простой пинг к REST API
    const pingResponse = await fetch(SUPABASE_CONFIG.url + '/rest/v1/', {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    
    if (!pingResponse.ok) {
      console.error('❌ REST API недоступен:', pingResponse.status, pingResponse.statusText);
    } else {
      console.log('✅ REST API доступен');
    }
    
    // Способ 2: Проверка через таблицу players
    const { data, error } = await supabaseClient
      .from('players')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (error) {
      // Анализируем ошибку
      if (error.message.includes('relation "players" does not exist')) {
        console.warn('⚠️ Таблица players не существует, но подключение работает');
        console.log('✅ Подключение к Supabase успешно');
      } else if (error.message.includes('JWT')) {
        console.error('❌ Ошибка аутентификации (неверный ключ)');
        throw new Error('Неверный API ключ');
      } else if (error.message.includes('failed to fetch')) {
        console.error('❌ Сетевая ошибка или неверный URL');
        throw new Error('Сетевая ошибка. Проверьте URL: ' + SUPABASE_CONFIG.url);
      } else {
        console.warn('⚠️ Ошибка теста:', error.message);
        console.log('✅ Подключение в целом работает');
      }
    } else {
      console.log('✅ Подключение к Supabase успешно');
      console.log('📊 Таблица players доступна, записей:', data);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка подключения:', error.message);
    
    // Детальный анализ
    console.error('🔧 Диагностика:');
    console.error('- URL:', SUPABASE_CONFIG.url);
    console.error('- Ключ:', SUPABASE_CONFIG.anonKey.substring(0, 20) + '...');
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.error('🔧 Возможные причины:');
      console.error('1. Проект cbuhxqcnummijqdddizy не существует или удален');
      console.error('2. Проект приостановлен (проверьте Dashboard)');
      console.error('3. Проблемы с сетью/CORS');
      console.error('4. Блокировка браузером');
      
      // Тест прямого доступа
      console.log('🔍 Тестируем прямой доступ...');
      try {
        const testUrl = SUPABASE_CONFIG.url.replace('supabase.co', 'supabase.co/rest/v1/');
        console.log('Тестовый URL:', testUrl);
      } catch(e) {
        console.error('Ошибка теста:', e);
      }
    }
    
    updateSupabaseStatus('error');
  }
}

// === ОБНОВЛЕНИЕ СТАТУСА ===
function updateSupabaseStatus(status) {
  const statusDiv = document.getElementById('supabase-status');
  if (!statusDiv) {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
      const newStatus = document.createElement('div');
      newStatus.id = 'supabase-status';
      newStatus.className = 'supabase-status';
      adminPanel.appendChild(newStatus);
    } else {
      console.warn('⚠️ Не найден admin-panel для отображения статуса');
      return;
    }
  }
  
  const element = document.getElementById('supabase-status');
  if (!element) return;
  
  let html = '';
  
  switch(status) {
    case 'connected':
      html = `
        <div class="status-dot connected" style="background: #10b981;"></div>
        <div class="status-text" style="color: #10b981;">
          <strong>Supabase: Подключено ✅</strong><br>
          <small>cbuhxqcnummijqdddizy.supabase.co</small>
        </div>
      `;
      break;
    case 'error':
      html = `
        <div class="status-dot error" style="background: #ef4444;"></div>
        <div class="status-text" style="color: #ef4444;">
          <strong>Supabase: Ошибка подключения ❌</strong><br>
          <small>Проект: cbuhxqcnummijqdddizy</small>
        </div>
        <button class="retry-btn" style="margin-left: 10px; padding: 2px 8px; font-size: 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Повторить
        </button>
      `;
      break;
    default:
      html = `
        <div class="status-dot" style="background: #f59e0b;"></div>
        <div class="status-text" style="color: #f59e0b;">
          <strong>Supabase: Инициализация...</strong><br>
          <small>cbuhxqcnummijqdddizy.supabase.co</small>
        </div>
      `;
  }
  
  element.innerHTML = html;
  
  // Добавляем обработчик для кнопки повтора
  const retryBtn = element.querySelector('.retry-btn');
  if (retryBtn) {
    retryBtn.onclick = function() {
      console.log('🔄 Ручная повторная инициализация...');
      initSupabase();
    };
  }
  
  // Добавляем стили если их нет
  if (!document.querySelector('#supabase-styles')) {
    const style = document.createElement('style');
    style.id = 'supabase-styles';
    style.textContent = `
      .supabase-status {
        padding: 8px 12px;
        background: rgba(0,0,0,0.05);
        border-radius: 6px;
        margin: 10px 0;
        display: flex;
        align-items: center;
        font-family: monospace;
        border-left: 4px solid #3b82f6;
      }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 10px;
      }
      .status-text {
        font-size: 14px;
        flex-grow: 1;
      }
      .status-text small {
        font-size: 11px;
        opacity: 0.7;
      }
      .retry-btn:hover {
        background: #2563eb !important;
      }
    `;
    document.head.appendChild(style);
  }
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
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  try {
    showNotification('🔄 Начинаем синхронизацию...', 'info');
    
    // Получаем локальных игроков
    const localPlayers = getAllLocalPlayers();
    
    if (localPlayers.length === 0) {
      showNotification('❌ Нет игроков для синхронизации', 'error');
      return;
    }
    
    console.log(`📊 Найдено ${localPlayers.length} игроков для синхронизации`);
    
    // Загружаем в Supabase
    let successCount = 0;
    let errorCount = 0;
    
    for (const player of localPlayers) {
      try {
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
          errorCount++;
        } else {
          successCount++;
        }
      } catch (e) {
        console.error(`❌ Исключение при обработке игрока ${player.id}:`, e);
        errorCount++;
      }
    }
    
    const message = `✅ Синхронизировано ${successCount} из ${localPlayers.length} игроков!`;
    if (errorCount > 0) {
      showNotification(message + ` Ошибок: ${errorCount}`, 'warning');
    } else {
      showNotification(message, 'success');
    }
    
    // Логируем действие
    await logAdminAction('SYNC_PLAYERS', `Синхронизировано ${successCount} игроков`, {
      total: localPlayers.length,
      success: successCount,
      errors: errorCount
    });
    
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
    
    console.warn('⚠️ Не найдено игроков для синхронизации');
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
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    const { error } = await supabaseClient
      .from('admin_history')
      .insert({
        admin_id: appData.userId,
        action: action,
        description: description,
        details: details,
        timestamp: new Date().toISOString()
      });
    
    if (error) {
      console.warn('⚠️ Ошибка логирования в admin_history:', error);
      
      if (error.message.includes('relation "admin_history" does not exist')) {
        console.log('📝 Таблица admin_history не существует, пропускаем логирование');
      }
    } else {
      console.log('📝 Действие залогировано:', action);
    }
  } catch (error) {
    console.error('❌ Ошибка логирования:', error);
  }
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ ===
async function viewGlobalStatsSupabase() {
  showNotification('📊 Загрузка статистики...', 'info');
  
  if (!supabaseClient) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('players')
      .select('*');
    
    if (error) throw error;
    
    const stats = {
      totalPlayers: data.length,
      totalBalance: data.reduce((sum, p) => sum + (p.balance || 0), 0),
      avgBalance: data.length > 0 ? data.reduce((sum, p) => sum + (p.balance || 0), 0) / data.length : 0,
      totalTurnover: data.reduce((sum, p) => sum + (p.turnover || 0), 0),
      totalGames: data.reduce((sum, p) => sum + (p.games_played || 0), 0)
    };
    
    showNotification(`
      📊 Статистика из Supabase:
      👥 Игроков: ${stats.totalPlayers}
      💰 Общий баланс: ${stats.totalBalance.toFixed(2)}
      📈 Средний баланс: ${stats.avgBalance.toFixed(2)}
      🔄 Общий оборот: ${stats.totalTurnover.toFixed(2)}
      🎮 Всего игр: ${stats.totalGames}
    `, 'info');
    
  } catch (error) {
    console.error('❌ Ошибка загрузки статистики:', error);
    showNotification('❌ Ошибка загрузки статистики: ' + error.message, 'error');
  }
}

async function viewAdminHistory() {
  showNotification('📜 Загрузка истории...', 'info');
  
  if (!supabaseClient) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('admin_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (error) {
      if (error.message.includes('relation "admin_history" does not exist')) {
        showNotification('📝 Таблица admin_history не существует', 'info');
        return;
      }
      throw error;
    }
    
    if (data.length === 0) {
      showNotification('📭 История действий пуста', 'info');
      return;
    }
    
    let historyText = '📜 История действий:\n\n';
    data.forEach((item, index) => {
      const date = new Date(item.timestamp).toLocaleString();
      historyText += `${index + 1}. ${date} - ${item.action}\n   ${item.description}\n\n`;
    });
    
    // Показываем в alert или создаем модальное окно
    alert(historyText);
    
  } catch (error) {
    console.error('❌ Ошибка загрузки истории:', error);
    showNotification('❌ Ошибка загрузки истории: ' + error.message, 'error');
  }
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
          <div class="status-dot" style="background: #f59e0b;"></div>
          <div class="status-text" style="color: #f59e0b;">
            <strong>Supabase: Инициализация...</strong><br>
            <small>cbuhxqcnummijqdddizy.supabase.co</small>
          </div>
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
