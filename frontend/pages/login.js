import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/login.module.css';
import ThemeToggle from '../components/menu/ThemeToggle';
import Link from 'next/link';
import { toast } from 'react-toastify';

export default function Login({ auth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [dots, setDots] = useState('');
    const router = useRouter();

    // controla o GIF de fundo conforme o tema (dark/light)
    const [bgSrc, setBgSrc] = useState('/img/Onety-Login.gif');

    useEffect(() => {
        const resolveTheme = () => {
            try {
                const saved = localStorage.getItem('theme');
                const attr = document.documentElement.getAttribute('data-theme');
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = saved || attr || (prefersDark ? 'dark' : 'light');
                setBgSrc(theme === 'light' ? '/img/Onety-Light-Login.gif' : '/img/Onety-Login.gif');
            } catch {
                setBgSrc('/img/Onety-Login.gif');
            }
        };

        // inicial
        resolveTheme();

        // observar mudanças no atributo data-theme (mesma aba)
        const observer = new MutationObserver(() => resolveTheme());
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // fallback: mudanças em outras abas via localStorage
        const onStorage = (e) => {
            if (e.key === 'theme') resolveTheme();
        };
        window.addEventListener('storage', onStorage);

        return () => {
            observer.disconnect();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    // animação simples de reticências enquanto faz login
    useEffect(() => {
        if (!loading) {
            setDots('');
            return;
        }
        const id = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
        }, 300);
        return () => clearInterval(id);
    }, [loading]);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validações básicas
        if (!email.trim()) {
            toast.error('Por favor, informe seu email');
            return;
        }
        
        if (!password.trim()) {
            toast.error('Por favor, informe sua senha');
            return;
        }
        
        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Por favor, informe um email válido');
            return;
        }
        
        setError('');
        setLoading(true);
        
        // Toast de loading
        const loadingToast = toast.loading('Verificando credenciais...');
        
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha: password })
            });
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                
                // Tratamento específico de erros
                if (res.status === 401) {
                    toast.dismiss(loadingToast);
                    toast.error('Email ou senha incorretos');
                    setError('Email ou senha incorretos');
                    return;
                } else if (res.status === 404) {
                    toast.dismiss(loadingToast);
                    toast.error('Usuário não encontrado');
                    setError('Usuário não encontrado');
                    return;
                } else if (res.status === 429) {
                    toast.dismiss(loadingToast);
                    toast.error('Muitas tentativas. Tente novamente em alguns minutos');
                    setError('Muitas tentativas. Tente novamente em alguns minutos');
                    return;
                } else if (res.status >= 500) {
                    toast.dismiss(loadingToast);
                    toast.error('Servidor temporariamente indisponível. Tente novamente');
                    setError('Servidor temporariamente indisponível. Tente novamente');
                    return;
                }
                
                throw new Error(data?.error || 'Falha no login');
            }
            
            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            if (auth?.syncUserData) auth.syncUserData();
            
            // Toast de sucesso
            toast.dismiss(loadingToast);
            toast.success(`Login realizado com sucesso!`);
            
            // Pequeno delay para mostrar o toast antes de redirecionar
            setTimeout(() => {
                router.push('/empresa');
            }, 1000);
            
        } catch (err) {
            // Toast de erro genérico
            toast.dismiss(loadingToast);
            
            if (err.message.includes('fetch')) {
                toast.error('Erro de conexão. Verifique sua internet');
                setError('Erro de conexão. Verifique sua internet');
            } else {
                toast.error(err.message || 'Erro inesperado. Tente novamente');
                setError(err.message || 'Erro inesperado. Tente novamente');
            }
        } finally {
            setLoading(false);
        }
    };




    return (
        <div>
            <Head>
                <title>Login - Onety</title>
            </Head>


            <div className={styles.background}>
                <div className={styles.videoContainer}>
                    <img
                        src={bgSrc}
                        alt="Background GIF"
                        className={styles.videoBackground}
                    />
                </div>

                <div className={styles.leftContainer}>
                    <img src='/img/Logo-Onety.png?v=1' alt='logo' className={styles.logo} loading='eager' />
                    <h1>O Futuro Chegou!</h1>
                    <p>Venha fazer parte da Evolução!</p>
                </div>
                <div className={styles.rightContainer} style={{ alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <ThemeToggle />
                    </div>
                    <div className={styles.formContainer}>
                        <h1>Login</h1>
                        <p>Preencha os dados abaixo e venha fazer parte da Evolução!</p>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.inputGroup}>
                                <span className={styles.inputIcon} aria-hidden>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                </span>
                                <input
                                    type="email"
                                    placeholder="Digite seu e-mail"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <span className={styles.inputIcon} aria-hidden>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </span>
                                <input
                                    type="password"
                                    placeholder="Senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
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