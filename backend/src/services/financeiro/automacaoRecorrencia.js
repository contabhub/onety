const pool = require('../../config/database');
const { sendEmailWithPDF, sendEmail } = require('../../config/email');
const axios = require('axios');
const { format, parseISO } = require('date-fns');
const { normalizarContaCorrente, detectarTipoPessoa } = require('./cnaeIbge');
const { calcularProximoVencimento } = require('./dateUtils');

class AutomacaoRecorrencia {
  constructor() {
    this.EMAIL_ADMIN = process.env.EMAIL_ADMIN || "admin@example.com";
  }

  // 🔍 Verificar contratos e vendas que precisam de boleto - NOVA ESTRUTURA
  async verificarContratosParaBoleto() {
    try {
      console.log("🔄 Verificando vendas prontas para geração de boletos...");
      
      // 🆕 NOVO: Primeiro verificar boletos pagos para atualizar vendas
      console.log("💰 Verificando boletos pagos para atualizar vendas...");
      await this.verificarBoletosPagosParaAtualizarVendas();
      
      // 🎯 NOVA LÓGICA: Buscar vendas específicas que chegaram na data de gerar boleto
      console.log("🔍 Buscando vendas prontas para boleto (nova estrutura)...");
      
      // Buscar vendas de contratos (com recorrência)
      const [vendasComRecorrencia] = await pool.query(`
        SELECT 
          v.id as venda_id,
          v.valor_venda as valor,
          v.vencimento as proximo_vencimento,
          v.vencimento as dia_gerado,
          v.situacao as status,
          v.contrato_origem_id,
          v.mes_referencia,
          v.ano_referencia,
          v.company_id,
          cli.nome_fantasia as cliente_nome,
          cli.cnpj as cliente_cpf_cnpj,
          cli.e_mail_principal as cliente_email,
          cli.endereco as cliente_endereco,
          cli.numero as cliente_numero,
          cli.complemento as cliente_complemento,
          cli.bairro as cliente_bairro,
          cli.cidade as cliente_cidade,
          cli.estado as cliente_estado,
          cli.cep as cliente_cep,
          cli.tipo_de_pessoa as cliente_tipo_pessoa,
          co.nome as empresa_nome,
          rvc.tipo_intervalo,
          rvc.intervalo,
          'venda' as tipo_origem
        FROM vendas v
        INNER JOIN clientes cli ON v.cliente_id = cli.id
        INNER JOIN companies co ON v.company_id = co.id
        INNER JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
        WHERE rvc.tipo_origem = 'venda'
          AND rvc.status = 'ativo'
          AND v.situacao IN ('pendente', 'ativo')
          AND v.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY)
          AND NOT EXISTS (
            SELECT 1 FROM boletos b WHERE b.venda_id = v.id
          )
        ORDER BY v.vencimento ASC
      `);
      
      // Buscar vendas avulsas (sem recorrência, mas com situação 'ativo')
      const [vendasAvulsas] = await pool.query(`
        SELECT 
          v.id as venda_id,
          v.valor_venda as valor,
          v.vencimento as proximo_vencimento,
          v.vencimento as dia_gerado,
          v.situacao as status,
          v.contrato_origem_id,
          NULL as mes_referencia,
          NULL as ano_referencia,
          v.company_id,
          cli.nome_fantasia as cliente_nome,
          cli.cnpj as cliente_cpf_cnpj,
          cli.e_mail_principal as cliente_email,
          cli.endereco as cliente_endereco,
          cli.numero as cliente_numero,
          cli.complemento as cliente_complemento,
          cli.bairro as cliente_bairro,
          cli.cidade as cliente_cidade,
          cli.estado as cliente_estado,
          cli.cep as cliente_cep,
          cli.tipo_de_pessoa as cliente_tipo_pessoa,
          co.nome as empresa_nome,
          NULL as tipo_intervalo,
          NULL as intervalo,
          'venda_avulsa' as tipo_origem
        FROM vendas v
        INNER JOIN clientes cli ON v.cliente_id = cli.id
        INNER JOIN companies co ON v.company_id = co.id
        LEFT JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
        WHERE v.situacao = 'ativo'
          AND v.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY)
          AND rvc.id IS NULL  -- Sem recorrência
          AND NOT EXISTS (
            SELECT 1 FROM boletos b WHERE b.venda_id = v.id
          )
        ORDER BY v.vencimento ASC
      `);
      
      // Combinar ambas as listas
      const vendasProntas = [...vendasComRecorrencia, ...vendasAvulsas];

      console.log(`📊 Vendas com recorrência: ${vendasComRecorrencia.length} (DESABILITADO PARA TESTE)`);
      console.log(`📊 Vendas avulsas (ativas): ${vendasAvulsas.length}`);
      console.log(`📊 Total vendas prontas para boleto: ${vendasProntas.length}`);
      console.log(`🧪 MODO TESTE: Processando apenas vendas avulsas para evitar lotar SMTP`);
      
      if (vendasProntas.length > 0) {
        console.log("📋 Primeira venda encontrada:", JSON.stringify(vendasProntas[0], null, 2));
      } else {
        console.log("⚠️ Nenhuma venda pronta para boleto encontrada");
      }

      // 🔍 LEGADO: Buscar contratos antigos (indeterminados) que ainda usam o sistema antigo
      console.log("🔍 Buscando contratos legados (sistema antigo)...");
      const [contratosLegados] = await pool.query(`
        SELECT 
          c.id as contrato_id,
          c.valor,
          c.proximo_vencimento,
          c.dia_gerado,
          c.status,
          c.company_id,
          cli.nome_fantasia as cliente_nome,
          cli.cnpj as cliente_cpf_cnpj,
          cli.e_mail_principal as cliente_email,
          cli.endereco as cliente_endereco,
          cli.numero as cliente_numero,
          cli.complemento as cliente_complemento,
          cli.bairro as cliente_bairro,
          cli.cidade as cliente_cidade,
          cli.estado as cliente_estado,
          cli.cep as cliente_cep,
          cli.tipo_de_pessoa as cliente_tipo_pessoa,
          co.nome as empresa_nome,
          rvc.tipo_intervalo,
          rvc.intervalo,
          'contrato' as tipo_origem
        FROM contratos c
        INNER JOIN clientes cli ON c.cliente_id = cli.id
        INNER JOIN companies co ON c.company_id = co.id
        INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
        WHERE rvc.tipo_origem = 'contrato'
          AND rvc.indeterminado = 1
          AND rvc.status = 'ativo'
          AND c.status = 'ativo'
          AND (c.proximo_vencimento IS NULL OR c.proximo_vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
          AND NOT EXISTS (
            SELECT 1 FROM vendas v WHERE v.contrato_origem_id = c.id
          )
      `);

      console.log(`📊 Contratos legados encontrados: ${contratosLegados.length}`);
      
      // 🔄 Processar vendas prontas (NOVA ESTRUTURA)
      const resultadosVendas = [];
      console.log("🔄 Processando vendas prontas para boleto...");
      for (const venda of vendasProntas) {
        try {
          const item = { ...venda, id: venda.venda_id, tipo: 'venda' };
          console.log(`🔄 Processando venda ${item.id} (${item.mes_referencia}º mês de ${item.ano_referencia})...`);
          const resultado = await this.processarVendaEspecifica(item);
          resultadosVendas.push(resultado);
          console.log(`✅ Venda ${item.id} processada com sucesso!`);
        } catch (error) {
          console.error(`❌ Erro ao processar venda ${venda.venda_id}:`, error);
          // Continuar com a próxima venda
        }
      }
      
      // 🔄 Processar contratos legados (SISTEMA ANTIGO)
      const resultadosContratos = [];
      console.log("🔄 Processando contratos legados...");
      for (const contrato of contratosLegados) {
        try {
          const item = { ...contrato, id: contrato.contrato_id, tipo: 'contrato' };
          console.log(`🔄 Processando contrato legado ${item.id}...`);
          const resultado = await this.processarItem(item);
          resultadosContratos.push(resultado);
          console.log(`✅ Contrato legado ${item.id} processado com sucesso!`);
        } catch (error) {
          console.error(`❌ Erro ao processar contrato legado ${contrato.contrato_id}:`, error);
        }
      }

      // 🔍 Verificar se precisa gerar vendas para próximo ano
      await this.verificarRenovacaoAnual();

      // Combinar resultados
      const resultados = [...resultadosVendas, ...resultadosContratos];
      console.log(`🎉 Processamento completo: ${resultadosVendas.length} vendas + ${resultadosContratos.length} contratos legados = ${resultados.length} itens processados`);
      
      return resultados;
    } catch (error) {
      console.error("❌ Erro ao verificar contratos:", error);
      throw error;
    }
  }

