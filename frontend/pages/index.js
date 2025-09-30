import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, TrendingUp, FileText, DollarSign, Settings, Shield, Target } from 'lucide-react';
import styles from '../styles/index.module.css';
import ThemeToggle from '../components/menu/ThemeToggle';

export default function Home() {
    const [isLightTheme, setIsLightTheme] = useState(false);
    const [modulos, setModulos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logoSrc, setLogoSrc] = useState('/img/Logo-Onety-Preta.png');

    useEffect(() => {
        const resolveTheme = () => {
            try {
                const saved = localStorage.getItem('theme');
                const attr = document.documentElement.getAttribute('data-theme');
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = saved || attr || (prefersDark ? 'dark' : 'light');
                
                console.log('Theme detected:', theme); // Debug
                setIsLightTheme(theme === 'light');
                
                // Define a logo baseada no tema
                if (theme === 'dark') {
                    console.log('Setting dark logo'); // Debug
                    setLogoSrc('/img/Logo-Onety.png');
                } else {
                    console.log('Setting light logo'); // Debug
                    setLogoSrc('/img/Logo-Onety-Preta.png');
                }
            } catch (error) {
                console.error('Error resolving theme:', error);
                setIsLightTheme(false);
                setLogoSrc('/img/Logo-Onety-Preta.png');
            }
        };

        // Inicial
        resolveTheme();

        // Observar mudanças no atributo data-theme (mesma aba)
        const observer = new MutationObserver(() => resolveTheme());
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Fallback: mudanças em outras abas via localStorage
        const onStorage = (e) => {
            if (e.key === 'theme') resolveTheme();
        };
        window.addEventListener('storage', onStorage);

        return () => {
            observer.disconnect();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    // Buscar módulos da API
    useEffect(() => {
        const fetchModulos = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                const res = await fetch(`${API_URL}/modulos?limit=100`);
                
                if (res.ok) {
                    const data = await res.json();
                    const modulosData = Array.isArray(data?.data) ? data.data : [];
                    setModulos(modulosData);
                } else {
                    // Se falhar, usa os módulos estáticos como fallback
                    setModulos(modulesStatic);
                }
            } catch (error) {
                console.error('Erro ao buscar módulos:', error);
                // Se falhar, usa os módulos estáticos como fallback
                setModulos(modulesStatic);
            } finally {
                setLoading(false);
            }
        };

        fetchModulos();
    }, []);

    // Debug: monitorar mudanças na logo
    useEffect(() => {
        console.log('Logo changed to:', logoSrc);
    }, [logoSrc]);

    // Atualizar logo quando o tema mudar
    useEffect(() => {
        const updateLogo = () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            console.log('Current theme for logo update:', currentTheme);
            
            if (currentTheme === 'dark') {
                console.log('Setting dark logo (white)');
                setLogoSrc('/img/Logo-Onety.png');
            } else {
                console.log('Setting light logo (dark)');
                setLogoSrc('/img/Logo-Onety-Preta.png');
            }
        };

        // Verificar tema atual imediatamente
        updateLogo();

        // Observar mudanças no tema
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    console.log('Theme attribute changed');
                    updateLogo();
                }
            });
        });
        
        observer.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['data-theme'] 
        });

        return () => observer.disconnect();
    }, []);

    // Módulos estáticos como fallback
    const modulesStatic = [
        {
            id: 1,
            nome: 'Atendimento',
            descricao: 'Gerencie todos os canais de atendimento ao cliente de forma integrada e eficiente.',
            icon: <Users className={styles.moduleIcon} />
        },
        {
            id: 2,
            nome: 'Comercial',
            descricao: 'Controle vendas, leads e oportunidades com ferramentas avançadas de CRM.',
            icon: <TrendingUp className={styles.moduleIcon} />
        },
        {
            id: 3,
            nome: 'Contratual',
            descricao: 'Administre contratos, renovações e documentos legais em um só lugar.',
            icon: <FileText className={styles.moduleIcon} />
        },
        {
            id: 4,
            nome: 'Financeiro',
            descricao: 'Tenha controle total sobre fluxo de caixa, faturamento e análises financeiras.',
            icon: <DollarSign className={styles.moduleIcon} />
        },
        {
            id: 5,
            nome: 'Gestão de Processos',
            descricao: 'Otimize workflows e automatize processos para maior produtividade.',
            icon: <Settings className={styles.moduleIcon} />
        },
        {
            id: 6,
            nome: 'Auditoria',
            descricao: 'Monitore, analise e garanta conformidade com relatórios detalhados.',
            icon: <Shield className={styles.moduleIcon} />
        },
        {
            id: 7,
            nome: 'Estratégico',
            descricao: 'Tome decisões baseadas em dados com dashboards e análises estratégicas.',
            icon: <Target className={styles.moduleIcon} />
        }
    ];

    // Função para obter o logo do módulo (similar à página modulos.js)
    const getModuleLogo = (module) => {
        if (module?.logo_url) {
            return (
                <img 
                    src={module.logo_url} 
                    alt={`Logo do módulo ${module.nome || module.title}`}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        borderRadius: 'inherit'
                    }}
                />
            )
        }
        
        // Fallback para ícone padrão se não houver logo_url
        return module.icon
    }

  return (
    <div className={styles.landingPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <nav className={styles.nav}>
            <div className={styles.logo}>
              <img 
                src={logoSrc} 
                alt="Onety Logo" 
                className={styles.logoImage}
                key={logoSrc} // Força re-render quando a logo mudar
              />
            </div>
            <div className={styles.navLinks}>
              <a href="#modules" className={styles.navLink}>Módulos</a>
              <a href="#features" className={styles.navLink}>Recursos</a>
              <a href="#contact" className={styles.navLink}>Contato</a>
              <ThemeToggle />
              <Link href="/login" className={styles.ctaButton}>
                Login
                <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Sistema Unificado de Gestão
              <span className={styles.heroTitleAccent}> Onety</span>
            </h1>
            <p className={styles.heroDescription}>
              Transforme sua empresa com uma plataforma completa que integra todos os aspectos 
              do seu negócio em um só lugar. 7 módulos poderosos para uma gestão eficiente.
            </p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.primaryButton}>
                Conheça o Onety
                <ArrowRight size={20} />
              </Link>
              <button className={styles.secondaryButton}>
                Saiba Mais
              </button>
            </div>
          <div className={styles.heroImage}>
            <div className={styles.heroImagePlaceholder}>
              <div className={styles.heroImageContent}>
                <div className={styles.dashboardPreview}>
                  <div className={styles.dashboardHeader}></div>
                  <div className={styles.dashboardBody}>
                    <div className={styles.dashboardCard}></div>
                    <div className={styles.dashboardCard}></div>
                    <div className={styles.dashboardCard}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className={styles.modules}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>7 Módulos Integrados</h2>
            <p className={styles.sectionDescription}>
              Uma solução completa que cresce com o seu negócio
            </p>
          </div>
          <div className={styles.modulesGrid}>
            {loading ? (
              <div className={styles.loading}>Carregando módulos...</div>
            ) : (
              modulos.map((module, index) => (
                <div key={module.id || index} className={styles.moduleCard}>
                  <div className={styles.moduleIconWrapper}>
                    {getModuleLogo(module)}
                  </div>
                  <h3 className={styles.moduleTitle}>{module.nome || module.title}</h3>
                  <p className={styles.moduleDescription}>{module.descricao || module.description}</p>
                  <button className={styles.moduleButton}>
                    Explorar Módulo
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.container}>
          <div className={styles.featuresContent}>
            <div className={styles.featuresText}>
              <h2 className={styles.featuresTitle}>
                Por que escolher o Onety?
              </h2>
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>✓</div>
                  <div>
                    <h4>Integração Total</h4>
                    <p>Todos os módulos trabalham em perfeita sincronia</p>
                  </div>
                </div>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>✓</div>
                  <div>
                    <h4>Interface Intuitiva</h4>
                    <p>Design moderno e fácil de usar para toda a equipe</p>
                  </div>
                </div>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>✓</div>
                  <div>
                    <h4>Relatórios Avançados</h4>
                    <p>Insights em tempo real para decisões estratégicas</p>
                  </div>
                </div>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>✓</div>
                  <div>
                    <h4>Segurança Garantida</h4>
                    <p>Proteção de dados com os mais altos padrões de segurança</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.featuresImage}>
              <div className={styles.featuresImagePlaceholder}>
                <div className={styles.featuresImageContent}>
                  <div className={styles.chartPreview}>
                    <div className={styles.chartBars}>
                      <div className={styles.chartBar} style={{height: '60%'}}></div>
                      <div className={styles.chartBar} style={{height: '80%'}}></div>
                      <div className={styles.chartBar} style={{height: '45%'}}></div>
                      <div className={styles.chartBar} style={{height: '90%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      
      {/* Footer */}
      <footer id="contact" className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.footerLogo}>
              <img 
                src="/img/Logo-Onety.png" 
                alt="Onety Logo" 
                className={styles.footerLogoImage}
              />
              <p className={styles.footerDescription}>
                Sistema unificado de gestão empresarial
              </p>
            </div>
            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h4>Produto</h4>
                <a href="#modules">Módulos</a>
                <a href="#features">Recursos</a>
                <a href="#pricing">Preços</a>
              </div>
              <div className={styles.footerColumn}>
                <h4>Empresa</h4>
                <a href="#about">Sobre</a>
                <a href="#careers">Carreiras</a>
                <a href="mailto:contato@cfonety.com.br">contato@cfonety.com.br</a>
              </div>
              <div className={styles.footerColumn}>
                <h4>Suporte</h4>
                <a href="#help">Central de Ajuda</a>
                <a href="#docs">Documentação</a>
                <a href="#api">API</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2025 Onety. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};