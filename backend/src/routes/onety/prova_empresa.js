const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista prova_empresa com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar prova_empresa." });
  }
});

// Busca prova_empresa por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_empresa." });
  }
});

// Cria nova prova_empresa
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { prova_id, empresa_id, viewer_id } = payload;
    
    // Validação básica
    if (!prova_id || !empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: prova_id, empresa_id e viewer_id" 
      });
    }

    // Campos opcionais
    const { nota } = payload;

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO prova_empresa (prova_id, empresa_id, viewer_id, nota) VALUES (?, ?, ?, ?)`,
      [prova_id, empresa_id, viewer_id, nota || null]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar prova_empresa." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza prova_empresa por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "prova_id",
    "empresa_id",
    "viewer_id",
    "nota"
  ];

  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  return { fields, values };
};

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, values } = buildUpdateQuery(req.body || {});
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE prova_empresa SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar prova_empresa." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove prova_empresa por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM prova_empresa WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });

    await pool.query("DELETE FROM prova_empresa WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover prova_empresa." });
  }
});

// Rota especial: Buscar por prova_id
router.get("/prova/:prova_id", async (req, res) => {
  try {
    const { prova_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa WHERE prova_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [prova_id, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_empresa por prova." });
  }
});

// Rota especial: Buscar por empresa_id
router.get("/empresa/:empresa_id", async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const { conteudo_id, grupo_id, prova_id } = req.query;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE pe.empresa_id = ?";
    let queryParams = [empresa_id];

    // Adicionar filtros opcionais
    if (conteudo_id) {
      whereClause += " AND p.conteudo_id = ?";
      queryParams.push(conteudo_id);
    }
    
    if (grupo_id) {
      whereClause += " AND p.grupo_id = ?";
      queryParams.push(grupo_id);
    }
    
    if (prova_id) {
      whereClause += " AND pe.prova_id = ?";
      queryParams.push(prova_id);
    }

    // Query com JOIN para incluir informações da prova
    const query = `
      SELECT SQL_CALC_FOUND_ROWS 
        pe.id,
        pe.prova_id,
        pe.empresa_id,
        pe.viewer_id,
        pe.nota,
        p.nome as prova_nome,
        p.conteudo_id,
        p.grupo_id
      FROM prova_empresa pe
      JOIN prova p ON pe.prova_id = p.id
      ${whereClause}
      ORDER BY pe.id DESC 
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);

    const [rows] = await pool.query(query, queryParams);
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_empresa por empresa." });
  }
});