  // 🎯 NOVA FUNÇÃO: Processar venda específica (sem alterar próximo vencimento)
  async processarVendaEspecifica(venda) {
    try {
      // Log diferenciado para vendas de contrato vs vendas avulsas
      if (venda.contrato_origem_id && venda.mes_referencia && venda.ano_referencia) {
        console.log(`🎯 Processando venda de contrato ${venda.id} - ${venda.cliente_nome} (${venda.mes_referencia}º mês de ${venda.ano_referencia})`);
      } else {
        console.log(`🎯 Processando venda avulsa ${venda.id} - ${venda.cliente_nome}`);
      }
      
      // Gerar boleto para esta venda específica
      const boleto = await this.gerarBoletoParaVenda(venda);
      console.log(`✅ Boleto gerado: ${boleto.codigoSolicitacao}`);

      // Enviar por email
      await this.enviarBoletoPorEmail(venda, boleto, venda.proximo_vencimento);
      console.log(`📧 Email enviado com sucesso`);

      // Marcar venda como processada (boleto gerado)
      await pool.query(
        "UPDATE vendas SET situacao = 'processado' WHERE id = ?",
        [venda.id]
      );
      console.log(`📅 Venda ${venda.id} marcada como 'processado'`);

      // 🔍 Verificar se esta foi a última venda do ano e precisa renovar (APENAS PARA VENDAS DE CONTRATOS)
      if (venda.contrato_origem_id && venda.ano_referencia) {
        await this.verificarSePrecisaRenovarAposVenda(venda.contrato_origem_id, venda.ano_referencia);
      }

      return boleto;
    } catch (error) {
      console.error(`❌ Erro ao processar venda específica ${venda.id}:`, error);
      
      // Email de erro desabilitado para evitar lotar SMTP
      // await this.enviarEmailErro(venda, error);
      console.log(`⚠️ Email de erro não enviado para evitar lotar SMTP`);
      
      throw error;
    }
  }

