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
import { BookOpen, Plus, Users, CheckCircle } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { id } = router.query
  const [tab, setTab] = useState('conteudo')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showConteudoModal, setShowConteudoModal] = useState(false)
  const [userRole, setUserRole] = useState(null)


  useEffect(() => {
    // validar id
    if (!id) return
    
    // Verificar role do usuário
    const userData = localStorage.getItem('userData')
    
    if (userData) {
      try {
        const user = JSON.parse(userData)
        const isSuperadmin = Array.isArray(user?.permissoes?.adm) && 
                            user.permissoes.adm.includes('superadmin')
        setUserRole(isSuperadmin ? 'superadmin' : null)
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
            userRole={userRole}
          />
          <main className={styles.main}>
            {/* Header */}
            <div className={styles.header}>
              <div>
                <h1 className={styles.headerTitle}>
                  <BookOpen size={32} />
                  Módulo {id}
                </h1>
                <p className={styles.headerSubtitle}>
                  Gerencie conteúdos, provas e acompanhe o progresso dos usuários
                </p>
              </div>
              {userRole === 'superadmin' && (
                <button 
                  className={styles.addButton}
                  onClick={() => setShowConteudoModal(true)}
                >
                  <Plus size={20} />
                  Novo Conteúdo
                </button>
              )}
            </div>

            {/* Content Sections */}
            {tab === 'conteudo' && (
              <ConteudoList moduloId={id} userRole={userRole} />
            )}
            
            {tab === 'provas' && userRole === 'superadmin' && (
              <div className={styles.contentSection}>
                <h2 className={styles.contentSectionTitle}>
                  <Users size={20} />
                  Gerenciar Provas
                </h2>
                <ProvaList moduloId={id} />
              </div>
            )}
            
            {tab === 'conclusoes' && (
              <div className={styles.contentSection}>
                <h2 className={styles.contentSectionTitle}>
                  <CheckCircle size={20} />
                  Conclusões e Relatórios
                </h2>
                <ConclusoesList moduloId={id} />
              </div>
            )}
          </main>
        </div>
      </div>
      
      {showConteudoModal && (
        <ConteudoModal 
          isOpen={showConteudoModal}
          moduloId={id}
          onClose={() => setShowConteudoModal(false)}
        />
      )}
    </div>
  )
}