// Rota especial: Buscar por viewer_id
router.get("/viewer/:viewer_id", async (req, res) => {
  try {
    const { viewer_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa WHERE viewer_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [viewer_id, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_empresa por viewer." });
  }
});

// Rota especial: Atualizar nota
router.patch("/:id/nota", async (req, res) => {
  try {
    const { id } = req.params;
    const { nota } = req.body;

    if (nota === undefined) {
      return res.status(400).json({ error: "Campo 'nota' é obrigatório." });
    }

    await pool.query("UPDATE prova_empresa SET nota = ? WHERE id = ?", [nota, id]);

    const [updated] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar nota." });
  }
});

// Rota especial: Calcular média da prova
router.post("/:id/calcular-media", async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { respostas } = req.body; // Array de { questao_id, alternativa_id }

    if (!respostas || !Array.isArray(respostas)) {
      return res.status(400).json({ error: "Campo 'respostas' é obrigatório e deve ser um array." });
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Buscar informações da prova
      const [provaInfo] = await conn.query(
        `SELECT pe.id, pe.prova_id, p.nome as prova_nome 
         FROM prova_empresa pe 
         JOIN prova p ON pe.prova_id = p.id 
         WHERE pe.id = ?`,
        [id]
      );

      if (provaInfo.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Prova não encontrada." });
      }

      const provaId = provaInfo[0].prova_id;

      // 2. Buscar todas as questões da prova
      const [questoes] = await conn.query(
        "SELECT id, enunciado FROM questao WHERE prova_id = ?",
        [provaId]
      );

      if (questoes.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Nenhuma questão encontrada para esta prova." });
      }

      // 3. Buscar alternativas corretas para cada questão
      const [alternativasCorretas] = await conn.query(
        `SELECT q.id as questao_id, a.id as alternativa_id, a.opcao
         FROM questao q 
         JOIN alternativa a ON q.id = a.questao_id 
         WHERE q.prova_id = ? AND a.correto = 1`,
        [provaId]
      );

      // 4. Calcular pontuação
      let acertos = 0;
      const detalhes = [];

      for (const questao of questoes) {
        const respostaUsuario = respostas.find(r => r.questao_id === questao.id);
        const alternativaCorreta = alternativasCorretas.find(a => a.questao_id === questao.id);
        
        const acertou = respostaUsuario && 
                       alternativaCorreta && 
                       respostaUsuario.alternativa_id === alternativaCorreta.alternativa_id;

        if (acertou) acertos++;

        detalhes.push({
          questao_id: questao.id,
          enunciado: questao.enunciado,
          resposta_usuario: respostaUsuario?.alternativa_id || null,
          alternativa_correta: alternativaCorreta?.alternativa_id || null,
          acertou: acertou
        });
      }

      // 5. Calcular nota (0 a 10)
      const totalQuestoes = questoes.length;
      const nota = totalQuestoes > 0 ? (acertos / totalQuestoes) * 10 : 0;
      const porcentagem = totalQuestoes > 0 ? (acertos / totalQuestoes) * 100 : 0;

      // 6. Atualizar nota na prova_empresa
      await conn.query(
        "UPDATE prova_empresa SET nota = ? WHERE id = ?",
        [nota, id]
      );

      await conn.commit();

      res.json({
        prova_id: provaId,
        prova_nome: provaInfo[0].prova_nome,
        total_questoes: totalQuestoes,
        acertos: acertos,
        erros: totalQuestoes - acertos,
        nota: Math.round(nota * 100) / 100, // Arredondar para 2 casas decimais
        porcentagem: Math.round(porcentagem * 100) / 100,
        aprovado: nota >= 7, // Considerar aprovado com nota >= 7
        detalhes: detalhes
      });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao calcular média da prova." });
  }
});

// Rota especial: Verificar se módulo foi concluído e liberar prova
router.post("/liberar-prova", async (req, res) => {
  let conn;
  try {
    const { modulo_id, empresa_id, viewer_id } = req.body || {};
    
    if (!modulo_id || !empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: modulo_id, empresa_id e viewer_id" 
      });
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Buscar todos os grupos de conteúdo do módulo
      const [grupos] = await conn.query(
        "SELECT id FROM grupos WHERE modulo_id = ?",
        [modulo_id]
      );

      if (grupos.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Nenhum grupo de conteúdo encontrado para este módulo." });
      }

      const grupoIds = grupos.map(g => g.id);

      // 2. Verificar se todos os grupos foram concluídos pela empresa
      const [gruposConcluidos] = await conn.query(
        `SELECT COUNT(*) as concluidos FROM empresas_conteudos ec
         JOIN conteudos c ON ec.conteudo_id = c.id
         WHERE c.grupo_id IN (${grupoIds.map(() => '?').join(',')}) 
         AND ec.empresa_id = ? AND ec.usuario_id = ? AND ec.status = 'concluido'`,
        [...grupoIds, empresa_id, viewer_id]
      );

      const totalGrupos = grupos.length;
      const gruposConcluidosCount = gruposConcluidos[0].concluidos;

      // 3. Se não todos os grupos foram concluídos, retornar erro
      if (gruposConcluidosCount < totalGrupos) {
        await conn.rollback();
        return res.status(400).json({ 
          error: "Módulo não foi completamente concluído. Complete todos os grupos de conteúdo primeiro.",
          progresso: {
            concluidos: gruposConcluidosCount,
            total: totalGrupos,
            porcentagem: Math.round((gruposConcluidosCount / totalGrupos) * 100)
          }
        });
      }

      // 4. Buscar provas do módulo (tanto por conteúdo quanto por grupo)
      const [provas] = await conn.query(
        `SELECT DISTINCT p.id, p.nome, p.conteudo_id, 'conteudo' as tipo_vinculo
         FROM prova p 
         JOIN conteudos c ON p.conteudo_id = c.id 
         WHERE c.grupo_id IN (${grupoIds.map(() => '?').join(',')})
         UNION
         SELECT DISTINCT p.id, p.nome, p.conteudo_id, 'grupo' as tipo_vinculo
         FROM prova p 
         JOIN prova_grupo pg ON p.id = pg.prova_id
         WHERE pg.grupo_id IN (${grupoIds.map(() => '?').join(',')}) AND pg.ativo = 1`,
        [...grupoIds, ...grupoIds]
      );

      if (provas.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Nenhuma prova encontrada para este módulo." });
      }

      // 5. Verificar se já existe prova liberada para este usuário/empresa
      const [provaExistente] = await conn.query(
        "SELECT id FROM prova_empresa WHERE empresa_id = ? AND viewer_id = ? AND prova_id IN (?)",
        [empresa_id, viewer_id, provas.map(p => p.id)]
      );

      if (provaExistente.length > 0) {
        await conn.rollback();
        return res.status(409).json({ 
          error: "Prova já foi liberada para este usuário.",
          prova_id: provaExistente[0].id
        });
      }

      // 6. Liberar todas as provas do módulo
      const provasLiberadas = [];
      for (const prova of provas) {
        const [result] = await conn.query(
          "INSERT INTO prova_empresa (prova_id, empresa_id, viewer_id, nota) VALUES (?, ?, ?, NULL)",
          [prova.id, empresa_id, viewer_id]
        );
        
        provasLiberadas.push({
          id: result.insertId,
          prova_id: prova.id,
          nome: prova.nome,
          status: 'liberada'
        });
      }

      await conn.commit();

      res.json({
        sucesso: true,
        mensagem: "Provas liberadas com sucesso!",
        provas_liberadas: provasLiberadas,
        total_provas: provas.length
      });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao liberar provas." });
  }
});

