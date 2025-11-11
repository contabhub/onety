"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export default function PesquisaFranqueadoPage() {
  const params = useParams();
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const [pesquisaData, setPesquisaData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [mensagem, setMensagem] = useState("");

  const [notaSatisfacaoGeral, setNotaSatisfacaoGeral] = useState(null);
  const [comentarioGeral, setComentarioGeral] = useState("");

  const [notaAtendimento, setNotaAtendimento] = useState(null);
  const [notaTi, setNotaTi] = useState(null);
  const [notaParceiros, setNotaParceiros] = useState(null);
  const [comentarioAtendimento, setComentarioAtendimento] = useState("");
  const [comentarioTi, setComentarioTi] = useState("");
  const [comentarioParceiros, setComentarioParceiros] = useState("");

  const [utilizaBackofficePessoal, setUtilizaBackofficePessoal] = useState(false);
  const [utilizaBackofficeFiscal, setUtilizaBackofficeFiscal] = useState(false);
  const [utilizaBackofficeContabil, setUtilizaBackofficeContabil] = useState(false);
  const [naoUtilizaBackoffice, setNaoUtilizaBackoffice] = useState(false);

  const [notaDepPessoal, setNotaDepPessoal] = useState(null);
  const [notaDemandasPessoal, setNotaDemandasPessoal] = useState(null);
  const [comentarioPessoal, setComentarioPessoal] = useState("");

  const [notaDepFiscal, setNotaDepFiscal] = useState(null);
  const [notaDemandasFiscal, setNotaDemandasFiscal] = useState(null);
  const [comentarioFiscal, setComentarioFiscal] = useState("");

  const [notaDepContabil, setNotaDepContabil] = useState(null);
  const [notaDemandasContabil, setNotaDemandasContabil] = useState(null);
  const [comentarioContabil, setComentarioContabil] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalido");
      setMensagem("Token de pesquisa não encontrado.");
      return;
    }

    fetch(`${API_BASE}/gestao/pesquisas-franqueados/externo/info/${token}`)
      .then((response) => response.json())
      .then((data) => {
        setPesquisaData(data);
        setStatus("idle");
      })
      .catch((error) => {
        console.error("Erro ao buscar pesquisa:", error);
        setStatus("invalido");
        setMensagem("Token de pesquisa inválido ou expirado.");
      });
  }, [token]);

  // Função para lidar com mudanças no uso do BackOffice
  const handleBackofficeChange = (tipo, checked) => {
    if (tipo === 'naoUtiliza') {
      setNaoUtilizaBackoffice(checked);
      if (checked) {
        setUtilizaBackofficePessoal(false);
        setUtilizaBackofficeFiscal(false);
        setUtilizaBackofficeContabil(false);
      }
    } else {
      if (checked) {
        setNaoUtilizaBackoffice(false);
      }
      
      switch (tipo) {
        case 'pessoal':
          setUtilizaBackofficePessoal(checked);
          break;
        case 'fiscal':
          setUtilizaBackofficeFiscal(checked);
          break;
        case 'contabil':
          setUtilizaBackofficeContabil(checked);
          break;
      }
    }
  };

  // Verificar se deve mostrar perguntas específicas
  const deveMostrarPerguntasEspecificas = utilizaBackofficePessoal || utilizaBackofficeFiscal || utilizaBackofficeContabil;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (notaSatisfacaoGeral === null) {
      toast.error('Por favor, selecione uma nota de satisfação geral.');
      return;
    }

    if (!naoUtilizaBackoffice && !deveMostrarPerguntasEspecificas) {
      toast.error('Por favor, selecione pelo menos um departamento do BackOffice ou marque que não utiliza.');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE}/gestao/pesquisas-franqueados/externo/responder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          notaSatisfacaoGeral,
          comentarioGeral,
          notaAtendimento,
          notaTi,
          notaParceiros,
          comentarioAtendimento,
          comentarioTi,
          comentarioParceiros,
          utilizaBackofficePessoal,
          utilizaBackofficeFiscal,
          utilizaBackofficeContabil,
          naoUtilizaBackoffice,
          notaDepPessoal,
          notaDemandasPessoal,
          comentarioPessoal,
          notaDepFiscal,
          notaDemandasFiscal,
          comentarioFiscal,
          notaDepContabil,
          notaDemandasContabil,
          comentarioContabil,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("sucesso");
        setMensagem("Obrigado por sua resposta! Sua opinião é muito importante para nós.");
      } else {
        setStatus("erro");
        setMensagem(data.error || "Erro ao enviar resposta.");
      }
    } catch (error) {
      console.error("Erro ao enviar resposta:", error);
      setStatus("erro");
      setMensagem("Erro ao enviar resposta. Tente novamente.");
    }
  };

  if (status === 'invalido') {
    return (
      <div className="container">
        <div className="error-card">
          <h1>❌ Pesquisa Inválida</h1>
          <p>{mensagem}</p>
          <p>Entre em contato com sua franqueadora para obter um link válido.</p>
        </div>
      </div>
    );
  }

  if (status === 'sucesso') {
    return (
      <div className="container">
        <div className="success-card">
          <div className="logo-container">
            {pesquisaData?.logo_url && <img src={pesquisaData.logo_url} alt="Logo da empresa" className="logo" />}
          </div>
          <h1>✅ Obrigado!</h1>
          <p>{mensagem}</p>
          <p>Sua resposta foi registrada com sucesso.</p>
        </div>
      </div>
    );
  }

  if (!pesquisaData) {
    return (
      <div className="container">
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      
      <div className="pesquisa-card">
        <div className="header">
          <div className="logo-container">
            {pesquisaData.logo_url && <img src={pesquisaData.logo_url} alt="Logo da empresa" className="logo" />}
          </div>
          <h1>Pesquisa de Satisfação</h1>
          <p className="empresa-nome">{pesquisaData.razaoSocial}</p>
          <p className="franqueado-info">
            <strong>{pesquisaData.nomeFranqueado}</strong> - {pesquisaData.unidade}
          </p>
          <p className="descricao">
          Estamos iniciando mais um trimestre de pesquisas de satisfação e gostaríamos de contar com a sua colaboração. Como representante da qualidade, convido você a utilizar este formulário como uma oportunidade para uma conversa franca e confidencial. Responda de forma sincera para que possamos entender suas necessidades e trabalhar em melhorias com base nas suas sugestões. 🚀⚡
          </p>
        </div>

        <form onSubmit={handleSubmit} className="formulario">
          {/* Pergunta 1: Satisfação Geral */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Qual seu nível de satisfação geral com a CF Contabilidade? *
            </label>
            
            <div className="notas-container">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`nota ${notaSatisfacaoGeral === n ? 'selecionada' : ''} ${
                    n <= 6 ? 'vermelha' : n <= 8 ? 'amarela' : 'verde'
                  }`}
                  onClick={() => setNotaSatisfacaoGeral(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Pergunta 2: Comentário Geral */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Elogio ou ponto de melhoria: *
            </label>
            <p className="pergunta-descricao">
              Utilize este espaço para elogiar ou pontuar qualquer frustração. (Pode ser de qualquer departamento).
            </p>
            <textarea
              value={comentarioGeral}
              onChange={(e) => setComentarioGeral(e.target.value)}
              placeholder="Conte-nos mais sobre sua experiência..."
              rows={4}
              className="comentario-input"
              required
            />
          </div>

          {/* Pergunta 3: Satisfação com Central de Atendimento */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Qual seu nível de satisfação com a nossa central de atendimento? *
            </label>
            <div className="notas-container">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`nota ${notaAtendimento === n ? 'selecionada' : ''}`}
                  onClick={() => setNotaAtendimento(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="comentario-section">
              <label className="comentario-label">Comentário sobre Central de Atendimento:</label>
              <textarea
                value={comentarioAtendimento}
                onChange={(e) => setComentarioAtendimento(e.target.value)}
                placeholder="Conte-nos mais sobre sua experiência com o atendimento..."
                rows={3}
                className="comentario-input"
              />
            </div>
          </div>

          {/* Pergunta 4: Satisfação com Equipe de T.I */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Qual seu nível de satisfação com a nossa equipe de T.I? *
            </label>
            <div className="notas-container">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`nota ${notaTi === n ? 'selecionada' : ''}`}
                  onClick={() => setNotaTi(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="comentario-section">
              <label className="comentario-label">Comentário sobre Equipe de T.I:</label>
              <textarea
                value={comentarioTi}
                onChange={(e) => setComentarioTi(e.target.value)}
                placeholder="Conte-nos mais sobre sua experiência com a equipe de T.I..."
                rows={3}
                className="comentario-input"
              />
            </div>
          </div>

          {/* Pergunta 5: Satisfação com Parceiros */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Qual seu nível de satisfação com nossos Parceiros? *
            </label>
            <div className="notas-container">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`nota ${notaParceiros === n ? 'selecionada' : ''}`}
                  onClick={() => setNotaParceiros(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="comentario-section">
              <label className="comentario-label">Comentário sobre Parceiros:</label>
              <textarea
                value={comentarioParceiros}
                onChange={(e) => setComentarioParceiros(e.target.value)}
                placeholder="Conte-nos mais sobre sua experiência com nossos parceiros..."
                rows={3}
                className="comentario-input"
              />
            </div>
          </div>

          {/* Pergunta 6: Uso do BackOffice */}
          <div className="pergunta-section">
            <label className="pergunta-label">
              Você utiliza nosso BackOffice? *
            </label>
            <p className="pergunta-descricao">
              Responda as perguntas a seguir com base nos departamentos de BackOffice que você marcou e utiliza diariamente. 
              OBS: Caso você não utilize, pode finalizar.
            </p>
            
            <div className="checkbox-group">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={utilizaBackofficePessoal}
                  onChange={(e) => handleBackofficeChange('pessoal', e.target.checked)}
                />
                <span className="checkmark"></span>
                Departamento Pessoal
              </label>
              
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={utilizaBackofficeFiscal}
                  onChange={(e) => handleBackofficeChange('fiscal', e.target.checked)}
                />
                <span className="checkmark"></span>
                Fiscal
              </label>
              
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={utilizaBackofficeContabil}
                  onChange={(e) => handleBackofficeChange('contabil', e.target.checked)}
                />
                <span className="checkmark"></span>
                Contábil
              </label>
              
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={naoUtilizaBackoffice}
                  onChange={(e) => handleBackofficeChange('naoUtiliza', e.target.checked)}
                />
                <span className="checkmark"></span>
                Não utilizo
              </label>
            </div>
          </div>

          {/* Perguntas específicas dos departamentos */}
          {deveMostrarPerguntasEspecificas && (
            <>
              {/* Departamento Pessoal */}
              {utilizaBackofficePessoal && (
                <div className="departamento-section">
                  <h3 className="departamento-titulo">Departamento Pessoal</h3>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      Qual seu nível de satisfação com nosso time de Departamento Pessoal?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDepPessoal === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDepPessoal(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      As demandas são entregues no prazo e sem erros?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDemandasPessoal === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDemandasPessoal(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">Comentário sobre Departamento Pessoal:</label>
                    <textarea
                      value={comentarioPessoal}
                      onChange={(e) => setComentarioPessoal(e.target.value)}
                      placeholder="Conte-nos mais sobre sua experiência com o DP..."
                      rows={3}
                      className="comentario-input"
                    />
                  </div>
                </div>
              )}

              {/* Departamento Fiscal */}
              {utilizaBackofficeFiscal && (
                <div className="departamento-section">
                  <h3 className="departamento-titulo">Departamento Fiscal</h3>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      Qual seu nível de satisfação com nosso time Fiscal?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDepFiscal === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDepFiscal(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      As demandas são entregues no prazo e sem erros?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDemandasFiscal === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDemandasFiscal(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">Comentário sobre Departamento Fiscal:</label>
                    <textarea
                      value={comentarioFiscal}
                      onChange={(e) => setComentarioFiscal(e.target.value)}
                      placeholder="Conte-nos mais sobre sua experiência com o fiscal..."
                      rows={3}
                      className="comentario-input"
                    />
                  </div>
                </div>
              )}

              {/* Departamento Contábil */}
              {utilizaBackofficeContabil && (
                <div className="departamento-section">
                  <h3 className="departamento-titulo">Departamento Contábil</h3>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      Qual seu nível de satisfação com nosso time do Contábil?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDepContabil === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDepContabil(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">
                      As demandas são entregues no prazo e sem erros?
                    </label>
                    <div className="notas-container">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`nota ${notaDemandasContabil === n ? 'selecionada' : ''}`}
                          onClick={() => setNotaDemandasContabil(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pergunta-section">
                    <label className="pergunta-label">Comentário sobre Departamento Contábil:</label>
                    <textarea
                      value={comentarioContabil}
                      onChange={(e) => setComentarioContabil(e.target.value)}
                      placeholder="Conte-nos mais sobre sua experiência com o contábil..."
                      rows={3}
                      className="comentario-input"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Botão de envio */}
          <button
            type="submit"
            disabled={status === 'loading' || notaSatisfacaoGeral === null}
            className="botao-enviar"
          >
            {status === 'loading' ? 'Enviando...' : 'Enviar Resposta'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .container {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--titan-base-00) 0%, var(--titan-base-10) 100%);
          display: block;
          padding: var(--titan-spacing-lg);
          font-family: var(--titan-font-family);
          overflow-y: auto;
          overflow-x: hidden;
          width: 100vw;
          max-width: 100vw;
          box-sizing: border-box;
          margin: 0;
          position: relative;
        }

        .pesquisa-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--titan-radius-xl);
          box-shadow: var(--titan-shadow-sm);
          padding: var(--titan-spacing-2xl);
          max-width: 800px;
          width: 100%;
          text-align: center;
          margin: var(--titan-spacing-lg) auto;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .header {
          margin-bottom: var(--titan-spacing-2xl);
        }

        .logo-container {
          margin-bottom: var(--titan-spacing-lg);
        }

        .logo {
          max-width: 120px;
          max-height: 120px;
          border-radius: var(--titan-radius-lg);
          box-shadow: var(--titan-shadow-sm);
        }

        h1 {
          color: var(--titan-text-ice);
          margin: 0 0 var(--titan-spacing-md) 0;
          font-size: var(--titan-font-size-4xl);
          font-weight: var(--titan-font-weight-bold);
          line-height: var(--titan-line-height-tight);
        }

        .empresa-nome {
          color: var(--titan-text-high);
          font-size: var(--titan-font-size-xl);
          font-weight: var(--titan-font-weight-semibold);
          margin: 0 0 var(--titan-spacing-md) 0;
        }

        .franqueado-info {
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-lg);
          margin: 0 0 var(--titan-spacing-md) 0;
        }

        .descricao {
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-lg);
          line-height: var(--titan-line-height-relaxed);
          margin: 0;
        }

        .formulario {
          text-align: left;
        }

        .pergunta-section {
          margin-bottom: var(--titan-spacing-xl);
          padding: var(--titan-spacing-lg);
          background: rgba(255, 255, 255, 0.01);
          border-radius: var(--titan-radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .pergunta-label {
          display: block;
          color: var(--titan-text-ice);
          font-size: var(--titan-font-size-lg);
          font-weight: var(--titan-font-weight-semibold);
          margin-bottom: var(--titan-spacing-md);
        }

        .pergunta-descricao {
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-base);
          line-height: var(--titan-line-height-relaxed);
          margin-bottom: var(--titan-spacing-md);
        }

        .notas-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--titan-spacing-lg);
          gap: var(--titan-spacing-sm);
          flex-wrap: wrap;
          max-width: 100%;
        }

        .nota {
          width: 50px;
          height: 50px;
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.02);
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-lg);
          font-weight: var(--titan-font-weight-semibold);
          cursor: pointer;
          transition: all var(--titan-transition-normal);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nota:hover {
          transform: scale(1.1);
          box-shadow: var(--titan-shadow-sm);
          border-color: var(--titan-primary);
          background: rgba(0, 76, 255, 0.1);
        }

        .nota.vermelha {
          border-color: rgba(255, 92, 92, 0.6);
          color: rgba(255, 92, 92, 0.8);
        }

        .nota.amarela {
          border-color: rgba(255, 202, 58, 0.6);
          color: rgba(255, 202, 58, 0.8);
        }

        .nota.verde {
          border-color: rgba(46, 229, 182, 0.6);
          color: rgba(46, 229, 182, 0.8);
        }

        .nota.selecionada {
          transform: scale(1.15);
          box-shadow: var(--titan-shadow-md);
        }

        .nota.selecionada.vermelha {
          background: rgba(255, 92, 92, 0.2);
          border-color: rgba(255, 92, 92, 0.8);
          color: rgba(255, 92, 92, 1);
        }

        .nota.selecionada.amarela {
          background: rgba(255, 202, 58, 0.2);
          border-color: rgba(255, 202, 58, 0.8);
          color: rgba(255, 202, 58, 1);
        }

        .nota.selecionada.verde {
          background: rgba(46, 229, 182, 0.2);
          border-color: rgba(46, 229, 182, 0.8);
          color: rgba(46, 229, 182, 1);
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: var(--titan-spacing-md);
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: var(--titan-spacing-sm);
          cursor: pointer;
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-base);
          transition: color var(--titan-transition-fast);
        }

        .checkbox-item:hover {
          color: var(--titan-text-high);
        }

        .checkbox-item input[type="checkbox"] {
          display: none;
        }

        .checkmark {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--titan-radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.02);
          transition: all var(--titan-transition-fast);
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark {
          background: rgba(0, 76, 255, 0.3);
          border-color: rgba(0, 76, 255, 0.6);
          box-shadow: 0 0 8px rgba(0, 76, 255, 0.2);
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark::after {
          content: '✓';
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .departamento-section {
          margin-bottom: var(--titan-spacing-xl);
          padding: var(--titan-spacing-lg);
          background: rgba(0, 76, 255, 0.02);
          border-radius: var(--titan-radius-lg);
          border: 1px solid rgba(0, 76, 255, 0.05);
        }

        .departamento-titulo {
          color: var(--titan-text-ice);
          font-size: var(--titan-font-size-xl);
          font-weight: var(--titan-font-weight-semibold);
          margin: 0 0 var(--titan-spacing-lg) 0;
          text-align: center;
        }

        .comentario-input {
          width: 100%;
          padding: var(--titan-spacing-md);
          border: 2px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--titan-radius-lg);
          font-size: var(--titan-font-size-base);
          font-family: inherit;
          resize: vertical;
          transition: all var(--titan-transition-normal);
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.02);
          color: var(--titan-text-med);
        }

        .comentario-input:focus {
          outline: none;
          border-color: rgba(0, 76, 255, 0.4);
          box-shadow: 0 0 8px rgba(0, 76, 255, 0.15);
          background: rgba(255, 255, 255, 0.03);
          color: var(--titan-text-high);
        }

        .comentario-input::placeholder {
          color: var(--titan-text-low);
        }

        .comentario-section {
          margin-top: var(--titan-spacing-md);
        }

        .comentario-label {
          display: block;
          color: var(--titan-text-med);
          font-size: var(--titan-font-size-base);
          font-weight: var(--titan-font-weight-medium);
          margin-bottom: var(--titan-spacing-sm);
        }

        .botao-enviar {
          width: 100%;
          padding: var(--titan-spacing-md) var(--titan-spacing-xl);
          background: linear-gradient(135deg, rgba(0, 76, 255, 0.8) 0%, rgba(123, 77, 255, 0.8) 100%);
          color: white;
          border: none;
          border-radius: var(--titan-radius-lg);
          font-size: var(--titan-font-size-lg);
          font-weight: var(--titan-font-weight-semibold);
          cursor: pointer;
          transition: all var(--titan-transition-normal);
          box-shadow: var(--titan-shadow-sm);
        }

        .botao-enviar:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--titan-shadow-md);
          box-shadow: 0 0 12px rgba(0, 76, 255, 0.3);
        }

        .botao-enviar:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .error-card,
        .success-card,
        .loading-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--titan-radius-xl);
          box-shadow: var(--titan-shadow-sm);
          padding: var(--titan-spacing-2xl);
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        .error-card h1 {
          color: var(--titan-error);
        }

        .success-card h1 {
          color: var(--titan-success);
        }

        .loading-card .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--titan-stroke);
          border-top: 4px solid var(--titan-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto var(--titan-spacing-lg);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .container {
            padding: var(--titan-spacing-md);
            display: block;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            width: 100%;
            max-width: 100vw;
          }

          .pesquisa-card {
            padding: var(--titan-spacing-lg);
            margin: var(--titan-spacing-md) auto;
            width: 100%;
            max-width: calc(100vw - 2 * var(--titan-spacing-md));
            box-sizing: border-box;
          }

          h1 {
            font-size: var(--titan-font-size-3xl);
          }

          .notas-container {
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--titan-spacing-sm);
            max-width: 100%;
          }

          .nota {
            width: 45px;
            height: 45px;
            font-size: var(--titan-font-size-base);
          }

          .pergunta-section {
            padding: var(--titan-spacing-md);
            width: 100%;
            box-sizing: border-box;
          }
        }

        /* Garantir scroll em todos os navegadores */
        html, body {
          overflow-x: hidden;
          width: 100%;
          max-width: 100%;
          height: 100%;
        }

        * {
          box-sizing: border-box;
        }

        /* Forçar scroll no container */
        .container {
          height: auto;
          min-height: 100vh;
          overflow-y: scroll !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: var(--titan-primary) rgba(255, 255, 255, 0.1);
        }

        .container::-webkit-scrollbar {
          width: 8px;
        }

        .container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .container::-webkit-scrollbar-thumb {
          background: var(--titan-primary);
          border-radius: 4px;
        }

        .container::-webkit-scrollbar-thumb:hover {
          background: var(--titan-primary-hover);
        }
      `}</style>
    </div>
  );
}