  // 🔍 NOVA FUNÇÃO: Verificar se precisa renovar após processar uma venda (APENAS EM DEZEMBRO)
  async verificarSePrecisaRenovarAposVenda(contratoId, anoReferencia) {
    try {
      const mesAtual = new Date().getMonth() + 1; // Janeiro = 1, Dezembro = 12
      
      // Só funciona em dezembro
      if (mesAtual !== 12) {
        console.log(`⏳ Renovação automática só funciona em dezembro. Mês atual: ${mesAtual}`);
        return;
      }

      console.log(`🔍 [DEZEMBRO] Verificando se contrato ${contratoId} precisa renovar após processar venda do ano ${anoReferencia}...`);
      
      // Verificar se todas as vendas deste ano já foram processadas
      const [vendasAno] = await pool.query(`
        SELECT 
          COUNT(*) as total_vendas,
          COUNT(CASE WHEN situacao = 'processado' THEN 1 END) as vendas_processadas,
          MAX(mes_referencia) as ultimo_mes
        FROM vendas 
        WHERE contrato_origem_id = ? AND ano_referencia = ?
      `, [contratoId, anoReferencia]);

      const { total_vendas, vendas_processadas, ultimo_mes } = vendasAno[0];
      
      console.log(`📊 Contrato ${contratoId} - Ano ${anoReferencia}: ${vendas_processadas}/${total_vendas} vendas processadas (último mês: ${ultimo_mes})`);

      // Se todas as vendas do ano foram processadas, gerar vendas do próximo ano
      if (vendas_processadas >= total_vendas) {
        console.log(`🎯 [DEZEMBRO] Todas as vendas do ano ${anoReferencia} foram processadas! Gerando vendas para ${anoReferencia + 1}...`);
        
        // Verificar se já não existem vendas para o próximo ano
        const [vendasProximoAno] = await pool.query(`
          SELECT COUNT(*) as count FROM vendas 
          WHERE contrato_origem_id = ? AND ano_referencia = ?
        `, [contratoId, anoReferencia + 1]);

        if (vendasProximoAno[0].count === 0) {
          await this.gerarVendasProximoAno(contratoId);
          console.log(`✅ [DEZEMBRO] Vendas do ano ${anoReferencia + 1} geradas automaticamente para contrato ${contratoId}`);
        } else {
          console.log(`ℹ️ [DEZEMBRO] Vendas do ano ${anoReferencia + 1} já existem para contrato ${contratoId}`);
        }
      } else {
        console.log(`⏳ [DEZEMBRO] Ainda restam ${total_vendas - vendas_processadas} vendas para processar no ano ${anoReferencia}`);
      }

    } catch (error) {
      console.error(`❌ Erro ao verificar renovação após venda do contrato ${contratoId}:`, error);
    }
  }

  // 🔍 NOVA FUNÇÃO: Verificar se precisa gerar vendas para próximo ano (APENAS EM DEZEMBRO)
  async verificarRenovacaoAnual() {
    try {
      const mesAtual = new Date().getMonth() + 1; // Janeiro = 1, Dezembro = 12
      
      // Só funciona em dezembro
      if (mesAtual !== 12) {
        console.log(`⏳ Renovação automática só funciona em dezembro. Mês atual: ${mesAtual}`);
        return;
      }

      console.log("🔍 [DEZEMBRO] Verificando contratos que precisam de renovação anual...");
      
      // Buscar contratos que chegaram na última venda do ano
      const [contratosParaRenovar] = await pool.query(`
        SELECT DISTINCT
          c.id as contrato_id,
          c.*,
          COUNT(v.id) as vendas_total,
          COUNT(CASE WHEN v.situacao = 'processado' THEN 1 END) as vendas_processadas,
          MAX(v.vencimento) as ultima_venda_data,
          MAX(v.ano_referencia) as ultimo_ano,
          MAX(v.mes_referencia) as ultimo_mes
        FROM contratos c
        INNER JOIN vendas v ON v.contrato_origem_id = c.id
        INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
        WHERE c.status = 'ativo'
          AND rvc.tipo_origem = 'contrato'
          AND rvc.indeterminado = 1
          AND rvc.status = 'ativo'
          AND v.ano_referencia = YEAR(CURDATE())
        GROUP BY c.id
        HAVING vendas_processadas >= (vendas_total - 1)
          AND ultimo_ano = YEAR(CURDATE())
          AND ultimo_mes >= 11  -- Dezembro (mês 12) ou Novembro (mês 11)
          AND NOT EXISTS (
            SELECT 1 FROM vendas v2 
            WHERE v2.contrato_origem_id = c.id 
            AND v2.ano_referencia = YEAR(CURDATE()) + 1
          )
      `);

      console.log(`📊 [DEZEMBRO] Contratos que precisam de renovação: ${contratosParaRenovar.length}`);

      // Para cada contrato, gerar vendas do próximo ano
      for (const contrato of contratosParaRenovar) {
        try {
          console.log(`🔄 [DEZEMBRO] Gerando vendas para próximo ano - Contrato ${contrato.contrato_id}...`);
          await this.gerarVendasProximoAno(contrato.contrato_id);
          console.log(`✅ [DEZEMBRO] Vendas do próximo ano geradas para contrato ${contrato.contrato_id}`);
        } catch (error) {
          console.error(`❌ Erro ao gerar vendas do próximo ano para contrato ${contrato.contrato_id}:`, error);
        }
      }

    } catch (error) {
      console.error("❌ Erro ao verificar renovação anual:", error);
    }
  }

