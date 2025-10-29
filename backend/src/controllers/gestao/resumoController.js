const db = require("../../config/database"); // Certifique-se que o banco de dados está conectado corretamente.

exports.obterResumo = async (req, res) => {
  try {
    const { empresaId } = req.params;

    // Query para buscar a quantidade total de clientes para uma determinada empresa
    const query = `
      SELECT 
        COUNT(*) AS totalClientes
      FROM clientes
      WHERE empresaId = ?;
    `;

    const [result] = await db.execute(query, [empresaId]);

    res.json({
      totalClientes: result[0].totalClientes,
    });

  } catch (error) {
    console.error("Erro ao obter resumo:", error);
    res.status(500).json({ error: "Erro ao buscar resumo de clientes" });
  }
};
