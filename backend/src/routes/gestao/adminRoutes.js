const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const bcrypt = require("bcryptjs");
const verifyToken = require("../../middlewares/auth");

/**
 * 🆕 Função para enviar mensagem de boas-vindas via WhatsApp
 * @param {string} telefone - Telefone da empresa
 * @param {string} razaoSocial - Razão social da empresa
 */
async function enviarWhatsAppBoasVindas(telefone, razaoSocial) {
  const mensagem = `🎉 *BEM-VINDO AO CF TITAN!*

Olá *${razaoSocial}*,

É com grande alegria que damos as boas-vindas ao nosso sistema de gestão de tarefas e obrigações!

*O QUE VOCÊ PODE FAZER NO CF TITAN:*
• Gerenciar obrigações fiscais e contábeis
• Acompanhar prazos e metas
• Organizar tarefas por departamentos
• Integrar com sistemas como eContador e Onvio
• Gerar relatórios detalhados

*ACESSO AO SISTEMA:*
https://app.cftitan.com.br

*PRÓXIMOS PASSOS:*
1. Acesse o sistema com suas credenciais
2. Configure seus departamentos
3. Cadastre seus clientes
4. Comece a gerenciar suas obrigações

*SUPORTE:*
Estamos aqui para ajudar! Entre em contato conosco sempre que precisar. E acompanhe nosso plantação de dúvidas ás 10h e as 16h todos os dias. 

*Equipe CF Titan*
*Sistema de Gestão Inteligente*`;

  // Formatar telefone para internacional (remover caracteres não numéricos)
  const numero = telefone.replace(/\D/g, "");
  
  try {
    // Enviar via Z-API
    const response = await fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
      },
      body: JSON.stringify({
        phone: numero,
        message: mensagem
      })
    });

    if (response.ok) {
      console.log(`📱 WhatsApp de boas-vindas enviado para: ${numero}`);
      return true;
    } else {
      console.error("❌ Erro ao enviar WhatsApp de boas-vindas:", await response.text());
      return false;
    }
  } catch (error) {
    console.error("❌ Erro ao enviar WhatsApp de boas-vindas:", error);
    return false;
  }
}

