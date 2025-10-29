const db = require("../../config/database");

const criarDepartamento = async (empresaId, nome) => {
  const [result] = await db.execute(
    "INSERT INTO departamentos (empresaId, nome) VALUES (?, ?)",
    [empresaId, nome]
  );
  return { id: result.insertId, empresaId, nome };
};

const listarPorEmpresa = async (empresaId) => {
  const [rows] = await db.execute(
    "SELECT * FROM departamentos WHERE empresaId = ?",
    [empresaId]
  );
  return rows;
};

module.exports = {
  criarDepartamento,
  listarPorEmpresa,
};
