import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import OnboardingSidebar from '../../components/onboarding/Sidebar'
import ConteudoList from '../../components/onboarding/ConteudoList'
import styles from '../../styles/onboarding.module.css'
import Topbar from '../../components/onboarding/Topbar'

export default function OnboardingPage() {
  const router = useRouter()
  const { id } = router.query
  const [tab, setTab] = useState('conteudo')

  useEffect(() => {
    // validar id
    if (!id) return
  }, [id])

  return (
    <div className={styles.page}>
      <Head>
        <title>Onboarding - Módulo {id}</title>
      </Head>
      <Topbar />
      <div className={styles.layout}>
        <div className={styles.contentWrapper}>
          <OnboardingSidebar currentTab={tab} onChangeTab={setTab} />
          <main className={styles.main}>
            {tab === 'conteudo' && <ConteudoList moduloId={id} />}
          </main>
        </div>
      </div>
    </div>
  )
}


