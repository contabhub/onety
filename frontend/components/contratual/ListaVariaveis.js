import { useState, useEffect } from "react";
import styles from "./ListaVariaveis.module.css";

const variaveis = {
  documentos: [
    // { name: "contract.id", label: "ID do Contrato" },
    { name: "contract.total_value", label: "Valor Total do Contrato" },
    { name: "contract.expires_at", label: "Data de Expiração" },
    { name: "contract.start_at", label: "Início da Vigência" },
    { name: "contract.end_at", label: "Fim da Vigência" },
    { name: "contract.expira_em_dias", label: "Expira em (dias)" },
    { name: "contract.vigencia_meses", label: "Vigência (meses)" },
    { name: "contract.created_at", label: "Data de Criação" },
    { name: "contract.type", label: "Tipo do Contrato" },
    { name: "contract.mrr", label: "MRR (Receita Recorrente Mensal)" },
    { name: "contract.dia_vencimento", label: "Dia do Vencimento" },
    { name: "contract.data_primeiro_vencimento", label: "Data do 1º Vencimento" },
  ],

  empresa: [
    { name: "company.nameList", label: "Nome da Empresa" },
    { name: "company.razao_socialList", label: "Razão Social" },
    { name: "company.enderecoList", label: "Endereço" },
    { name: "company.numeroList", label: "Número" },
    { name: "company.complementoList", label: "Complemento" },
    { name: "company.bairroList", label: "Bairro" },
    { name: "company.cidadeList", label: "Cidade" },
    { name: "company.estadoList", label: "Estado" },
    { name: "company.cepList", label: "CEP" },
    { name: "company.cnpjList", label: "CNPJ" },
    { name: "company.telefoneList", label: "Telefone" },
  ],

  dadosCliente: [
    { name: "client.type", label: "Tipo de Cliente" },
    { name: "client.name", label: "Nome" },
    { name: "client.cpf_cnpj", label: "CPF / CNPJ" },
    { name: "client.email", label: "Email" },
    { name: "client.telefone", label: "Telefone" },
    { name: "client.rg", label: "RG" },
    { name: "client.estado_civil", label: "Estado Civil" },
    { name: "client.profissao", label: "Profissão" },
    { name: "client.sexo", label: "Sexo" },
    { name: "client.nacionalidade", label: "Nacionalidade" },
    { name: "client.cep", label: "CEP" },
    { name: "client.endereco", label: "Endereço" },
    { name: "client.numero", label: "Número" },
    { name: "client.complemento", label: "Complemento" },
    { name: "client.bairro", label: "Bairro" },
    { name: "client.cidade", label: "Cidade" },
    { name: "client.estado", label: "Estado" },
    { name: "client.representante", label: "Representante Legal" },
    { name: "client.funcao", label: "Função Representante" },
    { name: "client.created_at", label: "Criado em" },
    { name: "client.equipe_id", label: "Equipe ID" },
  ],

  contatos: [
    { name: "contact.nomeList", label: "Nomes dos Contatos" },
    { name: "contact.emailList", label: "Emails dos Contatos" },
    { name: "contact.telefoneList", label: "Telefones dos Contatos" },
    { name: "contact.cpfList", label: "CPFs dos Contatos" },
  ],

  produtos: [
    { name: "product.list", label: "Lista Completa de Produtos" },
    { name: "product.nomeList", label: "Nomes dos Produtos" },
    // { name: "product.valorList", label: "Valores Unitários" },
    { name: "product.quantidadeList", label: "Quantidades" },
    { name: "product.valor_de_vendaList", label: "Valores de Venda" },
    { name: "product.descricaoList", label: "Descrição do Produto" },
  ],

  signatarios: [
    { name: "signatory.list", label: "Todos os Signatários" },
    { name: "signatory.nameList", label: "Nomes dos Signatários" },
    { name: "signatory.emailList", label: "Emails dos Signatários" },
    { name: "signatory.cpfList", label: "CPFs dos Signatários" },
    { name: "signatory.birthList", label: "Datas de Nascimento" },
  ],

  vendedor: [
    { name: "user.full_name", label: "Nome representante legal - {{user.full_name}}" },
    { name: "user.email", label: "Email representante legal - {{user.email}}" },
  ],
};




export default function ListaVariaveis({ handleInsertVariable, setShowVariaveis }) {
  const [activeTab, setActiveTab] = useState("documentos");
  const [customVariables, setCustomVariables] = useState([]);

  const changeTab = (tab) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    async function loadCustomVariables() {
      try {
        const token = localStorage.getItem("token");
        const userRaw = localStorage.getItem("user");
        if (!userRaw || !token) return;

        const user = JSON.parse(userRaw);
        const equipeId = user.equipe_id;
        if (!equipeId) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/custom-variables/${equipeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        setCustomVariables(data || []);
      } catch (error) {
        console.error("Erro ao carregar variáveis personalizadas:", error);
      }
    }

    loadCustomVariables();
  }, []);

  return (
    <div className={styles.container}>

      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h1 className={styles.title}>Lista de Variáveis</h1>
          <div className={styles.variableList}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={activeTab === "documentos" ? styles.activeTab : ""}
                onClick={() => changeTab("documentos")}
              >
                Documentos
              </button>
              <button
                type="button"
                className={activeTab === "empresa" ? styles.activeTab : ""}
                onClick={() => changeTab("empresa")}
              >
                Empresa
              </button>
              <button
                type="button"
                className={activeTab === "dadosCliente" ? styles.activeTab : ""}
                onClick={() => changeTab("dadosCliente")}
              >
                Dados Cliente
              </button>

              <button
                type="button"
                className={activeTab === "contatos" ? styles.activeTab : ""}
                onClick={() => changeTab("contatos")}
              >
                Contatos
              </button>

              <button
                type="button"
                className={activeTab === "produtos" ? styles.activeTab : ""}
                onClick={() => changeTab("produtos")}
              >
                Produtos
              </button>

              <button
                type="button"
                className={activeTab === "signatarios" ? styles.activeTab : ""}
                onClick={() => changeTab("signatarios")}
              >
                Signatarios
              </button>

              <button
                type="button"
                className={activeTab === "vendedor" ? styles.activeTab : ""}
                onClick={() => changeTab("vendedor")}
              >
                Vendedor
              </button>

              <button
                type="button"
                className={activeTab === "personalizadas" ? styles.activeTab : ""}
                onClick={() => changeTab("personalizadas")}
              >
                Personalizadas
              </button>
            </div>
            {activeTab === "personalizadas"
              ? customVariables.map((v) => (
                <button
                  type="button"
                  key={v.variable}
                  className={styles.variableItem}
                  onClick={() => handleInsertVariable(v.variable)}
                >
                  {v.label} — <code>{`{{${v.variable}}}`}</code>
                </button>
              ))
              : variaveis[activeTab]?.map((v) => (
                <button
                  type="button"
                  key={v.name}
                  className={styles.variableItem}
                  onClick={() => handleInsertVariable(v.name)}
                >
                  {v.label} — <code>{`{{${v.name}}}`}</code>
                </button>
              ))}
          </div>


          <button className={styles.closeModal} onClick={() => setShowVariaveis(false)}>
            &times;

          </button>
        </div>
      </div>
    </div>
  );
}
