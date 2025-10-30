const express = require("express");
const router = express.Router();
const tarefaController = require("../../controllers/gestao/tarefaController");
const { autenticarToken } = require("../../middlewares/auth");
const db = require("../../config/database");
const { verificarPermissao } = require("../../middlewares/permissaoMiddleware");

// =================== ROTAS ESPECÍFICAS ===================

// Tarefas abertas (usada em "Progresso Atual")
router.get("/abertas/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [tarefas] = await db.query(
      `SELECT t.*, d.nome as departamento, u.nome as responsavel
       FROM tarefas t
       LEFT JOIN departamentos d ON t.departamentoId = d.id
       LEFT JOIN usuarios u ON t.responsavelId = u.id
       WHERE t.empresaId = ? AND t.status != 'concluida'`,
      [empresaId]
    );

    const tarefasComAtividades = await Promise.all(
      tarefas.map(async (tarefa) => {
        const [atividades] = await db.query(
          `SELECT id, concluida FROM atividades_tarefas WHERE tarefaId = ?`,
          [tarefa.id]
        );
        return { ...tarefa, atividades };
      })
    );

    res.json(tarefasComAtividades);
  } catch (err) {
    console.error("Erro ao buscar tarefas abertas:", err);
    res.status(500).json({ erro: "Erro ao buscar tarefas abertas." });
  }
});

