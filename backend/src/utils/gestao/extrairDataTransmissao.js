const { parseStringPromise } = require("xml2js");

async function extrairDataTransmissao(xmlBase64) {
  try {
    const xml = Buffer.from(xmlBase64, "base64").toString("utf-8");
    const json = await parseStringPromise(xml, { explicitArray: false });

    const data = json?.["ProcDctf"]?.["OutrasInformacoes"]?.["dataHoraTransmissao"];
    if (!data) return null;

    return `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)} ${data.slice(8, 10)}:${data.slice(10, 12)}:${data.slice(12, 14)}`;
  } catch (err) {
    console.error("Erro ao extrair dataHoraTransmissao:", err);
    return null;
  }
}

module.exports = { extrairDataTransmissao };
