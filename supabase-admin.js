// supabase-admin.js - Централизованное управление для админа

// ========== КОНФИГУРАЦИЯ SUPABASE ==========
// ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА СВОИ С SUPABASE.COM
const SUPABASE_CONFIG = {
  url: 'https://your-project-id.supabase.co', // https://cbuhxqcnummijqdddizy.supabase.co 
  anonKey: 'your-anon-key-here' // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidWh4cWNudW1taWpxZGRkaXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjE0NjEsImV4cCI6MjA4Mzg5NzQ2MX0.PCQ6wE9R9XP55MnNTDvrEQ-3BsMXFIP66MkI1FE1k0s
};

// Инициализация клиента Supabase
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url, 
  SUPABASE_CONFIG.anonKey
);

// ========== КЛАСС УПРАВЛЕНИЯ SUPABASE ==========
class SupabaseAdmin {
  constructor() {
    this.initialized = false;
    this.adminUserId = null;
  }

  // Инициализация для админа
  async init() {
    try {
      if (!appData.isAdmin) {
        console.log('SupabaseAdmin: Не админ, пропускаем инициализацию');
        return false;
      }

      console.log('SupabaseAdmin: Инициализация...');
      
      // Проверяем подключение
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        console.error('SupabaseAdmin: Ошибка подключения:', error);
        this.updateStatus('error', `Ошибка: ${error.message}`);
        return false;
      }

      // Регистрируем админа в базе
      await this.registerAdmin();
      
      this.initialized = true;
      this.updateStatus('connected', 'Подключено');
      console.log('SupabaseAdmin: Успешно инициализирован');
      
      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка инициализации:', error);
      this.updateStatus('error', 'Ошибка инициализации');
      return false;
    }
  }

  // Обновление статуса в интерфейсе
  updateStatus(status, message) {
    const statusElement = document.getElementById('supabase-status');
    if (!statusElement) return;

    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('.status-text');

    if (dot && text) {
      dot.className = 'status-dot';
      text.textContent = `Supabase: ${message}`;

      if (status === 'connected') {
        dot.classList.add('connected');
      } else if (status === 'error') {
        dot.classList.add('error');
      }
    }
  }

  // Регистрация админа в базе
  async registerAdmin() {
    try {
      const telegramId = appData.telegramUser?.id || 
                        (appData.userId && appData.userId.includes('USER_') 
                          ? parseInt(appData.userId.replace('USER_', '')) 
                          : 0);

      const adminData = {
        telegram_id: telegramId,
        username: appData.username || 'Администратор',
        wallet_address: appData.walletAddress || null,
        balance: appData.balance || 0,
        games_played: appData.stats.gamesPlayed || 0,
        total_turnover: appData.stats.totalTurnover || 0,
        max_win: appData.stats.maxWin || 0,
        frozen_balance: appData.stats.frozenBalance || 0,
        is_admin: true,
        last_active: new Date().toISOString(),
        registration_date: localStorage.getItem('reg_date') || new Date().toISOString()
      };

      // Используем upsert (обновить или создать)
      const { data, error } = await supabase
        .from('users')
        .upsert(adminData, {
          onConflict: 'telegram_id'
        })
        .select()
        .single();

      if (error) {
        console.error('SupabaseAdmin: Ошибка регистрации админа:', error);
        return null;
      }

      this.adminUserId = data.id;
      console.log('SupabaseAdmin: Админ зарегистрирован с ID:', data.id);
      return data.id;
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка регистрации:', error);
      return null;
    }
  }

  // ========== ОСНОВНЫЕ АДМИН-ФУНКЦИИ ==========

  // 1. Синхронизация всех игроков с Supabase
  async syncAllPlayers() {
    if (!appData.isAdmin) {
      showNotification('Недостаточно прав!', 'error');
      return false;
    }

    showNotification('🔄 Синхронизация игроков...', 'info');

    try {
      // Получаем всех игроков из localStorage
      const allPlayers = JSON.parse(localStorage.getItem('all_players') || '[]');
      
      if (allPlayers.length === 0) {
        showNotification('Нет игроков для синхронизации', 'warning');
        return false;
      }

      // Преобразуем данные для Supabase
      const playersData = allPlayers.map(player => {
        const telegramId = player.id && player.id.includes('USER_') 
          ? parseInt(player.id.replace('USER_', '')) 
          : Math.floor(Math.random() * 1000000);

        return {
          telegram_id: telegramId,
          username: player.username || `Игрок_${telegramId}`,
          wallet_address: player.wallet || null,
          balance: player.balance || 0,
          games_played: player.gamesPlayed || 0,
          total_turnover: player.turnover || 0,
          max_win: player.maxWin || 0,
          frozen_balance: player.frozenBalance || 0,
          last_active: player.lastActive || new Date().toISOString(),
          registration_date: player.registrationDate || new Date().toISOString(),
          is_admin: player.id === 'USER_921171528' || false
        };
      });

      // Отправляем в Supabase
      const { data, error } = await supabase
        .from('users')
        .upsert(playersData, {
          onConflict: 'telegram_id'
        });

      if (error) {
        console.error('SupabaseAdmin: Ошибка синхронизации игроков:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
        return false;
      }

      // Логируем действие
      await this.logAdminAction(
        'sync_players',
        `Синхронизировано ${playersData.length} игроков`,
        playersData.length
      );

      showNotification(`✅ Успешно синхронизировано ${playersData.length} игроков!`, 'success');
      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Неожиданная ошибка:', error);
      showNotification('❌ Ошибка синхронизации', 'error');
      return false;
    }
  }

  // 2. Обнуление баланса всем игрокам (централизованное)
  async resetAllBalances() {
    if (!appData.isAdmin) {
      showNotification('Недостаточно прав!', 'error');
      return false;
    }

    // Подтверждение действия
    if (!confirm(`⚠️ ЦЕНТРАЛИЗОВАННОЕ ОБНУЛЕНИЕ БАЛАНСОВ\n\nЭта команда:
1. Обнулит балансы всех игроков в Supabase
2. Запишет действие в историю
3. Установит флаг для синхронизации с клиентами

Продолжить?`)) {
      return false;
    }

    showNotification('🔄 Обнуление балансов...', 'info');

    try {
      // Получаем текущих пользователей из Supabase
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, telegram_id, username, balance')
        .neq('is_admin', true);

      if (fetchError) {
        console.error('SupabaseAdmin: Ошибка получения пользователей:', fetchError);
        showNotification('❌ Ошибка получения данных', 'error');
        return false;
      }

      if (!users || users.length === 0) {
        showNotification('Нет игроков для обнуления', 'warning');
        return false;
      }

      // Подготавливаем обновление
      const updates = users.map(user => ({
        id: user.id,
        balance: 0,
        frozen_balance: 0
      }));

      // Выполняем обновление
      const { data, error } = await supabase
        .from('users')
        .upsert(updates);

      if (error) {
        console.error('SupabaseAdmin: Ошибка обнуления балансов:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
        return false;
      }

      // Логируем действие
      await this.logAdminAction(
        'reset_all_balances',
        `Обнулены балансы ${users.length} игроков. Было обнулено: ${users.reduce((sum, u) => sum + (u.balance || 0), 0)} TON`,
        users.length
      );

      // Также обнуляем локально (в браузере админа)
      this.resetLocalBalances();

      showNotification(`✅ Обнулены балансы ${users.length} игроков!`, 'success');
      
      // Показываем отчет
      this.showResetReport(users);
      
      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Неожиданная ошибка:', error);
      showNotification('❌ Ошибка обнуления', 'error');
      return false;
    }
  }

  // 3. Обнуление балансов локально (в браузере админа)
  resetLocalBalances() {
    // Обновляем базу игроков в localStorage
    const allPlayers = JSON.parse(localStorage.getItem('all_players') || '[]');
    
    allPlayers.forEach(player => {
      // Не обнуляем админа
      if (player.id !== 'USER_921171528') {
        player.balance = 0;
        player.frozenBalance = 0;
      }
    });
    
    localStorage.setItem('all_players', JSON.stringify(allPlayers));
    
    // Обнуляем свой баланс (если не админ)
    if (appData.userId !== 'USER_921171528') {
      appData.balance = 0;
      appData.stats.frozenBalance = 0;
      localStorage.setItem('balance', '0');
      localStorage.setItem('frozen_balance', '0');
      updateUI();
    }
    
    console.log('SupabaseAdmin: Локальные балансы обнулены');
  }

  // 4. Показ отчета об обнулении
  showResetReport(users) {
    const totalReset = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📊 Отчет об обнулении балансов</h3>
          <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="report-summary">
            <div class="report-item">
              <span>Обнулено игроков:</span>
              <strong>${users.length}</strong>
            </div>
            <div class="report-item">
              <span>Общая сумма:</span>
              <strong class="ton-amount">${totalReset.toFixed(2)} TON</strong>
            </div>
            <div class="report-item">
              <span>Средний баланс был:</span>
              <strong>${(totalReset / users.length).toFixed(2)} TON</strong>
            </div>
          </div>
          
          <div class="players-list-container">
            <h4>Игроки с наибольшими балансами:</h4>
            <div class="players-list">
              ${users
                .sort((a, b) => (b.balance || 0) - (a.balance || 0))
                .slice(0, 10)
                .map(user => `
                  <div class="player-report-item">
                    <span class="player-name">${user.username || 'Без имени'}</span>
                    <span class="player-balance ${user.balance > 0 ? 'positive' : ''}">
                      ${(user.balance || 0).toFixed(2)} TON
                    </span>
                  </div>
                `).join('')}
            </div>
          </div>
          
          <div class="report-actions">
            <button class="modal-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Закрыть</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 5. Логирование действий админа
  async logAdminAction(actionType, description, affectedUsers = 0) {
    try {
      const { error } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: this.adminUserId,
          action_type: actionType,
          description: description,
          affected_users: affectedUsers,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('SupabaseAdmin: Ошибка логирования:', error);
        return false;
      }

      console.log(`SupabaseAdmin: Действие "${actionType}" записано`);
      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка логирования:', error);
      return false;
    }
  }

  // 6. Получение истории действий админа
  async getAdminHistory(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select(`
          *,
          admin:users(username)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('SupabaseAdmin: Ошибка получения истории:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка получения истории:', error);
      return [];
    }
  }

  // 7. Синхронизация запросов на вывод
  async syncWithdrawals() {
    try {
      const withdrawals = JSON.parse(localStorage.getItem('withdraw_requests') || '[]');
      
      if (withdrawals.length === 0) {
        showNotification('Нет запросов на вывод для синхронизации', 'info');
        return false;
      }

      const { data, error } = await supabase
        .from('withdrawals')
        .upsert(
          withdrawals.map(w => ({
            user_id: w.id,
            amount: w.amount,
            wallet_address: w.walletAddress,
            status: w.status,
            created_at: w.date,
            processed_at: w.status !== 'pending' ? new Date().toISOString() : null
          })),
          { onConflict: 'user_id,created_at' }
        );

      if (error) {
        console.error('SupabaseAdmin: Ошибка синхронизации выводов:', error);
        showNotification('❌ Ошибка синхронизации выводов', 'error');
        return false;
      }

      showNotification(`✅ Синхронизировано ${withdrawals.length} запросов на вывод`, 'success');
      await this.logAdminAction('sync_withdrawals', `Синхронизировано ${withdrawals.length} запросов на вывод`);
      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка синхронизации выводов:', error);
      showNotification('❌ Ошибка синхронизации', 'error');
      return false;
    }
  }

  // 8. Получение статистики из Supabase
  async getGlobalStats() {
    try {
      // Общая статистика
      const { data: stats, error } = await supabase
        .from('users')
        .select(`
          count,
          sum(balance),
          sum(total_turnover),
          sum(games_played),
          max(max_win)
        `)
        .single();

      if (error) {
        console.error('SupabaseAdmin: Ошибка получения статистики:', error);
        return null;
      }

      return {
        totalPlayers: stats.count || 0,
        totalBalance: stats.sum.balance || 0,
        totalTurnover: stats.sum.total_turnover || 0,
        totalGames: stats.sum.games_played || 0,
        maxWin: stats.max.max_win || 0
      };
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка получения статистики:', error);
      return null;
    }
  }

  // 9. Просмотр глобальной статистики
  async viewGlobalStats() {
    const stats = await this.getGlobalStats();
    if (!stats) {
      showNotification('Не удалось получить статистику', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🌍 Глобальная статистика игры</h3>
          <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="global-stats">
            <div class="stat-card">
              <div class="stat-value">${stats.totalPlayers}</div>
              <div class="stat-label">Всего игроков</div>
            </div>
            <div class="stat-card">
              <div class="stat-value ton-amount">${stats.totalBalance.toFixed(2)}</div>
              <div class="stat-label">Общий баланс (TON)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value ton-amount">${stats.totalTurnover.toFixed(2)}</div>
              <div class="stat-label">Общий оборот (TON)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.totalGames}</div>
              <div class="stat-label">Сыграно игр</div>
            </div>
            <div class="stat-card">
              <div class="stat-value ton-amount">${stats.maxWin.toFixed(2)}</div>
              <div class="stat-label">Макс. выигрыш (TON)</div>
            </div>
          </div>
          
          <div class="stats-actions">
            <button class="modal-btn secondary" onclick="SupabaseAdmin.refreshStats()">🔄 Обновить</button>
            <button class="modal-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Закрыть</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 10. Управление выводом средств через Supabase
  async getWithdrawalRequests(status = 'pending') {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          user:users(username, telegram_id)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('SupabaseAdmin: Ошибка получения запросов:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка получения запросов:', error);
      return [];
    }
  }

  // 11. Обновление статуса вывода
  async updateWithdrawalStatus(withdrawalId, status, adminNote = '') {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: status,
          processed_at: new Date().toISOString(),
          admin_note: adminNote
        })
        .eq('id', withdrawalId);

      if (error) {
        console.error('SupabaseAdmin: Ошибка обновления вывода:', error);
        return false;
      }

      await this.logAdminAction(
        'withdrawal_processed',
        `Вывод ${withdrawalId} изменен на статус: ${status}`
      );

      return true;
    } catch (error) {
      console.error('SupabaseAdmin: Ошибка обновления вывода:', error);
      return false;
    }
  }
}

// ========== ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР ==========
window.SupabaseAdmin = new SupabaseAdmin();

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ==========

// Функция для синхронизации игроков
window.syncWithSupabase = async function() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!window.SupabaseAdmin.initialized) {
    showNotification('Supabase не инициализирован', 'error');
    return;
  }
  
  const success = await SupabaseAdmin.syncAllPlayers();
  if (success) {
    // Обновляем список игроков, если модальное окно открыто
    if (document.getElementById('players-list-modal')?.classList.contains('active')) {
      renderPlayersList(document.getElementById('player-search')?.value || '');
    }
  }
};

// Функция для обнуления балансов через Supabase
window.resetAllBalancesSupabase = async function() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!window.SupabaseAdmin.initialized) {
    showNotification('Supabase не инициализирован', 'error');
    return;
  }
  
  await SupabaseAdmin.resetAllBalances();
};

// Функция для просмотра истории действий
window.viewAdminHistory = async function() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  const history = await SupabaseAdmin.getAdminHistory();
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-content wide-modal">
      <div class="modal-header">
        <h3>📜 История действий администратора</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="admin-history-container">
          ${history.length === 0 
            ? '<div class="no-history">Нет записей в истории</div>' 
            : history.map(action => `
                <div class="admin-history-item ${action.action_type}">
                  <div class="history-header">
                    <span class="history-type">${getActionTypeLabel(action.action_type)}</span>
                    <span class="history-date">${new Date(action.created_at).toLocaleString()}</span>
                  </div>
                  <div class="history-description">${action.description}</div>
                  ${action.affected_users > 0 
                    ? `<div class="history-affected">Затронуто игроков: <strong>${action.affected_users}</strong></div>` 
                    : ''}
                  ${action.admin?.username 
                    ? `<div class="history-admin">Админ: ${action.admin.username}</div>` 
                    : ''}
                </div>
              `).join('')}
        </div>
        <div class="history-actions">
          <button class="modal-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Закрыть</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Вспомогательная функция для перевода типов действий
  function getActionTypeLabel(type) {
    const labels = {
      'sync_players': '🔄 Синхронизация игроков',
      'reset_all_balances': '💰 Обнуление балансов',
      'sync_withdrawals': '💸 Синхронизация выводов',
      'withdrawal_processed': '✅ Обработка вывода',
      'create_promo': '🎁 Создание промокода',
      'update_odds': '🎲 Изменение шансов',
      'maintenance_toggle': '🔧 Тех. работы'
    };
    return labels[type] || type;
  }
};

// Функция для просмотра глобальной статистики
window.viewGlobalStatsSupabase = async function() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!window.SupabaseAdmin.initialized) {
    showNotification('Supabase не инициализирован', 'error');
    return;
  }
  
  await SupabaseAdmin.viewGlobalStats();
};

// Функция для синхронизации выводов
window.syncWithdrawalsSupabase = async function() {
  if (!appData.isAdmin) {
    showNotification('Недостаточно прав!', 'error');
    return;
  }
  
  if (!window.SupabaseAdmin.initialized) {
    showNotification('Supabase не инициализирован', 'error');
    return;
  }
  
  const success = await SupabaseAdmin.syncWithdrawals();
  if (success && document.getElementById('withdraw-admin-modal')?.classList.contains('active')) {
    renderWithdrawAdminList();
  }
};

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', function() {
  // Ждем загрузки основного приложения
  setTimeout(async () => {
    if (appData.isAdmin) {
      console.log('SupabaseAdmin: Инициализация для админа...');
      
      // Добавляем статус в интерфейс, если его нет
      if (!document.getElementById('supabase-status')) {
        const adminPanel = document.querySelector('.admin-actions');
        if (adminPanel) {
          const statusHtml = `
            <div id="supabase-status" class="supabase-status">
              <span class="status-dot"></span>
              <span class="status-text">Supabase: Загрузка...</span>
            </div>
          `;
          adminPanel.insertAdjacentHTML('afterend', statusHtml);
        }
      }
      
      // Инициализируем Supabase
      await SupabaseAdmin.init();
    }
  }, 2000); // Даем основному приложению время на загрузку
});

// ========== СТИЛИ ДЛЯ SUPABASE ==========
const supabaseStyles = `
  /* Статус Supabase */
  .supabase-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    margin-top: 16px;
    font-size: 14px;
  }
  
  .supabase-status .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--error);
  }
  
  .supabase-status .status-dot.connected {
    background: var(--success);
    animation: pulse 2s infinite;
  }
  
  .supabase-status .status-dot.error {
    background: var(--lava-red);
  }
  
  /* Отчеты и статистика */
  .report-summary {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .report-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .report-item:last-child {
    border-bottom: none;
  }
  
  .ton-amount {
    color: var(--primary-green);
    font-weight: 600;
  }
  
  .players-list-container {
    margin-top: 20px;
  }
  
  .players-list {
    max-height: 300px;
    overflow-y: auto;
    margin-top: 12px;
  }
  
  .player-report-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 8px;
  }
  
  .player-balance.positive {
    color: var(--primary-green);
  }
  
  /* Глобальная статистика */
  .global-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .stat-card {
    background: rgba(0, 255, 136, 0.1);
    border: 1px solid rgba(0, 255, 136, 0.2);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  
  .stat-card .stat-value {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
    color: var(--primary-green);
  }
  
  .stat-card .stat-label {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  /* История действий */
  .admin-history-container {
    max-height: 500px;
    overflow-y: auto;
  }
  
  .admin-history-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    border-left: 4px solid var(--primary-green);
  }
  
  .admin-history-item.reset_all_balances {
    border-left-color: var(--lava-red);
  }
  
  .admin-history-item.sync_players {
    border-left-color: var(--info);
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .history-type {
    font-weight: 600;
    color: var(--primary-green);
  }
  
  .history-date {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .history-description {
    margin-bottom: 8px;
    line-height: 1.4;
  }
  
  .history-affected, .history-admin {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .no-history {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary);
  }
  
  /* Кнопки действий */
  .report-actions, .stats-actions, .history-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }
  
  .modal-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .modal-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

// Добавляем стили в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = supabaseStyles;
document.head.appendChild(styleSheet);

console.log('SupabaseAdmin: Модуль загружен и готов к использованию');
