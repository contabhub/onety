const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { autenticarToken } = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissaoMiddleware");



// POST /api/relatorios/performance
router.post("/performance", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const {
    empresaId,                 // obrigatório!
    tipoTarefa,                // 'solicitacoes' ou 'obrigacoes'
    departamentos = [],
    status = [],
    campoData = "dataPrazo",   // default
    periodoInicial,
    periodoFinal,
    clientes = [],
    usuarios = [],
    processos = []
  } = req.body;

  // LOG INICIAL
  console.log("========== [Relatórios - performance] ==========");
  console.log("Body recebido:", req.body);

  if (!empresaId || !tipoTarefa) {
    return res.status(400).json({ error: "empresaId e tipoTarefa são obrigatórios." });
  }

  try {
    let resultados = [];

    if (tipoTarefa === "solicitacoes") {
      // ----- CONSULTA PARA TAREFAS -----
      let query = `
        SELECT 
          d.id as departamentoId,
          d.nome as departamentoNome,
          t.id, t.status, t.dataMeta, t.dataPrazo, t.dataConclusao,
          t.clienteId, t.responsavelId, t.processoId
        FROM tarefas t
        LEFT JOIN departamentos d ON t.departamentoId = d.id
        WHERE t.empresaId = ?
      `;
      const params = [empresaId];

      if (departamentos.length) {
        query += ` AND t.departamentoId IN (${departamentos.map(() => "?").join(",")})`;
        params.push(...departamentos);
      }
      if (clientes.length) {
        query += ` AND t.clienteId IN (${clientes.map(() => "?").join(",")})`;
        params.push(...clientes);
      }
      if (usuarios.length) {
        query += ` AND t.responsavelId IN (${usuarios.map(() => "?").join(",")})`;
        params.push(...usuarios);
      }
      if (processos.length) {
        query += ` AND t.processoId IN (${processos.map(() => "?").join(",")})`;
        params.push(...processos);
      }
      if (status.length) {
        query += ` AND t.status IN (${status.map(() => "?").join(",")})`;
        params.push(...status);
      }
      if (periodoInicial) {
        query += ` AND t.${campoData} >= ?`;
        params.push(periodoInicial);
      }
      if (periodoFinal) {
        query += ` AND t.${campoData} <= ?`;
        params.push(periodoFinal);
      }

      // Ordena por departamento
      query += " ORDER BY d.nome, t.dataPrazo";

      // LOG QUERY
      console.log("[Solicitações] Query:", query);
      console.log("[Solicitações] Params:", params);

      const [rows] = await db.query(query, params);

      console.log("[Solicitações] Rows retornados:", rows.length);
      if (rows.length) console.log("[Solicitações] Primeiro registro:", rows[0]);

      // ---- Consolida por departamento ----
      const porDepartamento = {};
      for (const t of rows) {
        const deptId = t.departamentoId || 0;
        const deptNome = t.departamentoNome || "Sem Departamento";
        if (!porDepartamento[deptId]) {
          porDepartamento[deptId] = {
            departamentoId: deptId,
            departamentoNome: deptNome,
            qtdTotal: 0,
            qtdAbertas: 0,
            qtdAtrasadas: 0,
            qtdConcluidasNaMeta: 0,
            qtdConcluidasAposPrazo: 0,
            tarefas: []
          };
        }

        porDepartamento[deptId].qtdTotal++;
        porDepartamento[deptId].tarefas.push(t);

        // Lógica semelhante ao painel de controle
        const hoje = new Date();
        const meta = t.dataMeta ? new Date(t.dataMeta) : null;
        const prazo = t.dataPrazo ? new Date(t.dataPrazo) : null;
        const conclusao = t.dataConclusao ? new Date(t.dataConclusao) : null;

        if (t.status && t.status.trim().toLowerCase() === "concluída") {
          if (conclusao && meta && conclusao <= meta) {
            porDepartamento[deptId].qtdConcluidasNaMeta++;
          } else if (conclusao && prazo && conclusao > prazo) {
            porDepartamento[deptId].qtdConcluidasAposPrazo++;
          } else {
            porDepartamento[deptId].qtdConcluidasNaMeta++; // fallback
          }
        } else if (prazo && hoje > prazo) {
          porDepartamento[deptId].qtdAtrasadas++;
        } else {
          porDepartamento[deptId].qtdAbertas++;
        }
      }

      resultados = Object.values(porDepartamento);

      // LOG resultado final
      console.log("[Solicitações] Resultado final por departamento:", resultados);
    }

    else if (tipoTarefa === "obrigacoes") {
      // ----- CONSULTA PARA OBRIGAÇÕES -----

      // Mapeamento correto do campo de data:
      let colunaData = "vencimento";
      if (campoData === "dataMeta") colunaData = "meta";
      else if (campoData === "dataConclusao") colunaData = "dataBaixa";
      else if (campoData === "dataPrazo") colunaData = "vencimento"; // default

      let query = `
        SELECT 
          d.id as departamentoId,
          d.nome as departamentoNome,
          oc.id, oc.status, oc.vencimento, oc.meta, oc.acao, oc.dataBaixa,
          o.metaQtdDias, o.metaTipoDias, o.acaoQtdDias, o.acaoTipoDias, oc.
          oc.clienteId
        FROM obrigacoes_clientes oc
        JOIN obrigacoes o ON oc.obrigacaoId = o.id
        LEFT JOIN departamentos d ON o.departamentoId = d.id
        WHERE o.empresaId = ?
      `;
      const params = [empresaId];

      if (departamentos.length) {
        query += ` AND o.departamentoId IN (${departamentos.map(() => "?").join(",")})`;
        params.push(...departamentos);
      }
      if (clientes.length) {
        query += ` AND oc.clienteId IN (${clientes.map(() => "?").join(",")})`;
        params.push(...clientes);
      }
      if (status.length) {
        query += ` AND oc.status IN (${status.map(() => "?").join(",")})`;
        params.push(...status);
      }
      if (periodoInicial) {
        query += ` AND oc.${colunaData} >= ?`;
        params.push(periodoInicial);
      }
      if (periodoFinal) {
        query += ` AND oc.${colunaData} <= ?`;
        params.push(periodoFinal);
      }

      // Ordena por departamento
      query += " ORDER BY d.nome, oc.vencimento";

      // LOG QUERY
      console.log("[Obrigações] campoData:", campoData, "=> colunaData:", colunaData);
      console.log("[Obrigações] Query:", query);
      console.log("[Obrigações] Params:", params);

      const [rows] = await db.query(query, params);

      console.log("[Obrigações] Rows retornados:", rows.length);
      if (rows.length) console.log("[Obrigações] Primeiro registro:", rows[0]);

      // ---- Consolida por departamento ----
      const porDepartamento = {};
      for (const o of rows) {
        const deptId = o.departamentoId || 0;
        const deptNome = o.departamentoNome || "Sem Departamento";
        if (!porDepartamento[deptId]) {
          porDepartamento[deptId] = {
            departamentoId: deptId,
            departamentoNome: deptNome,
            qtdTotal: 0,
            qtdAbertas: 0,
            qtdAtrasadas: 0,
            qtdConcluidasNaMeta: 0,
            qtdConcluidasAposPrazo: 0,
            obrigacoes: []
          };
        }

        porDepartamento[deptId].qtdTotal++;
        porDepartamento[deptId].obrigacoes.push(o);

        const hoje = new Date();
        const vencimento = o.vencimento ? new Date(o.vencimento) : null;
        // Aqui pode usar o campo meta, acao e dataBaixa se quiser depois!

        if (o.status && o.status.trim().toLowerCase() === "concluída") {
          // Aqui pode ser mais elaborado, ver regras do painel de controle...
          porDepartamento[deptId].qtdConcluidasNaMeta++;
        } else if (vencimento && hoje > vencimento) {
          porDepartamento[deptId].qtdAtrasadas++;
        } else {
          porDepartamento[deptId].qtdAbertas++;
        }
      }

      resultados = Object.values(porDepartamento);

      // LOG resultado final
      console.log("[Obrigações] Resultado final por departamento:", resultados);
    }

    else {
      return res.status(400).json({ error: "tipoTarefa inválido" });
    }

    return res.json({
      totalRegistros: resultados.length,
      paginaAtual: 1,
      totalPaginas: 1,
      data: resultados
    });

  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// POST /api/relatorios/baixas-diarias
router.post("/baixas-diarias", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const { empresaId, periodoInicio, periodoFim, departamentos = [], usuarios = [] } = req.body;

  if (!empresaId || !periodoInicio || !periodoFim) {
    return res.status(400).json({ error: "empresaId, periodoInicio e periodoFim são obrigatórios." });
  }

  const dtInicio = new Date(periodoInicio);
  const inicioDoMes = new Date(Date.UTC(dtInicio.getUTCFullYear(), dtInicio.getUTCMonth(), 1));
  const fimDoMes = new Date(Date.UTC(dtInicio.getUTCFullYear(), dtInicio.getUTCMonth() + 1, 0));
  const inicioDoMesStr = inicioDoMes.toISOString().split('T')[0];
  const fimDoMesStr = fimDoMes.toISOString().split('T')[0];
  const periodoIniStr = new Date(periodoInicio).toISOString().split('T')[0];
  const periodoFimStr = new Date(periodoFim).toISOString().split('T')[0];

  const toDateStr = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'string') return val.split('T')[0];
    return null;
  };

  try {
    // 1) Universo do mês
    let queryUniversoMes = `
      SELECT 
        u.id   AS usuarioId,
        u.nome AS usuarioNome,
        d.id   AS departamentoId,
        d.nome AS departamentoNome,
        oc.obrigacaoId,
        o.nome AS obrigacaoNome,
        COUNT(oc.id) AS totalDoMes
      FROM obrigacoes_clientes oc
      INNER JOIN usuarios u           ON oc.responsavelId = u.id
      INNER JOIN relacao_empresas re  ON u.id = re.usuarioId AND re.empresaId = ?
      INNER JOIN departamentos d      ON re.departamentoId = d.id
      INNER JOIN obrigacoes o         ON oc.obrigacaoId = o.id
      LEFT  JOIN clientes c           ON oc.clienteId = c.id
      WHERE (c.empresaId = ? OR o.empresaId = ?)
        AND DATE(oc.vencimento) >= ?
        AND DATE(oc.vencimento) <= ?
    `;
    const paramsUniverso = [empresaId, empresaId, empresaId, inicioDoMesStr, fimDoMesStr];
    if (departamentos.length > 0) {
      queryUniversoMes += ` AND d.id IN (${departamentos.map(() => '?').join(',')})`;
      paramsUniverso.push(...departamentos);
    }
    if (usuarios.length > 0) {
      queryUniversoMes += ` AND u.id IN (${usuarios.map(() => '?').join(',')})`;
      paramsUniverso.push(...usuarios);
    }
    queryUniversoMes += ` GROUP BY u.id, d.id, oc.obrigacaoId ORDER BY d.nome, u.nome, o.nome`;

    const [universoRows] = await db.query(queryUniversoMes, paramsUniverso);

    const universoMap = new Map();
    const universoPorUsuario = new Map();
    for (const r of universoRows) {
      const chave = `${r.usuarioId}-${r.obrigacaoId}`;
      universoMap.set(chave, { ...r, totalDoMes: Number(r.totalDoMes) });
      if (!universoPorUsuario.has(r.usuarioId)) {
        universoPorUsuario.set(r.usuarioId, {
          usuarioId: r.usuarioId,
          usuarioNome: r.usuarioNome,
          departamentoId: r.departamentoId,
          departamentoNome: r.departamentoNome,
          totalDoMes: 0
        });
      }
      universoPorUsuario.get(r.usuarioId).totalDoMes += Number(r.totalDoMes);
    }

    // 2) Baixas do mês
    let queryBaixasMes = `
      SELECT 
        u.id AS usuarioId,
        u.nome AS usuarioNome,
        u2.id AS concluidoPorId,
        u2.nome AS concluidoPorNome,
        d.id AS departamentoId,
        d.nome AS departamentoNome,
        oc.id AS obrigacaoClienteId,
        oc.nome AS obrigacaoClienteNome,
        oc.acao AS obrigacaoAcao,
        oc.status,
        oc.dataBaixa,
        oc.vencimento,
        oc.meta,
        oc.clienteId,
        c.nome AS clienteNome,
        oc.obrigacaoId,
        o.nome AS obrigacaoNome
      FROM obrigacoes_clientes oc
      INNER JOIN usuarios u           ON oc.responsavelId = u.id
      LEFT  JOIN usuarios u2          ON oc.concluido_por = u2.id
      INNER JOIN relacao_empresas re  ON u.id = re.usuarioId AND re.empresaId = ?
      INNER JOIN departamentos d      ON re.departamentoId = d.id
      LEFT  JOIN clientes c           ON oc.clienteId = c.id
      INNER JOIN obrigacoes o         ON oc.obrigacaoId = o.id
      WHERE (c.empresaId = ? OR o.empresaId = ?)
        AND DATE(oc.dataBaixa) >= ?
        AND DATE(oc.dataBaixa) <= ?
        AND oc.status IN ('concluída','realizada','concluida')
      ORDER BY d.nome, u.nome, oc.dataBaixa
    `;
    const paramsBaixasMes = [empresaId, empresaId, empresaId, inicioDoMesStr, fimDoMesStr];
    if (departamentos.length > 0) {
      queryBaixasMes = queryBaixasMes.replace(
        'ORDER BY d.nome, u.nome, oc.dataBaixa',
        ` AND d.id IN (${departamentos.map(() => '?').join(',')}) ORDER BY d.nome, u.nome, oc.dataBaixa`
      );
      paramsBaixasMes.push(...departamentos);
    }
    if (usuarios.length > 0) {
      queryBaixasMes = queryBaixasMes.replace(
        'ORDER BY d.nome, u.nome, oc.dataBaixa',
        ` AND u.id IN (${usuarios.map(() => '?').join(',')}) ORDER BY d.nome, u.nome, oc.dataBaixa`
      );
      paramsBaixasMes.push(...usuarios);
    }
    const [baixasMesRows] = await db.query(queryBaixasMes, paramsBaixasMes);

    // 3) Pré-carregar universo completo de tarefas do mês
    const [todasTarefasUniverso] = await db.query(`
      SELECT 
        oc.id as obrigacaoClienteId,
        oc.nome as obrigacaoClienteNome,
        oc.clienteId,
        c.nome as clienteNome,
        oc.vencimento,
        oc.meta,
        oc.acao as obrigacaoAcao,
        oc.responsavelId,
        oc.obrigacaoId
      FROM obrigacoes_clientes oc
      INNER JOIN clientes c ON oc.clienteId = c.id
      WHERE DATE(oc.vencimento) >= ? AND DATE(oc.vencimento) <= ?
    `, [inicioDoMesStr, fimDoMesStr]);

    // 3.1 Dias com baixa
    const datasComBaixa = [...new Set(baixasMesRows.map(r => toDateStr(r.dataBaixa)).filter(d => d >= periodoIniStr && d <= periodoFimStr))].sort();
    

    // 3.2 Contagens diárias
    const keyOf = (u, o) => `${u}-${o}`;
    const dailyCountPorChavePorDia = new Map();
    const dailyCountPorUsuarioPorDia = new Map();
    for (const row of baixasMesRows) {
      const dStr = toDateStr(row.dataBaixa);
      if (!dStr) continue;
      const chave = keyOf(row.usuarioId, row.obrigacaoId);
      if (!dailyCountPorChavePorDia.has(chave)) dailyCountPorChavePorDia.set(chave, new Map());
      dailyCountPorChavePorDia.get(chave).set(dStr, (dailyCountPorChavePorDia.get(chave).get(dStr) || 0) + 1);
      if (!dailyCountPorUsuarioPorDia.has(row.usuarioId)) dailyCountPorUsuarioPorDia.set(row.usuarioId, new Map());
      dailyCountPorUsuarioPorDia.get(row.usuarioId).set(dStr, (dailyCountPorUsuarioPorDia.get(row.usuarioId).get(dStr) || 0) + 1);
    }

    // CORREÇÃO: Construir universoMap baseado nas baixas reais, mas com totalDoMes correto
    const universoMapCorrigido = new Map();
    for (const row of baixasMesRows) {
      const chave = keyOf(row.usuarioId, row.obrigacaoId);
      if (!universoMapCorrigido.has(chave)) {
        // Buscar o total correto do mês baseado no vencimento (dia 1 ao 31)
        const totalCorretoDoMes = universoMap.get(chave)?.totalDoMes || 0;
        universoMapCorrigido.set(chave, {
          usuarioId: row.usuarioId,
          usuarioNome: row.usuarioNome,
          departamentoId: row.departamentoId,
          departamentoNome: row.departamentoNome,
          obrigacaoId: row.obrigacaoId,
          obrigacaoNome: row.obrigacaoNome,
          totalDoMes: totalCorretoDoMes // USAR O TOTAL CORRETO BASEADO NO VENCIMENTO
        });
      }
    }
    

    // 3.3 Acumulados
    const todasDatasBaixaNoMes = [...new Set(baixasMesRows.map(r => toDateStr(r.dataBaixa)).filter(Boolean))].sort();
    const acumuladoPorChaveAteDia = new Map();
    universoMapCorrigido.forEach((meta, chave) => {
      const accMap = new Map(); let acumulado = 0;
      for (const dia of todasDatasBaixaNoMes) {
        acumulado += (dailyCountPorChavePorDia.get(chave)?.get(dia) || 0);
        if (dia >= periodoIniStr && dia <= periodoFimStr) accMap.set(dia, acumulado);
      }
      acumuladoPorChaveAteDia.set(chave, accMap);
    });
    const acumuladoPorUsuarioAteDia = new Map();
    universoPorUsuario.forEach((metaU) => {
      const accMap = new Map(); let acumulado = 0;
      for (const dia of todasDatasBaixaNoMes) {
        acumulado += (dailyCountPorUsuarioPorDia.get(metaU.usuarioId)?.get(dia) || 0);
        if (dia >= periodoIniStr && dia <= periodoFimStr) accMap.set(dia, acumulado);
      }
      acumuladoPorUsuarioAteDia.set(metaU.usuarioId, accMap);
    });

   // ===== 3.4 Montagem do baixasPorData (AGORA COM DETALHES) =====
const baixasPorData = [];
for (const dia of datasComBaixa) {
  const itens = [];

  // ---------- (a) Visão agregada por usuário ----------
  universoPorUsuario.forEach((metaU) => {
    // Contagem no dia para decidir se incluímos
    const concluidasNoDia = dailyCountPorUsuarioPorDia.get(metaU.usuarioId)?.get(dia) || 0;
    if (concluidasNoDia > 0) {
      const concluidasAteDia = acumuladoPorUsuarioAteDia.get(metaU.usuarioId)?.get(dia) || 0;
      const restantesNoDia = Math.max(0, metaU.totalDoMes - concluidasNoDia);
      

      // ---- DETALHES (USUÁRIO) ----
      // 1) Detalhes das concluídas no dia
      const concluidasNoDiaDetalhes = baixasMesRows
        .filter(r =>
          r.usuarioId === metaU.usuarioId &&
          toDateStr(r.dataBaixa) === dia
        )
        .map(r => ({
          id: r.obrigacaoClienteId,
          status: r.status,
          departamentoId: r.departamentoId,
          departamentoNome: r.departamentoNome,
          usuarioId: r.usuarioId,
          usuarioNome: r.usuarioNome,
          concluidoPorId: r.concluidoPorId || r.usuarioId,
          concluidoPorNome: r.concluidoPorNome || r.usuarioNome,
          obrigacaoId: r.obrigacaoId,
          obrigacaoNome: r.obrigacaoNome,
          nome: r.obrigacaoClienteNome,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome,
          dataBaixa: r.dataBaixa,
          vencimento: r.vencimento,
          meta: r.meta,
          acao: r.obrigacaoAcao,
          tipo: "obrigacao",
          categoria: "Concluída"
        }));

      // 2) Detalhes das concluídas até o dia (acumulado)
      const concluidasAteDiaDetalhes = baixasMesRows
        .filter(r =>
          r.usuarioId === metaU.usuarioId &&
          toDateStr(r.dataBaixa) &&
          toDateStr(r.dataBaixa) <= dia
        )
        .map(r => ({
          id: r.obrigacaoClienteId,
          status: r.status,
          departamentoId: r.departamentoId,
          departamentoNome: r.departamentoNome,
          usuarioId: r.usuarioId,
          usuarioNome: r.usuarioNome,
          concluidoPorId: r.concluidoPorId || r.usuarioId,
          concluidoPorNome: r.concluidoPorNome || r.usuarioNome,
          obrigacaoId: r.obrigacaoId,
          obrigacaoNome: r.obrigacaoNome,
          nome: r.obrigacaoClienteNome,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome,
          dataBaixa: r.dataBaixa,
          vencimento: r.vencimento,
          meta: r.meta,
          acao: r.obrigacaoAcao,
          tipo: "obrigacao",
          categoria: "Concluída"
        }));

      // 3) Detalhes das restantes até o dia (universo do mês - baixadas até o dia)
      const baixadasAteDiaIdsUser = new Set(
        concluidasAteDiaDetalhes.map(r => r.id)
      );

      const restantesNoDiaDetalhes = todasTarefasUniverso
        .filter(r =>
          r.responsavelId === metaU.usuarioId &&
          !baixadasAteDiaIdsUser.has(r.obrigacaoClienteId)
        )
        .map(r => ({
          id: r.obrigacaoClienteId,
          status: "pendente",
          departamentoId: metaU.departamentoId,
          departamentoNome: metaU.departamentoNome,
          usuarioId: metaU.usuarioId,
          usuarioNome: metaU.usuarioNome,
          obrigacaoId: r.obrigacaoId,
          obrigacaoNome: (universoMap.get(`${metaU.usuarioId}-${r.obrigacaoId}`)?.obrigacaoNome) || null,
          nome: r.obrigacaoClienteNome,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome,
          vencimento: r.vencimento,
          meta: r.meta,
          acao: r.obrigacaoAcao,
          tipo: "obrigacao",
          categoria: "Pendente"
        }));

      // Se houver mais de um concluinte no dia, não definimos concluidoPorNome no agregado de usuário_total
      const concluintesDoDia = new Set(concluidasNoDiaDetalhes.map(x => x.concluidoPorNome || x.usuarioNome).filter(Boolean));
      itens.push({
        escopo: 'usuario_total',
        departamentoId: metaU.departamentoId,
        departamentoNome: metaU.departamentoNome,
        usuarioId: metaU.usuarioId,
        usuarioNome: metaU.usuarioNome,
        totalDoMes: metaU.totalDoMes,
        concluidasNoDia,
        concluidasAteDia,
        restantesNoDia,
        concluidasNoDiaDetalhes,
        concluidasAteDiaDetalhes,
        restantesNoDiaDetalhes,
        concluidoPorNome: concluintesDoDia.size === 1 ? Array.from(concluintesDoDia)[0] : null
      });
    }
  });

  // ---------- (b) Visão detalhada por usuário+obrigação ----------
  universoMapCorrigido.forEach((meta, chave) => {
    // Reagrupar por concluinte para esta obrigação no dia, RESTRITO ao responsável deste meta
    const rowsDoDia = baixasMesRows.filter(r => r.obrigacaoId === meta.obrigacaoId && r.usuarioId === meta.usuarioId && toDateStr(r.dataBaixa) === dia);
    
    
    if (rowsDoDia.length === 0) return;

    // Agrupar por concluinte (concluido_por quando existir; fallback responsavel)
    const grupos = new Map();
    for (const r of rowsDoDia) {
      const conclId = r.concluidoPorId || r.usuarioId;
      const conclNome = r.concluidoPorNome || r.usuarioNome;
      if (!grupos.has(conclId)) grupos.set(conclId, { nome: conclNome, rows: [] });
      grupos.get(conclId).rows.push(r);
    }

    grupos.forEach((g) => {
      const concluidasNoDia = g.rows.length;
      if (concluidasNoDia === 0) return;

      const concluidasAteDia = baixasMesRows.filter(r => r.obrigacaoId === meta.obrigacaoId && r.usuarioId === meta.usuarioId && (r.concluidoPorId || r.usuarioId) === (g.rows[0].concluidoPorId || g.rows[0].usuarioId) && toDateStr(r.dataBaixa) && toDateStr(r.dataBaixa) <= dia).length;
      const restantesNoDia = Math.max(0, meta.totalDoMes - concluidasNoDia);

      const concluidasNoDiaDetalhes = g.rows.map(r => ({
        id: r.obrigacaoClienteId,
        status: r.status,
        departamentoId: r.departamentoId,
        departamentoNome: r.departamentoNome,
        usuarioId: r.usuarioId,
        usuarioNome: r.usuarioNome,
        concluidoPorId: r.concluidoPorId || r.usuarioId,
        concluidoPorNome: r.concluidoPorNome || r.usuarioNome,
        obrigacaoId: r.obrigacaoId,
        obrigacaoNome: r.obrigacaoNome,
        nome: r.obrigacaoClienteNome,
        clienteId: r.clienteId,
        clienteNome: r.clienteNome,
        dataBaixa: r.dataBaixa,
        vencimento: r.vencimento,
        meta: r.meta,
        acao: r.obrigacaoAcao,
        tipo: "obrigacao",
        categoria: "Concluída"
      }));

      const concluidasAteDiaDetalhes = baixasMesRows
        .filter(r => r.obrigacaoId === meta.obrigacaoId && r.usuarioId === meta.usuarioId && (r.concluidoPorId || r.usuarioId) === (g.rows[0].concluidoPorId || g.rows[0].usuarioId) && toDateStr(r.dataBaixa) && toDateStr(r.dataBaixa) <= dia)
        .map(r => ({
          id: r.obrigacaoClienteId,
          status: r.status,
          departamentoId: r.departamentoId,
          departamentoNome: r.departamentoNome,
          usuarioId: r.usuarioId,
          usuarioNome: r.usuarioNome,
          concluidoPorId: r.concluidoPorId || r.usuarioId,
          concluidoPorNome: r.concluidoPorNome || r.usuarioNome,
          obrigacaoId: r.obrigacaoId,
          obrigacaoNome: r.obrigacaoNome,
          nome: r.obrigacaoClienteNome,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome,
          dataBaixa: r.dataBaixa,
          vencimento: r.vencimento,
          meta: r.meta,
          acao: r.obrigacaoAcao,
          tipo: "obrigacao",
          categoria: "Concluída"
        }));

      const baixadasAteDiaIds = new Set(concluidasAteDiaDetalhes.map(r => r.id));
      const restantesNoDiaDetalhes = todasTarefasUniverso
        .filter(r => r.responsavelId === meta.usuarioId && r.obrigacaoId === meta.obrigacaoId && !baixadasAteDiaIds.has(r.obrigacaoClienteId))
        .map(r => ({
          id: r.obrigacaoClienteId,
          status: "pendente",
          departamentoId: meta.departamentoId,
          departamentoNome: meta.departamentoNome,
          usuarioId: meta.usuarioId,
          usuarioNome: meta.usuarioNome,
          obrigacaoId: r.obrigacaoId,
          obrigacaoNome: meta.obrigacaoNome,
          nome: r.obrigacaoClienteNome,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome,
          vencimento: r.vencimento,
          meta: r.meta,
          acao: r.obrigacaoAcao,
          tipo: "obrigacao",
          categoria: "Pendente"
        }));

      itens.push({
        escopo: 'usuario_obrigacao',
        departamentoId: meta.departamentoId,
        departamentoNome: meta.departamentoNome,
        usuarioId: meta.usuarioId,
        usuarioNome: meta.usuarioNome,
        obrigacaoId: meta.obrigacaoId,
        obrigacaoNome: meta.obrigacaoNome,
        totalDoMes: meta.totalDoMes,
        concluidasNoDia,
        concluidasAteDia,
        restantesNoDia,
        concluidasNoDiaDetalhes,
        concluidasAteDiaDetalhes,
        restantesNoDiaDetalhes,
        concluidoPorNome: g.rows[0].concluidoPorNome || g.rows[0].usuarioNome
      });
    });
  });

  if (itens.length > 0) {
    baixasPorData.push({ data: dia, itens });
    
  }
}


    // 4) Legado
    // (mantive igual ao seu código anterior — se quiser posso reescrever também)

    res.json({ 
      periodo: { inicioDoMes: inicioDoMesStr, periodoInicio: periodoIniStr, periodoFim: periodoFimStr },
      universoResumo: Array.from(universoPorUsuario.values()),
      baixasPorData
    });

  } catch (error) {
    console.error("Erro ao buscar baixas diárias:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});




// GET /api/obrigacoes/empresa/:empresaId/pendentes-mes
router.get("/empresa/:empresaId/pendentes-mes", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const { empresaId } = req.params;
  const { periodoFim, departamentos = [], usuarios = [] } = req.query;

  if (!empresaId || !periodoFim) {
    return res.status(400).json({ error: "empresaId e periodoFim são obrigatórios." });
  }

  try {
    const dataLimite = periodoFim;

    // QUERY PARA TAREFAS PENDENTES - TODAS que vencem até o período
    let queryTarefas = `
      SELECT 
        u.id as usuarioId,
        u.nome as usuarioNome,
        d.id as departamentoId,
        d.nome as departamentoNome,
        t.id as tarefaId,
        t.assunto as tarefaNome,
        t.status,
        t.dataPrazo,
        t.dataMeta,
        t.clienteId,
        c.nome as clienteNome,
        t.processoId,
        p.nome as processoNome,
        'tarefa' as tipo
      FROM tarefas t
      INNER JOIN usuarios u ON t.responsavelId = u.id
      INNER JOIN relacao_empresas re ON u.id = re.usuarioId AND re.empresaId = ?
      INNER JOIN departamentos d ON re.departamentoId = d.id
      LEFT JOIN clientes c ON t.clienteId = c.id
      LEFT JOIN processos p ON t.processoId = p.id
      WHERE t.empresaId = ?
        AND t.status NOT IN ('concluída', 'concluida', 'cancelada')
        AND t.dataPrazo <= ?
    `;

    // QUERY PARA OBRIGAÇÕES PENDENTES - TODAS que vencem até o período
    let queryObrigacoes = `
      SELECT 
        u.id as usuarioId,
        u.nome as usuarioNome,
        d.id as departamentoId,
        d.nome as departamentoNome,
        oc.id as obrigacaoClienteId,
        oc.nome as obrigacaoClienteNome,
        oc.status,
        oc.vencimento,
        oc.meta,
        oc.clienteId,
        c.nome as clienteNome,
        oc.obrigacaoId,
        o.nome as obrigacaoNome,
        'obrigacao' as tipo
      FROM obrigacoes_clientes oc
      INNER JOIN usuarios u ON oc.responsavelId = u.id
      INNER JOIN relacao_empresas re ON u.id = re.usuarioId AND re.empresaId = ?
      INNER JOIN departamentos d ON re.departamentoId = d.id
      INNER JOIN clientes c ON oc.clienteId = c.id
      INNER JOIN obrigacoes o ON oc.obrigacaoId = o.id
      WHERE o.empresaId = ?
        AND oc.status NOT IN ('concluída', 'concluida', 'realizada', 'cancelada')
        AND oc.vencimento <= ?
    `;

    const paramsTarefas = [empresaId, empresaId, dataLimite];
    const paramsObrigacoes = [empresaId, empresaId, dataLimite];

    // Aplicar filtros de departamento
    if (departamentos.length > 0) {
      queryTarefas += ` AND d.id IN (${departamentos.map(() => '?').join(',')})`;
      queryObrigacoes += ` AND d.id IN (${departamentos.map(() => '?').join(',')})`;
      paramsTarefas.push(...departamentos);
      paramsObrigacoes.push(...departamentos);
    }

    // Aplicar filtros de usuário
    if (usuarios.length > 0) {
      queryTarefas += ` AND u.id IN (${usuarios.map(() => '?').join(',')})`;
      queryObrigacoes += ` AND u.id IN (${usuarios.map(() => '?').join(',')})`;
      paramsTarefas.push(...usuarios);
      paramsObrigacoes.push(...usuarios);
    }

    queryTarefas += ` ORDER BY d.nome, u.nome, t.dataPrazo`;
    queryObrigacoes += ` ORDER BY d.nome, u.nome, oc.vencimento`;

    // EXECUTAR AMBAS AS QUERIES
    const [tarefasRows] = await db.query(queryTarefas, paramsTarefas);
    const [obrigacoesRows] = await db.query(queryObrigacoes, paramsObrigacoes);

    // COMBINAR OS RESULTADOS
    const todasPendentes = [...tarefasRows, ...obrigacoesRows];

    // Agrupar os dados por departamento e usuário
    const pendentesAgrupados = [];
    let departamentosMap = new Map();

    todasPendentes.forEach(row => {
      const deptId = row.departamentoId;
      const userId = row.usuarioId;

      if (!departamentosMap.has(deptId)) {
        departamentosMap.set(deptId, {
          departamentoId: deptId,
          departamentoNome: row.departamentoNome,
          totalPendentes: 0,
          totalTarefas: 0,
          totalObrigacoes: 0,
          usuarios: new Map()
        });
      }

      const dept = departamentosMap.get(deptId);
      
      if (!dept.usuarios.has(userId)) {
        dept.usuarios.set(userId, {
          usuarioId: userId,
          usuarioNome: row.usuarioNome,
          totalPendentes: 0,
          totalTarefas: 0,
          totalObrigacoes: 0,
          tarefas: [],
          obrigacoes: []
        });
      }

      const user = dept.usuarios.get(userId);
      
      if (row.tipo === 'tarefa') {
        // Adicionar tarefa pendente
        user.tarefas.push({
          tarefaId: row.tarefaId,
          tarefaNome: row.tarefaNome,
          status: row.status,
          dataPrazo: row.dataPrazo,
          dataMeta: row.dataMeta,
          clienteId: row.clienteId,
          clienteNome: row.clienteNome,
          processoId: row.processoId,
          processoNome: row.processoNome
        });
        user.totalTarefas++;
        dept.totalTarefas++;
      } else {
        // Adicionar obrigação pendente
        user.obrigacoes.push({
          obrigacaoClienteId: row.obrigacaoClienteId,
          obrigacaoClienteNome: row.obrigacaoClienteNome,
          status: row.status,
          vencimento: row.vencimento,
          meta: row.meta,
          clienteId: row.clienteId,
          clienteNome: row.clienteNome,
          obrigacaoId: row.obrigacaoId,
          obrigacaoNome: row.obrigacaoNome
        });
        user.totalObrigacoes++;
        dept.totalObrigacoes++;
      }

      user.totalPendentes++;
      dept.totalPendentes++;
    });

    // Converter Maps para arrays
    departamentosMap.forEach(dept => {
      dept.usuarios = Array.from(dept.usuarios.values());
      pendentesAgrupados.push(dept);
    });

    res.json({ 
      pendentesAgrupados,
      totalGeral: {
        totalDepartamentos: pendentesAgrupados.length,
        totalUsuarios: pendentesAgrupados.reduce((acc, dept) => acc + dept.usuarios.length, 0),
        totalTarefas: pendentesAgrupados.reduce((acc, dept) => acc + dept.totalTarefas, 0),
        totalObrigacoes: pendentesAgrupados.reduce((acc, dept) => acc + dept.totalObrigacoes, 0),
        totalPendentes: pendentesAgrupados.reduce((acc, dept) => acc + dept.totalPendentes, 0)
      }
    });

  } catch (error) {
    console.error("Erro ao buscar tarefas pendentes:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});


// ROTA ESSENCIAL: Buscar grupos de clientes da empresa
router.get("/clientes/grupos/empresa/:empresaId", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const { empresaId } = req.params;

  if (!empresaId) {
    return res.status(400).json({ error: "empresaId é obrigatório." });
  }

  try {
    const query = `
      SELECT 
        cg.id,
        cg.nome,
        cg.empresaId
      FROM clientes_grupos cg
      WHERE cg.empresaId = ?
      ORDER BY cg.nome
    `;

    const [rows] = await db.query(query, [empresaId]);

    // Normalizar nomes dos grupos para o dropdown
    const gruposNormalizados = rows.map(grupo => ({
      ...grupo,
      nome: grupo.nome.toLowerCase()
        .split(' ')
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(' ')
    }));

    console.log(`[Grupos] Encontrados ${gruposNormalizados.length} grupos para empresa ${empresaId}`);
    
    res.json(gruposNormalizados);

  } catch (error) {
    console.error("Erro ao buscar grupos de clientes:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// NOVA ROTA: Buscar tarefas dos clientes de um grupo específico
router.get("/tarefas/por-grupo/:empresaId", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const { empresaId } = req.params;
  let { grupos } = req.query;

  if (!empresaId) {
    return res.status(400).json({ error: "empresaId é obrigatório." });
  }

  // Converter grupos para array se vier como string
  if (typeof grupos === 'string') {
    grupos = grupos.split(',').map(id => parseInt(id.trim()));
  } else if (Array.isArray(grupos)) {
    grupos = grupos.map(id => parseInt(id));
  } else {
    grupos = [];
  }

  if (grupos.length === 0) {
    return res.status(400).json({ error: "Pelo menos um grupo deve ser especificado." });
  }

  try {
    const query = `
      SELECT 
        cg.id as grupoId,
        cg.nome as grupoNome,
        c.id as clienteId,
        c.nome as clienteNome,
        c.cnpjCpf as clienteCnpj,
        oc.id as obrigacaoClienteId,
        oc.nome as obrigacaoClienteNome,
        oc.status as obrigacaoStatus,
        oc.vencimento,
        oc.meta,
        oc.acao,
        oc.dataBaixa,
        o.nome as obrigacaoBaseNome,
        o.departamentoId,
        d.nome as departamentoNome
      FROM clientes_grupos cg
      INNER JOIN clientes_grupos_vinculo cgv ON cg.id = cgv.grupoId
      INNER JOIN clientes c ON cgv.clienteId = c.id
      LEFT JOIN obrigacoes_clientes oc ON c.id = oc.clienteId
      LEFT JOIN obrigacoes o ON oc.obrigacaoId = o.id
      LEFT JOIN departamentos d ON o.departamentoId = d.id
      WHERE cg.empresaId = ? AND cg.id IN (${grupos.map(() => '?').join(',')})
      ORDER BY cg.nome, c.nome, oc.vencimento
    `;

    const params = [empresaId, ...grupos];
    const [rows] = await db.query(query, params);

    // Função para normalizar nomes (primeira letra maiúscula)
    function normalizarNome(nome) {
      if (!nome) return nome;
      return nome.toLowerCase()
        .split(' ')
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(' ');
    }

    // Organizar os dados por grupo e cliente
    const resultado = {};
    
    rows.forEach(row => {
      const grupoId = row.grupoId;
      const clienteId = row.clienteId;
      
      if (!resultado[grupoId]) {
        resultado[grupoId] = {
          grupoId: grupoId,
          grupoNome: normalizarNome(row.grupoNome), // NOME NORMALIZADO!
          clientes: {}
        };
      }
      
      if (!resultado[grupoId].clientes[clienteId]) {
        resultado[grupoId].clientes[clienteId] = {
          clienteId: clienteId,
          clienteNome: normalizarNome(row.clienteNome), // NOME DO CLIENTE NORMALIZADO!
          clienteCnpj: row.clienteCnpj,
          obrigacoes: []
        };
      }
      
      // Adicionar obrigação se existir
      if (row.obrigacaoClienteId) {
        resultado[grupoId].clientes[clienteId].obrigacoes.push({
          id: row.obrigacaoClienteId,
          nome: row.obrigacaoClienteNome,
          status: row.obrigacaoStatus,
          vencimento: row.vencimento,
          meta: row.meta,
          acao: row.acao,
          dataBaixa: row.dataBaixa,
          obrigacaoBaseNome: row.obrigacaoBaseNome,
          departamentoId: row.departamentoId,
          departamentoNome: row.departamentoNome
        });
      }
    });

    // Converter para array
    const resultadoFinal = Object.values(resultado).map(grupo => ({
      ...grupo,
      clientes: Object.values(grupo.clientes)
    }));

    console.log(`[Clientes e Obrigações por Grupo] Encontrados ${resultadoFinal.length} grupos para empresa ${empresaId}`);
    
    res.json(resultadoFinal);

  } catch (error) {
    console.error("Erro ao buscar clientes e obrigações por grupo:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/obrigacoes/por-usuario/:empresaId
router.get("/obrigacoes/por-usuario/:empresaId", autenticarToken, verificarPermissao('relatorios.gerar'), async (req, res) => {
  const { empresaId } = req.params;
  const { usuarioId } = req.query;

  if (!empresaId) {
    return res.status(400).json({ error: "empresaId é obrigatório." });
  }

  try {
    let query = `
      SELECT DISTINCT
        oc.id as obrigacaoClienteId,
        oc.nome as obrigacaoClienteNome,
        oc.clienteId,
        oc.obrigacaoId,
        oc.status,
        oc.vencimento,
        oc.meta,
        oc.acao,
        oc.dataBaixa,
        ocr.usuarioId
      FROM obrigacoes_clientes oc
      INNER JOIN obrigacoes_clientes_responsaveis ocr ON oc.id = ocr.obrigacaoClienteId
      INNER JOIN obrigacoes o ON oc.obrigacaoId = o.id
      WHERE o.empresaId = ?
    `;

    const params = [empresaId];

    // Se foi passado usuarioId, filtrar por ele
    if (usuarioId) {
      query += ` AND ocr.usuarioId = ?`;
      params.push(usuarioId);
    }

    query += ` ORDER BY oc.vencimento`;

    const [rows] = await db.query(query, params);

    console.log(`[Obrigações por Usuário] Encontradas ${rows.length} obrigações para empresa ${empresaId}${usuarioId ? ` e usuário ${usuarioId}` : ''}`);
    
    res.json(rows);

  } catch (error) {
    console.error("Erro ao buscar obrigações por usuário:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
