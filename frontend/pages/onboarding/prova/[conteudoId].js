import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Head from 'next/head'
import Prova from '../../../components/onboarding/Prova'
import Topbar from '../../../components/onboarding/Topbar'
import styles from '../../../styles/onboarding.module.css'

export default function ProvaConteudoPage() {
  const router = useRouter()
  const { conteudoId } = router.query

  useEffect(() => {
    // Validar se há conteudoId
    if (!conteudoId) return
  }, [conteudoId])

  const voltarParaConteudo = () => {
    // Voltar para a página de onboarding
    const moduloId = router.query.moduloId
    if (moduloId) {
      router.push(`/onboarding/${moduloId}`)
    } else {
      router.back()
    }
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Prova - Onety</title>
      </Head>
      <Topbar sidebarCollapsed={true} />
      <div className={styles.layout}>
        <main className={styles.main}>
          <Prova 
            conteudoId={conteudoId} 
            onVoltar={voltarParaConteudo}
          />
        </main>
      </div>
    </div>
  )
}

