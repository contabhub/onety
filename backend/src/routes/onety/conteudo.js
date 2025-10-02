const express = require("express");
const multer = require("multer");
const pool = require("../../config/database");
const cloudinary = require("../../config/cloudinary");

// Configuração do multer para upload de arquivos (vídeos e PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/', 'application/pdf'];
    if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de vídeo e PDF são permitidos"), false);
    }
  },
});

const router = express.Router();

// Lista conteúdos com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;
    const grupoId = req.query.grupo_id ? Number(req.query.grupo_id) : null;

    let query = `
      SELECT SQL_CALC_FOUND_ROWS 
        c.id, 
        c.titulo, 
        c.descricao, 
        c.url, 
        c.tipo,
        c.obrigatorio,
        c.ordem, 
        c.ativo,
        c.grupo_id,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM conteudos c
      LEFT JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN modulos m ON g.modulo_id = m.id
    `;
    let params = [];

    if (grupoId) {
      query += " WHERE c.grupo_id = ?";
      params.push(grupoId);
    }

    query += " ORDER BY c.ordem ASC, c.id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar conteúdos." });
  }
});

// Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 
        c.id, 
        c.titulo, 
        c.descricao, 
        c.url, 
        c.tipo,
        c.obrigatorio,
        c.ordem, 
        c.ativo,
        c.grupo_id,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM conteudos c
      LEFT JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE c.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar conteúdo." });
  }
});

