import { format } from "date-fns";
import { useState } from "react";
// API wrapper local com fetch
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
// resolveToken já declarado acima
const resolveEmpresaId = () => {
  try {
    const raw = localStorage.getItem('userData') || sessionStorage.getItem('userData') || sessionStorage.getItem('usuario');
    const u = raw ? JSON.parse(raw) : null;
    if (u?.EmpresaId) return String(u.EmpresaId);
    const fallback = localStorage.getItem('empresaId') || sessionStorage.getItem('empresaId');
    return fallback ? String(fallback) : null;
  } catch { return null; }
};
const resolveToken = () => {
  try { return localStorage.getItem('token') || sessionStorage.getItem('token') || null; } catch { return null; }
};
const api = {
  async get(url, opts = {}) {
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { ...(opts || {}) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[GET ERROR]', { url: fullUrl, status: res.status, text, headers: (opts||{}).headers });
        throw new Error(`GET ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[GET FAILED]', { url: fullUrl, error: String(e) });
      throw e;
    }
  },
  async post(url, body, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    const payload = isFormData ? body : JSON.stringify(body ?? {});
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { method: 'POST', headers, body: payload });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[POST ERROR]', { url: fullUrl, status: res.status, text, headers });
        throw new Error(`POST ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[POST FAILED]', { url: fullUrl, error: String(e) });
      throw e;
    }
  },
  async patch(url, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { method: 'PATCH', headers, body: JSON.stringify(body ?? {}) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[PATCH ERROR]', { url: fullUrl, status: res.status, text, headers });
        throw new Error(`PATCH ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[PATCH FAILED]', { url: fullUrl, error: String(e) });
      throw e;
    }
  }
};
import EmailModal from "../gestao/EmailModal";
import { toast } from "react-toastify";
import styles from "../../styles/gestao/Comentarios.module.css";

export default function Comentarios({
  comentarios,
  setComentarios,
  novoComentario,
  setNovoComentario,
  id
}) {
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [arquivoTemp, setArquivoTemp] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [comentarioEditado, setComentarioEditado] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const usuarioRaw = sessionStorage.getItem("usuario");
  const usuarioId = usuarioRaw ? JSON.parse(usuarioRaw).id : null;

  const salvarEdicaoComentario = async (comentarioId) => {
    if (!comentarioEditado.trim()) return;
      const token = resolveToken();
    const tarefaId = Array.isArray(id) ? id[0] : id;

    try {
      await api.patch(
        `/gestao/tarefas/comentarios/${comentarioId}`,
        { comentario: comentarioEditado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await api.get(`/gestao/tarefas/${tarefaId}/comentarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComentarios(res.data);
      setEditandoId(null);
      setComentarioEditado("");
    } catch (err) {
      alert("Erro ao salvar comentário editado.");
      setEditandoId(null);
    }
  };

  const enviarComentarioComAnexo = async (file = arquivoSelecionado) => {
    const token = resolveToken();
    const tarefaId = Array.isArray(id) ? id[0] : id;

    if (!tarefaId || (!novoComentario.trim() && !file)) return;

    let base64 = null;
    let nomeArquivo = null;

    try {
      if (file) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result?.toString().split(",")[1];
            if (result) resolve(result);
            else reject("Erro ao converter arquivo");
          };
          reader.onerror = () => reject("Erro ao ler arquivo");
          reader.readAsDataURL(file);
        });

        nomeArquivo = file.name;
      }

      await api.post(
        `/gestao/tarefas/${tarefaId}/comentarios`,
        {
          comentario: novoComentario,
          base64,
          nomeArquivo,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setNovoComentario("");
      setArquivoSelecionado(null);

      const res = await api.get(`/gestao/tarefas/${tarefaId}/comentarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setComentarios(res.data);
    } catch (err) {
      console.error("❌ Erro ao enviar comentário:", err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setArquivoTemp(files[0]);
    }
  };

  const handleEmailSend = async (emailData) => {
    console.log("📧 Email enviado via Comentarios:", emailData);
    
    try {
      // Fechar o modal
      setModalEmailAberto(false);
      
      // Chamar a API para enviar o email
      const token = resolveToken();
      if (!token) {
        throw new Error("Token não encontrado");
      }

      console.log("📤 Enviando email via API...");
      
      // Criar FormData para enviar anexos
      const formData = new FormData();
      
      // Adicionar campos de texto
      formData.append('para', emailData.para);
      formData.append('cc', emailData.cc || '');
      formData.append('co', emailData.co || '');
      formData.append('assunto', emailData.assunto);
      formData.append('corpo', emailData.corpo);
      formData.append('nomeUsuario', emailData.nomeUsuario || 'Titan App');
      formData.append('emailUsuario', emailData.emailUsuario || '');
      
      // Adicionar IDs
      if (emailData.tarefaId) {
        formData.append('tarefaId', emailData.tarefaId.toString());
      }
      if (emailData.obrigacaoId) {
        formData.append('obrigacaoId', emailData.obrigacaoId.toString());
      }
      if (emailData.atividadeId) {
        formData.append('atividadeId', emailData.atividadeId.toString());
      }
      
      // Adicionar anexos
      if (emailData.anexo && emailData.anexo.length > 0) {
        emailData.anexo.forEach((file) => {
          formData.append('anexo', file);
        });
      }
      
      console.log("📎 FormData criado com anexos:", emailData.anexo?.length || 0);
      
      const response = await api.post("/gestao/email/enviar", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          ...(resolveEmpresaId() ? { 'X-Empresa-Id': resolveEmpresaId() } : {})
          // Não definir Content-Type, deixar o browser definir automaticamente para FormData
        }
      });

      console.log("✅ Email enviado com sucesso:", response.data);
      
      // Mostrar toast de sucesso
      toast.success("Email enviado com sucesso!");
      
      // Aqui você pode adicionar lógica adicional se necessário
      // Por exemplo, registrar o envio no histórico de comentários
      console.log("✅ Modal fechado e feedback mostrado");
      
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      
      // Mostrar toast de erro
      toast.error("Erro ao enviar email. Tente novamente.");
      
      // Reabrir o modal em caso de erro
      setModalEmailAberto(true);
    }
  };

  return (
    <>
      {/* Área de comentários - Div separada */}
      <div className={styles.comentariosContainer}>
        {/* Header */}
        <div className={styles.comentariosHeader}>
          <span className={styles.comentariosTitle}>
            Comentários e Interações
          </span>
        </div>

        {/* Área de comentários com scroll */}
        <div className={styles.comentariosArea}>
          {comentarios.map((c) => (
            <div key={c.id} className={styles.comentarioItem}>
              <img
                src={
                  (c.avatar_url && c.avatar_url.trim() !== "")
                    ? c.avatar_url
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.nome)}&background=random`
                }
                alt="avatar"
                className={styles.avatar}
              />
              <div className={styles.comentarioConteudo}>
                <div className={styles.comentarioNome}>{c.nome}</div>
                                 <div className={styles.comentarioMeta}>
                   {format(new Date(c.criadoEm), "dd/MM/yyyy - HH:mm")}
                   {/* Só mostrar botão de editar se NÃO for email E se for o usuário atual */}
                   {c.usuarioId === usuarioId && c.comentario && !c.comentario.includes('<b>De:</b>') && (
                     <span
                       title="Editar comentário"
                       className={styles.editarButton}
                       onClick={() => {
                         setEditandoId(c.id);
                         setComentarioEditado(c.comentario);
                       }}
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                         <g fill="none" fillRule="evenodd">
                           <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
                           <path fill="#94A3B8" d="M20.131 3.16a3 3 0 0 0-4.242 0l-.707.708l4.95 4.95l.706-.707a3 3 0 0 0 0-4.243l-.707-.707Zm-1.414 7.072l-4.95-4.95l-9.09 9.091a1.5 1.5 0 0 0-.401.724l-1.029 4.455a1 1 0 0 0 1.2 1.2l4.456-1.028a1.5 1.5 0 0 0 .723-.401z" />
                         </g>
                       </svg>
                     </span>
                   )}
                 </div>

                                 {editandoId === c.id ? (
                   <div className={styles.edicaoArea}>
                     <textarea
                       className={styles.comentarioTextarea}
                       value={comentarioEditado}
                       onChange={e => setComentarioEditado(e.target.value)}
                       maxLength={1500}
                       autoFocus
                     />
                     <button
                       className={styles.salvarButton}
                       onClick={() => salvarEdicaoComentario(c.id)}
                     >
                       Salvar
                     </button>
                     <button
                       className={styles.cancelarButton}
                       onClick={() => setEditandoId(null)}
                     >
                       Cancelar
                     </button>
                   </div>
                 ) : (
                   <>
                     {/* Verificar se é um email */}
                     {c.comentario && c.comentario.includes('<b>De:</b>') ? (
                       <div style={{ marginTop: 8 }}>
                         {/* Renderizar email de forma bonita */}
                         <div className={styles.emailContainer}>
                           {/* Extrair informações do email */}
                           {(() => {
                             const deMatch = c.comentario.match(/<b>De:<\/b> ([^<]+)/);
                             const paraMatch = c.comentario.match(/<b>Para:<\/b> ([^<]+)/);
                             const ccMatch = c.comentario.match(/<b>CC:<\/b> ([^<]+)/);
                             const assuntoMatch = c.comentario.match(/<b>Assunto:<\/b> ([^<]+)/);
                             const corpoMatch = c.comentario.match(/<b>Corpo:<\/b><br\/>(.*)/);
                             
                             return (
                               <>
                                 <div style={{ marginBottom: "8px" }}>
                                   <span className={styles.emailLabel}>de: </span>
                                   <span className={styles.emailValue}>{deMatch ? deMatch[1].trim() : "N/A"}</span>
                                 </div>
                                 
                                 <div style={{ marginBottom: "8px" }}>
                                   <span className={styles.emailLabel}>para: </span>
                                   <span className={styles.emailValue}>{paraMatch ? paraMatch[1].trim() : "N/A"}</span>
                                 </div>
                                 
                                 {ccMatch && (
                                   <div style={{ marginBottom: "8px" }}>
                                     <span className={styles.emailLabel}>cc: </span>
                                     <span className={styles.emailValue}>{ccMatch[1].trim()}</span>
                                   </div>
                                 )}
                                 
                                 <div style={{ marginBottom: "8px" }}>
                                   <span className={styles.emailLabel}>assunto: </span>
                                   <span className={styles.emailValue}>{assuntoMatch ? assuntoMatch[1].trim() : "N/A"}</span>
                                 </div>
                                 
                                                                                                      {/* Ícone discreto de email para visualização completa */}
                                   <div style={{ 
                                     position: "absolute",
                                     top: "8px",
                                     right: "8px"
                                   }}>
                                     <button 
                                       className={styles.emailViewButton}
                                       title="Ver email completo"
                                       onClick={() => {
                                         // Navegar para página de visualização do email
                                         const emailId = c.id;
                                         const tarefaId = Array.isArray(id) ? id[0] : id;
                                         window.open(`/dashboard/tarefas/${tarefaId}/email/${emailId}`, '_blank');
                                       }}
                                     >
                                                                               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                          <path d="M3 8l9 6 9-6" strokeLinecap="round" strokeLinejoin="round"/>
                                          <path d="M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                     </button>
                                   </div>
                               </>
                             );
                           })()}
                         </div>
                       </div>
                     ) : (
                      <div style={{ fontSize: 13, marginTop: 3, color: "var(--onity-color-text)" }}>{c.comentario}</div>
                     )}
                   </>
                 )}

                {/* Anexos - Melhorado para emails */}
                {c.base64 && c.nomeArquivo && (
                  <div style={{ marginTop: "8px" }}>
                    {c.comentario && c.comentario.includes('<b>De:</b>') ? (
                      // Para emails: exibição em grid como no exemplo
                      <div className={styles.anexosContainer}>
                        <div className={styles.anexosHeader}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                          1 anexo
                        </div>
                        
                        <div className={styles.anexosGrid}>
                          <div className={styles.anexoCard}>
                            {/* Ícone do tipo de arquivo */}
                            <div className={styles.anexoIcon}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                              </svg>
                            </div>
                            
                            {/* Nome do arquivo */}
                            <div className={styles.anexoNome}>
                              {c.nomeArquivo}
                            </div>
                            
                            {/* Botão de download */}
                            <a
                              href={`data:application/octet-stream;base64,${c.base64}`}
                              download={c.nomeArquivo}
                              className={styles.downloadButton}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                              Baixar
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Para comentários normais: exibição simples
                      <div className={styles.anexoSimples}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12 15.575q-.2 0-.375-.062T11.3 15.3l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z" />
                        </svg>
                        <a
                          href={`data:application/octet-stream;base64,${c.base64}`}
                          download={c.nomeArquivo}
                          className={styles.anexoLink}
                        >
                          {c.nomeArquivo}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área de escrita - Div separada */}
      <div className={styles.escritaContainer}>
        <div style={{ 
          display: "flex",
          flexDirection: "column"
        }}>
          <textarea
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            placeholder="Escreva um andamento..."
            maxLength={1500}
            className={styles.comentarioInput}
          />
          <div className={styles.escritaFooter}>
            <div className={styles.caracteresCount}>
              {novoComentario.length}/1500 caracteres
            </div>
            <div className={styles.botoesContainer}>
              <button
                className={`${styles.botaoAcao} ${styles.botaoAnexo}`}
                onClick={() => setModalAberto(true)}
                title="Anexar arquivo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10.49 19.182l7.778-7.778c.976-.976 2.382-1.153 3.359-.177s.8 2.383-.177 3.359l-8.132 8.132c-1.414 1.414-4.243 1.414-6.01-.354c-1.768-1.768-1.768-4.596-.354-6.01l8.132-8.132a6.5 6.5 0 0 1 9.192 9.192l-4.596 4.596"/>
                </svg>
              </button>

              <button
                className={`${styles.botaoAcao} ${styles.botaoEmail}`}
                onClick={() => setModalEmailAberto(true)}
                title="Enviar email"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </button>

              <button
                className={`${styles.botaoAcao} ${styles.botaoEnviar}`}
                onClick={() => enviarComentarioComAnexo()}
                title="Enviar comentário"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalAberto && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <h3 className={styles.modalTitle}>Anexar Arquivo</h3>
            
            {/* Área de Upload */}
            <div 
              className={`${styles.uploadArea} ${isDragOver ? styles.dragover : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7,10 12,15 17,10" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              
              <div className={styles.uploadText}>
                Clique para selecionar um arquivo
              </div>
              <div className={styles.uploadSubtext}>
                ou arraste e solte aqui
              </div>
              
              <input
                type="file"
                className={styles.fileInput}
                onChange={(e) => setArquivoTemp(e.target.files?.[0] || null)}
                accept="*/*"
              />
            </div>

            {/* Arquivo Selecionado */}
            {arquivoTemp && (
              <div className={styles.selectedFile}>
                <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{arquivoTemp.name}</div>
                  <div className={styles.fileSize}>
                    {(arquivoTemp.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
                
                <button
                  className={styles.removeFile}
                  onClick={() => setArquivoTemp(null)}
                  title="Remover arquivo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button
                className={`${styles.modalBotao} ${styles.modalBotaoPrimario}`}
                onClick={async () => {
                  if (arquivoTemp) {
                    try {
                      setModalAberto(false);
                      await enviarComentarioComAnexo(arquivoTemp);
                      toast.success("Comentário enviado com sucesso!");
                    } catch {
                      toast.error("Erro ao enviar comentário.");
                    }
                  }
                }}
                disabled={!arquivoTemp}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="7,10 12,15 17,10" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Anexar
              </button>
              
              <button
                className={`${styles.modalBotao} ${styles.modalBotaoSecundario}`}
                onClick={() => {
                  setArquivoTemp(null);
                  setModalAberto(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Email */}
      <EmailModal
        isOpen={modalEmailAberto}
        onClose={() => {
          console.log("🔒 Fechando modal de email via Comentarios");
          setModalEmailAberto(false);
        }}
        onSend={(emailData) => {
          console.log("📤 Função onSend chamada com dados:", emailData);
          handleEmailSend(emailData);
        }}
        processoId={Array.isArray(id) ? id[0] : id}
        tipo="processo"
      />
    </>
  );
}