import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import styles from "../../styles/comercial/crm/ClienteModal.module.css";
import { toast } from "react-toastify";

export default function ClienteModal({ cliente, onClose, onCreate, onUpdate }) {
  const [formData, setFormData] = useState({
    tipo: cliente?.tipo || "pessoa_fisica",
    nome: cliente?.nome || "",
    email: cliente?.email || "",
    cpf: cliente?.cpf || "",
    rg: cliente?.rg || "",
    estado_civil: cliente?.estado_civil || "",
    profissao: cliente?.profissao || "",
    sexo: cliente?.sexo || "",
    nacionalidade: cliente?.nacionalidade || "",
    telefone: cliente?.telefone || "",
    // empresa
    representante: cliente?.representante || "",
    representante_email: cliente?.representante_email || "",
    representante_funcao: cliente?.representante_funcao || "",
    razao_social: cliente?.razao_social || "",
    cnpj: cliente?.cnpj || "",
    cep: cliente?.cep || "",
    endereco: cliente?.endereco || "",
    numero: cliente?.numero || "",
    complemento: cliente?.complemento || "",
    bairro: cliente?.bairro || "",
    cidade: cliente?.cidade || "",
    estado: cliente?.estado || "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.cpf) {
      toast.error("Preencha os campos obrigatórios (Nome e CPF).");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Não autenticado");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id;
      if (!empresaId) throw new Error("Empresa não selecionada");

      const base = `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`;
      const url = cliente ? `${base}/${cliente.id}` : base;
      const method = cliente ? "PUT" : "POST";
      const payloadBase = {
        tipo: formData.tipo,
        email: formData.email,
        telefone: formData.telefone,
        cep: formData.cep,
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        empresa_id: empresaId,
      };
      const payload = formData.tipo === 'empresa'
        ? {
            ...payloadBase,
            nome: formData.razao_social,
            razao_social: formData.razao_social,
            cpf_cnpj: formData.cnpj,
            representante: formData.representante,
            representante_email: formData.representante_email,
            representante_funcao: formData.representante_funcao,
          }
        : {
            ...payloadBase,
            nome: formData.nome,
            cpf_cnpj: formData.cpf,
            rg: formData.rg,
            estado_civil: formData.estado_civil,
            profissao: formData.profissao,
            sexo: formData.sexo,
            nacionalidade: formData.nacionalidade,
          };

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar cliente");
      }
      toast.success("Cliente salvo com sucesso");
      cliente ? onUpdate?.() : onCreate?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h3>{cliente ? "Editar Cliente" : "Novo Cliente"}</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tipo de Cliente</div>
            <div className={styles.row}>
              <label className={styles.radio}><input type="radio" name="tipo" value="pessoa_fisica" checked={formData.tipo === 'pessoa_fisica'} onChange={handleChange} /> Pessoa Física</label>
              <label className={styles.radio}><input type="radio" name="tipo" value="empresa" checked={formData.tipo === 'empresa'} onChange={handleChange} /> Empresa</label>
            </div>
          </div>

          {formData.tipo === 'pessoa_fisica' && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Dados do Cliente</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>Nome *</label><div className={styles.inputBox}><input name="nome" value={formData.nome} onChange={handleChange} required /></div></div>
                  <div className={styles.field}><label>Email *</label><div className={styles.inputBox}><input type="email" name="email" value={formData.email} onChange={handleChange} required /></div></div>
                  <div className={styles.field}><label>CPF *</label><div className={styles.inputBox}><input name="cpf" value={formData.cpf} onChange={handleChange} required /></div></div>
                  <div className={styles.field}><label>RG</label><div className={styles.inputBox}><input name="rg" value={formData.rg} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Estado Civil</label>
                    <div className={styles.inputBox}>
                      <select name="estado_civil" value={formData.estado_civil} onChange={handleChange}>
                      <option value="">Selecione</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                      <option value="uniao_estavel">União Estável</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}><label>Profissão</label><div className={styles.inputBox}><input name="profissao" value={formData.profissao} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Sexo</label>
                    <div className={styles.inputBox}>
                      <select name="sexo" value={formData.sexo} onChange={handleChange}>
                      <option value="">Selecione</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.field}><label>Nacionalidade</label><div className={styles.inputBox}><input name="nacionalidade" value={formData.nacionalidade} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Telefone</label><div className={styles.inputBox}><input name="telefone" value={formData.telefone} onChange={handleChange} /></div></div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Endereço</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>CEP</label><div className={styles.inputBox}><input name="cep" value={formData.cep} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Endereço</label><div className={styles.inputBox}><input name="endereco" value={formData.endereco} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Número</label><div className={styles.inputBox}><input name="numero" value={formData.numero} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Complemento</label><div className={styles.inputBox}><input name="complemento" value={formData.complemento} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Bairro</label><div className={styles.inputBox}><input name="bairro" value={formData.bairro} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Cidade</label><div className={styles.inputBox}><input name="cidade" value={formData.cidade} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Estado</label><div className={styles.inputBox}><input name="estado" value={formData.estado} onChange={handleChange} /></div></div>
                </div>
              </div>
            </>
          )}

          {formData.tipo === 'empresa' && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Representante Legal</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>Representante</label><div className={styles.inputBox}><input name="representante" value={formData.representante} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Email *</label><div className={styles.inputBox}><input type="email" name="representante_email" value={formData.representante_email} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Função</label><div className={styles.inputBox}><input name="representante_funcao" value={formData.representante_funcao} onChange={handleChange} /></div></div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Dados da Empresa</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>Razão Social</label><div className={styles.inputBox}><input name="razao_social" value={formData.razao_social} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>CNPJ *</label><div className={styles.inputBox}><input name="cnpj" value={formData.cnpj} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Telefone</label><div className={styles.inputBox}><input name="telefone" value={formData.telefone} onChange={handleChange} /></div></div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Endereço</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>CEP</label><div className={styles.inputBox}><input name="cep" value={formData.cep} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Endereço</label><div className={styles.inputBox}><input name="endereco" value={formData.endereco} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Número</label><div className={styles.inputBox}><input name="numero" value={formData.numero} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Complemento</label><div className={styles.inputBox}><input name="complemento" value={formData.complemento} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Bairro</label><div className={styles.inputBox}><input name="bairro" value={formData.bairro} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Cidade</label><div className={styles.inputBox}><input name="cidade" value={formData.cidade} onChange={handleChange} /></div></div>
                  <div className={styles.field}><label>Estado</label><div className={styles.inputBox}><input name="estado" value={formData.estado} onChange={handleChange} /></div></div>
                </div>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting && <Loader2 className={styles.spinnerIcon} />}
              {cliente ? 'Salvar' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