// Criar conteúdo com upload de arquivo
router.post("/", upload.single("arquivo"), async (req, res) => {
  try {
    const { 
      titulo, 
      descricao = null, 
      grupo_id = null, 
      tipo = 'texto',
      url: urlBody = null, 
      obrigatorio = 1,
      ordem = 1, 
      ativo = 1 
    } = req.body || {};
    
    if (!titulo) return res.status(400).json({ error: "Campo obrigatório: titulo." });
    if (!grupo_id) return res.status(400).json({ error: "Campo obrigatório: grupo_id." });

    let finalUrl = urlBody;

    // Se foi enviado um arquivo, envia para Cloudinary
    if (req.file) {
      try {
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'raw';
        const uploaded = await cloudinary.uploader.upload(base64, {
          folder: "onety/onboarding/conteudos",
          resource_type: resourceType,
        });
        finalUrl = uploaded?.secure_url || finalUrl;
      } catch (err) {
        console.error("Erro ao enviar arquivo para Cloudinary:", err);
        return res.status(400).json({ error: "Falha no upload do arquivo." });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO conteudos (titulo, descricao, url, tipo, grupo_id, obrigatorio, ordem, ativo) VALUES (?,?,?,?,?,?,?,?)`,
      [titulo, descricao, finalUrl, tipo, grupo_id, obrigatorio, ordem, ativo]
    );

    const [created] = await pool.query(
      `SELECT 
        c.id, 
        c.titulo, 
        c.descricao, 
        c.url, 
        c.tipo,
        c.obrigatorio,
        c.ordem, 
        c.ativo,
        c.grupo_id,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM conteudos c
      LEFT JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE c.id = ?`,
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar conteúdo." });
  }
});

// Atualização parcial com possibilidade de novo upload
router.patch("/:id", upload.single("arquivo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      titulo, 
      descricao, 
      grupo_id, 
      tipo,
      url: urlBody, 
      obrigatorio,
      ordem, 
      ativo 
    } = req.body || {};

    let finalUrl = urlBody;
    if (req.file) {
      try {
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'raw';
        const uploaded = await cloudinary.uploader.upload(base64, {
            folder: "onety/onboarding/conteudos",
            resource_type: resourceType,
        });
        finalUrl = uploaded?.secure_url || finalUrl;
      } catch (err) {
        console.error("Erro ao enviar arquivo para Cloudinary:", err);
        return res.status(400).json({ error: "Falha no upload do arquivo." });
      }
    }

    // Monta atualização dinâmica
    const fields = [];
    const values = [];
    if (titulo !== undefined) { fields.push("titulo = ?"); values.push(titulo); }
    if (finalUrl !== undefined) { fields.push("url = ?"); values.push(finalUrl); }
    if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
    if (tipo !== undefined) { fields.push("tipo = ?"); values.push(tipo); }
    if (grupo_id !== undefined) { fields.push("grupo_id = ?"); values.push(grupo_id); }
    if (obrigatorio !== undefined) { fields.push("obrigatorio = ?"); values.push(obrigatorio); }
    if (ordem !== undefined) { fields.push("ordem = ?"); values.push(ordem); }
    if (ativo !== undefined) { fields.push("ativo = ?"); values.push(ativo); }
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    values.push(id);
    await pool.query(`UPDATE conteudos SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query(
      `SELECT 
        c.id, 
        c.titulo, 
        c.descricao, 
        c.url, 
        c.tipo,
        c.obrigatorio,
        c.ordem, 
        c.ativo,
        c.grupo_id,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM conteudos c
      LEFT JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE c.id = ?`,
      [id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar conteúdo." });
  }
});

// Rota especial: Marcar conteúdo como concluído para uma empresa
router.patch("/:id/concluir", async (req, res) => {
  try {
    const { id } = req.params;
    const { empresa_id, usuario_id } = req.body || {};
    
    if (!empresa_id) {
      return res.status(400).json({ error: "Campo obrigatório: empresa_id." });
    }

    // Iniciar transação
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Buscar grupo_id do conteúdo
      const [conteudoRows] = await conn.query(
        "SELECT grupo_id FROM conteudos WHERE id = ?",
        [id]
      );
      
      if (conteudoRows.length === 0) {
        throw new Error("Conteúdo não encontrado");
      }
      
      const grupoId = conteudoRows[0].grupo_id;

      // 2. Marcar conteúdo como concluído na empresa_conteudo
      const [existeRegistro] = await conn.query(
        "SELECT id FROM empresa_conteudo WHERE conteudo_id = ? AND empresa_id = ?",
        [id, empresa_id]
      );

      if (existeRegistro.length > 0) {
        // Atualizar registro existente
        await conn.query(
          "UPDATE empresa_conteudo SET status = 'concluido', usuario_id = ?, concluido_em = NOW() WHERE id = ?",
          [usuario_id, existeRegistro[0].id]
        );
      } else {
        // Criar novo registro
        await conn.query(
          "INSERT INTO empresa_conteudo (conteudo_id, empresa_id, usuario_id, status, concluido_em) VALUES (?, ?, ?, 'concluido', NOW())",
          [id, empresa_id, usuario_id]
        );
      }

      // 3. Verificar se todos os conteúdos obrigatórios do grupo foram concluídos
      const [todosConteudos] = await conn.query(
        "SELECT COUNT(*) as total FROM conteudos WHERE grupo_id = ? AND obrigatorio = 1 AND ativo = 1",
        [grupoId]
      );
      
      const [conteudosConcluidos] = await conn.query(
        `SELECT COUNT(*) as concluidos 
         FROM conteudos c
         INNER JOIN empresa_conteudo ec ON c.id = ec.conteudo_id 
         WHERE c.grupo_id = ? AND c.obrigatorio = 1 AND c.ativo = 1 AND ec.status = 'concluido' AND ec.empresa_id = ?`,
        [grupoId, empresa_id]
      );

      const totalConteudos = todosConteudos[0].total;
      const totalConcluidos = conteudosConcluidos[0].concluidos;

      // 4. Se todos os conteúdos obrigatórios foram concluídos, marcar grupo como concluído
      if (totalConcluidos === totalConteudos && totalConteudos > 0) {
        const [existeGrupoRegistro] = await conn.query(
          "SELECT id FROM empresa_grupo WHERE grupo_id = ? AND empresa_id = ?",
          [grupoId, empresa_id]
        );

        if (existeGrupoRegistro.length > 0) {
          // Atualizar registro existente
          await conn.query(
            "UPDATE empresa_grupo SET status = 'concluido', concluido_em = NOW() WHERE id = ?",
            [existeGrupoRegistro[0].id]
          );
        } else {
          // Criar novo registro
          await conn.query(
            "INSERT INTO empresa_grupo (grupo_id, empresa_id, status, concluido_em) VALUES (?, ?, 'concluido', NOW())",
            [grupoId, empresa_id]
          );
        }
      }

      await conn.commit();

      res.json({ 
        success: true,
        grupo_completo: totalConcluidos === totalConteudos,
        progresso: { concluidos: totalConcluidos, total: totalConteudos }
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao marcar conteúdo como concluído." });
  }
});

// Rota especial: Reordenar conteúdos de um grupo
router.patch("/grupo/:grupo_id/reordenar", async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { conteudos } = req.body || {};
    
    if (!Array.isArray(conteudos)) {
      return res.status(400).json({ error: "Campo 'conteudos' deve ser um array." });
    }

    // Iniciar transação
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Atualizar ordem de cada conteúdo
      for (let i = 0; i < conteudos.length; i++) {
        const { id, ordem } = conteudos[i];
        if (id && ordem !== undefined) {
          await conn.query(
            "UPDATE conteudos SET ordem = ? WHERE id = ? AND grupo_id = ?",
            [ordem, id, grupo_id]
          );
        }
      }

      await conn.commit();

      // Buscar conteúdos atualizados
      const [updated] = await pool.query(
        `SELECT 
          c.id, 
          c.titulo, 
          c.descricao, 
          c.url, 
          c.tipo,
          c.obrigatorio,
          c.ordem, 
          c.ativo,
          c.grupo_id,
          g.nome as grupo_nome,
          m.nome as modulo_nome
        FROM conteudos c
        LEFT JOIN grupos g ON c.grupo_id = g.id
        LEFT JOIN modulos m ON g.modulo_id = m.id
        WHERE c.grupo_id = ? 
        ORDER BY c.ordem ASC, c.id ASC`,
        [grupo_id]
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
    res.status(500).json({ error: "Erro ao reordenar conteúdos." });
  }
});

// Remover conteúdo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM conteudos WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover conteúdo." });
  }
});

module.exports = router;