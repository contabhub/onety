const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
/**
 * 📌 Função para extrair texto do relatório PDF
 */
async function extrairDadosRelatorio(protocoloRelatorio) {
    try {
        // Gerar o hash do nome do arquivo
        const fileHash = crypto.createHash('sha256').update(protocoloRelatorio).digest('hex');
        const filePath = path.join(__dirname, `../../storage/relatorios/relatorio_${fileHash}.pdf`);

        if (!fs.existsSync(filePath)) {
            throw new Error("Relatório não encontrado.");
        }

        console.log(`📖 Lendo PDF: ${filePath}`);

        const pdfBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(pdfBuffer);

        console.log("📄 Texto extraído com sucesso!");

        return { texto: data.text };
    } catch (error) {
        console.error("❌ Erro ao extrair dados do relatório:", error.message);
        throw new Error("Falha ao extrair dados do relatório.");
    }
}

module.exports = { extrairDadosRelatorio };