// Painel de controle geral (usado na visão geral)
router.get("/painel-controle/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  const { usuarioId, filtrosAtivos, mes, ano } = req.query; // ✅ Parâmetros para filtrar por responsabilidade e mês/ano
  
  // ✅ Verificar se usuário é superadmin
  const isSuperadmin = req.usuario?.permissoes?.adm?.includes('superadmin');
  
  // ✅ Não aplicar filtro de responsabilidade se:
  // 1. Usuário é superadmin OU
  // 2. Há filtros de grupos/clientes/departamentos ativos
  const aplicarFiltroResponsabilidade = usuarioId && !isSuperadmin && filtrosAtivos !== 'true';
  
  
  try {
    // 1. Busca todos os departamentos da empresa
    const [departamentos] = await db.query(
      `SELECT id, nome FROM departamentos WHERE empresaId = ?`, [empresaId]
    );

    // 2. ✅ Busca tarefas com filtro opcional por responsabilidade
    let queryTarefas = `
      SELECT 
        t.id, t.assunto, t.status, t.dataAcao, t.dataMeta, t.dataPrazo, t.dataConclusao,
        t.departamentoId,
        d.nome AS departamento_nome,
        c.nome AS cliente_nome, 
        c.cnpjCpf AS cliente_cnpj,
        c.status AS status_cliente,
        u.nome AS responsavel_nome
      FROM tarefas t
      LEFT JOIN clientes c ON t.clienteId = c.id
      LEFT JOIN usuarios u ON t.responsavelId = u.id
      LEFT JOIN departamentos d ON t.departamentoId = d.id
      WHERE t.empresaId = ? AND t.status != 'cancelada'`;
    
    let paramsTarefas = [empresaId];
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ Filtro por responsabilidade para tarefas
      queryTarefas += ` AND t.responsavelId = ?`;
      paramsTarefas.push(usuarioId);
    }

    // ✅ Filtro por mês e ano para tarefas concluídas
    if (mes && ano) {
      const mesNum = parseInt(mes) + 1; // JavaScript usa 0-11, SQL usa 1-12
      const anoNum = parseInt(ano);
      queryTarefas += ` AND (
        t.status != 'concluída' OR 
        (t.status = 'concluída' AND MONTH(t.dataConclusao) = ? AND YEAR(t.dataConclusao) = ?)
      )`;
      paramsTarefas.push(mesNum, anoNum);
    }


    const [tarefas] = await db.query(queryTarefas, paramsTarefas);

    // 3. Busca todas as atividades das tarefas (só se tiver tarefas!)
    const tarefaIds = tarefas.map(t => t.id);
    let atividadesPorTarefa = {};
    if (tarefaIds.length) {
      const [atividades] = await db.query(
        `SELECT tarefaId, concluida, cancelada FROM atividades_tarefas WHERE tarefaId IN (${tarefaIds.join(",")})`
      );
      for (const a of atividades) {
        if (!atividadesPorTarefa[a.tarefaId]) atividadesPorTarefa[a.tarefaId] = [];
        atividadesPorTarefa[a.tarefaId].push(a);
      }
    }

    // 4. Monta a estrutura de painel já iniciando todos os departamentos, mesmo que vazios
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    function addDias(data, dias) {
      const dt = new Date(data);
      dt.setDate(dt.getDate() + dias);
      return dt;
    }

    // Inicia painel já com todos os departamentos vazios
    const painelPorDep = {};
    for (const dept of departamentos) {
      painelPorDep[dept.nome] = {
        departamento: dept.nome,
        acao: { proximos15dias: 0, programadoHoje: 0, foraProgramado: 0, tarefas: [] },
        atencao: { aposMeta: 0, venceHoje: 0, aposPrazo: 0, tarefas: [] },
        concluidas: { finalizada: 0, naProgramacao: 0, concluidasAposMetaPrazo: 0, tarefas: [] },
      };
    }

    // Preenche tarefas nos seus departamentos
    for (const t of tarefas) {
      const departamento = t.departamento_nome || "Sem Departamento";
      if (!painelPorDep[departamento]) {
        // Caso algum depto tenha sido removido da tabela de departamentos, mas ficou no banco de tarefas
        painelPorDep[departamento] = {
          departamento,
          acao: { proximos15dias: 0, programadoHoje: 0, foraProgramado: 0, tarefas: [] },
          atencao: { aposMeta: 0, venceHoje: 0, aposPrazo: 0, tarefas: [] },
          concluidas: { finalizada: 0, naProgramacao: 0, concluidasAposMetaPrazo: 0, tarefas: [] },
        };
      }
      // Trata datas
      const dataAcao = t.dataAcao ? new Date(t.dataAcao) : null;
      const dataMeta = t.dataMeta ? new Date(t.dataMeta) : null;
      const dataPrazo = t.dataPrazo ? new Date(t.dataPrazo) : null;
      const dataConclusao = t.dataConclusao ? new Date(t.dataConclusao) : null;
      if (dataAcao) dataAcao.setHours(0, 0, 0, 0);
      if (dataMeta) dataMeta.setHours(0, 0, 0, 0);
      if (dataPrazo) dataPrazo.setHours(0, 0, 0, 0);
      if (dataConclusao) dataConclusao.setHours(0, 0, 0, 0);

      // Atividades dessa tarefa
      const atividades = atividadesPorTarefa[t.id] || [];
      const totalAtividades = atividades.length;
      const concluidasOuCanceladas = atividades.filter(a => a.concluida === 1 || a.cancelada === 1).length;

      // Objeto detalhado
      const tarefaDetalhada = {
        id: t.id,
        nome: t.assunto || "-",
        assunto: t.assunto || "-",
        status: t.status,
        dataAcao: t.dataAcao,
        dataMeta: t.dataMeta,
        dataPrazo: t.dataPrazo,
        dataConclusao: t.dataConclusao,
        progresso: totalAtividades > 0 ? Math.round((concluidasOuCanceladas / totalAtividades) * 100) : 0,
        tipo: "", // <-- será definido abaixo
        cliente_nome: t.cliente_nome || "-",
        cliente_cnpj: t.cliente_cnpj || "",
        status_cliente: t.status_cliente || "-",
        responsavel: t.responsavel_nome || "-",
        departamento,
        atividades,
      };

      // Categorização usando TIPO (e não mais categoria)
      const status = (t.status || "pendente").trim().toLowerCase();
      // NOVA LÓGICA: se status for concluída, sempre categoriza como concluída
      if (status === "concluída") {
        if (dataConclusao) {
          // Na Programação: dataConclusao foi antes da dataAcao, dataMeta e dataPrazo
          if (dataAcao && dataMeta && dataPrazo && 
              dataConclusao < dataAcao && dataConclusao < dataMeta && dataConclusao < dataPrazo) {
            painelPorDep[departamento].concluidas.naProgramacao++;
            painelPorDep[departamento].concluidas.tarefas.push({ ...tarefaDetalhada, tipo: "Na Programação" });
          } 
          // Concluída após Meta: dataConclusao foi depois de dataAcao e dataMeta, mas antes de dataPrazo
          else if (dataAcao && dataMeta && dataPrazo && 
                   dataConclusao > dataAcao && dataConclusao > dataMeta && dataConclusao <= dataPrazo) {
            painelPorDep[departamento].concluidas.concluidasAposMetaPrazo++;
            painelPorDep[departamento].concluidas.tarefas.push({ ...tarefaDetalhada, tipo: "Concluída Após Meta" });
          } 
          // Concluída Após Prazo: dataConclusao é maior que dataAcao, dataMeta e dataPrazo
          else if (dataAcao && dataMeta && dataPrazo && 
                   dataConclusao > dataAcao && dataConclusao > dataMeta && dataConclusao > dataPrazo) {
            painelPorDep[departamento].concluidas.concluidasAposMetaPrazo++;
            painelPorDep[departamento].concluidas.tarefas.push({ ...tarefaDetalhada, tipo: "Concluída Após Prazo" });
          } 
          // Caso padrão: se não se encaixa nas regras específicas, vai para "Na Programação"
          else {
            painelPorDep[departamento].concluidas.naProgramacao++;
            painelPorDep[departamento].concluidas.tarefas.push({ ...tarefaDetalhada, tipo: "Na Programação" });
          }
        } else {
          painelPorDep[departamento].concluidas.naProgramacao++;
          painelPorDep[departamento].concluidas.tarefas.push({ ...tarefaDetalhada, tipo: "Na Programação" });
        }
        continue;
      }

      // ATENÇÃO
      if (dataPrazo && dataPrazo.getTime() === hoje.getTime()) {
        painelPorDep[departamento].atencao.venceHoje++;
        painelPorDep[departamento].atencao.tarefas.push({ ...tarefaDetalhada, tipo: "Vence Hoje" });
        continue;
      }
      if (dataPrazo && hoje > dataPrazo) {
        painelPorDep[departamento].atencao.aposPrazo++;
        painelPorDep[departamento].atencao.tarefas.push({ ...tarefaDetalhada, tipo: "Após Prazo" });
        continue;
      }
      if (dataMeta && hoje > dataMeta && dataPrazo && hoje < dataPrazo) {
        painelPorDep[departamento].atencao.aposMeta++;
        painelPorDep[departamento].atencao.tarefas.push({ ...tarefaDetalhada, tipo: "Após Meta" });
        continue;
      }

      // AÇÃO
      if (dataAcao && dataAcao.getTime() === hoje.getTime()) {
        painelPorDep[departamento].acao.programadoHoje++;
        painelPorDep[departamento].acao.tarefas.push({ ...tarefaDetalhada, tipo: "Programado Hoje" });
      } else if (dataAcao && dataAcao > hoje && dataAcao <= addDias(hoje, 15)) {
        painelPorDep[departamento].acao.proximos15dias++;
        painelPorDep[departamento].acao.tarefas.push({ ...tarefaDetalhada, tipo: "Próximos 15 dias" });
      } else if (dataAcao && hoje > dataAcao) {
        painelPorDep[departamento].acao.foraProgramado++;
        painelPorDep[departamento].acao.tarefas.push({ ...tarefaDetalhada, tipo: "Fora do Programado" });
      }
    }

    // Retorna todos os departamentos, inclusive os sem tarefa (array final)
    const painel = Object.values(painelPorDep);

    res.json(painel);
  } catch (err) {
    console.error("Erro ao montar painel de tarefas:", err);
    res.status(500).json({ erro: "Erro interno ao montar painel de tarefas." });
  }
});