// 📌 Cadastro do usuário principal
router.post("/usuario", async (req, res) => {
  const { nome, email, senha, nivel, empresaId, cargoId } = req.body;

  try {
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha, nivel) VALUES (?, ?, ?, ?)",
      [nome, email, hash, nivel || "usuario"]
    );
    const usuarioId = result.insertId;

    // Associar usuário à empresa e cargo na relacao_empresas
    if (empresaId && cargoId) {
      await db.execute(
        `INSERT INTO relacao_empresas (usuarioId, empresaId, dataAssociacao, cargoId) VALUES (?, ?, NOW(), ?)`,
        [usuarioId, empresaId, cargoId]
      );
    }

    res.json({ message: "Usuário criado com sucesso", usuarioId, empresaId, cargoId });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

// 📌 Cadastro do escritório (empresa)
router.post("/empresa", async (req, res) => {
  const { cnpj, razaoSocial, endereco, telefone } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO empresas (cnpj, razaoSocial, endereco, telefone, pfx, senhaPfx, apiKeyEplugin, dataCriacao)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, NOW())`,
      [cnpj, razaoSocial, endereco, telefone]
    );
    const empresaId = result.insertId;

    // ✅ OTIMIZADO: Clonar departamentos globais em lote
    const [departamentosGlobais] = await db.query("SELECT * FROM departamentos_globais");
    
    // Se não existirem departamentos globais, criar os padrões
    if (departamentosGlobais.length === 0) {
      console.log("🔄 Criando departamentos globais padrão...");
      
      const departamentosPadrao = [
        { nome: "Contábil", descricao: "Departamento responsável pelas obrigações contábeis" },
        { nome: "Fiscal", descricao: "Departamento responsável pelas obrigações fiscais federais" },
        { nome: "Pessoal", descricao: "Departamento responsável pelas obrigações trabalhistas" }
      ];
      
      // ✅ OTIMIZADO: Inserir departamentos globais em lote
      const valoresDepartamentos = departamentosPadrao.map(dep => [dep.nome, dep.descricao]);
      await db.query(
        "INSERT INTO departamentos_globais (nome, descricao) VALUES ?",
        [valoresDepartamentos]
      );
      
      // Buscar novamente os departamentos globais
      const [novosDepartamentosGlobais] = await db.query("SELECT * FROM departamentos_globais");
      
      // ✅ OTIMIZADO: Inserir departamentos da empresa em lote
      const valoresEmpresa = novosDepartamentosGlobais.map(dep => [empresaId, dep.nome, dep.id]);
      await db.query(
        "INSERT INTO departamentos (empresaId, nome, departamentoGlobalId) VALUES ?",
        [valoresEmpresa]
      );
      console.log(`✅ ${novosDepartamentosGlobais.length} departamentos criados em lote para empresa ${empresaId}`);
    } else {
      // ✅ OTIMIZADO: Inserir departamentos da empresa em lote
      const valoresEmpresa = departamentosGlobais.map(dep => [empresaId, dep.nome, dep.id]);
      await db.query(
        "INSERT INTO departamentos (empresaId, nome, departamentoGlobalId) VALUES ?",
        [valoresEmpresa]
      );
      console.log(`✅ ${departamentosGlobais.length} departamentos clonados em lote para empresa ${empresaId}`);
    }

    // ✅ OTIMIZADO: Criar cargos em lote
    const permissoesAdmin = JSON.stringify({ adm: ["admin"] });
    const permissoesSuperadmin = JSON.stringify({ adm: ["superadmin", "admin"] });
    
    const cargos = [
      [empresaId, 'Administrador', 'Acesso total ao sistema', permissoesAdmin],
      [empresaId, 'Superadmin', 'Cargo com acesso total e permissões de superadmin', permissoesSuperadmin]
    ];
    
    const [cargosResult] = await db.query(
      "INSERT INTO cargos (empresa_id, nome, descricao, permissoes, criado_em) VALUES ?",
      [cargos.map(cargo => [...cargo, new Date()])]
    );
    
    const cargoAdminId = cargosResult.insertId;
    const cargoSuperadminId = cargosResult.insertId + 1;

    // Associar usuário 1 à empresa e ao cargo Superadmin
    await db.execute(
      `INSERT INTO relacao_empresas (usuarioId, empresaId, dataAssociacao, cargoId) VALUES (?, ?, NOW(), ?)`,
      [1, empresaId, cargoSuperadminId]
    );

    // ✅ OTIMIZADO: Responder imediatamente ao usuário
    res.json({ message: "Empresa cadastrada com sucesso", empresaId, cargoAdminId, cargoSuperadminId });

    // ✅ OTIMIZADO: Processar tarefas pesadas de forma assíncrona (não bloqueia a resposta)
    setImmediate(async () => {
      try {
        // Clonar enquetes, categorias e particularidades padrão
        await clonarDadosPadrao(empresaId);
        console.log(`✅ Dados padrão clonados com sucesso para empresa ${empresaId}`);
      } catch (erro) {
        console.warn(`⚠️ Erro ao clonar dados padrão para empresa ${empresaId}:`, erro.message);
      }

      try {
        // Criar obrigações padrão com particularidades
        await criarObrigacoesPadrao(empresaId);
        console.log(`✅ Obrigações padrão criadas com sucesso para empresa ${empresaId}`);
      } catch (erro) {
        console.warn(`⚠️ Erro ao criar obrigações padrão para empresa ${empresaId}:`, erro.message);
      }

      // ✅ OTIMIZADO: Enviar WhatsApp de forma assíncrona
      if (telefone) {
        try {
          await enviarWhatsAppBoasVindas(telefone, razaoSocial);
          console.log(`✅ WhatsApp de boas-vindas enviado para: ${telefone}`);
        } catch (erro) {
          console.warn(`⚠️ Erro ao enviar WhatsApp de boas-vindas para ${telefone}:`, erro.message);
        }
      }
    });
  } catch (error) {
    console.error("Erro ao cadastrar empresa:", error);
    res.status(500).json({ error: "Erro ao cadastrar empresa" });
  }
});

/**
 * 🆕 Função para criar dados padrão para uma nova empresa
 * @param {number} novaEmpresaId - ID da nova empresa
 */
async function clonarDadosPadrao(novaEmpresaId) {
  console.log(`🔄 Criando dados padrão para empresa ${novaEmpresaId}`);
  
  // 📋 Dados padrão hardcoded
  const dadosPadrao = {
    grupos: [
      {
        classificacao: "01",
        titulo: "Cadastro inicial - Informações dos clientes",
        perguntas: [
          {
            texto: "É um cliente fixo?",
            tipo: "UNICA",
            respostas: ["Cliente Fixo", "Cliente Eventual"]
          },
          {
            texto: "A empresa é matriz ou filial?",
            tipo: "UNICA",
            respostas: ["Matriz", "Filial"]
          },
          {
            texto: "Qual a tributação do cliente?",
            tipo: "UNICA",
            respostas: [
              "Pessoa Fisica",
              "Lucro Real",
              "Lucro Presumido",
              "Simples Nacional",
              "Imune",
              "Isento",
              "MEI"
            ]
          },
          {
            texto: "Em qual estado está Localizado?",
            tipo: "UNICA",
            respostas: [
              "Rio de Janeiro",
              "São Paulo",
              "Santa Catarina",
              "Espirito Santo",
              "Minas Gerais",
              "Paraná",
              "Rio Grande do Sul",
              "Bahia",
              "Sergipe",
              "Alagoas",
              "Pernambuco",
              "Paraíba",
              "Rio Grande do Norte",
              "Ceará",
              "Maranhão",
              "Pará",
              "Amapá",
              "Amazonas",
              "Roraima",
              "Acre",
              "Rondônia",
              "Mato Grosso",
              "Mato Grosso do Sul",
              "Goias",
              "Brasília",
              "Tocantins"
            ]
          }
        ]
      },
      {
        classificacao: "02",
        titulo: "Departamento Fiscal",
        perguntas: [
          {
            texto: "Quais Obrigações Federais?",
            tipo: "MULTIPLA",
            respostas: [
              "ECD",
              "ECF",
              "EFD-REINF",
              "DIRF",
              "DIMOB",
              "DMED",
              "EFD CONTRIB / Dezembro"
            ]
          },
          {
            texto: "Quais Obrigações Estaduais Adicionais?",
            tipo: "MULTIPLA",
            respostas: [
              "GIA",
              "ICMS-ST"
            ]
          },
          {
            texto: "Quais Obrigações Municipais?",
            tipo: "MULTIPLA",
            respostas: []
          },
          {
            texto: "Qual Atividade/Segmento?",
            tipo: "UNICA",
            respostas: [
              "Prestador de Serviço",
              "Comércio",
              "Industria",
              "Construção",
              "Sem movimento / não está faturando"
            ]
          },
          {
            texto: "IRPJ / CSLL - Lucro Presumido",
            tipo: "UNICA",
            respostas: [
              "Mensal (LP)",
              "Trimestral (LP)",
              "Trimestral por Cotas (LP)"
            ]
          },
          {
            texto: "IRPJ / CSLL - Lucro Real",
            tipo: "UNICA",
            respostas: [
              "Mensal (LR)",
              "Estimativa Mensal (LR)"
            ]
          }
        ]
      },
      {
        classificacao: "03",
        titulo: "Departamento Pessoal",
        perguntas: [
          {
            texto: "Qual o tipo de folha de pagamento deste cliente?",
            tipo: "UNICA",
            respostas: [
              "Folha Mensal (Funcionários e Sócios)"
            ]
          },
          {
            texto: "Qual é a data de vencimento da Folha Mensal (Funcionários e Sócios) desse cliente?",
            tipo: "UNICA",
            respostas: [
              "Folha - 1º Dia Útil",
              "Folha - 5º Dia Útil",
              "Folha - Último Dia Útil"
            ]
          },
          {
            texto: "Qual é a data de vencimento da Folha Pessoa Física (CEI)?",
            tipo: "UNICA",
            respostas: [
              "Folha CEI - 1º Dia Útil",
              "Folha CEI - 5º Dia Útil",
              "Folha CEI - Último Dia",
              "Folha Somente Pró-Labore (Apenas Sócios)"
            ]
          },
          {
            texto: "Qual é a data de vencimento da Folha Somente Pró-Labore (Apenas Sócios) deste cliente?",
            tipo: "UNICA",
            respostas: [
              "Só Pró-Labore - 1º Dia Útil",
              "Só Pró-Labore - 5º Dia Útil",
              "Só Pró-Labore - Último Dia Útil",
              "Folha Sem Movimento"
            ]
          },
          {
            texto: "Quais obrigações sem movimentação/negativas são entregues para esse cliente ?",
            tipo: "MULTIPLA",
            respostas: [
              "E-Social (Sem Movimento) - Anual em Fevereiro",
              "Envio do evento e-social s-1299 fechamento/SEFIP (Inativa)",
              "RAIS Negativa",
              "DCTF Web - Sem movimento/Inativa",
              "Folha Autônomo"
            ]
          },
          {
            texto: "Este cliente possui Adiantamento Salarial? Se sim, em qual data?",
            tipo: "UNICA",
            respostas: [
              "Folha de Adiantamento 15",
              "Folha de Adiantamento 20"
            ]
          },
          {
            texto: "Quais destes demais serviços de DP são processados pelo escritório e entregues ao cliente?",
            tipo: "MULTIPLA",
            respostas: [
              "Folha de Ponto",
              "Férias Coletivas Carnaval",
              "Férias Coletivas Natal",
              "Controle de Férias",
              "PIS S/ Folha"
            ]
          },
          {
            texto: "Qual é a data de vencimento da Folha Doméstica deste cliente?",
            tipo: "UNICA",
            respostas: [
              "Folha Pessoa Física (CEI)"
            ]
          }
        ]
      },
      {
        classificacao: "04",
        titulo: "Departamento Contabil",
        perguntas: [
          {
            texto: "Com qual frequência é realizado o Fechamento Contábil deste cliente?",
            tipo: "UNICA",
            respostas: [
              "Fechamento Contábil Trimestral",
              "Fechamento Contábil Mensal",
              "Fechamento Contábil Anual"
            ]
          },
          {
            texto: "Quais demais Obrigações Contábeis são realizadas para este cliente?",
            tipo: "MULTIPLA",
            respostas: [
              "Carnê Leão",
              "Livro Caixa",
              "Solicitação de Documentos Contábeis"
            ]
          }
        ]
      }
    ],
    categorias: [
      {
        nome: "Empresa"
      }
    ],
    particularidades: [
      // Cliente Fixo/Eventual
      { nome: "Cliente Fixo", descricao: "O cliente é um cliente fixo.", categoria: "Empresa" },
      { nome: "Cliente Eventual", descricao: "O cliente é um cliente eventual.", categoria: "Empresa" },
      
      // Matriz/Filial
      { nome: "Matriz", descricao: "Essa empresa é Matriz", categoria: "Empresa" },
      { nome: "Filial", descricao: "Essa empresa é filial", categoria: "Empresa" },
      
      // Tributação
      { nome: "Pessoa Fisica", descricao: "Pessoa física", categoria: "Empresa" },
      { nome: "Lucro Real", descricao: "Regime normal tributário para PJS", categoria: "Empresa" },
      { nome: "Lucro Presumido", descricao: "Regime especial de tributação", categoria: "Empresa" },
      { nome: "Simples Nacional", descricao: "Enquadramento empresarial", categoria: "Empresa" },
      { nome: "Imune", descricao: "Isento de tributação", categoria: "Empresa" },
      { nome: "Isento", descricao: "Isento de tributação", categoria: "Empresa" },
      { nome: "MEI", descricao: "Microempreendedor Individual", categoria: "Empresa" },
      
      // Estados
      { nome: "Rio de Janeiro", descricao: "Estado do Rio de Janeiro", categoria: "Empresa" },
      { nome: "São Paulo", descricao: "Estado de São Paulo", categoria: "Empresa" },
      { nome: "Santa Catarina", descricao: "Estado de Santa Catarina", categoria: "Empresa" },
      { nome: "Espirito Santo", descricao: "Estado do Espírito Santo", categoria: "Empresa" },
      { nome: "Minas Gerais", descricao: "Estado de Minas Gerais", categoria: "Empresa" },
      { nome: "Paraná", descricao: "Estado do Paraná", categoria: "Empresa" },
      { nome: "Rio Grande do Sul", descricao: "Estado do Rio Grande do Sul", categoria: "Empresa" },
      { nome: "Bahia", descricao: "Estado da Bahia", categoria: "Empresa" },
      { nome: "Sergipe", descricao: "Estado de Sergipe", categoria: "Empresa" },
      { nome: "Alagoas", descricao: "Estado de Alagoas", categoria: "Empresa" },
      { nome: "Pernambuco", descricao: "Estado de Pernambuco", categoria: "Empresa" },
      { nome: "Paraíba", descricao: "Estado da Paraíba", categoria: "Empresa" },
      { nome: "Rio Grande do Norte", descricao: "Estado do Rio Grande do Norte", categoria: "Empresa" },
      { nome: "Ceará", descricao: "Estado do Ceará", categoria: "Empresa" },
      { nome: "Maranhão", descricao: "Estado do Maranhão", categoria: "Empresa" },
      { nome: "Pará", descricao: "Estado do Pará", categoria: "Empresa" },
      { nome: "Amapá", descricao: "Estado do Amapá", categoria: "Empresa" },
      { nome: "Amazonas", descricao: "Estado do Amazonas", categoria: "Empresa" },
      { nome: "Roraima", descricao: "Estado de Roraima", categoria: "Empresa" },
      { nome: "Acre", descricao: "Estado do Acre", categoria: "Empresa" },
      { nome: "Rondônia", descricao: "Estado de Rondônia", categoria: "Empresa" },
      { nome: "Mato Grosso", descricao: "Estado do Mato Grosso", categoria: "Empresa" },
      { nome: "Mato Grosso do Sul", descricao: "Estado do Mato Grosso do Sul", categoria: "Empresa" },
      { nome: "Goias", descricao: "Estado de Goiás", categoria: "Empresa" },
      { nome: "Brasília", descricao: "Distrito Federal", categoria: "Empresa" },
      { nome: "Tocantins", descricao: "Estado do Tocantins", categoria: "Empresa" },
      
      // Obrigações Federais
      { nome: "ECD", descricao: "Escrituração Contábil Digital", categoria: "Empresa" },
      { nome: "ECF", descricao: "Escrituração Contábil Fiscal", categoria: "Empresa" },
      { nome: "EFD-REINF", descricao: "Escrituração Fiscal Digital - REINF", categoria: "Empresa" },
      { nome: "DIRF", descricao: "Declaração do Imposto de Renda Retido na Fonte", categoria: "Empresa" },
      { nome: "DIMOB", descricao: "Declaração de Informações sobre Atividades Imobiliárias", categoria: "Empresa" },
      { nome: "DMED", descricao: "Declaração de Operações com Medicamentos", categoria: "Empresa" },
      { nome: "EFD CONTRIB / Dezembro", descricao: "Escrituração Fiscal Digital - Contribuições", categoria: "Empresa" },
      
      // Obrigações Estaduais
      { nome: "GIA", descricao: "Guia de Informações e Apuração do ICMS", categoria: "Empresa" },
      { nome: "ICMS-ST", descricao: "ICMS Substituição Tributária", categoria: "Empresa" },
      
      // Atividades/Segmentos
      { nome: "Prestador de Serviço", descricao: "Prestador de serviços", categoria: "Empresa" },
      { nome: "Comércio", descricao: "Comércio", categoria: "Empresa" },
      { nome: "Industria", descricao: "Industria", categoria: "Empresa" },
      { nome: "Construção", descricao: "Construção civil", categoria: "Empresa" },
      { nome: "Sem movimento / não está faturando", descricao: "Empresa sem movimento", categoria: "Empresa" },
      
      // IRPJ/CSLL
      { nome: "Mensal (LP)", descricao: "IRPJ/CSLL Lucro Presumido Mensal", categoria: "Empresa" },
      { nome: "Trimestral (LP)", descricao: "IRPJ/CSLL Lucro Presumido Trimestral", categoria: "Empresa" },
      { nome: "Trimestral por Cotas (LP)", descricao: "IRPJ/CSLL Lucro Presumido Trimestral por Cotas", categoria: "Empresa" },
      { nome: "Mensal (LR)", descricao: "IRPJ/CSLL Lucro Real Mensal", categoria: "Empresa" },
      { nome: "Estimativa Mensal (LR)", descricao: "IRPJ/CSLL Lucro Real Estimativa Mensal", categoria: "Empresa" },
      
      // Folha de Pagamento
      { nome: "Folha Mensal (Funcionários e Sócios)", descricao: "Folha de pagamento mensal", categoria: "Empresa" },
      { nome: "Folha - 1º Dia Útil", descricao: "Vencimento no primeiro dia útil", categoria: "Empresa" },
      { nome: "Folha - 5º Dia Útil", descricao: "Vencimento no quinto dia útil", categoria: "Empresa" },
      { nome: "Folha - Último Dia Útil", descricao: "Vencimento no último dia útil", categoria: "Empresa" },
      { nome: "Folha CEI - 1º Dia Útil", descricao: "Folha CEI no primeiro dia útil", categoria: "Empresa" },
      { nome: "Folha CEI - 5º Dia Útil", descricao: "Folha CEI no quinto dia útil", categoria: "Empresa" },
      { nome: "Folha CEI - Último Dia", descricao: "Folha CEI no último dia", categoria: "Empresa" },
      { nome: "Folha Somente Pró-Labore (Apenas Sócios)", descricao: "Folha apenas para sócios", categoria: "Empresa" },
      { nome: "Só Pró-Labore - 1º Dia Útil", descricao: "Pró-labore no primeiro dia útil", categoria: "Empresa" },
      { nome: "Só Pró-Labore - 5º Dia Útil", descricao: "Pró-labore no quinto dia útil", categoria: "Empresa" },
      { nome: "Só Pró-Labore - Último Dia Útil", descricao: "Pró-labore no último dia útil", categoria: "Empresa" },
      { nome: "Folha Sem Movimento", descricao: "Folha sem movimento", categoria: "Empresa" },
      { nome: "Folha de Adiantamento 15", descricao: "Adiantamento no dia 15", categoria: "Empresa" },
      { nome: "Folha de Adiantamento 20", descricao: "Adiantamento no dia 20", categoria: "Empresa" },
      { nome: "Folha de Ponto", descricao: "Controle de ponto", categoria: "Empresa" },
      { nome: "Férias Coletivas Carnaval", descricao: "Férias coletivas no carnaval", categoria: "Empresa" },
      { nome: "Férias Coletivas Natal", descricao: "Férias coletivas no natal", categoria: "Empresa" },
      { nome: "Controle de Férias", descricao: "Controle de férias", categoria: "Empresa" },
      { nome: "PIS S/ Folha", descricao: "PIS sobre folha", categoria: "Empresa" },
      { nome: "Folha Pessoa Física (CEI)", descricao: "Folha para pessoa física", categoria: "Empresa" },
      
      // Obrigações sem movimento
      { nome: "E-Social (Sem Movimento) - Anual em Fevereiro", descricao: "E-Social sem movimento anual", categoria: "Empresa" },
      { nome: "Envio do evento e-social s-1299 fechamento/SEFIP (Inativa)", descricao: "E-Social S-1299", categoria: "Empresa" },
      { nome: "RAIS Negativa", descricao: "RAIS negativa", categoria: "Empresa" },
      { nome: "DCTF Web - Sem movimento/Inativa", descricao: "DCTF Web sem movimento", categoria: "Empresa" },
      { nome: "Folha Autônomo", descricao: "Folha para autônomo", categoria: "Empresa" },
      
      // Contábil
      { nome: "Fechamento Contábil Trimestral", descricao: "Fechamento contábil trimestral", categoria: "Empresa" },
      { nome: "Fechamento Contábil Mensal", descricao: "Fechamento contábil mensal", categoria: "Empresa" },
      { nome: "Fechamento Contábil Anual", descricao: "Fechamento contábil anual", categoria: "Empresa" },
      { nome: "Carnê Leão", descricao: "Carnê Leão", categoria: "Empresa" },
      { nome: "Livro Caixa", descricao: "Livro caixa", categoria: "Empresa" },
      { nome: "Solicitação de Documentos Contábeis", descricao: "Solicitação de documentos", categoria: "Empresa" }
    ]
  };
  
  try {
    // 1️⃣ Criar categorias
    const mapeamentoCategorias = new Map();
    for (const categoria of dadosPadrao.categorias) {
      const [novaCategoria] = await db.query(
        "INSERT INTO particularidades_categorias (empresaid, nome) VALUES (?, ?)",
        [novaEmpresaId, categoria.nome]
      );
      mapeamentoCategorias.set(categoria.nome, novaCategoria.insertId);
      console.log(`✅ Categoria criada: ${categoria.nome} (ID: ${novaCategoria.insertId})`);
    }
    
          // 2️⃣ Criar particularidades
      const mapeamentoParticularidades = new Map();
      for (const particularidade of dadosPadrao.particularidades) {
        const categoriaId = mapeamentoCategorias.get(particularidade.categoria);
        const [novaParticularidade] = await db.query(
          "INSERT INTO particularidades (empresaid, categoria, nome, descricao, categoriaId) VALUES (?, ?, ?, ?, ?)",
          [novaEmpresaId, particularidade.categoria, particularidade.nome, particularidade.descricao, categoriaId]
        );
        mapeamentoParticularidades.set(particularidade.nome, novaParticularidade.insertId);
        console.log(`✅ Particularidade criada: ${particularidade.nome}`);
      }
    
    // 3️⃣ Criar grupos de enquetes
    for (const grupo of dadosPadrao.grupos) {
      const [novoGrupo] = await db.query(
        "INSERT INTO enquete_grupos (empresaid, classificacao, titulo) VALUES (?, ?, ?)",
        [novaEmpresaId, grupo.classificacao, grupo.titulo]
      );
      const grupoId = novoGrupo.insertId;
      console.log(`✅ Grupo criado: ${grupo.titulo} (ID: ${grupoId})`);
      
      // 4️⃣ Criar perguntas do grupo
      for (const pergunta of grupo.perguntas) {
        const [novaPergunta] = await db.query(
          "INSERT INTO enquete_perguntas (grupoId, texto, tipo) VALUES (?, ?, ?)",
          [grupoId, pergunta.texto, pergunta.tipo]
        );
        const perguntaId = novaPergunta.insertId;
        console.log(`✅ Pergunta criada: ${pergunta.texto.substring(0, 30)}...`);
        
        // 5️⃣ Criar respostas da pergunta
        for (const resposta of pergunta.respostas) {
          const particularidadeId = mapeamentoParticularidades.get(resposta);
          if (particularidadeId) {
            await db.query(
              "INSERT INTO enquete_respostas (perguntaId, particularidadeId) VALUES (?, ?)",
              [perguntaId, particularidadeId]
            );
            console.log(`✅ Resposta criada: ${resposta} → pergunta ${perguntaId}`);
          } else {
            console.warn(`⚠️ Particularidade não encontrada: ${resposta}`);
          }
        }
      }
    }
    
    console.log(`✅ Dados padrão criados com sucesso para empresa ${novaEmpresaId}!`);
  } catch (error) {
    console.error(`❌ Erro ao criar dados padrão para empresa ${novaEmpresaId}:`, error);
    throw error;
  }
}


router.post("/processo-global", verifyToken, async (req, res) => {
  try {
    const { nome, diasMeta, diasPrazo, departamentoGlobalId } = req.body;
    const empresaId = req.usuario.empresaId;

    if (!departamentoGlobalId) {
      return res.status(400).json({ error: "Departamento Global ID é obrigatório." });
    }

   // Verifica se o departamento já existe para a empresa com base no departamentoGlobalId
const [departamentosExistentes] = await db.query(
  "SELECT id FROM departamentos WHERE departamentoGlobalId = ? AND empresaId = ?",
  [departamentoGlobalId, empresaId]
);


    let departamentoId;

    if (departamentosExistentes.length > 0) {
      departamentoId = departamentosExistentes[0].id;
    } else {
      // Buscar nome do departamento global
      const [[departamentoGlobal]] = await db.query(
        "SELECT nome FROM departamentos_globais WHERE id = ?",
        [departamentoGlobalId]
      );

      if (!departamentoGlobal) {
        return res.status(404).json({ error: "Departamento global não encontrado." });
      }

      // Inserir o departamento para a empresa
      const [novoDep] = await db.query(
        "INSERT INTO departamentos (nome, empresaId) VALUES (?, ?)",
        [departamentoGlobal.nome, empresaId]
      );

      departamentoId = novoDep.insertId;
    }

    // Criar o processo
    const [result] = await db.query(
      `INSERT INTO processos 
       (nome, diasMeta, diasPrazo, padraoFranqueadora, empresaId, departamentoId, departamentoGlobalId) 
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [nome, diasMeta, diasPrazo, empresaId, departamentoId, departamentoGlobalId]
    );
    
    res.status(201).json({ message: "Processo padrão criado", processId: result.insertId });
  } catch (error) {
    console.error("Erro ao criar processo global:", error);
    res.status(500).json({ error: "Erro ao criar processo global" });
  }
});

