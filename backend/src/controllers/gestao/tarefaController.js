const TarefaModal = require("../../models/TarefaModal");
const db = require("../../config/database");
const emailService = require("../../services/gestao/emailService");

const criarTarefa = async (req, res) => {
  const conn = await db.getConnection();
  try {
    console.log("Iniciando a criação da tarefa...");
    await conn.beginTransaction();

    const {
      empresaId,
      departamentoId,
      processoId,
      atividadeId,
      clienteId,
      assunto,
      dataAcao,
      dataMeta,
      dataPrazo,
      descricao,
      responsavelId,
      anexos,
      podeFinalizarAntesSubatendimentos,
      tarefaPaiId,
      subatendimentosIds, // ✅ NOVO: IDs dos subatendimentos selecionados pelo usuário
    } = req.body;

    console.log("Dados recebidos para criação da tarefa:", req.body);
    console.log("Subatendimentos selecionados:", subatendimentosIds);

    if (!empresaId || !departamentoId || !processoId || !clienteId || !assunto) {
      throw new Error("Faltando parâmetros obrigatórios");
    }

    const id = await TarefaModal.criarTarefa({
      empresaId,
      departamentoId,
      processoId,
      atividadeId,
      clienteId,
      assunto,
      dataAcao,
      dataMeta,
      dataPrazo,
      descricao,
      responsavelId,
      anexos,
      podeFinalizarAntesSubatendimentos,
      tarefaPaiId,
    });

    console.log("Tarefa criada com sucesso. ID:", id);

    const [[{ processoId: processoIdDb }]] = await conn.query(`SELECT processoId FROM tarefas WHERE id = ?`, [id]);

    const [atividades] = await conn.query(
      `SELECT id FROM atividades_processo WHERE processoId = ?`,
      [processoIdDb]
    );

    for (const atividade of atividades) {
      await conn.query(
        `INSERT INTO atividades_tarefas (tarefaId, atividadeId, concluida) VALUES (?, ?, 0)`,
        [id, atividade.id]
      );
    }

    // ✅ NOVO: Buscar subprocessos baseado na seleção do usuário
    let subprocessosQuery;
    let subprocessosParams;
    
    if (subatendimentosIds && subatendimentosIds.length > 0) {
      // ✅ Usar apenas os subatendimentos selecionados pelo usuário
      subprocessosQuery = `
        SELECT processo_filho_id 
        FROM processos_vinculos 
        WHERE processo_pai_id = ? AND processo_filho_id IN (${subatendimentosIds.map(() => '?').join(',')})
      `;
      subprocessosParams = [processoId, ...subatendimentosIds];
    } else {
      // ✅ Se nenhum selecionado, não criar subprocessos
      subprocessosQuery = `SELECT processo_filho_id FROM processos_vinculos WHERE processo_pai_id = ? AND 1 = 0`;
      subprocessosParams = [processoId];
    }

    const [subprocessos] = await conn.query(subprocessosQuery, subprocessosParams);

    const subtarefasCriadas = [];

    for (const sub of subprocessos) {
      const subId = sub.processo_filho_id;

      // Buscar dados do processo filho para replicar corretamente (usando diasMeta/diasPrazo)
      const [[subProcessoData]] = await conn.query(
        `SELECT nome, responsavelId, departamentoId, diasMeta, diasPrazo FROM processos WHERE id = ?`,
        [subId]
      );

      // Calcular datas do subprocesso
      function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + (days || 0));
        return d.toISOString().substring(0, 10);
      }
      const dataAcaoSub = dataAcao;
      const dataMetaSub = subProcessoData.diasMeta != null ? addDays(dataAcaoSub, subProcessoData.diasMeta) : null;
      const dataPrazoSub = subProcessoData.diasPrazo != null ? addDays(dataAcaoSub, subProcessoData.diasPrazo) : null;

      const subTarefaPayload = {
        empresaId,
        departamentoId: subProcessoData.departamentoId || departamentoId,
        processoId: subId,
        atividadeId: null,
        clienteId,
        assunto: subProcessoData.nome,
        dataAcao: dataAcaoSub,
        dataMeta: dataMetaSub,
        dataPrazo: dataPrazoSub,
        responsavelId: subProcessoData.responsavelId || responsavelId,
        anexos,
        podeFinalizarAntesSubatendimentos: false,
        tarefaPaiId: id,
      };
      // Só adiciona descricao se existir no objeto pai
      if (typeof descricao !== 'undefined') {
        subTarefaPayload.descricao = descricao;
      }
      const subTarefaId = await TarefaModal.criarTarefa(subTarefaPayload);

      // Armazenar dados da subtarefa criada para notificação
      subtarefasCriadas.push({
        id: subTarefaId,
        assunto: subProcessoData.nome,
        dataAcao: dataAcaoSub,
        dataMeta: dataMetaSub,
        dataPrazo: dataPrazoSub,
        responsavelId: subProcessoData.responsavelId || responsavelId,
      });

      const [atividadesSub] = await conn.query(
        `SELECT id FROM atividades_processo WHERE processoId = ?`,
        [subId]
      );

      for (const at of atividadesSub) {
        await conn.query(
          `INSERT INTO atividades_tarefas (tarefaId, atividadeId, concluida) VALUES (?, ?, 0)`,
          [subTarefaId, at.id]
        );
      }
    }

    await conn.commit();

    // Notificar responsável principal da tarefa
    try {
      // Buscar dados da tarefa criada
      const [[tarefa]] = await db.query(
        `SELECT * FROM tarefas WHERE id = ?`,
        [id]
      );

      // Buscar dados do usuário que criou a tarefa
      const [[usuarioCriador]] = await db.query(
        `SELECT nome, email FROM usuarios WHERE id = ?`,
        [req.usuario.id || req.usuario.usuarioId]
      );

      // Buscar dados do responsável principal
      if (responsavelId) {
        const [[responsavel]] = await db.query(
          `SELECT nome, email, telefone FROM usuarios WHERE id = ?`,
          [responsavelId]
        );

        if (responsavel) {
          // Buscar nome da empresa e do processo
          const [[empresa]] = await db.query(
            `SELECT e.razaoSocial as empresaNome FROM empresas e WHERE e.id = ?`,
            [empresaId]
          );
          const [[processo]] = await db.query(
            `SELECT nome FROM processos WHERE id = ?`,
            [processoId]
          );

          // Saudação dinâmica
          const hora = new Date().getHours();
          let saudacao = "Bom dia";
          if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
          else if (hora >= 18 || hora < 5) saudacao = "Boa noite";

          // Função para formatar data em dd/mm/yyyy
          function formatarDataBR(dataStr) {
            if (!dataStr) return '-';
            const d = new Date(dataStr);
            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const ano = d.getFullYear();
            return `${dia}/${mes}/${ano}`;
          }

          // Montar mensagem personalizada
          const mensagem = `${saudacao}, ${responsavel.nome}!

Você foi designado(a) como responsável por uma nova tarefa no sistema Titan.

Tarefa: ${assunto}
ID da Tarefa: ${id}
Empresa: ${empresa?.empresaNome || '-'}
Processo: ${processo?.nome || '-'}
Data de Ação: ${formatarDataBR(dataAcao)}
Prazo: ${formatarDataBR(dataPrazo)}

Acesse: https://app.cftitan.com.br para mais detalhes e para acompanhar o andamento.

Conte com a gente para o que precisar!`;

          // Enviar WhatsApp se tiver telefone
          if (responsavel.telefone) {
            // Formatar telefone para internacional (remover caracteres não numéricos)
            const numero = responsavel.telefone.replace(/\D/g, "");
            // Enviar via Z-API
            fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
              },
              body: JSON.stringify({
                phone: numero,
                message: mensagem
              })
            }).then(() => {}).catch(() => {}); // Não bloquear o fluxo se falhar
          }

          // Enviar email
          if (responsavel.email) {
            await emailService.notificarResponsavelPrincipal(
              tarefa,
              responsavel,
              usuarioCriador,
              empresa?.empresaNome || 'Empresa'
            );
          }
        }
      }
    } catch (notificacaoError) {
      console.error("❌ Erro ao enviar notificações para responsável principal:", notificacaoError);
      // Não falha a criação da tarefa se a notificação falhar
    }

    // Notificar responsáveis de subtarefas (após commit para garantir que não falhe)
    if (subtarefasCriadas.length > 0) {
      try {
        // Buscar dados da tarefa pai criada
        const [[tarefaPai]] = await db.query(
          `SELECT * FROM tarefas WHERE id = ?`,
          [id]
        );

        // Buscar dados do usuário que criou a tarefa
        const [[usuarioCriador]] = await db.query(
          `SELECT nome, email FROM usuarios WHERE id = ?`,
          [req.usuario.id || req.usuario.usuarioId]
        );

        // Enviar notificações por WhatsApp para responsáveis das subtarefas
        for (const subtarefa of subtarefasCriadas) {
          if (!subtarefa.responsavelId) continue;
          // Buscar telefone do responsável
          const [[responsavel]] = await db.query(
            `SELECT nome, email, telefone FROM usuarios WHERE id = ?`,
            [subtarefa.responsavelId]
          );
          if (responsavel && responsavel.telefone) {
            // Buscar nome da empresa e do processo pai
            const [[empresa]] = await db.query(
              `SELECT e.razaoSocial as empresaNome FROM empresas e WHERE e.id = ?`,
              [empresaId]
            );
            const [[processoPai]] = await db.query(
              `SELECT nome FROM processos WHERE id = ?`,
              [processoId]
            );
            // Saudação dinâmica
            const hora = new Date().getHours();
            let saudacao = "Bom dia";
            if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
            else if (hora >= 18 || hora < 5) saudacao = "Boa noite";
            // Função para formatar data em dd/mm/yyyy
            function formatarDataBR(dataStr) {
              if (!dataStr) return '-';
              const d = new Date(dataStr);
              const dia = String(d.getDate()).padStart(2, '0');
              const mes = String(d.getMonth() + 1).padStart(2, '0');
              const ano = d.getFullYear();
              return `${dia}/${mes}/${ano}`;
            }
            // Montar mensagem personalizada
            const mensagem = `${saudacao}, ${responsavel.nome}!

Você foi designado(a) como responsável por uma nova subtarefa no sistema Titan.

Subtarefa: ${subtarefa.assunto}
ID da Tarefa: ${subtarefa.id}
Empresa: ${empresa?.empresaNome || '-'}
Processo: ${processoPai?.nome || '-'}
Data de Ação: ${formatarDataBR(subtarefa.dataAcao)}
Prazo: ${formatarDataBR(subtarefa.dataPrazo)}

Acesse: https://app.cftitan.com.br para mais detalhes e para acompanhar o andamento.

Conte com a gente para o que precisar!`;
            // Formatar telefone para internacional (remover caracteres não numéricos)
            const numero = responsavel.telefone.replace(/\D/g, "");
            // Enviar via Z-API para responsáveis de subtarefas
            fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
              },
              body: JSON.stringify({
                phone: numero,
                message: mensagem
              })
            }).then(() => {}).catch(() => {}); // Não bloquear o fluxo se falhar
          }
        }

        // Enviar notificações por email
        await emailService.notificarResponsaveisSubtarefas(
          tarefaPai,
          subtarefasCriadas,
          usuarioCriador
        );
      } catch (emailError) {
        console.error("❌ Erro ao enviar notificações por email/whatsapp:", emailError);
        // Não falha a criação da tarefa se o email/whatsapp falhar
      }
    }

    res.status(201).json({ mensagem: "Tarefa criada com sucesso", id });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao criar tarefa:", error);
    res.status(500).json({ erro: "Erro ao criar tarefa" });
  } finally {
    conn.release();
  }
};

const buscarTarefaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `
      SELECT 
        t.*,
        c.nome AS clienteNome,
        c.cnpjCpf AS clienteCnpjCpf,
        u.nome AS responsavelNome
      FROM tarefas t
      LEFT JOIN clientes c ON t.clienteId = c.id
      LEFT JOIN usuarios u ON t.responsavelId = u.id
      WHERE t.id = ?
      `,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

    const tarefa = result[0];

    res.json({
      ...tarefa,
      cliente: {
        id: tarefa.clienteId,
        nome: tarefa.clienteNome,
        cnpjCpf: tarefa.clienteCnpjCpf,
      },
      responsavel: {
        id: tarefa.responsavelId,
        nome: tarefa.responsavelNome,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar tarefa:", error);
    res.status(500).json({ error: "Erro interno ao buscar tarefa" });
  }
};

const listarAtividadesDaTarefa = async (req, res) => {
  const { id } = req.params;

  try {
    const [atividades] = await db.query(
      "SELECT * FROM atividades_processo WHERE processoId = (SELECT processoId FROM tarefas WHERE id = ?)",
      [id]
    );

    res.json(atividades);
  } catch (error) {
    console.error("Erro ao buscar atividades da tarefa:", error);
    res.status(500).json({ error: "Erro ao buscar atividades da tarefa" });
  }
};

const buscarSubprocessosComTarefas = async (req, res) => {
  const { id } = req.params;

  try {
    const [[tarefa]] = await db.query("SELECT empresaId FROM tarefas WHERE id = ?", [id]);

    if (!tarefa) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

    const [subtarefas] = await db.query(
      `
      SELECT 
        t.id, 
        t.assunto, 
        t.dataAcao, 
        t.dataMeta,
        t.dataPrazo,
        t.status,
        t.departamentoId
      FROM tarefas t
      WHERE t.tarefaPaiId = ?
        AND t.empresaId = ?
      ORDER BY t.dataPrazo
      `,
      [id, tarefa.empresaId]
    );

    res.json(subtarefas);
  } catch (error) {
    console.error("Erro ao buscar subprocessos da tarefa:", error);
    res.status(500).json({ error: "Erro interno ao buscar subprocessos." });
  }
};

const concluirTarefaHandler = async (req, res) => {
  const { id } = req.params;
  let { dataConclusao } = req.body;

  console.log("🟡 Recebido PATCH para concluir tarefa");
  console.log("🟡 ID recebido:", id);
  console.log("🟡 dataConclusao recebida:", dataConclusao);

  try {
    // Buscar tarefa, incluindo info do processo (se existir)
    const [[tarefa]] = await db.query(
      `
        SELECT t.*, p.podeFinalizarAntesSubatendimentos 
        FROM tarefas t
        LEFT JOIN processos p ON t.processoId = p.id
        WHERE t.id = ?
      `,
      [id]
    );

    console.log("🟢 Tarefa encontrada no banco:", tarefa);

    if (!tarefa) {
      console.error("🔴 Tarefa não encontrada!");
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

    // Só valida subtarefas SE for tarefa de processo
    if (
      tarefa.processoId &&
      tarefa.podeFinalizarAntesSubatendimentos !== null &&
      !tarefa.podeFinalizarAntesSubatendimentos
    ) {
      console.log("🟡 Verificando subtarefas abertas...");

      const [subtarefas] = await db.query(
        `SELECT id, status FROM tarefas WHERE tarefaPaiId = ?`,
        [id]
      );

      console.log("🟡 Subtarefas encontradas:", subtarefas);

      const algumAberto = subtarefas.some((sub) => sub.status !== "concluída" && sub.status !== "cancelada");

      if (algumAberto) {
        console.error("🔴 Existem subtarefas abertas, não pode concluir!");
        return res.status(400).json({ error: "Existem subtarefas ainda não concluídas." });
      }
    }

    // ===============================
    // Corrige para Horário de Brasília
    // ===============================
    let dataParaSalvar;
    const pad = n => String(n).padStart(2, "0");

    if (dataConclusao) {
      let data = new Date(dataConclusao);

      // Subtrai 3h para converter UTC -> Brasília (UTC-3)
      data.setHours(data.getHours() - 3);

      dataParaSalvar =
        data.getFullYear() + "-" +
        pad(data.getMonth() + 1) + "-" +
        pad(data.getDate()) + " " +
        pad(data.getHours()) + ":" +
        pad(data.getMinutes()) + ":" +
        pad(data.getSeconds());
    } else {
      // Se não veio nada, pega o horário atual já ajustando
      const agora = new Date();
      agora.setHours(agora.getHours() - 3);
      dataParaSalvar =
        agora.getFullYear() + "-" +
        pad(agora.getMonth() + 1) + "-" +
        pad(agora.getDate()) + " " +
        pad(agora.getHours()) + ":" +
        pad(agora.getMinutes()) + ":" +
        pad(agora.getSeconds());
    }

    console.log("🟠 Data final que será salva no UPDATE:", dataParaSalvar);

    await db.query(
      `UPDATE tarefas SET status = 'concluída', dataConclusao = ? WHERE id = ?`,
      [dataParaSalvar, id]
    );

    console.log("🟢 Tarefa atualizada com sucesso no banco!");

    // 📧 Enviar notificações de conclusão
    try {
      // Buscar tarefa atualizada com data de conclusão
      const [[tarefaAtualizada]] = await db.query(
        `SELECT * FROM tarefas WHERE id = ?`,
        [id]
      );

      // Buscar dados do usuário que finalizou a tarefa
      const usuarioId = req.usuario?.id;
      let usuarioQueFinalizou = { nome: 'Sistema' };
      
      if (usuarioId) {
        const [[usuario]] = await db.query(
          `SELECT nome FROM usuarios WHERE id = ?`,
          [usuarioId]
        );
        if (usuario) {
          usuarioQueFinalizou = usuario;
        }
      }

      // Enviar notificações (não bloquear o response se falhar)
      setImmediate(async () => {
        try {
          await emailService.notificarConclusaoTarefa(tarefaAtualizada, usuarioQueFinalizou);
        } catch (notificacaoError) {
          console.error("❌ Erro ao enviar notificações de conclusão:", notificacaoError);
        }
      });

    } catch (notificacaoError) {
      console.error("❌ Erro ao preparar notificações de conclusão:", notificacaoError);
      // Não falha a conclusão da tarefa se as notificações falharem
    }

    res.json({ mensagem: "Tarefa concluída com sucesso" });
  } catch (error) {
    console.error("🔴 Erro ao concluir tarefa:", error);
    res.status(500).json({ error: "Erro interno ao concluir tarefa" });
  }
};

const cancelarTarefaHandler = async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar tarefa, incluindo info do processo (se existir)
    const [[tarefa]] = await db.query(
      `SELECT t.*, p.podeFinalizarAntesSubatendimentos 
        FROM tarefas t
        LEFT JOIN processos p ON t.processoId = p.id
        WHERE t.id = ?`,
      [id]
    );

    if (!tarefa) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

    // Só valida subtarefas SE for tarefa de processo
    if (
      tarefa.processoId &&
      tarefa.podeFinalizarAntesSubatendimentos !== null &&
      !tarefa.podeFinalizarAntesSubatendimentos
    ) {
      const [subtarefas] = await db.query(
        `SELECT id, status FROM tarefas WHERE tarefaPaiId = ?`,
        [id]
      );
      const algumAberto = subtarefas.some((sub) => sub.status !== "concluída" && sub.status !== "cancelada");
      if (algumAberto) {
        return res.status(400).json({ error: "Existem subtarefas ainda não concluídas ou canceladas." });
      }
    }

    // Data de cancelamento (Brasília)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3);
    const pad = n => String(n).padStart(2, "0");
    const dataCancelamento =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(
      `UPDATE tarefas SET status = 'cancelada', dataCancelamento = ? WHERE id = ?`,
      [dataCancelamento, id]
    );

    res.json({ mensagem: "Tarefa cancelada com sucesso" });
  } catch (error) {
    console.error("Erro ao cancelar tarefa:", error);
    res.status(500).json({ error: "Erro interno ao cancelar tarefa" });
  }
};