// Resumo geral por empresa
router.get("/resumo-geral/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [tarefas] = await db.query(
      `SELECT t.*, d.nome as departamento FROM tarefas t
       LEFT JOIN departamentos d ON t.departamentoId = d.id
       WHERE t.empresaId = ?`,
      [empresaId]
    );

    const hoje = new Date().toISOString().substring(0, 10);

    const resumo = {
      vencemHoje: 0,
      sujeitasMulta: 0,
      multasGeradas: 0,
      pendentes: 0,
      tarefasRestantes: 0,
      tarefasRealizadas: 0,
      porDepartamento: {},
    };

    tarefas.forEach((t) => {
      const status = t.status;
      const dept = t.departamento || "Não informado";

      if (!resumo.porDepartamento[dept]) {
        resumo.porDepartamento[dept] = {
          acao: 0,
          atencao: 0,
          pendentes: 0,
          concluidas: 0,
        };
      }

      if (status !== "concluida") resumo.tarefasRestantes++;
      if (status === "concluida") resumo.tarefasRealizadas++;
      if (t.dataPrazo === hoje && status !== "concluida") resumo.vencemHoje++;
      if (status === "pendente") resumo.pendentes++;
      if (status !== "concluida" && new Date(t.dataPrazo) < new Date()) resumo.porDepartamento[dept].atencao++;

      if (status === "em_andamento") resumo.porDepartamento[dept].acao++;
      if (status === "pendente") resumo.porDepartamento[dept].pendentes++;
      if (status === "concluida") resumo.porDepartamento[dept].concluidas++;
    });

    const porDepartamento = Object.entries(resumo.porDepartamento).map(
      ([departamento, dados]) => ({ departamento, ...dados })
    );

    res.json({ ...resumo, porDepartamento });
  } catch (err) {
    console.error("Erro ao gerar resumo geral:", err);
    res.status(500).json({ erro: "Erro ao gerar resumo geral" });
  }
});

