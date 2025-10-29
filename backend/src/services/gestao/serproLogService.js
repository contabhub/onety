const db = require("../../config/database");

function calcularCustoSerpro(tipoOperacao, consumoAtual) {
  const tabelas = {
    consulta: [
      { min: 1, max: 300, preco: 0.24 },
      { min: 301, max: 1000, preco: 0.21 },
      { min: 1001, max: 3000, preco: 0.18 },
      { min: 3001, max: 7000, preco: 0.16 },
      { min: 7001, max: 15000, preco: 0.14 },
      { min: 15001, max: 23000, preco: 0.11 },
      { min: 23001, max: 30000, preco: 0.09 },
      { min: 30001, max: Infinity, preco: 0.06 }
    ],
    emissao: [
      { min: 1, max: 500, preco: 0.32 },
      { min: 501, max: 5000, preco: 0.29 },
      { min: 5001, max: 10000, preco: 0.26 },
      { min: 10001, max: 15000, preco: 0.22 },
      { min: 15001, max: 25000, preco: 0.19 },
      { min: 25001, max: 35000, preco: 0.16 },
      { min: 35001, max: 50000, preco: 0.12 },
      { min: 50001, max: Infinity, preco: 0.08 }
    ],
    declaracao: [
      { min: 1, max: 100, preco: 0.40 },
      { min: 101, max: 500, preco: 0.36 },
      { min: 501, max: 1000, preco: 0.32 },
      { min: 1001, max: 3000, preco: 0.28 },
      { min: 3001, max: 5000, preco: 0.24 },
      { min: 5001, max: 8000, preco: 0.20 },
      { min: 8001, max: 10000, preco: 0.16 },
      { min: 10001, max: Infinity, preco: 0.12 }
    ]
  };
  const tabela = tabelas[tipoOperacao];
  if (!tabela) return null;
  const faixa = tabela.find(f => consumoAtual >= f.min && consumoAtual <= f.max);
  return faixa ? faixa.preco : null;
}

async function registrarRequisicaoSerpro({ empresaId, cnpjEmpresa, tipoOperacao, endpoint, status, detalhes }) {
  console.log("📊 Registrando requisição Serpro:", { empresaId, cnpjEmpresa, tipoOperacao, endpoint, status });
  
  try {
    // Busca o consumo do mês para a empresa e operação
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM serpro_requisicoes WHERE empresa_id = ? AND tipo_operacao = ? AND MONTH(data_hora) = MONTH(NOW()) AND YEAR(data_hora) = YEAR(NOW())`,
      [empresaId, tipoOperacao]
    );
    const consumoAtual = (total || 0) + 1;
    const custo = calcularCustoSerpro(tipoOperacao, consumoAtual);
    
    console.log("💰 Custo calculado:", { consumoAtual, custo });
    
    await db.query(`
      INSERT INTO serpro_requisicoes 
        (empresa_id, cnpj_empresa, tipo_operacao, endpoint, status, detalhes, custo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      empresaId,
      cnpjEmpresa,
      tipoOperacao,
      endpoint,
      status,
      typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes),
      custo
    ]);
    
    console.log("✅ Requisição Serpro registrada com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar requisição Serpro:", error.message);
    throw error;
  }
}

module.exports = { registrarRequisicaoSerpro }; 