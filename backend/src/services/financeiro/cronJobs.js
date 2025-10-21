const cron = require('node-cron');
const automacaoRecorrencia = require('./automacaoRecorrencia');

class CronJobs {
  constructor() {
    this.jobs = new Map();
  }

  // 🚀 Inicializar todos os cron jobs
  init() {
    console.log('🕐 Inicializando cron jobs...');
    
    // Verificar contratos todos os dias às 8h da manhã
    this.scheduleContratosVerification();
    
    // Verificar contratos a cada 6 horas (backup)
    this.scheduleContratosBackup();
    
    console.log('✅ Cron jobs inicializados com sucesso!');
  }

  // 📅 Agendar verificação principal de contratos (diária às 8h)
  scheduleContratosVerification() {
    const job = cron.schedule('0 8 * * *', async () => {
      console.log('🕐 Executando verificação diária de contratos...');
      try {
        const contratosProcessados = await automacaoRecorrencia.verificarContratosParaBoleto();
        console.log(`✅ Verificação diária concluída: ${contratosProcessados} contratos processados`);
      } catch (error) {
        console.error('❌ Erro na verificação diária:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    this.jobs.set('contratosVerification', job);
    console.log('📅 Verificação diária de contratos agendada para 8h da manhã');
  }

  // 🔄 Agendar verificação de backup (a cada 6 horas)
  scheduleContratosBackup() {
    const job = cron.schedule('0 */6 * * *', async () => {
      console.log('🕐 Executando verificação de backup de contratos...');
      try {
        const contratosProcessados = await automacaoRecorrencia.verificarContratosParaBoleto();
        if (contratosProcessados > 0) {
          console.log(`✅ Verificação de backup: ${contratosProcessados} contratos processados`);
        } else {
          console.log('✅ Verificação de backup: nenhum contrato pendente');
        }
      } catch (error) {
        console.error('❌ Erro na verificação de backup:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    this.jobs.set('contratosBackup', job);
    console.log('🔄 Verificação de backup agendada a cada 6 horas');
  }

  // 🛑 Parar todos os cron jobs
  stop() {
    console.log('🛑 Parando todos os cron jobs...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`🛑 Cron job "${name}" parado`);
    });
    this.jobs.clear();
  }

  // 📊 Status dos cron jobs
  getStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        nextDate: job.nextDate(),
        lastDate: job.lastDate()
      };
    });
    return status;
  }

  // ▶️ Executar verificação manual
  async executarVerificacaoManual() {
    console.log('🚀 Executando verificação manual...');
    try {
      const contratosProcessados = await automacaoRecorrencia.verificarContratosParaBoleto();
      console.log(`✅ Verificação manual concluída: ${contratosProcessados} contratos processados`);
      return contratosProcessados;
    } catch (error) {
      console.error('❌ Erro na verificação manual:', error);
      throw error;
    }
  }
}

// Criar instância singleton
const cronJobs = new CronJobs();

module.exports = cronJobs; 