const express = require("express");
const router = express.Router();
const autenticarToken = require("../../middlewares/auth");
const processoController = require("../../controllers/gestao/processoController");
const db = require("../../config/database");
const { verificarPermissao } = require("../../middlewares/permissao");


router.get("/disponiveis/:departamentoId", autenticarToken, verificarPermissao('processos.visualizar'), processoController.listarProcessosDisponiveis);


// Rota para criar um novo processo
router.post("/", autenticarToken, verificarPermissao('processos.criar'), processoController.criarProcesso);

// Rota para listar todos os processos da empresa
router.get("/", autenticarToken, processoController.listarProcessos);

// Rota para listar todos os processos globais (para subprocessos globais)
router.get("/globais", autenticarToken, async (req, res) => {
  try {
    const [processos] = await db.query(
      `SELECT * FROM processos WHERE padraoFranqueadora = 1`
    );
    res.json(processos);
  } catch (error) {
    console.error("Erro ao listar processos globais:", error);
    res.status(500).json({ error: "Erro ao listar processos globais." });
  }
});

router.post("/atividades", autenticarToken, processoController.adicionarAtividade);
router.get("/atividades/:processoId", autenticarToken, processoController.listarAtividadesPorProcesso);
router.get("/:id", autenticarToken, processoController.getProcessoPorId);
router.get("/:processoId/subprocessos", autenticarToken, processoController.listarSubprocessos);


router.put('/atividades/:id/ordem', autenticarToken, verificarPermissao('processos.editar'), async (req, res) => {
  const { id } = req.params;
  const { novaOrdem } = req.body;

  try {
    await db.query('UPDATE atividades_processo SET ordem = ? WHERE id = ?', [novaOrdem, id]); // ✅ agora sim
    res.status(200).json({ message: 'Ordem atualizada com sucesso!' });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    res.status(500).json({ message: 'Erro ao atualizar ordem' });
  }
});

// 📌 CRUD de template de e-mail para atividades de processos normais
router.get("/email-template/:atividadeId", autenticarToken, async (req, res) => {
  try {
    const { atividadeId } = req.params;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);
    
    
    const [templates] = await db.query(
      "SELECT * FROM processos_email_templates WHERE atividadeId = ? AND empresaId = ?",
      [atividadeId, empresaId]
    );
    
    
    if (templates.length === 0) {
      res.json({ 
        nome: '',
        assunto: '',
        corpo: '',
        destinatario: '',
        cc: '',
        co: '',
        variaveis: {}
      });
    } else {
      // Verificar se variaveis já é um objeto ou precisa ser parseado
      let variaveis = {};
      if (typeof templates[0].variaveis === 'string') {
        try {
          variaveis = JSON.parse(templates[0].variaveis);
        } catch (e) {
          console.error('Erro ao fazer parse das variáveis:', e);
          variaveis = {};
        }
      } else if (typeof templates[0].variaveis === 'object' && templates[0].variaveis !== null) {
        variaveis = templates[0].variaveis;
      }
      
      const response = {
        ...templates[0],
        variaveis: variaveis
      };
      
      res.json(response);
    }
  } catch (error) {
    console.error("Erro ao buscar template de e-mail:", error);
    res.status(500).json({ error: "Erro ao buscar template de e-mail" });
  }
});

