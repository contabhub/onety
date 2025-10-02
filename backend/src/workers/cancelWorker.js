const cron = require("node-cron");
const pool = require("../config/database");

class CancelWorker {
  constructor() {
    this.task = null;
  }

  async runOnce() {
    const sql = `
      UPDATE company
      SET status = 'Cancelado',
          data_referencia = NULL
      WHERE status IN ('Em atraso','Suspenso')
        AND data_referencia <= (CURDATE() - INTERVAL 10 DAY)
    `;
    const [result] = await pool.query(sql);
    return result.affectedRows || 0;
  }

  start() {
    if (this.task) return;

    const timezone = process.env.TZ || "America/Sao_Paulo";
    // Executa diariamente às 00:05
    this.task = cron.schedule(
      "5 0 * * *",
      async () => {
        try {
          const affected = await this.runOnce();
          if (affected > 0) {
            console.log(`✅ CancelWorker: ${affected} empresa(s) cancelada(s) por D+10.`);
          } else {
            console.log("✅ CancelWorker: nenhuma empresa atingiu D+10 hoje.");
          }
        } catch (error) {
          console.error("❌ CancelWorker erro:", error);
        }
      },
      { timezone }
    );

    this.task.start();
    console.log(`⏰ CancelWorker agendado diariamente às 00:05 (${timezone}).`);
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}

module.exports = new CancelWorker();


