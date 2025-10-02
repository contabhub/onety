const express = require('express');
const pool = require('../../config/database');
const verifyToken = require('../../middlewares/auth');
const { verificarPermissao } = require('../../middlewares/permissao');

const router = express.Router();

// Listar grupos de uma empresa
router.get("/", verifyToken, async (req, res) => {
  try {
    const { empresa_id, grupo_id, modulo_id } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ error: "Parâmetro obrigatório: empresa_id" });
    }

    let query = `
      SELECT 
        eg.empresa_id,
        eg.grupo_id,
        eg.status as grupo_status,
        eg.concluido_em as grupo_concluido_em,
        g.nome as grupo_nome,
        g.descricao as grupo_descricao,
        g.ordem as grupo_ordem,
        g.ativo as grupo_ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM empresas_grupos eg
      INNER JOIN grupos g ON eg.grupo_id = g.id
      INNER JOIN modulos m ON g.modulo_id = m.id
      WHERE eg.empresa_id = ?
    `;

    let params = [empresa_id];

    if (grupo_id) {
      query += " AND eg.grupo_id = ?";
      params.push(grupo_id);
    }

    if (modulo_id) {
      query += " AND g.modulo_id = ?";
      params.push(modulo_id);
    }

    query += " ORDER BY g.ordem ASC, g.nome ASC";

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Erro ao buscar grupos da empresa:', error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// Atualizar status de um grupo
router.patch("/:empresa_id/:grupo_id", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  try {
    const { empresa_id, grupo_id } = req.params;
    const { status } = req.body;

    if (!status || !['bloqueado', 'em_andamento', 'concluido'].includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use: bloqueado, em_andamento ou concluido" });
    }

    const concluido_em = status === 'concluido' ? new Date() : null;

    await pool.query(
      "UPDATE empresas_grupos SET status = ?, concluido_em = ? WHERE empresa_id = ? AND grupo_id = ?",
      [status, concluido_em, empresa_id, grupo_id]
    );

    res.json({
      success: true,
      message: `Status do grupo atualizado para ${status}`
    });
  } catch (error) {
    console.error('Erro ao atualizar status do grupo:', error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
