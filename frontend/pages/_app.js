import "../styles/globals.css";
import { useAuth } from "../utils/auth";
import Head from "next/head"; // Importa o Head
import { useEffect } from "react";
import { Montserrat } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useToastTheme } from "../hooks/useToastTheme";
import { useFranqueadoSurveyAlert } from "../hooks/useFranqueadoSurveyAlert";
import PesquisaFranqueadoAlertModal from "../components/onety/principal/PesquisaFranqueadoAlertModal";

const inter = Montserrat({ subsets: ["latin"], display: "swap" });

export default function App({ Component, pageProps }) {
  const auth = useAuth();
  const toastTheme = useToastTheme();
  const { data: alertaPesquisa, dismiss, openSurvey } =
    useFranqueadoSurveyAlert(auth.user);

  // Inicializa o tema do localStorage ao carregar a aplicação
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved || (prefersDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    } catch (error) {
      // Fallback para tema dark em caso de erro
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  return (
    <div className={inter.className}>
      <Head>
        <title>Onety</title>
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
      <PesquisaFranqueadoAlertModal
        open={!!alertaPesquisa}
        onClose={dismiss}
        onConfirm={openSurvey}
        mensagem={alertaPesquisa?.mensagem}
        total={alertaPesquisa?.total}
        franqueadoraNome={alertaPesquisa?.pesquisa?.franqueadoraNome}
      />
    </div>
  );
}
