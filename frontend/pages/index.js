import React from 'react';
import Link from 'next/link';
import { ArrowRight, Users, TrendingUp, FileText, DollarSign, Settings, Shield, Target } from 'lucide-react';
import styles from '../styles/index.module.css';

export default function Home() {
    const modules = [
    {
      icon: <Users className={styles.moduleIcon} />,
      title: 'Atendimento',
      description: 'Gerencie todos os canais de atendimento ao cliente de forma integrada e eficiente.'
    },
    {
      icon: <TrendingUp className={styles.moduleIcon} />,
      title: 'Comercial',
      description: 'Controle vendas, leads e oportunidades com ferramentas avançadas de CRM.'
    },
    {
      icon: <FileText className={styles.moduleIcon} />,
      title: 'Contratual',
      description: 'Administre contratos, renovações e documentos legais em um só lugar.'
    },
    {
      icon: <DollarSign className={styles.moduleIcon} />,
      title: 'Financeiro',
      description: 'Tenha controle total sobre fluxo de caixa, faturamento e análises financeiras.'
    },
    {
      icon: <Settings className={styles.moduleIcon} />,
      title: 'Gestão de Processos',
      description: 'Otimize workflows e automatize processos para maior produtividade.'
    },
    {
      icon: <Shield className={styles.moduleIcon} />,
      title: 'Auditoria',
      description: 'Monitore, analise e garanta conformidade com relatórios detalhados.'
    },
    {
      icon: <Target className={styles.moduleIcon} />,
      title: 'Estratégico',
      description: 'Tome decisões baseadas em dados com dashboards e análises estratégicas.'
    }
  ];

  return (
    <div className={styles.landingPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <nav className={styles.nav}>
            <div className={styles.logo}>
              <img 
                src="/img/Logo-Onety-Preta.png" 
                alt="Onety Logo" 
                className={styles.logoImage}
              />
            </div>
            <div className={styles.navLinks}>
              <a href="#modules" className={styles.navLink}>Módulos</a>
              <a href="#features" className={styles.navLink}>Recursos</a>
              <a href="#contact" className={styles.navLink}>Contato</a>
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
            {modules.map((module, index) => (
              <div key={index} className={styles.moduleCard}>
                <div className={styles.moduleIconWrapper}>
                  {module.icon}
                </div>
                <h3 className={styles.moduleTitle}>{module.title}</h3>
                <p className={styles.moduleDescription}>{module.description}</p>
                <button className={styles.moduleButton}>
                  Explorar Módulo
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
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

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>
              Pronto para transformar sua gestão?
            </h2>
            <p className={styles.ctaDescription}>
              Junte-se a centenas de empresas que já confiam no Onety para otimizar seus processos
            </p>
            <div className={styles.ctaActions}>
              <button className={styles.ctaSecondaryButton}>
                Falar com Especialista
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
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
                <a href="#contact">Contato</a>
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