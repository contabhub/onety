import { useRouter } from 'next/router';
import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/login.module.css';
import ThemeToggle from '../components/menu/ThemeToggle';
import Link from 'next/link';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [dots, setDots] = useState('');
    const router = useRouter();




    return (
        <div>
            <Head>
                <title>Login - Onety</title>
            </Head>


            <div className={styles.background}>
                <div className={styles.videoContainer}>
                    <img
                        src="/img/Onety-Login.gif"
                        alt="Background GIF"
                        className={styles.videoBackground}
                    />
                </div>

                <div className={styles.leftContainer}>
                    <img src='/imagens/logo-branca-tax.png' alt='logo' className={styles.logo} />
                    <h1>O Futuro Chegou!</h1>
                    <p>Venha fazer parte da Evolução!</p>
                </div>
                <div className={styles.rightContainer} style={{ alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <ThemeToggle />
                    </div>
                    <div className={styles.formContainer}>
                        <form>
                            <h1>Login</h1>
                            <p>Preencha os dados abaixo e venha fazer parte da Evolução!</p>
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="Nome de usuário ou endereço de e-mail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <label>Senha</label>
                            <input
                                type="password"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button type="submit" disabled={loading}>{loading ? `Acessando${dots}` : 'Acessar'}</button>
                            {error && <p className={styles.error}>{error}</p>}
                        </form>
                        <div className={styles.forgotPasswordContainer}>
                            <a href="/ResetPassword" className={styles.forgotPassword}>Esqueci minha senha</a>
                        </div>
                        {/* <div className={styles.forgotPasswordContainer}>
                            <p className={styles.paragraph}>ou</p>
                        </div>
                        <div className={styles.forgotPasswordContainer}>
                            <p>Não possui conta?&nbsp;</p><a href="/signup" className={styles.forgotPassword}> Cadastre-se aqui.</a>
                        </div> */}
                    </div>
                </div>
            </div>

        </div>
    );
}