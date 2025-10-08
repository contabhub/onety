import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  const formatCpf = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
    if (digits.length <= 9) return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  };

  const formatRg = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 10);
    // Formato comum: 00.000.000-0 (pode variar por estado)
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
    if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, '$1.$2.$3-$4');
  };

  const formatPhoneBr = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return digits.replace(/(\d{2})(\d+)/, '($1) $2');
    if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  const formatCnpj = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
    if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    if (digits.length <= 12) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
  };

  const formatCep = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return digits.replace(/(\d{5})(\d{0,3})/, '$1-$2');
  };

  const handleBuscarCEP = async (cep) => {
    const cepLimpo = String(cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch (err) {
      // silêncio: não bloquear fluxo se a API estiver indisponível
    }
  };

  const handleBuscarCNPJ = async (cnpj) => {
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
      const data = await res.json();
      if (data && data.razao_social) {
        const est = data.estabelecimento || {};
        const telefoneFormatado = est.telefone1 && est.ddd1 ? `(${est.ddd1}) ${est.telefone1}` : undefined;
        setFormData((prev) => ({
          ...prev,
          razao_social: data.razao_social || prev.razao_social,
          nome: data.razao_social || prev.nome,
          telefone: telefoneFormatado ? formatPhoneBr(telefoneFormatado) : prev.telefone,
          endereco: `${est.logradouro || ''} ${est.numero || ''}`.trim() || prev.endereco,
          bairro: est.bairro || prev.bairro,
          cidade: (est.cidade && est.cidade.nome) || prev.cidade,
          estado: (est.estado && est.estado.sigla) || prev.estado,
          cep: est.cep ? formatCep(est.cep) : prev.cep,
        }));
      }
    } catch (err) {
      // silêncio: falhas de consulta não devem travar o formulário
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (formData.tipo === 'pessoa_fisica') {
      if (name === 'cpf') {
        const formatted = formatCpf(value);
        setFormData((prev) => ({ ...prev, cpf: formatted }));
        return;
      }
      if (name === 'rg') {
        const formatted = formatRg(value);
        setFormData((prev) => ({ ...prev, rg: formatted }));
        return;
      }
      if (name === 'telefone') {
        const formatted = formatPhoneBr(value);
        setFormData((prev) => ({ ...prev, telefone: formatted }));
        return;
      }
      if (name === 'cep') {
        const formatted = formatCep(value);
        setFormData((prev) => ({ ...prev, cep: formatted }));
        return;
      }
    }
    if (formData.tipo === 'empresa' && name === 'cnpj') {
      const formatted = formatCnpj(value);
      setFormData((prev) => ({ ...prev, cnpj: formatted }));
      return;
    }
    if (name === 'telefone') {
      const formatted = formatPhoneBr(value);
      setFormData((prev) => ({ ...prev, telefone: formatted }));
      return;
    }
    if (name === 'cep') {
      const formatted = formatCep(value);
      setFormData((prev) => ({ ...prev, cep: formatted }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.tipo === 'pessoa_fisica') {
      if (!formData.nome || !formData.cpf) {
        toast.error('Preencha os campos obrigatórios (Nome e CPF).');
        return;
      }
    } else {
      if (!formData.razao_social || !formData.cnpj || !formData.representante_email) {
        toast.error('Preencha os campos obrigatórios (Razão Social, CNPJ e Email do representante).');
        return;
      }
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Não autenticado");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId =
        user?.EmpresaId ||
        user?.empresa?.id ||
        user?.Empresa?.id ||
        user?.companyId ||
        user?.empresa_id ||
        user?.empresaId;
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
            email: formData.representante_email,
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

      console.log('[ClienteModal] Enviando payload:', payload);
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch {
          try { const txt = await res.text(); data = { error: txt }; } catch {}
        }
        throw new Error(data.error || `Erro ao salvar cliente (HTTP ${res.status})`);
      }
      
      const responseData = await res.json();
      console.log("🔍 [DEBUG] Resposta da API ClienteModal:", responseData);
      toast.success("Cliente salvo com sucesso");
      
      if (cliente) {
        onUpdate?.(responseData);
      } else {
        // Garantir que apenas o ID seja passado, não o objeto inteiro
        const clientId = responseData?.id || responseData?.clientId || responseData?.client_id;
        console.log("🔍 [DEBUG] ClientId sendo passado:", clientId);
        console.log("🔍 [DEBUG] Tipo do clientId:", typeof clientId);
        
        if (!clientId) {
          console.error("❌ [DEBUG] Nenhum ID encontrado na resposta:", responseData);
          toast.error("Erro: ID do cliente não encontrado na resposta");
          return;
        }
        
        onCreate?.(clientId);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
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
                  <div className={styles.field}><label>CEP</label><div className={styles.inputBox}><input name="cep" value={formData.cep} onChange={handleChange} onBlur={(e) => handleBuscarCEP(e.target.value)} /></div></div>
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
                  <div className={styles.field}><label>CNPJ *</label><div className={styles.inputBox}><input name="cnpj" value={formData.cnpj} onChange={handleChange} onBlur={(e) => handleBuscarCNPJ(e.target.value)} /></div></div>
                  <div className={styles.field}><label>Telefone</label><div className={styles.inputBox}><input name="telefone" value={formData.telefone} onChange={handleChange} /></div></div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Endereço</div>
                <div className={styles.grid}>
                  <div className={styles.field}><label>CEP</label><div className={styles.inputBox}><input name="cep" value={formData.cep} onChange={handleChange} onBlur={(e) => handleBuscarCEP(e.target.value)} /></div></div>
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
    </div>,
    typeof document !== 'undefined' ? document.body : (typeof window !== 'undefined' ? window.document.body : null)
  );
}