router.get("/todas/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  const { usuarioId, filtrosAtivos } = req.query; // ✅ Parâmetros para filtrar por responsabilidade

  // ✅ Verificar se usuário é superadmin
  const isSuperadmin = req.usuario?.permissoes?.adm?.includes('superadmin');
  
  // ✅ Não aplicar filtro de responsabilidade se:
  // 1. Usuário é superadmin OU
  // 2. Há filtros de grupos/clientes/departamentos ativos
  const aplicarFiltroResponsabilidade = usuarioId && !isSuperadmin && filtrosAtivos !== 'true';
  

  try {
    // ✅ Query dinâmica com filtro opcional por responsabilidade
    let query = `SELECT 
  t.*, 
  d.nome as departamento, 
  u.nome as responsavel,
  c.nome as cliente_nome,
  c.status as status_cliente
FROM tarefas t
LEFT JOIN departamentos d ON t.departamentoId = d.id
LEFT JOIN usuarios u ON t.responsavelId = u.id
LEFT JOIN clientes c ON t.clienteId = c.id
WHERE t.empresaId = ? AND t.status != 'cancelada'`;

    let params = [empresaId];
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ Filtro por responsabilidade para tarefas
      query += ` AND t.responsavelId = ?`;
      params.push(usuarioId);
    }

    if (aplicarFiltroResponsabilidade) {
    }

    const [tarefas] = await db.query(query, params);

    const tarefasComAtividades = await Promise.all(
      tarefas.map(async (tarefa) => {
        const [atividades] = await db.query(
          `SELECT 
      at.id, at.concluida, at.cancelada, 
      ap.tipo, ap.texto, ap.descricao, ap.tipoCancelamento
    FROM atividades_tarefas at
    LEFT JOIN atividades_processo ap ON at.atividadeId = ap.id
    WHERE at.tarefaId = ?`,
          [tarefa.id]
        );
        return { ...tarefa, atividades };
      })
    );

    res.json(tarefasComAtividades);
  } catch (err) {
    console.error("Erro ao buscar todas as tarefas:", err);
    res.status(500).json({ erro: "Erro ao buscar tarefas." });
  }
});


// =================== ROTAS COMUNS ===================

router.post("/", autenticarToken, verificarPermissao('tarefas.criar'), tarefaController.criarTarefa);
router.get("/:id", autenticarToken, tarefaController.buscarTarefaPorId);
router.get("/:id/atividades", autenticarToken, tarefaController.listarAtividadesDaTarefa);
router.get("/:id/subprocessos", autenticarToken, tarefaController.buscarSubprocessosComTarefas);
router.get("/:id/atividades-com-status", tarefaController.listarAtividadesComStatus);
router.patch("/:id/concluir", autenticarToken, tarefaController.concluirTarefaHandler);
router.patch("/atividade/:atividadeTarefaId/concluir", autenticarToken, tarefaController.concluirAtividadeTarefa);
router.patch("/atividade/:atividadeTarefaId/anexo", autenticarToken, tarefaController.salvarAnexoAtividade);
router.delete("/atividade/:atividadeTarefaId/anexo", autenticarToken, tarefaController.excluirAnexoAtividade);

// Cancelar tarefa principal
router.patch('/:id/cancelar', autenticarToken, verificarPermissao('tarefas.editar'), tarefaController.cancelarTarefaHandler);

