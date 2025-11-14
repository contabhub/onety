const express = require("express");
const { createDocumentAutentique, getDocumentAutentique, deleteDocumentAutentique, getDocumentFiles } = require("../../services/contratual/autentique");
const db = require("../../config/database"); // conexão MySQL (mysql2/promise)
const verifyToken = require("../../middlewares/auth");
const PdfPrinter = require("pdfmake");
const htmlToPdfmake = require("html-to-pdfmake");
const { JSDOM } = require("jsdom");
const crypto = require("crypto");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const { sendEmail } = require("../../config/email");
const cloudinary = require("../../config/cloudinary");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const webSocketManager = require("../../websocket");


const router = express.Router();

// Função para gerar senha aleatória
function generateRandomPassword(length = 12) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Função para converter pre_cliente em cliente
async function converterPreClienteParaCliente(preClienteId, connection) {
  try {
    console.log("🔍 Convertendo pre_cliente para cliente, pre_cliente_id:", preClienteId);

    // 1. Buscar dados do pre_cliente
    const [[preCliente]] = await connection.query(
      `SELECT * FROM pre_clientes WHERE id = ?`,
      [preClienteId]
    );

    if (!preCliente) {
      console.log("⚠️ Pre_cliente não encontrado:", preClienteId);
      return null;
    }

    // 2. Verificar se já existe cliente com mesmo CPF/CNPJ
    if (preCliente.cpf_cnpj) {
      const [[clienteExistente]] = await connection.query(
        `SELECT id FROM clientes WHERE cpf_cnpj = ? AND empresa_id = ?`,
        [preCliente.cpf_cnpj.replace(/\D/g, ''), preCliente.empresa_id]
      );

      if (clienteExistente) {
        console.log("✅ Cliente já existe, retornando cliente_id:", clienteExistente.id);
        return clienteExistente.id;
      }
    }

    // 3. Mapear campos de pre_clientes para clientes
    const tipoPessoa = preCliente.tipo === 'pessoa_fisica' ? 'FISICA' : 'JURIDICA';
    const nomeFantasia = preCliente.nome || preCliente.nome_fantasia || '';
    const razaoSocial = preCliente.razao_social || nomeFantasia;
    
    // 4. Criar cliente na tabela clientes
    const [result] = await connection.query(
      `INSERT INTO clientes (
        tipo_pessoa, cpf_cnpj, nome_fantasia, razao_social, apelido,
        email_principal, telefone_comercial, telefone_celular,
        pais, cep, endereco, numero, estado, cidade, bairro, complemento,
        observacoes, empresa_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipoPessoa,
        preCliente.cpf_cnpj ? preCliente.cpf_cnpj.replace(/\D/g, '') : null,
        nomeFantasia,
        razaoSocial,
        preCliente.nome || null,
        preCliente.email || null,
        preCliente.telefone || null,
        preCliente.telefone || null,
        preCliente.pais || 'Brasil',
        preCliente.cep ? preCliente.cep.replace(/\D/g, '') : null,
        preCliente.endereco || null,
        preCliente.numero || null,
        preCliente.estado || null,
        preCliente.cidade || null,
        preCliente.bairro || null,
        preCliente.complemento || null,
        null, // observacoes
        preCliente.empresa_id
      ]
    );

    const clienteId = result.insertId;
    console.log("✅ Cliente criado com ID:", clienteId);
    return clienteId;

  } catch (error) {
    console.error("❌ Erro ao converter pre_cliente para cliente:", error);
    // Não falha o processo de assinatura por erro na conversão
    return null;
  }
}

// Função para criar vendas baseadas em produtos_dados quando straton = 1
async function criarVendasDeProdutosDados(contratoId, connection) {
  try {
    console.log("🔍 Verificando se deve criar vendas para contrato:", contratoId);

    // 1. Buscar dados do contrato e verificar se o modelo tem straton = 1
    const [[contrato]] = await connection.query(`
      SELECT 
        c.*,
        mc.straton
      FROM contratos c
      LEFT JOIN modelos_contrato mc ON c.modelos_contrato_id = mc.id
      WHERE c.id = ?
    `, [contratoId]);

    if (!contrato) {
      console.log("⚠️ Contrato não encontrado:", contratoId);
      return;
    }

    // 2. Verificar se straton = 1
    if (contrato.straton !== 1) {
      console.log("ℹ️ Modelo não tem straton = 1, pulando criação de vendas");
      return;
    }

    // 3. Verificar se tem produtos_dados
    if (!contrato.produtos_dados) {
      console.log("⚠️ Contrato não tem produtos_dados, pulando criação de vendas");
      return;
    }

    let produtosDados;
    try {
      produtosDados = typeof contrato.produtos_dados === 'string' 
        ? JSON.parse(contrato.produtos_dados) 
        : contrato.produtos_dados;
    } catch (parseError) {
      console.error("❌ Erro ao fazer parse de produtos_dados:", parseError);
      return;
    }

    if (!Array.isArray(produtosDados) || produtosDados.length === 0) {
      console.log("⚠️ produtos_dados não é um array válido ou está vazio");
      return;
    }

    console.log(`✅ Criando vendas para ${produtosDados.length} produto(s)`);

    // 4. Verificar se cliente_id existe no contrato (deve ter sido convertido)
    if (!contrato.cliente_id) {
      console.log("⚠️ Contrato não tem cliente_id, tentando converter pre_cliente...");
      if (contrato.pre_cliente_id) {
        const clienteId = await converterPreClienteParaCliente(contrato.pre_cliente_id, connection);
        if (clienteId) {
          await connection.query(
            `UPDATE contratos SET cliente_id = ? WHERE id = ?`,
            [clienteId, contratoId]
          );
          contrato.cliente_id = clienteId;
        }
      }
    }

    if (!contrato.cliente_id) {
      console.log("⚠️ Não foi possível obter cliente_id, pulando criação de vendas");
      return;
    }

    // 5. Iterar sobre cada produto e criar vendas para cada parcela
    let vendasCriadas = 0;
    for (const produto of produtosDados) {
      if (!produto.parcelas_detalhadas || !Array.isArray(produto.parcelas_detalhadas)) {
        console.log(`⚠️ Produto ${produto.id || produto.nome} não tem parcelas_detalhadas válidas`);
        continue;
      }

      for (const parcela of produto.parcelas_detalhadas) {
        if (!parcela.data_vencimento || !parcela.valor) {
          console.log(`⚠️ Parcela ${parcela.numero} não tem data_vencimento ou valor válidos`);
          continue;
        }

        // Calcular mes_referencia e ano_referencia da data de vencimento
        // Extrair diretamente da string para evitar problemas de timezone
        const dataStr = parcela.data_vencimento.split('T')[0]; // Garantir formato YYYY-MM-DD
        const [anoStr, mesStr, diaStr] = dataStr.split('-');
        const mesReferencia = parseInt(mesStr, 10);
        const anoReferencia = parseInt(anoStr, 10);

        // Criar venda
        await connection.query(`
          INSERT INTO vendas (
            cliente_id, 
            empresa_id, 
            valor_venda, 
            vencimento, 
            situacao, 
            tipo_venda,
            observacoes, 
            contrato_id, 
            mes_referencia, 
            ano_referencia,
            categoria_id, 
            subcategoria_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contrato.cliente_id,
          contrato.empresa_id,
          parseFloat(parcela.valor) || 0,
          dataStr, // Apenas a data (YYYY-MM-DD)
          'pendente',
          'recorrente',
          `Contrato ${contratoId} - Produto: ${produto.nome || 'N/A'} - Parcela ${parcela.numero}/${produto.total_parcelas || produto.parcelas || 1}`,
          contratoId,
          mesReferencia,
          anoReferencia,
          contrato.categoria_id || null,
          contrato.subcategoria_id || null
        ]);

        vendasCriadas++;
      }
    }

    console.log(`✅ ${vendasCriadas} venda(s) criada(s) para contrato ${contratoId}`);
  } catch (error) {
    console.error("❌ Erro ao criar vendas de produtos_dados:", error);
    // Não falha o processo de assinatura por erro na criação de vendas
  }
}

