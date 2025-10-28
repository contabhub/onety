import { useState } from "react";
import { X, Edit, CheckCircle, XCircle } from "lucide-react";
import styles from "../../styles/financeiro/DetalheClienteDrawer.module.css";

export function DetalhesClienteDrawer({
  isOpen,
  onClose,
  onEdit,
  cliente,
}) {
  const [openAccordions, setOpenAccordions] = useState([
    "dados-gerais",
  ]);

  if (!cliente || !isOpen) return null;

  const renderCampo = (label, valor) => (
    <div className={styles.detalheClienteField}>
      <label className={styles.detalheClienteFieldLabel}>{label}</label>
      <div className={styles.detalheClienteFieldValue}>{valor || "-"}</div>
    </div>
  );

  const getStatusBadge = (status) => {
    const clientStatus = status || "ativo";
    return clientStatus === "ativo" ? (
      <div className={`${styles.detalheClienteBadge} ${styles.detalheClienteBadgeSuccess}`}>
        <CheckCircle className={styles.detalheClienteBadgeIcon} />
        Ativo
      </div>
    ) : (
      <div className={`${styles.detalheClienteBadge} ${styles.detalheClienteBadgeError}`}>
        <XCircle className={styles.detalheClienteBadgeIcon} />
        Inativo
      </div>
    );
  };

  const papeis = cliente.tipo_de_papel?.split(",").map((p) => p.trim()) || [];

  return (
    <div className={styles.detalheClienteOverlay}>
      <div
        className={`${styles.detalheClienteContainer} ${
          isOpen ? styles.detalheClienteContainerOpen : styles.detalheClienteContainerClosed
        }`}
      >
        <div className={styles.detalheClienteHeader}>
          <div className={styles.detalheClienteHeaderInfo}>
            <h2 className={styles.detalheClienteTitle}>
              Detalhes do Cliente
            </h2>
            <p className={styles.detalheClienteSubtitle}>
              {cliente.nome_fantasia || "-"}
            </p>
          </div>
          <div className={styles.detalheClienteHeaderActions}>
            {onEdit && (
              <button onClick={onEdit} className={`${styles.detalheClienteButton} ${styles.detalheClienteButtonEdit}`}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className={`${styles.detalheClienteButton} ${styles.detalheClienteButtonClose}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={styles.detalheClienteContent}>
          <div className={styles.detalheClienteContentInner}>
            <div className={styles.detalheClienteAccordion}>
              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Dados gerais</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div className={styles.detalheClienteGrid}>
                    <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid3}`}>
                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>
                          Nome / Razão Social
                        </label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.nome_fantasia || cliente.razao_social || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>Status</label>
                        <div className={styles.detalheClienteFieldValue}>
                          {getStatusBadge(cliente.status)}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>Tipo de Pessoa</label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.tipo_de_pessoa || "-"}
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid3}`}>
                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>CPF / CNPJ</label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.cnpj || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>Código do Cadastro</label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.codigo_do_cadastro || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <label className={styles.detalheClienteFieldLabel}>Tipos de Papel</label>
                        <div className={styles.detalheClienteFieldValue}>
                          {papeis.length > 0 ? papeis.join(", ") : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Informações adicionais</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid4}`}>
                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>E-mail principal</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.e_mail_principal || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>
                        Telefone comercial
                      </label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.telefone_comercial || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Telefone celular</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.telefone_celular || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Data de cadastro</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.abertura_da_empresa || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Informações fiscais</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid2}`}>
                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Razão social</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.razao_social || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>
                        Optante pelo simples?
                      </label>
                      <div className={styles.detalheClienteRadioGroup}>
                        <div className={styles.detalheClienteRadioItem}>
                          <input
                            type="radio"
                            value="Não"
                            id="nao-view"
                            checked={cliente.optante_pelo_simples !== 1 && cliente.optante_pelo_simples !== true}
                            disabled
                            className={styles.detalheClienteRadioInput}
                          />
                          <label htmlFor="nao-view" className={styles.detalheClienteRadioLabel}>
                            Não
                          </label>
                        </div>
                        <div className={styles.detalheClienteRadioItem}>
                          <input
                            type="radio"
                            value="Sim"
                            id="sim-view"
                            checked={cliente.optante_pelo_simples === 1 || cliente.optante_pelo_simples === true}
                            disabled
                            className={styles.detalheClienteRadioInput}
                          />
                          <label htmlFor="sim-view" className={styles.detalheClienteRadioLabel}>
                            Sim
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Endereço</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid4}`}>
                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>País</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.pais || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>CEP</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.cep || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Endereço</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.endereco || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Número</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.numero || "-"}
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid4}`}>
                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Estado</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.estado || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Cidade</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.cidade || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Bairro</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.bairro || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <label className={styles.detalheClienteFieldLabel}>Complemento</label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.complemento || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Outros contatos</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div style={{ textAlign: 'center', padding: 'var(--onity-space-l)', color: 'var(--onity-icon-secondary)' }}>
                    Nenhum contato adicional cadastrado
                  </div>
                </div>
              </div>

              <div className={styles.detalheClienteAccordionItem}>
                <button className={styles.detalheClienteAccordionTrigger}>
                  <span>Observações gerais</span>
                </button>
                <div className={styles.detalheClienteAccordionContent}>
                  <div className={styles.detalheClienteField}>
                    <label className={styles.detalheClienteFieldLabel}>Observações</label>
                    <div className={styles.detalheClienteFieldValueTextarea}>
                      {cliente.observacoes || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.detalheClienteFooter}>
          <button onClick={onClose} className={styles.detalheClienteFooterButton}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}