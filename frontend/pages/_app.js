import '../styles/globals.css'
import { useAuth } from '../utils/auth'
import Head from 'next/head'; // Importa o Head
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  const auth = useAuth()

  return (
    <div>
      <Head>
        <title>Aura8</title>
        <link rel="icon" href="/img/favicon-32x32.png" type="image/png" />
      </Head>
      <Component {...pageProps} auth={auth} />
    </div>
  )
}

