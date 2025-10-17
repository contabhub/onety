const express = require("express");
const db = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

const router = express.Router();

/**
 * POST /rascunhos - Salvar rascunho de contrato
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      client_id,
      template_id,
      content,
      signatories,
      empresa_id,
      produto_id,
      produtos_dados,
      valor,
      valor_recorrente,
      expires_at,
      start_at,
      end_at,
      nome_documento,
      produtos,
      custom_values,
      dia_vencimento,
      data_primeiro_vencimento,
      valor_contrato,
      valor_recorrente_manual
    } = req.body;

    const createdBy = req.user.id;

    console.log(`🔍 [DEBUG] Salvando rascunho - userId: ${createdBy}, empresa_id: ${empresa_id}, produto_id: ${produto_id}`);
    console.log(`🔍 [DEBUG] Produtos recebidos:`, produtos_dados);

    // Função para converter data ISO para formato MySQL
    const formatDateForMySQL = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 19).replace('T', ' ');
      } catch (error) {
        console.error("Erro ao formatar data:", error);
        return null;
      }
    };

    // Converte as datas para o formato correto
    const expiresAtFormatted = formatDateForMySQL(expires_at);
    const startAtFormatted = formatDateForMySQL(start_at);
    const endAtFormatted = formatDateForMySQL(end_at);

    console.log(`🔍 [DEBUG] Datas formatadas - expires: ${expiresAtFormatted}, start: ${startAtFormatted}, end: ${endAtFormatted}`);

    // Validação básica
    if (!empresa_id) {
      return res.status(400).json({ error: "empresa_id é obrigatório." });
    }

    // Se já existe um rascunho para este cliente e usuário, atualiza
    const [[existingDraft]] = await db.query(
      `SELECT id FROM contratos 
       WHERE status = 'rascunho' 
       AND pre_cliente_id = ? 
       AND criado_por = ? 
       AND empresa_id = ?`,
      [client_id, createdBy, empresa_id]
    );

    let contractId;
    if (existingDraft) {
      // Atualiza rascunho existente - usando apenas colunas que existem
      await db.query(
        `UPDATE contratos SET 
         modelos_contrato_id = ?,
         conteudo = ?,
         produto_id = ?,
         produtos_dados = ?,
         valor = ?,
         valor_recorrente = ?,
         expirado_em = ?,
         comeca_em = ?,
         termina_em = ?
         WHERE id = ?`,
        [
          template_id,
          content,
          produto_id,
          JSON.stringify(produtos_dados || []),
          valor,
          valor_recorrente,
          expiresAtFormatted,
          startAtFormatted,
          endAtFormatted,
          existingDraft.id
        ]
      );
      contractId = existingDraft.id;
    } else {
      // Cria novo rascunho - usando apenas colunas que existem
      const [result] = await db.query(
        `INSERT INTO contratos (
          modelos_contrato_id,
          conteudo,
          status,
          criado_por,
          pre_cliente_id,
          empresa_id,
          produto_id,
          produtos_dados,
          valor,
          valor_recorrente,
          expirado_em,
          comeca_em,
          termina_em
        ) VALUES (?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template_id,
          content,
          createdBy,
          client_id,
          empresa_id,
          produto_id,
          JSON.stringify(produtos_dados || []),
          valor,
          valor_recorrente,
          expiresAtFormatted,
          startAtFormatted,
          endAtFormatted
        ]
      );
      contractId = result.insertId;
    }

    // Salva/atualiza signatários do rascunho
    if (signatories && Array.isArray(signatories)) {
      // Remove signatários existentes do rascunho
      await db.query(
        `DELETE FROM signatarios WHERE contrato_id = ?`,
        [contractId]
      );

      // Adiciona novos signatários
      for (const signatory of signatories) {
        const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
        const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

        console.log(`🔍 [DEBUG] Signatário recebido:`, {
          name: name,
          email: email,
          cpf: cpf,
          birth_date: birth_date,
          telefone: telefone,
          funcao_assinatura: funcao_assinatura
        });

        // Validação básica - não insere se nome estiver vazio
        if (!name || name.trim() === "") {
          console.log(`⚠️ [DEBUG] Pulando signatário sem nome`);
          continue;
        }

        await db.query(
          `INSERT INTO signatarios (
            contrato_id, nome, email, cpf, data_nascimento, 
            telefone, funcao_assinatura, empresa_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [contractId, name, email, cpf, birthDateToSave, telefone, funcao_assinatura, empresa_id]
        );
      }
    }

    console.log(`✅ [DEBUG] Rascunho salvo com sucesso - ID: ${contractId}, is_update: ${!!existingDraft}`);

    res.status(201).json({
      message: "Rascunho salvo com sucesso!",
      contract_id: contractId,
      is_update: !!existingDraft
    });

  } catch (error) {
    console.error("❌ Erro ao salvar rascunho:", error);
    res.status(500).json({ error: "Erro ao salvar rascunho." });
  }
});

/**
 * GET /rascunhos/:id - Buscar rascunho por ID
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const contractId = req.params.id;
    const userId = req.user.id;

    console.log(`🔍 [DEBUG] Buscando rascunho ID: ${contractId}, userId: ${userId}`);

    // Busca o contrato
    const [[contract]] = await db.query(
      `SELECT * FROM contratos WHERE id = ? AND status = 'rascunho'`,
      [contractId]
    );

    console.log(`🔍 [DEBUG] Contrato encontrado:`, contract ? 'SIM' : 'NÃO');
    if (contract) {
      console.log(`🔍 [DEBUG] Criado por: ${contract.criado_por}, Tipo: ${typeof contract.criado_por}`);
    }

    if (!contract) {
      return res.status(404).json({ error: "Rascunho não encontrado." });
    }

    // Verifica se o usuário tem permissão para acessar este rascunho
    if (String(contract.criado_por) !== String(userId)) {
      console.log(`❌ [DEBUG] Acesso negado - userId: ${userId}, criado_por: ${contract.criado_por}`);
      return res.status(403).json({ error: "Acesso negado a este rascunho." });
    }

    // Busca os signatários (apenas os que têm nome preenchido)
    const [signatories] = await db.query(
      `SELECT * FROM signatarios WHERE contrato_id = ? AND nome IS NOT NULL AND nome != ''`,
      [contractId]
    );

    // Parse dos dados JSON salvos
    let produtos = [];
    if (contract.produtos_dados) {
      try {
        // Se já é um objeto, usa diretamente; se é string, faz parse
        if (typeof contract.produtos_dados === 'string') {
          produtos = JSON.parse(contract.produtos_dados);
        } else if (typeof contract.produtos_dados === 'object') {
          produtos = contract.produtos_dados;
        }
      } catch (error) {
        console.error(`❌ [DEBUG] Erro ao fazer parse do produtos_dados:`, error);
        console.log(`🔍 [DEBUG] Valor recebido:`, contract.produtos_dados, typeof contract.produtos_dados);
        produtos = [];
      }
    }
    console.log(`🔍 [DEBUG] Produtos carregados do JSON:`, produtos);

    // Retorna o rascunho com os signatários - apenas campos que existem na tabela
    res.json({
      contract: {
        id: contract.id,
        client_id: contract.pre_cliente_id,
        template_id: contract.modelos_contrato_id,
        content: contract.conteudo,
        empresa_id: contract.empresa_id,
        produto_id: contract.produto_id,
        produtos_dados: produtos,
        valor: contract.valor,
        valor_recorrente: contract.valor_recorrente,
        expires_at: contract.expirado_em,
        start_at: contract.comeca_em,
        end_at: contract.termina_em,
        created_at: contract.criado_em
      },
      signatories: signatories.map(sig => ({
        name: sig.nome,
        email: sig.email,
        cpf: sig.cpf,
        birth_date: sig.data_nascimento,
        telefone: sig.telefone,
        funcao_assinatura: sig.funcao_assinatura
      }))
    });

  } catch (error) {
    console.error("❌ Erro ao buscar rascunho:", error);
    res.status(500).json({ error: "Erro ao buscar rascunho." });
  }
});

/**
 * DELETE /rascunhos/:id - Excluir rascunho
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ [DEBUG] Tentativa de deletar rascunho ${id} pelo usuário ${userId}`);
    console.log(`🔍 [DEBUG] Tipos: id=${typeof id}, userId=${typeof userId}`);

    // Primeiro, vamos verificar se o contrato existe
    const [allContracts] = await db.query(
      `SELECT id, status, criado_por FROM contratos WHERE id = ?`,
      [id]
    );

    console.log(`📋 [DEBUG] Contratos encontrados:`, allContracts);

    if (allContracts.length === 0) {
      console.log(`❌ [DEBUG] Contrato ${id} não existe`);
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    const contract = allContracts[0];
    console.log(`📄 [DEBUG] Contrato encontrado:`, contract);

    // Verificar se é um rascunho
    if (contract.status !== 'rascunho') {
      console.log(`❌ [DEBUG] Contrato ${id} não é um rascunho, status: ${contract.status}`);
      return res.status(400).json({ error: 'Apenas rascunhos podem ser deletados' });
    }

    console.log(`✅ [DEBUG] Rascunho encontrado, prosseguindo com a deleção`);

    // Deletar signatários primeiro (foreign key constraint)
    await db.query(
      `DELETE FROM signatarios WHERE contrato_id = ?`,
      [id]
    );

    // Deletar o contrato
    await db.query(
      `DELETE FROM contratos WHERE id = ?`,
      [id]
    );

    console.log(`✅ [DEBUG] Rascunho ${id} deletado com sucesso`);

    res.json({ message: 'Rascunho deletado com sucesso' });
  } catch (error) {
    console.error('❌ [ERROR] Erro ao deletar rascunho:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