// Reabrir tarefa principal
router.patch('/:id/reabrir', autenticarToken, verificarPermissao('tarefas.editar'), tarefaController.reabrirTarefaHandler);


// =================== SUBPROCESSOS ===================

router.post("/vincular-subprocesso", autenticarToken, async (req, res) => {
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

router.delete("/vincular-subprocesso/:paiId/:filhoId", autenticarToken, async (req, res) => {
  const { paiId, filhoId } = req.params;
  try {
    await db.query(
      "DELETE FROM processos_vinculos WHERE processo_pai_id = ? AND processo_filho_id = ?",
      [paiId, filhoId]
    );
    res.status(200).json({ message: "Subprocesso desvinculado com sucesso." });
  } catch (err) {
    console.error("Erro ao desvincular subprocesso:", err);
    res.status(500).json({ error: "Erro interno ao desvincular subprocesso." });
  }
});

// Cancelar atividade (com ou sem justificativa)
router.patch("/atividade/:atividadeTarefaId/cancelar", autenticarToken, async (req, res) => {
  const { atividadeTarefaId } = req.params;
  const { justificativa } = req.body;

  try {
    // busca de ap.tipoCancelamento ou at.tipoCancelamento (para órfãs)
    const [[atividade]] = await db.query(
      `SELECT COALESCE(ap.tipoCancelamento, at.tipoCancelamento) AS tipoCancelamento
   FROM atividades_tarefas at
   LEFT JOIN atividades_processo ap ON at.atividadeId = ap.id
   WHERE at.id = ?`,
      [atividadeTarefaId]
    );

    if (!atividade) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    const exigeJustificativa = atividade.tipoCancelamento === "Com justificativa";

    if (exigeJustificativa && (!justificativa || justificativa.trim() === "")) {
      return res.status(400).json({ error: "Justificativa é obrigatória para este tipo de atividade." });
    }

    // Data de cancelamento (sem ajuste de fuso)
    const agora = new Date();
    const pad = n => String(n).padStart(2, "0");
    const dataCancelamento =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(
      `UPDATE atividades_tarefas
       SET cancelada = 1, justificativa = ?, dataCancelamento = ?
       WHERE id = ?`,
      [justificativa || null, dataCancelamento, atividadeTarefaId]
    );

    res.json({ message: "Atividade cancelada com sucesso." });
  } catch (err) {
    console.error("Erro ao cancelar atividade:", err);
    res.status(500).json({ error: "Erro interno ao cancelar atividade." });
  }
});

// Listar comentários de uma tarefa
router.get("/:id/comentarios", autenticarToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [comentarios] = await db.query(
      `SELECT c.id, c.comentario, c.criadoEm, c.nomeArquivo, c.base64, u.nome, u.imagem, u.id as usuarioId
       FROM comentarios_tarefa c
       JOIN usuarios u ON c.usuarioId = u.id
       WHERE c.tarefaId = ?
       ORDER BY c.criadoEm ASC`,
      [id]
    );
    res.json(comentarios);
  } catch (err) {
    console.error("Erro ao buscar comentários:", err);
    res.status(500).json({ erro: "Erro ao buscar comentários." });
  }
});

// NOVA ROTA: Buscar comentários em lote para múltiplas tarefas
router.post("/comentarios/lote", autenticarToken, async (req, res) => {
  const { tarefaIds } = req.body;
  
  if (!tarefaIds || !Array.isArray(tarefaIds) || tarefaIds.length === 0) {
    return res.status(400).json({ erro: "Lista de IDs de tarefas é obrigatória." });
  }

  try {
    // Buscar o último comentário de cada tarefa
    const placeholders = tarefaIds.map(() => '?').join(',');
    const [comentarios] = await db.query(
      `SELECT 
        c.tarefaId,
        c.id as comentarioId,
        c.comentario,
        c.criadoEm,
        c.nomeArquivo,
        u.nome as autorNome,
        u.id as autorId
       FROM comentarios_tarefa c
       JOIN usuarios u ON c.usuarioId = u.id
       WHERE c.tarefaId IN (${placeholders})
       AND c.id = (
         SELECT MAX(c2.id) 
         FROM comentarios_tarefa c2 
         WHERE c2.tarefaId = c.tarefaId
       )
       ORDER BY c.criadoEm DESC`,
      tarefaIds
    );

    // Organizar por tarefaId para facilitar o acesso
    const comentariosPorTarefa = {};
    comentarios.forEach(comentario => {
      comentariosPorTarefa[comentario.tarefaId] = comentario;
    });

    res.json(comentariosPorTarefa);
  } catch (err) {
    console.error("Erro ao buscar comentários em lote:", err);
    res.status(500).json({ erro: "Erro ao buscar comentários em lote." });
  }
});


