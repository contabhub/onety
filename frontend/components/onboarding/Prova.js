import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './Prova.module.css'

export default function Prova({ conteudoId, onVoltar }) {
  const router = useRouter()
  const [prova, setProva] = useState(null)
  const [questoes, setQuestoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [respostas, setRespostas] = useState({}) // { questaoId: alternativaId }
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (conteudoId) {
      loadProva()
    }
  }, [conteudoId])

  const loadProva = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setLoading(true)
    setError('')

    try {
      // 1. Buscar prova por conteudo_id
      const provaRes = await fetch(`${API_URL}/prova/conteudo/${conteudoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })

      if (!provaRes.ok) throw new Error('Falha ao carregar prova')
      const provaData = await provaRes.json()
      
      if (!provaData?.data || provaData.data.length === 0) {
        setError('Nenhuma prova encontrada para este conteúdo')
        return
      }

      const provaAtual = provaData.data[0]
      setProva(provaAtual)

      // 2. Buscar questões da prova
      const questoesRes = await fetch(`${API_URL}/questao/prova/${provaAtual.id}?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })

      if (!questoesRes.ok) throw new Error('Falha ao carregar questões')
      const questoesData = await questoesRes.json()
      const todasQuestoes = Array.isArray(questoesData?.data) ? questoesData.data : []

      if (todasQuestoes.length === 0) {
        setError('Nenhuma questão encontrada nesta prova')
        return
      }

      // 3. Buscar alternativas para cada questão
      const questoesComAlternativas = await Promise.all(
        todasQuestoes.map(async (questao) => {
          const altRes = await fetch(`${API_URL}/alternativa/questao/${questao.id}?limit=10`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          if (!altRes.ok) return { ...questao, alternativas: [] }
          
          const altData = await altRes.json()
          const alternativas = Array.isArray(altData?.data) ? altData.data : []
          
          return {
            ...questao,
            alternativas
          }
        })
      )

      setQuestoes(questoesComAlternativas)

    } catch (e) {
      setError(e.message || 'Erro ao carregar prova')
    } finally {
      setLoading(false)
    }
  }

  const handleSelecionarResposta = (questaoId, alternativaId) => {
    if (resultado) return // Não permitir mudanças após enviar

    setRespostas(prev => ({
      ...prev,
      [questaoId]: alternativaId
    }))
  }

  const handleEnviarProva = async () => {
    // Verificar se todas as questões foram respondidas
    const questoesRespondidas = Object.keys(respostas).length
    if (questoesRespondidas < questoes.length) {
      alert(`Por favor, responda todas as ${questoes.length} questões antes de enviar.`)
      return
    }

    setEnviando(true)

    try {
      // Calcular resultado localmente
      let acertos = 0
      const resultadoPorQuestao = {}

      questoes.forEach(questao => {
        const respostaSelecionada = respostas[questao.id]
        const alternativaCorreta = questao.alternativas.find(alt => alt.correto === 1)
        const acertou = respostaSelecionada === alternativaCorreta?.id

        if (acertou) acertos++

        resultadoPorQuestao[questao.id] = {
          acertou,
          respostaSelecionada,
          respostaCorreta: alternativaCorreta?.id
        }
      })

      const porcentagem = Math.round((acertos / questoes.length) * 100)
      const aprovado = porcentagem >= 70 // Considera aprovado com 70% ou mais

      setResultado({
        acertos,
        total: questoes.length,
        porcentagem,
        aprovado,
        detalhes: resultadoPorQuestao
      })

      // Aqui você pode adicionar uma chamada à API para salvar o resultado
      // await fetch(`${API_URL}/prova-empresa`, { ... })

    } catch (e) {
      setError(e.message || 'Erro ao processar prova')
    } finally {
      setEnviando(false)
    }
  }

  const handleRefazer = () => {
    setRespostas({})
    setResultado(null)
  }

  const handleVoltar = () => {
    if (onVoltar) {
      onVoltar()
    } else {
      router.back()
    }
  }

  if (loading) {
    return <div className={styles.placeholder}>Carregando prova...</div>
  }

  if (error) {
    return (
      <div className={styles.container}>
        <button onClick={handleVoltar} className={styles.backButton}>
          ← Voltar
        </button>
        <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
      </div>
    )
  }

  if (!prova || !questoes.length) {
    return (
      <div className={styles.container}>
        <button onClick={handleVoltar} className={styles.backButton}>
          ← Voltar
        </button>
        <div className={styles.placeholder}>Nenhuma prova disponível.</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Botão de voltar */}
      <button onClick={handleVoltar} className={styles.backButton}>
        ← Voltar ao conteúdo
      </button>

      {/* Header da prova */}
      <div className={styles.header}>
        <h2 className={styles.provaTitle}>{prova.nome}</h2>
        <div className={styles.provaInfo}>
          <span>{questoes.length} questões</span>
          {resultado && (
            <span className={resultado.aprovado ? styles.aprovado : styles.reprovado}>
              Nota: {resultado.porcentagem}%
            </span>
          )}
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className={`${styles.resultadoBox} ${resultado.aprovado ? styles.aprovadoBox : styles.reprovadoBox}`}>
          <h3>{resultado.aprovado ? '🎉 Parabéns! Você foi aprovado!' : '😔 Você não atingiu a nota mínima'}</h3>
          <p>Você acertou {resultado.acertos} de {resultado.total} questões ({resultado.porcentagem}%)</p>
          <div className={styles.resultadoActions}>
            <button onClick={handleRefazer} className={styles.refazerButton}>
              ↻ Refazer Prova
            </button>
            <button onClick={handleVoltar} className={styles.voltarButton}>
              ← Voltar ao Conteúdo
            </button>
          </div>
        </div>
      )}

      {/* Lista de questões */}
      <div className={styles.questoesList}>
        {questoes.map((questao, index) => {
          const respostaSelecionada = respostas[questao.id]
          const detalhesResultado = resultado?.detalhes?.[questao.id]

          return (
            <div key={questao.id} className={styles.questaoCard}>
              <div className={styles.questaoHeader}>
                <span className={styles.questaoNumero}>Questão {index + 1}</span>
                {detalhesResultado && (
                  <span className={detalhesResultado.acertou ? styles.acerto : styles.erro}>
                    {detalhesResultado.acertou ? '✓ Correto' : '✗ Incorreto'}
                  </span>
                )}
              </div>
              
              <p className={styles.enunciado}>{questao.enunciado}</p>

              <div className={styles.alternativasList}>
                {questao.alternativas.map((alternativa) => {
                  const selecionada = respostaSelecionada === alternativa.id
                  const correta = alternativa.correto === 1
                  const mostrarResultado = resultado && detalhesResultado

                  let classeAlternativa = styles.alternativaItem
                  
                  if (selecionada) {
                    classeAlternativa += ` ${styles.selecionada}`
                  }
                  
                  if (mostrarResultado) {
                    if (correta) {
                      classeAlternativa += ` ${styles.alternativaCorreta}`
                    } else if (selecionada && !correta) {
                      classeAlternativa += ` ${styles.alternativaErrada}`
                    }
                  }

                  return (
                    <button
                      key={alternativa.id}
                      className={classeAlternativa}
                      onClick={() => handleSelecionarResposta(questao.id, alternativa.id)}
                      disabled={!!resultado}
                    >
                      <span className={styles.alternativaOpcao}>
                        {String.fromCharCode(65 + questao.alternativas.indexOf(alternativa))}
                      </span>
                      <span className={styles.alternativaTexto}>{alternativa.opcao}</span>
                      {mostrarResultado && correta && (
                        <span className={styles.marcadorCorreto}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Botão de enviar */}
      {!resultado && (
        <div className={styles.submitArea}>
          <button 
            onClick={handleEnviarProva}
            disabled={enviando || Object.keys(respostas).length < questoes.length}
            className={styles.submitButton}
          >
            {enviando ? 'Enviando...' : 'Enviar Prova'}
          </button>
          <p className={styles.progressoResposta}>
            {Object.keys(respostas).length} de {questoes.length} questões respondidas
          </p>
        </div>
      )}
    </div>
  )
}

