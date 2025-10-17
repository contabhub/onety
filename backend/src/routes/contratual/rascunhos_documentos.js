const express = require('express');
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// Util: format ISO -> MySQL DATETIME
function toMySQLDateTime(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

// POST /contratual/rascunhos-documentos → cria/atualiza rascunho na tabela documentos
router.post('/', verifyToken, async (req, res) => {
  try {
    const createdBy = req.user.id;
    const {
      empresa_id,
      template_id,
      cliente_id,
      content,
      signatarios,
      expires_at,
      start_at,
      end_at
    } = req.body;

    if (!empresa_id) return res.status(400).json({ error: 'empresa_id é obrigatório' });

    // Para rascunho, não vamos setar expirado_em automaticamente.
    const exp = null;
    const start = toMySQLDateTime(start_at);
    const end = toMySQLDateTime(end_at);

    // Verifica rascunho existente para o mesmo usuário/cliente/empresa
    const [[existing]] = await db.query(
      `SELECT id FROM documentos 
       WHERE status = 'rascunho' AND pre_cliente_id = ? AND criado_por = ? AND empresa_id = ?`,
      [cliente_id || null, createdBy, empresa_id]
    );

    let documentId;
    if (existing) {
      await db.query(
        `UPDATE documentos SET 
          modelos_contrato_id = ?,
          conteudo = ?,
          status = 'rascunho',
          expirado_em = ?,
          comeca_em = ?,
          termina_em = ?
        WHERE id = ?`,
        [template_id || null, content || '', exp, start, end, existing.id]
      );
      documentId = existing.id;
    } else {
      const [result] = await db.query(
        `INSERT INTO documentos (
          modelos_contrato_id, conteudo, status, criado_por, pre_cliente_id, expirado_em, comeca_em, termina_em, empresa_id
        ) VALUES (?, ?, 'rascunho', ?, ?, ?, ?, ?, ?)`,
        [template_id || null, content || '', createdBy, cliente_id || null, exp, start, end, empresa_id]
      );
      documentId = result.insertId;
    }

    // Atualiza signatários (limpa e recria)
    if (Array.isArray(signatarios)) {
      await db.query(`DELETE FROM signatarios WHERE documento_id = ?`, [documentId]);
      for (const s of signatarios) {
        const birth = s.birth_date && s.birth_date.trim() ? s.birth_date : null;
        await db.query(
          `INSERT INTO signatarios (documento_id, nome, email, cpf, data_nascimento, telefone, empresa_id, funcao_assinatura)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [documentId, s.name || null, s.email || null, s.cpf || null, birth, s.telefone || null, empresa_id, s.funcao_assinatura || null]
        );
      }
    }

    return res.status(201).json({ message: 'Rascunho salvo', document_id: documentId, is_update: !!existing });
  } catch (err) {
    console.error('❌ Erro ao salvar rascunho de documento:', err);
    return res.status(500).json({ error: 'Erro ao salvar rascunho de documento.' });
  }
});

// PUT /contratual/rascunhos-documentos/:id → atualiza rascunho de documentos
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      empresa_id,
      template_id,
      cliente_id,
      content,
      signatarios,
      expires_at,
      start_at,
      end_at
    } = req.body;

    console.log("🔄 [PUT] Iniciando atualização de rascunho de documento");
    console.log("🔄 [PUT] ID:", id);
    console.log("🔄 [PUT] User ID:", userId);
    console.log("🔄 [PUT] Empresa ID:", empresa_id);
    console.log("🔄 [PUT] Template ID:", template_id);
    console.log("🔄 [PUT] Cliente ID:", cliente_id);
    console.log("🔄 [PUT] Content length:", content ? content.length : 0);
    console.log("🔄 [PUT] Signatários:", signatarios ? signatarios.length : 0);

    if (!empresa_id) {
      console.log("❌ [PUT] Empresa ID não fornecido");
      return res.status(400).json({ error: 'empresa_id é obrigatório' });
    }

    // Verifica se o rascunho existe e pertence ao usuário
    console.log("🔍 [PUT] Verificando se rascunho existe...");
    const [[doc]] = await db.query(`SELECT * FROM documentos WHERE id = ? AND status = 'rascunho' AND criado_por = ?`, [id, userId]);
    
    if (!doc) {
      console.log("❌ [PUT] Rascunho não encontrado para ID:", id, "e usuário:", userId);
      return res.status(404).json({ error: 'Rascunho não encontrado' });
    }
    
    console.log("✅ [PUT] Rascunho encontrado:", {
      id: doc.id,
      status: doc.status,
      criado_por: doc.criado_por,
      pre_cliente_id: doc.pre_cliente_id
    });

    // Para rascunho, não vamos setar expirado_em automaticamente.
    const exp = null;
    const start = toMySQLDateTime(start_at);
    const end = toMySQLDateTime(end_at);

    console.log("🔄 [PUT] Datas processadas:", {
      expirado_em: exp,
      comeca_em: start,
      termina_em: end
    });

    // Atualiza o rascunho
    console.log("🔄 [PUT] Atualizando documento na base de dados...");
    const [updateResult] = await db.query(
      `UPDATE documentos SET 
        modelos_contrato_id = ?,
        conteudo = ?,
        status = 'rascunho',
        expirado_em = ?,
        comeca_em = ?,
        termina_em = ?
      WHERE id = ?`,
      [template_id || null, content || '', exp, start, end, id]
    );
    
    console.log("✅ [PUT] Documento atualizado:", {
      affectedRows: updateResult.affectedRows,
      changedRows: updateResult.changedRows
    });

    // Atualiza signatários (limpa e recria)
    if (Array.isArray(signatarios)) {
      console.log("🔄 [PUT] Atualizando signatários...");
      console.log("🔄 [PUT] Removendo signatários antigos...");
      
      const [deleteResult] = await db.query(`DELETE FROM signatarios WHERE documento_id = ?`, [id]);
      console.log("✅ [PUT] Signatários removidos:", deleteResult.affectedRows);
      
      console.log("🔄 [PUT] Inserindo novos signatários...");
      for (let i = 0; i < signatarios.length; i++) {
        const signatory = signatarios[i];
        const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
        const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

        console.log(`🔄 [PUT] Processando signatário ${i + 1}:`, {
          name: name || 'N/A',
          email: email || 'N/A',
          cpf: cpf || 'N/A'
        });

        if (!name || name.trim() === "") {
          console.log(`⚠️ [PUT] Signatário ${i + 1} ignorado - nome vazio`);
          continue;
        }

        const [insertResult] = await db.query(
          `INSERT INTO signatarios (
            documento_id, nome, email, cpf, data_nascimento,
            telefone, funcao_assinatura, empresa_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, name, email, cpf, birthDateToSave, telefone, funcao_assinatura, empresa_id]
        );
        
        console.log(`✅ [PUT] Signatário ${i + 1} inserido com ID:`, insertResult.insertId);
      }
      
      console.log("✅ [PUT] Todos os signatários processados");
    } else {
      console.log("⚠️ [PUT] Nenhum signatário fornecido ou formato inválido");
    }

    console.log("✅ [PUT] Rascunho atualizado com sucesso!");
    return res.status(200).json({ message: 'Rascunho atualizado com sucesso!', id: id });
  } catch (err) {
    console.error('❌ [PUT] Erro ao atualizar rascunho de documento:', err);
    return res.status(500).json({ error: 'Erro ao atualizar rascunho de documento.' });
  }
});

// GET /contratual/rascunhos-documentos/:id → carrega rascunho de documentos
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [[doc]] = await db.query(`
      SELECT d.*, pc.funcionario, pc.departamento_id, pc.cargo_id, pc.nome as cliente_nome, pc.email as cliente_email
      FROM documentos d
      LEFT JOIN pre_clientes pc ON d.pre_cliente_id = pc.id
      WHERE d.id = ? AND d.status = 'rascunho'
    `, [id]);
    
    if (!doc) return res.status(404).json({ error: 'Rascunho não encontrado' });
    if (String(doc.criado_por) !== String(userId)) return res.status(403).json({ error: 'Acesso negado' });

    console.log("🔍 [DEBUG] Documento encontrado:", doc);

    const [signatarios] = await db.query(`SELECT * FROM signatarios WHERE documento_id = ?`, [id]);
    console.log("🔍 [DEBUG] Signatários encontrados:", signatarios);

    return res.json({
      id: doc.id,
      cliente_id: doc.pre_cliente_id,
      template_id: doc.modelos_contrato_id,
      content: doc.conteudo,
      empresa_id: doc.empresa_id,
      expires_at: doc.expirado_em,
      start_at: doc.comeca_em,
      end_at: doc.termina_em,
      nome_documento: doc.nome_documento || null,
      funcionario: doc.funcionario || 0,
      funcionario_data: doc.funcionario ? {
        nome: doc.cliente_nome || "",
        email: doc.cliente_email || "",
        departamento_id: doc.departamento_id || "",
        cargo_id: doc.cargo_id || ""
      } : null,
      signatarios: signatarios.map(s => ({
        name: s.nome, email: s.email, cpf: s.cpf, birth_date: s.data_nascimento, telefone: s.telefone, funcao_assinatura: s.funcao_assinatura
      }))
    });
  } catch (err) {
    console.error('❌ Erro ao carregar rascunho de documento:', err);
    return res.status(500).json({ error: 'Erro ao carregar rascunho de documento.' });
  }
});

// DELETE /contratual/rascunhos-documentos/:id → exclui rascunho de documentos
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [[doc]] = await db.query(`SELECT id, status, criado_por FROM documentos WHERE id = ?`, [id]);
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });
    if (doc.status !== 'rascunho') return res.status(400).json({ error: 'Apenas rascunhos podem ser deletados' });
    if (String(doc.criado_por) !== String(userId)) return res.status(403).json({ error: 'Acesso negado' });

    await db.query(`DELETE FROM signatarios WHERE documento_id = ?`, [id]);
    await db.query(`DELETE FROM documentos WHERE id = ?`, [id]);
    return res.json({ message: 'Rascunho deletado' });
  } catch (err) {
    console.error('❌ Erro ao deletar rascunho de documento:', err);
    return res.status(500).json({ error: 'Erro ao deletar rascunho de documento.' });
  }
});

module.exports = router;


