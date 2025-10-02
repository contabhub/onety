const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");
const multer = require("multer");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { normalizePhone } = require("../utils/contactHelper");

// Configuração do multer para upload em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV, XLS e XLSX são permitidos'), false);
    }
  }
});

/**
 * 📌 Criar contato
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { nome, email, telefone, notas_internas, company_id } = req.body;

    if (!nome || !company_id) {
      return res.status(400).json({ error: "Nome e company_id são obrigatórios." });
    }

    const [result] = await pool.query(`
      INSERT INTO contacts (nome, email, telefone, notas_internas, company_id)
      VALUES (?, ?, ?, ?, ?)`,
      [nome, email || null, telefone || null, JSON.stringify(notas_internas || []), company_id]
    );

    res.status(201).json({ id: result.insertId, nome, email, telefone, notas_internas, company_id });
  } catch (err) {
    console.error("Erro ao criar contato:", err);
    res.status(500).json({ error: "Erro ao criar contato." });
  }
});

/**
 * 📌 Listar todos os contatos de uma empresa
 */
router.get("/company/:companyId", authOrApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(`
      SELECT * FROM contacts WHERE company_id = ?
      ORDER BY created_at DESC`, [companyId]);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar contatos:", err);
    res.status(500).json({ error: "Erro ao buscar contatos." });
  }
});

/**
 * 📌 Buscar contato por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM contacts WHERE id = ?`, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Contato não encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar contato:", err);
    res.status(500).json({ error: "Erro ao buscar contato." });
  }
});

/**
 * 📌 Atualizar contato
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { nome, email, telefone, notas_internas } = req.body;

    await pool.query(`
      UPDATE contacts
      SET nome = ?, email = ?, telefone = ?, notas_internas = ?, updated_at = NOW()
      WHERE id = ?`,
      [nome, email || null, telefone || null, JSON.stringify(notas_internas || []), req.params.id]
    );

    // Buscar o contato atualizado para retornar
    const [rows] = await pool.query(`SELECT * FROM contacts WHERE id = ?`, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Contato não encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao atualizar contato:", err);
    res.status(500).json({ error: "Erro ao atualizar contato." });
  }
});

/**
 * 📌 Deletar contato
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query(`DELETE FROM contacts WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar contato:", err);
    res.status(500).json({ error: "Erro ao deletar contato." });
  }
});

/**
 * 📌 Preview de arquivo para importação
 */
router.post("/import/preview", authOrApiKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const companyId = req.headers['company-id'] || req.body.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID é obrigatório." });
    }

    const results = await parseFileData(req.file);
    
    // Validar dados
    const validationResult = validateContactsData(results, companyId);
    
    res.json({
      totalRows: results.length,
      validRows: validationResult.validRows,
      errors: validationResult.errors,
      preview: validationResult.validRows.slice(0, 10) // Preview dos primeiros 10
    });

  } catch (err) {
    console.error("Erro ao fazer preview do arquivo:", err);
    res.status(500).json({ error: "Erro ao processar arquivo." });
  }
});

/**
 * 📌 Importar contatos de arquivo
 */
router.post("/import", authOrApiKey, upload.single('file'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const companyId = req.headers['company-id'] || req.body.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "Company ID é obrigatório." });
    }

    await connection.beginTransaction();

    const results = await parseFileData(req.file);
    const validationResult = validateContactsData(results, companyId);
    
    let imported = 0;
    let errors = 0;
    let skipped = 0;

    // Importar apenas os contatos válidos
    for (const contact of validationResult.validRows) {
      try {
        // Verificar se já existe contato com o mesmo telefone
        const [existing] = await connection.query(
          `SELECT id FROM contacts WHERE telefone = ? AND company_id = ?`,
          [contact.telefone, companyId]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Inserir novo contato
        await connection.query(`
          INSERT INTO contacts (nome, email, telefone, notas_internas, company_id)
          VALUES (?, ?, ?, ?, ?)`,
          [
            contact.nome,
            contact.email || null,
            contact.telefone || null,
            JSON.stringify([]),
            companyId
          ]
        );

        imported++;
      } catch (insertError) {
        console.error("Erro ao inserir contato:", insertError);
        errors++;
      }
    }

    await connection.commit();

    res.json({
      imported,
      errors,
      skipped,
      total: results.length,
      validRows: validationResult.validRows.length,
      invalidRows: validationResult.errors.length
    });

  } catch (err) {
    await connection.rollback();
    console.error("Erro ao importar contatos:", err);
    res.status(500).json({ error: "Erro ao importar contatos." });
  } finally {
    connection.release();
  }
});

