// api/jobs/baixarObrigacoesAutomaticamente.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require("../config/database");
const moment = require("moment");

// IMPORTAR SERVICES
const dctfwebService = require("../services/dctfwebService");
const sitfisService = require("../services/sitfisService");
const parcelamentosService = require("../services/parcelamentosService");
// (esses nomes podem ajustar conforme seu backend real)

(async () => {
  try {
    const hoje = moment();
    const competenciaAtual = hoje.format("MM/YYYY");

    const [obrigacoesPendentes] = await db.query(
      `SELECT 
        oc.id, 
        oc.clienteId, 
        oc.obrigacaoId, 
        oc.competencia, 
        c.empresaId, -- 🔵 PEGANDO empresaId DIRETO
        o.codigo_receita, 
        o.tipo_arquivo
       FROM obrigacoes_clientes oc
       JOIN obrigacoes o ON o.id = oc.obrigacaoId
       JOIN clientes c ON c.id = oc.clienteId
       WHERE oc.status = 'pendente'
      `
    );    

    let baixadas = 0;

    for (const obrig of obrigacoesPendentes) {
      const { id, clienteId, empresaId, competencia, codigo_receita, tipo_arquivo } = obrig;
    
      let encontrada = false;
    
      // ✨ AQUI: separar mês e ano
      const hoje = moment();
      const competenciaDinamica = hoje.subtract(1, 'month');
      const mesPA = competenciaDinamica.format("MM");
      const anoPA = competenciaDinamica.format("YYYY");
          
      switch (codigo_receita) {
        case "DCTFWeb":
  const anoPA = competencia.split("/")[1];
  const mesPA = competencia.split("/")[0];
  const categoria = "GERAL_MENSAL"; // ou 40, depende como você quer (nome ou número)

  encontrada = await dctfwebService.consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA);
  break;
    
        case "PARCELAMENTO":
          if (hoje.date() === 1) {
            encontrada = await parcelamentosService.regular(clienteId, empresaId);
          }
          break;
    
        default:
          break;
      }
    
      if (encontrada) {
        await db.query(
          `UPDATE obrigacoes_clientes 
           SET status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = NOW() 
           WHERE id = ?`,
          [id]
        );
        baixadas++;
      }
    }

    console.log(`[BAIXA AUTOMÁTICA] ${baixadas} obrigações foram baixadas automaticamente.`);
  } catch (error) {
    console.error("[BAIXA AUTOMÁTICA] Erro:", error);
  }
})();
