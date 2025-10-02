const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista grupos com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;
    const moduloId = req.query.modulo_id ? Number(req.query.modulo_id) : null;

    let query = `
      SELECT SQL_CALC_FOUND_ROWS 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
    `;
    let params = [];

    if (moduloId) {
      query += " WHERE g.modulo_id = ?";
      params.push(moduloId);
    }

    query += " ORDER BY g.ordem ASC, g.id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar grupos." });
  }
});

// Buscar grupo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupo." });
  }
});

// Criar grupo
router.post("/", async (req, res) => {
  try {
    const { nome, modulo_id, ordem = 1, ativo = 1 } = req.body || {};
    
    if (!nome || !modulo_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome e modulo_id." });
    }

    const [result] = await pool.query(
      "INSERT INTO grupos (nome, modulo_id, ordem, ativo) VALUES (?, ?, ?, ?)",
      [nome, modulo_id, ordem, ativo]
    );

    const [created] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [result.insertId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar grupo." });
  }
});

// Atualizar grupo
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, modulo_id, ordem, ativo } = req.body || {};

    // Monta atualização dinâmica
    const fields = [];
    const values = [];
    if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
    if (modulo_id !== undefined) { fields.push("modulo_id = ?"); values.push(modulo_id); }
    if (ordem !== undefined) { fields.push("ordem = ?"); values.push(ordem); }
    if (ativo !== undefined) { fields.push("ativo = ?"); values.push(ativo); }
    
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    values.push(id);
    await pool.query(`UPDATE grupos SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [id]
    );
    
    if (updated.length === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar grupo." });
  }
});

// Reordenar grupos de um módulo
router.patch("/modulo/:modulo_id/reordenar", async (req, res) => {
  try {
    const { modulo_id } = req.params;
    const { grupos } = req.body || {};
    
    if (!Array.isArray(grupos)) {
      return res.status(400).json({ error: "Campo 'grupos' deve ser um array." });
    }

    // Iniciar transação
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Atualizar ordem de cada grupo
      for (let i = 0; i < grupos.length; i++) {
        const { id, ordem } = grupos[i];
        if (id && ordem !== undefined) {
          await conn.query(
            "UPDATE grupos SET ordem = ? WHERE id = ? AND modulo_id = ?",
            [ordem, id, modulo_id]
          );
        }
      }

      await conn.commit();

      // Buscar grupos atualizados
      const [updated] = await pool.query(
        `SELECT 
          g.id, 
          g.nome, 
          g.ordem, 
          g.ativo,
          g.modulo_id,
          m.nome as modulo_nome
        FROM grupos g
        LEFT JOIN modulos m ON g.modulo_id = m.id
        WHERE g.modulo_id = ? 
        ORDER BY g.ordem ASC, g.id ASC`,
        [modulo_id]
      );

      res.json({ data: updated, message: "Ordem atualizada com sucesso." });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao reordenar grupos." });
  }
});

// Remover grupo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM grupos WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover grupo." });
  }
});

// Rota especial: Verificar se um grupo pode ser acessado baseado na progressão sequencial
router.get("/:id/verificar-acesso", async (req, res) => {
  try {
    const { id: grupoId } = req.params;
    const { empresa_id, usuario_id } = req.query;
    
    if (!empresa_id || !usuario_id) {
      return res.status(400).json({ 
        error: "Parâmetros obrigatórios: empresa_id e usuario_id" 
      });
    }

    // 1. Buscar informações do grupo atual
    const [grupoAtual] = await pool.query(
      `SELECT g.id, g.ordem, g.modulo_id FROM grupos g WHERE g.id = ?`,
      [grupoId]
    );
    
    if (grupoAtual.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    const { ordem: ordemAtual, modulo_id } = grupoAtual[0];

    // 2. Se é o primeiro grupo (ordem 1), sempre permitir acesso
    if (ordemAtual === 1) {
      return res.json({ 
        pode_acessar: true, 
        motivo: "Primeiro grupo do módulo",
        grupo_anterior: null
      });
    }

    // 3. Buscar o grupo anterior (ordem - 1)
    const [grupoAnterior] = await pool.query(
      `SELECT g.id, g.ordem, g.nome FROM grupos g 
       WHERE g.modulo_id = ? AND g.ordem = ?`,
      [modulo_id, ordemAtual - 1]
    );

    if (grupoAnterior.length === 0) {
      return res.json({ 
        pode_acessar: true, 
        motivo: "Grupo anterior não encontrado",
        grupo_anterior: null
      });
    }

    const grupoAnteriorId = grupoAnterior[0].id;

    // 4. Verificar se todos os conteúdos do grupo anterior foram concluídos
    const [conteudosAnterior] = await pool.query(
      `SELECT COUNT(*) as total_conteudos FROM conteudos c 
       WHERE c.grupo_id = ?`,
      [grupoAnteriorId]
    );

    const [conteudosConcluidos] = await pool.query(
      `SELECT COUNT(*) as concluidos FROM empresas_conteudos ec
       JOIN conteudos c ON ec.conteudo_id = c.id
       WHERE c.grupo_id = ? AND ec.empresa_id = ? AND ec.status = 'concluido'`,
      [grupoAnteriorId, empresa_id]
    );

    const totalConteudos = conteudosAnterior[0].total_conteudos;
    const conteudosConcluidosCount = conteudosConcluidos[0].concluidos;

    // 5. Se nem todos os conteúdos foram concluídos, negar acesso
    if (conteudosConcluidosCount < totalConteudos) {
      return res.json({
        pode_acessar: false,
        motivo: "Conteúdos do grupo anterior não foram todos concluídos",
        grupo_anterior: {
          id: grupoAnteriorId,
          nome: grupoAnterior[0].nome,
          progresso_conteudos: {
            concluidos: conteudosConcluidosCount,
            total: totalConteudos,
            porcentagem: Math.round((conteudosConcluidosCount / totalConteudos) * 100)
          }
        }
      });
    }

    // 6. Verificar se existe prova para o grupo anterior (conteúdos OU grupo diretamente) 
    // QUE TENHA VÍNCULO NA TABELA prova_empresa
    const [provasAnterior] = await pool.query(
      `SELECT DISTINCT p.id, p.nome, p.conteudo_id, p.grupo_id 
       FROM prova p
       INNER JOIN prova_empresa pe ON p.id = pe.prova_id
       WHERE pe.empresa_id = ? AND (p.grupo_id = ? OR p.conteudo_id IN (
         SELECT c.id FROM conteudos c WHERE c.grupo_id = ?
       ))`,
      [empresa_id, grupoAnteriorId, grupoAnteriorId]
    );


    // Se não há prova, permitir acesso
    if (provasAnterior.length === 0) {
      return res.json({
        pode_acessar: true,
        motivo: "Grupo anterior concluído e sem prova obrigatória",
        grupo_anterior: {
          id: grupoAnteriorId,
          nome: grupoAnterior[0].nome,
          tem_prova: false
        }
      });
    }

    // 7. Verificar se TODAS as provas foram feitas com nota alta (>= 7)
    const provasStatus = [];
    
    for (const prova of provasAnterior) {
      const [provaRealizada] = await pool.query(
        `SELECT pe.nota, pe.prova_id FROM prova_empresa pe
         WHERE pe.prova_id = ? AND pe.empresa_id = ? AND pe.nota IS NOT NULL
         ORDER BY pe.id DESC LIMIT 1`,
        [prova.id, empresa_id]
      );

      const status = {
        id: prova.id,
        nome: prova.nome,
        tipo: prova.grupo_id ? 'grupo' : 'conteudo',
        realizada: provaRealizada.length > 0,
        nota: provaRealizada.length > 0 ? parseFloat(provaRealizada[0].nota) : null,
        aprovado: provaRealizada.length > 0 && parseFloat(provaRealizada[0].nota) >= 7
      };
      
      provasStatus.push(status);
    }

    // Verificar se alguma prova não foi realizada ou não foi aprovada
    const provasNaoRealizadas = provasStatus.filter(p => !p.realizada);
    const provasNaoAprovadas = provasStatus.filter(p => p.realizada && !p.aprovado);

    if (provasNaoRealizadas.length > 0) {
      return res.json({
        pode_acessar: false,
        motivo: "Algumas provas do grupo anterior não foram realizadas",
        grupo_anterior: {
          id: grupoAnteriorId,
          nome: grupoAnterior[0].nome,
          provas: provasStatus
        }
      });
    }

    if (provasNaoAprovadas.length > 0) {
      return res.json({
        pode_acessar: false,
        motivo: "Algumas provas do grupo anterior não foram aprovadas com nota alta (>= 7)",
        grupo_anterior: {
          id: grupoAnteriorId,
          nome: grupoAnterior[0].nome,
          provas: provasStatus
        }
      });
    }

    // 8. Se chegou até aqui, pode acessar
    return res.json({
      pode_acessar: true,
      motivo: "Grupo anterior concluído e todas as provas aprovadas",
      grupo_anterior: {
        id: grupoAnteriorId,
        nome: grupoAnterior[0].nome,
        provas: provasStatus
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao verificar acesso ao grupo." });
  }
});

module.exports = router;