// 📌 Buscar todos os departamentos globais
router.get("/departamentos-globais", verifyToken, async (req, res) => {
  try {
    const [departamentos] = await db.query("SELECT id, nome FROM departamentos_globais");
    res.json(departamentos);
  } catch (err) {
    console.error("Erro ao buscar departamentos globais:", err);
    res.status(500).json({ error: "Erro ao buscar departamentos globais" });
  }
});



// 📌 Criar atividade para processo padrão da franqueadora
router.post("/atividade-global", verifyToken, async (req, res) => {
  try {
    const { processoId, texto, descricao, tipo, tipoCancelamento, ordem } = req.body;

    if (!processoId || !texto || !tipo || !ordem) {
      return res.status(400).json({ error: "Dados incompletos para criar atividade." });
    }

    const [processos] = await db.query(
      "SELECT id FROM processos WHERE id = ? AND empresaId = ?",
      [processoId, req.usuario.empresaId]
    );

    if (processos.length === 0) {
      return res.status(403).json({ error: "Processo não pertence à empresa autenticada." });
    }

    await db.execute(
      `INSERT INTO atividades_processo
        (processoId, empresaId, texto, descricao, tipo, tipoCancelamento, ordem, criadoEm)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [processoId, req.usuario.empresaId, texto, descricao || null, tipo, tipoCancelamento, ordem]
    );

    res.status(201).json({ message: "Atividade adicionada com sucesso." });
  } catch (error) {
    console.error("Erro ao criar atividade global:", error);
    res.status(500).json({ error: "Erro ao criar atividade global" });
  }
});

// 📌 Rota para buscar processos padrão da franqueadora
router.get("/processos-franqueadora", verifyToken, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId;
    const [processos] = await db.query(
      `SELECT p.*, dg.nome as departamentoGlobalNome 
       FROM processos p 
       LEFT JOIN departamentos_globais dg ON p.departamentoGlobalId = dg.id 
       WHERE p.padraoFranqueadora = 1 AND p.empresaId = ?`,
      [empresaId]
    );

    res.json(processos);
  } catch (error) {
    console.error("Erro ao buscar processos padrão:", error);
    res.status(500).json({ error: "Erro ao buscar processos padrão" });
  }
});

// 📌 Rota para buscar processo global específico
router.get("/processos-franqueadora/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.usuario.empresaId;
    
    const [processos] = await db.query(
      `SELECT p.*, dg.nome as departamentoGlobalNome 
       FROM processos p 
       LEFT JOIN departamentos_globais dg ON p.departamentoGlobalId = dg.id 
       WHERE p.id = ? AND p.padraoFranqueadora = 1 AND p.empresaId = ?`,
      [id, empresaId]
    );

    if (processos.length === 0) {
      return res.status(404).json({ error: "Processo global não encontrado." });
    }

    res.json(processos[0]);
  } catch (error) {
    console.error("Erro ao buscar processo global:", error);
    res.status(500).json({ error: "Erro ao buscar processo global" });
  }
});

// 📌 Rota para buscar atividades de processo global
router.get("/atividades-global/:processoId", verifyToken, async (req, res) => {
  try {
    const { processoId } = req.params;
    const empresaId = req.usuario.empresaId;

    const [atividades] = await db.query(
      `SELECT id, texto, descricao, tipo, tipoCancelamento, ordem, criadoEm 
       FROM atividades_processo 
       WHERE processoId = ? AND empresaId = ? 
       ORDER BY ordem ASC`,
      [processoId, empresaId]
    );

    res.json(atividades);
  } catch (error) {
    console.error("Erro ao buscar atividades do processo global:", error);
    res.status(500).json({ error: "Erro ao buscar atividades" });
  }
});

// 📌 Rota para excluir atividade de processo global
router.delete("/atividade-global/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.usuario.empresaId;

    // Verificar se a atividade pertence à empresa do usuário
    const [atividades] = await db.query(
      "SELECT id FROM atividades_processo WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    if (atividades.length === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    await db.execute(
      "DELETE FROM atividades_processo WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );

    res.json({ message: "Atividade excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir atividade:", error);
    res.status(500).json({ error: "Erro ao excluir atividade" });
  }
});

// 📌 Editar atividade de processo global
router.put("/atividade-global/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { texto, descricao, tipo, tipoCancelamento } = req.body;
    const empresaId = req.usuario.empresaId;

    const [atividades] = await db.query(
      "SELECT id FROM atividades_processo WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );
    if (atividades.length === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    await db.execute(
      `UPDATE atividades_processo SET texto = ?, descricao = ?, tipo = ?, tipoCancelamento = ? WHERE id = ? AND empresaId = ?`,
      [texto, descricao || null, tipo, tipoCancelamento, id, empresaId]
    );
    res.json({ message: "Atividade atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao editar atividade:", error);
    res.status(500).json({ error: "Erro ao editar atividade" });
  }
});

// 📌 Atualizar ordem da atividade global
router.put("/atividade-global/:id/ordem", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { novaOrdem } = req.body;
    const empresaId = req.usuario.empresaId;

    const [atividades] = await db.query(
      "SELECT id FROM atividades_processo WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );
    if (atividades.length === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    await db.execute(
      `UPDATE atividades_processo SET ordem = ? WHERE id = ? AND empresaId = ?`,
      [novaOrdem, id, empresaId]
    );
    res.json({ message: "Ordem atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    res.status(500).json({ error: "Erro ao atualizar ordem" });
  }
});

// 📌 CRUD de template de e-mail para atividades globais
router.get("/processos-email-template/:atividadeId", verifyToken, async (req, res) => {
  try {
    const { atividadeId } = req.params;
    const empresaId = req.usuario.empresaId;
    const [templates] = await db.query(
      "SELECT * FROM processos_email_templates WHERE atividadeId = ? AND empresaId = ?",
      [atividadeId, empresaId]
    );
    if (templates.length === 0) {
      return res.json(null);
    }
    res.json(templates[0]);
  } catch (error) {
    console.error("Erro ao buscar template de e-mail global:", error);
    res.status(500).json({ error: "Erro ao buscar template de e-mail global" });
  }
});

router.post("/processos-email-template/:atividadeId", verifyToken, async (req, res) => {
  try {
    const { atividadeId } = req.params;
    const empresaId = req.usuario.empresaId;
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
    res.json({ message: "Template salvo com sucesso" });
  } catch (error) {
    console.error("Erro ao salvar template de e-mail global:", error);
    res.status(500).json({ error: "Erro ao salvar template de e-mail global" });
  }
});

/**
 * 🆕 Rota para clonar dados padrão para uma empresa existente
 */
router.post("/clonar-dados-padrao/:empresaId", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.params;
    
    // Verificar se a empresa existe
    const [empresa] = await db.query("SELECT id FROM empresas WHERE id = ?", [empresaId]);
    if (empresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }
    
    // Clonar dados padrão
    await clonarDadosPadrao(empresaId);
    
    res.json({ 
      message: "Dados padrão clonados com sucesso!", 
      empresaId: parseInt(empresaId)
    });
  } catch (error) {
    console.error("Erro ao clonar dados padrão:", error);
    res.status(500).json({ error: "Erro ao clonar dados padrão." });
  }
});

// 📌 Consulta de custos por empresa
router.get("/custos-empresa", verifyToken, async (req, res) => {
  try {
    const { empresaId, periodoInicial, periodoFinal, tipoOperacao } = req.query;
    
    let query = `
      SELECT 
        sr.empresa_id,
        e.razaoSocial as empresa_nome,
        sr.tipo_operacao,
        sr.status,
        COUNT(*) as total_requisicoes,
        SUM(CASE WHEN sr.custo IS NOT NULL THEN sr.custo ELSE 0 END) as custo_total,
        DATE_FORMAT(sr.data_hora, '%Y-%m') as mes_ano
      FROM serpro_requisicoes sr
      LEFT JOIN empresas e ON sr.empresa_id = e.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (empresaId) {
      query += ` AND sr.empresa_id = ?`;
      params.push(empresaId);
    }
    
    if (periodoInicial) {
      query += ` AND sr.data_hora >= ?`;
      params.push(periodoInicial);
    }
    
    if (periodoFinal) {
      query += ` AND sr.data_hora <= ?`;
      params.push(periodoFinal);
    }
    
    if (tipoOperacao) {
      query += ` AND sr.tipo_operacao = ?`;
      params.push(tipoOperacao);
    }
    
    query += ` GROUP BY sr.empresa_id, sr.tipo_operacao, sr.status, DATE_FORMAT(sr.data_hora, '%Y-%m')
               ORDER BY sr.empresa_id, mes_ano DESC, sr.tipo_operacao`;
    
    const [resultados] = await db.query(query, params);
    
    // Calcular totais por empresa
    const totaisPorEmpresa = {};
    resultados.forEach(row => {
      const key = `${row.empresa_id}_${row.tipo_operacao}`;
      if (!totaisPorEmpresa[key]) {
        totaisPorEmpresa[key] = {
          empresa_id: row.empresa_id,
          empresa_nome: row.empresa_nome,
          tipo_operacao: row.tipo_operacao,
          total_requisicoes: 0,
          custo_total: 0,
          detalhes: []
        };
      }
      totaisPorEmpresa[key].total_requisicoes += row.total_requisicoes;
      // Garantir que custo_total seja um número válido
      const custoValor = parseFloat(row.custo_total) || 0;
      totaisPorEmpresa[key].custo_total += custoValor;
      totaisPorEmpresa[key].detalhes.push({
        mes_ano: row.mes_ano,
        status: row.status,
        total_requisicoes: row.total_requisicoes,
        custo_total: custoValor
      });
    });
    
    res.json({
      success: true,
      data: Object.values(totaisPorEmpresa)
    });
    
  } catch (error) {
    console.error("❌ Erro ao consultar custos:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao consultar custos por empresa" 
    });
  }
});

