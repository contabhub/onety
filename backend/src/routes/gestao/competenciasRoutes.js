const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../../config/database");
const cloudinary = require("../../config/cloudinary");
const { autenticarToken } = require("../../middlewares/auth");

// Middleware para validar se a empresa é franqueadora
async function validarFranqueadora(req, res, next) {
  const empresaId = req.usuario?.empresaId || req.body.empresaId || req.query.empresaId;
  if (!empresaId) return res.status(400).json({ error: "Empresa não informada" });
  
  try {
    const [rows] = await db.query("SELECT tipo_empresa FROM empresas WHERE id = ?", [empresaId]);
    if (!rows.length || rows[0].tipo_empresa !== "franqueadora") {
      return res.status(403).json({ error: "Acesso restrito à franqueadora" });
    }
    req.franqueadoraId = empresaId;
    next();
  } catch (error) {
    console.error("Erro ao validar franqueadora:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

// Configuração do multer para upload de arquivos
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limite
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas PDFs
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são permitidos"), false);
    }
  },
});

// =====================================================
// 🗃️ ROTAS DE COMPETÊNCIAS
// =====================================================

// GET /api/competencias - Listar todas as competências
router.get("/", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { status, mes_apuracao } = req.query;
    const empresaId = req.franqueadoraId;

    let query = `
      SELECT 
        c.id,
        c.mes_apuracao,
        c.descricao,
        c.status,
        c.criado_em,
        c.atualizado_em,
        COUNT(ca.id) as total_arquivos,
        SUM(CASE WHEN ca.tipo_arquivo = 'application/pdf' THEN 1 ELSE 0 END) as total_pdfs,
        SUM(ca.tamanho_bytes) as tamanho_total_bytes
      FROM competencias c
      LEFT JOIN competencia_arquivos ca ON c.id = ca.competencia_id
      WHERE c.empresaId = ?
    `;
    
    const params = [empresaId];

    if (status) {
      query += " AND c.status = ?";
      params.push(status);
    }

    if (mes_apuracao) {
      query += " AND c.mes_apuracao = ?";
      params.push(mes_apuracao);
    }

    query += " GROUP BY c.id ORDER BY c.mes_apuracao DESC";

    const [competencias] = await db.query(query, params);

    res.json({
      success: true,
      data: competencias,
      total: competencias.length
    });
  } catch (error) {
    console.error("Erro ao listar competências:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/competencias/:id - Obter competência específica
router.get("/:id", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.franqueadoraId;

    // Buscar competência
    const [competencias] = await db.query(`
      SELECT 
        c.id,
        c.mes_apuracao,
        c.descricao,
        c.status,
        c.criado_em,
        c.atualizado_em
      FROM competencias c
      WHERE c.id = ? AND c.empresaId = ?
    `, [id, empresaId]);

    if (!competencias.length) {
      return res.status(404).json({ error: "Competência não encontrada" });
    }

    // Buscar arquivos da competência
    const [arquivos] = await db.query(`
      SELECT 
        id,
        nome_original,
        nome_arquivo,
        url_cloudinary,
        tipo_arquivo,
        tamanho_bytes,
        categoria,
        descricao,
        criado_em,
        atualizado_em
      FROM competencia_arquivos
      WHERE competencia_id = ?
      ORDER BY criado_em DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...competencias[0],
        arquivos
      }
    });
  } catch (error) {
    console.error("Erro ao obter competência:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/competencias - Criar nova competência
router.post("/", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { mes_apuracao, descricao } = req.body;
    const empresaId = req.franqueadoraId;

    // Validar dados obrigatórios
    if (!mes_apuracao) {
      return res.status(400).json({ error: "Mês de apuração é obrigatório" });
    }

    // Validar formato do mês (YYYY-MM)
    const mesRegex = /^\d{4}-\d{2}$/;
    if (!mesRegex.test(mes_apuracao)) {
      return res.status(400).json({ error: "Formato do mês deve ser YYYY-MM (ex: 2025-01)" });
    }

    // Verificar se já existe competência para este mês
    const [existentes] = await db.query(
      "SELECT id FROM competencias WHERE empresaId = ? AND mes_apuracao = ?",
      [empresaId, mes_apuracao]
    );

    if (existentes.length > 0) {
      return res.status(409).json({ error: "Já existe uma competência para este mês" });
    }

    // Criar competência
    const [result] = await db.query(
      "INSERT INTO competencias (empresaId, mes_apuracao, descricao) VALUES (?, ?, ?)",
      [empresaId, mes_apuracao, descricao || null]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        mes_apuracao,
        descricao,
        status: "ativa"
      },
      message: "Competência criada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao criar competência:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// PUT /api/competencias/:id - Atualizar competência
router.put("/:id", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { id } = req.params;
    const { mes_apuracao, descricao, status } = req.body;
    const empresaId = req.franqueadoraId;

    // Verificar se a competência existe
    const [competencias] = await db.query(
      "SELECT id FROM competencias WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    if (!competencias.length) {
      return res.status(404).json({ error: "Competência não encontrada" });
    }

    // Validar formato do mês se fornecido
    if (mes_apuracao) {
      const mesRegex = /^\d{4}-\d{2}$/;
      if (!mesRegex.test(mes_apuracao)) {
        return res.status(400).json({ error: "Formato do mês deve ser YYYY-MM (ex: 2025-01)" });
      }

      // Verificar se já existe outra competência para este mês
      const [existentes] = await db.query(
        "SELECT id FROM competencias WHERE empresaId = ? AND mes_apuracao = ? AND id != ?",
        [empresaId, mes_apuracao, id]
      );

      if (existentes.length > 0) {
        return res.status(409).json({ error: "Já existe uma competência para este mês" });
      }
    }

    // Validar status se fornecido
    if (status && !["ativa", "inativa"].includes(status)) {
      return res.status(400).json({ error: "Status deve ser 'ativa' ou 'inativa'" });
    }

    // Construir query de atualização
    const updates = [];
    const params = [];

    if (mes_apuracao) {
      updates.push("mes_apuracao = ?");
      params.push(mes_apuracao);
    }
    if (descricao !== undefined) {
      updates.push("descricao = ?");
      params.push(descricao);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    params.push(id);

    await db.query(
      `UPDATE competencias SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: "Competência atualizada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao atualizar competência:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /api/competencias/:id - Excluir competência
router.delete("/:id", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.franqueadoraId;

    // Verificar se a competência existe
    const [competencias] = await db.query(
      "SELECT id FROM competencias WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    if (!competencias.length) {
      return res.status(404).json({ error: "Competência não encontrada" });
    }

    // Buscar arquivos para deletar do Cloudinary
    const [arquivos] = await db.query(
      "SELECT public_id_cloudinary FROM competencia_arquivos WHERE competencia_id = ?",
      [id]
    );

    // Deletar arquivos do Cloudinary
    for (const arquivo of arquivos) {
      if (arquivo.public_id_cloudinary) {
        try {
          await cloudinary.uploader.destroy(arquivo.public_id_cloudinary);
        } catch (error) {
          console.error("Erro ao deletar arquivo do Cloudinary:", error);
        }
      }
    }

    // Deletar competência (cascade deletará os arquivos)
    await db.query("DELETE FROM competencias WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Competência excluída com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir competência:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// =====================================================
// 📎 ROTAS DE ARQUIVOS
// =====================================================

// POST /api/competencias/:id/arquivos - Upload de arquivo
router.post("/:id/arquivos", autenticarToken, validarFranqueadora, upload.single("arquivo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { categoria, descricao } = req.body;
    const empresaId = req.franqueadoraId;

    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // Verificar se a competência existe
    const [competencias] = await db.query(
      "SELECT id FROM competencias WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    if (!competencias.length) {
      return res.status(404).json({ error: "Competência não encontrada" });
    }

    // Upload para Cloudinary - múltiplas tentativas
    let result;
    let urlVisualizacao;
    
    try {
      // Tentativa 1: Upload como imagem (pode funcionar para PDFs em algumas contas)
      result = await cloudinary.uploader.upload(req.file.path, {
        folder: `competencias/${empresaId}/${id}`,
        public_id: `arquivo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resource_type: "image",
        format: "pdf"
      });
      urlVisualizacao = result.secure_url;
      console.log("Upload como imagem bem-sucedido");
    } catch (imageError) {
      console.log("Upload como imagem falhou, tentando como raw:", imageError.message);
      
      try {
        // Tentativa 2: Upload como raw
        result = await cloudinary.uploader.upload(req.file.path, {
          folder: `competencias/${empresaId}/${id}`,
          public_id: `arquivo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          resource_type: "raw"
        });
        urlVisualizacao = result.secure_url;
        console.log("Upload como raw bem-sucedido");
      } catch (rawError) {
        console.log("Upload como raw falhou, tentando upload básico:", rawError.message);
        
        // Tentativa 3: Upload básico (sem configurações especiais)
        result = await cloudinary.uploader.upload(req.file.path, {
          folder: `competencias/${empresaId}/${id}`,
          public_id: `arquivo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        urlVisualizacao = result.secure_url;
        console.log("Upload básico bem-sucedido");
      }
    }

    // Salvar informações no banco
    const [insertResult] = await db.query(
      `INSERT INTO competencia_arquivos (
        competencia_id, nome_original, nome_arquivo, url_cloudinary, 
        tipo_arquivo, tamanho_bytes, public_id_cloudinary, categoria, descricao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.file.originalname,
        result.public_id,
        result.secure_url,
        req.file.mimetype,
        req.file.size,
        result.public_id,
        categoria || null,
        null
      ]
    );

    // Remover arquivo temporário
    const fs = require("fs");
    fs.unlinkSync(req.file.path);
    
    res.status(201).json({
      success: true,
      data: {
        id: insertResult.insertId,
        nome_original: req.file.originalname,
        url_cloudinary: result.secure_url,
        url_visualizacao: urlVisualizacao,
        url_publica: result.url,
        tipo_arquivo: req.file.mimetype,
        tamanho_bytes: req.file.size,
        categoria,
        public_id: result.public_id
      },
      message: "Arquivo enviado com sucesso"
    });
  } catch (error) {
    console.error("Erro ao fazer upload do arquivo:", error);
    
    // Remover arquivo temporário em caso de erro
    if (req.file && req.file.path) {
      const fs = require("fs");
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Erro ao remover arquivo temporário:", unlinkError);
      }
    }
    
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /api/competencias/:id/arquivos/:arquivoId - Excluir arquivo
router.delete("/:id/arquivos/:arquivoId", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const { id, arquivoId } = req.params;
    const empresaId = req.franqueadoraId;

    // Verificar se a competência existe
    const [competencias] = await db.query(
      "SELECT id FROM competencias WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    if (!competencias.length) {
      return res.status(404).json({ error: "Competência não encontrada" });
    }

    // Buscar arquivo
    const [arquivos] = await db.query(
      "SELECT public_id_cloudinary FROM competencia_arquivos WHERE id = ? AND competencia_id = ?",
      [arquivoId, id]
    );

    if (!arquivos.length) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    // Deletar do Cloudinary
    if (arquivos[0].public_id_cloudinary) {
      try {
        await cloudinary.uploader.destroy(arquivos[0].public_id_cloudinary);
      } catch (error) {
        console.error("Erro ao deletar arquivo do Cloudinary:", error);
      }
    }

    // Deletar do banco
    await db.query("DELETE FROM competencia_arquivos WHERE id = ?", [arquivoId]);

    res.json({
      success: true,
      message: "Arquivo excluído com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/competencias/estatisticas - Obter estatísticas
router.get("/estatisticas/geral", autenticarToken, validarFranqueadora, async (req, res) => {
  try {
    const empresaId = req.franqueadoraId;

    // Consulta direta sem procedure
    const [stats] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM competencias WHERE empresaId = ? AND status = 'ativa') as total_competencias_ativas,
        (SELECT COUNT(*) FROM competencias WHERE empresaId = ? AND status = 'inativa') as total_competencias_inativas,
        (SELECT COUNT(*) FROM competencia_arquivos ca 
         JOIN competencias c ON ca.competencia_id = c.id 
         WHERE c.empresaId = ?) as total_arquivos,
        (SELECT COUNT(*) FROM competencia_arquivos ca 
         JOIN competencias c ON ca.competencia_id = c.id 
         WHERE c.empresaId = ? AND ca.tipo_arquivo = 'application/pdf') as total_pdfs,
        (SELECT COALESCE(SUM(ca.tamanho_bytes), 0) FROM competencia_arquivos ca 
         JOIN competencias c ON ca.competencia_id = c.id 
         WHERE c.empresaId = ?) as tamanho_total_bytes
    `, [empresaId, empresaId, empresaId, empresaId, empresaId]);

    // Converter tamanho para MB
    const tamanhoTotalMB = stats[0].tamanho_total_bytes 
      ? (stats[0].tamanho_total_bytes / (1024 * 1024)).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        ...stats[0],
        tamanho_total_mb: tamanhoTotalMB
      }
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