/**
 * 📌 Função para processar dados do arquivo
 */
async function parseFileData(file) {
  const results = [];
  const fileExtension = file.originalname.toLowerCase().split('.').pop();

  if (fileExtension === 'csv') {
    // Processar CSV
    const csvData = file.buffer.toString('utf8');
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      results.push(row);
    }
  } else if (['xls', 'xlsx'].includes(fileExtension)) {
    // Processar Excel
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    results.push(...jsonData);
  }

  return results;
}

/**
 * 📌 Função para validar dados dos contatos
 */
function validateContactsData(data, companyId) {
  const validRows = [];
  const errors = [];

  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const errorsForRow = [];

    // Normalizar nomes das colunas (case insensitive)
    const normalizedRow = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase()] = row[key];
    });

    // Extrair dados (suportar diferentes nomes de coluna)
    const nome = normalizedRow.nome || normalizedRow.name || normalizedRow['nome completo'];
    const email = normalizedRow.email || normalizedRow.e_mail || normalizedRow.mail;
    const telefone = normalizedRow.telefone || normalizedRow.phone || normalizedRow.telefone || normalizedRow.celular;

    // Validar nome
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      errorsForRow.push(`Nome inválido ou muito curto`);
    }

    // Validar email (se fornecido)
    if (email && typeof email === 'string' && !isValidEmail(email)) {
      errorsForRow.push(`Email inválido: ${email}`);
    }

    // Validar telefone (se fornecido)
    let normalizedPhone = null;
    if (telefone) {
      normalizedPhone = normalizePhone(telefone);
      if (normalizedPhone.length < 10) {
        errorsForRow.push(`Telefone inválido: ${telefone}`);
      }
    }

    if (errorsForRow.length > 0) {
      errors.push(`Linha ${rowNumber}: ${errorsForRow.join(', ')}`);
    } else {
      validRows.push({
        nome: nome.trim(),
        email: email && typeof email === 'string' ? email.trim() : null,
        telefone: normalizedPhone
      });
    }
  });

  return { validRows, errors };
}