// 📌 Consulta detalhada de custos por empresa
router.get("/custos-empresa/:empresaId/detalhado", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { periodoInicial, periodoFinal, tipoOperacao, status } = req.query;
    
    let query = `
      SELECT 
        sr.id,
        sr.empresa_id,
        e.razaoSocial as empresa_nome,
        sr.cnpj_empresa,
        sr.tipo_operacao,
        sr.endpoint,
        sr.status,
        sr.custo,
        sr.data_hora,
        sr.detalhes
      FROM serpro_requisicoes sr
      LEFT JOIN empresas e ON sr.empresa_id = e.id
      WHERE sr.empresa_id = ?
    `;
    
    const params = [empresaId];
    
    if (periodoInicial) {
      query += ` AND sr.data_hora >= ?`;
      params.push(periodoInicial);
    }
    
    if (periodoFinal) {
      query += ` AND sr.data_hora <= ?`;
      params.push(periodoFinal);
    }
    
    if (tipoOperacao) {
      query += ` AND sr.tipo_operacao = ?`;
      params.push(tipoOperacao);
    }
    
    if (status) {
      query += ` AND sr.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY sr.data_hora DESC LIMIT 1000`;
    
    const [resultados] = await db.query(query, params);
    
    // Calcular estatísticas
    const estatisticas = {
      total_requisicoes: resultados.length,
      custo_total: resultados.reduce((sum, row) => sum + (row.custo || 0), 0),
      por_tipo: {},
      por_status: {}
    };
    
    resultados.forEach(row => {
      // Por tipo de operação
      if (!estatisticas.por_tipo[row.tipo_operacao]) {
        estatisticas.por_tipo[row.tipo_operacao] = {
          total: 0,
          custo: 0
        };
      }
      estatisticas.por_tipo[row.tipo_operacao].total++;
      estatisticas.por_tipo[row.tipo_operacao].custo += row.custo || 0;
      
      // Por status
      if (!estatisticas.por_status[row.status]) {
        estatisticas.por_status[row.status] = {
          total: 0,
          custo: 0
        };
      }
      estatisticas.por_status[row.status].total++;
      estatisticas.por_status[row.status].custo += row.custo || 0;
    });
    
    res.json({
      success: true,
      data: {
        empresa: resultados[0]?.empresa_nome || 'Empresa não encontrada',
        estatisticas,
        requisicoes: resultados
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao consultar custos detalhados:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao consultar custos detalhados" 
    });
  }
});