// Função para cadastrar funcionário quando contrato/documento for assinado
async function cadastrarFuncionarioAposAssinatura(recordId, connection, tableType = 'contratos') {
  try {
    console.log("🔍 Verificando se deve cadastrar funcionário para", tableType, "ID:", recordId);
    
    // 1. Buscar dados do contrato/documento e verificar se o modelo tem funcionario = 1
    //    Correção: em contratos o campo é modelos_contrato_id; em documentos pode variar
    const modelField = tableType === 'contratos' ? 'modelos_contrato_id' : 'modelos_contrato_id';
    const [[record]] = await connection.query(`
      SELECT r.*, mc.funcionario, mc.straton, pc.*, pc.nome as cliente_nome, pc.email as cliente_email
      FROM ${tableType} r
      JOIN modelos_contrato mc ON r.${modelField} = mc.id
      JOIN pre_clientes pc ON r.pre_cliente_id = pc.id
      WHERE r.id = ? AND mc.funcionario = 1
    `, [recordId]);

    if (!record) {
      console.log("ℹ️", tableType, "não encontrado ou modelo não é de funcionário");
      return;
    }

    // Se o modelo é financeiro/straton=1, não cadastrar funcionário
    if (record.straton === 1) {
      console.log("ℹ️ Modelo com straton = 1 (financeiro). Pular cadastro de funcionário.");
      return;
    }

    console.log("✅ Modelo é de funcionário, processando cadastro...");

    // 2. Validar email
    if (!record.cliente_email || record.cliente_email.trim() === '') {
      console.log("⚠️ Email inválido ou vazio, pulando cadastro de funcionário");
      return;
    }

    // 3. Verificar se email já existe na tabela usuarios
    const [[usuarioExistente]] = await connection.query(
      "SELECT id, nome FROM usuarios WHERE email = ?",
      [record.cliente_email]
    );

    if (usuarioExistente) {
      console.log("⚠️ Email já cadastrado, enviando email de aviso...");
      console.log("📧 Email de aviso para:", record.cliente_email);
      
      // Enviar email de aviso
      await sendEmail({
        to: record.cliente_email,
        subject: "Aviso: Documento Assinado - Usuário Já Cadastrado",
        html: `
          <h2>Olá ${record.cliente_nome}!</h2>
          <p>Seu documento foi assinado com sucesso!</p>
          <p>Porém, detectamos que você já possui um cadastro em nosso sistema com este email.</p>
          <p>Se precisar de ajuda para acessar sua conta, entre em contato conosco.</p>
          <br>
          <p>Atenciosamente,<br>Equipe Onety</p>
        `
      });
      return;
    }

    // 3. Gerar senha aleatória e criptografar
    const senhaAleatoria = generateRandomPassword();
    const senhaCriptografada = await bcrypt.hash(senhaAleatoria, 10);

    // 4. Cadastrar na tabela usuarios
    const [resultUsuario] = await connection.query(`
      INSERT INTO usuarios (nome, email, senha, telefone, status) 
      VALUES (?, ?, ?, ?, 'ativo')
    `, [
      record.cliente_nome,
      record.cliente_email,
      senhaCriptografada,
      record.telefone || null
    ]);

    const usuarioId = resultUsuario.insertId;
    console.log("✅ Usuário cadastrado com ID:", usuarioId);

    // 5. Cadastrar na tabela usuarios_empresas
    await connection.query(`
      INSERT INTO usuarios_empresas (usuario_id, empresa_id, cargo_id, departamento_id) 
      VALUES (?, ?, ?, ?)
    `, [
      usuarioId,
      record.empresa_id,
      record.cargo_id || null,
      record.departamento_id || null
    ]);

    console.log("✅ Vínculo empresa criado");

    // 6. Enviar email de boas-vindas com a senha
    console.log("📧 Enviando email de boas-vindas para:", record.cliente_email);
    await sendEmail({
      to: record.cliente_email,
      subject: "Bem-vindo! Seu documento foi assinado e sua conta foi criada",
      html: `
        <h2>Olá ${record.cliente_nome}!</h2>
        <p>Parabéns! Seu documento foi assinado com sucesso e sua conta foi criada em nosso sistema.</p>
        <p><strong>Suas credenciais de acesso:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${record.cliente_email}</li>
          <li><strong>Senha:</strong> ${senhaAleatoria}</li>
        </ul>
        <p><strong>Importante:</strong> Recomendamos que você altere sua senha no primeiro acesso por segurança.</p>
        <p>Você pode acessar o sistema através do nosso portal.</p>
        <br>
        <p>Bem-vindo à equipe!<br>Equipe Onety</p>
      `
    });

    console.log("✅ Email de boas-vindas enviado");

  } catch (error) {
    console.error("❌ Erro ao cadastrar funcionário:", error);
    // Não falha o processo de assinatura por erro no cadastro
  }
}