  // 🔄 NOVA FUNÇÃO: Gerar vendas para o próximo ano
  async gerarVendasProximoAno(contratoId) {
    try {
      const proximoAno = new Date().getFullYear() + 1;
      console.log(`📅 Gerando vendas para ${proximoAno} - Contrato ${contratoId}`);

      // Buscar dados do contrato
      const [contratos] = await pool.query(`
        SELECT c.*, rvc.tipo_intervalo, rvc.intervalo
        FROM contratos c
        INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
        WHERE c.id = ? AND rvc.tipo_origem = 'contrato'
      `, [contratoId]);

      if (contratos.length === 0) {
        throw new Error(`Contrato ${contratoId} não encontrado`);
      }

      const contrato = contratos[0];

      // Buscar a última venda para calcular a data base do próximo ano
      const [ultimaVenda] = await pool.query(`
        SELECT * FROM vendas 
        WHERE contrato_origem_id = ? 
        ORDER BY vencimento DESC 
        LIMIT 1
      `, [contratoId]);

      let dataBase;
      if (ultimaVenda.length > 0) {
        // Próxima data seria um mês após a última venda
        dataBase = calcularProximoVencimento(new Date(ultimaVenda[0].vencimento), 1, 'meses');
      } else {
        // Se não tem vendas, usar janeiro do próximo ano
        dataBase = new Date(proximoAno, 0, 1); // 1º de janeiro
      }

      // Garantir que seja do próximo ano
      dataBase.setFullYear(proximoAno);

      // Gerar 12 vendas para o próximo ano
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        for (let mes = 0; mes < 12; mes++) {
          let dataVencimento = new Date(dataBase);
          
          if (contrato.tipo_intervalo === 'meses') {
            dataVencimento = calcularProximoVencimento(dataBase, mes, 'meses');
          } else if (contrato.tipo_intervalo === 'dias') {
            dataVencimento = calcularProximoVencimento(dataBase, mes * (contrato.intervalo || 30), 'dias');
          } else if (contrato.tipo_intervalo === 'semanas') {
            dataVencimento = calcularProximoVencimento(dataBase, mes * (contrato.intervalo || 4), 'semanas');
          } else {
            // Padrão: mensal
            dataVencimento = calcularProximoVencimento(dataBase, mes, 'meses');
          }

          // Garantir que seja do ano correto
          dataVencimento.setFullYear(proximoAno);

          // Criar venda para este período
          const [vendaResult] = await connection.query(`
            INSERT INTO vendas (
              cliente_id, 
              company_id, 
              valor_venda, 
              vencimento, 
              situacao, 
              tipo_venda,
              observacoes,
              contrato_origem_id,
              mes_referencia,
              ano_referencia,
              categoria_id,
              sub_categoria_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            contrato.cliente_id,
            contrato.company_id,
            contrato.valor,
            dataVencimento.toISOString().split('T')[0],
            'pendente',
            'recorrente',
            `Contrato ${contratoId} - ${mes + 1}º período de ${proximoAno} (Auto-renovado)`,
            contratoId,
            mes + 1,
            proximoAno,
            contrato.categoria_id,
            contrato.sub_categoria_id
          ]);

          // Criar recorrência específica para esta venda
          await connection.query(`
            INSERT INTO recorrencia_vendas_contratos (
              venda_id, 
              tipo_origem, 
              indeterminado, 
              status,
              tipo_intervalo,
              intervalo
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            vendaResult.insertId,
            'venda',
            0,
            'ativo',
            contrato.tipo_intervalo,
            contrato.intervalo
          ]);
        }

        await connection.commit();
        console.log(`✅ 12 vendas geradas para ${proximoAno} - Contrato ${contratoId}`);

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error(`❌ Erro ao gerar vendas do próximo ano:`, error);
      throw error;
    }
  }

  // 💳 NOVA FUNÇÃO: Gerar boleto específico para venda
  async gerarBoletoParaVenda(venda) {
    try {
      // Reutilizar a lógica existente, mas adaptada para venda
      const vendaFormatada = {
        ...venda,
        contrato_id: null, // É uma venda, não contrato
        venda_id: venda.id,
        tipo: 'venda',
        tipo_origem: 'venda'
      };

      return await this.gerarBoleto(vendaFormatada, venda.proximo_vencimento);
    } catch (error) {
      console.error("❌ Erro ao gerar boleto para venda:", error);
      throw error;
    }
  }

  // 🎯 Processar um item específico (contrato ou venda)
  async processarItem(item) {
    try {
      const tipoItem = item.tipo || item.tipo_origem;
      const itemId = item.contrato_id || item.venda_id || item.id;
      
      console.log(`🎯 Processando ${tipoItem} ${itemId} - ${item.cliente_nome}`);
      console.log(`📋 Dados do ${tipoItem}:`, JSON.stringify(item, null, 2));
      
      // Calcular datas
      let dataVencimentoBoleto;
      let proximoVencimento;

      if (item.proximo_vencimento) {
        dataVencimentoBoleto = item.proximo_vencimento;
        proximoVencimento = this.calcularProximoVencimento(item);
      } else {
        proximoVencimento = this.calcularProximoVencimento(item);
        dataVencimentoBoleto = proximoVencimento;
      }

      console.log(`📅 Próximo vencimento atual: ${item.proximo_vencimento}`);
      console.log(`📅 Data vencimento boleto: ${dataVencimentoBoleto}`);
      console.log(`📅 Próximo vencimento calculado: ${proximoVencimento}`);

      // Gerar boleto
      const boleto = await this.gerarBoleto(item, dataVencimentoBoleto);
      console.log(`✅ Boleto gerado: ${boleto.codigoSolicitacao}`);

      // Enviar por email
      await this.enviarBoletoPorEmail(item, boleto, dataVencimentoBoleto);
      console.log(`📧 Email enviado com sucesso`);

      // Atualizar próximo vencimento baseado no tipo
      if (tipoItem === 'contrato') {
        await this.atualizarProximoVencimento(itemId, proximoVencimento);
      } else if (tipoItem === 'venda') {
        await this.atualizarProximoVencimentoVenda(itemId, proximoVencimento);
        // Manter a situação como 'aprovado' se já estiver assim
        const situacaoAtual = item.status;
        if (situacaoAtual === 'aprovado') {
          await pool.query(
            "UPDATE vendas SET situacao = 'aprovado' WHERE id = ?",
            [itemId]
          );
        }
      }
      console.log(`📅 Próximo vencimento atualizado: ${proximoVencimento}`);

      return boleto;
    } catch (error) {
      const itemId = item.contrato_id || item.venda_id || item.id;
      console.error(`❌ Erro ao processar ${item.tipo || item.tipo_origem} ${itemId}:`, error);
      
      // Email de erro desabilitado para evitar lotar SMTP
      // await this.enviarEmailErro(item, error);
      console.log(`⚠️ Email de erro não enviado para evitar lotar SMTP`);
      
      throw error;
    }
  }

  // 📅 Calcular próximo vencimento
  calcularProximoVencimento(contrato) {
    let proximoVencimento;

    if (contrato.proximo_vencimento) {
      if (contrato.proximo_vencimento instanceof Date) {
        proximoVencimento = contrato.proximo_vencimento;
      } else {
        const dataString = String(contrato.proximo_vencimento);
        proximoVencimento = parseISO(dataString);
      }
    } else if (contrato.dia_gerado) {
      if (contrato.dia_gerado instanceof Date) {
        proximoVencimento = contrato.dia_gerado;
      } else {
        const dataString = String(contrato.dia_gerado);
        proximoVencimento = parseISO(dataString);
      }
    } else {
      proximoVencimento = new Date();
    }

    // Calcular próximo vencimento baseado no tipo de intervalo
    switch (contrato.tipo_intervalo) {
      case 'dias':
        proximoVencimento = calcularProximoVencimento(proximoVencimento, contrato.intervalo || 30, 'dias');
        break;
      case 'semanas':
        proximoVencimento = calcularProximoVencimento(proximoVencimento, contrato.intervalo || 4, 'semanas');
        break;
      default:
        proximoVencimento = calcularProximoVencimento(proximoVencimento, 1, 'meses');
    }

    // Garantir que a data seja uma string válida
    if (proximoVencimento instanceof Date) {
      return format(proximoVencimento, 'yyyy-MM-dd');
    } else {
      // Se já for string, retornar como está
      return String(proximoVencimento);
    }
  }

