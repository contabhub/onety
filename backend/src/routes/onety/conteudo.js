const express = require("express");
const multer = require("multer");
const pool = require("../../config/database");
const cloudinary = require("../../config/cloudinary");

// Configuração do multer para upload de arquivos (vídeos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de vídeo são permitidos"), false);
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
    const grupoConteudoId = req.query.grupo_conteudo_id ? Number(req.query.grupo_conteudo_id) : null;

    let query = "SELECT SQL_CALC_FOUND_ROWS id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo";
    let params = [];

    if (grupoConteudoId) {
      query += " WHERE grupo_conteudo_id = ?";
      params.push(grupoConteudoId);
    }

    query += " ORDER BY ordem ASC, id ASC LIMIT ? OFFSET ?";
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
      "SELECT id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar conteúdo." });
  }
});

// Criar conteúdo com upload de vídeo (campo multipart: file=\"video\")
router.post("/", upload.single("video"), async (req, res) => {
  try {
    const { nome, descricao = null, grupo_conteudo_id = null, link: linkBody = null, ordem = null, concluido = 0 } = req.body || {};
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome." });

    let finalVideoUrl = linkBody;

    // Se foi enviado um arquivo de vídeo, envia para Cloudinary
    if (req.file) {
      try {
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const uploaded = await cloudinary.uploader.upload(base64, {
          folder: "onety/onboarding/conteudos",
          resource_type: "video",
        });
        finalVideoUrl = uploaded?.secure_url || finalVideoUrl;
      } catch (err) {
        console.error("Erro ao enviar vídeo para Cloudinary:", err);
        return res.status(400).json({ error: "Falha no upload do vídeo." });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO conteudo (nome, link, descricao, grupo_conteudo_id, ordem, concluido) VALUES (?,?,?,?,?,?)`,
      [nome, finalVideoUrl, descricao, grupo_conteudo_id, ordem, concluido]
    );

    const [created] = await pool.query(
      "SELECT id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar conteúdo." });
  }
});

// Atualização parcial com possibilidade de novo upload
router.patch("/:id", upload.single("video"), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, grupo_conteudo_id, link: linkBody, ordem, concluido } = req.body || {};

    let finalVideoUrl = linkBody;
    if (req.file) {
      try {
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const uploaded = await cloudinary.uploader.upload(base64, {
            folder: "onety/onboarding/conteudos",
            resource_type: "video",
        });
        finalVideoUrl = uploaded?.secure_url || finalVideoUrl;
      } catch (err) {
        console.error("Erro ao enviar vídeo para Cloudinary:", err);
        return res.status(400).json({ error: "Falha no upload do vídeo." });
      }
    }

    // Monta atualização dinâmica
    const fields = [];
    const values = [];
    if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
    if (finalVideoUrl !== undefined) { fields.push("link = ?"); values.push(finalVideoUrl); }
    if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
    if (grupo_conteudo_id !== undefined) { fields.push("grupo_conteudo_id = ?"); values.push(grupo_conteudo_id); }
    if (ordem !== undefined) { fields.push("ordem = ?"); values.push(ordem); }
    if (concluido !== undefined) { fields.push("concluido = ?"); values.push(concluido); }
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    values.push(id);
    await pool.query(`UPDATE conteudo SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query(
      "SELECT id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo WHERE id = ?",
      [id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar conteúdo." });
  }
});

// Rota especial: Marcar conteúdo como concluído e verificar conclusão do grupo
router.patch("/:id/concluir", async (req, res) => {
  try {
    const { id } = req.params;
    const { viewer_id, empresa_id } = req.body || {};
    
    if (!viewer_id || !empresa_id) {
      return res.status(400).json({ error: "Campos obrigatórios: viewer_id e empresa_id." });
    }

    // Iniciar transação
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // 1. Marcar conteúdo como concluído
      await conn.query(
        "UPDATE conteudo SET concluido = 1 WHERE id = ?",
        [id]
      );

      // 2. Buscar grupo_conteudo_id do conteúdo
      const [conteudoRows] = await conn.query(
        "SELECT grupo_conteudo_id FROM conteudo WHERE id = ?",
        [id]
      );
      
      if (conteudoRows.length === 0) {
        throw new Error("Conteúdo não encontrado");
      }
      
      const grupoConteudoId = conteudoRows[0].grupo_conteudo_id;

      // 3. Verificar se todos os conteúdos do grupo foram concluídos
      const [todosConteudos] = await conn.query(
        "SELECT COUNT(*) as total FROM conteudo WHERE grupo_conteudo_id = ?",
        [grupoConteudoId]
      );
      
      const [conteudosConcluidos] = await conn.query(
        "SELECT COUNT(*) as concluidos FROM conteudo WHERE grupo_conteudo_id = ? AND concluido = 1",
        [grupoConteudoId]
      );

      const totalConteudos = todosConteudos[0].total;
      const totalConcluidos = conteudosConcluidos[0].concluidos;

      // 4. Se todos os conteúdos foram concluídos, marcar grupo como concluído na empresa_conteudo
      if (totalConcluidos === totalConteudos) {
        // Verificar se já existe registro na empresa_conteudo
        const [existeRegistro] = await conn.query(
          "SELECT id FROM empresa_conteudo WHERE grupo_conteudo_id = ? AND empresa_id = ? AND viewer_id = ?",
          [grupoConteudoId, empresa_id, viewer_id]
        );

        if (existeRegistro.length > 0) {
          // Atualizar registro existente
          await conn.query(
            "UPDATE empresa_conteudo SET concluido = 1 WHERE id = ?",
            [existeRegistro[0].id]
          );
        } else {
          // Criar novo registro
          await conn.query(
            "INSERT INTO empresa_conteudo (grupo_conteudo_id, empresa_id, viewer_id, concluido) VALUES (?, ?, ?, 1)",
            [grupoConteudoId, empresa_id, viewer_id]
          );
        }
      }

      await conn.commit();

      // 5. Buscar conteúdo atualizado
      const [updated] = await pool.query(
        "SELECT id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo WHERE id = ?",
        [id]
      );

      res.json({ 
        ...updated[0], 
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
            "UPDATE conteudo SET ordem = ? WHERE id = ? AND grupo_conteudo_id = ?",
            [ordem, id, grupo_id]
          );
        }
      }

      await conn.commit();

      // Buscar conteúdos atualizados
      const [updated] = await pool.query(
        "SELECT id, nome, link, descricao, grupo_conteudo_id, ordem, concluido FROM conteudo WHERE grupo_conteudo_id = ? ORDER BY ordem ASC, id ASC",
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
    const [result] = await pool.query("DELETE FROM conteudo WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover conteúdo." });
  }
});

module.exports = router;