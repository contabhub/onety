import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/redefinirsenha.module.css';
import ThemeToggle from '../components/menu/ThemeToggle';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useToastTheme } from '../hooks/useToastTheme';

export default function RedefinirSenha() {
    const [step, setStep] = useState(1); // 1: email, 2: código, 3: nova senha
    const [email, setEmail] = useState('');
    const [codigo, setCodigo] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [bgSrc, setBgSrc] = useState('/img/Onety-Login.gif');
    const router = useRouter();
    const theme = useToastTheme();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // Controla o GIF de fundo conforme o tema
    useEffect(() => {
        setBgSrc(theme === 'light' ? '/img/Onety-Light-Login.gif' : '/img/Onety-Login.gif');
    }, [theme]);

    // Passo 1: Solicitar código
    const handleRequestCode = async (e) => {
        e.preventDefault();
        
        if (!email.trim()) {
            toast.error('Por favor, informe seu email');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Por favor, informe um email válido');
            return;
        }
        
        setLoading(true);
        const loadingToast = toast.loading('Enviando código...');
        
        try {
            const res = await fetch(`${API_URL}/auth/requisitar-redefinicao-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            if (!res.ok) {
                throw new Error('Erro ao enviar código');
            }
            
            toast.dismiss(loadingToast);
            toast.success('Código enviado para seu email!');
            setStep(2);
            
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error('Erro ao enviar código. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Passo 2: Verificar código
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        
        if (!codigo.trim()) {
            toast.error('Por favor, informe o código');
            return;
        }
        
        if (codigo.length !== 6) {
            toast.error('O código deve ter 6 dígitos');
            return;
        }
        
        setLoading(true);
        const loadingToast = toast.loading('Verificando código...');
        
        try {
            const res = await fetch(`${API_URL}/auth/verificar-codigo-redefinicao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, codigo })
            });
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.dismiss(loadingToast);
                toast.error(data.error || 'Código inválido');
                return;
            }
            
            toast.dismiss(loadingToast);
            toast.success('Código válido!');
            setStep(3);
            
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error('Erro ao verificar código. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Passo 3: Redefinir senha
    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        if (!newPassword.trim()) {
            toast.error('Por favor, informe a nova senha');
            return;
        }
        
        if (!confirmPassword.trim()) {
            toast.error('Por favor, confirme a nova senha');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            toast.error('As senhas não coincidem');
            return;
        }
        
        if (newPassword.length < 6) {
            toast.error('A senha deve ter pelo menos 6 caracteres');
            return;
        }
        
        setLoading(true);
        const loadingToast = toast.loading('Redefinindo senha...');
        
        try {
            const res = await fetch(`${API_URL}/auth/redefinir-senha-com-codigo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, codigo, newPassword, confirmPassword })
            });
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.dismiss(loadingToast);
                toast.error(data.error || 'Erro ao redefinir senha');
                return;
            }
            
            toast.dismiss(loadingToast);
            toast.success('Senha redefinida com sucesso!');
            
            // Redirecionar para login após 2 segundos
            setTimeout(() => {
                router.push('/login');
            }, 2000);
            
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error('Erro ao redefinir senha. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className={styles.formContainer}>
                        <h1>Esqueci minha senha</h1>
                        <p>Digite seu email para receber o código de recuperação</p>
                        <form onSubmit={handleRequestCode}>
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
                            <button type="submit" disabled={loading}>
                                {loading ? 'Enviando...' : 'Enviar código'}
                            </button>
                        </form>
                        <div className={styles.backContainer}>
                            <Link href="/login" className={styles.backLink}>
                                ← Voltar para o login
                            </Link>
                        </div>
                    </div>
                );
            
            case 2:
                return (
                    <div className={styles.formContainer}>
                        <h1>Verificar código</h1>
                        <p>Digite o código de 6 dígitos enviado para {email}</p>
                        <form onSubmit={handleVerifyCode}>
                            <div className={styles.inputGroup}>
                                <span className={styles.inputIcon} aria-hidden>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    placeholder="Código de 6 dígitos"
                                    value={codigo}
                                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength="6"
                                    style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '18px' }}
                                />
                            </div>
                            <button type="submit" disabled={loading}>
                                {loading ? 'Verificando...' : 'Verificar código'}
                            </button>
                        </form>
                        <div className={styles.backContainer}>
                            <button 
                                type="button" 
                                className={styles.backButton}
                                onClick={() => setStep(1)}
                            >
                                ← Voltar
                            </button>
                        </div>
                    </div>
                );
            
            case 3:
                return (
                    <div className={styles.formContainer}>
                        <h1>Nova senha</h1>
                        <p>Digite sua nova senha</p>
                        <form onSubmit={handleResetPassword}>
                            <div className={styles.inputGroup}>
                                <span className={styles.inputIcon} aria-hidden>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </span>
                                <input
                                    type="password"
                                    placeholder="Nova senha"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
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
                                    placeholder="Confirmar nova senha"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <button type="submit" disabled={loading}>
                                {loading ? 'Redefinindo...' : 'Redefinir senha'}
                            </button>
                        </form>
                        <div className={styles.backContainer}>
                            <button 
                                type="button" 
                                className={styles.backButton}
                                onClick={() => setStep(2)}
                            >
                                ← Voltar
                            </button>
                        </div>
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div>
            <Head>
                <title>Redefinir Senha - Onety</title>
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
                    <h1>Recuperação de Senha</h1>
                    <p>Siga os passos para redefinir sua senha de forma segura</p>
                </div>
                
                <div className={styles.rightContainer} style={{ alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <ThemeToggle />
                    </div>
                    {renderStep()}
                </div>
            </div>
        </div>
    );
}
