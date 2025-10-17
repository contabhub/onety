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

// GET /contratual/rascunhos-documentos/:id → carrega rascunho de documentos
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [[doc]] = await db.query(`SELECT * FROM documentos WHERE id = ? AND status = 'rascunho'`, [id]);
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
      funcionario: doc.funcionario,
      funcionario_data: doc.funcionario_data ? JSON.parse(doc.funcionario_data) : null,
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


