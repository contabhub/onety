import styles from "../../styles/NovoClienteForm.module.css";
import { useState, useEffect } from "react";

export default function NovoClienteForm({ onCreate }) {
    const [activeTab, setActiveTab] = useState("pessoa_fisica");

    const [novoCliente, setNovoCliente] = useState({
        type: "pessoa_fisica",
        name: "",
        cpf_cnpj: "",
        email: "",
        telefone: "",
        endereco: "",
        equipe_id: "",
        rg: "",
        estado_civil: "",
        profissao: "",
        sexo: "",
        nacionalidade: "",
        cep: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        representante: "",
        funcao: "",
        lead_id: null, // opcional
    });


    const [error, setError] = useState(null);


    useEffect(() => {
        // Recuperar o usuário logado do localStorage
        const userRaw = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!userRaw || !token) return;

        const user = JSON.parse(userRaw);
        const equipeId = user.equipe_id;

        if (!equipeId) {
            console.error("Usuário não tem equipe associada.");
            return;
        }

        // Preencher o estado com o equipe_id do usuário logado
        setNovoCliente((prevState) => ({
            ...prevState,
            equipe_id: equipeId, // Adiciona automaticamente o equipe_id
        }));
    }, []);

    const handleChange = (field, value) => {
        setNovoCliente((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clients`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(novoCliente),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao criar cliente.");
            onCreate(data.clientId);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleBuscarCNPJ = async (cnpj) => {
        try {
            const cnpjLimpo = cnpj.replace(/\D/g, "");
            if (cnpjLimpo.length !== 14) return;

            const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
            const data = await res.json();

            if (data.razao_social) {
                setNovoCliente((prev) => ({
                    ...prev,
                    name: data.razao_social,
                    telefone: data.estabelecimento?.ddd1 && data.estabelecimento?.telefone1
                        ? `(${data.estabelecimento.ddd1}) ${data.estabelecimento.telefone1}`
                        : prev.telefone,
                    endereco: `${data.estabelecimento?.logradouro || ""} ${data.estabelecimento?.numero || ""}`.trim(),
                    bairro: data.estabelecimento?.bairro || "",
                    cidade: data.estabelecimento?.cidade?.nome || "",
                    estado: data.estabelecimento?.estado?.sigla || "",
                    cep: data.estabelecimento?.cep || "",
                }));
            }
        } catch (error) {
            console.error("Erro ao buscar CNPJ:", error);
        }
    };

    const handleBuscarCEP = async (cep) => {
        try {
            const cepLimpo = cep.replace(/\D/g, "");
            if (cepLimpo.length !== 8) return;

            const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await res.json();

            if (!data.erro) {
                setNovoCliente((prev) => ({
                    ...prev,
                    endereco: data.logradouro || prev.endereco,
                    bairro: data.bairro || prev.bairro,
                    cidade: data.localidade || prev.cidade,
                    estado: data.uf || prev.estado,
                }));
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
    };



    return (
        <div className={styles.formContainer}>
            <h3 className={styles.subtitle}>Tipo de Cliente</h3>
            <div className={styles.radioGroup}>
                <label>
                    <input
                        type="radio"
                        name="tipo"
                        value="pessoa_fisica"
                        checked={novoCliente.type === "pessoa_fisica"}
                        onChange={(e) => {
                            const type = e.target.value;
                            setNovoCliente({ ...novoCliente, type });
                            setActiveTab(type);
                        }}
                    />
                    Pessoa física
                </label>
                <label >
                    <input
                        type="radio"
                        name="tipo"
                        value="empresa"
                        checked={novoCliente.type === "empresa"}
                        onChange={(e) => {
                            const type = e.target.value;
                            setNovoCliente({ ...novoCliente, type });
                            setActiveTab(type);
                        }}
                    />
                    Empresa
                </label>
            </div>


            {activeTab === "pessoa_fisica" && (
                <>
                    <div className={styles.container}>
                        <div className={styles.grid}>
                            <h3 className={styles.subtitle}>Dados do Cliente</h3>

                            <div>
                                <label>Nome</label>
                                <input className={styles.input} type="text" placeholder="Nome" value={novoCliente.name} onChange={(e) => handleChange("name", e.target.value)} />
                            </div>
                            <div>
                                <label>Email</label>
                                <input className={styles.input} type="email" placeholder="Email" value={novoCliente.email} onChange={(e) => handleChange("email", e.target.value)} />
                            </div>
                            <div>
                                <label>CPF</label>
                                <input className={styles.input} type="text" placeholder="CPF" value={novoCliente.cpf_cnpj} onChange={(e) => handleChange("cpf_cnpj", e.target.value)} />
                            </div>
                            <div>
                                <label>RG</label>
                                <input className={styles.input} type="text" placeholder="RG" value={novoCliente.rg} onChange={(e) => handleChange("rg", e.target.value)} />
                            </div>
                            <div>
                                <label>Estado Civil</label>
                                <select className={styles.input} value={novoCliente.estado_civil} onChange={(e) => handleChange("estado_civil", e.target.value)} >
                                    <option value="">Selecione o estado civil</option>
                                    <option value="solteiro">Solteiro</option>
                                    <option value="casado">Casado</option>
                                    <option value="divorciado">Divorciado</option>
                                    <option value="viuvo">Viúvo</option>
                                </select>
                            </div>
                            <div>
                                <label>Profissão</label>
                                <input className={styles.input} type="text" placeholder="Profissão" value={novoCliente.profissao} onChange={(e) => handleChange("profissao", e.target.value)} />
                            </div>
                            <div>
                                <label>Sexo</label>
                                <select className={styles.input} type="text" placeholder="Sexo" value={novoCliente.sexo} onChange={(e) => handleChange("sexo", e.target.value)}>
                                    <option value="">Selecione o sexo</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="feminino">Feminino</option>
                                </select>
                            </div>
                            <div>
                                <label>Nacionalidade</label>
                                <input className={styles.input} type="text" placeholder="Nacionalidade" value={novoCliente.nacionalidade} onChange={(e) => handleChange("nacionalidade", e.target.value)} />
                            </div>
                            <div>
                                <label>Telefone</label>
                                <input className={styles.input} type="text" placeholder="Telefone" value={novoCliente.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
                            </div>
                        </div>


                        <div className={styles.grid}>
                            <h3 className={styles.subtitle}>Endereço</h3>

                            <div>
                                <label>CEP</label>
                                <input className={styles.input} type="text" placeholder="CEP" value={novoCliente.cep} onChange={(e) => { handleChange("cep", e.target.value); handleBuscarCEP(e.target.value); }} />
                            </div>
                            <div>
                                <label>Endereço</label>
                                <input className={styles.input} type="text" placeholder="Endereço" value={novoCliente.endereco} onChange={(e) => handleChange("endereco", e.target.value)} />
                            </div>
                            <div>
                                <label>Número</label>
                                <input className={styles.input} type="text" placeholder="Número" value={novoCliente.numero} onChange={(e) => handleChange("numero", e.target.value)} />
                            </div>
                            <div>
                                <label>Complemento</label>
                                <input className={styles.input} type="text" placeholder="Complemento" value={novoCliente.complemento} onChange={(e) => handleChange("complemento", e.target.value)} />
                            </div>
                            <div>
                                <label>Bairro</label>
                                <input className={styles.input} type="text" placeholder="Bairro" value={novoCliente.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
                            </div>
                            <div>
                                <label>Cidade</label>
                                <input className={styles.input} type="text" placeholder="Cidade" value={novoCliente.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
                            </div>
                            <div>
                                <label>Estado</label>
                                <input className={styles.input} type="text" placeholder="Estado" value={novoCliente.estado} onChange={(e) => handleChange("estado", e.target.value)} />
                            </div>
                        </div>
                    </div>


                </>
            )}

            {activeTab === "empresa" && (
                <>
                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Representante legal</h3>
                        <div>
                            <label>Representante</label>
                            <input className={styles.input} type="text" placeholder="Representante" value={novoCliente.representante} onChange={(e) => handleChange("representante", e.target.value)} />
                        </div>
                        <div>
                            <label>Email</label>
                            <input className={styles.input} type="email" placeholder="Email" value={novoCliente.email} onChange={(e) => handleChange("email", e.target.value)} />
                        </div>
                        <div>
                            <label>Função</label>
                            <input className={styles.input} type="text" placeholder="Função" value={novoCliente.funcao} onChange={(e) => handleChange("funcao", e.target.value)} />
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Dados da Empresa</h3>
                        <div>
                            <label>Razão Social</label>
                            <input className={styles.input} type="text" placeholder="Razão Social" value={novoCliente.name} onChange={(e) => handleChange("name", e.target.value)} />
                        </div>
                        <div>
                            <label>CNPJ</label>
                            <input className={styles.input} type="text" placeholder="CNPJ" value={novoCliente.cpf_cnpj} onChange={(e) => { handleChange("cpf_cnpj", e.target.value); handleBuscarCNPJ(e.target.value); }} />
                        </div>
                        <div>
                            <label>Telefone</label>
                            <input className={styles.input} type="text" placeholder="Telefone" value={novoCliente.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Endereço</h3>
                        <div>
                            <label>CEP</label>
                            <input className={styles.input} type="text" placeholder="CEP" value={novoCliente.cep} onChange={(e) => { handleChange("cep", e.target.value); handleBuscarCEP(e.target.value); }} />
                        </div>
                        <div>
                            <label>Endereço</label>
                            <input className={styles.input} type="text" placeholder="Endereço" value={novoCliente.endereco} onChange={(e) => handleChange("endereco", e.target.value)} />
                        </div>
                        <div>
                            <label>Número</label>
                            <input className={styles.input} type="text" placeholder="Número" value={novoCliente.numero} onChange={(e) => handleChange("numero", e.target.value)} />
                        </div>
                        <div>
                            <label>Complemento</label>
                            <input className={styles.input} type="text" placeholder="Complemento" value={novoCliente.complemento} onChange={(e) => handleChange("complemento", e.target.value)} />
                        </div>
                        <div>
                            <label>Bairro</label>
                            <input className={styles.input} type="text" placeholder="Bairro" value={novoCliente.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
                        </div>
                        <div>
                            <label>Cidade</label>
                            <input className={styles.input} type="text" placeholder="Cidade" value={novoCliente.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
                        </div>
                        <div>
                            <label>Estado</label>
                            <input className={styles.input} type="text" placeholder="Estado" value={novoCliente.estado} onChange={(e) => handleChange("estado", e.target.value)} />
                        </div>
                    </div>
                </>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.formActions}>
                <button className={styles.button} onClick={handleSubmit}>
                    Criar Cliente
                </button>
            </div>
        </div>
    );
}
