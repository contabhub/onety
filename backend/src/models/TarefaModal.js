const db = require("../config/database");

const TarefaModal = {
  async criarTarefa(tarefa) {
    const {
      empresaId,
      departamentoId,
      processoId,
      atividadeId,
      clienteId,
      assunto,
      descricao,
      responsavelId,
      anexos,
      podeFinalizarAntesSubatendimentos,
      tarefaPaiId,
      dataAcao,
      dataMeta,
      dataPrazo,
    } = tarefa;

    let tarefaData = {
      empresaId,
      departamentoId,
      processoId,
      atividadeId: atividadeId || null,
      clienteId,
      assunto,
      dataAcao: dataAcao || null,
      dataMeta: dataMeta || null,
      dataPrazo: dataPrazo || null,
      descricao,
      responsavelId,
      anexos: anexos || null,
      podeFinalizarAntesSubatendimentos: !!podeFinalizarAntesSubatendimentos,
      tarefaPaiId: tarefaPaiId || null,
    };

    // Se não vierem datas, calcula como antes
    if (!dataAcao || !dataMeta || !dataPrazo) {
      // Buscar dados do processo para pegar diasMeta e diasPrazo
      const [[processo]] = await db.query(
        `SELECT dias_meta AS diasMeta, dias_prazo AS diasPrazo FROM processos WHERE id = ?`,
        [processoId]
      );
      if (!processo) {
        throw new Error("Processo não encontrado para cálculo de datas.");
      }
      const [[datasCalculadas]] = await db.query(`
        SELECT 
          CURDATE() AS dataAcao,
          DATE_ADD(CURDATE(), INTERVAL ? DAY) AS dataMeta, 
          DATE_ADD(DATE_ADD(CURDATE(), INTERVAL ? DAY), INTERVAL ? DAY) AS dataPrazo
      `, [processo.diasMeta, processo.diasMeta, processo.diasPrazo]);
      tarefaData.dataAcao = tarefaData.dataAcao || datasCalculadas.dataAcao;
      tarefaData.dataMeta = tarefaData.dataMeta || datasCalculadas.dataMeta;
      tarefaData.dataPrazo = tarefaData.dataPrazo || datasCalculadas.dataPrazo;
    }

    const [resultado] = await db.execute(
      `INSERT INTO tarefas (
        empresa_id, departamento_id, processo_id, atividade_id, cliente_id, assunto,
        data_acao, data_meta, data_prazo, descricao, responsavel_id, anexos, pode_finalizar_antes_subatendimento, tarefa_pai_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tarefaData.empresaId,
        tarefaData.departamentoId,
        tarefaData.processoId,
        tarefaData.atividadeId,
        tarefaData.clienteId,
        tarefaData.assunto,
        tarefaData.dataAcao,
        tarefaData.dataMeta,
        tarefaData.dataPrazo,
        tarefaData.descricao,
        tarefaData.responsavelId,
        tarefaData.anexos,
        tarefaData.podeFinalizarAntesSubatendimentos ? 1 : 0,
        tarefaData.tarefaPaiId,
      ]
    );

    return resultado.insertId;
  },
};

module.exports = TarefaModal;
