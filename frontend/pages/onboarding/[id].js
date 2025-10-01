import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import OnboardingSidebar from '../../components/onety/onboarding/Sidebar'
import ConteudoList from '../../components/onety/onboarding/ConteudoList'
import ProvaList from '../../components/onety/onboarding/ProvaList'
import ConclusoesList from '../../components/onety/onboarding/ConclusoesList'
import styles from '../../styles/onety/onboarding/onboarding.module.css'
import Topbar from '../../components/onety/onboarding/Topbar'

export default function OnboardingPage() {
  const router = useRouter()
  const { id } = router.query
  const [tab, setTab] = useState('conteudo')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    // validar id
    if (!id) return
  }, [id])

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
            {tab === 'conteudo' && <ConteudoList moduloId={id} />}
            {tab === 'provas' && <ProvaList moduloId={id} />}
            {tab === 'conclusoes' && <ConclusoesList moduloId={id} />}
          </main>
        </div>
      </div>
    </div>
  )
}