// Rota especial: Verificar status de conclusão do módulo
router.get("/status-modulo/:modulo_id", async (req, res) => {
  try {
    const { modulo_id } = req.params;
    const { empresa_id, viewer_id } = req.query;
    
    if (!empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Parâmetros obrigatórios: empresa_id e viewer_id" 
      });
    }

    // Buscar todos os grupos de conteúdo do módulo
    const [grupos] = await pool.query(
      "SELECT id, nome FROM grupos WHERE modulo_id = ?",
      [modulo_id]
    );

    if (grupos.length === 0) {
      return res.status(404).json({ error: "Nenhum grupo de conteúdo encontrado para este módulo." });
    }

    const grupoIds = grupos.map(g => g.id);

    // Verificar progresso de conclusão
    const [gruposConcluidos] = await pool.query(
      `SELECT COUNT(*) as concluidos FROM empresas_conteudos ec
       JOIN conteudos c ON ec.conteudo_id = c.id
       WHERE c.grupo_id IN (${grupoIds.map(() => '?').join(',')}) 
       AND ec.empresa_id = ? AND ec.usuario_id = ? AND ec.status = 'concluido'`,
      [...grupoIds, empresa_id, viewer_id]
    );

    // DEBUG: Verificar detalhes de cada grupo
    const [detalhesGrupos] = await pool.query(
      `SELECT gc.id, gc.nome, ec.status, CONCAT(ec.empresa_id, '-', ec.conteudo_id) as empresas_conteudos_id
       FROM grupos gc
       LEFT JOIN conteudos c ON gc.id = c.grupo_id
       LEFT JOIN empresas_conteudos ec ON c.id = ec.conteudo_id 
         AND ec.empresa_id = ? AND ec.usuario_id = ?
       WHERE gc.modulo_id = ?`,
      [empresa_id, viewer_id, modulo_id]
    );

    // DEBUG: Verificar conteúdos concluídos por grupo
    const [conteudosPorGrupo] = await pool.query(
      `SELECT gc.id as grupo_id, gc.nome as grupo_nome,
              COUNT(c.id) as total_conteudos,
              COUNT(CASE WHEN ec.status = 'concluido' THEN 1 END) as conteudos_concluidos
       FROM grupos gc
       LEFT JOIN conteudos c ON gc.id = c.grupo_id
       LEFT JOIN empresas_conteudos ec ON c.id = ec.conteudo_id 
         AND ec.empresa_id = ? AND ec.usuario_id = ?
       WHERE gc.modulo_id = ?
       GROUP BY gc.id, gc.nome`,
      [empresa_id, viewer_id, modulo_id]
    );

    const totalGrupos = grupos.length;
const gruposConcluidosCount = gruposConcluidos[0].concluidos;
    const moduloCompleto = gruposConcluidosCount === totalGrupos;

    // Verificar se já tem provas liberadas
    const [provasLiberadas] = await pool.query(
      `SELECT COUNT(*) as liberadas FROM prova_empresa pe
       JOIN prova p ON pe.prova_id = p.id
       JOIN conteudos c ON p.conteudo_id = c.id
       WHERE c.grupo_id IN (${grupoIds.map(() => '?').join(',')})
       AND pe.empresa_id = ? AND pe.viewer_id = ?`,
      [...grupoIds, empresa_id, viewer_id]
    );

    res.json({
      modulo_id: parseInt(modulo_id),
      total_grupos: totalGrupos,
      grupos_concluidos: gruposConcluidosCount,
      porcentagem: Math.round((gruposConcluidosCount / totalGrupos) * 100),
      modulo_completo: moduloCompleto,
      provas_liberadas: provasLiberadas[0].liberadas,
      pode_fazer_prova: moduloCompleto && provasLiberadas[0].liberadas > 0,
      debug: {
        grupos: detalhesGrupos,
        conteudos_por_grupo: conteudosPorGrupo
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao verificar status do módulo." });
  }
});

// Rota especial: Forçar conclusão de grupo quando todos os conteúdos estão concluídos
router.post("/forcar-conclusao-grupo", async (req, res) => {
  let conn;
  try {
    const { grupo_id, empresa_id, viewer_id } = req.body || {};

    if (!grupo_id || !empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: grupo_id, empresa_id e viewer_id" 
      });
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Verificar se todos os conteúdos do grupo foram concluídos
      const [conteudos] = await conn.query(
        "SELECT COUNT(*) as total FROM conteudo WHERE grupo_id = ?",
        [grupo_id]
      );

      const [conteudosConcluidos] = await conn.query(
        "SELECT COUNT(*) as concluidos FROM conteudo WHERE grupo_id = ? AND concluido = 1",
        [grupo_id]
      );

      const totalConteudos = conteudos[0].total;
      const totalConcluidos = conteudosConcluidos[0].concluidos;

      if (totalConteudos === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Nenhum conteúdo encontrado para este grupo." });
      }

      if (totalConcluidos < totalConteudos) {
        await conn.rollback();
        return res.status(400).json({ 
          error: "Nem todos os conteúdos foram concluídos.",
          progresso: {
            concluidos: totalConcluidos,
            total: totalConteudos,
            porcentagem: Math.round((totalConcluidos / totalConteudos) * 100)
          }
        });
      }

      // 2. Verificar se já existe registro na empresas_conteudos
      const [existeRegistro] = await conn.query(
        `SELECT ec.empresa_id, ec.conteudo_id, ec.status FROM empresas_conteudos ec
         JOIN conteudos c ON ec.conteudo_id = c.id
         WHERE c.grupo_id = ? AND ec.empresa_id = ? AND ec.usuario_id = ?`,
        [grupo_id, empresa_id, viewer_id]
      );

      if (existeRegistro.length > 0) {
        // Atualizar registro existente
        if (existeRegistro[0].status === 'pendente') {
          await conn.query(
            "UPDATE empresas_conteudos SET status = 'concluido', concluido_em = NOW() WHERE empresa_id = ? AND conteudo_id = ?",
            [existeRegistro[0].empresa_id, existeRegistro[0].conteudo_id]
          );
        }
      } else {
        // Criar novo registro - precisamos buscar um conteudo_id do grupo
        const [conteudo] = await conn.query(
          "SELECT id FROM conteudos WHERE grupo_id = ? LIMIT 1",
          [grupo_id]
        );
        
        if (conteudo.length > 0) {
          await conn.query(
            "INSERT INTO empresas_conteudos (conteudo_id, empresa_id, usuario_id, status, concluido_em) VALUES (?, ?, ?, 'concluido', NOW())",
            [conteudo[0].id, empresa_id, viewer_id]
          );
        }
      }

      await conn.commit();

      res.json({
        sucesso: true,
        mensagem: "Grupo marcado como concluído com sucesso!",
        grupo_id: grupo_id,
        progresso: {
          concluidos: totalConcluidos,
          total: totalConteudos,
          porcentagem: 100
        }
      });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao forçar conclusão do grupo." });
  }
});

module.exports = router;