router.post("/email-template/:atividadeId", autenticarToken, async (req, res) => {
  try {
    const { atividadeId } = req.params;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);
    const { nome, assunto, corpo, destinatario, cc, co, variaveis } = req.body;
    
    
    // Verifica se já existe
    const [existentes] = await db.query(
      "SELECT id FROM processos_email_templates WHERE atividadeId = ? AND empresaId = ?",
      [atividadeId, empresaId]
    );
    
    
    if (existentes.length > 0) {
      // Atualiza
      await db.execute(
        `UPDATE processos_email_templates SET nome=?, assunto=?, corpo=?, destinatario=?, cc=?, co=?, variaveis=?, atualizadoEm=NOW() WHERE atividadeId=? AND empresaId=?`,
        [nome, assunto, corpo, destinatario, cc, co, JSON.stringify(variaveis || {}), atividadeId, empresaId]
      );
    } else {
      // Cria novo
      await db.execute(
        `INSERT INTO processos_email_templates (atividadeId, empresaId, nome, assunto, corpo, destinatario, cc, co, variaveis, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [atividadeId, empresaId, nome, assunto, corpo, destinatario, cc, co, JSON.stringify(variaveis || {})]
      );
    }
    
    console.log("🔍 [BACKEND] Template salvo com sucesso");
    res.json({ message: "Template salvo com sucesso" });
  } catch (error) {
    console.error("Erro ao salvar template de e-mail:", error);
    res.status(500).json({ error: "Erro ao salvar template de e-mail" });
  }
});

// Rota para processar template de e-mail (substituir variáveis)
router.post("/processar-template/:processoId/:atividadeId", autenticarToken, async (req, res) => {
  try {
    const { processoId, atividadeId } = req.params;
    const empresaId = req.usuario.empresaId;

    // Buscar template
    const [templates] = await db.query(
      "SELECT * FROM processos_email_templates WHERE atividadeId = ? AND empresaId = ?",
      [atividadeId, empresaId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: "Template não encontrado" });
    }

    const template = templates[0];
    
    // Verificar se variaveis já é um objeto ou precisa ser parseado
    let variaveisTemplate = {};
    if (typeof template.variaveis === 'string') {
      try {
        variaveisTemplate = JSON.parse(template.variaveis);
      } catch (e) {
        console.error('Erro ao fazer parse das variáveis:', e);
        variaveisTemplate = {};
      }
    } else if (typeof template.variaveis === 'object' && template.variaveis !== null) {
      variaveisTemplate = template.variaveis;
    }

    // Buscar dados do processo
    const [processos] = await db.query(`
      SELECT 
        p.id,
        p.nome as processoNome,
        p.diasMeta,
        p.diasPrazo,
        p.dataReferencia,
        d.nome as departamentoNome,
        u.nome as responsavelNome,
        u.email as responsavelEmail,
        e.nome as empresaNome,
        e.cnpj as empresaCnpj,
        e.razaoSocial as empresaRazaoSocial
      FROM processos p
      LEFT JOIN departamentos d ON p.departamentoId = d.id
      LEFT JOIN usuarios u ON p.responsavelId = u.id
      LEFT JOIN empresas e ON p.empresaId = e.id
      WHERE p.id = ? AND p.empresaId = ?
    `, [processoId, empresaId]);

    if (processos.length === 0) {
      return res.status(404).json({ error: "Processo não encontrado" });
    }

    const processo = processos[0];

    // Mapear variáveis
    const variaveis = {};
    for (const variavel of Object.keys(variaveisTemplate)) {
      switch (variavel) {
        case 'processo.nome':
          variaveis[variavel] = processo.processoNome;
          break;
        case 'processo.departamento':
          variaveis[variavel] = processo.departamentoNome || 'Não definido';
          break;
        case 'processo.responsavel':
          variaveis[variavel] = processo.responsavelNome || 'Não definido';
          break;
        case 'processo.responsavel.email':
          variaveis[variavel] = processo.responsavelEmail || '';
          break;
        case 'processo.diasMeta':
          variaveis[variavel] = processo.diasMeta || 'Não definido';
          break;
        case 'processo.diasPrazo':
          variaveis[variavel] = processo.diasPrazo || 'Não definido';
          break;
        case 'processo.dataReferencia':
          variaveis[variavel] = processo.dataReferencia === 'hoje' ? 'Data Atual' : processo.dataReferencia;
          break;
        case 'empresa.nome':
          variaveis[variavel] = processo.empresaNome;
          break;
        case 'empresa.cnpj':
          variaveis[variavel] = processo.empresaCnpj;
          break;
        case 'empresa.razaoSocial':
          variaveis[variavel] = processo.empresaRazaoSocial;
          break;
        case 'datas.hoje':
          variaveis[variavel] = new Date().toLocaleDateString('pt-BR');
          break;
        default:
          variaveis[variavel] = `[${variavel}]`;
          break;
      }
    }

    // Processar template
    let assuntoProcessado = template.assunto;
    let corpoProcessado = template.corpo;
    let destinatarioProcessado = template.destinatario;

    // Função para substituir variáveis preservando formatação HTML
    const substituirVariaveisPreservandoHTML = (html, variaveis) => {
      if (!html) return html;
      
      let resultado = html;
      
      Object.entries(variaveis).forEach(([variavel, valor]) => {
        const regex = new RegExp(`\\[${variavel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        resultado = resultado.replace(regex, valor || '');
      });
      
      return resultado;
    };

    assuntoProcessado = substituirVariaveisPreservandoHTML(assuntoProcessado, variaveis);
    corpoProcessado = substituirVariaveisPreservandoHTML(corpoProcessado, variaveis);
    destinatarioProcessado = substituirVariaveisPreservandoHTML(destinatarioProcessado, variaveis);

    res.json({
      assunto: assuntoProcessado,
      corpo: corpoProcessado,
      destinatario: destinatarioProcessado,
      cc: template.cc,
      co: template.co,
      variaveis: variaveis
    });

  } catch (error) {
    console.error("Erro ao processar template:", error);
    res.status(500).json({ error: "Erro ao processar template" });
  }
});