const reabrirTarefaHandler = async (req, res) => {
  const { id } = req.params;
  try {
    // Limpa dataConclusao e dataCancelamento, status volta para 'aberta'
    await db.query(
      `UPDATE tarefas SET status = 'aberta', dataConclusao = NULL, dataCancelamento = NULL WHERE id = ?`,
      [id]
    );
    res.json({ mensagem: "Tarefa reaberta com sucesso" });
  } catch (error) {
    console.error("Erro ao reabrir tarefa:", error);
    res.status(500).json({ error: "Erro interno ao reabrir tarefa" });
  }
};


const listarAtividadesComStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const [atividades] = await db.query(
      `
SELECT
  at.id AS atividadeTarefaId,
  at.atividade_id as atividadeId,
  ap.ordem,
  COALESCE(ap.tipo, at.tipo) AS tipo,
  COALESCE(ap.texto, at.texto) AS texto,
  COALESCE(ap.descricao, at.descricao) AS descricao,
  COALESCE(ap.tipo_cancelamento, at.tipo_cancelamento) AS tipoCancelamento,
  at.concluido as concluida,
  at.cancelado as cancelada,
  at.justificativa,
  at.data_conclusao as dataConclusao,
  at.data_conclusao as dataCancelamento,
  at.concluido_por as concluidoPorNome,
  at.base64 AS base64,
  at.nomeArquivo
FROM atividades_tarefas at
LEFT JOIN atividades_processo ap ON at.atividade_id = ap.id
WHERE at.tarefa_id = ?
ORDER BY ap.ordem IS NULL, ap.ordem, at.id
      `,
      [id]
    );

    res.json(atividades);
  } catch (error) {
    console.error("Erro ao listar atividades da tarefa:", error);
    res.status(500).json({ error: "Erro ao buscar atividades da tarefa" });
  }
};

