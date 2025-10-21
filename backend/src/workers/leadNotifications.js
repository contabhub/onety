const pool = require("../config/database");
const cron = require("node-cron");
const webSocketManager = require("../websocket");

/**
 * 📅 Verifica leads com data_prevista próxima e envia notificações via WebSocket
 */
const checkUpcomingLeads = async () => {
  console.log("🔄 Iniciando verificação de leads com data prevista próxima...");

  try {
    // Busca leads com data_prevista nos próximos 3 dias (hoje, amanhã e depois de amanhã)
    const [upcomingLeads] = await pool.query(`
      SELECT 
        l.id,
        l.nome,
        l.data_prevista,
        l.empresa_id,
        l.user_id,
        l.funil_fase_id,
        ff.nome as fase_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM leads l
      LEFT JOIN funil_fases ff ON l.funil_fase_id = ff.id
      LEFT JOIN usuarios u ON l.user_id = u.id
      WHERE l.data_prevista IS NOT NULL 
        AND l.data_prevista BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        AND l.status != 'perdeu'
        AND l.status != 'ganhou'
      ORDER BY l.data_prevista ASC, l.empresa_id
    `);

    console.log(`📊 Encontrados ${upcomingLeads.length} leads com data prevista próxima`);

    if (upcomingLeads.length === 0) {
      console.log("ℹ️ Nenhum lead com data prevista próxima encontrado.");
      return;
    }

    // Agrupa leads por empresa para enviar notificações organizadas
    const leadsByCompany = upcomingLeads.reduce((acc, lead) => {
      if (!acc[lead.empresa_id]) {
        acc[lead.empresa_id] = [];
      }
      acc[lead.empresa_id].push(lead);
      return acc;
    }, {});

    // Envia notificação para cada empresa
    for (const [empresaId, leads] of Object.entries(leadsByCompany)) {
      try {
        // Calcula quantos dias faltam para cada lead
        const leadsWithDaysLeft = leads.map(lead => {
          const today = new Date();
          const dataPrevista = new Date(lead.data_prevista);
          const diffTime = dataPrevista - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            ...lead,
            dias_restantes: diffDays,
            urgente: diffDays <= 1 // Hoje ou amanhã
          };
        });

        // Envia notificação via WebSocket para a empresa
        webSocketManager.emitToCompany(Number(empresaId), 'leads:upcoming', {
          type: 'leads_upcoming',
          empresa_id: Number(empresaId),
          leads: leadsWithDaysLeft,
          total_leads: leadsWithDaysLeft.length,
          urgentes: leadsWithDaysLeft.filter(l => l.urgente).length,
          timestamp: new Date().toISOString()
        });

        console.log(`📡 Notificação enviada para empresa ${empresaId}: ${leads.length} leads próximos (${leadsWithDaysLeft.filter(l => l.urgente).length} urgentes)`);

      } catch (error) {
        console.error(`❌ Erro ao enviar notificação para empresa ${empresaId}:`, error);
      }
    }

    console.log("✅ Verificação de leads concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro ao verificar leads com data prevista próxima:", error);
  }
};

/**
 * 📅 Verifica leads que passaram da data_prevista (atrasados)
 */
const checkOverdueLeads = async () => {
  console.log("🔄 Iniciando verificação de leads atrasados...");

  try {
    // Busca leads que passaram da data_prevista
    const [overdueLeads] = await pool.query(`
      SELECT 
        l.id,
        l.nome,
        l.data_prevista,
        l.empresa_id,
        l.user_id,
        l.funil_fase_id,
        ff.nome as fase_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM leads l
      LEFT JOIN funil_fases ff ON l.funil_fase_id = ff.id
      LEFT JOIN usuarios u ON l.user_id = u.id
      WHERE l.data_prevista IS NOT NULL 
        AND l.data_prevista < CURDATE()
        AND l.status != 'perdeu'
        AND l.status != 'ganhou'
      ORDER BY l.data_prevista ASC, l.empresa_id
    `);

    console.log(`📊 Encontrados ${overdueLeads.length} leads atrasados`);

    if (overdueLeads.length === 0) {
      console.log("ℹ️ Nenhum lead atrasado encontrado.");
      return;
    }

    // Agrupa leads por empresa
    const leadsByCompany = overdueLeads.reduce((acc, lead) => {
      if (!acc[lead.empresa_id]) {
        acc[lead.empresa_id] = [];
      }
      acc[lead.empresa_id].push(lead);
      return acc;
    }, {});

    // Envia notificação para cada empresa
    for (const [empresaId, leads] of Object.entries(leadsByCompany)) {
      try {
        // Calcula quantos dias de atraso para cada lead
        const leadsWithOverdueDays = leads.map(lead => {
          const today = new Date();
          const dataPrevista = new Date(lead.data_prevista);
          const diffTime = today - dataPrevista;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            ...lead,
            dias_atraso: diffDays
          };
        });

        // Envia notificação via WebSocket para a empresa
        webSocketManager.emitToCompany(Number(empresaId), 'leads:overdue', {
          type: 'leads_overdue',
          empresa_id: Number(empresaId),
          leads: leadsWithOverdueDays,
          total_leads: leadsWithOverdueDays.length,
          timestamp: new Date().toISOString()
        });

        console.log(`📡 Notificação de atraso enviada para empresa ${empresaId}: ${leads.length} leads atrasados`);

      } catch (error) {
        console.error(`❌ Erro ao enviar notificação de atraso para empresa ${empresaId}:`, error);
      }
    }

    console.log("✅ Verificação de leads atrasados concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro ao verificar leads atrasados:", error);
  }
};

/**
 * 🕐 Inicia o sistema de notificações de leads
 */
const startLeadNotifications = () => {
  console.log("🚀 Iniciando sistema de notificações de leads...");

  // Executa verificação de leads próximos a cada 6 horas
  cron.schedule('0 */6 * * *', () => {
    console.log("⏰ Executando verificação de leads próximos (cron: a cada 6 horas)");
    checkUpcomingLeads();
  });

  // Executa verificação de leads atrasados uma vez por dia às 9h
  cron.schedule('0 9 * * *', () => {
    console.log("⏰ Executando verificação de leads atrasados (cron: diário às 9h)");
    checkOverdueLeads();
  });

  // Executa verificação inicial após 30 segundos (para dar tempo do servidor inicializar)
  setTimeout(() => {
    console.log("⏰ Executando verificação inicial de leads...");
    checkUpcomingLeads();
    checkOverdueLeads();
  }, 30000);

  console.log("✅ Sistema de notificações de leads iniciado!");
};

// Se estiver rodando diretamente via terminal
if (require.main === module) {
  checkUpcomingLeads();
  checkOverdueLeads();
}

module.exports = { 
  checkUpcomingLeads, 
  checkOverdueLeads, 
  startLeadNotifications 
};
