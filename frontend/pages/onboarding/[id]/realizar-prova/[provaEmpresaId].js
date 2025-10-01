import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { toast } from 'react-toastify'
import styles from '../../../../styles/onety/onboarding/onboarding.module.css'
import Topbar from '../../../../components/onety/onboarding/Topbar'
import OnboardingSidebar from '../../../../components/onety/onboarding/Sidebar'
import SpaceLoader from '../../../../components/onety/menu/SpaceLoader'
import { CheckCircle, Clock, Trophy, ArrowLeft } from 'lucide-react'

export default function RealizarProvaPage() {
  const router = useRouter()
  const { id: moduloId, provaEmpresaId } = router.query
  const [provaEmpresa, setProvaEmpresa] = useState(null)
  const [prova, setProva] = useState(null)
  const [questoes, setQuestoes] = useState([])
  const [alternativas, setAlternativas] = useState({})
  const [respostas, setRespostas] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    if (provaEmpresaId) {
      loadProvaData()
    }
  }, [provaEmpresaId])

  const loadProvaData = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    console.log('API_URL:', API_URL)
    console.log('provaEmpresaId:', provaEmpresaId)

    setLoading(true)
    setError('')
    
    try {
      // Testar conectividade com o backend primeiro
      console.log('Testando conectividade com backend...')
      try {
        const testRes = await fetch(`${API_URL}/`, { 
          method: 'GET',
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        console.log('Backend respondeu com status:', testRes.status)
      } catch (testError) {
        console.error('Erro ao conectar com backend:', testError)
        throw new Error('Backend não está rodando. Verifique se o servidor está ativo na porta 3000.')
      }

      // 1. Buscar informações da prova_empresa
      console.log('Buscando prova_empresa:', `${API_URL}/prova-empresa/${provaEmpresaId}`)
      const provaEmpresaRes = await fetch(`${API_URL}/prova-empresa/${provaEmpresaId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      console.log('provaEmpresaRes status:', provaEmpresaRes.status)
      if (!provaEmpresaRes.ok) {
        const errorText = await provaEmpresaRes.text()
        console.error('Erro ao buscar prova_empresa:', errorText)
        throw new Error('Falha ao carregar prova')
      }
      const provaEmpresaData = await provaEmpresaRes.json()
      console.log('provaEmpresaData:', provaEmpresaData)
      setProvaEmpresa(provaEmpresaData)

      // 2. Buscar informações da prova
      console.log('Buscando prova:', `${API_URL}/prova/${provaEmpresaData.prova_id}`)
      const provaRes = await fetch(`${API_URL}/prova/${provaEmpresaData.prova_id}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      console.log('provaRes status:', provaRes.status)
      if (!provaRes.ok) {
        const errorText = await provaRes.text()
        console.error('Erro ao buscar prova:', errorText)
        throw new Error('Falha ao carregar detalhes da prova')
      }
      const provaData = await provaRes.json()
      console.log('provaData:', provaData)
      setProva(provaData)

      // 3. Buscar questões da prova
      console.log('Buscando questões:', `${API_URL}/questao/prova/${provaEmpresaData.prova_id}`)
      const questoesRes = await fetch(`${API_URL}/questao/prova/${provaEmpresaData.prova_id}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      console.log('questoesRes status:', questoesRes.status)
      if (!questoesRes.ok) {
        const errorText = await questoesRes.text()
        console.error('Erro ao buscar questões:', errorText)
        throw new Error('Falha ao carregar questões')
      }
      const questoesResponse = await questoesRes.json()
      console.log('questoesResponse:', questoesResponse)
      
      // A API retorna { data: [], page, limit, total }
      const questoesData = questoesResponse.data || []
      console.log('questoesData (array):', questoesData)
      
      // Validar se questoesData é um array
      if (!Array.isArray(questoesData)) {
        console.error('questoesData não é um array:', questoesData)
        throw new Error('Formato de dados inválido - questões não encontradas')
      }
      
      setQuestoes(questoesData)

      // 4. Buscar alternativas para cada questão
      const alternativasData = {}
      for (const questao of questoesData) {
        const altRes = await fetch(`${API_URL}/alternativa/questao/${questao.id}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        
        if (altRes.ok) {
          const altResponse = await altRes.json()
          // A API retorna { data: [], page, limit, total }
          const altData = altResponse.data || []
          alternativasData[questao.id] = altData
        }
      }
      setAlternativas(alternativasData)

    } catch (e) {
      setError(e.message || 'Erro ao carregar prova')
      toast.error(e.message || 'Erro ao carregar prova')
    } finally {
      setLoading(false)
    }
  }

  const handleRespostaChange = (questaoId, alternativaId) => {
    setRespostas(prev => ({
      ...prev,
      [questaoId]: alternativaId
    }))
  }

  const submitProva = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setSubmitting(true)
    
    try {
      // Converter respostas para o formato esperado pela API
      const respostasArray = Object.entries(respostas).map(([questao_id, alternativa_id]) => ({
        questao_id: parseInt(questao_id),
        alternativa_id: parseInt(alternativa_id)
      }))

      console.log('=== DEBUG FRONTEND ===');
      console.log('Respostas do usuário:', respostas);
      console.log('Respostas formatadas para API:', respostasArray);
      console.log('=== FIM DEBUG FRONTEND ===');

      const res = await fetch(`${API_URL}/prova-empresa/${provaEmpresaId}/calcular-media`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ respostas: respostasArray })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao submeter prova')
      }
      
      const resultadoData = await res.json()
      setResultado(resultadoData)
      toast.success('Prova enviada com sucesso!')
      
    } catch (e) {
      toast.error(e.message || 'Erro ao submeter prova')
    } finally {
      setSubmitting(false)
    }
  }

  const voltarParaModulo = () => {
    router.push(`/onboarding/${moduloId}`)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Carregando Prova - Onety</title>
        </Head>
        <Topbar />
        <div className={styles.content}>
          <OnboardingSidebar 
            currentTab="provas" 
            onChangeTab={() => {}} 
            onCollapseChange={setSidebarCollapsed}
            collapsed={sidebarCollapsed}
          />
          <main className={styles.main}>
            <SpaceLoader label="Carregando prova..." />
          </main>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Erro - Onety</title>
        </Head>
        <Topbar />
        <div className={styles.content}>
          <OnboardingSidebar 
            currentTab="provas" 
            onChangeTab={() => {}} 
            onCollapseChange={setSidebarCollapsed}
            collapsed={sidebarCollapsed}
          />
          <main className={styles.main}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <h2>Erro ao carregar prova</h2>
              <p>{error}</p>
              <button onClick={voltarParaModulo} style={{ marginTop: '16px' }}>
                <ArrowLeft size={16} />
                Voltar para o Módulo
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (resultado) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Resultado da Prova - Onety</title>
        </Head>
        <Topbar />
        <div className={styles.content}>
          <OnboardingSidebar 
            currentTab="provas" 
            onChangeTab={() => {}} 
            onCollapseChange={setSidebarCollapsed}
            collapsed={sidebarCollapsed}
          />
          <main className={styles.main}>
            <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ 
                background: resultado.aprovado ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${resultado.aprovado ? '#16a34a' : '#dc2626'}`,
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                  {resultado.aprovado ? '🎉' : '😔'}
                </div>
                <h2 style={{ 
                  color: resultado.aprovado ? '#16a34a' : '#dc2626',
                  margin: '0 0 8px 0'
                }}>
                  {resultado.aprovado ? 'Parabéns! Você foi aprovado!' : 'Você não foi aprovado desta vez'}
                </h2>
                <p style={{ margin: '0 0 24px 0', color: '#6b7280' }}>
                  {prova?.nome}
                </p>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                      {resultado.nota.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Nota</div>
                  </div>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                      {resultado.porcentagem.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Acertos</div>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#6b7280',
                  marginBottom: '24px'
                }}>
                  <span>✅ {resultado.acertos} acertos</span>
                  <span>❌ {resultado.erros} erros</span>
                  <span>📝 {resultado.total_questoes} questões</span>
                </div>

                <button 
                  onClick={voltarParaModulo}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: '0 auto'
                  }}
                >
                  <ArrowLeft size={16} />
                  Voltar para o Módulo
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{prova?.nome || 'Prova'} - Onety</title>
      </Head>
      <Topbar />
      <div className={styles.content}>
        <OnboardingSidebar 
          currentTab="provas" 
          onChangeTab={() => {}} 
          onCollapseChange={setSidebarCollapsed}
          collapsed={sidebarCollapsed}
        />
        <main className={styles.main}>
          <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header da Prova */}
            <div style={{ 
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>
                {prova?.nome}
              </h1>
              <p style={{ margin: '0 0 16px 0', color: '#64748b' }}>
                {prova?.descricao || 'Realize a prova com atenção e boa sorte!'}
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '16px',
                fontSize: '14px',
                color: '#64748b'
              }}>
                <span>📝 {questoes.length} questões</span>
                <span>⏱️ Tempo livre</span>
                <span>📊 Múltipla escolha</span>
              </div>
            </div>

            {/* Questões */}
            <div style={{ marginBottom: '24px' }}>
              {questoes.map((questao, index) => (
                <div key={questao.id} style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0',
                    fontSize: '18px',
                    color: '#111827'
                  }}>
                    {index + 1}. {questao.enunciado}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alternativas[questao.id]?.map((alt, altIndex) => (
                      <label key={alt.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: respostas[questao.id] === alt.id ? '#eff6ff' : 'white'
                      }}>
                        <input
                          type="radio"
                          name={`questao_${questao.id}`}
                          value={alt.id}
                          checked={respostas[questao.id] === alt.id}
                          onChange={() => handleRespostaChange(questao.id, alt.id)}
                          style={{ marginRight: '12px' }}
                        />
                        <span style={{ 
                          fontWeight: '500',
                          color: respostas[questao.id] === alt.id ? '#3b82f6' : '#111827'
                        }}>
                          {String.fromCharCode(65 + altIndex)}. {alt.opcao}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Botão de Submissão */}
            <div style={{ 
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>
                  Respondidas: {Object.keys(respostas).length} de {questoes.length} questões
                </span>
              </div>
              
              <button
                onClick={submitProva}
                disabled={submitting || Object.keys(respostas).length === 0}
                style={{
                  background: Object.keys(respostas).length === 0 ? '#e2e8f0' : '#16a34a',
                  color: Object.keys(respostas).length === 0 ? '#64748b' : 'white',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: Object.keys(respostas).length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                {submitting ? (
                  <>
                    <Clock size={20} />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Finalizar Prova
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
