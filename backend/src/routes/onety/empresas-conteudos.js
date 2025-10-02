const express = require('express');
const pool = require('../../config/database');
const verifyToken = require('../../middlewares/auth');
const { verificarPermissao } = require('../../middlewares/permissao');

const router = express.Router();

// Listar conteúdos de uma empresa
router.get("/", verifyToken, async (req, res) => {
  try {
    const { empresa_id, grupo_id } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ error: "Parâmetro obrigatório: empresa_id" });
    }

    let query = `
      SELECT 
        ec.empresa_id,
        ec.conteudo_id,
        ec.usuario_id,
        ec.status,
        ec.concluido_em,
        c.titulo,
        c.descricao,
        c.url,
        c.tipo,
        c.obrigatorio,
        c.ordem,
        c.ativo,
        g.nome as grupo_nome,
        g.id as grupo_id,
        u.nome as usuario_nome
      FROM empresas_conteudos ec
      INNER JOIN conteudos c ON ec.conteudo_id = c.id
      INNER JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN usuarios u ON ec.usuario_id = u.id
      WHERE ec.empresa_id = ?
    `;

    let params = [empresa_id];

    if (grupo_id) {
      query += " AND c.grupo_id = ?";
      params.push(grupo_id);
    }

    query += " ORDER BY c.ordem ASC, c.titulo ASC";

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Erro ao buscar conteúdos da empresa:', error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// Marcar conteúdo como concluído
router.patch("/:empresa_id/:conteudo_id/concluir", verifyToken, async (req, res) => {
  let conn;
  try {
    const { empresa_id, conteudo_id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ error: "Campo obrigatório: usuario_id" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Atualizar status do conteúdo
    await conn.query(
      "UPDATE empresas_conteudos SET status = 'concluido', usuario_id = ?, concluido_em = NOW() WHERE empresa_id = ? AND conteudo_id = ?",
      [usuario_id, empresa_id, conteudo_id]
    );

    // Verificar progresso do grupo - contar apenas conteúdos vinculados à empresa
    const [grupoConteudos] = await conn.query(`
      SELECT 
        c.grupo_id,
        COUNT(ec.conteudo_id) as total,
        SUM(CASE WHEN ec.status = 'concluido' THEN 1 ELSE 0 END) as concluidos
      FROM empresas_conteudos ec
      INNER JOIN conteudos c ON ec.conteudo_id = c.id
      WHERE ec.empresa_id = ? AND c.grupo_id = (
        SELECT grupo_id FROM conteudos WHERE id = ?
      )
      GROUP BY c.grupo_id
    `, [empresa_id, conteudo_id]);

    let grupoCompleto = false;
    let grupoId = null;
    
    if (grupoConteudos.length > 0) {
      const { grupo_id, total, concluidos } = grupoConteudos[0];
      grupoId = grupo_id;
      grupoCompleto = total === parseInt(concluidos);
      
      console.log(`📊 Progresso do grupo ${grupo_id}:`, { total, concluidos, grupoCompleto });

      // Atualizar status do grupo baseado no progresso
      if (grupoCompleto) {
        // Grupo completo
        await conn.query(
          "UPDATE empresas_grupos SET status = 'concluido', concluido_em = NOW() WHERE empresa_id = ? AND grupo_id = ?",
          [empresa_id, grupo_id]
        );
      } else if (concluidos > 0) {
        // Grupo em andamento (pelo menos um conteúdo concluído)
        await conn.query(
          "UPDATE empresas_grupos SET status = 'em_andamento' WHERE empresa_id = ? AND grupo_id = ? AND status = 'bloqueado'",
          [empresa_id, grupo_id]
        );
      }

      // Verificar progresso do módulo se o grupo foi completado
      if (grupoCompleto) {
        const [moduloProgresso] = await conn.query(`
          SELECT 
            g.modulo_id,
            COUNT(*) as total_grupos,
            SUM(CASE WHEN eg.status = 'concluido' THEN 1 ELSE 0 END) as grupos_concluidos
          FROM empresas_grupos eg
          INNER JOIN grupos g ON eg.grupo_id = g.id
          WHERE eg.empresa_id = ? AND g.modulo_id = (
            SELECT modulo_id FROM grupos WHERE id = ?
          )
          GROUP BY g.modulo_id
        `, [empresa_id, grupo_id]);

        console.log(`📊 Progresso do módulo:`, moduloProgresso);

        if (moduloProgresso.length > 0) {
          const { modulo_id, total_grupos, grupos_concluidos } = moduloProgresso[0];
          const moduloCompleto = total_grupos === parseInt(grupos_concluidos);
          
          console.log(`📊 Módulo ${modulo_id}:`, { total_grupos, grupos_concluidos, moduloCompleto });
          
          if (moduloCompleto) {
            // Verificar se todas as provas do módulo foram completadas antes de liberar
            const [provasPendentes] = await conn.query(`
              SELECT COUNT(*) as total_pendentes
              FROM prova_empresa pe
              INNER JOIN prova p ON pe.prova_id = p.id
              INNER JOIN conteudos c ON p.conteudo_id = c.id
              INNER JOIN grupos g ON c.grupo_id = g.id
              WHERE pe.empresa_id = ? 
                AND g.modulo_id = ?
                AND (pe.nota IS NULL OR pe.nota < 7)
              
              UNION ALL
              
              SELECT COUNT(*) as total_pendentes
              FROM prova_empresa pe
              INNER JOIN prova p ON pe.prova_id = p.id
              INNER JOIN grupos g ON p.grupo_id = g.id
              WHERE pe.empresa_id = ? 
                AND g.modulo_id = ?
                AND (pe.nota IS NULL OR pe.nota < 7)
            `, [empresa_id, modulo_id, empresa_id, modulo_id]);

            const totalProvasPendentes = provasPendentes.reduce((sum, row) => sum + parseInt(row.total_pendentes), 0);
            
            console.log(`📊 Provas pendentes no módulo ${modulo_id}:`, { totalProvasPendentes });
            
            if (totalProvasPendentes === 0) {
              // Todas as provas foram completadas - liberar módulo
              console.log(`🎉 Liberando módulo ${modulo_id} para empresa ${empresa_id} - todas as provas completadas`);
              await conn.query(
                "UPDATE modulos_empresa SET status = 'liberado' WHERE empresa_id = ? AND modulo_id = ?",
                [empresa_id, modulo_id]
              );
            } else {
              // Ainda há provas pendentes - módulo não pode ser liberado
              console.log(`⏳ Módulo ${modulo_id} não liberado para empresa ${empresa_id} - ${totalProvasPendentes} provas pendentes`);
            }
          } else if (parseInt(grupos_concluidos) > 0) {
            // Módulo em andamento - pelo menos um grupo concluído
            console.log(`🔄 Módulo ${modulo_id} em andamento para empresa ${empresa_id}`);
            await conn.query(
              "UPDATE modulos_empresa SET status = 'em_andamento' WHERE empresa_id = ? AND modulo_id = ? AND status = 'bloqueado'",
              [empresa_id, modulo_id]
            );
          }
        }
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Conteúdo marcado como concluído",
      grupo_completo: grupoCompleto,
      progresso: grupoConteudos.length > 0 ? grupoConteudos[0] : null,
      grupo_id: grupoId
    });
  } catch (error) {
    console.error('Erro ao marcar conteúdo como concluído:', error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro interno do servidor." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualizar status de um conteúdo
router.patch("/:empresa_id/:conteudo_id", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  try {
    const { empresa_id, conteudo_id } = req.params;
    const { status, usuario_id } = req.body;

    if (!status || !['pendente', 'concluido'].includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use: pendente ou concluido" });
    }

    const concluido_em = status === 'concluido' ? new Date() : null;

    await pool.query(
      "UPDATE empresas_conteudos SET status = ?, usuario_id = ?, concluido_em = ? WHERE empresa_id = ? AND conteudo_id = ?",
      [status, usuario_id, concluido_em, empresa_id, conteudo_id]
    );

    res.json({
      success: true,
      message: `Status do conteúdo atualizado para ${status}`
    });
  } catch (error) {
    console.error('Erro ao atualizar status do conteúdo:', error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