// Preferências do usuário logado
router.get('/usuarios/preferencias', verifyToken, async (req, res) => {
  const usuarioId = req.usuario.id;
  try {
    const [rows] = await db.query('SELECT preferencias FROM usuarios WHERE id = ?', [usuarioId]);
    const pref = rows[0]?.preferencias;
    let parsed = {};
    if (pref) {
      try {
        parsed = JSON.parse(pref);
      } catch (e) {
        parsed = {};
      }
    }
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar preferências.' });
  }
});

// 📌 Listar todos os usuários com informações de vínculos e filtros
router.get('/usuarios', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, empresas, nivel, search } = req.query;
    const offset = (page - 1) * limit;
    
    // Construir WHERE clause dinamicamente
    let whereConditions = [];
    let params = [];
    
    // ✅ NOVO: Filtro por empresas - só aplicar se especificado
    if (empresas && empresas !== '' && empresas !== 'undefined') {
      if (empresas === 'none' || empresas === 'null') {
        // Filtro para usuários SEM vínculos
        whereConditions.push(`NOT EXISTS (
          SELECT 1 FROM relacao_empresas re2 
          WHERE re2.usuarioId = u.id
        )`);
      } else {
        const empresaIds = empresas.split(',').filter(id => id.trim() !== '');
        if (empresaIds.length > 0) {
          whereConditions.push(`EXISTS (
            SELECT 1 FROM relacao_empresas re2 
            WHERE re2.usuarioId = u.id 
            AND re2.empresaId IN (${empresaIds.map(() => '?').join(',')})
          )`);
          params.push(...empresaIds);
        }
      }
    }
    // ✅ SE não há filtro de empresas, trazer TODOS os usuários (com ou sem vínculos)
    
    // Filtro por nível (só aplicar se especificado)
    if (nivel && nivel !== '') {
      whereConditions.push('u.nivel = ?');
      params.push(nivel);
    }
    // ✅ REMOVIDO: Não excluir usuários admin automaticamente
    
    // Filtro por busca (nome ou email)
    if (search && search !== '') {
      whereConditions.push('(u.nome LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // ✅ NOVO: Query para contar total de registros
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM usuarios u
      ${whereConditions.length > 0 ? `
      LEFT JOIN relacao_empresas re ON u.id = re.usuarioId
      LEFT JOIN empresas e ON re.empresaId = e.id
      LEFT JOIN cargos c ON re.cargoId = c.id
      ` : ''}
      ${whereClause}
    `;
    
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // ✅ NOVO: Query principal com paginação - otimizada para quando não há filtros
    const mainQuery = `
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.nivel,
        ${whereConditions.length > 0 ? `
        COALESCE(
          GROUP_CONCAT(
            CONCAT(e.razaoSocial, ' (', c.nome, ')') 
            SEPARATOR ', '
          ), 
          NULL
        ) as empresaAtual
        ` : `
        (SELECT GROUP_CONCAT(
          CONCAT(e2.razaoSocial, ' (', c2.nome, ')') 
          SEPARATOR ', '
        ) FROM relacao_empresas re2 
         LEFT JOIN empresas e2 ON re2.empresaId = e2.id 
         LEFT JOIN cargos c2 ON re2.cargoId = c2.id 
         WHERE re2.usuarioId = u.id) as empresaAtual
        `}
      FROM usuarios u
      ${whereConditions.length > 0 ? `
      LEFT JOIN relacao_empresas re ON u.id = re.usuarioId
      LEFT JOIN empresas e ON re.empresaId = e.id
      LEFT JOIN cargos c ON re.cargoId = c.id
      ` : ''}
      ${whereClause}
      ${whereConditions.length > 0 ? 'GROUP BY u.id, u.nome, u.email, u.nivel' : ''}
      ORDER BY u.nome
      LIMIT ? OFFSET ?
    `;
    
    const [usuarios] = await db.query(mainQuery, [...params, parseInt(limit), offset]);
    
    // ✅ NOVO: Log detalhado para debug
    console.log('🔍 Filtros aplicados:', { 
      empresas, 
      nivel, 
      search, 
      total, 
      page: parseInt(page),
      limit: parseInt(limit),
      whereConditions: whereConditions.length > 0 ? whereConditions.join(' AND ') : 'NENHUM FILTRO',
      params
    });
    
    console.log(`📊 Resultado: ${usuarios.length} usuários de ${total} total`);
    
    res.json({
      usuarios,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// 📌 Vincular usuário a empresa
router.post('/vincular-usuario', verifyToken, async (req, res) => {
  try {
    const { usuarioId, empresaId, cargoId } = req.body;
    
    // Verificar se o vínculo já existe
    const [vinculoExistente] = await db.query(
      "SELECT id FROM relacao_empresas WHERE usuarioId = ? AND empresaId = ? AND cargoId = ?",
      [usuarioId, empresaId, cargoId]
    );
    
    if (vinculoExistente.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Este usuário já possui este vínculo com a empresa." 
      });
    }
    
    // Criar novo vínculo
    await db.execute(
      "INSERT INTO relacao_empresas (usuarioId, empresaId, cargoId, dataAssociacao) VALUES (?, ?, ?, NOW())",
      [usuarioId, empresaId, cargoId]
    );
    
    res.json({ 
      success: true, 
      message: "Usuário vinculado com sucesso!" 
    });
  } catch (error) {
    console.error("Erro ao vincular usuário:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro ao vincular usuário" 
    });
  }
});

router.post('/usuarios/preferencias', verifyToken, async (req, res) => {
  const usuarioId = req.usuario.id;
  const preferencias = req.body;
  try {
    await db.query('UPDATE usuarios SET preferencias = ? WHERE id = ?', [JSON.stringify(preferencias), usuarioId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar preferências.' });
  }
});

// 📌 Resetar senha de usuário
router.post('/resetar-senha/:usuarioId', verifyToken, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Verificar se o usuário existe
    const [usuarios] = await db.query("SELECT * FROM usuarios WHERE id = ?", [usuarioId]);
    if (usuarios.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    
    // Gerar nova senha aleatória
    const novaSenha = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
    const hashedSenha = await bcrypt.hash(novaSenha, 10);
    
    // Atualizar senha no banco
    await db.query("UPDATE usuarios SET senha = ? WHERE id = ?", [hashedSenha, usuarioId]);
    
    // Enviar e-mail com a nova senha
    const usuario = usuarios[0];
    try {
      const emailService = require("../services/emailService");
      await emailService.enviarEmailNovaSenha(usuario.email, usuario.nome, novaSenha);
    } catch (emailError) {
      console.warn("Erro ao enviar e-mail:", emailError);
      // Não falhar a operação se o e-mail falhar
    }
    
    res.json({ 
      success: true, 
      message: "Senha resetada com sucesso! Nova senha enviada por e-mail.",
      novaSenha // Apenas para debug, remover em produção
    });
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
    res.status(500).json({ error: "Erro ao resetar senha." });
  }
});

// 📌 Remover vínculo de usuário com empresa
router.delete('/vinculo/:vinculoId', verifyToken, async (req, res) => {
  try {
    const { vinculoId } = req.params;
    
    // Verificar se o vínculo existe
    const [vinculos] = await db.query(
      "SELECT * FROM relacao_empresas WHERE id = ?", 
      [vinculoId]
    );
    
    if (vinculos.length === 0) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    
    // Remover vínculo
    await db.query("DELETE FROM relacao_empresas WHERE id = ?", [vinculoId]);
    
    res.json({ 
      success: true, 
      message: "Vínculo removido com sucesso!" 
    });
  } catch (error) {
    console.error("Erro ao remover vínculo:", error);
    res.status(500).json({ error: "Erro ao remover vínculo." });
  }
});

// 📌 Obter detalhes completos do usuário
router.get('/usuario/:usuarioId/detalhes', verifyToken, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Buscar dados do usuário
    const [usuarios] = await db.query(
      "SELECT id, nome, email, nivel, telefone, dataCriacao FROM usuarios WHERE id = ?", 
      [usuarioId]
    );
    
    if (usuarios.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    
    const usuario = usuarios[0];
    
    // Buscar vínculos com empresas
    const [vinculos] = await db.query(`
      SELECT 
        re.id as vinculoId,
        re.dataAssociacao,
        e.id as empresaId,
        e.razaoSocial as empresaNome,
        c.id as cargoId,
        c.nome as cargoNome,
        d.id as departamentoId,
        d.nome as departamentoNome
      FROM relacao_empresas re
      LEFT JOIN empresas e ON re.empresaId = e.id
      LEFT JOIN cargos c ON re.cargoId = c.id
      LEFT JOIN departamentos d ON re.departamentoId = d.id
      WHERE re.usuarioId = ?
      ORDER BY re.dataAssociacao DESC
    `, [usuarioId]);
    
    res.json({
      usuario,
      vinculos
    });
  } catch (error) {
    console.error("Erro ao buscar detalhes do usuário:", error);
    res.status(500).json({ error: "Erro ao buscar detalhes do usuário." });
  }
});

// 📌 Atualizar vínculo de usuário
router.put('/vinculo/:vinculoId', verifyToken, async (req, res) => {
  try {
    const { vinculoId } = req.params;
    const { empresaId, cargoId, departamentoId } = req.body;
    
    // Verificar se o vínculo existe
    const [vinculos] = await db.query(
      "SELECT * FROM relacao_empresas WHERE id = ?", 
      [vinculoId]
    );
    
    if (vinculos.length === 0) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    
    // Atualizar vínculo
    const updateFields = [];
    const updateValues = [];
    
    if (empresaId !== undefined) {
      updateFields.push("empresaId = ?");
      updateValues.push(empresaId);
    }
    if (cargoId !== undefined) {
      updateFields.push("cargoId = ?");
      updateValues.push(cargoId);
    }
    if (departamentoId !== undefined) {
      updateFields.push("departamentoId = ?");
      updateValues.push(departamentoId);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }
    
    updateValues.push(vinculoId);
    await db.query(
      `UPDATE relacao_empresas SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );
    
    res.json({ 
      success: true, 
      message: "Vínculo atualizado com sucesso!" 
    });
  } catch (error) {
    console.error("Erro ao atualizar vínculo:", error);
    res.status(500).json({ error: "Erro ao atualizar vínculo." });
  }
});

