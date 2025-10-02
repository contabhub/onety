import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import OnboardingSidebar from '../../components/onety/onboarding/Sidebar'
import ConteudoList from '../../components/onety/onboarding/ConteudoList'
import ProvaList from '../../components/onety/onboarding/ProvaList'
import ProvaLiberacao from '../../components/onety/onboarding/ProvaLiberacao'
import ConclusoesList from '../../components/onety/onboarding/ConclusoesList'
import ConteudoModal from '../../components/onety/onboarding/ConteudoModal'
import styles from '../../styles/onety/onboarding/onboarding.module.css'
import Topbar from '../../components/onety/onboarding/Topbar'
import SpaceLoader from '../../components/onety/menu/SpaceLoader'

export default function OnboardingPage() {
  const router = useRouter()
  const { id } = router.query
  const [tab, setTab] = useState('conteudo')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showConteudoModal, setShowConteudoModal] = useState(false)
  const [userRole, setUserRole] = useState(null)

  // Debug: Log do estado do modal
  useEffect(() => {
    console.log('🔍 Estado do modal:', showConteudoModal)
  }, [showConteudoModal])

  useEffect(() => {
    // validar id
    if (!id) return
    
    // Verificar role do usuário
    const userData = localStorage.getItem('userData')
    
    if (userData) {
      try {
        const user = JSON.parse(userData)
        const role = user.permissoes?.adm?.[0] || null
        setUserRole(role)
      } catch (err) {
        console.error('Erro ao decodificar userData:', err)
      }
    }
  }, [id])

  if (loading) {
    return (
      <div className={styles.page}>
        <Head>
          <title>Carregando...</title>
        </Head>
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <div className={styles.layout}>
          <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
            <main className={styles.main}>
              <SpaceLoader label="Carregando módulo..." />
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Onboarding - Módulo {id}</title>
      </Head>
      <Topbar sidebarCollapsed={sidebarCollapsed} />
      <div className={styles.layout}>
        <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
          <OnboardingSidebar 
            currentTab={tab} 
            onChangeTab={setTab} 
            onCollapseChange={setSidebarCollapsed}
          />
          <main className={styles.main}>
            {tab === 'conteudo' && (
              <div>
                {userRole === 'superadmin' && (
                  <div className={styles.adminActions}>
                    <button 
                      className={styles.addButton}
                      onClick={() => {
                        console.log('🔘 Botão "Novo Conteúdo" clicado')
                        setShowConteudoModal(true)
                      }}
                    >
                      + Novo Conteúdo
                    </button>
                  </div>
                )}
                <ConteudoList moduloId={id} />
                <ProvaLiberacao moduloId={id} />
              </div>
            )}
            {tab === 'provas' && <ProvaList moduloId={id} />}
            {tab === 'conclusoes' && <ConclusoesList moduloId={id} />}
          </main>
        </div>
      </div>
      
      {showConteudoModal && (
        <ConteudoModal 
          isOpen={showConteudoModal}
          moduloId={id}
          onClose={() => {
            console.log('❌ Fechando modal de conteúdo')
            setShowConteudoModal(false)
          }}
        />
      )}
    </div>
  )
}