// Adicionar novo comentário
router.post("/:id/comentarios", autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { comentario, base64, nomeArquivo } = req.body;
  const usuarioId = req.usuario.id;

  if ((!comentario || comentario.trim() === "") && !base64) {
    return res.status(400).json({ erro: "Comentário vazio ou sem arquivo." });
  }

  try {
    // Ajusta para horário de Brasília (UTC-3)
    const agora = new Date();
    agora.setHours(agora.getHours() );
    const pad = n => String(n).padStart(2, "0");
    const criadoEm =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(
      `INSERT INTO comentarios_tarefa (tarefaId, usuarioId, comentario, base64, nomeArquivo, criadoEm) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, usuarioId, comentario || null, base64 || null, nomeArquivo || null, criadoEm]
    );
    res.status(201).json({ mensagem: "Comentário adicionado." });
  } catch (err) {
    console.error("Erro ao adicionar comentário:", err);
    res.status(500).json({ erro: "Erro ao adicionar comentário." });
  }
});


// 🔁 Rota para descancelar uma atividade
router.patch("/atividade/:atividadeTarefaId/descancelar", autenticarToken, async (req, res) => {
  const { atividadeTarefaId } = req.params;

  try {
    await db.query(
      `UPDATE atividades_tarefas
       SET cancelada = 0, justificativa = NULL, dataCancelamento = NULL
       WHERE id = ?`,
      [atividadeTarefaId]
    );

    res.json({ message: "Atividade reativada com sucesso." });
  } catch (err) {
    console.error("Erro ao descancelar atividade:", err);
    res.status(500).json({ error: "Erro interno ao reativar atividade." });
  }
});

// 🔍 Obter o tarefaId a partir de um atividadeTarefaId
router.get("/atividades/:atividadeTarefaId/tarefa", autenticarToken, async (req, res) => {
  const { atividadeTarefaId } = req.params;

  try {
    const [[row]] = await db.query(
      `SELECT tarefaId FROM atividades_tarefas WHERE id = ?`,
      [atividadeTarefaId]
    );

    if (!row) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    res.json({ tarefaId: row.tarefaId });
  } catch (err) {
    console.error("Erro ao obter tarefaId da atividade:", err);
    res.status(500).json({ error: "Erro interno ao buscar tarefa da atividade." });
  }
});

router.post("/atividade/:atividadeTarefaId/anexos", autenticarToken, async (req, res) => {
  const { atividadeTarefaId } = req.params;
  const { anexos } = req.body; // [{ nomeArquivo, base64 }]

  if (!Array.isArray(anexos)) {
    return res.status(400).json({ error: "Formato de anexos inválido" });
  }

  try {
    for (const anexo of anexos) {
      await db.query(
        `INSERT INTO anexos_atividade (atividade_tarefa_id, nome_arquivo, pdf) VALUES (?, ?, ?)`,
        [atividadeTarefaId, anexo.nomeArquivo, anexo.base64]
      );
    }

    res.status(201).json({ message: "Anexos salvos com sucesso" });
  } catch (err) {
    console.error("Erro ao salvar anexos:", err);
    res.status(500).json({ error: "Erro ao salvar anexos" });
  }
});


router.get("/atividade/:atividadeTarefaId/anexos", autenticarToken, async (req, res) => {
  const { atividadeTarefaId } = req.params;
  try {
    const [anexos] = await db.query(
      `SELECT id, nome_arquivo, pdf, criado_em FROM anexos_atividade WHERE atividade_tarefa_id = ?`,
      [atividadeTarefaId]
    );
    res.json(anexos);
  } catch (err) {
    console.error("Erro ao listar anexos:", err);
    res.status(500).json({ error: "Erro ao buscar anexos." });
  }
});

// Atualizar descrição da tarefa
router.patch("/:id/descricao", autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { descricao } = req.body;

  try {
    await db.query(`UPDATE tarefas SET descricao = ? WHERE id = ?`, [descricao, id]);
    res.status(200).json({ message: "Descrição atualizada com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar descrição da tarefa:", err);
    res.status(500).json({ error: "Erro interno ao atualizar descrição." });
  }
});

router.post("/unica", autenticarToken, verificarPermissao('tarefas.criar'), async (req, res) => {
  const {
    empresaId,
    departamentoId,
    clienteId,
    assunto,
    descricao,
    dataAcao,
    dataPrazo,
    dataMeta,
    responsavelId,
    atividades = [], // array de objetos: [{tipo, texto, descricao, tipoCancelamento}]
  } = req.body;

  const conexao = await db.getConnection();
  await conexao.beginTransaction();

  try {
    // 1. Inserir a tarefa principal
    const [resultado] = await conexao.query(
      `INSERT INTO tarefas 
       (empresaId, departamentoId, clienteId, assunto, descricao, dataAcao, dataPrazo, dataMeta, responsavelId, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        departamentoId || null,
        clienteId || null,
        assunto,
        descricao,
        dataAcao || null,
        dataPrazo || null,
        dataMeta || null,
        responsavelId || null,
        "aberta",
      ]
    );

    const tarefaId = resultado.insertId;

    // 2. Criar atividades "órfãs", só em atividades_tarefas
    for (let i = 0; i < atividades.length; i++) {
      const {
        tipo,            // Ex: "Checklist"
        texto,           // Ex: "Enviar documentos"
        descricao,       // Descrição longa
        tipoCancelamento // Ex: "Com justificativa"
      } = atividades[i];

      await conexao.query(
        `INSERT INTO atividades_tarefas 
         (tarefaId, atividadeId, tipo, texto, descricao, tipoCancelamento, concluida, cancelada)
         VALUES (?, NULL, ?, ?, ?, ?, 0, 0)`,
        [tarefaId, tipo, texto, descricao, tipoCancelamento]
      );
    }

    await conexao.commit();
    res.status(201).json({ message: "Solicitação única criada com sucesso.", tarefaId });
  } catch (err) {
    await conexao.rollback();
    console.error("Erro ao criar solicitação única:", err);
    res.status(500).json({ error: "Erro ao criar solicitação única." });
  } finally {
    conexao.release();
  }
});


