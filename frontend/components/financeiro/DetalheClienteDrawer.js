import { useState } from "react";
import { Label } from "../../components/financeiro/label";
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
      <Label className={styles.detalheClienteFieldLabel}>{label}</Label>
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
                        <Label className={styles.detalheClienteFieldLabel}>
                          Nome / Razão Social
                        </Label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.nome_fantasia || cliente.razao_social || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <Label className={styles.detalheClienteFieldLabel}>Status</Label>
                        <div className={styles.detalheClienteFieldValue}>
                          {getStatusBadge(cliente.status)}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <Label className={styles.detalheClienteFieldLabel}>Tipo de Pessoa</Label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.tipo_de_pessoa || "-"}
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid3}`}>
                      <div className={styles.detalheClienteField}>
                        <Label className={styles.detalheClienteFieldLabel}>CPF / CNPJ</Label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.cnpj || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <Label className={styles.detalheClienteFieldLabel}>Código do Cadastro</Label>
                        <div className={styles.detalheClienteFieldValue}>
                          {cliente.codigo_do_cadastro || "-"}
                        </div>
                      </div>

                      <div className={styles.detalheClienteField}>
                        <Label className={styles.detalheClienteFieldLabel}>Tipos de Papel</Label>
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
                      <Label className={styles.detalheClienteFieldLabel}>E-mail principal</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.e_mail_principal || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>
                        Telefone comercial
                      </Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.telefone_comercial || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Telefone celular</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.telefone_celular || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Data de cadastro</Label>
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
                      <Label className={styles.detalheClienteFieldLabel}>Razão social</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.razao_social || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>
                        Optante pelo simples?
                      </Label>
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
                          <Label htmlFor="nao-view" className={styles.detalheClienteRadioLabel}>
                            Não
                          </Label>
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
                          <Label htmlFor="sim-view" className={styles.detalheClienteRadioLabel}>
                            Sim
                          </Label>
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
                      <Label className={styles.detalheClienteFieldLabel}>País</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.pais || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>CEP</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.cep || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Endereço</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.endereco || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Número</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.numero || "-"}
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.detalheClienteGrid} ${styles.detalheClienteGrid4}`}>
                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Estado</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.estado || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Cidade</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.cidade || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Bairro</Label>
                      <div className={styles.detalheClienteFieldValue}>
                        {cliente.bairro || "-"}
                      </div>
                    </div>

                    <div className={styles.detalheClienteField}>
                      <Label className={styles.detalheClienteFieldLabel}>Complemento</Label>
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
                    <Label className={styles.detalheClienteFieldLabel}>Observações</Label>
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