import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Brain, 
  Bot, 
  Zap, 
  Sparkles, 
  Workflow, 
  Shield, 
  ArrowRight,
  MessageCircle,
  Users,
  BarChart3,
  Target,
  Link as LinkIcon,
  TrendingUp,
  RotateCcw,
  Settings,
  Smartphone,
  Clock,
  CheckCircle,
  UserCheck,
  FileText,
  Database,
  Globe,
  Headphones
} from 'lucide-react';
import styles from '../styles/index.module.css';

export default function Home() {
  return (
    <div>
      <Head>
        <title>AURA 8 — Assistentes Inteligentes para Operações</title>
        <meta name="description" content="AURA 8 automatiza atendimento e processos com IA generativa e adaptativa, focada em escritórios contábeis e operações empresariais." />
      </Head>

      <div className={styles.app}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.container}>
            <div className={styles.nav}>
              <div className={styles.logo}>
                <Image
                  src="/img/logo-aura8.png"
                  alt="Aura8"
                  width={140}
                  height={32}
                  className={styles.logoImage}
                  priority
                />
              </div>
              <nav className={styles.navMenu}>
                <a href="#sobre" className={styles.navLink}>Sobre</a>
                <a href="#beneficios" className={styles.navLink}>Benefícios</a>
                <a href="#tecnologia" className={styles.navLink}>Tecnologia</a>
                <a href="#contato" className={styles.navLink}>Contato</a>
              </nav>
              <Link href="/login">
                <button className={styles.ctaButton}>Login</button>
              </Link>
            </div>
          </div>
        </header>


        <main>
          {/* Hero Section */}
          <section className={styles.hero}>
            <div className={styles.container}>
              <div className={styles.heroContent}>
                <div className={styles.heroText}>
                  <h1 className={styles.heroTitle}>
                    Automatize seu escritório contábil com 
                    <span className={styles.gradientText}> Inteligência Artificial</span>
                  </h1>
                  <p className={styles.heroDescription}>
                    O AURA 8 é uma plataforma de assistentes inteligentes que automatiza 
                    atendimento e processos operacionais, substituindo tarefas repetitivas 
                    por interações inteligentes e eficientes.
                  </p>
                  <div className={styles.heroButtons}>
                    <Link href="/login">
                      <button className={styles.primaryButton}>Experimentar Grátis</button>
                    </Link>
                    <Link href="/login">
                      <button className={styles.secondaryButton}>Ver Demonstração</button>
                    </Link>
                  </div>
                  <div className={styles.heroStats}>
                    <div className={styles.stat}>
                      <span className={styles.statNumber}>80%</span>
                      <span className={styles.statLabel}>Redução em tarefas manuais</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statNumber}>24h</span>
                      <span className={styles.statLabel}>Atendimento disponível</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statNumber}>100+</span>
                      <span className={styles.statLabel}>Escritórios atendidos</span>
                    </div>
                  </div>
                </div>
                <div className={styles.heroVisual}>
                  <div className={styles.floatingCards}>
                    <div className={`${styles.card} ${styles.card1}`}>
                      <div className={styles.cardIcon}>
                        <MessageCircle size={24} />
                      </div>
                      <h3>Conversas Centralizadas</h3>
                      <p>Gerencie todos os canais em um só lugar</p>
                    </div>
                    <div className={`${styles.card} ${styles.card2}`}>
                      <div className={styles.cardIcon}>
                        <Users size={24} />
                      </div>
                      <h3>Gestão de Equipes</h3>
                      <p>Organize e monitore sua equipe eficientemente</p>
                    </div>
                    <div className={`${styles.card} ${styles.card3}`}>
                      <div className={styles.cardIcon}>
                        <BarChart3 size={24} />
                      </div>
                      <h3>Relatórios Detalhados</h3>
                      <p>Insights completos sobre seu atendimento</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section id="beneficios" className={styles.benefits}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Por que escolher o AURA 8?</h2>
                <p className={styles.sectionDescription}>
                  Revolucione seu escritório contábil com inteligência artificial que realmente entende suas necessidades
                </p>
              </div>
              <div className={styles.benefitsGrid}>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <Zap size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>Automação Inteligente</h3>
                  <p className={styles.benefitDescription}>
                    Substitua tarefas repetitivas por automação inteligente que aprende 
                    com seus processos e se adapta às necessidades do seu escritório.
                  </p>
                </div>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <Smartphone size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>WhatsApp Integrado</h3>
                  <p className={styles.benefitDescription}>
                    Gerencie múltiplas instâncias do WhatsApp Business em uma única plataforma, 
                    com suporte a mensagens, áudios, imagens e documentos.
                  </p>
                </div>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <Users size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>Gestão de Equipes</h3>
                  <p className={styles.benefitDescription}>
                    Organize equipes, atribua conversas, monitore performance e 
                    distribua automaticamente o atendimento entre seus colaboradores.
                  </p>
                </div>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <MessageCircle size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>Chat Centralizado</h3>
                  <p className={styles.benefitDescription}>
                    Interface unificada para gerenciar todas as conversas, com 
                    transferência entre equipes, histórico completo e notificações em tempo real.
                  </p>
                </div>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <UserCheck size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>Gestão de Contatos</h3>
                  <p className={styles.benefitDescription}>
                    Base de contatos inteligente que se integra automaticamente às conversas, 
                    mantendo histórico completo de interações por cliente.
                  </p>
                </div>
                <div className={styles.benefitCard}>
                  <div className={styles.benefitIcon}>
                    <BarChart3 size={32} />
                  </div>
                  <h3 className={styles.benefitTitle}>Relatórios Detalhados</h3>
                  <p className={styles.benefitDescription}>
                    Métricas completas de atendimento, tempo de resposta, 
                    produtividade das equipes e satisfação dos clientes.
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* Technology Section */}
          <section id="tecnologia" className={styles.technology}>
            <div className={styles.container}>
              <div className={styles.technologyContent}>
                <div className={styles.technologyText}>
                  <h2 className={styles.sectionTitle}>Tecnologia de Ponta</h2>
                  <p className={styles.sectionDescription}>
                    IA generativa, adaptativa e personalizada que evolui com seu negócio
                  </p>
                  <div className={styles.techFeatures}>
                    <div className={styles.techFeature}>
                      <div className={styles.techIcon}>
                        <Brain size={24} />
                      </div>
                      <div className={styles.techContent}>
                        <h4>IA Generativa</h4>
                        <p>Cria respostas contextualizadas e naturais para cada situação</p>
                      </div>
                    </div>
                    <div className={styles.techFeature}>
                      <div className={styles.techIcon}>
                        <RotateCcw size={24} />
                      </div>
                      <div className={styles.techContent}>
                        <h4>Aprendizado Contínuo</h4>
                        <p>Aprende com cada interação e melhora constantemente</p>
                      </div>
                    </div>
                    <div className={styles.techFeature}>
                      <div className={styles.techIcon}>
                        <Settings size={24} />
                      </div>
                      <div className={styles.techContent}>
                        <h4>Personalização Avançada</h4>
                        <p>Adapta-se ao estilo e necessidades específicas do seu escritório</p>
                      </div>
                    </div>
                  </div>
                  <Link href="/login">
                  <button className={styles.primaryButton}>Conhecer a Tecnologia</button>
                </Link>
                </div>
                <div className={styles.technologyVisual}>
                  <div className={styles.techDashboard}>
                    <div className={styles.dashboardHeader}>
                      <div className={styles.dashboardTitle}>AURA 8 Dashboard</div>
                      <div className={styles.dashboardStatus}>
                        <span className={styles.statusDot}></span>
                        Online
                      </div>
                    </div>
                    <div className={styles.dashboardMetrics}>
                      <div className={styles.metric}>
                        <span className={styles.metricValue}>94%</span>
                        <span className={styles.metricLabel}>Automação</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricValue}>2.3s</span>
                        <span className={styles.metricLabel}>Tempo Resposta</span>
                      </div>
                      <div className={styles.metric}>
                        <span className={styles.metricValue}>847</span>
                        <span className={styles.metricLabel}>Interações Hoje</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Process Section */}
          <section className={styles.process}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Como funciona o AURA 8</h2>
                <p className={styles.sectionDescription}>
                  Processo simples e eficiente para transformar seu atendimento
                </p>
              </div>
              <div className={styles.processSteps}>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>1</div>
                  <h3 className={styles.stepTitle}>Conexão</h3>
                  <p className={styles.stepDescription}>
                    Conectamos o AURA 8 aos seus sistemas internos e canais de atendimento
                  </p>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>2</div>
                  <h3 className={styles.stepTitle}>Aprendizado</h3>
                  <p className={styles.stepDescription}>
                    A IA aprende seus processos, linguagem e estilo de atendimento específicos
                  </p>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>3</div>
                  <h3 className={styles.stepTitle}>Automação</h3>
                  <p className={styles.stepDescription}>
                    Tarefas repetitivas são automatizadas mantendo a qualidade do atendimento
                  </p>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNumber}>4</div>
                  <h3 className={styles.stepTitle}>Evolução</h3>
                  <p className={styles.stepDescription}>
                    O sistema evolui continuamente, melhorando sua eficiência operacional
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className={styles.ctaSection}>
            <div className={styles.container}>
              <div className={styles.ctaContent}>
                <h2 className={styles.ctaTitle}>
                  Pronto para revolucionar seu escritório contábil?
                </h2>
                <p className={styles.ctaDescription}>
                  Comece hoje mesmo a automatizar seus processos e aumentar a produtividade 
                  da sua equipe com o AURA 8.
                </p>
                <div className={styles.ctaButtons}>
                  <Link href="/login">
                    <button className={`${styles.primaryButton} ${styles.large}`}>Experimentar Grátis</button>
                  </Link>
                  <Link href="/login">
                    <button className={`${styles.secondaryButton} ${styles.large}`}>Agendar Demonstração</button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.container}>
            <div className={styles.footerContent}>
              <div className={styles.footerBrand}>
                <div className={styles.logo}>
                  <Image
                    src="/img/logo-aura8.png"
                    alt="Aura8"
                    width={140}
                    height={32}
                    className={styles.logoImage}
                    priority
                  />
                </div>
                <p className={styles.footerDescription}>
                  Plataforma de assistentes inteligentes para escritórios contábeis
                </p>
              </div>
              <div className={styles.footerLinks}>
                <div className={styles.footerColumn}>
                  <h4 className={styles.footerTitle}>Produto</h4>
                  <a href="#" className={styles.footerLink}>Funcionalidades</a>
                  <a href="#" className={styles.footerLink}>Integrações</a>
                  <a href="#" className={styles.footerLink}>Preços</a>
                </div>
                <div className={styles.footerColumn}>
                  <h4 className={styles.footerTitle}>Suporte</h4>
                  <a href="#" className={styles.footerLink}>Central de Ajuda</a>
                  <a href="#" className={styles.footerLink}>Documentação</a>
                  <a href="#" className={styles.footerLink}>Contato</a>
                </div>
                <div className={styles.footerColumn}>
                  <h4 className={styles.footerTitle}>Empresa</h4>
                  <a href="#" className={styles.footerLink}>Sobre Nós</a>
                  <a href="#" className={styles.footerLink}>Blog</a>
                  <a href="#" className={styles.footerLink}>Carreiras</a>
                </div>
              </div>
            </div>
            <div className={styles.footerBottom}>
              <p>&copy; 2025 AURA 8 by ContabHub.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}