import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, TrendingUp, FileText, DollarSign, Settings, Shield, Target } from 'lucide-react';
import styles from '../styles/index.module.css';
import ThemeToggle from '../components/onety/menu/ThemeToggle';

export default function Home() {
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoSrc, setLogoSrc] = useState('/img/Logo-Onety-Preta.png');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselRef, setCarouselRef] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const resolveTheme = () => {
      try {
        const saved = localStorage.getItem('theme');
        const attr = document.documentElement.getAttribute('data-theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || attr || (prefersDark ? 'dark' : 'light');

        console.log('Theme detected:', theme); // Debug
        setIsLightTheme(theme === 'light');

        // Mesma lógica do Header: dark usa '/img/onety.png', light usa '/img/Logo-Onety-Preta.png'
        setLogoSrc(theme === 'dark' ? '/img/onety.png' : '/img/Logo-Onety-Preta.png');
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

      setLogoSrc(currentTheme === 'dark' ? '/img/onety.png' : '/img/Logo-Onety-Preta.png');
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

  // Funções do carrossel (igual ao modulos.js)
  const transitionMs = 380; // transição normal
  const edgeTransitionMs = 750; // transição nas extremidades (último/primeiro)

  // Itens estendidos para efeito infinito: [cloneLast, ...modulos, cloneFirst]
  const extended = useMemo(() => {
    if (modulos.length <= 1) return modulos;
    const first = modulos[0];
    const last = modulos[modulos.length - 1];
    return [last, ...modulos, first];
  }, [modulos]);

  const getItemWidth = () => 380 + 80; // largura do item + margin (aumentado para acomodar gap maior)

  const scrollToExtendedIndex = (extIndex, smooth = true) => {
    if (!carouselRef) return;
    const itemWidth = getItemWidth();
    const containerWidth = carouselRef.offsetWidth;
    const computedStyles = typeof window !== 'undefined' ? window.getComputedStyle(carouselRef) : null;
    const paddingLeft = computedStyles ? parseInt(computedStyles.paddingLeft || '0', 10) : 0;

    // Centralizar o item selecionado
    const itemCenter = (extIndex * itemWidth) + (itemWidth / 2);
    const containerCenter = containerWidth / 2;
    const position = itemCenter - containerCenter + paddingLeft;

    carouselRef.scrollTo({
      left: Math.max(0, position),
      behavior: smooth ? 'smooth' : 'auto'
    });
  };

  // Inicializa o scroll no primeiro item real (índice +1 no array estendido)
  useEffect(() => {
    if (extended.length > 0 && carouselRef) {
      const startIndex = modulos.length > 1 ? currentIndex + 1 : currentIndex;
      scrollToExtendedIndex(startIndex, false);
    }
  }, [carouselRef, extended]);

  const nextModule = () => {
    if (modulos.length === 0 || isTransitioning) return;
    const nextIndex = (currentIndex + 1) % modulos.length;
    const goingOver = modulos.length > 1 && currentIndex === modulos.length - 1;
    setIsTransitioning(true);
    setCurrentIndex(nextIndex);
    // No array estendido, o próximo real é nextIndex+1; se estourou, passa pelo clone e depois salta
    scrollToExtendedIndex((nextIndex + 1), true);
    if (goingOver) {
      setTimeout(() => {
        // reposiciona silenciosamente no primeiro real
        scrollToExtendedIndex(1, false);
        setIsTransitioning(false);
      }, edgeTransitionMs);
    } else {
      setTimeout(() => setIsTransitioning(false), transitionMs);
    }
  };

  const prevModule = () => {
    if (modulos.length === 0 || isTransitioning) return;
    const prevIndex = (currentIndex - 1 + modulos.length) % modulos.length;
    const goingUnder = modulos.length > 1 && currentIndex === 0;
    setIsTransitioning(true);
    setCurrentIndex(prevIndex);
    scrollToExtendedIndex((prevIndex + 1), true);
    if (goingUnder) {
      setTimeout(() => {
        // reposiciona silenciosamente no último real
        scrollToExtendedIndex(modulos.length, false);
        setIsTransitioning(false);
      }, edgeTransitionMs);
    } else {
      setTimeout(() => setIsTransitioning(false), transitionMs);
    }
  };

  const selectModule = (index) => {
    setCurrentIndex(index);
    scrollToExtendedIndex((index + 1), true);
  };

  // Auto-play do carrossel
  useEffect(() => {
    if (modulos.length <= 1) return;

    const interval = setInterval(() => {
      nextModule();
    }, 5000); // Muda a cada 5 segundos

    return () => clearInterval(interval);
  }, [modulos.length, currentIndex, isTransitioning]);

  // Inicializar carrossel
  useEffect(() => {
    if (carouselRef && modulos.length > 0) {
      const startIndex = modulos.length > 1 ? currentIndex + 1 : currentIndex;
      scrollToExtendedIndex(startIndex, false);
    }
  }, [carouselRef, modulos.length]);

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
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                Sistema Unificado de Gestão
                <span className={styles.heroTitleAccent}> Onety</span>
              </h1>
              <div className={styles.heroActions}>
                {/* <Link href="/login" className={styles.primaryButton}>
                  Conheça o Onety
                  <ArrowRight size={20} />
                </Link> */}
                {/* <button className={styles.secondaryButton}>
                  Saiba Mais
                </button> */}
              </div>
            </div>
            <div className={styles.heroDescription}>
              <p style={{ fontSize: '23px', lineHeight: '1.6' }}>
                Transforme sua empresa com uma plataforma completa que integra todos os aspectos
                do seu negócio em um só lugar. 7 módulos poderosos para uma gestão eficiente.
              </p>
            </div>
          </div>

          {/* Vídeo centralizado fora do grid */}
          <div className={styles.heroVideoSection}>
            <div className={styles.heroVideoContainer}>
              <iframe
                src="https://www.youtube.com/embed/eDdYtbHsG98"
                title="Apresentação Onety"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.heroVideo}
              ></iframe>
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


          {loading ? (
            <div className={styles.loading}>Carregando módulos...</div>
          ) : modulos.length > 0 ? (
            <div className={styles.carouselContainer}>
              <div className={styles.carousel}>
                <button
                  className={styles.navButton}
                  onClick={prevModule}
                  disabled={modulos.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>

                <div
                  className={styles.carouselTrack}
                  ref={setCarouselRef}
                >
                  {extended.map((module, extIndex) => (
                    <div
                      key={`${module.id}-ext-${extIndex}`}
                      className={`${styles.carouselItem} ${((extIndex - 1 + modulos.length) % modulos.length) === currentIndex ? styles.active : ''}`}
                      onClick={() => selectModule(((extIndex - 1 + modulos.length) % modulos.length))}
                    >
                      {((extIndex - 1 + modulos.length) % modulos.length) === currentIndex ? (
                        // Preview expandido quando selecionado
                        <div className={styles.previewCardInline}>
                          <div className={styles.previewHeader}>
                            <div className={styles.moduleIconLarge}>
                              {getModuleLogo(module)}
                            </div>
                            <div className={styles.previewTitle}>
                              <h2>{module.nome || module.title}</h2>
                            </div>
                          </div>
                          <div className={styles.previewContent}>
                            <p>{module.descricao || module.description || 'Sem descrição disponível'}</p>
                            <div className={styles.previewPlaceholder}>
                              <div className={styles.placeholderIcon}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                              <h3>Preview do Módulo</h3>
                              <p>Em breve você poderá visualizar o conteúdo do módulo aqui</p>
                            </div>
                            <div className={styles.previewActions}>
                              {/* <button 
                                className={styles.moduleButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Acessando módulo:', module.nome || module.title);
                                }}
                              >
                                Explorar Módulo
                                <ArrowRight size={14} />
                              </button> */}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Card normal quando não selecionado
                        <div className={styles.moduleCard}>
                          <div className={styles.moduleIconWrapper}>
                            {getModuleLogo(module)}
                          </div>
                          <h3 className={styles.moduleTitle}>{module.nome || module.title}</h3>
                          <p className={styles.moduleDescription}>{module.descricao || module.description}</p>
                          {/* <button className={styles.moduleButton}>
                            Explorar Módulo
                            <ArrowRight size={14} />
                          </button> */}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  className={styles.navButton}
                  onClick={nextModule}
                  disabled={modulos.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>

              {/* Indicadores */}
              <div className={styles.indicators}>
                {modulos.map((_, index) => (
                  <button
                    key={index}
                    className={`${styles.indicator} ${index === currentIndex ? styles.active : ''}`}
                    onClick={() => selectModule(index)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.noResults}>
              <p>Nenhum módulo encontrado</p>
            </div>
          )}
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
                      <div className={styles.chartBar} style={{ height: '60%' }}></div>
                      <div className={styles.chartBar} style={{ height: '80%' }}></div>
                      <div className={styles.chartBar} style={{ height: '45%' }}></div>
                      <div className={styles.chartBar} style={{ height: '90%' }}></div>
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
                src="/img/onety.png"
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
                {/* <a href="#features">Recursos</a> */}
                {/* <a href="#pricing">Preços</a> */}
              </div>
              <div className={styles.footerColumn}>
                <h4>Empresa</h4>
                <a href="#about">Sobre</a>
                {/* <a href="#careers">Carreiras</a> */}
                <a href="mailto:contato@cfonety.com.br">contato@cfonety.com.br</a>
              </div>
              {/* <div className={styles.footerColumn}>
                <h4>Suporte</h4>
                <a href="#help">Central de Ajuda</a>
                <a href="#docs">Documentação</a>
                <a href="#api">API</a>
              </div> */}
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