const express = require("express");
const db = require("../../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const verifyToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");
const {
  obterEscritorio,
  cadastrarEscritorio,
  atualizarEscritorio,
} = require("../../controllers/gestao/escritorioController");

// Nova rota: listar todas as empresas (apenas para superadmin)
router.get("/todas", verifyToken, async (req, res) => {
  try {
    // Checa se o usuário é superadmin
    const permissoes = req.usuario?.permissoes || {};
    if (!permissoes.adm || !permissoes.adm.includes("superadmin")) {
      return res.status(403).json({ error: "Acesso restrito ao superadmin." });
    }
    const [empresas] = await db.query("SELECT id, razaoSocial, cnpj FROM empresas");
    res.json(empresas);
  } catch (error) {
    console.error("❌ Erro ao buscar todas as empresas:", error);
    res.status(500).json({ error: "Erro ao buscar empresas." });
  }
});

// ✅ Nova rota: Cadastrar obrigações padrões para empresa existente
router.post("/obrigacoes-padrao", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.body;
    const force = (req.query?.force === 'true') || (req.body && req.body.force === true);
    const { usuario } = req;

    // Verificar se o usuário é superadmin ou tem permissão para a empresa
    const permissoes = usuario?.permissoes || {};
    const isSuperadmin = permissoes.adm && permissoes.adm.includes("superadmin");
    
    if (!isSuperadmin && usuario.empresaId !== parseInt(empresaId)) {
      return res.status(403).json({ error: "Acesso negado a esta empresa." });
    }

    if (!empresaId) {
      return res.status(400).json({ error: "ID da empresa é obrigatório." });
    }

    // Verificar se a empresa existe
    const [empresa] = await db.query("SELECT id, razaoSocial FROM empresas WHERE id = ?", [empresaId]);
    if (empresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    // Verificar se já existem obrigações para esta empresa
    const [obrigacoesExistentes] = await db.query(
      "SELECT COUNT(*) as total FROM obrigacoes WHERE empresa_id = ?",
      [empresaId]
    );

    if (obrigacoesExistentes[0].total > 0 && !force) {
      return res.status(400).json({ 
        error: "Esta empresa já possui obrigações cadastradas.",
        message: "Para evitar duplicação, não é possível cadastrar obrigações padrões em empresas que já possuem obrigações. Envie force=true para forçar a criação.",
      });
    }

    // Buscar departamentos da empresa
    const [departamentos] = await db.query(
      "SELECT id, nome FROM departamentos WHERE empresa_id = ? ORDER BY nome",
      [empresaId]
    );

    if (departamentos.length === 0) {
      return res.status(400).json({ 
        error: "Empresa não possui departamentos cadastrados.",
        message: "É necessário cadastrar departamentos antes de criar obrigações padrões."
      });
    }

    // Lista de obrigações padrões para empresas (usando nomes corretos das colunas)
    const obrigacoesPadrao = [
      // OBRIGAÇÕES CONTÁBEIS
      {
        nome: "Balancete Simples Nacional",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        aliasValidacao: null,
        geraMulta: 0,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Balancete Lucro Presumido",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        aliasValidacao: null,
        geraMulta: 0,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Balancete Lucro Real",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        aliasValidacao: null,
        geraMulta: 0,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Movimento Contábil",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 5,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        aliasValidacao: null,
        geraMulta: 0,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "ECF (Escrituração Contábil Fiscal)",
        frequencia: "Anual",
        diaSemana: null,
        acaoQtdDias: 15,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 7,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Contábil",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      
      // OBRIGAÇÕES FISCAIS
      {
        nome: "DAS - MEI",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "EFD Contribuições",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 10,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "PIS e COFINS",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 25,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "IRPJ e CSLL Trimestral",
        frequencia: "Trimestral",
        diaSemana: null,
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "IRPJ Mensal",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "CSLL MENSAL",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      
      // OBRIGAÇÕES TRABALHISTAS
      {
        nome: "DCTF Web",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Folha de Pagamento - 1º Dia Útil",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 5,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "FGTS",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "INSS",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "DCTF Web - Pró-labore",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      
      // OBRIGAÇÕES FEDERAIS EXISTENTES (mantidas)
      {
        nome: "Declaração de Débitos e Créditos Tributários Federais (DCTF)",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 15,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 15,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 15,
        fatoGerador: "Mês anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Declaração de Informações Socioeconômicas e Fiscais (DEFIS)",
        frequencia: "Anual",
        diaSemana: null,
        acaoQtdDias: 30,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 30,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 30,
        fatoGerador: "Ano anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Declaração de Informações Econômico-Fiscais da Pessoa Jurídica (DIPJ)",
        frequencia: "Anual",
        diaSemana: null,
        acaoQtdDias: 30,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 30,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 30,
        fatoGerador: "Ano anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Declaração de Retenções e Outras Informações Fiscais (DIRF)",
        frequencia: "Anual",
        diaSemana: null,
        acaoQtdDias: 28,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 28,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 28,
        fatoGerador: "Mês anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Declaração de Informações sobre Atividades Imobiliárias (DIMOB)",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 20,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 20,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Guia Nacional de Recolhimento de Tributos Estaduais (GNRE)",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 20,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 20,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Sefaz",
        aliasValidacao: null,
        geraMulta: 0,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Relatório de Atividades Suspeitas (RAS)",
        frequencia: "Mensal",
        diaSemana: null,
        acaoQtdDias: 20,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 20,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "COAF",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      },
      {
        nome: "Declaração de Benefícios Fiscais (DBF)",
        frequencia: "Anual",
        diaSemana: null,
        acaoQtdDias: 30,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 30,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 30,
        fatoGerador: "Ano anterior",
        orgao: "Receita Federal",
        aliasValidacao: null,
        geraMulta: 1,
        usarRelatorio: 0,
        reenviarEmail: 0
      }
    ];

    // Mapear obrigações para departamentos baseado em palavras-chave baseado no orgao da obrigação
    const obrigacoesComDepartamento = obrigacoesPadrao.map(obrigacao => {
      let departamentoId = null;
      
      // Tentar encontrar departamento por palavras-chave baseado no orgao da obrigação
      for (const dept of departamentos) {
        const deptNome = dept.nome.toLowerCase();
        const orgaoObrigacao = obrigacao.orgao.toLowerCase();
        
        // Mapeamento baseado no orgao da obrigação
        if (orgaoObrigacao === "contábil" && (deptNome.includes('contábil') || deptNome.includes('contabilidade'))) {
          departamentoId = dept.id;
          break;
        } else if (orgaoObrigacao === "federal" && (deptNome.includes('fiscal') || deptNome.includes('tributário') || deptNome.includes('federal'))) {
          departamentoId = dept.id;
          break;
        } else if (orgaoObrigacao === "trabalhista" && (deptNome.includes('pessoal') || deptNome.includes('trabalhista') || deptNome.includes('rh') || deptNome.includes('recursos humanos'))) {
          departamentoId = dept.id;
          break;
        } else if (orgaoObrigacao === "receita federal" && (deptNome.includes('fiscal') || deptNome.includes('tributário') || deptNome.includes('federal'))) {
          departamentoId = dept.id;
          break;
        } else if (orgaoObrigacao === "sefaz" && (deptNome.includes('fiscal') || deptNome.includes('tributário') || deptNome.includes('estadual'))) {
          departamentoId = dept.id;
          break;
        } else if (orgaoObrigacao === "coaf" && (deptNome.includes('fiscal') || deptNome.includes('tributário') || deptNome.includes('federal'))) {
          departamentoId = dept.id;
          break;
        }
      }
      
      // Se não encontrou por palavras-chave, usar o primeiro departamento
      if (!departamentoId && departamentos.length > 0) {
        departamentoId = departamentos[0].id;
      }
      
      return {
        ...obrigacao,
        departamentoId
      };
    });

    // Inserir obrigações padrões usando os nomes corretos das colunas
    const valoresObrigacoes = obrigacoesComDepartamento.map(obrigacao => [
      empresaId,
      obrigacao.departamentoId,
      obrigacao.nome,
      obrigacao.frequencia,
      obrigacao.diaSemana,
      obrigacao.acaoQtdDias,
      obrigacao.acaoTipoDias,
      obrigacao.metaQtdDias,
      obrigacao.metaTipoDias,
      obrigacao.vencimentoTipo,
      obrigacao.vencimentoDia,
      obrigacao.fatoGerador,
      obrigacao.orgao,
      obrigacao.aliasValidacao,
      obrigacao.geraMulta,
      obrigacao.usarRelatorio,
      obrigacao.reenviarEmail,
      new Date() // data_criacao
    ]);

    await db.query(`
      INSERT INTO obrigacoes (
        empresa_id, departamento_id, nome, frequencia, dia_semana, acao_qtd_dias, acao_tipo_dias,
        meta_qtd_dias, meta_tipo_dias, vencimento_tipo, vencimento_dia, fato_gerador,
        orgao, alias_validacao, gera_multa, usar_relatorio, reenviar_email, data_criacao
      ) VALUES ?
    `, [valoresObrigacoes]);

    console.log(`✅ Obrigações padrões cadastradas para empresa ${empresa[0].razaoSocial} (ID: ${empresaId})`);

    res.status(201).json({
      message: "Obrigações padrões cadastradas com sucesso!",
      empresa: {
        id: empresa[0].id,
        razaoSocial: empresa[0].razaoSocial
      },
      departamentos: departamentos.map(d => ({ id: d.id, nome: d.nome })),
      obrigacoesCadastradas: obrigacoesComDepartamento.length,
      obrigacoes: obrigacoesComDepartamento.map(o => ({
        codigo: o.codigo,
        nome: o.nome,
        frequencia: o.frequencia,
        orgao: o.orgao,
        departamento: departamentos.find(d => d.id === o.departamentoId)?.nome || 'Não mapeado',
        geraMulta: o.geraMulta ? "Sim" : "Não"
      }))
    });

  } catch (error) {
    console.error("❌ Erro ao cadastrar obrigações padrões:", error);
    res.status(500).json({ 
      error: "Erro ao cadastrar obrigações padrões.",
      details: error.message 
    });
  }
});

// ✅ Rotas protegidas por autenticação
router.get("/", verifyToken, obterEscritorio);
router.post("/", verifyToken, verificarPermissao("certificados.criar"), cadastrarEscritorio);
router.put("/", verifyToken, verificarPermissao("certificados.substituir"), atualizarEscritorio);

// ✅ Rota para salvar credenciais do Onvio
router.put("/onvio", verifyToken, async (req, res) => {
  try {
    const { empresaId, onvioLogin, onvioSenha, onvioCodigoAutenticacao } = req.body;
    const { usuario } = req;

    if (!empresaId || !onvioLogin || !onvioSenha || !onvioCodigoAutenticacao) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    // Verificar se o usuário tem acesso à empresa
    if (usuario.empresaId !== parseInt(empresaId)) {
      return res.status(403).json({ error: "Acesso negado a esta empresa." });
    }

    // Atualizar credenciais do Onvio na tabela empresas
    await db.query(
      `UPDATE empresas 
       SET onvioLogin = ?, onvioSenha = ?, onvioCodigoAutenticacao = ? 
       WHERE id = ?`,
      [onvioLogin, onvioSenha, onvioCodigoAutenticacao, empresaId]
    );

    res.json({ message: "Credenciais do Onvio salvas com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao salvar credenciais do Onvio:", error);
    res.status(500).json({ error: "Erro ao salvar credenciais do Onvio." });
  }
});

// ✅ Rota para salvar API Key do EPlugin
router.put("/eplugin", verifyToken, async (req, res) => {
  try {
    const { empresaId, apiKeyEplugin } = req.body;
    const { usuario } = req;

    if (!empresaId || !apiKeyEplugin) {
      return res.status(400).json({ error: "Empresa ID e API Key são obrigatórios." });
    }

    // Verificar se o usuário tem acesso à empresa
    if (usuario.empresaId !== parseInt(empresaId)) {
      return res.status(403).json({ error: "Acesso negado a esta empresa." });
    }

    // Atualizar API Key do EPlugin na tabela empresas
    await db.query(
      `UPDATE empresas 
       SET apiKey_ePlugin = ? 
       WHERE id = ?`,
      [apiKeyEplugin, empresaId]
    );

    res.json({ message: "API Key do EPlugin salva com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao salvar API Key do EPlugin:", error);
    res.status(500).json({ error: "Erro ao salvar API Key do EPlugin." });
  }
});

// ✅ Rota para verificar se a empresa tem API Key do EPlugin
router.get("/eplugin", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.usuario;

    if (!empresaId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    // Buscar se a empresa tem API Key do EPlugin
    const [empresa] = await db.query(
      `SELECT apiKey_ePlugin AS apiKeyEplugin FROM empresas WHERE id = ?`,
      [empresaId]
    );

    if (empresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    const temApiKey = !!empresa[0].apiKeyEplugin;
    const apiKey = empresa[0].apiKeyEplugin;

    res.json({ 
      temApiKey,
      apiKey: temApiKey ? apiKey : null,
      message: temApiKey ? "API Key encontrada" : "API Key não configurada"
    });
  } catch (error) {
    console.error("❌ Erro ao verificar API Key do EPlugin:", error);
    res.status(500).json({ error: "Erro ao verificar API Key do EPlugin." });
  }
});

const upload = multer({ storage: multer.memoryStorage() });


router.get("/certificados-clientes/:clienteId", verifyToken, async (req, res) => {
  const { clienteId } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT id, nome_arquivo AS nomeArquivo, data_vencimento AS dataVencimento, criado_em AS criadoEm FROM certificados_clientes WHERE cliente_id = ?",
      [clienteId]
    );
    res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar certificados:", error);
    res.status(500).json({ error: "Erro ao buscar certificados." });
  }
});

/**
 * ✅ POST: Cadastrar novo certificado para cliente
 */
router.post("/certificados-clientes", verifyToken, verificarPermissao("certificados.criar"), upload.single("pfxCertificado"), async (req, res) => {
  try {
    const { clienteId, dataVencimento } = req.body;
    
    // Obter empresaId do header X-Empresa-Id ou do req.usuario
    const empresaIdFromHeader = req.header("X-Empresa-Id");
    const empresaId = empresaIdFromHeader ? parseInt(empresaIdFromHeader, 10) : (req.usuario?.empresaId || req.usuario?.EmpresaId || null);

    if (!empresaId) {
      return res.status(400).json({ error: "Empresa ID não encontrado. Envie X-Empresa-Id no header." });
    }

    if (!clienteId || !dataVencimento || !req.file) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    // Verificar se o usuário tem acesso à empresa
    const usuarioId = req.usuario?.id || req.usuario?.userId;
    if (usuarioId) {
      const [relacao] = await db.query(
        "SELECT 1 FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1",
        [usuarioId, empresaId]
      );
      if (relacao.length === 0) {
        return res.status(403).json({ error: "Usuário não possui acesso a esta empresa." });
      }
    }

    // Verificar se o cliente pertence à empresa
    // Tentar ambas as possíveis colunas: empresa_id (snake_case) ou empresaId (camelCase)
    let [cliente] = await db.query(
      "SELECT id FROM clientes WHERE id = ? AND empresa_id = ?",
      [clienteId, empresaId]
    );

    // Se não encontrou, tentar com empresaId (camelCase)
    if (cliente.length === 0) {
      [cliente] = await db.query(
        "SELECT id FROM clientes WHERE id = ? AND empresaId = ?",
        [clienteId, empresaId]
      );
    }

    if (cliente.length === 0) {
      // Debug: verificar se o cliente existe
      const [clienteExistente] = await db.query(
        "SELECT id, empresa_id, empresaId FROM clientes WHERE id = ? LIMIT 1",
        [clienteId]
      );
      console.log(`[DEBUG] Cliente ID ${clienteId} busca:`, clienteExistente);
      console.log(`[DEBUG] EmpresaId usado na busca: ${empresaId} (tipo: ${typeof empresaId})`);
      
      return res.status(400).json({ 
        error: "Cliente não encontrado ou não pertence à sua empresa.",
        debug: {
          clienteId,
          empresaId,
          clienteEncontrado: clienteExistente.length > 0,
          dadosCliente: clienteExistente[0] || null
        }
      });
    }

    const nomeArquivo = req.file.originalname;
    const pfxBuffer = req.file.buffer;

    await db.query(
      `INSERT INTO certificados_clientes (cliente_id, nome_arquivo, pfx, data_vencimento)
       VALUES (?, ?, ?, ?)`,
      [clienteId, nomeArquivo, pfxBuffer, dataVencimento]
    );

    res.status(201).json({ message: "Certificado cadastrado com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao cadastrar certificado:", error);
    res.status(500).json({ error: "Erro ao cadastrar certificado." });
  }
});

router.get("/certificados-clientes", verifyToken, async (req, res) => {
  // Obter empresaId do header X-Empresa-Id ou do req.usuario
  const empresaIdFromHeader = req.header("X-Empresa-Id");
  const empresaId = empresaIdFromHeader ? parseInt(empresaIdFromHeader, 10) : (req.usuario?.empresaId || req.usuario?.EmpresaId || null);
  const { ordenacao = "vencimento" } = req.query; // Padrão: ordenar por vencimento

  if (!empresaId) {
    return res.status(400).json({ error: "Empresa ID não encontrado. Envie X-Empresa-Id no header." });
  }

  try {
    let orderBy = "";
    switch (ordenacao) {
      case "cliente":
        orderBy = "ORDER BY c.razao_social ASC";
        break;
      case "vencimento":
        orderBy = "ORDER BY cc.data_vencimento ASC";
        break;
      case "vencimento_desc":
        orderBy = "ORDER BY cc.data_vencimento DESC";
        break;
      case "criacao":
        orderBy = "ORDER BY cc.criado_em DESC";
        break;
      case "arquivo":
        orderBy = "ORDER BY cc.nome_arquivo ASC";
        break;
      default:
        orderBy = "ORDER BY cc.data_vencimento ASC";
    }

    // Tentar buscar com empresa_id (snake_case) primeiro
    let [rows] = await db.query(`
      SELECT 
        cc.id,
        cc.nome_arquivo AS nomeArquivo,
        cc.data_vencimento AS dataVencimento,
        cc.criado_em AS criadoEm,
        c.razao_social AS cliente_nome,
        c.cpf_cnpj AS cliente_cnpj
      FROM certificados_clientes cc
      JOIN clientes c ON cc.cliente_id = c.id
      WHERE c.empresa_id = ?
      ${orderBy}
    `, [empresaId]);

    res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar certificados:", error);
    res.status(500).json({ error: "Erro ao buscar certificados." });
  }
});


/**
 * ✅ GET: Download de um certificado
 */
router.get("/certificados-clientes/:id/download", verifyToken, verificarPermissao("certificados.download"), async (req, res) => {
  const { id } = req.params;
  const { empresaId } = req.usuario;

  try {
    // Buscar certificado com validação de empresa
    const [rows] = await db.query(`
      SELECT cc.pfx, cc.nome_arquivo AS nomeArquivo
      FROM certificados_clientes cc
      JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ? AND c.empresa_id = ?
    `, [id, empresaId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Certificado não encontrado." });
    }

    const certificado = rows[0];
    
    // Configurar headers para download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${certificado.nomeArquivo}"`);
    
    // Enviar o arquivo
    res.send(certificado.pfx);
  } catch (error) {
    console.error("❌ Erro ao fazer download do certificado:", error);
    res.status(500).json({ error: "Erro ao fazer download do certificado." });
  }
});

/**
 * ✅ PUT: Substituir certificado de cliente
 */
router.put("/certificados-clientes/:id", verifyToken, verificarPermissao("certificados.substituir"), upload.single("pfxCertificado"), async (req, res) => {
  const { id } = req.params;
  const { dataVencimento } = req.body;
  const { empresaId } = req.usuario;

  try {
    // Verificar se certificado existe e pertence à empresa
    const [certificado] = await db.query(`
      SELECT cc.id
      FROM certificados_clientes cc
      JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ? AND c.empresa_id = ?
    `, [id, empresaId]);

    if (certificado.length === 0) {
      return res.status(404).json({ error: "Certificado não encontrado." });
    }

    if (!req.file || !dataVencimento) {
      return res.status(400).json({ error: "Arquivo e data de vencimento são obrigatórios." });
    }

    const nomeArquivo = req.file.originalname;
    const pfxBuffer = req.file.buffer;

    // Atualizar certificado
    await db.query(
      `UPDATE certificados_clientes 
       SET nome_arquivo = ?, pfx = ?, data_vencimento = ?
       WHERE id = ?`,
      [nomeArquivo, pfxBuffer, dataVencimento, id]
    );

    res.json({ message: "Certificado substituído com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao substituir certificado:", error);
    res.status(500).json({ error: "Erro ao substituir certificado." });
  }
});

/**
 * ✅ DELETE: Remove um certificado
 */
router.delete("/certificados-clientes/:id", verifyToken, verificarPermissao("certificados.excluir"), async (req, res) => {
  const { id } = req.params;
  const { empresaId } = req.usuario;

  try {
    // Verificar se certificado existe e pertence à empresa
    const [certificado] = await db.query(`
      SELECT cc.id
      FROM certificados_clientes cc
      JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ? AND c.empresa_id = ?
    `, [id, empresaId]);

    if (certificado.length === 0) {
      return res.status(404).json({ error: "Certificado não encontrado." });
    }

    await db.query("DELETE FROM certificados_clientes WHERE id = ?", [id]);
    res.json({ message: "Certificado removido com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao remover certificado:", error);
    res.status(500).json({ error: "Erro ao remover certificado." });
  }
});

// Novo endpoint: consultar pesquisa de satisfação ativa
router.get('/pesquisa-satisfacao', verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.usuario;
    if (!empresaId) return res.status(401).json({ error: 'Usuário não autenticado.' });
    
    const [emp] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empresaId]);
    if (!emp.length) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json({ pesquisaSatisfacaoAtiva: emp[0].pesquisaSatisfacaoAtiva });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar pesquisa de satisfação.' });
  }
});

// Novo endpoint: atualizar pesquisa de satisfação ativa
router.put('/pesquisa-satisfacao', verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.usuario;
    if (!empresaId) return res.status(401).json({ error: 'Usuário não autenticado.' });
    
    const { pesquisaSatisfacaoAtiva } = req.body;
    if (typeof pesquisaSatisfacaoAtiva !== 'boolean' && pesquisaSatisfacaoAtiva !== 0 && pesquisaSatisfacaoAtiva !== 1) {
      return res.status(400).json({ error: 'Valor inválido para pesquisaSatisfacaoAtiva.' });
    }
    
    await db.query('UPDATE empresas SET pesquisaSatisfacaoAtiva = ? WHERE id = ?', [pesquisaSatisfacaoAtiva ? 1 : 0, empresaId]);
    res.json({ ok: true, pesquisaSatisfacaoAtiva: pesquisaSatisfacaoAtiva ? 1 : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar pesquisa de satisfação.' });
  }
});

module.exports = router;