router.put("/atividades/:id", autenticarToken, verificarPermissao('processos.editar'), async (req, res) => {
  const { id } = req.params;
  const { texto, tipoCancelamento, descricao } = req.body;

  try {
    await db.query(
      `UPDATE atividades_processo 
       SET texto = ?, tipoCancelamento = ?, descricao = ?
       WHERE id = ?`,
      [texto, tipoCancelamento, descricao, id]
    );

    res.status(200).json({ message: "Atividade atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar atividade:", error);
    res.status(500).json({ message: "Erro ao atualizar atividade." });
  }
});

router.delete("/atividades/:id", autenticarToken, verificarPermissao('processos.excluir'), async (req, res) => {
  const { id } = req.params;
  const conexao = await db.getConnection();
  await conexao.beginTransaction();

  try {
    // 1. Buscar os dados da atividade mãe
    const [[atividadeMae]] = await conexao.query(
      `SELECT tipo, texto, descricao, tipoCancelamento FROM atividades_processo WHERE id = ?`,
      [id]
    );
    if (!atividadeMae) {
      await conexao.rollback();
      return res.status(404).json({ message: "Atividade não encontrada." });
    }

    // 2. Atualizar todas as atividades_tarefas vinculadas a essa atividade
    await conexao.query(
      `UPDATE atividades_tarefas
       SET tipo = ?, texto = ?, descricao = ?, tipoCancelamento = ?, atividadeId = NULL
       WHERE atividadeId = ?`,
      [
        atividadeMae.tipo,
        atividadeMae.texto,
        atividadeMae.descricao,
        atividadeMae.tipoCancelamento,
        id
      ]
    );

    // 3. Agora pode deletar a atividade mãe
    await conexao.query(
      "DELETE FROM atividades_processo WHERE id = ?",
      [id]
    );

    await conexao.commit();
    res.status(200).json({ message: "Atividade removida com sucesso. Tarefas vinculadas mantidas." });
  } catch (error) {
    await conexao.rollback();
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(400).json({
        message: "Essa atividade está vinculada a tarefas e não pode ser excluída.",
      });
    }
    console.error("Erro ao remover atividade:", error);
    res.status(500).json({ message: "Erro ao remover atividade." });
  } finally {
    conexao.release();
  }
});





// Vincular subprocesso ao processo principal (novo método)
router.post("/vincular-subprocesso", autenticarToken, verificarPermissao('processos.criar'), async (req, res) => {
  const { processoPaiId, processoFilhoId } = req.body;

  try {
    await db.query(
      "INSERT INTO processos_vinculos (processo_pai_id, processo_filho_id) VALUES (?, ?)",
      [processoPaiId, processoFilhoId]
    );

    res.status(201).json({ message: "Subprocesso vinculado com sucesso." });
  } catch (error) {
    console.error("Erro ao vincular subprocesso:", error);
    res.status(500).json({ error: "Erro ao vincular subprocesso." });
  }
});

// Desvincular subprocesso
router.delete("/vincular-subprocesso/:processoPaiId/:processoFilhoId", autenticarToken, verificarPermissao('processos.excluir'), async (req, res) => {
  const { processoPaiId, processoFilhoId } = req.params;

  try {
    await db.query(
      "DELETE FROM processos_vinculos WHERE processo_pai_id = ? AND processo_filho_id = ?",
      [processoPaiId, processoFilhoId]
    );
    res.status(200).json({ message: "Subprocesso desvinculado com sucesso." });
  } catch (err) {
    console.error("Erro ao desvincular subprocesso:", err);
    res.status(500).json({ error: "Erro ao desvincular subprocesso." });
  }
});

