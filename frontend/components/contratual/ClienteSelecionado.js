import { useState, useEffect } from "react";
import styles from "../../styles/NovoClienteForm.module.css";

export default function ClienteSelecionado({ cliente, onClose, onUpdate }) {
    const [formData, setFormData] = useState({
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
        lead_id: null,
    });

    useEffect(() => {
        if (cliente) {
            setFormData({
                type: cliente.type || "pessoa_fisica",
                name: cliente.name || "",
                cpf_cnpj: cliente.cpf_cnpj || "",
                email: cliente.email || "",
                telefone: cliente.telefone || "",
                endereco: cliente.endereco || "",
                equipe_id: cliente.equipe_id || "",
                rg: cliente.rg || "",
                estado_civil: cliente.estado_civil || "",
                profissao: cliente.profissao || "",
                sexo: cliente.sexo || "",
                nacionalidade: cliente.nacionalidade || "",
                cep: cliente.cep || "",
                numero: cliente.numero || "",
                complemento: cliente.complemento || "",
                bairro: cliente.bairro || "",
                cidade: cliente.cidade || "",
                estado: cliente.estado || "",
                representante: cliente.representante || "",
                funcao: cliente.funcao || "",
                lead_id: cliente.lead_id || null,
            });
        }
    }, [cliente]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clients/${cliente.id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Erro ao atualizar cliente.");
            const updated = await res.json();
            onUpdate(updated);
            onClose();
        } catch (err) {
            alert(err.message);
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
                        checked={formData.type === "pessoa_fisica"}
                        onChange={(e) => handleChange("type", e.target.value)}
                    />
                    Pessoa Física
                </label>
                <label>
                    <input
                        type="radio"
                        name="tipo"
                        value="empresa"
                        checked={formData.type === "empresa"}
                        onChange={(e) => handleChange("type", e.target.value)}
                    />
                    Empresa
                </label>
            </div>

            {formData.type === "pessoa_fisica" && (
                <>
                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Dados do Cliente</h3>

                        <div>
                            <label>Nome</label>
                            <input className={styles.input} type="text" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} />
                        </div>
                        <div>
                            <label>Email</label>
                            <input className={styles.input} type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} />
                        </div>
                        <div>
                            <label>CPF</label>
                            <input className={styles.input} type="text" value={formData.cpf_cnpj} onChange={(e) => handleChange("cpf_cnpj", e.target.value)} />
                        </div>
                        <div>
                            <label>RG</label>
                            <input className={styles.input} type="text" value={formData.rg} onChange={(e) => handleChange("rg", e.target.value)} />
                        </div>
                        <div>
                            <label>Estado Civil</label>
                            <select className={styles.input} value={formData.estado_civil} onChange={(e) => handleChange("estado_civil", e.target.value)}>
                                <option value="">Selecione</option>
                                <option value="solteiro">Solteiro</option>
                                <option value="casado">Casado</option>
                                <option value="divorciado">Divorciado</option>
                                <option value="viuvo">Viúvo</option>
                            </select>
                        </div>
                        <div>
                            <label>Profissão</label>
                            <input className={styles.input} type="text" value={formData.profissao} onChange={(e) => handleChange("profissao", e.target.value)} />
                        </div>
                        <div>
                            <label>Sexo</label>
                            <select className={styles.input} value={formData.sexo} onChange={(e) => handleChange("sexo", e.target.value)}>
                                <option value="">Selecione</option>
                                <option value="masculino">Masculino</option>
                                <option value="feminino">Feminino</option>
                            </select>
                        </div>
                        <div>
                            <label>Nacionalidade</label>
                            <input className={styles.input} type="text" value={formData.nacionalidade} onChange={(e) => handleChange("nacionalidade", e.target.value)} />
                        </div>
                        <div>
                            <label>Telefone</label>
                            <input className={styles.input} type="text" value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Endereço</h3>

                        <div><label>CEP</label><input className={styles.input} type="text" value={formData.cep} onChange={(e) => handleChange("cep", e.target.value)} /></div>
                        <div><label>Endereço</label><input className={styles.input} type="text" value={formData.endereco} onChange={(e) => handleChange("endereco", e.target.value)} /></div>
                        <div><label>Número</label><input className={styles.input} type="text" value={formData.numero} onChange={(e) => handleChange("numero", e.target.value)} /></div>
                        <div><label>Complemento</label><input className={styles.input} type="text" value={formData.complemento} onChange={(e) => handleChange("complemento", e.target.value)} /></div>
                        <div><label>Bairro</label><input className={styles.input} type="text" value={formData.bairro} onChange={(e) => handleChange("bairro", e.target.value)} /></div>
                        <div><label>Cidade</label><input className={styles.input} type="text" value={formData.cidade} onChange={(e) => handleChange("cidade", e.target.value)} /></div>
                        <div><label>Estado</label><input className={styles.input} type="text" value={formData.estado} onChange={(e) => handleChange("estado", e.target.value)} /></div>
                    </div>
                </>
            )}

            {formData.type === "empresa" && (
                <>
                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Representante Legal</h3>
                        <div><label>Representante</label><input className={styles.input} type="text" value={formData.representante} onChange={(e) => handleChange("representante", e.target.value)} /></div>
                        <div><label>Email</label><input className={styles.input} type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
                        <div><label>Função</label><input className={styles.input} type="text" value={formData.funcao} onChange={(e) => handleChange("funcao", e.target.value)} /></div>
                    </div>

                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Dados da Empresa</h3>
                        <div><label>Razão Social</label><input className={styles.input} type="text" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} /></div>
                        <div><label>CNPJ</label><input className={styles.input} type="text" value={formData.cpf_cnpj} onChange={(e) => handleChange("cpf_cnpj", e.target.value)} /></div>
                        <div><label>Telefone</label><input className={styles.input} type="text" value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
                    </div>

                    <div className={styles.grid}>
                        <h3 className={styles.subtitle}>Endereço</h3>
                        <div><label>CEP</label><input className={styles.input} type="text" value={formData.cep} onChange={(e) => handleChange("cep", e.target.value)} /></div>
                        <div><label>Endereço</label><input className={styles.input} type="text" value={formData.endereco} onChange={(e) => handleChange("endereco", e.target.value)} /></div>
                        <div><label>Número</label><input className={styles.input} type="text" value={formData.numero} onChange={(e) => handleChange("numero", e.target.value)} /></div>
                        <div><label>Complemento</label><input className={styles.input} type="text" value={formData.complemento} onChange={(e) => handleChange("complemento", e.target.value)} /></div>
                        <div><label>Bairro</label><input className={styles.input} type="text" value={formData.bairro} onChange={(e) => handleChange("bairro", e.target.value)} /></div>
                        <div><label>Cidade</label><input className={styles.input} type="text" value={formData.cidade} onChange={(e) => handleChange("cidade", e.target.value)} /></div>
                        <div><label>Estado</label><input className={styles.input} type="text" value={formData.estado} onChange={(e) => handleChange("estado", e.target.value)} /></div>
                    </div>
                </>
            )}

            <div className={styles.formActions}>
                <button className={styles.button} onClick={handleSubmit}>
                    Salvar
                </button>
            </div>
        </div>
    );
}