  // 🔑 Gerar token do Inter automaticamente
  async gerarTokenInter() {
    try {
      console.log("🔄 Gerando novo token do Inter...");
      
      const scope = "boleto-cobranca.read boleto-cobranca.write";
      const client_id = process.env.INTER_CLIENT_ID;
      const client_secret = process.env.INTER_CLIENT_SECRET;

      if (!client_id || !client_secret) {
        throw new Error("Credenciais do Inter não configuradas (INTER_CLIENT_ID, INTER_CLIENT_SECRET)");
      }

      const cert = Buffer.from(process.env.INTER_CERT_B64, 'base64').toString('utf-8');
      const key = Buffer.from(process.env.INTER_KEY_B64, 'base64').toString('utf-8');
      const agent = new (require('https').Agent)({ cert, key });

      const params = new URLSearchParams();
      params.append("client_id", client_id);
      params.append("client_secret", client_secret);
      params.append("grant_type", "client_credentials");
      params.append("scope", scope);

      const response = await axios.post(
        "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
        params,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          httpsAgent: agent,
        }
      );

      const { access_token, expires_in, token_type, scope: token_scope } = response.data;

      // Salva no banco
      await pool.query(
        `INSERT INTO inter_tokens (access_token, expires_in, token_type, scope) VALUES (?, ?, ?, ?)`,
        [access_token, expires_in, token_type, token_scope]
      );

      console.log("✅ Token do Inter gerado com sucesso!");
      return access_token;
    } catch (error) {
      console.error("❌ Erro ao gerar token do Inter:", error.response?.data || error.message);
      throw error;
    }
  }

  // 🔑 Obter token do Inter (com regeneração automática)
  async obterTokenInter() {
    try {
      // Buscar token mais recente
      const [[tokenRow]] = await pool.query(
        "SELECT access_token, created_at FROM inter_tokens ORDER BY created_at DESC LIMIT 1"
      );
      
      if (tokenRow?.access_token) {
        // Verificar se o token não é muito antigo (mais de 1 hora)
        const tokenAge = Date.now() - new Date(tokenRow.created_at).getTime();
        const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos
        
        if (tokenAge < oneHour) {
          return tokenRow.access_token;
        }
      }
      
      // Se não tem token ou é muito antigo, gerar novo
      return await this.gerarTokenInter();
    } catch (error) {
      console.error("❌ Erro ao obter token do Inter:", error);
      throw error;
    }
  }

  // 🔑 Gerar token do Inter usando credenciais específicas de uma conta
  async gerarTokenInterComCredenciais(contaInter) {
    try {
      console.log(`🔑 Gerando token para conta Inter: ${contaInter.apelido || contaInter.conta_corrente}`);
      
      // Validar se a conta tem os campos necessários
      if (!contaInter.client_id || !contaInter.client_secret || !contaInter.cert_b64 || !contaInter.key_b64) {
        throw new Error('Conta Inter não possui credenciais válidas (client_id, client_secret, cert_b64, key_b64).');
      }

      // Configurar agente HTTPS
      const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
      const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
      const agent = new (require('https').Agent)({ cert, key });

      // URL base baseada no ambiente
      const baseUrl = contaInter.ambiente === 'hml' 
        ? 'https://cdp.partners.bancointer.com.br' 
        : 'https://cdpj.partners.bancointer.com.br';

      const scope = "boleto-cobranca.read boleto-cobranca.write";
      const params = new URLSearchParams();
      params.append("client_id", contaInter.client_id);
      params.append("client_secret", contaInter.client_secret);
      params.append("grant_type", "client_credentials");
      params.append("scope", scope);

      const response = await axios.post(
        `${baseUrl}/oauth/v2/token`,
        params,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          httpsAgent: agent
        }
      );

      const { access_token, expires_in, token_type } = response.data;

      // Salvar token no cache com inter_account_id
      await pool.query(
        `INSERT INTO inter_tokens_validate_cache 
         (inter_account_id, access_token, token_type, scope, expires_in)
         VALUES (?, ?, ?, ?, ?)`,
        [contaInter.id, access_token, token_type || 'Bearer', scope, expires_in]
      );

      console.log("✅ Token gerado e salvo no cache");
      return access_token;
    } catch (error) {
      console.error("❌ Erro ao gerar token com credenciais específicas:", error);
      throw error;
    }
  }

  // 💳 Gerar boleto via API do Inter
  async gerarBoleto(contrato, dataVencimento) {
    try {
      // Buscar conta Inter configurada para a empresa
      let companyId = contrato.company_id;
      
      // Se não tem company_id, buscar baseado no tipo do item
      if (!companyId) {
        const tipoItem = contrato.tipo || contrato.tipo_origem;
        const itemId = contrato.contrato_id || contrato.venda_id || contrato.id;
        
        if (tipoItem === 'contrato') {
          const [[contratoRow]] = await pool.query(
            'SELECT company_id FROM contratos WHERE id = ?',
            [itemId]
          );
          companyId = contratoRow?.company_id;
        } else if (tipoItem === 'venda') {
          const [[vendaRow]] = await pool.query(
            'SELECT company_id FROM vendas WHERE id = ?',
            [itemId]
          );
          companyId = vendaRow?.company_id;
        }
      }
      
      // Se ainda não tem company_id, usar padrão
      if (!companyId) {
        companyId = 1;
        console.log("⚠️ Company ID não encontrado, usando padrão: 1");
      }
      
      // Primeiro tentar buscar na tabela inter_accounts
      let [[contaInter]] = await pool.query(
        `SELECT * FROM inter_accounts 
         WHERE company_id = ? AND status = 'ativo' 
         ORDER BY is_default DESC, id ASC 
         LIMIT 1`,
        [companyId]
      );

      // Se não encontrou, buscar na tabela contas_api
      if (!contaInter) {
        [[contaInter]] = await pool.query(
          `SELECT 
             id,
             company_id,
             inter_apelido as apelido,
             inter_conta_corrente as conta_corrente,
             inter_client_id as client_id,
             inter_client_secret as client_secret,
             inter_cert_b64 as cert_b64,
             inter_key_b64 as key_b64,
             inter_is_default as is_default,
             inter_status as status
           FROM contas_api 
           WHERE company_id = ? AND inter_ativado = TRUE AND inter_status = 'ativo'
           ORDER BY inter_is_default DESC, id ASC 
           LIMIT 1`,
          [companyId]
        );
        
        // Normalizar a conta corrente após buscar do banco
        if (contaInter && contaInter.conta_corrente) {
          contaInter.conta_corrente = normalizarContaCorrente(contaInter.conta_corrente);
        }
      }

      if (!contaInter) {
        throw new Error(`Nenhuma conta Inter configurada para a empresa ${companyId}. Configure uma conta em /contas-api ou /inter-accounts.`);
      }

      console.log(`🏦 Usando conta Inter: ${contaInter.apelido || contaInter.conta_corrente}`);

      // Gerar token usando as credenciais da conta
      const access_token = await this.gerarTokenInterComCredenciais(contaInter);

      // Configurar agente HTTPS com as credenciais da conta
      const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
      const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
      const agent = new (require('https').Agent)({ cert, key });

      // Usar conta corrente da conta configurada (normalizada)
      const contaCorrente = normalizarContaCorrente(contaInter.conta_corrente);

      // Gerar seuNumero único
      const seuNumero = `CONTRATO_${contrato.contrato_id}_${Date.now()}`.slice(0, 15);

      const boletoData = {
        seuNumero: seuNumero,
        valorNominal: contrato.valor,
        dataVencimento: dataVencimento,
        numDiasAgenda: 60,
        pagador: {
          nome: contrato.cliente_nome,
          cpfCnpj: contrato.cliente_cpf_cnpj,
          email: contrato.cliente_email || this.EMAIL_ADMIN,
          tipoPessoa: detectarTipoPessoa(contrato.cliente_cpf_cnpj),
          endereco: contrato.cliente_endereco || 'Endereço não informado',
          numero: contrato.cliente_numero || 'S/N',
          complemento: contrato.cliente_complemento || '',
          bairro: contrato.cliente_bairro || 'Centro',
          cidade: contrato.cliente_cidade || 'São Paulo',
          uf: contrato.cliente_estado || 'SP',
          cep: contrato.cliente_cep || '21070390'
        },
        formasRecebimento: ["BOLETO" , "PIX"],
        mensagem: {
          linha1: `Contrato ${contrato.contrato_id}`,
          linha2: `Vencimento: ${dataVencimento}`
        }
      };

      let response;
      try {
        response = await axios.post(
          "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas",
          boletoData,
          {
            headers: {
              "Authorization": `Bearer ${access_token}`,
              "x-conta-corrente": contaCorrente,
              "Content-Type": "application/json"
            },
            httpsAgent: agent,
          }
        );
      } catch (error) {
        // Se der erro 401, tentar regenerar o token e tentar novamente
        if (error.response?.status === 401) {
          console.log("🔄 Token expirado, regenerando...");
          const newToken = await this.gerarTokenInterComCredenciais(contaInter);
          
          response = await axios.post(
            "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas",
            boletoData,
            {
              headers: {
                "Authorization": `Bearer ${newToken}`,
                "x-conta-corrente": contaCorrente,
                "Content-Type": "application/json"
              },
              httpsAgent: agent,
            }
          );
        } else {
          throw error;
        }
      }

      // Salvar boleto no banco
      console.log("📄 Resposta do boleto:", JSON.stringify(response.data, null, 2));
      const { linkBoleto, codigoBarras, dataEmissao, status, codigoSolicitacao } = response.data;
      
      // Determinar se é contrato ou venda
      const tipoItem = contrato.tipo || contrato.tipo_origem;
      const itemId = contrato.contrato_id || contrato.venda_id || contrato.id;
      
      const [boletoResult] = await pool.query(
        `INSERT INTO boletos 
          (link_boleto, codigo_barras, data_emissao, data_vencimento, status, seu_numero, valor_nominal, 
           pagador_nome, pagador_cpf_cnpj, pagador_email, codigo_solicitacao, contrato_id, venda_id, inter_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          linkBoleto, codigoBarras, dataEmissao, dataVencimento, status, seuNumero, contrato.valor,
          contrato.cliente_nome, contrato.cliente_cpf_cnpj, contrato.cliente_email, codigoSolicitacao, 
          tipoItem === 'contrato' ? itemId : null,
          tipoItem === 'venda' ? itemId : null,
          contaInter.id // inter_account_id
        ]
      );

      return {
        ...response.data,
        id: boletoResult.insertId,
        contrato_id: tipoItem === 'contrato' ? itemId : null,
        venda_id: tipoItem === 'venda' ? itemId : null
      };

    } catch (error) {
      console.error("❌ Erro ao gerar boleto:", error.response?.data || error.message);
      throw error;
    }
  }

  // 📧 Enviar boleto por email
  async enviarBoletoPorEmail(contrato, boleto, dataVencimento) {
    try {
      console.log(`📧 Iniciando envio de email para venda ${contrato.id || contrato.venda_id}...`);
      console.log(`📧 Cliente: ${contrato.cliente_nome}`);
      console.log(`📧 Email do cliente: ${contrato.cliente_email || 'Não cadastrado'}`);
      
      // Buscar PDF do boleto
      console.log(`📄 Buscando PDF do boleto: ${boleto.codigoSolicitacao}`);
      const pdfBuffer = await this.buscarPDFBoleto(boleto.codigoSolicitacao);
      console.log(`📄 PDF obtido com sucesso (${pdfBuffer.length} bytes)`);
      
      const tipoItem = contrato.tipo || contrato.tipo_origem || 'venda';
      const itemId = contrato.contrato_id || contrato.venda_id || contrato.id;
      
      const subject = `Boleto - ${contrato.empresa_nome} - ${tipoItem.charAt(0).toUpperCase() + tipoItem.slice(1)} ${itemId}`;
      const htmlContent = `
        <h2>Novo Boleto Gerado</h2>
        <p><strong>Cliente:</strong> ${contrato.cliente_nome}</p>
        <p><strong>${tipoItem.charAt(0).toUpperCase() + tipoItem.slice(1)}:</strong> ${itemId}</p>
        <p><strong>Valor:</strong> R$ ${parseFloat(contrato.valor || contrato.valor_venda).toFixed(2)}</p>
        <p><strong>Vencimento:</strong> ${dataVencimento}</p>
        <p><strong>Empresa:</strong> ${contrato.empresa_nome}</p>
        <br>
        <p>O boleto está anexado a este email.</p>
        <p>Link direto: <a href="${boleto.linkBoleto || '#'}">${boleto.linkBoleto || 'Link não disponível'}</a></p>
      `;

      // Formatar data para nome do arquivo
      const dataVencimentoStr = dataVencimento instanceof Date ? dataVencimento.toISOString().split('T')[0] : String(dataVencimento);
      const dataFormatada = dataVencimentoStr.replace(/[^0-9-]/g, '').replace(/-/g, '');
      const filename = `boleto_${tipoItem}_${itemId}_${dataFormatada}.pdf`;

      // Enviar para o cliente (se tiver email) e para admin
      const emails = [this.EMAIL_ADMIN];
      if (contrato.cliente_email && contrato.cliente_email.trim() !== '') {
        // Sanitizar email: remover espaços e converter para minúsculas
        const emailSanitizado = contrato.cliente_email.toLowerCase().trim();
        emails.push(emailSanitizado);
        console.log(`📧 Email do cliente adicionado: ${emailSanitizado}`);
      } else {
        console.log(`⚠️ Cliente sem email cadastrado: ${contrato.cliente_nome}`);
      }

      console.log(`📧 Enviando emails para: ${emails.join(', ')}`);

      // Enviar emails diretamente (rate limiting desativado)
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        console.log(`📧 Enviando email para: ${email} (${i + 1}/${emails.length})`);
        await sendEmailWithPDF(email, subject, htmlContent, pdfBuffer, filename);
        console.log(`✅ Email enviado para: ${email}`);
      }

      console.log(`✅ Todos os emails enviados com sucesso: ${emails.join(', ')}`);
    } catch (error) {
      console.error("❌ Erro ao enviar email:", error);
      console.error("❌ Detalhes do erro:", error.message);
      console.error("❌ Stack trace:", error.stack);
      throw error;
    }
  }

  // 📄 Buscar PDF do boleto
  async buscarPDFBoleto(codigoSolicitacao) {
    try {
      console.log(`📄 Buscando PDF do boleto: ${codigoSolicitacao}`);
      
      // Validar se o código de solicitação é válido
      if (!codigoSolicitacao || typeof codigoSolicitacao !== 'string') {
        throw new Error(`Código de solicitação inválido: ${codigoSolicitacao}`);
      }
      
      // Buscar o boleto para obter o inter_account_id
      const [[boleto]] = await pool.query(
        'SELECT inter_account_id FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
        [codigoSolicitacao]
      );

      if (!boleto || !boleto.inter_account_id) {
        throw new Error('Boleto não encontrado ou sem inter_account_id configurado');
      }

      // Buscar a conta Inter
      let [[contaInter]] = await pool.query(
        'SELECT * FROM inter_accounts WHERE id = ? AND status = "ativo"',
        [boleto.inter_account_id]
      );

      // Se não encontrou na inter_accounts, buscar na contas_api
      if (!contaInter) {
        [[contaInter]] = await pool.query(
          `SELECT 
             id,
             inter_apelido as apelido,
             inter_conta_corrente as conta_corrente,
             inter_client_id as client_id,
             inter_client_secret as client_secret,
             inter_cert_b64 as cert_b64,
             inter_key_b64 as key_b64,
             inter_ambiente as ambiente
           FROM contas_api 
           WHERE id = ? AND inter_ativado = TRUE AND inter_status = 'ativo'`,
          [boleto.inter_account_id]
        );
        
        // Normalizar a conta corrente após buscar do banco
        if (contaInter && contaInter.conta_corrente) {
          contaInter.conta_corrente = normalizarContaCorrente(contaInter.conta_corrente);
        }
      }

      if (!contaInter) {
        throw new Error('Conta Inter não encontrada ou inativa');
      }

      console.log(`🏦 Conta Inter encontrada: ${contaInter.apelido || contaInter.conta_corrente}`);
      console.log(`🔑 Gerando token para busca do PDF...`);

      // Gerar token usando as credenciais da conta
      const access_token = await this.gerarTokenInterComCredenciais(contaInter);

      // Configurar agente HTTPS com as credenciais da conta
      const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
      const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
      const agent = new (require('https').Agent)({ cert, key });

             const contaCorrente = normalizarContaCorrente(contaInter.conta_corrente);
      console.log(`🏦 Conta corrente normalizada: ${contaCorrente}`);

      // Primeiro buscar o boleto para obter o PDF
      const url = `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}`;
      console.log(`📄 Fazendo requisição para: ${url}`);
      console.log(`📄 Headers: Authorization: Bearer ${access_token.substring(0, 10)}..., x-conta-corrente: ${contaCorrente}`);

      const boletoResponse = await axios.get(url, {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaCorrente
        },
        httpsAgent: agent
      });

      console.log(`📄 Boleto encontrado:`, JSON.stringify(boletoResponse.data, null, 2));

      // Se o boleto tem PDF em base64, usar ele
      if (boletoResponse.data.pdf) {
        const pdfBuffer = Buffer.from(boletoResponse.data.pdf, 'base64');
        console.log(`📄 PDF obtido do boleto! Tamanho: ${pdfBuffer.length} bytes`);
        return pdfBuffer;
      }

      // Se não tem PDF no boleto, tentar buscar o PDF separadamente
      const pdfResponse = await axios.get(
        `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
        {
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "x-conta-corrente": contaCorrente
          },
          httpsAgent: agent,
          responseType: 'arraybuffer'
        }
      );

      // Verificar se é realmente um PDF válido
      const pdfBuffer = Buffer.from(pdfResponse.data);
      console.log(`📄 PDF obtido separadamente! Tamanho: ${pdfBuffer.length} bytes`);
      
      // Verificar se começa com %PDF (assinatura de PDF válido)
      const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
      console.log(`📄 Header do PDF: ${pdfHeader}`);
      
      if (pdfHeader !== '%PDF') {
        console.warn(`⚠️ PDF pode estar corrompido. Header: ${pdfHeader}`);
        // Tentar decodificar como base64 se não for PDF válido
        try {
          const jsonResponse = JSON.parse(pdfBuffer.toString('utf-8'));
          if (jsonResponse.pdf) {
            const decodedPdf = Buffer.from(jsonResponse.pdf, 'base64');
            console.log(`📄 PDF decodificado de base64! Tamanho: ${decodedPdf.length} bytes`);
            return decodedPdf;
          }
        } catch (e) {
          console.warn(`⚠️ Não foi possível decodificar como JSON: ${e.message}`);
        }
      }
      
      return pdfBuffer;
    } catch (error) {
      console.error("❌ Erro ao buscar PDF do boleto:", error.response?.data || error.message);
      throw error;
    }
  }

  // 📅 Atualizar próximo vencimento do contrato
  async atualizarProximoVencimento(contratoId, proximoVencimento) {
    try {
      await pool.query(
        "UPDATE contratos SET proximo_vencimento = ? WHERE id = ?",
        [proximoVencimento, contratoId]
      );
      console.log(`✅ Próximo vencimento atualizado para contrato ${contratoId}: ${proximoVencimento}`);
    } catch (error) {
      console.error("❌ Erro ao atualizar próximo vencimento:", error);
      throw error;
    }
  }

  // 📅 Atualizar próximo vencimento da venda
  async atualizarProximoVencimentoVenda(vendaId, proximoVencimento) {
    try {
      await pool.query(
        "UPDATE vendas SET vencimento = ? WHERE id = ?",
        [proximoVencimento, vendaId]
      );
      console.log(`✅ Próximo vencimento atualizado para venda ${vendaId}: ${proximoVencimento}`);
    } catch (error) {
      console.error("❌ Erro ao atualizar próximo vencimento da venda:", error);
      throw error;
    }
  }

  // 📧 Enviar email de erro para admin
  async enviarEmailErro(contrato, error) {
    try {
      const subject = `❌ Erro na Automação - Contrato ${contrato.contrato_id}`;
      const htmlContent = `
        <h2>Erro na Automação de Recorrência</h2>
        <p><strong>Contrato:</strong> ${contrato.contrato_id}</p>
        <p><strong>Cliente:</strong> ${contrato.cliente_nome}</p>
        <p><strong>Empresa:</strong> ${contrato.empresa_nome}</p>
        <p><strong>Erro:</strong> ${error.message}</p>
        <p><strong>Stack:</strong> ${error.stack}</p>
        <br>
        <p>Verifique os logs do servidor para mais detalhes.</p>
      `;

      await sendEmail(this.EMAIL_ADMIN, subject, htmlContent);
      console.log(`📧 Email de erro enviado para admin`);
    } catch (emailError) {
      console.error("❌ Erro ao enviar email de erro:", emailError);
    }
  }

  // 🆕 FUNÇÃO SIMPLES: Apenas atualizar vendas existentes com boletos pagos
  async verificarBoletosPagosParaAtualizarVendas() {
    try {
      console.log("🔍 Verificando boletos pagos para atualizar vendas...");

      // Query SIMPLES: buscar boletos pagos com venda_id
      const [boletosPagos] = await pool.query(`
        SELECT 
          b.codigo_solicitacao,
          b.status,
          b.venda_id,
          v.situacao
        FROM boletos b
        INNER JOIN vendas v ON b.venda_id = v.id
        WHERE b.status IN ('RECEBIDO', 'PAGO', 'LIQUIDADO')
          AND v.situacao IN ('processado', 'aprovado')
      `);

      console.log(`📊 Boletos pagos encontrados: ${boletosPagos.length}`);

      if (boletosPagos.length === 0) {
        console.log("✅ Nenhuma venda precisa ser atualizada");
        return;
      }

      // ATUALIZAR vendas diretamente - SEM CRIAR NADA
      let atualizacoes = 0;
      for (const boleto of boletosPagos) {
        try {
          console.log(`🔄 Atualizando venda ${boleto.venda_id} para "recebido"...`);

          // UPDATE DIRETO na tabela vendas
          const [resultado] = await pool.query(`
            UPDATE vendas 
            SET situacao = 'pago',
                observacoes = CONCAT(COALESCE(observacoes, ''), '\n\n💳 Atualizado automaticamente para "pago" - Boleto: ', ?, ' - Status: ', ?),
                updated_at = NOW()
            WHERE id = ?
          `, [boleto.codigo_solicitacao, boleto.status, boleto.venda_id]);

          if (resultado.affectedRows > 0) {
            atualizacoes++;
            console.log(`✅ Venda ${boleto.venda_id} → "pago"`);
          }

        } catch (error) {
          console.error(`❌ Erro ao atualizar venda ${boleto.venda_id}:`, error.message);
        }
      }

      console.log(`🎯 ${atualizacoes} vendas atualizadas para "pago"`);

    } catch (error) {
      console.error("❌ Erro ao verificar boletos pagos:", error.message);
    }
  }

}

module.exports = new AutomacaoRecorrencia(); 