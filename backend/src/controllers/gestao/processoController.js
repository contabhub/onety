const db = require("../../config/database");

/**
 * Cria um novo processo
 */
const criarProcesso = async (req, res) => {
  try {
    const {
      nome,
      dataReferencia,
      diasMeta,
      diasPrazo,
      departamentoId,
      responsavelId,
      notificarAbertura,
      notificarFinalizacao,
      podeFinalizarAntesSubatendimentos,
      padraoFranqueadora,
    } = req.body;

    const { empresaId, nivel } = req.usuario;
    const isPadrao = padraoFranqueadora || 0;

    if (isPadrao && nivel !== "admin") {
      return res.status(403).json({ error: "Apenas administradores podem criar processos padrão." });
    }

    if (!nome || diasMeta == null || diasPrazo == null) {
      return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }

    let depId = departamentoId;
    let respId = responsavelId;
    let empId = empresaId;
    let departamentoGlobalId = null;

    if (isPadrao) {
      // Buscar o departamento global do departamento informado
      const [[dep]] = await db.query("SELECT departamento_global_id as departamentoGlobalId FROM departamentos WHERE id = ?", [departamentoId]);

      if (!dep || !dep.departamentoGlobalId) {
        return res.status(400).json({ error: "Departamento global não encontrado para esse departamento." });
      }

      departamentoGlobalId = dep.departamentoGlobalId;
      depId = null;
      respId = null;
      empId = null;
    }

    console.log("Criando processo com dados:", {
      nome,
      depId,
      respId,
      diasMeta,
      diasPrazo,
      dataReferencia,
      empId,
      notificarAbertura,
      notificarFinalizacao,
      podeFinalizarAntesSubatendimentos,
      isPadrao,
      departamentoGlobalId,
    });
    
    const [result] = await db.execute(
      `INSERT INTO processos (
        nome, departamento_id, responsavel_id, dias_meta, dias_prazo, 
        data_referencia, empresa_id, notificar_abertura, notificar_finalizacao, 
        pode_finalizar_antes_subatendimentos, padrao_franqueadora, departamento_global_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        depId,
        respId,
        diasMeta,
        diasPrazo,
        dataReferencia || null,
        empId,
        notificarAbertura || 0,
        notificarFinalizacao || 0,
        podeFinalizarAntesSubatendimentos || 0,
        isPadrao,
        departamentoGlobalId || null,
      ]
    );    
      

    res.status(201).json({ message: "Processo criado com sucesso.", processId: result.insertId });
  } catch (error) {
    console.error("Erro ao criar processo:", error);
    res.status(500).json({ error: "Erro interno ao criar o processo." });
  }
};


/**
 * Lista todos os processos
 */
const listarProcessos = async (req, res) => {
  try {
    const { empresaId } = req.usuario;

    const [processos] = await db.query(
      `SELECT 
        p.id,
        p.nome,
        p.empresa_id as empresaId,
        p.departamento_id as departamentoId,
        p.responsavel_id as responsavelId,
        p.data_referencia as dataReferencia,
        p.dias_meta as diasMeta,
        p.dias_prazo as diasPrazo,
        p.notificar_abertura as notificarAbertura,
        p.notificar_finalizacao as notificarFinalizacao,
        p.pode_finalizar_antes_subatendimentos as podeFinalizarAntesSubatendimentos,
        p.padrao_franqueadora as padraoFranqueadora,
        p.departamento_global_id as departamentoGlobalId,
        p.criado_em as criadoEm,
        d.nome AS departamento,
        u.nome AS responsavel,
        v.processo_pai_id
       FROM processos p
       LEFT JOIN departamentos d ON p.departamento_id = d.id
       LEFT JOIN usuarios u ON p.responsavel_id = u.id
       LEFT JOIN processos_vinculos v ON v.processo_filho_id = p.id
       WHERE p.empresa_id = ? OR p.padrao_franqueadora = 1`,
      [empresaId]
    );

    res.json(processos);
  } catch (error) {
    console.error("Erro ao listar processos:", error);
    res.status(500).json({ error: "Erro interno ao listar os processos." });
  }
};


// Criar nova atividade
const adicionarAtividade = async (req, res) => {
  const { processoId, tipo, texto, tipoCancelamento, descricao } = req.body;

  const [verifica] = await db.query("SELECT padrao_franqueadora as padraoFranqueadora FROM processos WHERE id = ?", [processoId]);

  if (verifica.length === 0) {
    return res.status(404).json({ error: "Processo não encontrado." });
  }

  if (verifica[0].padraoFranqueadora === 1) {
    return res.status(403).json({ error: "Processo padrão não pode ser alterado ou excluído." });
  }

  const empresaId = req.usuario.empresaId;

  try {
    const [[{ maiorOrdem }]] = await db.query(
      `SELECT MAX(ordem) AS maiorOrdem FROM atividades_processo WHERE processo_id = ?`,
      [processoId]
    );

    const ordem = (maiorOrdem || 0) + 1;

    const [result] = await db.execute(
      `INSERT INTO atividades_processo 
       (empresa_id, processo_id, ordem, tipo, texto, tipo_cancelamento, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, processoId, ordem, tipo, texto, tipoCancelamento || "Com justificativa", descricao || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("Erro ao inserir atividade:", err);
    res.status(500).json({ erro: "Erro ao inserir atividade" });
  }
};


  
  const getProcessoPorId = async (req, res) => {
    const { id } = req.params;
  
    try {
      const [rows] = await db.query(
        `SELECT 
          p.id,
          p.nome,
          p.empresa_id as empresaId,
          p.departamento_id as departamentoId,
          p.responsavel_id as responsavelId,
          p.data_referencia as dataReferencia,
          p.dias_meta as diasMeta,
          p.dias_prazo as diasPrazo,
          p.notificar_abertura as notificarAbertura,
          p.notificar_finalizacao as notificarFinalizacao,
          p.pode_finalizar_antes_subatendimentos as podeFinalizarAntesSubatendimentos,
          p.padrao_franqueadora as padraoFranqueadora,
          p.departamento_global_id as departamentoGlobalId,
          p.criado_em as criadoEm,
          d.nome AS departamento,
          u.nome AS responsavel
         FROM processos p
         LEFT JOIN departamentos d ON p.departamento_id = d.id
         LEFT JOIN usuarios u ON p.responsavel_id = u.id
         WHERE p.id = ? AND (p.empresa_id = ? OR p.padrao_franqueadora = 1)`,
        [id, req.usuario.empresaId]
      );
      
  
      if (rows.length === 0) {
        return res.status(404).json({ error: "Processo não encontrado." });
      }
  
      res.json(rows[0]);
    } catch (error) {
      console.error("Erro ao buscar processo:", error);
      res.status(500).json({ error: "Erro interno ao buscar o processo." });
    }
  };

  
  // Listar atividades de um processo
  const listarAtividadesPorProcesso = async (req, res) => {
    const { processoId } = req.params;
  
    try {
      const [rows] = await db.execute(
        `SELECT 
          id,
          empresa_id as empresaId,
          processo_id as processoId,
          ordem,
          tipo,
          texto,
          tipo_cancelamento as tipoCancelamento,
          descricao
         FROM atividades_processo WHERE processo_id = ? ORDER BY ordem`,
        [processoId]
      );
  
      res.json(rows);
    } catch (err) {
      console.error("Erro ao buscar atividades:", err);
      res.status(500).json({ erro: "Erro ao buscar atividades" });
    }
  };
  
  // Deletar atividade
  const removerAtividade = async (req, res) => {
    const { id } = req.params;
  
    try {
      await db.execute(`DELETE FROM atividades_processo WHERE id = ?`, [id]);
      res.sendStatus(204);
    } catch (err) {
      console.error("Erro ao remover atividade:", err);
      res.status(500).json({ erro: "Erro ao remover atividade" });
    }
  };

  const listarProcessosDisponiveis = async (req, res) => {
    const { departamentoId } = req.params;
    const { empresaId } = req.usuario;
  
    try {
      console.log('[listarProcessosDisponiveis] departamentoId recebido:', departamentoId);
      console.log('[listarProcessosDisponiveis] empresaId do usuário:', empresaId);
      // Buscar o departamento global do departamento local do franqueado
      const [[dep]] = await db.query(
        `SELECT departamento_global_id as departamentoGlobalId FROM departamentos WHERE id = ?`,
        [departamentoId]
      );
  
      const departamentoGlobalId = dep?.departamentoGlobalId;
      console.log('[listarProcessosDisponiveis] departamentoGlobalId encontrado:', departamentoGlobalId);
  
      if (!departamentoGlobalId) {
        console.warn('[listarProcessosDisponiveis] Departamento global não encontrado para o departamento:', departamentoId);
        // Não retornar 404, apenas buscar processos da empresa
      }
  
      // Query com JOIN para trazer processos da empresa e da franqueadora compatíveis com o departamento
      console.log('[listarProcessosDisponiveis] Parâmetros da query:', empresaId, departamentoId, departamentoGlobalId);
      
      let query, params;
      
      if (departamentoGlobalId) {
        // Se tem departamento global, busca processos da empresa + processos padrão da franqueadora
        query = `SELECT 
                   p.id,
                   p.nome,
                   p.empresa_id as empresaId,
                   p.departamento_id as departamentoId,
                   p.responsavel_id as responsavelId,
                   p.data_referencia as dataReferencia,
                   p.dias_meta as diasMeta,
                   p.dias_prazo as diasPrazo,
                   p.notificar_abertura as notificarAbertura,
                   p.notificar_finalizacao as notificarFinalizacao,
                   p.pode_finalizar_antes_subatendimentos as podeFinalizarAntesSubatendimentos,
                   p.padrao_franqueadora as padraoFranqueadora,
                   p.departamento_global_id as departamentoGlobalId,
                   p.criado_em as criadoEm,
                   d.nome AS departamento,
                   u.nome AS responsavel
                 FROM processos p
                 LEFT JOIN departamentos d ON p.departamento_id = d.id
                 LEFT JOIN usuarios u ON p.responsavel_id = u.id
                 WHERE 
                   (p.empresa_id = ? AND p.departamento_id = ?)
                   OR 
                   (p.padrao_franqueadora = 1 AND p.departamento_global_id = ?)`;
        params = [empresaId, departamentoId, departamentoGlobalId];
      } else {
        // Se não tem departamento global, busca apenas processos da empresa
        query = `SELECT 
                   p.id,
                   p.nome,
                   p.empresa_id as empresaId,
                   p.departamento_id as departamentoId,
                   p.responsavel_id as responsavelId,
                   p.data_referencia as dataReferencia,
                   p.dias_meta as diasMeta,
                   p.dias_prazo as diasPrazo,
                   p.notificar_abertura as notificarAbertura,
                   p.notificar_finalizacao as notificarFinalizacao,
                   p.pode_finalizar_antes_subatendimentos as podeFinalizarAntesSubatendimentos,
                   p.padrao_franqueadora as padraoFranqueadora,
                   p.departamento_global_id as departamentoGlobalId,
                   p.criado_em as criadoEm,
                   d.nome AS departamento,
                   u.nome AS responsavel
                 FROM processos p
                 LEFT JOIN departamentos d ON p.departamento_id = d.id
                 LEFT JOIN usuarios u ON p.responsavel_id = u.id
                 WHERE p.empresa_id = ? AND p.departamento_id = ?`;
        params = [empresaId, departamentoId];
      }
      
      const [processos] = await db.query(query, params);
      console.log('[listarProcessosDisponiveis] Processos retornados:', processos);
  
      res.json(processos);
    } catch (error) {
      console.error("Erro ao listar processos disponíveis:", error);
      res.status(500).json({ error: "Erro interno ao listar os processos." });
    }
  };
  
  const listarSubprocessos = async (req, res) => {
    const { processoId } = req.params;
  
    try {
      const [rows] = await db.query(
        `SELECT p.* FROM processos_vinculos v
         JOIN processos p ON v.processo_filho_id = p.id
         WHERE v.processo_pai_id = ?`,
        [processoId]
      );
  
      res.status(200).json(rows);
    } catch (error) {
      console.error("Erro ao listar subprocessos:", error);
      res.status(500).json({ error: "Erro ao buscar subprocessos." });
    }
  };
  
  
  
  
module.exports = {
  criarProcesso,
  listarProcessos,
  adicionarAtividade,
  listarAtividadesPorProcesso,
  removerAtividade, getProcessoPorId, listarProcessosDisponiveis, listarSubprocessos
};
