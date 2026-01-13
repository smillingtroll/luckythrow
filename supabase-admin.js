// === CONFIGURATION - ВАЖНО: ЗАМЕНИТЕ ЭТИ ДАННЫЕ НА СВОИ ===
const SUPABASE_CONFIG = {
  url: 'https://cbuhxqcnummijqdddizy.supabase.co', // Ваш URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidWh4cWNudW1taWpxZGRkaXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjE0NjEsImV4cCI6MjA4Mzg5NzQ2MX0.PCQ6wE9R9XP55MnNTDvrEQ-3BsMXFIP66MkI1FE1k0s' // Ваш anon key
};

// === SUPABASE CLIENT ===
let supabase = null;

// === INITIALIZE SUPABASE ===
function initSupabase() {
  try {
    if (window.supabase) {
      supabase = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
      );
      console.log('✅ Supabase initialized successfully');
      updateSupabaseStatus('connected');
      return true;
    } else {
      console.error('❌ Supabase library not loaded');
      updateSupabaseStatus('error');
      return false;
    }
  } catch (error) {
    console.error('❌ Error initializing Supabase:', error);
    updateSupabaseStatus('error');
    return false;
  }
}

// === UPDATE STATUS DISPLAY ===
function updateSupabaseStatus(status) {
  const statusDiv = document.getElementById('supabase-status');
  if (!statusDiv) return;
  
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
        <div class="status-text">Supabase: Не инициализировано</div>
      `;
  }
  
  statusDiv.innerHTML = html;
}

// === SYNCHRONIZE PLAYERS WITH SUPABASE ===
async function syncWithSupabase() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!supabase) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('🔄 Начинаем синхронизацию...', 'info');
    
    // 1. Получаем всех игроков из локального хранилища
    const localPlayers = getAllLocalPlayers();
    
    // 2. Загружаем в Supabase
    for (const player of localPlayers) {
      const { error } = await supabase
        .from('players')
        .upsert({
          user_id: player.id,
          username: player.username,
          wallet_address: player.wallet,
          balance: player.balance,
          turnover: player.turnover,
          games_played: player.gamesPlayed,
          max_win: player.maxWin,
          registration_date: player.registrationDate,
          last_active: player.lastActive,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.error(`❌ Ошибка синхронизации игрока ${player.id}:`, error);
      }
    }
    
    showNotification(`✅ Синхронизировано ${localPlayers.length} игроков!`, 'success');
    
    // 3. Обновляем глобальную статистику
    await updateGlobalStats();
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    showNotification('❌ Ошибка синхронизации: ' + error.message, 'error');
  }
}

// === GET ALL LOCAL PLAYERS ===
function getAllLocalPlayers() {
  let players = [];
  
  try {
    // Из глобальной переменной allPlayers
    if (window.allPlayers && Array.isArray(allPlayers)) {
      players = allPlayers;
    }
    
    // Или из localStorage
    if (players.length === 0) {
      const storedPlayers = localStorage.getItem('all_players');
      if (storedPlayers) {
        players = JSON.parse(storedPlayers);
      }
    }
  } catch (e) {
    console.error('❌ Ошибка получения локальных игроков:', e);
  }
  
  return players.map(player => ({
    id: player.id || 'unknown',
    username: player.username || 'Игрок',
    wallet: player.wallet || '',
    balance: parseFloat(player.balance) || 0,
    turnover: parseFloat(player.turnover) || 0,
    gamesPlayed: parseInt(player.gamesPlayed) || 0,
    maxWin: parseFloat(player.maxWin) || 0,
    registrationDate: player.registrationDate || new Date().toISOString(),
    lastActive: player.lastActive || new Date().toISOString()
  }));
}

// === RESET ALL BALANCES IN SUPABASE ===
async function resetAllBalancesSupabase() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!confirm('⚠️ ВНИМАНИЕ!\n\nВы уверены, что хотите обнулить баланс ВСЕХ игроков в Supabase?\n\nЭто действие нельзя отменить!')) {
    return;
  }
  
  if (!supabase) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('🔄 Обнуляем балансы...', 'info');
    
    // 1. Обновляем всех игроков в Supabase
    const { error: updateError } = await supabase
      .from('players')
      .update({
        balance: 0,
        turnover: 0,
        max_win: 0,
        updated_at: new Date().toISOString()
      })
      .neq('user_id', 'USER_921171528'); // Не трогаем админа
    
    if (updateError) throw updateError;
    
    // 2. Записываем действие в историю
    await logAdminAction(
      'RESET_ALL_BALANCES',
      'Обнуление всех балансов',
      { reset_type: 'all_balances' }
    );
    
    // 3. Обновляем локальную базу (кроме админа)
    if (window.allPlayers && Array.isArray(allPlayers)) {
      allPlayers.forEach(player => {
        if (player.id !== 'USER_921171528' && player.id !== appData.userId) {
          player.balance = 0;
          player.turnover = 0;
          player.maxWin = 0;
        }
      });
      localStorage.setItem('all_players', JSON.stringify(allPlayers));
    }
    
    // 4. Обновляем текущего пользователя (если не админ)
    if (appData.userId !== 'USER_921171528') {
      appData.balance = 0;
      appData.stats.frozenBalance = 0;
      appData.stats.totalTurnover = 0;
      appData.stats.maxWin = 0;
      localStorage.setItem('balance', '0');
      localStorage.setItem('frozen_balance', '0');
      localStorage.setItem('user_stats', JSON.stringify(appData.stats));
      updateUI();
      updateStats();
    }
    
    showNotification('✅ Все балансы обнулены в Supabase!', 'success');
    
  } catch (error) {
    console.error('❌ Ошибка обнуления балансов:', error);
    showNotification('❌ Ошибка: ' + error.message, 'error');
  }
}

// === VIEW GLOBAL STATISTICS ===
async function viewGlobalStatsSupabase() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!supabase) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('📊 Загружаем статистику...', 'info');
    
    // 1. Получаем общую статистику
    const { data: stats, error } = await supabase
      .from('global_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    // 2. Если нет статистики, создаем текущую
    let globalStats = stats || await calculateAndSaveGlobalStats();
    
    // 3. Показываем модальное окно
    showGlobalStatsModal(globalStats);
    
  } catch (error) {
    console.error('❌ Ошибка загрузки статистики:', error);
    showNotification('❌ Ошибка: ' + error.message, 'error');
  }
}

// === CALCULATE AND SAVE GLOBAL STATS ===
async function calculateAndSaveGlobalStats() {
  if (!supabase) return null;
  
  try {
    // Получаем всех игроков
    const { data: players, error } = await supabase
      .from('players')
      .select('balance, turnover, games_played, max_win');
    
    if (error) throw error;
    
    // Рассчитываем статистику
    const totalPlayers = players.length;
    const totalBalance = players.reduce((sum, p) => sum + (p.balance || 0), 0);
    const totalTurnover = players.reduce((sum, p) => sum + (p.turnover || 0), 0);
    const totalGames = players.reduce((sum, p) => sum + (p.games_played || 0), 0);
    const maxWin = Math.max(...players.map(p => p.max_win || 0));
    
    const globalStats = {
      date: new Date().toISOString().split('T')[0],
      total_players: totalPlayers,
      active_players: players.filter(p => {
        const lastActive = new Date(p.last_active || 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastActive > weekAgo;
      }).length,
      total_balance: totalBalance,
      total_turnover: totalTurnover,
      total_games: totalGames,
      max_win: maxWin,
      avg_balance: totalPlayers > 0 ? totalBalance / totalPlayers : 0,
      avg_turnover: totalPlayers > 0 ? totalTurnover / totalPlayers : 0
    };
    
    // Сохраняем в базу
    const { error: saveError } = await supabase
      .from('global_stats')
      .upsert(globalStats);
    
    if (saveError) throw saveError;
    
    return globalStats;
    
  } catch (error) {
    console.error('❌ Ошибка расчета статистики:', error);
    return null;
  }
}

// === SHOW GLOBAL STATS MODAL ===
function showGlobalStatsModal(stats) {
  const modalHTML = `
    <div class="modal-overlay active" id="global-stats-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>🌍 Глобальная статистика</h3>
          <button class="modal-close" onclick="document.getElementById('global-stats-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${stats.total_players || 0}</div>
              <div class="stat-label">Всего игроков</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.active_players || 0}</div>
              <div class="stat-label">Активных</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(stats.total_balance || 0).toFixed(2)}</div>
              <div class="stat-label">Общий баланс (TON)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(stats.total_turnover || 0).toFixed(2)}</div>
              <div class="stat-label">Общий оборот (TON)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.total_games || 0}</div>
              <div class="stat-label">Сыграно игр</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(stats.max_win || 0).toFixed(2)}</div>
              <div class="stat-label">Макс. выигрыш (TON)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(stats.avg_balance || 0).toFixed(2)}</div>
              <div class="stat-label">Средний баланс</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(stats.avg_turnover || 0).toFixed(2)}</div>
              <div class="stat-label">Средний оборот</div>
            </div>
          </div>
          <div class="stats-date">
            Обновлено: ${new Date().toLocaleDateString()}
          </div>
          <button class="modal-btn" onclick="refreshGlobalStats()">🔄 Обновить</button>
        </div>
      </div>
    </div>
  `;
  
  // Добавляем стили
  const style = document.createElement('style');
  style.textContent = `
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      border: 1px solid rgba(0, 255, 136, 0.1);
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-green);
      margin-bottom: 8px;
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .stats-date {
      text-align: center;
      margin: 15px 0;
      color: var(--text-secondary);
      font-size: 14px;
    }
  `;
  
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// === REFRESH GLOBAL STATS ===
async function refreshGlobalStats() {
  const modal = document.getElementById('global-stats-modal');
  if (modal) modal.remove();
  
  await viewGlobalStatsSupabase();
}

// === VIEW ADMIN HISTORY ===
async function viewAdminHistory() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!supabase) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('📜 Загружаем историю...', 'info');
    
    const { data: history, error } = await supabase
      .from('admin_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    showAdminHistoryModal(history || []);
    
  } catch (error) {
    console.error('❌ Ошибка загрузки истории:', error);
    showNotification('❌ Ошибка: ' + error.message, 'error');
  }
}

// === SHOW ADMIN HISTORY MODAL ===
function showAdminHistoryModal(history) {
  const modalHTML = `
    <div class="modal-overlay active" id="admin-history-modal">
      <div class="modal-content wide-modal">
        <div class="modal-header">
          <h3>📜 История действий админа</h3>
          <button class="modal-close" onclick="document.getElementById('admin-history-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="search-container">
            <input type="text" id="history-search" class="search-input" placeholder="Поиск по действию или админу...">
          </div>
          <div class="history-list" id="history-list">
            ${history.length === 0 ? 
              '<div class="player-item">История действий пуста</div>' : 
              history.map(item => `
                <div class="history-item">
                  <div class="history-header">
                    <span class="history-action">${getActionDescription(item.action)}</span>
                    <span class="history-time">${new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="history-admin">Админ: ${item.admin_id}</div>
                  ${item.details ? `<div class="history-details">${JSON.stringify(item.details)}</div>` : ''}
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Добавляем стили
  const style = document.createElement('style');
  style.textContent = `
    .history-item {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .history-action {
      font-weight: 600;
      color: var(--primary-green);
      font-size: 14px;
    }
    
    .history-time {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .history-admin {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .history-details {
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(0, 0, 0, 0.3);
      padding: 8px;
      border-radius: 6px;
      font-family: monospace;
      word-break: break-all;
    }
  `;
  
  document.head.appendChild(style);
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Добавляем поиск
  document.getElementById('history-search').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.history-item');
    
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
  });
}

// === GET ACTION DESCRIPTION ===
function getActionDescription(action) {
  const actions = {
    'RESET_ALL_BALANCES': 'Обнуление всех балансов',
    'SYNC_PLAYERS': 'Синхронизация игроков',
    'CREATE_PROMO': 'Создание промокода',
    'APPROVE_WITHDRAWAL': 'Одобрение вывода',
    'REJECT_WITHDRAWAL': 'Отклонение вывода',
    'UPDATE_ODDS': 'Обновление шансов',
    'TOGGLE_MAINTENANCE': 'Переключение режима техработ'
  };
  
  return actions[action] || action;
}

// === LOG ADMIN ACTION ===
async function logAdminAction(action, description, details = null) {
  if (!supabase) return;
  
  try {
    await supabase
      .from('admin_history')
      .insert({
        admin_id: appData.userId,
        action: action,
        description: description,
        details: details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Ошибка записи истории:', error);
  }
}

// === SYNC WITHDRAWALS WITH SUPABASE ===
async function syncWithdrawalsSupabase() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!supabase) {
    if (!initSupabase()) {
      showNotification('❌ Supabase не инициализирован', 'error');
      return;
    }
  }
  
  try {
    showNotification('💸 Синхронизируем выводы...', 'info');
    
    // Получаем локальные запросы
    const localRequests = appData.withdrawRequests || [];
    
    // Синхронизируем с Supabase
    for (const request of localRequests) {
      const { error } = await supabase
        .from('withdraw_requests')
        .upsert({
          user_id: request.id,
          username: request.username,
          amount: request.amount,
          wallet_address: request.walletAddress,
          status: request.status || 'pending',
          created_at: request.date,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,created_at'
        });
      
      if (error) {
        console.error('❌ Ошибка синхронизации вывода:', error);
      }
    }
    
    showNotification(`✅ Синхронизировано ${localRequests.length} запросов на вывод!`, 'success');
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации выводов:', error);
    showNotification('❌ Ошибка: ' + error.message, 'error');
  }
}

// === UPDATE GLOBAL STATS ===
async function updateGlobalStats() {
  if (!supabase) return;
  
  try {
    await calculateAndSaveGlobalStats();
  } catch (error) {
    console.error('❌ Ошибка обновления глобальной статистики:', error);
  }
}

// === INITIALIZE ON LOAD ===
document.addEventListener('DOMContentLoaded', function() {
  // Инициализируем Supabase с задержкой
  setTimeout(() => {
    if (appData.isAdmin) {
      initSupabase();
      
      // Добавляем статус Supabase в админ-панель
      const adminPanel = document.getElementById('admin-panel');
      if (adminPanel) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'supabase-status';
        statusDiv.className = 'supabase-status';
        adminPanel.appendChild(statusDiv);
        
        updateSupabaseStatus('init');
      }
    }
  }, 1000);
});

// === MAKE FUNCTIONS GLOBALLY AVAILABLE ===
window.syncWithSupabase = syncWithSupabase;
window.resetAllBalancesSupabase = resetAllBalancesSupabase;
window.viewGlobalStatsSupabase = viewGlobalStatsSupabase;
window.viewAdminHistory = viewAdminHistory;
window.syncWithdrawalsSupabase = syncWithdrawalsSupabase;
window.refreshGlobalStats = refreshGlobalStats;