/**
 * 📌 Função para validar email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Rota para exportar contatos em diferentes formatos
router.get("/export/:format", authOrApiKey, async (req, res) => {
  try {
    const { format } = req.params;
    
    // Obter companyId do header ou do token
    const companyId = req.headers['company-id'] || (req.user && req.user.companyId) || (req.apiKey && req.apiKey.companyId);
    
    if (!companyId) {
      return res.status(400).json({ error: "Company ID é obrigatório" });
    }

    // Buscar contatos da empresa - usando a tabela correta 'contacts'
    const query = `
      SELECT 
        c.id,
        c.nome,
        c.email,
        c.telefone,
        c.created_at,
        c.updated_at
      FROM contacts c
      WHERE c.company_id = ?
      ORDER BY c.nome
    `;

    const [contatos] = await pool.execute(query, [companyId]);

    if (format === "csv") {
      await exportToCSV(contatos, res);
    } else if (format === "xls") {
      await exportToExcel(contatos, res);
    } else if (format === "pdf") {
      await exportToPDF(contatos, res);
    } else {
      return res.status(400).json({ error: "Formato não suportado. Use: csv, xls ou pdf" });
    }

  } catch (error) {
    console.error("Erro ao exportar contatos:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Função para exportar para CSV
async function exportToCSV(contatos, res) {
  const headers = [
    "ID",
    "Nome",
    "Email",
    "Telefone",
    "Data de Criação",
    "Última Atualização"
  ];

  let csvContent = headers.join(",") + "\n";

  contatos.forEach(contato => {
    const row = [
      contato.id,
      `"${contato.nome || ""}"`,
      `"${contato.email || ""}"`,
      `"${contato.telefone || ""}"`,
      `"${contato.created_at || ""}"`,
      `"${contato.updated_at || ""}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="contatos_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csvContent);
}

// Função para exportar para Excel
async function exportToExcel(contatos, res) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contatos");

  // Configurar cabeçalhos
  worksheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Nome", key: "nome", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Telefone", key: "telefone", width: 20 },
    { header: "Data de Criação", key: "created_at", width: 20 },
    { header: "Última Atualização", key: "updated_at", width: 20 }
  ];

  // Estilizar cabeçalhos
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE6F3FF" }
  };

  // Adicionar dados
  contatos.forEach(contato => {
    worksheet.addRow({
      id: contato.id,
      nome: contato.nome || "",
      email: contato.email || "",
      telefone: contato.telefone || "",
      created_at: contato.created_at ? new Date(contato.created_at).toLocaleDateString("pt-BR") : "",
      updated_at: contato.updated_at ? new Date(contato.updated_at).toLocaleDateString("pt-BR") : ""
    });
  });

  // Aplicar bordas
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="contatos_${new Date().toISOString().split('T')[0]}.xlsx"`);
  
  await workbook.xlsx.write(res);
  res.end();
}

// Função para exportar para PDF
async function exportToPDF(contatos, res) {
  const doc = new PDFDocument();
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="contatos_${new Date().toISOString().split('T')[0]}.pdf"`);
  
  doc.pipe(res);

  // Título
  doc.fontSize(20).text("Relatório de Contatos", { align: "center" });
  doc.moveDown();

  // Informações do relatório
  doc.fontSize(12)
     .text(`Total de contatos: ${contatos.length}`, { align: "left" })
     .text(`Data de geração: ${new Date().toLocaleDateString("pt-BR")}`, { align: "left" });
  doc.moveDown(2);

  // Cabeçalhos da tabela
  const tableTop = doc.y;
  const itemHeight = 20;
  const pageHeight = doc.page.height;
  let currentY = tableTop;

  // Função para adicionar nova página se necessário
  function checkPageBreak(height) {
    if (currentY + height > pageHeight - 50) {
      doc.addPage();
      currentY = 50;
      return true;
    }
    return false;
  }

  // Cabeçalhos
  checkPageBreak(itemHeight);
  doc.fontSize(10)
     .text("Nome", 50, currentY, { width: 150 })
     .text("Email", 210, currentY, { width: 180 })
     .text("Telefone", 400, currentY, { width: 120 });
  
  currentY += itemHeight;

  // Linha separadora
  doc.moveTo(50, currentY).lineTo(520, currentY).stroke();
  currentY += 5;

  // Dados dos contatos
  contatos.forEach((contato, index) => {
    checkPageBreak(itemHeight + 10);
    
    doc.fontSize(9)
       .text(contato.nome || "", 50, currentY, { width: 150, ellipsis: true })
       .text(contato.email || "", 210, currentY, { width: 180, ellipsis: true })
       .text(contato.telefone || "", 400, currentY, { width: 120 });
    
    currentY += itemHeight + 5;
    
    // Linha separadora entre registros
    if (index < contatos.length - 1) {
      doc.strokeColor("#CCCCCC")
         .moveTo(50, currentY)
         .lineTo(520, currentY)
         .stroke();
      currentY += 5;
    }
  });

  // Rodapé
  doc.fontSize(8)
     .fillColor("gray")
     .text(`Página ${doc.bufferedPageRange().start + 1}`, 50, pageHeight - 30);

  doc.end();
}

module.exports = router;