// Atualizar comentário
router.patch("/comentarios/:comentarioId", autenticarToken, async (req, res) => {
  const { comentarioId } = req.params;
  const { comentario } = req.body;
  const usuarioId = req.usuario.id;

  if (!comentario || comentario.trim() === "") {
    return res.status(400).json({ erro: "Comentário vazio." });
  }

  // Só o autor do comentário pode editar
  try {
    const [[row]] = await db.query(
      `SELECT usuarioId FROM comentarios_tarefa WHERE id = ?`,
      [comentarioId]
    );
    if (!row) {
      return res.status(404).json({ erro: "Comentário não encontrado." });
    }
    if (row.usuarioId !== usuarioId) {
      return res.status(403).json({ erro: "Você não tem permissão para editar este comentário." });
    }

    await db.query(
      `UPDATE comentarios_tarefa SET comentario = ? WHERE id = ?`,
      [comentario, comentarioId]
    );
    res.status(200).json({ mensagem: "Comentário atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar comentário:", err);
    res.status(500).json({ erro: "Erro ao atualizar comentário." });
  }
});

// Atualizar individualmente datas da tarefa
router.patch("/:id/datas", autenticarToken, verificarPermissao('tarefas.editar'), async (req, res) => {
  const { id } = req.params;
  const { dataAcao, dataMeta, dataPrazo } = req.body;

  // Monta dinamicamente apenas os campos enviados
  const campos = [];
  const valores = [];

  if (dataAcao !== undefined) {
    campos.push("dataAcao = ?");
    valores.push(dataAcao || null);
  }
  if (dataMeta !== undefined) {
    campos.push("dataMeta = ?");
    valores.push(dataMeta || null);
  }
  if (dataPrazo !== undefined) {
    campos.push("dataPrazo = ?");
    valores.push(dataPrazo || null);
  }

  if (!campos.length) {
    return res.status(400).json({ error: "Nenhum campo de data enviado para atualizar." });
  }

  valores.push(id);

  try {
    await db.query(
      `UPDATE tarefas SET ${campos.join(", ")} WHERE id = ?`,
      valores
    );
    res.status(200).json({ message: "Datas atualizadas com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar datas da tarefa:", err);
    res.status(500).json({ error: "Erro interno ao atualizar datas." });
  }
});

// Disconcluir atividade (remover status de concluída)
router.patch("/atividade/:atividadeTarefaId/disconcluir", autenticarToken, tarefaController.disconcluirAtividadeTarefa);

// Adicionar rota de download de anexo real
router.get('/anexo/:anexoId/download', autenticarToken, tarefaController.downloadAnexo);

// Exclusão em lote de tarefas (com subtarefas)
router.post("/excluir-em-lote", autenticarToken, verificarPermissao('tarefas.excluir'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs das tarefas são obrigatórios" });
    }

    // Buscar todas as subtarefas ligadas às tarefas principais
    const [subtarefas] = await db.query(
      `SELECT id FROM tarefas WHERE tarefaPaiId IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    const subtarefaIds = subtarefas.map(t => t.id);

    // Excluir subtarefas primeiro
    if (subtarefaIds.length > 0) {
      await db.query(
        `DELETE FROM tarefas WHERE id IN (${subtarefaIds.map(() => "?").join(",")})`,
        subtarefaIds
      );
    }

    // Excluir tarefas principais
    const [result] = await db.execute(
      `DELETE FROM tarefas WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );

    res.json({
      success: true,
      message: `${result.affectedRows + subtarefaIds.length} tarefa(s) (incluindo subtarefas) excluída(s) com sucesso`,
      excluidas: result.affectedRows + subtarefaIds.length
    });
  } catch (error) {
    console.error("Erro ao excluir tarefas em lote:", error);
    res.status(500).json({ error: "Erro interno ao excluir tarefas" });
  }
});