const concluirAtividadeTarefa = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  const usuario = req.usuario;
  try {
    await db.query(
      `
        UPDATE atividades_tarefas
        SET concluida = 1,
            dataConclusao = NOW(),
            concluidoPorNome = ?
        WHERE id = ?
      `,
      [usuario.nome, atividadeTarefaId]
    );

    res.json({ mensagem: "Atividade marcada como concluída" });
  } catch (error) {
    console.error("Erro ao concluir atividade:", error);
    res.status(500).json({ error: "Erro ao concluir atividade" });
  }
};

const salvarAnexoAtividade = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  const { base64, nomeArquivo } = req.body;

  try {
    await db.query(
      `
        UPDATE atividades_tarefas
        SET base64 = ?, nomeArquivo = ?
        WHERE id = ?
      `,
      [base64, nomeArquivo, atividadeTarefaId]
    );

    res.json({ mensagem: "Anexo salvo com sucesso." });
  } catch (error) {
    console.error("Erro ao salvar anexo:", error);
    res.status(500).json({ erro: "Erro ao salvar anexo." });
  }
};

const excluirAnexoAtividade = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  try {
    // Remove anexos da tabela anexos_atividade
    await db.query(
      `DELETE FROM anexos_atividade WHERE atividade_tarefa_id = ?`,
      [atividadeTarefaId]
    );
    // Limpa campos da tabela atividades_tarefas (mantém compatibilidade)
    await db.query(
      `UPDATE atividades_tarefas 
       SET base64 = NULL, nomeArquivo = NULL, concluida = 0, dataConclusao = NULL, concluidoPorNome = NULL 
       WHERE id = ?`,
      [atividadeTarefaId]
    );
    res.json({ mensagem: "Anexo removido e atividade desconcluída." });
  } catch (error) {
    console.error("Erro ao excluir anexo:", error);
    res.status(500).json({ erro: "Erro ao excluir anexo." });
  }
};

