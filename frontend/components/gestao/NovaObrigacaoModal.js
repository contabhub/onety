import React, { useState, useEffect } from "react";
import styles from "../../styles/gestao/ObrigacoesPage.module.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const u = JSON.parse(raw);
      return (
        u?.EmpresaId || u?.empresaId || u?.empresa_id || u?.companyId || u?.company_id || ""
      );
    }
  } catch {}
  return sessionStorage.getItem("empresaId") || "";
};

export default function NovaObrigacaoModal({ onClose }) {
  const [form, setForm] = useState({
    empresaId: "",
    departamentoId: "",
    nome: "",
    frequencia: "",
    diaSemana: "",
    acaoQtdDias: 0,
    acaoTipoDias: "Dias úteis",
    metaQtdDias: 0,
    metaTipoDias: "Dias úteis",
    vencimentoTipo: "Antecipar",
    vencimentoDia: 0,
    fatoGerador: "",
    orgao: "",
    aliasValidacao: "Sem Validação",
    geraMulta: false,
    usarRelatorio: false,
    reenviarEmail: false,
  });

  const [departamentos, setDepartamentos] = useState([]);
  const frequenciaFormatada = form.frequencia.trim().toLowerCase();
  const [isLight, setIsLight] = useState(false);


  useEffect(() => {
    const empresaId = getEmpresaId();
    if (empresaId) setForm((prev) => ({ ...prev, empresaId }));
    fetchDepartamentos(empresaId);
  }, []);

  // Detecta tema atual e reage a mudanças globais
  useEffect(() => {
    if (typeof document === "undefined") return;
    const getTheme = () => document.documentElement.getAttribute("data-theme") === "light";
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = (e && e.detail) || {};
      if (detail && (detail.theme === "light" || detail.theme === "dark")) {
        setIsLight(detail.theme === "light");
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener("titan-theme-change", handleChange);
    return () => window.removeEventListener("titan-theme-change", handleChange);
  }, []);

  const fetchDepartamentos = async (empresaId) => {
    if (!empresaId) return;
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDepartamentos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar departamentos:", err);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Verificação dos campos obrigatórios
    const isDiaria = form.frequencia === "Diário";
    const isSemanal = form.frequencia === "Semanal";
    const isEsporadica = form.frequencia === "Esporádica";
    
    // Campos que devem ser preenchidos apenas para frequências não diárias, semanais ou esporádicas
    const shouldValidateVencimento = !isDiaria && !isSemanal && !isEsporadica;
    
    const errors = [];
    
    // Verificar se o nome foi preenchido
    if (!form.nome.trim()) {
      errors.push("Nome");
    }
    
    // Verificar se a frequência foi selecionada
    if (!form.frequencia) {
      errors.push("Frequência");
    }
    
    // Verificar se o departamento foi selecionado
    if (!form.departamentoId) {
      errors.push("Departamento");
    }
    
    // Verificar se o fato gerador foi selecionado (apenas para frequências que não são semanais, bimestrais ou esporádicas)
    if (!isSemanal && !isBimestral && !isEsporadica && !form.fatoGerador) {
      errors.push("Fato Gerador");
    }
    
    // Verificar dia da semana quando for frequência semanal
    if (isSemanal && !form.diaSemana) {
      errors.push("Dia da semana");
    }
    
    // Verificar vencimento apenas para frequências que não são diárias, semanais ou esporádicas
    if (shouldValidateVencimento && form.vencimentoDia <= 0) {
      errors.push("Dia do vencimento");
    }
    
    if (errors.length > 0) {
      const errorMessage = `Por favor, preencha: ${errors.join(", ")}.`;
      toast.error(errorMessage);
      return;
    }
    
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      const body = { ...form, empresaId: form.empresaId || empresaId };
      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/criar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onClose();
    } catch (error) {
      console.error("Erro ao criar obrigação:", error);
      toast.error("Erro ao criar obrigação. Tente novamente.");
    }
  };

  const isDiaria = form.frequencia === "Diário";
  const isSemanal = form.frequencia === "Semanal";
  const isBimestral =
    form.frequencia === "Bimestral" ||
    form.frequencia === "Trimestral" ||
    form.frequencia === "Trimestral 2 Cotas" ||
    form.frequencia === "Trimestral 3 Cotas";
  const isAnual = form.frequencia === "Anual";
  const isEsporadica = form.frequencia === "Esporádica";


  return (
    <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`}>
      <div className={`${styles.modalContent} ${styles.modalContentWide} ${isLight ? styles.modalContentLight : ''}`}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Nova Obrigação
          </h2>
        </div>

        {/* Nome */}
        <label className={styles.formLabel} htmlFor="nome">Nome *</label>
        <input
          id="nome"
          type="text"
          value={form.nome}
          onChange={(e) => handleChange("nome", e.target.value)}
          className={styles.formInput}
        />

        {/* Frequência */}
        <label className={styles.formLabel} htmlFor="frequencia">Frequência *</label>
        <select
          id="frequencia"
          value={form.frequencia}
          onChange={(e) => handleChange("frequencia", e.target.value)}
          className={styles.formSelect}
        >
          <option value="">Selecione...</option>
          <option>Diário</option>
          <option>Semanal</option>
          <option>Mensal</option>
          <option>Bimestral</option>
          <option>Trimestral</option>
          <option>Semestral</option>
          <option>Anual</option>
          <option>Esporádica</option>
        </select>

        {isAnual && (
          <div className={styles.section}>
            <label className={styles.formLabel}>Mês do Ano *</label>
            <select
              value={form.diaSemana}
              onChange={(e) => handleChange("diaSemana", e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Selecione...</option>
              <option>Janeiro</option>
              <option>Fevereiro</option>
              <option>Março</option>
              <option>Abril</option>
              <option>Maio</option>
              <option>Junho</option>
              <option>Julho</option>
              <option>Agosto</option>
              <option>Setembro</option>
              <option>Outubro</option>
              <option>Novembro</option>
              <option>Dezembro</option>
            </select>
          </div>
        )}


        {form.frequencia === "Semanal" && (
          <div className={styles.section}>
            <label className={styles.formLabel}>Dia da Semana *</label>
            <select
              value={form.diaSemana}
              onChange={(e) => handleChange("diaSemana", e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Selecione...</option>
              <option>Segunda</option>
              <option>Terca</option>
              <option>Quarta</option>
              <option>Quinta</option>
              <option>Sexta</option>
              <option>Sabado</option>
              <option>Domingo</option>
            </select>
          </div>
        )}


        {/* Ação e Meta em linha */}
        <div className={styles.formRowLg}>
          <div className={styles.formCol}>
            <label className={styles.formLabel}>Ação (qtd dias) *</label>
            <div className={styles.inlineGroup}>
              <select
                value={form.acaoTipoDias}
                onChange={(e) => handleChange("acaoTipoDias", e.target.value)}
                className={styles.formSelect}
                disabled={isDiaria || isSemanal || isEsporadica}
              >
                <option>Dias úteis</option>
                <option>Dias corridos</option>
              </select>
              <input
                type="number"
                value={form.acaoQtdDias}
                onChange={(e) => handleChange("acaoQtdDias", +e.target.value)}
                className={styles.formInput}
                disabled={isDiaria || isSemanal || isEsporadica}
              />
            </div>
          </div>

          <div className={styles.formCol}>
            <label className={styles.formLabel}>Meta (qtd dias) *</label>
            <div className={styles.inlineGroup}>
              <select
                value={form.metaTipoDias}
                onChange={(e) => handleChange("metaTipoDias", e.target.value)}
                className={styles.formSelect}
                disabled={isDiaria || isSemanal || isEsporadica}
              >
                <option>Dias úteis</option>
                <option>Dias corridos</option>
              </select>
              <input
                type="number"
                value={form.metaQtdDias}
                onChange={(e) => handleChange("metaQtdDias", +e.target.value)}
                className={`${styles.formInput} ${styles.inputSmallCenter}`}
                disabled={isDiaria || isSemanal || isEsporadica}
              />
            </div>
          </div>
        </div>


        {/* Vencimento e Fato Gerador */}
        <div className={styles.formRowLg}>
          <div className={styles.formCol}>
            <label className={styles.formLabel}>Vencimento *</label>
            <div className={styles.inlineGroup}>
              <select
                value={form.vencimentoTipo}
                onChange={(e) => handleChange("vencimentoTipo", e.target.value)}
                className={styles.formSelect}
                disabled={isDiaria || isSemanal || isEsporadica}
              >
                <option>Antecipar</option>
                <option>Postergar</option>
              </select>
              <input
                type="number"
                value={form.vencimentoDia}
                onChange={(e) => handleChange("vencimentoDia", +e.target.value)}
                className={styles.formInput}
                disabled={isDiaria || isSemanal || isEsporadica}
              />
            </div>
            <span className={styles.hintText}>Dia do mês</span>
          </div>

          {!isSemanal && !isBimestral && !isEsporadica && (
            <div className={styles.formCol}>
              <label className={styles.formLabel}>Fato Gerador (Competência) *</label>
              <select
                value={form.fatoGerador}
                onChange={(e) => handleChange("fatoGerador", e.target.value)}
                className={styles.formSelect}
              >
                <option value="">Selecione...</option>
                {(frequenciaFormatada === "anual"
                  ? [
                    "6 anos anteriores",
                    "5 anos anteriores",
                    "4 anos anteriores",
                    "3 anos anteriores",
                    "2 anos anteriores",
                    "Ano anterior",
                    "Mesmo ano",
                    "Próximo ano",
                  ]
                  : [
                    "Mês anterior",
                    "Mesmo mês",
                  ]
                ).map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>


        {/* Órgão e Alias Validação */}
        <div className={styles.formRowLg}>
          <div className={styles.formCol}>
            <label className={styles.formLabel}>Órgão *</label>
            <select
              value={form.orgao}
              onChange={(e) => handleChange("orgao", e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Selecione...</option>
              <option>Receita Federal</option>
              <option>Estadual</option>
              <option>Municipal</option>
              <option>Empresa</option>
            </select>
          </div>

          <div className={styles.formCol}>
            <label className={styles.formLabel}>Alias Validação</label>
            <select
              value={form.aliasValidacao}
              onChange={(e) => handleChange("aliasValidacao", e.target.value)}
              className={styles.formSelect}
            >
              <option>Sem Validação</option>
              <option>Validar Status</option>
            </select>
          </div>
        </div>

        {/* Departamento e Checkboxes */}
        <div className={styles.formRowLg}>
          <div className={styles.formCol}>
            <label className={styles.formLabel}>Departamento</label>
            <select
              value={form.departamentoId}
              onChange={(e) => handleChange("departamentoId", e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Selecione...</option>
              {departamentos.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.nome}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.checkGroup}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.geraMulta}
                onChange={(e) => handleChange("geraMulta", e.target.checked)}
                className={styles.checkbox}
              />
              Gera Multa
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.usarRelatorio}
                onChange={(e) => handleChange("usarRelatorio", e.target.checked)}
                className={styles.checkbox}
              />
              Utilizar no Relatório de Avaliação
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.reenviarEmail}
                onChange={(e) => handleChange("reenviarEmail", e.target.checked)}
                className={styles.checkbox}
              />
              Re-enviar e-mail com anexo não lido
            </label>
          </div>
        </div>

        {/* Botões */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={`${styles.modalButton} ${styles.modalButtonCancel}`}>
            Cancelar
          </button>
          <button onClick={handleSubmit} className={`${styles.modalButton} ${styles.modalButtonConfirm}`}>
            Salvar
          </button>
        </div>
      </div>
      
      {/* Toast de notificação */}
    </div>
  );
}