/**
 * 🆕 Função para criar obrigações padrão com particularidades para uma nova empresa
 * @param {number} novaEmpresaId - ID da nova empresa
 */
async function criarObrigacoesPadrao(novaEmpresaId) {
  console.log(`🔄 Criando obrigações padrão para empresa ${novaEmpresaId}`);
  
  try {
    // 📋 Obrigações padrão com suas particularidades
    const obrigacoesPadrao = [
      // OBRIGAÇÕES CONTÁBEIS
      {
        codigo: "R 03.01.01",
        nome: "Balancete Simples Nacional",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        particularidades: ["Simples Nacional"]
      },
      {
        codigo: "R 03.01.02",
        nome: "Balancete Lucro Presumido",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        particularidades: ["Lucro Presumido"]
      },
      {
        codigo: "R 03.01.03",
        nome: "Balancete Lucro Real",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        particularidades: ["Lucro Real"]
      },
      {
        codigo: "R 03.02.01",
        nome: "Movimento Contábil",
        frequencia: "Mensal",
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 5,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mesmo mês",
        orgao: "Contábil",
        particularidades: ["Simples Nacional", "Lucro Presumido", "Lucro Real"],
        tipoRelacao: "OU" // Relação OU (qualquer uma das particularidades)
      },
      {
        codigo: "R 03.03.01",
        nome: "ECF (Escrituração Contábil Fiscal)",
        frequencia: "Anual",
        acaoQtdDias: 15,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 7,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Antecipar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Contábil",
        particularidades: ["Lucro Presumido", "Lucro Real"]
      },
      
      // OBRIGAÇÕES FISCAIS
      {
        codigo: "R 05.02.03",
        nome: "DAS - MEI",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        particularidades: ["MEI"]
      },
      {
        codigo: "R 05.02.11",
        nome: "EFD Contribuições",
        frequencia: "Mensal",
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 10,
        fatoGerador: "Dois meses anteriores",
        orgao: "Federal",
        particularidades: ["Lucro Presumido", "Lucro Real"]
      },
      {
        codigo: "R 05.02.27",
        nome: "PIS e COFINS",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 25,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        particularidades: ["Lucro Presumido", "Lucro Real"]
      },
      {
        codigo: "R 05.02.20",
        nome: "IRPJ e CSLL Trimestral",
        frequencia: "Trimestral",
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Trimestre anterior",
        orgao: "Federal",
        particularidades: ["Lucro Presumido"]
      },
      {
        codigo: "R 05.02.21",
        nome: "IRPJ Mensal",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        particularidades: ["Lucro Real"]
      },
      {
        codigo: "R 05.02.01",
        nome: "CSLL MENSAL",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Federal",
        particularidades: ["Lucro Real"]
      },
      
      // OBRIGAÇÕES TRABALHISTAS
      {
        codigo: "R 03.02.02",
        nome: "DCTF Web",
        frequencia: "Mensal",
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        particularidades: ["Folha Mensal (Funcionários e Sócios)", "Folha Somente Pró-Labore (Apenas Sócios)"]
      },
      {
        codigo: "R 03.01.13",
        nome: "Folha de Pagamento - 1º Dia Útil",
        frequencia: "Mensal",
        acaoQtdDias: 10,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 5,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        particularidades: ["Folha Mensal (Funcionários e Sócios)"]
      },
      {
        codigo: "R 03.02.21",
        nome: "FGTS",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        particularidades: ["Folha Mensal (Funcionários e Sócios)"]
      },
      {
        codigo: "R 03.02.13",
        nome: "INSS",
        frequencia: "Mensal",
        acaoQtdDias: 5,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 2,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 20,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        particularidades: ["Folha Mensal (Funcionários e Sócios)", "Folha Somente Pró-Labore (Apenas Sócios)"]
      },
      {
        codigo: "R 03.02.03",
        nome: "DCTF Web - Pró-labore",
        frequencia: "Mensal",
        acaoQtdDias: 7,
        acaoTipoDias: "Dias úteis",
        metaQtdDias: 3,
        metaTipoDias: "Dias úteis",
        vencimentoTipo: "Postergar",
        vencimentoDia: 31,
        fatoGerador: "Mês anterior",
        orgao: "Trabalhista",
        particularidades: ["Folha Somente Pró-Labore (Apenas Sócios)"]
      }
    ];
    
    // Buscar todos os departamentos da empresa para mapear corretamente as obrigações
    const [departamentos] = await db.query(
      "SELECT id, nome FROM departamentos WHERE empresaId = ?",
      [novaEmpresaId]
    );
    
    if (departamentos.length === 0) {
      console.warn(`⚠️ Nenhum departamento encontrado para empresa ${novaEmpresaId}, criando obrigações sem departamento`);
    }
    
    // Mapeamento de órgãos para nomes de departamentos
    const mapeamentoOrgaoDepartamento = {
      "Contábil": ["Contábil", "Contabilidade", "Contabil", "Contábeis"],
      "Federal": ["Fiscal", "Federal", "Receita Federal", "Fiscais"],
      "Trabalhista": ["Pessoal", "Trabalhista", "RH", "Recursos Humanos", "Trabalhistas"]
    };
    
    // Função para encontrar o departamento correto baseado no órgão
    const encontrarDepartamento = (orgao) => {
      const nomesPossiveis = mapeamentoOrgaoDepartamento[orgao] || [];
      
      for (const nome of nomesPossiveis) {
        const departamento = departamentos.find(dep => 
          dep.nome.toLowerCase().includes(nome.toLowerCase())
        );
        if (departamento) {
          console.log(`🎯 Mapeamento encontrado: Órgão "${orgao}" → Departamento "${departamento.nome}" (ID: ${departamento.id})`);
          return departamento.id;
        }
      }
      
      // Se não encontrar, usar o primeiro departamento disponível
      console.warn(`⚠️ Departamento não encontrado para órgão "${orgao}", usando departamento padrão`);
      return departamentos.length > 0 ? departamentos[0].id : null;
    };
    
    // Criar cada obrigação
    for (const obrigacao of obrigacoesPadrao) {
      try {
        // 1️⃣ Encontrar o departamento correto para esta obrigação
        const departamentoId = encontrarDepartamento(obrigacao.orgao);
        
        // 2️⃣ Inserir a obrigação
        const [novaObrigacao] = await db.query(
          `INSERT INTO obrigacoes (
            empresaid, departamentoid, nome, frequencia, diaSemana, acaoQtdDias, acaoTipoDias, 
            metaQtdDias, metaTipoDias, vencimentoTipo, vencimentoDia, fatoGerador, 
            orgao, aliasValidacao, geraMulta, usarRelatorio, reenviarEmail, dataCriacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            novaEmpresaId,
            departamentoId,
            obrigacao.nome,
            obrigacao.frequencia,
            null, // diaSemana (não aplicável para estas obrigações)
            obrigacao.acaoQtdDias,
            obrigacao.acaoTipoDias,
            obrigacao.metaQtdDias,
            obrigacao.metaTipoDias,
            obrigacao.vencimentoTipo,
            obrigacao.vencimentoDia,
            obrigacao.fatoGerador,
            obrigacao.orgao,
            null, // aliasValidacao
            0,    // geraMulta (padrão: não)
            0,    // usarRelatorio (padrão: não)
            0     // reenviarEmail (padrão: não)
          ]
        );
        
        const obrigacaoId = novaObrigacao.insertId;
        
        // Buscar nome do departamento para o log
        const departamentoNome = departamentos.find(dep => dep.id === departamentoId)?.nome || 'Sem departamento';
        console.log(`✅ Obrigação criada: ${obrigacao.codigo} - ${obrigacao.nome} (ID: ${obrigacaoId}) → Departamento: ${departamentoNome}`);
        
        // 2️⃣ Se a obrigação tem particularidades, criar os relacionamentos
        if (obrigacao.particularidades && obrigacao.particularidades.length > 0) {
          for (const nomeParticularidade of obrigacao.particularidades) {
            try {
              // Buscar a particularidade pelo nome
              const [particularidades] = await db.query(
                "SELECT id FROM particularidades WHERE empresaid = ? AND nome = ?",
                [novaEmpresaId, nomeParticularidade]
              );
              
              if (particularidades.length > 0) {
                const particularidadeId = particularidades[0].id;
                
                // Inserir na tabela obrigações_particularidades
                const tipoRelacao = obrigacao.tipoRelacao === "OU" ? "OU" : "E";
                await db.query(
                  `INSERT INTO obrigacoes_particularidades (
                    obrigacaoid, tipo, particularidadeId
                  ) VALUES (?, ?, ?)`,
                  [obrigacaoId, tipoRelacao, particularidadeId]
                );
                
                console.log(`✅ Particularidade vinculada: ${nomeParticularidade} → obrigação ${obrigacaoId}`);
              } else {
                console.warn(`⚠️ Particularidade não encontrada: ${nomeParticularidade} para empresa ${novaEmpresaId}`);
              }
            } catch (erroParticularidade) {
              console.error(`❌ Erro ao vincular particularidade ${nomeParticularidade}:`, erroParticularidade.message);
            }
          }
        } else {
          // Obrigação sem particularidades (sempre obrigatória)
          console.log(`✅ Obrigação sem particularidades criada: ${obrigacao.codigo} - sempre obrigatória`);
        }
        
      } catch (erroObrigacao) {
        console.error(`❌ Erro ao criar obrigação ${obrigacao.codigo}:`, erroObrigacao.message);
      }
    }
    
    console.log(`✅ Obrigações padrão criadas com sucesso para empresa ${novaEmpresaId}!`);
    
  } catch (error) {
    console.error(`❌ Erro ao criar obrigações padrão para empresa ${novaEmpresaId}:`, error);
    throw error;
  }
}

// 🔧 Rota para recriar enquetes de uma empresa específica
router.post("/recriar-enquetes/:empresaId", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.params;
    const usuarioEmpresaId = req.usuario.empresaId;

    // Verificar se o usuário tem permissão para acessar esta empresa
    if (usuarioEmpresaId !== parseInt(empresaId)) {
      return res.status(403).json({ error: "Acesso negado para esta empresa" });
    }

    // Verificar se a empresa existe
    const [empresa] = await db.query("SELECT id, razaoSocial FROM empresas WHERE id = ?", [empresaId]);
    if (!empresa.length) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    console.log(`🔄 Recriando enquetes para empresa: ${empresa[0].razaoSocial} (ID: ${empresaId})`);

    // Verificar se já existem enquetes para esta empresa
    const [enquetesExistentes] = await db.query(
      "SELECT COUNT(*) as total FROM enquete_grupos WHERE empresaid = ?", 
      [empresaId]
    );

    if (enquetesExistentes[0].total > 0) {
      console.log(`⚠️ Empresa já possui ${enquetesExistentes[0].total} grupos de enquetes`);
      
      // Perguntar se deve limpar as existentes
      const { limparExistentes } = req.body;
      if (!limparExistentes) {
        return res.status(400).json({ 
          error: "Empresa já possui enquetes. Use 'limparExistentes: true' para recriar.",
          enquetesExistentes: enquetesExistentes[0].total
        });
      }

      // Limpar enquetes existentes
      console.log(`🗑️ Limpando enquetes existentes...`);
      
      // Buscar IDs dos grupos para deletar em cascata
      const [grupos] = await db.query("SELECT id FROM enquete_grupos WHERE empresaid = ?", [empresaId]);
      const grupoIds = grupos.map(g => g.id);
      
      if (grupoIds.length > 0) {
        // Deletar respostas
        await db.query(
          `DELETE FROM enquete_respostas WHERE perguntaId IN (
            SELECT id FROM enquete_perguntas WHERE grupoId IN (${grupoIds.map(() => '?').join(',')})
          )`,
          grupoIds
        );
        
        // Deletar perguntas
        await db.query(
          "DELETE FROM enquete_perguntas WHERE grupoId IN (" + grupoIds.map(() => '?').join(',') + ")",
          grupoIds
        );
        
        // Deletar grupos
        await db.query(
          "DELETE FROM enquete_grupos WHERE id IN (" + grupoIds.map(() => '?').join(',') + ")",
          grupoIds
        );
      }
      
      console.log(`✅ ${grupoIds.length} grupos de enquetes removidos`);
    }

    // Recriar as enquetes usando a função existente
    await clonarDadosPadrao(empresaId);
    
    console.log(`✅ Enquetes recriadas com sucesso para empresa ${empresaId}`);

    res.json({
      success: true,
      message: "Enquetes recriadas com sucesso",
      empresa: {
        id: empresa[0].id,
        razaoSocial: empresa[0].razaoSocial
      },
      acao: enquetesExistentes[0].total > 0 ? "recriadas" : "criadas"
    });

  } catch (error) {
    console.error("❌ Erro ao recriar enquetes:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor ao recriar enquetes",
      details: error.message 
    });
  }
});

module.exports = router;