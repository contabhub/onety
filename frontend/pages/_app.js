import '../styles/globals.css'
import { useAuth } from '../utils/auth'
import Head from 'next/head'; // Importa o Head
import { useEffect } from 'react'
import { Montserrat } from 'next/font/google'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useToastTheme } from '../hooks/useToastTheme'

const inter = Montserrat({ subsets: ['latin'], display: 'swap' })

export default function App({ Component, pageProps }) {
  const auth = useAuth()
  const toastTheme = useToastTheme()

  return (
    <div className={inter.className}>
      <Head>
        <title>Aura8</title>
        <link rel="icon" href="/img/favicon-32x32.png" type="image/png" />
      </Head>
      <Component {...pageProps} auth={auth} />
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={toastTheme}
        toastClassName="toast-custom"
      />
    </div>
  )
}