/**
 * POST /api/tarefas/atualizar-responsavel-em-lote
 * Atualizar responsável em lote para tarefas
 */
router.post("/atualizar-responsavel-em-lote", autenticarToken, verificarPermissao('tarefas.editar'), async (req, res) => {
  const { ids, responsavelId } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs são obrigatórios e devem ser um array não vazio.' });
  }
  
  if (!responsavelId) {
    return res.status(400).json({ error: 'responsavelId é obrigatório.' });
  }

  try {
    // Verificar se o responsável existe
    const [[responsavel]] = await db.query('SELECT id, nome FROM usuarios WHERE id = ?', [responsavelId]);
    if (!responsavel) {
      return res.status(404).json({ error: 'Responsável não encontrado.' });
    }

    // Buscar todas as subtarefas ligadas às tarefas principais
    const [subtarefas] = await db.query(
      `SELECT id FROM tarefas WHERE tarefaPaiId IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    const subtarefaIds = subtarefas.map(t => t.id);

    // Atualizar responsável para tarefas principais
    const placeholders = ids.map(() => "?").join(",");
    const [result] = await db.execute(
      `UPDATE tarefas SET responsavelId = ? WHERE id IN (${placeholders})`,
      [responsavelId, ...ids]
    );

    // Atualizar responsável para subtarefas também
    let subtarefasAtualizadas = 0;
    if (subtarefaIds.length > 0) {
      const subtarefasPlaceholders = subtarefaIds.map(() => "?").join(",");
      const [subtarefasResult] = await db.execute(
        `UPDATE tarefas SET responsavelId = ? WHERE id IN (${subtarefasPlaceholders})`,
        [responsavelId, ...subtarefaIds]
      );
      subtarefasAtualizadas = subtarefasResult.affectedRows;
    }

    const totalAtualizadas = result.affectedRows + subtarefasAtualizadas;

    console.log(`✅ Responsável atualizado para ${totalAtualizadas} tarefas (incluindo subtarefas)`);

    res.json({ 
      success: true, 
      message: `Responsável atualizado com sucesso para ${totalAtualizadas} tarefa(s) (incluindo subtarefas).`,
      responsavel: responsavel.nome,
      atualizadas: totalAtualizadas,
      tarefasPrincipais: result.affectedRows,
      subtarefas: subtarefasAtualizadas
    });
  } catch (err) {
    console.error('Erro ao atualizar responsável em lote para tarefas:', err);
    res.status(500).json({ error: 'Erro ao atualizar responsável em lote para tarefas.' });
  }
});

module.exports = router;