// Atualizar processo
router.put("/:id", autenticarToken, verificarPermissao('processos.editar'), async (req, res) => {
  const { id } = req.params;
  const { nome, diasMeta, diasPrazo, departamentoId, responsavelId } = req.body;

  try {
    await db.query(
      `UPDATE processos SET nome = ?, diasMeta = ?, diasPrazo = ?, departamentoId = ?, responsavelId = ? WHERE id = ?`,
      [nome, diasMeta, diasPrazo, departamentoId, responsavelId, id]
    );
    res.json({ message: "Processo atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar processo:", err);
    res.status(500).json({ error: "Erro ao atualizar processo." });
  }
});

const { buscarSubprocessosComTarefas } = require("../../controllers/gestao/tarefaController");


router.put("/atividades/:processoId/reordenar", autenticarToken, verificarPermissao('processos.editar'), async (req, res) => {
  const { processoId } = req.params;

  try {
    const [atividades] = await db.query(
      `SELECT id FROM atividades_processo WHERE processoId = ? ORDER BY ordem, id`,
      [processoId]
    );

    const promises = atividades.map((a, index) => {
      const novaOrdem = index + 1;
      return db.query(`UPDATE atividades_processo SET ordem = ? WHERE id = ?`, [novaOrdem, a.id]);
    });

    await Promise.all(promises);

    res.status(200).json({ message: "Ordem das atividades reordenada com sucesso." });
  } catch (error) {
    console.error("Erro ao reordenar atividades:", error);
    res.status(500).json({ message: "Erro ao reordenar atividades." });
  }
});

router.delete('/:id', autenticarToken, verificarPermissao('processos.excluir'), async (req, res) => {
  const { id } = req.params;
  const conexao = await db.getConnection();
  await conexao.beginTransaction();

  try {
    console.log(`[DELETE PROCESSO] Iniciando exclusão do processo id=${id}`);

    // 0. Remover vínculos de subprocessos (processos_vinculos)
    const [vinculos] = await conexao.query(
      "SELECT * FROM processos_vinculos WHERE processo_pai_id = ?",
      [id]
    );
    console.log(`[DELETE PROCESSO] Subprocessos vinculados encontrados: ${vinculos.length}`);

    if (vinculos.length > 0) {
      await conexao.query(
        "DELETE FROM processos_vinculos WHERE processo_pai_id = ?",
        [id]
      );
      console.log(`[DELETE PROCESSO] Vínculos de subprocessos removidos com sucesso`);
    }

    // 1. Buscar todas as atividades do processo a ser deletado
    const [atividades] = await conexao.query(
      "SELECT id FROM atividades_processo WHERE processoId = ?",
      [id]
    );
    console.log(`[DELETE PROCESSO] Atividades encontradas: ${atividades.length}`);

    // 2. Para cada atividade, desvincular das tarefas (setar atividadeId = NULL)
    let desvinculadas = 0;
    for (const atividade of atividades) {
      // 1. Pega os dados da atividade original do processo (tipo, texto, descricao, tipoCancelamento)
      const [[dadosAtividade]] = await conexao.query(
        "SELECT tipo, texto, descricao, tipoCancelamento FROM atividades_processo WHERE id = ?",
        [atividade.id]
      );

      // 2. Preenche os campos próprios em atividades_tarefas antes de desvincular
      const [upd] = await conexao.query(
        `
    UPDATE atividades_tarefas
    SET
      tipo = ?,
      texto = ?,
      descricao = ?,
      tipoCancelamento = ?,
      atividadeId = NULL
    WHERE atividadeId = ?
    `,
        [
          dadosAtividade?.tipo || null,
          dadosAtividade?.texto || null,
          dadosAtividade?.descricao || null,
          dadosAtividade?.tipoCancelamento || null,
          atividade.id
        ]
      );
      desvinculadas += upd.affectedRows;
    }
    console.log(`[DELETE PROCESSO] Tarefas desvinculadas das atividades: ${desvinculadas}`);

    // 3. Agora pode deletar as atividades desse processo
    const [delAtividades] = await conexao.query(
      "DELETE FROM atividades_processo WHERE processoId = ?",
      [id]
    );
    console.log(`[DELETE PROCESSO] Atividades deletadas: ${delAtividades.affectedRows}`);

    // 3.1. Desvincular tarefas que possuem esse processoId
    const [tarefasVinculadas] = await conexao.query(
      "SELECT id FROM tarefas WHERE processoId = ?",
      [id]
    );
    console.log(`[DELETE PROCESSO] Tarefas vinculadas ao processo: ${tarefasVinculadas.length}`);

    if (tarefasVinculadas.length > 0) {
      const [updTarefas] = await conexao.query(
        "UPDATE tarefas SET processoId = NULL WHERE processoId = ?",
        [id]
      );
      console.log(`[DELETE PROCESSO] Tarefas desvinculadas do processo: ${updTarefas.affectedRows}`);
    }

    // 4. Depois, pode deletar o processo em si
    const [delProcesso] = await conexao.query(
      "DELETE FROM processos WHERE id = ?",
      [id]
    );
    console.log(`[DELETE PROCESSO] Processo deletado: ${delProcesso.affectedRows}`);

    await conexao.commit();
    console.log(`[DELETE PROCESSO] Processo id=${id} excluído com sucesso!`);

    res.status(200).json({ message: "Processo excluído com sucesso." });
  } catch (error) {
    await conexao.rollback();
    console.error("[DELETE PROCESSO] Erro ao excluir processo:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(400).json({
        message: "Não foi possível excluir o processo, pois ainda há vínculos ativos.",
      });
    }
    res.status(500).json({ message: "Erro ao excluir processo." });
  } finally {
    conexao.release();
  }
});



module.exports = router;