// Disconcluir atividade (remover status de concluída)
const disconcluirAtividadeTarefa = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  try {
    await db.query(
      `UPDATE atividades_tarefas
       SET concluida = 0, dataConclusao = NULL, concluidoPorNome = NULL
       WHERE id = ?`,
      [atividadeTarefaId]
    );
    res.json({ mensagem: "Atividade marcada como não concluída" });
  } catch (error) {
    console.error("Erro ao disconcluir atividade:", error);
    res.status(500).json({ error: "Erro ao disconcluir atividade" });
  }
};

// 1. Cancelar atividade tarefa
const cancelarAtividadeTarefa = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  const { justificativa } = req.body;
  try {
    // Data de cancelamento (Brasília)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3);
    const pad = n => String(n).padStart(2, "0");
    const dataCancelamento =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(
      `UPDATE atividades_tarefas SET cancelada = 1, justificativa = ?, dataCancelamento = ? WHERE id = ?`,
      [justificativa || null, dataCancelamento, atividadeTarefaId]
    );
    res.json({ mensagem: "Atividade cancelada com sucesso" });
  } catch (error) {
    console.error("Erro ao cancelar atividade:", error);
    res.status(500).json({ error: "Erro ao cancelar atividade" });
  }
};

// 2. Descancelar atividade tarefa
const descancelarAtividadeTarefa = async (req, res) => {
  const { atividadeTarefaId } = req.params;
  try {
    await db.query(
      `UPDATE atividades_tarefas SET cancelada = 0, justificativa = NULL, dataCancelamento = NULL WHERE id = ?`,
      [atividadeTarefaId]
    );
    res.json({ mensagem: "Atividade reativada com sucesso" });
  } catch (error) {
    console.error("Erro ao descancelar atividade:", error);
    res.status(500).json({ error: "Erro ao descancelar atividade" });
  }
};

const downloadAnexo = async (req, res) => {
  const { anexoId } = req.params;
  try {
    const [[anexo]] = await db.query('SELECT nome_arquivo, base64 FROM anexos_atividade WHERE id = ?', [anexoId]);
    if (!anexo) return res.status(404).send('Arquivo não encontrado');
    const buffer = Buffer.from(anexo.base64, 'base64');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nome_arquivo)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    console.error('Erro ao fazer download do anexo:', err);
    res.status(500).send('Erro ao baixar anexo');
  }
};


module.exports = {
  criarTarefa,
  buscarTarefaPorId,
  listarAtividadesDaTarefa,
  buscarSubprocessosComTarefas,
  concluirTarefaHandler,
  cancelarTarefaHandler,
  reabrirTarefaHandler,
  listarAtividadesComStatus,
  concluirAtividadeTarefa,
  salvarAnexoAtividade,
  excluirAnexoAtividade,
  disconcluirAtividadeTarefa,
  cancelarAtividadeTarefa,
  descancelarAtividadeTarefa,
  downloadAnexo,
};



