const pool = require("../config/database");
const cron = require("node-cron");

const expireContracts = async () => {
  console.log("🔄 Iniciando verificação de contratos expirados...");

  try {
    const [expiredContracts] = await pool.query(
      "UPDATE contracts SET status = 'expirado' WHERE status = 'pendente' AND expires_at <= NOW()"
    );

    console.log("📊 Query executada, verificando contratos...");

    if (expiredContracts.affectedRows > 0) {
      console.log(`✅ ${expiredContracts.affectedRows} contratos expirados.`);
    } else {
      console.log("ℹ️ Nenhum contrato expirado encontrado.");
    }
  } catch (error) {
    console.error("❌ Erro ao expirar contratos:", error);
  }
};

const expireDocuments = async () => {
  console.log("🔄 Iniciando verificação de documentos expirados...");

  try {
    // IMPORTANTE: Ignora rascunhos (status = 'rascunho')
    const [expiredDocuments] = await pool.query(
      "UPDATE documentos SET status = 'expirado' WHERE status = 'pendente' AND expirado_em <= NOW() AND status != 'rascunho'"
    );

    console.log("📊 Query executada, verificando documentos...");

    if (expiredDocuments.affectedRows > 0) {
      console.log(`✅ ${expiredDocuments.affectedRows} documentos expirados.`);
    } else {
      console.log("ℹ️ Nenhum documento expirado encontrado.");
    }
  } catch (error) {
    console.error("❌ Erro ao expirar documentos:", error);
  }
};

// Se estiver rodando diretamente via terminal
if (require.main === module) {
  expireContracts();
  expireDocuments();
}

module.exports = { expireContracts, expireDocuments };
