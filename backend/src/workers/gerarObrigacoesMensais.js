require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../config/database');
const cron = require('node-cron');

const gerarObrigacoesMensais = async () => {
  try {
    const hoje = new Date();
    const competencia = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

    const [clientes] = await db.query("SELECT id FROM clientes");
    console.log(`[DEBUG] Clientes encontrados: ${clientes.length}`);

    const [obrigacoes] = await db.query("SELECT id FROM obrigacoes WHERE recorrencia = 'mensal'");
    console.log(`[DEBUG] Obrigações mensais encontradas: ${obrigacoes.length}`);

    const [existentes] = await db.query(
      "SELECT clienteId, obrigacaoId FROM obrigacoes_clientes WHERE competencia = ?",
      [competencia]
    );

    const existenteMap = new Set(
      existentes.map(row => `${row.clienteId}-${row.obrigacaoId}`)
    );

    const registros = [];

    for (const cliente of clientes) {
      for (const obrigacao of obrigacoes) {
        const chave = `${cliente.id}-${obrigacao.id}`;
        if (!existenteMap.has(chave)) {
          registros.push([cliente.id, obrigacao.id, competencia, 'pendente', 0, new Date()]);
        }
      }
    }

    if (registros.length > 0) {
      await db.query(
        `INSERT INTO obrigacoes_clientes 
         (clienteId, obrigacaoId, competencia, status, baixadaAutomaticamente, dataCriacao)
         VALUES ?`,
        [registros]
      );
      console.log(`[CRON] ✅ ${registros.length} obrigações ${competencia} criadas.`);
    } else {
      console.log(`[CRON] ⚠️ Nenhuma obrigação nova para ${competencia}.`);
    }
  } catch (error) {
    console.error('[CRON] ❌ Erro ao gerar obrigações:', error);
  }
};

// ⏱ Executa automaticamente todo dia 1 às 00:00
cron.schedule('0 0 1 * *', gerarObrigacoesMensais);

// ✅ Executa agora se você rodar manualmente
gerarObrigacoesMensais();