// troca .../pades.pdf (com ou sem querystring) por .../certificado.pdf
function fixPadesUrl(url) {
  if (typeof url !== "string") return url;
  return url.replace(/\/pades\.pdf(\?.*)?$/i, (_m, qs = "") => `/certificado.pdf${qs}`);
}


/**
 * 📌 1️⃣ Rota para HTML com variáveis (converte para PDF e envia para Autentique)
 * Segue a mesma estrutura da rota de contratos.js
 */
router.post("/html", verifyToken, async (req, res) => {
  const {
    template_id,
    client_id,
    signatories,
    variables,
    empresa_id,
    valor,
    valor_recorrente,
    expires_at,
    start_at,
    end_at,
    produtos_dados,
    // Dados financeiros (Straton)
    categoria_id,
    sub_categoria_id,
    centro_de_custo_id,
    conta_api_id
  } = req.body;
  const createdBy = req.user.id;

  // Debug: verificar dados recebidos
  console.log('🔍 [POST /html] produtos_dados recebido:', produtos_dados ? (Array.isArray(produtos_dados) ? `Array com ${produtos_dados.length} items` : typeof produtos_dados) : 'null/undefined');
  console.log('🔍 [POST /html] categoria_id:', categoria_id);
  console.log('🔍 [POST /html] sub_categoria_id:', sub_categoria_id);
  console.log('🔍 [POST /html] centro_de_custo_id:', centro_de_custo_id);
  console.log('🔍 [POST /html] conta_api_id:', conta_api_id);

  // Validação dos campos (mesma estrutura do contratos.js)
  if (!template_id || !client_id || !Array.isArray(signatories) || signatories.length === 0 || !empresa_id) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  if (!expires_at) {
    return res.status(400).json({ error: "O campo expires_at é obrigatório." });
  }

  try {
    // 1️⃣ Buscar conteúdo do template (mesmo que contratos.js)
    const [[template]] = await db.query(
      "SELECT conteudo FROM modelos_contrato WHERE id = ?",
      [template_id]
    );

    if (!template) {
      return res.status(404).json({ error: "Template não encontrado." });
    }

    // 2️⃣ Substituir as variáveis no conteúdo do template (mesmo que contratos.js)
    let filledContent = template.conteudo;
    if (variables && Array.isArray(variables)) {
      variables.forEach(({ variable_name, value }) => {
        const regex = new RegExp(`{{\\s*${variable_name}\\s*}}`, "g");
        filledContent = filledContent.replace(regex, value);
      });
    }

    // 3️⃣ Converter HTML para PDF (baseado na rota generate-base64)
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

    const printer = new PdfPrinter(fonts);
    const dom = new JSDOM(filledContent);
    const { document } = dom.window;

    // ⛏️ Modifica todas as <img> para ter largura/altura máximas
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      img.setAttribute("style", "max-width: 300px; max-height: 200px;");
    });

    const html = document.body.innerHTML;
    // Remove ou substitui qualquer font-family suspeita por Helvetica
    const sanitizedHtml = html
      .replace(/font-family\s*:\s*[^;"]+;?/gi, "font-family: Helvetica;")
      .replace(/font-family\s*=\s*['"][^'"]+['"]/gi, 'font-family="Helvetica"');

    const pdfContent = htmlToPdfmake(sanitizedHtml, { window: dom.window });

    const docDefinition = {
      defaultStyle: { font: "Helvetica", fontSize: 12 },
      content: [
        ...pdfContent,
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        // 🔼 Envia o PDF para o Cloudinary e usa a URL como conteudo
        const base64DataUri = `data:application/pdf;base64,${pdfBase64}`;
        const cloudUpload = await cloudinary.uploader.upload(base64DataUri, {
          folder: "onety/contratual/contratos",
          resource_type: "auto",
        });

        // 4️⃣ Criar documento no Autentique com PDF convertido
        const doc = await createDocumentAutentique(
          `Contrato ${template_id}`,
          pdfBase64,
          signatories.map(sig => ({
            name: sig.name,
            cpf: sig.cpf || null
          }))
        );

        // 5️⃣ Criar o contrato no banco (mesma estrutura do contratos.js)
        const [contractResult] = await db.query(
          `INSERT INTO contratos (
            modelos_contrato_id, 
            conteudo, 
            status, 
            criado_por, 
            pre_cliente_id, 
            expirado_em, 
            comeca_em, 
            termina_em, 
            empresa_id, 
            valor, 
            valor_recorrente, 
            autentique, 
            autentique_id,
            produtos_dados,
            categoria_id,
            subcategoria_id,
            centro_custo_id,
            conta_api_id
          ) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            template_id, 
            cloudUpload.secure_url, 
            createdBy, 
            client_id, 
            expires_at, 
            start_at, 
            end_at, 
            empresa_id, 
            valor || null, 
            valor_recorrente || null, 
            1, 
            doc.id,
            (produtos_dados && Array.isArray(produtos_dados) && produtos_dados.length > 0) ? JSON.stringify(produtos_dados) : (Array.isArray(produtos_dados) ? '[]' : null),
            categoria_id || null,
            sub_categoria_id || null, // Recebe sub_categoria_id do body e salva como subcategoria_id na tabela
            centro_de_custo_id || null,
            conta_api_id || null
          ]
        );

        const contract_id = contractResult.insertId;

        // 6️⃣ Adicionar múltiplos signatários (mesma estrutura do contratos.js)
        for (const signatory of signatories) {
          const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
          const token_acesso = crypto.randomBytes(32).toString("hex");
          // Trata string vazia e undefined como null
          const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

          await db.query(
            "INSERT INTO signatarios (contrato_id, nome, email, cpf, data_nascimento, token_acesso, telefone, empresa_id, funcao_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [contract_id, name, email, cpf, birthDateToSave, token_acesso, telefone, empresa_id, funcao_assinatura]
          );
        }

        // 7️⃣ Salvar signatários do Autentique no banco
        const validSignatures = doc.signatures.filter(sig => sig.action);
        for (let i = 0; i < validSignatures.length; i++) {
          const sig = validSignatures[i];
          const inputData = signatories[i];

          await db.query(
            `UPDATE signatarios SET 
               public_id = ?, 
               token_acesso = ? 
             WHERE contrato_id = ? AND email = ?`,
            [
              sig.public_id,
              sig.link?.short_link || null,
              contract_id,
              inputData.email
            ]
          );
        }

        res.status(201).json({
          message: "✅ Contrato criado, convertido para PDF e enviado para Autentique",
          contract_id,
          autentique_id: doc.id,
          expires_at: expires_at
        });

      } catch (err) {
        console.error("❌ Erro ao processar PDF ou criar contrato:", err);
        res.status(500).json({ error: "Erro ao processar contrato HTML" });
      }
    });

    pdfDoc.end();

  } catch (error) {
    console.error("❌ Erro ao criar contrato HTML:", error);
    res.status(500).json({ error: "Erro ao criar contrato HTML." });
  }
});

/**
 * 📌 2️⃣ Rota para PDF direto (mantém a funcionalidade existente)
 */
// Aceita JSON (content base64) ou multipart (arquivo PDF em req.file)
router.post("/", verifyToken, upload.single("arquivo"), async (req, res) => {
  try {
    const {
      name,
      content,
      signatories: signatoriesRaw,
      empresa_id,
      created_by,
      valor,
      valor_recorrente,
      client_id,
      start_at,
      end_at,
      expires_at,
      produtos_dados,
      // Dados financeiros (Straton)
      categoria_id,
      sub_categoria_id,
      centro_de_custo_id,
      conta_api_id,
      vendedor_id
    } = req.body;

    // signatories pode vir como string JSON quando multipart
    const signatories = typeof signatoriesRaw === "string" ? JSON.parse(signatoriesRaw) : (signatoriesRaw || []);

    // Se vier arquivo PDF via multipart, converte para base64 data-less
    let pdfBase64 = content;
    if (!pdfBase64 && req.file) {
      pdfBase64 = req.file.buffer.toString("base64");
    }

    // 🔼 Envia o PDF ao Cloudinary para termos uma URL pública
    if (!pdfBase64 && !req.file) {
      return res.status(400).json({ error: "Arquivo PDF ou conteúdo base64 é obrigatório." });
    }
    const dataUri = pdfBase64 ? `data:application/pdf;base64,${pdfBase64}` : `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const cloudUpload = await cloudinary.uploader.upload(dataUri, {
      folder: "onety/contratual/contratos",
      resource_type: "auto",
    });

    // 1️⃣ Cria documento no Autentique
    const doc = await createDocumentAutentique(
      name,
      pdfBase64 || req.file.buffer.toString("base64"),
      signatories.map(sig => ({
        name: sig.name,
        cpf: sig.cpf || null
      }))
    );

    // 2️⃣ Salva contrato no banco
    const [contractResult] = await db.query(
      `INSERT INTO contratos (
         autentique, 
         autentique_id, 
         status, 
         conteudo, 
         empresa_id, 
         pre_cliente_id,
         valor,
         valor_recorrente,
         criado_em,
         criado_por,
         comeca_em,
         termina_em,
         expirado_em,
         produtos_dados,
         categoria_id,
         subcategoria_id,
         centro_custo_id,
         conta_api_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,                          // autentique
        doc.id,                    // autentique_id
        "pendente",                // status
        cloudUpload.secure_url,    // conteudo (URL do Cloudinary)
        empresa_id,                // empresa_id
        client_id,                 // pre_cliente_id
        valor || null,             // valor
        valor_recorrente || null,  // valor_recorrente
        (created_by || req.user?.id || null), // criado_por
        start_at || null,          // comeca_em
        end_at || null,            // termina_em
        expires_at || null,        // expirado_em
        (produtos_dados && Array.isArray(produtos_dados) && produtos_dados.length > 0) ? JSON.stringify(produtos_dados) : (Array.isArray(produtos_dados) ? '[]' : null),
        categoria_id || null,
        sub_categoria_id || null, // Recebe sub_categoria_id mas salva como subcategoria_id na tabela
        centro_de_custo_id || null,
        conta_api_id || null
      ]
    );

    const contractId = contractResult.insertId;

    // 3️⃣ Filtra os signatários válidos
    const validSignatures = doc.signatures.filter(sig => sig.action);

    // 4️⃣ Salva os signatários no banco (com empresa_id)
    for (let i = 0; i < validSignatures.length; i++) {
      const sig = validSignatures[i];
      const inputData = signatories[i];

      await db.query(
        `INSERT INTO signatarios (
           contrato_id, 
           nome, 
           email, 
           public_id, 
           token_acesso, 
           cpf, 
           telefone,
           empresa_id,
           funcao_assinatura
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contractId,
          sig.name || "",
          inputData.email || "",
          sig.public_id,
          sig.link?.short_link || null,
          inputData.cpf || null,
          inputData.phone || null,
          empresa_id || null,
          inputData.funcao_assinatura || null
        ]
      );
    }

    res.json({
      message: "✅ Contrato PDF criado e salvo com datas",
      autentique_id: doc.id,
      contract_id: contractId
    });

  } catch (err) {
    console.error("❌ Erro ao criar contrato PDF:", err);
    res.status(500).json({ error: "Erro ao criar contrato PDF" });
  }
});


// POST /contratos-autentique/webhook-dados-assinatura
router.post("/webhook-dados-assinatura", async (req, res) => {
  const { event } = req.body;

  console.log("🔔 Webhook recebido:", {
    eventType: event.type,
    autentiqueId: event.data.document,
    cpf: event.data.cpf,
    user: event.data.user,
  });

  const eventType = event.type;
  const eventData = event.data;

  const autentiqueId = eventData.document; // ID do documento no Autentique
  const isRejection = eventType === "signature.rejected";

  // Campos que só fazem sentido para assinatura
  const ip = eventData.events?.find((e) => e.type === "signed")?.ip || null;
  const userAgent = req.headers["user-agent"] || "Autentique Webhook";
  const signedAt = new Date(eventData.signed || new Date());

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Encontrar alvo (contrato OU documento) pelo autentique_id
    let scope = { table: "contratos", fk: "contrato_id", id: null };

    const [[c]] = await connection.query(
      `SELECT id FROM contratos WHERE autentique_id = ?`,
      [autentiqueId]
    );

    console.log("🔍 Busca contrato:", { 
      autentiqueId, 
      contratosFound: !!c, 
      contratoId: c?.id 
    });

    if (c) {
      scope.id = c.id;
    } else {
      // Debug: verificar se existe algum contrato com autentique_id similar
      const [debugContratos] = await connection.query(
        `SELECT id, autentique_id FROM contratos WHERE autentique_id LIKE ? OR autentique_id LIKE ?`,
        [`%${autentiqueId.substring(0, 10)}%`, `%${autentiqueId.substring(-10)}%`]
      );
      console.log("🔍 Debug - Contratos similares:", debugContratos);
      const [[d]] = await connection.query(
        `SELECT id FROM documentos WHERE autentique_id = ?`,
        [autentiqueId]
      );
      if (!d) {
        await connection.rollback();
        return res
          .status(404)
          .json({ error: "Contrato/Documento não encontrado no sistema." });
      }
      scope = { table: "documentos", fk: "documento_id", id: d.id };
    }

    const recordId = scope.id;
    console.log("📋 Alvo encontrado:", { table: scope.table, id: recordId });

    // --- CASO: REJEIÇÃO (não mexe em signatures) ---
    if (isRejection) {
      const cpfRaw = eventData.user?.cpf || eventData.cpf;
      let signatoryId = null;

      if (cpfRaw) {
        // busca direta
        let [[signatory]] = await connection.query(
          `SELECT id FROM signatarios WHERE ${scope.fk} = ? AND cpf = ?`,
          [recordId, cpfRaw]
        );

        // busca sem formatação
        if (!signatory) {
          const cpfOnlyNumbers = String(cpfRaw).replace(/\D/g, "");
          [[signatory]] = await connection.query(
            `SELECT id FROM signatarios 
             WHERE ${scope.fk} = ? 
               AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [recordId, cpfOnlyNumbers]
          );
        }

        if (signatory) signatoryId = signatory.id;
      }

      await connection.query(
        `UPDATE ${scope.table} SET status = 'reprovado', rejected_by = ? WHERE id = ?`,
        [signatoryId, recordId]
      );

      // 🔗 Se for contrato, atualizar o lead relacionado para fase "Perdeu" e status 'perdeu'
      if (scope.table === 'contratos') {
        // Busca pre_cliente_id do contrato → lead_id do cliente → funil do lead → fase "Perdeu"
        const [[contrato]] = await connection.query(
          `SELECT pre_cliente_id FROM contratos WHERE id = ?`,
          [recordId]
        );
        if (contrato?.pre_cliente_id) {
          const [[cliente]] = await connection.query(
            `SELECT lead_id FROM pre_clientes WHERE id = ?`,
            [contrato.pre_cliente_id]
          );
          if (cliente?.lead_id) {
            const [[lead]] = await connection.query(
              `SELECT id, funil_id FROM leads WHERE id = ?`,
              [cliente.lead_id]
            );
            if (lead?.funil_id) {
              const [[fasePerdeu]] = await connection.query(
                `SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Perdeu'`,
                [lead.funil_id]
              );
              if (fasePerdeu?.id) {
                await connection.query(
                  `UPDATE leads SET funil_fase_id = ?, status = 'perdeu' WHERE id = ?`,
                  [fasePerdeu.id, lead.id]
                );
              } else {
                // Fallback: apenas status
                await connection.query(
                  `UPDATE leads SET status = 'perdeu' WHERE id = ?`,
                  [lead.id]
                );
              }
            }
          }
        }
      }

      await connection.commit();
      return res.status(200).json({
        message: `Evento ${eventType} processado (rejeição sem inserir em assinaturas).`,
      });
    }

    // --- CASO: ASSINATURA ---
    const cpf = eventData.user?.cpf || eventData.cpf;
    if (!cpf) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "CPF do signatário é obrigatório para registrar assinatura." });
    }

    // 2) Buscar signatário (com busca flexível)
    let [[signatory]] = await connection.query(
      `SELECT id FROM signatarios WHERE ${scope.fk} = ? AND cpf = ?`,
      [recordId, cpf]
    );

    if (!signatory) {
      const cpfOnlyNumbers = String(cpf).replace(/\D/g, "");
      [[signatory]] = await connection.query(
        `SELECT id FROM signatarios 
         WHERE ${scope.fk} = ? 
           AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
        [recordId, cpfOnlyNumbers]
      );
    }

    console.log("🔍 Busca signatário:", {
      target: scope.table,
      id: recordId,
      cpf,
      signatoryFound: !!signatory,
    });

    if (!signatory) {
      const [allSignatories] = await connection.query(
        `SELECT id, nome, email, cpf FROM signatarios WHERE ${scope.fk} = ?`,
        [recordId]
      );

      console.log("🔍 Debug - Todos os signatários do alvo:", allSignatories);
      console.log("🔍 Debug - CPF procurado:", cpf);

      await connection.rollback();
      return res.status(404).json({
        error: "Signatário não encontrado.",
        debug: { target: scope.table, id: recordId, cpf, availableSignatories: allSignatories },
      });
    }

    const signatoryId = signatory.id;

    // Evitar duplicidade
    const [[existingSignature]] = await connection.query(
      `SELECT id FROM assinaturas WHERE ${scope.fk} = ? AND signatario_id = ?`,
      [recordId, signatoryId]
    );
    if (existingSignature) {
      await connection.rollback();
      return res.status(200).json({ message: "Assinatura já registrada." });
    }

    // Inserir assinatura
    const hashBase = `${cpf}-${recordId}-${ip}`;
    const hash = crypto.createHash("sha256").update(hashBase).digest("hex");

    await connection.query(
      `INSERT INTO assinaturas (${scope.fk}, signatario_id, cpf, assinado_em, endereco_ip, navegador_usuario, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recordId, signatoryId, cpf, signedAt, ip, userAgent, hash]
    );

    await connection.query(
      `UPDATE signatarios SET assinado_em = ? WHERE id = ?`,
      [signedAt, signatoryId]
    );

    // Se todos assinaram, marca como assinado
    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) as total FROM signatarios WHERE ${scope.fk} = ?`,
      [recordId]
    );
    const [[{ assinados }]] = await connection.query(
      `SELECT COUNT(*) as assinados FROM signatarios WHERE ${scope.fk} = ? AND assinado_em IS NOT NULL`,
      [recordId]
    );
    
    let contratoCompletamenteAssinado = false;
    if (assinados === total) {
      // Se for tabela contratos, atualiza também a data_assinatura
      if (scope.table === 'contratos') {
        await connection.query(
          `UPDATE ${scope.table} SET status = 'assinado', data_assinatura = NOW() WHERE id = ?`,
          [recordId]
        );
      } else {
        await connection.query(
          `UPDATE ${scope.table} SET status = 'assinado' WHERE id = ?`,
          [recordId]
        );
      }
      contratoCompletamenteAssinado = true;
    }

    // 🎯 CONVERTER PRE_CLIENTE EM CLIENTE E ATUALIZAR CONTRATO
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      const [[contrato]] = await connection.query(
        `SELECT pre_cliente_id, cliente_id FROM contratos WHERE id = ?`,
        [recordId]
      );

      if (contrato?.pre_cliente_id && !contrato.cliente_id) {
        console.log("🔄 Convertendo pre_cliente para cliente...");
        const clienteId = await converterPreClienteParaCliente(contrato.pre_cliente_id, connection);
        
        if (clienteId) {
          await connection.query(
            `UPDATE contratos SET cliente_id = ? WHERE id = ?`,
            [clienteId, recordId]
          );
          console.log("✅ Contrato atualizado com cliente_id:", clienteId);
        }
      }
    }

    // 🎯 CRIAR VENDAS BASEADAS EM PRODUTOS_DADOS SE STRATON = 1
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      await criarVendasDeProdutosDados(recordId, connection);
    }

    // 🎯 CADASTRAR FUNCIONÁRIO APÓS ASSINATURA COMPLETA
    if (contratoCompletamenteAssinado && (scope.table === 'contratos' || scope.table === 'documentos')) {
      await cadastrarFuncionarioAposAssinatura(recordId, connection, scope.table);
    }

    // 🔗 Se for contrato completamente assinado, atualizar lead: fase "Ganhou" e status 'ganhou'
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      const [[contrato]] = await connection.query(
        `SELECT pre_cliente_id FROM contratos WHERE id = ?`,
        [recordId]
      );
      if (contrato?.pre_cliente_id) {
        const [[cliente]] = await connection.query(
          `SELECT lead_id FROM pre_clientes WHERE id = ?`,
          [contrato.pre_cliente_id]
        );
        if (cliente?.lead_id) {
          const [[lead]] = await connection.query(
            `SELECT id, funil_id FROM leads WHERE id = ?`,
            [cliente.lead_id]
          );
          if (lead?.funil_id) {
            const [[faseGanhou]] = await connection.query(
              `SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Ganhou'`,
              [lead.funil_id]
            );
            if (faseGanhou?.id) {
              await connection.query(
                `UPDATE leads SET funil_fase_id = ?, status = 'ganhou' WHERE id = ?`,
                [faseGanhou.id, lead.id]
              );
            } else {
              // Fallback: apenas status
              await connection.query(
                `UPDATE leads SET status = 'ganhou' WHERE id = ?`,
                [lead.id]
              );
            }
          }
        }
      }
    }

    await connection.commit();
    
    // 🔔 Notificação in-app: contrato/documento completamente assinado
    if (contratoCompletamenteAssinado) {
      try {
        const [[meta]] = await db.query(
          scope.table === 'contratos'
            ? `SELECT empresa_id, criado_por AS created_by FROM contratos WHERE id = ?`
            : `SELECT empresa_id, criado_por AS created_by FROM documentos WHERE id = ?`,
          [recordId]
        );
        const userId = meta?.created_by || null;
        const empresaId = meta?.empresa_id || null;
        
        if (userId) {
          const title = scope.table === 'contratos' ? 'Contrato assinado' : 'Documento assinado';
          const body = `${title} #${recordId}`;
          const dataJson = JSON.stringify({ 
            tipo: scope.table, 
            id: recordId,
            recordId: Number(recordId)
          });
          
          // Inserir notificação no banco
          await db.query(
            `INSERT INTO user_notifications
             (user_id, empresa_id, module, type, title, body, data_json, entity_type, entity_id, created_by)
             VALUES
             (?, ?, 'contratual', ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId, 
              empresaId, 
              scope.table === 'contratos' ? 'contract.signed' : 'document.signed', 
              title, 
              body, 
              dataJson, 
              scope.table.slice(0, -1), 
              recordId, 
              userId
            ]
          );
          
          // Emitir via WebSocket para notificação em tempo real
          try {
            webSocketManager.emitToUser(userId, 'notification:new', {
              module: 'contratual',
              type: scope.table === 'contratos' ? 'contract.signed' : 'document.signed',
              title,
              body,
              created_at: new Date().toISOString()
            });
          } catch (wsError) {
            console.warn('⚠️ Erro ao emitir notificação via WebSocket:', wsError?.message || wsError);
          }
        }
      } catch (e) {
        console.warn('⚠️ Falha ao notificar contrato/documento assinado:', e?.message || e);
      }
    }

    // Se o contrato foi completamente assinado, enviar notificações por email
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      try {
        console.log("📧 Contrato completamente assinado, enviando notificações...");
        
        // Fazer requisição para a rota de notificação
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        const notificationResponse = await fetch(`${baseUrl}/contratos/${recordId}/notificar-assinatura`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (notificationResponse.ok) {
          const notificationResult = await notificationResponse.json();
          console.log("✅ Notificações enviadas com sucesso:", notificationResult.detalhes);
        } else {
          console.error("❌ Erro ao enviar notificações:", await notificationResponse.text());
        }
      } catch (emailError) {
        console.error("❌ Erro ao processar notificações por email:", emailError);
        // Não falha o webhook por erro de email
      }
    }

    return res.status(200).json({ message: `Evento ${eventType} processado com sucesso.` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro no webhook de assinatura:", error);
    return res.status(500).json({ error: "Erro ao processar webhook." });
  } finally {
    if (connection) connection.release();
  }
});



/**
 * 📌 3️⃣ Consultar status do contrato no Autentique
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const doc = await getDocumentAutentique(req.params.id);

    // Calcula status do contrato
    const total = doc.signatures?.length || 0;
    const assinadas = doc.signatures?.filter(s => s.action?.name === "SIGN" && s.link === null)?.length || 0;
    // Aqui, "rejeitado" pode ser detectado por action=null ou ausência de link dependendo do Autentique
    const rejeitadas = doc.signatures?.filter(s => !s.action && !s.link)?.length || 0;

    let statusGeral = "pendente";
    if (rejeitadas > 0) statusGeral = "rejeitado";
    else if (total > 0 && assinadas === total) statusGeral = "assinado";

    res.json({
      ...doc,
      status: statusGeral
    });
  } catch (err) {
    console.error("❌ Erro ao buscar contrato no Autentique:", err);
    res.status(500).json({ error: "Erro ao buscar contrato no Autentique" });
  }
});


// DELETE /contratos-autentique/:contractId
router.delete("/:contractId", verifyToken, async (req, res) => {
  const contractId = req.params.contractId;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Busca contrato local
    const [[contract]] = await connection.query(
      `SELECT id, autentique_id FROM contratos WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const autentiqueId = contract.autentique_id;
    
    // 1.5) Deletar registros relacionados ANTES do contrato (respeitar foreign keys)
    // Ordem: assinaturas -> signatarios -> contratos
    await connection.query(`DELETE FROM assinaturas WHERE contrato_id = ?`, [contractId]);
    await connection.query(`DELETE FROM signatarios WHERE contrato_id = ?`, [contractId]);
    
    if (!autentiqueId) {
      // Se não houver autentique_id, só remove local
      await connection.query(`DELETE FROM contratos WHERE id = ?`, [contractId]);
      await connection.commit();
      return res.status(200).json({ message: "Contrato removido localmente (sem autentique_id)." });
    }

    // 2) Remove no Autentique (doc: deleteDocument)
    // Obs: se tiver assinaturas, o Autentique "move para lixeira" em vez de deletar de vez.
    // Isso é o comportamento esperado da API.
    await deleteDocumentAutentique(autentiqueId);

    // 3) Remove/arquiva localmente (escolha: delete físico ou soft delete)
    // a) Delete físico:
    await connection.query(`DELETE FROM contratos WHERE id = ?`, [contractId]);

    // b) (alternativa) Soft delete:
    // await connection.query(`UPDATE contratos SET status = 'deletado', deleted_at = NOW() WHERE id = ?`, [contractId]);

    await connection.commit();

    return res.status(200).json({
      message: "Contrato excluído no Autentique e removido do sistema.",
      autentique_id: autentiqueId,
      contract_id: contractId
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("❌ Erro ao excluir contrato:", err);
    return res.status(500).json({ error: "Erro ao excluir contrato." });
  } finally {
    if (connection) connection.release();
  }
});


/**
 * 4️⃣ Listar URLs de download do Autentique (original/signed/certificado)
 * GET /contratos-autentique/:id/files
 */
router.get("/:id/files", verifyToken, async (req, res) => {
  try {
    const doc = await getDocumentFiles(req.params.id);
    const files = { ...(doc.files || {}) };

    // ✅ Mantém pades intacto e cria o alias certificado baseado no pades
    const certificado = files.pades ? fixPadesUrl(files.pades) : null;

    return res.json({
      id: doc.id,
      name: doc.name,
      files: { ...files, certificado }, // agora temos: original, signed, pades e certificado
    });
  } catch (err) {
    console.error("❌ Erro ao obter URLs do documento:", err);
    return res.status(500).json({ error: "Erro ao obter URLs do documento." });
  }
});




/**
 * 5️⃣ Baixar o PDF (stream) diretamente
 * GET /contratos-autentique/:id/download?type=signed|original|pades
 * - default: signed
 */
router.get("/:id/download", verifyToken, async (req, res) => {
  try {
    const type = String(req.query.type || "signed").toLowerCase();

    // ✅ agora aceita "certificado" também
    if (!["signed", "original", "pades", "certificado"].includes(type)) {
      return res.status(400).json({ error: "Parâmetro 'type' inválido. Use signed|original|pades|certificado." });
    }

    const doc = await getDocumentFiles(req.params.id);

    // ✅ escolhe a URL correta
    let url;
    if (type === "certificado") {
      url = doc?.files?.pades ? fixPadesUrl(doc.files.pades) : null; // usa o pades→certificado
    } else {
      url = doc?.files?.[type]; // signed | original | pades (como veio)
    }

    if (!url) {
      return res.status(404).json({ error: `Arquivo '${type}' indisponível para este documento.` });
    }

    const safeName = (doc.name || "documento").replace(/[^\w\-]+/g, "_");
    const suffix = type; // certificado => "certificado"; pades => "pades"; etc.

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${suffix}.pdf"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    // 🔽 stream com axios
    const upstream = await axios.get(url, {
      responseType: "stream",
      headers: {
        Accept: "application/pdf",
        ...(process.env.AUTENTIQUE_TOKEN ? { Authorization: `Bearer ${process.env.AUTENTIQUE_TOKEN}` } : {}),
        "User-Agent": "Contabhub/1.0",
      },
      maxRedirects: 10,
      validateStatus: () => true,
    });

    if (upstream.status !== 200) {
      return res.status(upstream.status).json({ error: `Falha ao baixar '${suffix}' (${upstream.status}).` });
    }

    upstream.data.pipe(res);
  } catch (err) {
    console.error("❌ Erro no download do PDF:", err);
    return res.status(500).json({ error: "Erro ao baixar PDF." });
  }
});




module.exports = router;
