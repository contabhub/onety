"use client";

import React from "react";
import * as XLSX from "xlsx";

const CAMPOS = [
  { chave: "EMPRESAS", descricao: "Nome do cliente/empresa (obrigatório)" },
  { chave: "CODIGO", descricao: "Código interno do cliente (opcional)" },
  { chave: "CNPJ/CPF", descricao: "Documento (com ou sem máscara) (obrigatório)" },
  { chave: "TRIBUTAÇÃO", descricao: "Regime tributário (ex.: Simples Nacional)" },
  { chave: "TELEFONE", descricao: "Telefone principal (opcional)" },
  { chave: "EMAIL", descricao: "Email (opcional)" },
  { chave: "CEP", descricao: "CEP (opcional - preenche endereço automaticamente)" },
  { chave: "DATAINICIO", descricao: "Data de início (YYYY-MM-DD) (opcional)" },
  { chave: "TIPOINSCRICAO", descricao: "CNPJ ou CPF (deixe em branco para auto-detectar)" },
  { chave: "ENDERECO", descricao: "Endereço/rua (opcional - preenchido automaticamente pelo CEP)" },
  { chave: "BAIRRO", descricao: "Bairro (opcional - preenchido automaticamente pelo CEP)" },
  { chave: "CIDADE", descricao: "Cidade (opcional - preenchido automaticamente pelo CEP)" },
  { chave: "ESTADO", descricao: "Estado/UF (opcional - preenchido automaticamente pelo CEP)" },
];

export default function ClientesImportTemplateModal({ open, onClose, onSelectFile }) {
  if (!open) return null;

  const baixarModeloXLSX = () => {
    const headerRow = CAMPOS.map(c => c.chave);
    const exampleRow = [
      "CF - Mãe (Modelo)",
      "CLI001",
      "12.345.678/0001-90",
      "Simples Nacional",
      "(11) 99999-9999",
      "contato@empresa.com",
      "01001-000",
      "2025-01-01",
      "", // tipoInscricao deixado em branco para auto-detectar
      "", // endereco - preenchido automaticamente pelo CEP
      "", // bairro - preenchido automaticamente pelo CEP
      "", // cidade - preenchido automaticamente pelo CEP
      "", // estado - preenchido automaticamente pelo CEP
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_clientes.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3000,
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",
    }}>
      <div style={{
        width: "min(900px, 70vw)",
        background: "var(--titan-base-00)",
        color: "var(--titan-text-high)",
        borderRadius: 12,
        border: "1px solid var(--titan-stroke)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: "1px solid var(--titan-stroke)" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Importar Clientes</div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "transparent", color: "var(--titan-text-high)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 12, color: "var(--titan-text-med)" }}>
            Para importar corretamente, a planilha deve conter as colunas abaixo. Você pode baixar um modelo pronto.
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gap: 8,
            alignItems: "start",
            padding: 12,
            background: "var(--titan-base-05)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: 8,
            marginBottom: 12,
          }}>
            {CAMPOS.map((c) => (
              <React.Fragment key={c.chave}>
                <div style={{ fontWeight: 600 }}>{c.chave}</div>
                <div style={{ color: "var(--titan-text-med)" }}>{c.descricao}</div>
              </React.Fragment>
            ))}
          </div>

          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--titan-text-low)", fontSize: 13 }}>
            <li>O arquivo DEVE ser .xlsx e seguir o modelo fornecido.</li>
            <li>Baixe o modelo (.xlsx) abaixo e preencha os dados nas colunas indicadas.</li>
            <li>O cabeçalho precisa conter exatamente os nomes acima (não altere).</li>
            <li>Linhas em branco serão ignoradas.</li>
            <li>Apague a linha de exemplo "CF - Mãe (Modelo)" antes de importar.</li>
            <li>Se "TIPOINSCRICAO" ficar em branco, detectamos automaticamente (14 dígitos = CNPJ, 11 dígitos = CPF).</li>
            <li>Se o documento for CNPJ válido, tentaremos preencher telefone/endereço via consulta pública.</li>
          </ul>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid var(--titan-stroke)" }}>
          <button onClick={baixarModeloXLSX} style={{
            padding: "10px 14px",
            background: "var(--titan-info-bg, rgba(46,134,222,0.15))",
            border: "1px solid var(--titan-info-border, rgba(46,134,222,0.28))",
            color: "var(--titan-info-text, #2e86de)",
            borderRadius: 8,
            cursor: "pointer",
          }}>Baixar planilha modelo (.xlsx)</button>

          <button onClick={onSelectFile} style={{
            padding: "10px 14px",
            background: "var(--titan-primary)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}>Selecionar arquivo para importar</button>
        </div>
      </div>
    </div>
  );
}


