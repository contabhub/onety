const db = require("../config/database");

class SitFisModel {
  static async salvarRelatorio(clienteId, empresaId, binaryFile, status) {
    const query = `
      INSERT INTO sitfis (cliente_id, empresa_id, binary_file, status)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [clienteId, empresaId, binaryFile, status]);
  }

  static async obterPorEmpresa(empresaId) {
    const query = `
      SELECT status, COUNT(*) as total
      FROM sitfis
      WHERE empresa_id = ?
      GROUP BY status
    `;
    const [rows] = await db.execute(query, [empresaId]);
    return rows;
  }
}

module.exports = SitFisModel;
