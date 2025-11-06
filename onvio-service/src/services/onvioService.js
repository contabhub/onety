const puppeteer = require('puppeteer');

const db = require("../config/database");

const path = require('path');

const fs = require('fs');



/**

 * 📌 Serviço de integração com a Onvio via automação web

 * 

 * Como a Onvio não possui API, utilizamos automação web com Puppeteer

 * para fazer login e buscar documentos automaticamente.

 */



/**

 * 🔧 Helper para tentar encontrar elementos com retry

 */

async function tentarEncontrarElemento(page, seletores, maxTentativas = 1, delayEntreTentativas = 100) { // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Apenas 1 tentativa e delay mínimo para velocidade máxima

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {

        for (const seletor of seletores) {

            try {

                // Timeout ultra-agressivo para velocidade máxima

                // 🚀 OTIMIZAÇÃO: Timeout ultra-rápido para velocidade máxima
            await page.waitForSelector(seletor, { timeout: 300 });

                const elemento = await page.$(seletor);

                if (elemento) {

                    return { elemento, seletor };

                }

            } catch (e) {

            }

        }

        

        if (tentativa < maxTentativas) {

            await new Promise(resolve => setTimeout(resolve, delayEntreTentativas));

        }

    }

    

    return null;

}



class OnvioService {

    constructor(usuarioId = 1) {

        this.browser = null;

        this.page = null;

        this.isLoggedIn = false;

        this.sessionData = null;

        // 🎯 NOVA PROPRIEDADE: Rastrear o último item da sidebar selecionado para navegação de volta
        this.ultimoItemSidebarSelecionado = null;
        
        // 🎯 NOVA PROPRIEDADE: Armazenar o caminho completo da sidebar para navegação de volta
        this.caminhoSidebarAtual = null;

        // 🎯 NOVA PROPRIEDADE: ID do usuário que iniciou o processamento
        this.usuarioId = usuarioId;

        // 🎯 NOVA PROPRIEDADE: Controle de obrigações já processadas para evitar match duplicado
        this.obrigacoesProcessadas = new Set();

    }



    /**

     * 🔑 Inicializa o navegador headless

     */

    async initializeBrowser() {

        try {

            this.browser = await puppeteer.launch({
                headless: false, // true para produção (mais rápido)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    // NOVOS ARGUMENTOS PARA PERFORMANCE
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    '--disable-javascript-harmony-shipping',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-logging',
                    '--disable-background-networking',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-ipc-flooding-protection'
                ],
                defaultViewport: { width: 1366, height: 768 }
            });

            this.page = await this.browser.newPage();

            // Configurar user agent para parecer mais humano
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 🚀 OTIMIZAÇÃO AGGRESSIVA: Timeouts ultra-rápidos para velocidade máxima
            // 🚀 OTIMIZAÇÃO: Timeouts ultra-rápidos para velocidade máxima
            this.page.setDefaultTimeout(5000);
            this.page.setDefaultNavigationTimeout(5000);

            // Configurações adicionais para estabilidade
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            });

            // Configurações de performance (sem interceptar requisições para manter funcionalidade)

            return true;
        } catch (error) {
            throw new Error(`Falha ao inicializar navegador: ${error.message}`);
        }
    }



    /**

     * 🔐 Faz login na plataforma Onvio

     */

    async fazerLogin(credenciais, usarEmailEmpresa = false, empresaId = null) {

        try {

            if (!this.page) {

                throw new Error('Navegador não inicializado');

            }

            

            // Determinar qual email e senha usar

            let emailParaLogin = credenciais.email;

            let senhaParaLogin = credenciais.senha;

            

            if (usarEmailEmpresa && empresaId) {

                const credenciaisEmpresa = await this.obterCredenciaisEmpresa(empresaId);

                if (credenciaisEmpresa) {

                    emailParaLogin = credenciaisEmpresa.email;

                    senhaParaLogin = credenciaisEmpresa.senha;

                    // Atualizar objeto credenciais com as informações da empresa (incluindo mfaSecret)

                    credenciais = {

                        ...credenciais,

                        email: credenciaisEmpresa.email,

                        senha: credenciaisEmpresa.senha,

                        mfaSecret: credenciaisEmpresa.mfaSecret

                    };


                } else {

                    console.log('⚠️ Credenciais Onvio da empresa não encontradas, usando credenciais fornecidas');

                }

            }

            // PASSO 1: Navegar para página de login da Onvio

            // 🚀 OTIMIZAÇÃO: Carregamento ultra-rápido para velocidade máxima
            await this.page.goto('https://onvio.com.br/login/#/', {
                waitUntil: 'domcontentloaded' // Mais rápido que networkidle2
            });

            // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Delay mínimo para velocidade máxima
            await new Promise(resolve => setTimeout(resolve, 100));

            await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 500ms para velocidade máxima

            // Seletores específicos baseados no HTML fornecido pelo usuário

            const seletoresBotaoEntrar = [

                'button#trauth-continue-signin-btn', // ID específico do botão

                'button.trid-auth-continue-ciam-button', // Classe específica do botão

                'button.SignOn-card-button', // Classe adicional

                'button.SignOn-card-button-login', // Classe específica de login

                'button[tr-nosend]', // Atributo específico

                'button:contains("Entrar")', // Texto do botão

                'button[type="submit"]', // Botão de submit

                'button.btn', // Botão com classe btn

                'button[class*="btn"]' // Botão com classe que contém btn

            ];

            

            // 🚀 OTIMIZAÇÃO ULTRA-ULTRA-AGGRESSIVA: Timeout mínimo para busca de elementos
            const resultadoBotaoEntrar = await tentarEncontrarElemento(this.page, seletoresBotaoEntrar, 3, 500);

            if (!resultadoBotaoEntrar) {

                throw new Error('Botão "Entrar" não encontrado na página inicial da Onvio');

            }

            // ✅ AGUARDAR O BOTÃO "ENTRAR" CARREGAR COMPLETAMENTE ANTES DE CLICAR
            console.log('⏳ Aguardando botão "Entrar" carregar completamente...');
            
            // Aguardar que o elemento esteja presente no DOM e visível
            await this.page.waitForSelector(resultadoBotaoEntrar.seletor, { 
                visible: true, 
                timeout: 10000 
            });
            
            // Aguardar um pouco mais para garantir que JavaScript da página terminou de carregar
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verificar se o elemento está visível e clicável antes de tentar clicar
            const elemento = await this.page.$(resultadoBotaoEntrar.seletor);
            if (!elemento) {
                throw new Error(`Elemento não encontrado: ${resultadoBotaoEntrar.seletor}`);
            }

            // Verificar se o elemento está visível
            const isVisible = await elemento.isIntersectingViewport();
            if (!isVisible) {
                console.log('⚠️ Elemento não está visível, tentando scroll para o elemento...');
                await elemento.scrollIntoView();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // ✅ Verificar se o botão está habilitado (não desabilitado)
            const isDisabled = await this.page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.disabled || element.hasAttribute('disabled') : true;
            }, resultadoBotaoEntrar.seletor);
            
            if (isDisabled) {
                console.log('⚠️ Botão está desabilitado, aguardando habilitar...');
                // Aguardar até que o botão esteja habilitado (máximo 5 segundos)
                await this.page.waitForFunction(
                    (selector) => {
                        const element = document.querySelector(selector);
                        return element && !element.disabled && !element.hasAttribute('disabled');
                    },
                    { timeout: 5000 },
                    resultadoBotaoEntrar.seletor
                );
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log('✅ Botão "Entrar" carregado e pronto para clicar');
            
            // Tentar clique com diferentes métodos
            try {
                await this.page.click(resultadoBotaoEntrar.seletor);
            } catch (clickError) {
                console.log('⚠️ Clique normal falhou, tentando clique via JavaScript...');
                await this.page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.click();
                    } else {
                        throw new Error('Elemento não encontrado no DOM');
                    }
                }, resultadoBotaoEntrar.seletor);
            }

            // 🚀 OTIMIZAÇÃO ULTRA-ULTRA-AGGRESSIVA: Delay mínimo para velocidade máxima
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const seletoresEmail = [

                'input[name="username"]', // Seletor específico da Thomson Reuters

                'input[id="username"]', // ID específico da Thomson Reuters

                'input[inputmode="email"]', // Atributo específico da Thomson Reuters

                'input[type="email"]',

                'input[placeholder*="E-mail"]',

                'input[placeholder*="Email"]',

                'input[name*="email"]',

                'input[name*="Email"]'

            ];

            

            // 🚀 OTIMIZAÇÃO: Timeout mais rápido para busca de elementos
            const resultadoEmail = await tentarEncontrarElemento(this.page, seletoresEmail, 3, 1000);

            if (!resultadoEmail) {

                throw new Error('Campo de email não encontrado após clicar no botão inicial');

            }

            

            // Verificar se o elemento está visível antes de clicar
            const elementoEmail = await this.page.$(resultadoEmail.seletor);
            if (elementoEmail) {
                const isVisible = await elementoEmail.isIntersectingViewport();
                if (!isVisible) {
                    await elementoEmail.scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            await this.page.click(resultadoEmail.seletor);

            // Preencher campo de email instantaneamente via JS
            await this.page.evaluate((selector, value) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.value = value;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, resultadoEmail.seletor, emailParaLogin);

            // PASSO 3.5: Clicar no botão "Entrar" ou "Continuar" após o email


            const botoesContinuar = [

                'button[type="submit"]',

                'input[type="submit"]',

                'button:contains("Entrar")',

                'button:contains("Continuar")',

                'button:contains("Next")',

                'button:contains("Continue")',

                '[data-testid*="submit"]',

                '[data-testid*="continue"]',

                '.btn-primary',

                '.btn-submit',

                '.btn-continue'

            ];



            let botaoContinuar = null;

            for (const seletor of botoesContinuar) {

                try {

                    if (seletor.includes(':contains')) {

                        // Para seletores com texto, usar XPath

                        const texto = seletor.match(/:contains\("([^"]+)"\)/)[1];

                        const xpath = `//button[contains(text(), '${texto}')] | //input[@value='${texto}']`;

                        const elementos = await this.buscarPorXPath(xpath);

                        if (elementos.length > 0) {

                            botaoContinuar = elementos[0];

                            break;

                        }

                    } else {

                        // Para seletores CSS normais

                        const elemento = await this.page.$(seletor);

                        if (elemento) {

                            botaoContinuar = elemento;

                            break;

                        }

                    }

                } catch (error) {

                }

            }

            if (botaoContinuar) {

                await botaoContinuar.click();

                // Aguardar um pouco para a página carregar o campo de senha

                await new Promise(resolve => setTimeout(resolve, 50)); // 🚀 OTIMIZAÇÃO ULTRA-ULTRA-AGGRESSIVA: Reduzido para 50ms para velocidade máxima

            } else {

                console.log('⚠️ Botão "Entrar/Continuar" não encontrado, tentando continuar...');

            }

            const seletoresSenha = [

                'input[type="password"]',

                'input[name="password"]', // Nome comum para senha

                'input[id="password"]', // ID comum para senha

                'input[placeholder*="Senha"]',

                'input[placeholder*="Password"]',

                'input[name*="senha"]',

                'input[name*="password"]'

            ];

            

            // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Timeout mínimo para busca de elementos
            const resultadoSenha = await tentarEncontrarElemento(this.page, seletoresSenha, 3, 500);

            if (!resultadoSenha) {

                throw new Error('Campo de senha não encontrado');

            }   

            await this.page.click(resultadoSenha.seletor);

            // Preencher campo de senha instantaneamente via JS
            await this.page.evaluate((selector, value) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.value = value;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, resultadoSenha.seletor, senhaParaLogin);

            const seletoresEntrarFinal = [

                'button[type="submit"]', // Botão de submit padrão

                'button:contains("Continuar")', // Botão comum em português

                'button:contains("Continue")', // Botão comum em inglês

                'button:contains("Entrar")',

                'button:contains("Login")',

                'button:contains("Sign In")',

                'button:contains("Next")', // Próximo passo

                'button:contains("Próximo")', // Próximo passo em português

                'button[data-testid*="submit"]', // Test ID comum

                'button[data-testid*="continue"]' // Test ID comum

            ];


            // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Timeout mínimo para busca de elementos
            const resultadoBotaoFinal = await tentarEncontrarElemento(this.page, seletoresEntrarFinal, 3, 500);

            if (!resultadoBotaoFinal) {

                throw new Error('Botão "Entrar" final não encontrado');

            }

            await this.page.click(resultadoBotaoFinal.seletor);

            // 🚀 OTIMIZAÇÃO: Aguardo ultra-rápido para velocidade máxima

            await new Promise(resolve => setTimeout(resolve, 500)); 

            // Verificar URL atual para debug

            const urlAtual = this.page.url();
            const urlAtualLogin = this.page.url();
            
            // Verificar se estamos na página de login da Thomson Reuters
            if (urlAtualLogin.includes('auth.thomsonreuters.com') || urlAtualLogin.includes('login/password')) {
                
                // Aguardar carregamento da página
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Verificar se há elementos específicos da página de login da Thomson Reuters
                const elementosThomsonReuters = [
                    'input[name="password"]',
                    'input[type="password"]',
                    'button[type="submit"]',
                    'button:contains("Sign In")',
                    'button:contains("Entrar")',
                    'button:contains("Continue")',
                    'button:contains("Continuar")',
                    '.okta-form-input',
                    '.okta-form-submit'
                ];
                
                let elementoEncontrado = null;
                for (const seletor of elementosThomsonReuters) {
                    try {
                        if (seletor.includes(':contains')) {
                            const texto = seletor.match(/:contains\("([^"]+)"\)/)[1];
                            const xpath = `//button[contains(text(), '${texto}')] | //input[@value='${texto}']`;
                        const elementos = await this.buscarPorXPath(xpath);
                            if (elementos.length > 0) {
                                elementoEncontrado = elementos[0];
                                break;
                            }
                        } else {
                            const elemento = await this.page.$(seletor);
                            if (elemento) {
                                elementoEncontrado = elemento;
                                break;
                            }
                        }
                    } catch (error) {
                    }
                }
                
                if (elementoEncontrado) {
                } else {
                    
                    // Tentar navegar diretamente para a Onvio
                    try {
                        await this.page.goto('https://onvio.com.br', { waitUntil: 'domcontentloaded' });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.log('❌ Erro na navegação direta:', error.message);
                    }
                }
            }
            // Verificar se ainda está na página de login
            const urlStatusLogin = this.page.url();
            const tituloAtual = await this.page.title();
            
            if (urlStatusLogin.includes('login') || urlStatusLogin.includes('auth') || tituloAtual === 'Onvio') {                
                // Buscar e clicar no botão "Entrar"
                try {
                    // Usar o método buscarPorTexto para encontrar o botão "Entrar"
                    const botoesEntrar = await this.buscarPorTexto('Entrar', ['button']);
                    
                    let botaoEntrar = null;
                    if (botoesEntrar.length > 0) {
                        botaoEntrar = botoesEntrar[0];
                    } else {
                        // Tentar seletores específicos como fallback
                        botaoEntrar = await this.page.$('.trid-auth-continue-ciam-button, .SignOn-card-button-login');
                    }
                    
                    if (botaoEntrar) {
                        
                        try {
                            if (botaoEntrar.element) {
                                // Se temos o elemento DOM direto
                                await botaoEntrar.element.click();
                            } else {
                                // Se temos um elemento Puppeteer
                                await botaoEntrar.click();
                            }
                            
                            // Aguardar redirecionamento
                            console.log('⏳ Aguardando redirecionamento após clique no "Entrar"...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            
                            // Verificar nova URL
                            const novaUrl = this.page.url();
                            console.log(`📍 Nova URL após clique: ${novaUrl}`);
                            
                            if (novaUrl.includes('login') || novaUrl.includes('auth')) {
                                console.log('⚠️ Ainda na página de login - tentando método alternativo...');
                                
                                // Tentar clicar usando seletor mais específico
                                const botaoEntrarAlternativo = await this.page.$('.trid-auth-continue-ciam-button');
                                if (botaoEntrarAlternativo) {
                                    await botaoEntrarAlternativo.click();
                                    console.log('✅ Clique alternativo realizado');
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                }
                            }
                        } catch (error) {                            
                            // Tentar método alternativo em caso de erro
                            try {
                                const botaoEntrarAlternativo = await this.page.$('.trid-auth-continue-ciam-button');
                                if (botaoEntrarAlternativo) {
                                    await botaoEntrarAlternativo.click();
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                }
                            } catch (error2) {
                            }
                        }
                    } else {
                    }
                } catch (error) {
                }
            }
            
            const seletoresDashboard = [
                // Elementos específicos da Onvio - Documentos
                'a[href*="documentos"]',
                'a[href*="documents"]',
                'a[href*="arquivos"]',
                'a[href*="files"]',
                'a[href*="gestao"]',
                'a[href*="management"]',
                'a[href*="obrigacoes"]',
                'a[href*="obligations"]',
                'a[href*="tarefas"]',
                'a[href*="tasks"]',
                'a[href*="relatorios"]',
                'a[href*="reports"]',
                'a[href*="dashboard"]',
                'a[href*="home"]',
                'a[href*="inicio"]',
                'a[href*="start"]',
                
                // Classes específicas da Onvio
                '.menu-documentos',
                '.documents-menu',
                '.menu-arquivos',
                '.files-menu',
                '.menu-gestao',
                '.management-menu',
                '.menu-obrigacoes',
                '.obligations-menu',
                '.menu-tarefas',
                '.tasks-menu',
                '.menu-relatorios',
                '.reports-menu',
                '.menu-dashboard',
                '.home-menu',
                '.inicio-menu',
                
                // Data attributes e IDs específicos
                '[data-testid="documents-menu"]',
                '[data-testid="files-menu"]',
                '[data-testid="management-menu"]',
                '[data-testid="obligations-menu"]',
                '[data-testid="tasks-menu"]',
                '[data-testid="reports-menu"]',
                '[data-testid="dashboard-menu"]',
                '[data-testid="home-menu"]',
                '[id*="documentos"]',
                '[id*="documents"]',
                '[id*="arquivos"]',
                '[id*="files"]',
                '[id*="gestao"]',
                '[id*="management"]',
                '[id*="obrigacoes"]',
                '[id*="obligations"]',
                '[id*="tarefas"]',
                '[id*="tasks"]',
                '[id*="relatorios"]',
                '[id*="reports"]',
                '[id*="dashboard"]',
                '[id*="home"]',
                '[id*="inicio"]',
                
                // Navegação e sidebar
                '.nav-documents',
                '.nav-files',
                '.nav-management',
                '.nav-obligations',
                '.nav-tasks',
                '.nav-reports',
                '.nav-dashboard',
                '.nav-home',
                '.sidebar-documents',
                '.sidebar-files',
                '.sidebar-management',
                '.sidebar-obligations',
                '.sidebar-tasks',
                '.sidebar-reports',
                '.sidebar-dashboard',
                '.sidebar-home',
                
                // Elementos gerais de dashboard
                '.dashboard',
                '.main-content',
                '.home',
                '.inicio',
                '.start',
                '.user-menu',
                '.profile-menu',
                '.avatar',
                '.user-info',
                '.account-menu',
                '.user-profile',
                '.user-account',
                
                // Elementos específicos da Thomson Reuters/Onvio
                '.okta-form',
                '.okta-form-submit',
                '.okta-form-input',
                '.okta-form-button',
                '.okta-form-field',
                '.okta-form-label',
                
                // Elementos de navegação
                'nav',
                '.navigation',
                '.sidebar',
                '.menu',
                '.main-menu',
                '.primary-menu',
                '.secondary-menu',
                '.top-menu',
                '.bottom-menu',
                
                // Elementos de conteúdo principal
                '.content',
                '.main',
                '.container',
                '.wrapper',
                '.app',
                '.application',
                '.workspace',
                '.area-trabalho'
            ];
            
            let elementoDashboard = null;
            const tempoMaximo = 30000; // 30 segundos
            const inicio = Date.now();
            let tentativas = 0;
            
            while (!elementoDashboard && (Date.now() - inicio) < tempoMaximo) {
                tentativas++;
                
                // 🔍 LOG DETALHADO: Mostrar estrutura da página atual
                if (tentativas === 1 || tentativas % 3 === 0) {
                    
                    // Mostrar informações básicas da página
                    try {
                        const urlAtual = this.page.url();
                        const titulo = await this.page.title();
                    } catch (error) {
                        // Erro ao obter informações da página
                    }
                    try {
                        const estruturaPagina = await this.page.evaluate(() => {
                            const elementos = [];
                            
                            // Buscar por todos os links visíveis
                            const links = document.querySelectorAll('a[href]');
                            links.forEach(link => {
                                if (link.offsetParent !== null) { // Se está visível
                                    elementos.push({
                                        tipo: 'link',
                                        texto: link.textContent?.trim() || '',
                                        href: link.href,
                                        className: link.className,
                                        id: link.id
                                    });
                                }
                            });
                            
                            // Buscar por botões visíveis
                            const botoes = document.querySelectorAll('button, [role="button"]');
                            botoes.forEach(botao => {
                                if (botao.offsetParent !== null) { // Se está visível
                                    elementos.push({
                                        tipo: 'botao',
                                        texto: botao.textContent?.trim() || '',
                                        className: botao.className,
                                        id: botao.id,
                                        role: botao.getAttribute('role')
                                    });
                                }
                            });
                            
                            // Buscar por elementos de menu/sidebar
                            const menus = document.querySelectorAll('nav, .menu, .sidebar, .navigation');
                            menus.forEach(menu => {
                                if (menu.offsetParent !== null) { // Se está visível
                                    elementos.push({
                                        tipo: 'menu',
                                        texto: menu.textContent?.trim().substring(0, 100) || '',
                                        className: menu.className,
                                        id: menu.id
                                    });
                                }
                            });
                            
                            return elementos;
                        });
                        
                        // Estrutura da página analisada
                        
                        
                    } catch (error) {
                        // Erro ao analisar estrutura da página
                    }
                }
                
                for (const seletor of seletoresDashboard) {
                    try {
                        const elemento = await this.page.$(seletor);
                        if (elemento) {
                            elementoDashboard = elemento;
                            break;
                        }
                    } catch (error) {
                        // Erro no seletor, continua para o próximo
                    }
                }
                
                if (!elementoDashboard) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // A cada 3 tentativas, tentar recarregar a página
                    if (tentativas % 3 === 0) {
                        try {
                            await this.page.reload({ waitUntil: 'domcontentloaded' });
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        } catch (error) {
                            // Erro ao recarregar página
                        }
                    }
                }
            }
            
            if (elementoDashboard) {
            } else {
                console.log('⚠️ Elementos da dashboard não encontrados - verificando se ainda está na página de login...');
                
                // Verificar se ainda está na página de login
                const urlFinal = this.page.url();
                if (urlFinal.includes('login') || urlFinal.includes('auth')) {
                    console.log('⚠️ Ainda na página de login - tentando fazer login novamente...');
                    
                    // Tentar fazer login novamente
                    try {
                        const botaoEntrarFinal = await this.page.$('.trid-auth-continue-ciam-button');
                        if (botaoEntrarFinal) {
                            await botaoEntrarFinal.click();
                            console.log('✅ Tentativa final de login realizada');
                            await new Promise(resolve => setTimeout(resolve, 10000)); // Aguardar mais tempo
                        }
                    } catch (error) {
                        console.log('❌ Erro na tentativa final de login:', error.message);
                    }
                    
                    // Verificar novamente
                    const urlFinalNova = this.page.url();
                    if (urlFinalNova.includes('login') || urlFinalNova.includes('auth')) {
                    throw new Error('Ainda na página de login após várias tentativas - possível problema de autenticação');
                    } else {
                        console.log('✅ Login realizado com sucesso na tentativa final');
                    }
                } else {
                    console.log('✅ Não está mais na página de login - provavelmente logado com sucesso');
                }
            }

            

            // Verificar se há mensagens de erro ou sucesso na página

            try {

                const mensagens = await this.page.evaluate(() => {

                    const elementos = document.querySelectorAll('.error, .success, .message, .alert, [role="alert"]');

                    return Array.from(elementos).map(el => el.textContent.trim()).filter(text => text.length > 0);

                });

                

                if (mensagens.length > 0) {

                    console.log('📝 Mensagens encontradas na página:', mensagens);

                } else {


                }

            } catch (error) {

            }

            

            // Verificar se login foi bem-sucedido


            const isLoggedIn = await this.verificarSeLogado(credenciais);

            

            if (isLoggedIn) {


                this.isLoggedIn = true;

                

                // Salvar cookies da sessão

                this.sessionData = await this.page.cookies();


                

                return true;

            } else {

                // 🆕 NOVO: Capturar mais informações sobre o estado da página antes de falhar

                try {

                    const urlFinal = this.page.url();

                    console.log(`📍 URL final após tentativa de login: ${urlFinal}`);

                    

                    if (urlFinal.includes('mfa-recovery-code-challenge')) {

                        console.log('🔐 FALHA: Usuário precisa inserir código de recuperação');

                        throw new Error('Código de recuperação requerido - tentativa de automatização em andamento');

                    } else if (urlFinal.includes('onvio.com.br/staff') || urlFinal.includes('onvio.com.br')) {


                        console.log(`📍 URL da Onvio: ${urlFinal}`);

                        // 🆕 NOVO: Verificar se realmente está logado na Onvio

                        try {

                            // Aguardar um pouco para a página carregar completamente

                            await new Promise(resolve => setTimeout(resolve, 3000));

                            

                            // Verificar se há elementos da dashboard da Onvio

                            const elementosOnvio = await this.page.evaluate(() => {

                                const elementos = Array.from(document.querySelectorAll('*'));

                                const elementosOnvio = elementos.filter(el => {

                                    const texto = el.textContent?.trim() || '';

                                    return texto.includes('Documentos') || 

                                           texto.includes('Documents') || 

                                           texto.includes('Arquivos') || 

                                           texto.includes('Files') || 

                                           texto.includes('Dashboard') || 

                                           texto.includes('Menu') || 

                                           texto.includes('Navegação') || 

                                           texto.includes('Navigation');

                                });

                                

                                return elementosOnvio.map(el => ({

                                    tag: el.tagName.toLowerCase(),

                                    texto: el.textContent?.trim(),

                                    classe: el.className || '',

                                    id: el.id || ''

                                })).filter(item => item.texto && item.texto.length > 0);

                            });

                            

                            if (elementosOnvio.length > 0) {

                                console.log('✅ ELEMENTOS DA ONVIO ENCONTRADOS:');

                                elementosOnvio.slice(0, 10).forEach((el, index) => {

                                    console.log(`   ${index + 1}. ${el.tag}${el.id ? `#${el.id}` : ''}: "${el.texto}"`);

                                });

                                

                                // 🆕 NOVO: Tentar encontrar "Meus Documentos" ou similar

                                console.log('🔍 Procurando por "Meus Documentos" ou similar...');

                                

                                const resultadoDocumentos = await this.page.evaluate(() => {

                                    const elementos = Array.from(document.querySelectorAll('*'));

                                    const elementosDocumentos = elementos.filter(el => {

                                        const texto = el.textContent?.trim() || '';

                                        return texto.includes('Documentos') || 

                                               texto.includes('Documents') || 

                                               texto.includes('Arquivos') || 

                                               texto.includes('Files') || 

                                               texto.includes('Meus Documentos') || 

                                               texto.includes('My Documents');

                                    });

                                    

                                    if (elementosDocumentos.length > 0) {

                                        const primeiro = elementosDocumentos[0];

                                        return { 

                                            sucesso: true, 

                                            texto: primeiro.textContent?.trim(),

                                            tag: primeiro.tagName.toLowerCase(),

                                            classe: primeiro.className || '',

                                            id: primeiro.id || ''

                                        };

                                    }

                                    

                                    return { sucesso: false };

                                });

                                

                                if (resultadoDocumentos.sucesso) {

                                    console.log(`🎯 ELEMENTO DE DOCUMENTOS ENCONTRADO: ${resultadoDocumentos.tag} "${resultadoDocumentos.texto}"`);

                                    console.log(`   Classe: ${resultadoDocumentos.classe}`);

                                    console.log(`   ID: ${resultadoDocumentos.id}`);

                                    

                                    // 🆕 NOVO: Tentar clicar no elemento de documentos

                                    try {

                                        const elementoDocumentos = await this.page.$(`${resultadoDocumentos.tag}${resultadoDocumentos.id ? `#${resultadoDocumentos.id}` : ''}${resultadoDocumentos.classe ? `.${resultadoDocumentos.classe.split(' ')[0]}` : ''}`);

                                        

                                        if (elementoDocumentos) {

                                            await elementoDocumentos.click();

                                            console.log('✅ Clicado no elemento de documentos!');

                                            console.log('🔄 Aguardando carregamento da página de documentos...');

                                            await new Promise(resolve => setTimeout(resolve, 3000));

                                            

                                            // Capturar URL da página de documentos

                                            const urlDocumentos = this.page.url();

                                            console.log(`📍 URL da página de documentos: ${urlDocumentos}`);

                                            

                                        } else {

                                            console.log('⚠️ Elemento de documentos encontrado mas não foi possível clicar');

                                        }

                                        

                                    } catch (error) {

                                        console.log('❌ Erro ao clicar no elemento de documentos:', error.message);

                                    }

                                    
                                } else {

                                    console.log('⚠️ Nenhum elemento de documentos encontrado na página da Onvio');

                                }

                                
                            } else {

                                console.log('⚠️ Nenhum elemento específico da Onvio encontrado');

                            }

                            
                        } catch (error) {

                            console.log('❌ Erro ao verificar elementos da Onvio:', error.message);

                        }

                        

                        // Retornar sucesso pois chegamos na Onvio

                        return true;

                        

                    } else if (urlFinal.includes('login') || urlFinal.includes('auth')) {

                        console.log('🔐 FALHA: Ainda na página de login - credenciais podem estar incorretas');

                        throw new Error('Falha na autenticação - verifique as credenciais');

                    } else {

                        console.log('🔐 FALHA: Página desconhecida após tentativa de login');

                        throw new Error('Falha na autenticação - página inesperada após login');

                    }

                } catch (captureError) {

                    console.log('❌ Erro ao capturar informações da página:', captureError.message);

                    throw new Error('Falha na autenticação - verifique as credenciais');

                }

            }

            

        } catch (error) {

            

            // Tentar fechar navegador em caso de erro

            try {

                await this.fecharNavegador();

            } catch (closeError) {

            }

            

            throw new Error(`Falha no login: ${error.message}`);

        }

    }



    /**

     * 🏢 Obtém as credenciais Onvio da empresa da tabela empresas

     */

    async obterCredenciaisEmpresa(empresaId) {

        try {

            const [empresas] = await db.query(

                'SELECT onvioLogin, onvioSenha, onvioMfaSecret FROM empresas WHERE id = ?',

                [empresaId]

            );



            if (empresas.length > 0 && empresas[0].onvioLogin && empresas[0].onvioSenha) {
                // Descriptografar senha (se estiver em base64)
                let senhaDescriptografada;
                try {
                    senhaDescriptografada = Buffer.from(empresas[0].onvioSenha, 'base64').toString();
                } catch (e) {
                    senhaDescriptografada = empresas[0].onvioSenha;
                }

                return {

                    email: empresas[0].onvioLogin,

                    senha: senhaDescriptografada,

                    mfaSecret: empresas[0].onvioMfaSecret

                };

            } else {

                return null;

            }

        } catch (error) {

            return null;

        }

    }



    /**

     * 🏢 Obtém o email da empresa da tabela empresas (método mantido para compatibilidade)

     */

    async obterEmailEmpresa(empresaId) {

        try {

            const credenciais = await this.obterCredenciaisEmpresa(empresaId);

            return credenciais ? credenciais.email : null;

        } catch (error) {

            return null;

        }

    }



    /**

     * ✅ Verifica se o usuário está logado

     */

    async verificarSeLogado(credenciais = null) {

        try {

            // Aguardar um pouco para a página carregar

            await new Promise(resolve => setTimeout(resolve, 1000));

            


            

            // Capturar URL atual

            const url = this.page.url();


            

            // 🆕 NOVO: Verificar se está na página de MFA (Multi-Factor Authentication)

            if (url.includes('mfa-login-options')) {

                console.log('🔐 DETECTADA PÁGINA DE AUTENTICAÇÃO DE 2 FATORES (MFA)!');

                // Usar nova função de MFA com autenticador TOTP
                try {
                    await this.processarMFAComAutenticador(credenciais);
                    
                    // Aguardar redirecionamento e continuar o login
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Verificar se o login foi bem-sucedido
                    const urlAposLogin = this.page.url();
                    console.log(`📍 URL após MFA: ${urlAposLogin}`);
                    
                    if (urlAposLogin.includes('onvio.com.br/staff') || urlAposLogin.includes('onvio.com.br')) {
                        console.log('🎉 SUCESSO! Login com MFA completado!');
                        this.isLoggedIn = true;
                        return true;
                    }
                    
                } catch (mfaError) {
                    console.log('❌ Erro no processamento MFA:', mfaError.message);
                    throw new Error(`Falha na autenticação MFA: ${mfaError.message}`);
                }

                

                // Capturar todo o conteúdo da página para debug

                try {

                    const conteudoPagina = await this.page.evaluate(() => {

                        // Capturar título da página

                        const titulo = document.title;

                        

                        // Capturar todos os textos visíveis

                        const textos = Array.from(document.querySelectorAll('*'))

                            .map(el => el.textContent?.trim())

                            .filter(text => text && text.length > 0)

                            .slice(0, 20); // Limitar a 20 primeiros textos para não poluir o log

                        

                        // Capturar elementos específicos de MFA

                        const elementosMFA = {

                            titulos: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))

                                .map(el => el.textContent?.trim())

                                .filter(text => text && text.length > 0),

                            botoes: Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'))

                                .map(el => ({

                                    texto: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '',

                                    tipo: el.tagName.toLowerCase(),

                                    classe: el.className || '',

                                    id: el.id || ''

                                }))

                                .filter(btn => btn.texto && btn.texto.length > 0),

                            mensagens: Array.from(document.querySelectorAll('.message, .alert, [role="alert"], .error, .success, .info'))

                                .map(el => el.textContent?.trim())

                                .filter(text => text && text.length > 0),

                            campos: Array.from(document.querySelectorAll('input, select, textarea'))

                                .map(el => ({

                                    tipo: el.type || el.tagName.toLowerCase(),

                                    placeholder: el.placeholder || '',

                                    id: el.id || '',

                                    classe: el.className || '',

                                    name: el.name || ''

                                }))

                                .filter(campo => campo.tipo !== 'hidden')

                        };

                        

                        return {

                            titulo,

                            textos: textos.slice(0, 10), // Primeiros 10 textos

                            elementosMFA

                        };

                    });

                    

                    console.log('📄 CONTEÚDO DA PÁGINA MFA:');

                    console.log('   Título:', conteudoPagina.titulo);

                    console.log('   Textos principais:', conteudoPagina.textos);

                    console.log('   Títulos encontrados:', conteudoPagina.elementosMFA.titulos);

                    console.log('   Botões disponíveis:', conteudoPagina.elementosMFA.botoes.map(b => `${b.tipo}: "${b.texto}"`));

                    console.log('   Mensagens:', conteudoPagina.elementosMFA.mensagens);

                    console.log('   Campos de entrada:', conteudoPagina.elementosMFA.campos.map(c => `${c.tipo}: ${c.placeholder || c.name || c.id}`));

                    

                } catch (error) {

                    console.log('❌ Erro ao capturar conteúdo da página MFA:', error.message);

                }

                

                // 🆕 NOVO: Tentar clicar automaticamente no "Código de recuperação"

                console.log('🔐 Tentando clicar automaticamente no "Autenticador Google ou similar"...');

                try {

                    // Aguardar um pouco para garantir que a página carregou completamente

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    

                    // Tentar diferentes estratégias para encontrar o botão "Código de recuperação"

                    console.log('🔍 Procurando botão "Autenticador Google ou similar" com diferentes estratégias...');

                    

                    let botaoClicado = false;

                    

                    // Estratégia 1: Usar evaluate para encontrar e clicar no botão

                    try {

                        const resultado = await this.page.evaluate(() => {

                            // Procurar por botões que contenham o texto "Autenticador Google ou similar"

                            const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));

                            const botaoCodigoRecuperacao = botoes.find(botao => {

                                const texto = botao.textContent?.trim() || botao.value || botao.getAttribute('aria-label') || '';

                                return texto.includes('Código de recuperação') || 

                                       texto.includes('Recovery code') || 

                                       texto.includes('Código') || 

                                       texto.includes('Recuperação');

                            });

                            

                            if (botaoCodigoRecuperacao) {

                                console.log(`🔍 Botão encontrado: "${botaoCodigoRecuperacao.textContent?.trim() || botaoCodigoRecuperacao.value}"`);

                                botaoCodigoRecuperacao.click();

                                return { sucesso: true, texto: botaoCodigoRecuperacao.textContent?.trim() || botaoCodigoRecuperacao.value };

                            }

                            

                            return { sucesso: false, texto: 'Botão não encontrado' };

                        });

                        

                        if (resultado.sucesso) {

                            console.log(`✅ Clicado no botão: "${resultado.texto}"`);

                            botaoClicado = true;

                        } else {

                            console.log('❌ Botão não encontrado via evaluate');

                        }

                        

                    } catch (error) {

                        console.log('❌ Erro na estratégia evaluate:', error.message);

                    }

                    

                    // Estratégia 2: Tentar seletores CSS diretos se a primeira falhou

                    if (!botaoClicado) {

                        const seletoresCSS = [

                            'button',

                            'input[type="submit"]',

                            'a[role="button"]',

                            '[data-testid*="recovery"]',

                            '[data-testid*="code"]',

                            '.recovery-code-button',

                            '.code-button'

                        ];

                        

                        for (const seletor of seletoresCSS) {

                            try {

                                const elementos = await this.page.$$(seletor);

                                for (const elemento of elementos) {

                                    const texto = await elemento.evaluate(el => el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '');

                                    if (texto.includes('Código de recuperação') || texto.includes('Recovery code') || texto.includes('Código') || texto.includes('Recuperação')) {

                                        await elemento.click();

                                        console.log(`✅ Clicado no botão via CSS: "${texto}"`);

                                        botaoClicado = true;

                                        break;

                                    }

                                }

                                if (botaoClicado) break;

                            } catch (error) {

                                console.log(`❌ Erro ao tentar seletor CSS ${seletor}:`, error.message);

                            }

                        }

                    }

                    

                    // Estratégia 3: Tentar clicar por texto usando evaluate

                    if (!botaoClicado) {

                        try {

                            const resultado = await this.page.evaluate(() => {

                                // Procurar por qualquer elemento clicável que contenha o texto

                                const elementos = document.querySelectorAll('*');

                                for (const elemento of elementos) {

                                    const texto = elemento.textContent?.trim() || '';

                                    if (texto.includes('Código de recuperação') && (elemento.tagName === 'BUTTON' || elemento.tagName === 'A' || elemento.tagName === 'INPUT')) {

                                        elemento.click();

                                        return { sucesso: true, texto };

                                    }

                                }

                                return { sucesso: false };

                            });

                            

                            if (resultado.sucesso) {

                                console.log(`✅ Clicado no botão via texto: "${resultado.texto}"`);

                                botaoClicado = true;

                            }

                        } catch (error) {

                            console.log('❌ Erro na estratégia de texto:', error.message);

                        }

                    }

                    

                    if (botaoClicado) {

                        console.log('🔄 Aguardando carregamento da próxima página após clicar no código de recuperação...');

                        await new Promise(resolve => setTimeout(resolve, 3000));

                        

                        // Capturar a nova URL e conteúdo

                        const novaUrl = this.page.url();

                        console.log(`📍 Nova URL após clicar no código de recuperação: ${novaUrl}`);

                        

                        // 🆕 NOVO: Verificar se estamos na página de inserção do código de recuperação

                        if (novaUrl.includes('mfa-recovery-code-challenge')) {

                            console.log('🔐 DETECTADA PÁGINA DE INSERÇÃO DO CÓDIGO DE RECUPERAÇÃO!');

                            

                            // Buscar o código de autenticação na tabela empresas

                            try {

                                // 🆕 NOVO: Buscar empresaId das credenciais ou usar uma abordagem alternativa

                                let empresaIdParaBusca = null;

                                

                                // Tentar obter empresaId das credenciais se disponível

                                if (this.credenciaisAtuais && this.credenciaisAtuais.empresaId) {

                                    empresaIdParaBusca = this.credenciaisAtuais.empresaId;

                                } else {

                                    // Buscar todas as empresas que têm código de autenticação

                                    const [todasEmpresas] = await db.query(

                                        'SELECT id, onvioCodigoAutenticacao FROM empresas WHERE onvioCodigoAutenticacao IS NOT NULL AND onvioCodigoAutenticacao != ""'

                                    );

                                    

                                    if (todasEmpresas.length > 0) {

                                        // Usar a primeira empresa que tem código

                                        empresaIdParaBusca = todasEmpresas[0].id;

                                        console.log(`🔍 Usando empresa ID ${empresaIdParaBusca} (primeira com código disponível)`);

                                    }

                                }

                                

                                if (empresaIdParaBusca) {

                                    const [empresaInfo] = await db.query(

                                        'SELECT onvioCodigoAutenticacao FROM empresas WHERE id = ?',

                                        [empresaIdParaBusca]

                                    );

                                

                                if (empresaInfo.length > 0 && empresaInfo[0].onvioCodigoAutenticacao) {

                                    const codigoAutenticacao = empresaInfo[0].onvioCodigoAutenticacao;

                                    console.log(`🔑 Código de autenticação encontrado na empresa: ${codigoAutenticacao}`);

                                    

                                    // Inserir o código no campo de entrada

                                    try {

                                        await this.page.type('input[name="code"]', codigoAutenticacao);

                                        console.log(`✅ Código inserido no campo: ${codigoAutenticacao}`);

                                        
                                        
                                        // Aguardar um pouco e clicar em "Continuar"

                                        await new Promise(resolve => setTimeout(resolve, 1000));

                                        
                                        
                                        // Clicar no botão "Continuar"

                                        const resultadoContinuar = await this.page.evaluate(() => {

                                            const botoes = Array.from(document.querySelectorAll('button, input[type="submit"]'));

                                            const botaoContinuar = botoes.find(botao => {

                                                const texto = botao.textContent?.trim() || botao.value || '';

                                                return texto.includes('Continuar') || texto.includes('Continue') || texto.includes('Submit');

                                            });

                                            

                                            if (botaoContinuar) {

                                                botaoContinuar.click();

                                                return { sucesso: true, texto: botaoContinuar.textContent?.trim() || botaoContinuar.value };

                                            }

                                            return { sucesso: false };

                                        });

                                        
                                        
                                                                                    if (resultadoContinuar.sucesso) {

                                                console.log(`✅ Clicado no botão: "${resultadoContinuar.texto}"`);

                                                console.log('🔄 Aguardando carregamento após enviar o código...');

                                                await new Promise(resolve => setTimeout(resolve, 3000));

                                                

                                                // Capturar a URL final e conteúdo

                                                const urlFinal = this.page.url();

                                                console.log(`📍 URL final após enviar código: ${urlFinal}`);

                                                

                                                // 🆕 NOVO: Verificar se estamos na página de confirmação do código

                                                if (urlFinal.includes('mfa-recovery-code-challenge-new-code')) {

                                                    console.log('🔐 DETECTADA PÁGINA DE CONFIRMAÇÃO DO CÓDIGO DE RECUPERAÇÃO!');

                                                    

                                                    // Aguardar um pouco para garantir que a página carregou

                                                    await new Promise(resolve => setTimeout(resolve, 2000));

                                                    

                                                    // 🆕 NOVO: Marcar o checkbox "Eu registrei esse código com segurança"

                                                    try {

                                                        console.log('✅ Marcando checkbox "Eu registrei esse código com segurança"...');

                                                        

                                                        // Tentar diferentes seletores para o checkbox

                                                        const seletoresCheckbox = [

                                                            'input[type="checkbox"]',

                                                            'input[type="radio"]',

                                                            '[role="checkbox"]',

                                                            '.checkbox',

                                                            '[data-testid*="checkbox"]',

                                                            '[data-testid*="confirm"]'

                                                        ];

                                                        
                                                        let checkboxMarcado = false;

                                                        for (const seletor of seletoresCheckbox) {

                                                            try {

                                                                const checkboxes = await this.page.$$(seletor);

                                                                for (const checkbox of checkboxes) {

                                                                    const texto = await checkbox.evaluate(el => {

                                                                        // Procurar texto próximo ao checkbox

                                                                        const label = el.closest('label')?.textContent?.trim();

                                                                        const parent = el.parentElement?.textContent?.trim();

                                                                        const ariaLabel = el.getAttribute('aria-label') || '';

                                                                        return (label || parent || ariaLabel).toLowerCase();

                                                                    });

                                                                    

                                                                    if (texto.includes('registrei') || texto.includes('segurança') || 

                                                                        texto.includes('confirm') || texto.includes('agree') || 

                                                                        texto.includes('aceito') || texto.includes('concordo')) {

                                                                        await checkbox.click();

                                                                        console.log(`✅ Checkbox marcado via seletor: ${seletor}`);

                                                                        checkboxMarcado = true;

                                                                        break;

                                                                    }

                                                                }

                                                                if (checkboxMarcado) break;

                                                            } catch (error) {

                                                                console.log(`❌ Erro ao tentar seletor ${seletor}:`, error.message);

                                                            }

                                                        }

                                                        
                                                        if (checkboxMarcado) {

                                                            console.log('✅ Checkbox marcado com sucesso!');

                                                            console.log('🔄 Aguardando um pouco após marcar o checkbox...');

                                                            await new Promise(resolve => setTimeout(resolve, 1000));

                                                            

                                                            // 🆕 NOVO: Clicar no botão "Continuar"

                                                            console.log('✅ Clicando no botão "Continuar"...');

                                                            const resultadoContinuarFinal = await this.page.evaluate(() => {

                                                                const botoes = Array.from(document.querySelectorAll('button, input[type="submit"]'));

                                                                const botaoContinuar = botoes.find(botao => {

                                                                    const texto = botao.textContent?.trim() || botao.value || '';

                                                                    return texto.includes('Continuar') || texto.includes('Continue') || texto.includes('Submit');

                                                                });

                                                                

                                                                if (botaoContinuar) {

                                                                    botaoContinuar.click();

                                                                    return { sucesso: true, texto: botaoContinuar.textContent?.trim() || botaoContinuar.value };

                                                                }

                                                                return { sucesso: false };

                                                            });

                                                            

                                                            if (resultadoContinuarFinal.sucesso) {

                                                                console.log(`✅ Clicado no botão final: "${resultadoContinuarFinal.texto}"`);

                                                                console.log('🔄 Aguardando carregamento da página final...');

                                                                await new Promise(resolve => setTimeout(resolve, 5000));

                                                                

                                                                // Capturar a URL final e conteúdo

                                                                const urlFinalFinal = this.page.url();

                                                                console.log(`📍 URL FINAL após completar todo o processo: ${urlFinalFinal}`);

                                                                

                                                                // Capturar conteúdo da página final

                                                                try {

                                                                    const conteudoFinalFinal = await this.page.evaluate(() => {

                                                                        const titulo = document.title;

                                                                        const textos = Array.from(document.querySelectorAll('*'))

                                                                            .map(el => el.textContent?.trim())

                                                                            .filter(text => text && text.length > 0)

                                                                            .slice(0, 15);

                                                                        

                                                                        const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'))

                                                                            .map(el => ({

                                                                                texto: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '',

                                                                                tipo: el.tagName.toLowerCase(),

                                                                                classe: el.className || '',

                                                                                id: el.id || ''

                                                                            }))

                                                                            .filter(btn => btn.texto && btn.texto.length > 0);

                                                                        

                                                                        return { titulo, textos, botoes };

                                                                    });

                                                                    
                                                                    console.log('📄 CONTEÚDO DA PÁGINA FINAL APÓS COMPLETAR TODO O PROCESSO:');

                                                                    console.log('   Título:', conteudoFinalFinal.titulo);

                                                                    console.log('   Textos principais:', conteudoFinalFinal.textos);

                                                                    console.log('   Botões disponíveis:', conteudoFinalFinal.botoes.map(b => `${b.tipo}: "${b.texto}"`));

                                                                    
                                                                } catch (error) {

                                                                    console.log('❌ Erro ao capturar conteúdo da página final:', error.message);

                                                                }

                                                                
                                                            } else {

                                                                console.log('❌ Não foi possível encontrar o botão "Continuar" final');

                                                            }

                                                            
                                                        } else {

                                                            console.log('❌ Não foi possível marcar o checkbox de confirmação');

                                                        }

                                                        
                                                    } catch (error) {

                                                        console.log('❌ Erro ao marcar checkbox ou clicar em continuar:', error.message);

                                                    }

                                                    
                                                } else {

                                                    // Capturar conteúdo da página (código original)

                                                    try {

                                                        const conteudoFinal = await this.page.evaluate(() => {

                                                            const titulo = document.title;

                                                            const textos = Array.from(document.querySelectorAll('*'))

                                                                .map(el => el.textContent?.trim())

                                                                .filter(text => text && text.length > 0)

                                                                .slice(0, 10);

                                                            

                                                            const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'))

                                                                .map(el => ({

                                                                    texto: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '',

                                                                    tipo: el.tagName.toLowerCase(),

                                                                    classe: el.className || '',

                                                                    id: el.id || ''

                                                                }))

                                                                .filter(btn => btn.texto && btn.texto.length > 0);

                                                            

                                                            return { titulo, textos, botoes };

                                                        });

                                                        
                                                        console.log('📄 CONTEÚDO DA PÁGINA APÓS ENVIAR CÓDIGO:');

                                                        console.log('   Título:', conteudoFinal.titulo);

                                                        console.log('   Textos principais:', conteudoFinal.textos);

                                                        console.log('   Botões disponíveis:', conteudoFinal.botoes.map(b => `${b.tipo}: "${b.texto}"`));

                                                        
                                                    } catch (error) {

                                                        console.log('❌ Erro ao capturar conteúdo da página:', error.message);

                                                    }

                                                }

                                            
                                        } else {

                                            console.log('❌ Não foi possível encontrar o botão "Continuar"');

                                        }

                                        
                                    } catch (error) {

                                        console.log('❌ Erro ao inserir código ou clicar em continuar:', error.message);

                                    }

                                    
                                } else {

                                    console.log('❌ Código de autenticação não encontrado na tabela empresas');

                                }

                            } else {

                                console.log('❌ Nenhuma empresa com código de autenticação encontrada');

                            }

                                
                            } catch (error) {

                                console.log('❌ Erro ao buscar código de autenticação:', error.message);

                            }

                            
                        } else {

                            // Capturar conteúdo da nova página (código original)

                            try {

                                const novoConteudo = await this.page.evaluate(() => {

                                    const titulo = document.title;

                                    const textos = Array.from(document.querySelectorAll('*'))

                                        .map(el => el.textContent?.trim())

                                        .filter(text => text && text.length > 0)

                                        .slice(0, 15);

                                    

                                    const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'))

                                        .map(el => ({

                                            texto: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '',

                                            tipo: el.tagName.toLowerCase(),

                                            classe: el.className || '',

                                            id: el.id || ''

                                        }))

                                        .filter(btn => btn.texto && btn.texto.length > 0);

                                    

                                    const campos = Array.from(document.querySelectorAll('input, select, textarea'))

                                        .map(el => ({

                                            tipo: el.type || el.tagName.toLowerCase(),

                                            placeholder: el.placeholder || '',

                                            id: el.id || '',

                                            classe: el.className || '',

                                            name: el.name || ''

                                        }))

                                        .filter(campo => campo.tipo !== 'hidden');

                                    

                                    return { titulo, textos, botoes, campos };

                                });

                                
                                console.log('📄 CONTEÚDO DA NOVA PÁGINA APÓS CÓDIGO DE RECUPERAÇÃO:');

                                console.log('   Título:', novoConteudo.titulo);

                                console.log('   Textos principais:', novoConteudo.textos);

                                console.log('   Botões disponíveis:', novoConteudo.botoes.map(b => `${b.tipo}: "${b.texto}"`));

                                console.log('   Campos de entrada:', novoConteudo.campos.map(c => `${c.tipo}: ${c.placeholder || c.name || c.id}`));

                                
                            } catch (error) {

                                console.log('❌ Erro ao capturar conteúdo da nova página:', error.message);

                            }

                        }

                    } else {

                        console.log('❌ Não foi possível encontrar o botão "Código de recuperação"');

                        

                        // 🆕 NOVO: Capturar estrutura detalhada da página para debug

                        console.log('🔍 Capturando estrutura detalhada da página para debug...');

                        try {

                            const estruturaDetalhada = await this.page.evaluate(() => {

                                const elementos = Array.from(document.querySelectorAll('*'));

                                const elementosClicaveis = elementos.filter(el => {

                                    const tag = el.tagName.toLowerCase();

                                    const isClicavel = tag === 'button' || tag === 'a' || tag === 'input' || 

                                                     el.onclick || el.getAttribute('onclick') || 

                                                     el.getAttribute('role') === 'button';

                                    return isClicavel;

                                });

                                

                                return elementosClicaveis.map(el => ({

                                    tag: el.tagName.toLowerCase(),

                                    texto: el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '',

                                    id: el.id || '',

                                    classe: el.className || '',

                                    onclick: !!el.onclick,

                                    role: el.getAttribute('role') || '',

                                    type: el.getAttribute('type') || '',

                                    href: el.getAttribute('href') || ''

                                })).filter(item => item.texto.length > 0);

                            });

                            

                            console.log('📋 ELEMENTOS CLICÁVEIS ENCONTRADOS:');

                            estruturaDetalhada.forEach((el, index) => {

                                console.log(`   ${index + 1}. ${el.tag}${el.id ? `#${el.id}` : ''}${el.classe ? `.${el.classe.split(' ')[0]}` : ''}: "${el.texto}"`);

                            });

                            

                        } catch (error) {

                            console.log('❌ Erro ao capturar estrutura detalhada:', error.message);

                        }

                    }

                    

                } catch (error) {

                    console.log('❌ Erro ao tentar clicar no código de recuperação:', error.message);

                }

                

                // Retornar false pois ainda não está completamente logado

                return false;

            }

            

            // Verificar se existe algum elemento que indica que está logado

            const elementosLogado = [

                '.user-menu',

                '.profile-menu',

                '[data-testid="user-menu"]',

                '.avatar',

                '.user-info',

                '.dashboard',

                '.home',

                '.main-content',

                '.user-profile',

                '.account-menu'

            ];

            

            for (const seletor of elementosLogado) {

                try {

                    const elemento = await this.page.$(seletor);

                    if (elemento) {

                        console.log(`✅ Elemento de login encontrado: ${seletor}`);

                        return true;

                    }

                } catch (e) {

                    // Continua para o próximo seletor

                }

            }

            

            // Verificar se ainda está na página de login

            if (url.includes('login') || url.includes('auth') || url.includes('mfa')) {

                console.log('⚠️ Ainda na página de autenticação - não logado');

                return false;

            }

            

            // 🆕 NOVO: Verificar se chegou na Onvio (sucesso!)

            if (url.includes('onvio.com.br/staff') || url.includes('onvio.com.br')) {


                return true;

            }

            

            // Se chegou até aqui e não está na página de login, provavelmente está logado

            console.log('✅ Provavelmente logado - não está em página de autenticação');

            return true;

            

        } catch (error) {

            console.log('❌ Erro ao verificar se está logado:', error.message);

            return false;

        }

    }



    /**

     * 🏢 Navega para a página "Minha Empresa"

     */

    async navegarParaMinhaEmpresa() {

        try {

            if (!this.isLoggedIn) {

                throw new Error('Usuário não está logado');

            }



            console.log('🏢 Navegando para página "Minha Empresa"...');

            

            // Tentar diferentes caminhos para acessar "Minha Empresa"

            const caminhosPossiveis = [

                'a[href*="empresa"]',

                'a[href*="company"]',

                'a[href*="dashboard"]',

                '.menu-empresa',

                '.company-menu',

                '[data-testid="company-menu"]'

            ];

            

            let encontrou = false;

            for (const caminho of caminhosPossiveis) {

                try {

                    const elemento = await this.page.$(caminho);

                    if (elemento) {

                        await elemento.click();

                        encontrou = true;

                        break;

                    }

                } catch (e) {

                    // Continua para o próximo caminho

                }

            }

            

            if (!encontrou) {

                // Tentar navegar diretamente pela URL

                await this.page.goto('https://www.onvio.com.br/br/dashboard', {

                    waitUntil: 'networkidle2'

                });

            }

            

            // Aguardar carregamento da página

            await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 500ms para velocidade máxima

            

            return true;

        } catch (error) {

            throw new Error(`Falha na navegação: ${error.message}`);

        }

    }



    /**

     * 📄 Busca documentos de uma empresa específica

     */

    async buscarDocumentosEmpresa(cnpj, competencia = null, tituloDocumento = null, obrigacaoClienteId = null, empresaId = null, clienteId = null, atividadeIdEspecifica = null) {

        try {

            if (!this.isLoggedIn) {

                console.log('⚠️ Usuário não está logado. Tentando reconstruir caminho na sidebar antes de abortar...');

                if (tituloDocumento) {

                    const resultadoNavegacao = await this.navegarPelaSidebar(tituloDocumento, competencia, obrigacaoClienteId, empresaId);

                    if (resultadoNavegacao && resultadoNavegacao.sucesso) {

                        this.isLoggedIn = true;

                    } else {

                        throw new Error('Usuário não está logado e não foi possível reconstruir o caminho na sidebar');

                    }

                } else {

                    throw new Error('Usuário não está logado');

                }

            }

            if (!this.isLoggedIn) {

                throw new Error('Usuário não está logado');

            }
            if (competencia) {
            }

            if (tituloDocumento) {
            }

            // Navegar para área de documentos

            await this.navegarParaAreaDocumentos();

            // ✅ IMPORTANTE: Verificar e trocar base ANTES de buscar/selecionar cliente
            // Isso garante que estamos na base correta antes de digitar o CNPJ
            let dadosCliente = null;
            if (clienteId) {
                dadosCliente = await this.buscarDadosClientePorId(clienteId);
                if (dadosCliente && dadosCliente.base) {
                    console.log(`🔍 Verificando base antes de buscar cliente. Base desejada: ${dadosCliente.base}`);
                    await this.verificarETrocarBase(dadosCliente.base);
                }
            } else {
                // ✅ Se não temos clienteId, buscar dados do cliente pelo CNPJ para verificar a base
                console.log(`🔍 Buscando dados do cliente pelo CNPJ para verificar base antes de selecionar...`);
                const dadosClientePorCNPJ = await this.buscarNomeClientePorCNPJ(cnpj);
                if (dadosClientePorCNPJ && dadosClientePorCNPJ.base) {
                    console.log(`🔍 Base encontrada pelo CNPJ: ${dadosClientePorCNPJ.base}`);
                    await this.verificarETrocarBase(dadosClientePorCNPJ.base);
                    dadosCliente = dadosClientePorCNPJ;
                }
            }

            // Buscar e selecionar cliente (AGORA a base já está correta)
            if (clienteId && dadosCliente) {
                // Se temos clienteId e dados, usar dados do cliente
                    console.log(`👤 Dados do cliente encontrados pelo ID ${clienteId}:`, dadosCliente);
                    await this.selecionarClientePorDados(dadosCliente);
            } else if (dadosCliente) {
                // Se temos dados do cliente (por CNPJ), usar
                console.log(`👤 Dados do cliente encontrados pelo CNPJ:`, dadosCliente);
                await this.selecionarClientePorDados(dadosCliente);
                } else {
                // Fallback: buscar pelo CNPJ (a base já foi verificada acima)
                console.log(`👤 Buscando cliente pelo CNPJ (base já verificada)...`);
                await this.selecionarClientePorCNPJ(cnpj);
            }
            
            // Se tiver título do documento, navegar pela sidebar
            if (tituloDocumento) {
                console.log(`🧭 Navegando pela sidebar para encontrar: ${tituloDocumento}`);
                
                // 🎯 NOVA FUNCIONALIDADE: Passar obrigacaoClienteId e empresaId se disponíveis
                const resultadoNavegacao = await this.navegarPelaSidebar(tituloDocumento, competencia, obrigacaoClienteId, empresaId, atividadeIdEspecifica);
                
                // Se a navegação retornou um documento, retornar as informações
                if (resultadoNavegacao && resultadoNavegacao.sucesso && resultadoNavegacao.arquivo) {
                    return [{
                        titulo: resultadoNavegacao.arquivo.nome || resultadoNavegacao.arquivo.titulo || 'Documento sem nome',
                        tipo: 'documento_encontrado_match_imediato',
                        competencia: competencia,
                        linkDocumento: resultadoNavegacao.arquivo.linkDocumento,
                        urlAtual: resultadoNavegacao.arquivo.urlAtual,
                        href: resultadoNavegacao.arquivo.href,
                        dataEncontrado: new Date().toISOString(),
                        status: 'encontrado_com_link',
                        mensagem: resultadoNavegacao.mensagem,
                        matchImediato: true
                    }];
                }
                
                // Se não foi match imediato, continuar com o processo normal
                console.log(`📄 Documento encontrado, mas não foi match imediato. Continuando processo...`);
                
                // 🚀 CORREÇÃO: Verificar se arquivo existe antes de acessar propriedades
                if (!resultadoNavegacao.arquivo) {
                    console.log(`⚠️ Arquivo não encontrado na navegação, continuando processo normal...`);
                    // Continuar com o processo normal sem arquivo
                } else {
                    const resultado = {
                        titulo: resultadoNavegacao.arquivo.nome || resultadoNavegacao.arquivo.titulo || 'Documento sem nome',
                        tipo: 'documento_encontrado',
                        competencia: competencia,
                        linkDocumento: resultadoNavegacao.arquivo.linkDocumento,
                        urlAtual: resultadoNavegacao.arquivo.urlAtual,
                        href: resultadoNavegacao.arquivo.href,
                        dataEncontrado: new Date().toISOString(),
                        status: 'encontrado_com_link',
                        mensagem: resultadoNavegacao.mensagem
                    };
                    
                    // Adicionar informações sobre atividade se disponível
                    if (resultadoNavegacao.atividadeConcluida !== undefined) {
                        resultado.atividadeConcluida = resultadoNavegacao.atividadeConcluida;
                        resultado.comentarioInserido = resultadoNavegacao.comentarioInserido;
                        if (resultadoNavegacao.erroMatch) {
                            resultado.erroMatch = resultadoNavegacao.erroMatch;
                        }
                    }
                    
                    return [resultado];
                }
            } else if (resultadoNavegacao && !resultadoNavegacao.sucesso) {
                return [{
                    titulo: tituloDocumento,
                    tipo: 'navegacao_falhou',
                    competencia: competencia,
                    dataEncontrado: new Date().toISOString(),
                    status: 'erro_navegacao',
                    erro: resultadoNavegacao.erro || resultadoNavegacao.mensagem
                }];
            }
            
            // Tentar navegar para área específica de documentos do cliente se necessário
            await this.navegarParaDocumentosCliente();
            

            // Aplicar filtros de competência se fornecida

            if (competencia) {

                await this.filtrarPorCompetencia(competencia);

            }

            

            // Buscar documentos

            const documentos = await this.extrairDocumentos();

            

            console.log(`✅ ${documentos.length} documentos encontrados para CNPJ ${cnpj}`);

            return documentos;

            

        } catch (error) {

            throw new Error(`Falha na busca: ${error.message}`);

        }

    }



    /**

     * 📁 Navega para a área de documentos

     */

    async navegarParaAreaDocumentos() {

        try {
            // Tentar diferentes seletores para área de documentos
            const seletoresDocumentos = [

                'a[href*="documentos"]',

                'a[href*="documents"]',

                'a[href*="arquivos"]',

                'a[href*="files"]',

                '.menu-documentos',

                '.documents-menu',

                '[data-testid="documents-menu"]'

            ];

            

            let encontrou = false;
            let tentativas = 0;
            const maxTentativas = 20; // 20 tentativas = 20 segundos

            while (!encontrou && tentativas < maxTentativas) {

                tentativas++;


                

                for (const seletor of seletoresDocumentos) {

                    try {

                        const elemento = await this.page.$(seletor);

                        if (elemento) {


                            await elemento.click();

                            encontrou = true;

                            break;

                        }

                    } catch (e) {

                        // Continua para o próximo seletor

                    }

                }

                

                if (!encontrou) {

                    console.log(`⏳ Aguardando 1 segundo antes da próxima tentativa...`);

                    await new Promise(resolve => setTimeout(resolve, 1000));

                }

            }

            

            if (!encontrou) {

                throw new Error(`Não foi possível encontrar a área de documentos após ${maxTentativas} tentativas`);

            }

            


            // Aguardar carregamento da página de documentos
            await new Promise(resolve => setTimeout(resolve, 2000));

            

        } catch (error) {

            throw new Error(`Falha na navegação para documentos: ${error.message}`);

        }

    }



    /**

     * 👤 Seleciona cliente pelo CNPJ (busca pelo nome e clica)
     */
    async selecionarClientePorCNPJ(cnpj) {
        try {
            console.log(`👤 Selecionando cliente pelo CNPJ: ${cnpj}`);
            
            // Primeiro, buscar o nome e sistema do cliente no banco de dados
            const dadosCliente = await this.buscarNomeClientePorCNPJ(cnpj);
            
            if (!dadosCliente) {
                console.log('⚠️ Dados do cliente não encontrados no banco, tentando filtro direto...');
                await this.filtrarPorCNPJ(cnpj);
                return;
            }
            
            const { nome: nomeCliente, sistema: sistemaCliente, base: baseCliente, codigo: codigoCliente } = dadosCliente;
            console.log(`👤 Dados do cliente encontrados - Nome: ${nomeCliente}, Sistema: ${sistemaCliente}, Base: ${baseCliente}, Código: ${codigoCliente}`);
            
            // 🧠 DELAY INTELIGENTE: Aguardo o tempo necessário para a página processar
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 800ms para 400ms
            console.log('⏳ Aguardando processamento da seleção de cliente...');
            await new Promise(resolve => setTimeout(resolve, 400));
            
            // Tentar encontrar o campo "Selecione um cliente"
            const seletoresCampoCliente = [
                'input[placeholder*="Selecione um cliente"]',
                'input[placeholder*="Select a client"]',
                'input[placeholder*="cliente"]',
                'input[placeholder*="client"]',
                'select[placeholder*="cliente"]',
                'select[placeholder*="client"]',
                '.cliente-select input',
                '.client-select input',
                '[data-testid*="cliente"]',
                '[data-testid*="client"]'
            ];
            
            let campoCliente = null;
            let seletorUsado = '';
            
            for (const seletor of seletoresCampoCliente) {
                try {
                    const elemento = await this.page.$(seletor);
                    if (elemento) {
                        campoCliente = elemento;
                        seletorUsado = seletor;
                        console.log(`✅ Campo cliente encontrado via: ${seletor}`);
                        
                        // Log detalhado do elemento encontrado
                        console.log(`🔍 Tipo do elemento: ${typeof elemento}`);
                        console.log(`🔍 Construtor: ${elemento.constructor.name}`);
                        console.log(`🔍 Propriedades disponíveis: ${Object.getOwnPropertyNames(elemento).join(', ')}`);
                        
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Erro ao buscar seletor ${seletor}: ${e.message}`);
                }
            }
            
            if (!campoCliente) {
                console.log('⚠️ Campo cliente não encontrado, tentando filtro direto...');
                await this.filtrarPorCNPJ(cnpj);
                return;
            }
            
            // Verificação mais robusta do ElementHandle
            const isValidElementHandle = campoCliente && 
                typeof campoCliente === 'object' && 
                campoCliente !== null &&
                (typeof campoCliente.click === 'function' || 
                 typeof campoCliente.focus === 'function' ||
                 typeof campoCliente.type === 'function');
            
            console.log(`🔍 ElementHandle válido para uso: ${isValidElementHandle}`);
            
            if (!isValidElementHandle) {
                console.log('⚠️ ElementHandle não é válido para uso, tentando obter novamente...');
                
                // Tentar obter o elemento novamente com waitForSelector
                try {
                    await this.page.waitForSelector(seletorUsado, { timeout: 10000 });
                    campoCliente = await this.page.$(seletorUsado);
                    
                    if (campoCliente) {
                        console.log(`✅ ElementHandle re-obtido com sucesso via: ${seletorUsado}`);
                    } else {
                        throw new Error('Elemento não encontrado após waitForSelector');
                    }
                } catch (e) {
                    console.log(`❌ Falha ao re-obter ElementHandle: ${e.message}`);
                    console.log('❌ Não foi possível obter um ElementHandle válido, tentando filtro direto...');
                    await this.filtrarPorCNPJ(cnpj);
                    return;
                }
            }
            
            // Clicar no campo para abrir o dropdown
            try {
                await campoCliente.click();
                console.log('✅ Campo cliente clicado, aguardando dropdown...');
            } catch (error) {
                console.log(`⚠️ Erro ao clicar no campo: ${error.message}, tentando abordagem alternativa...`);
                // Tentar clicar via JavaScript
                await this.page.evaluate(el => el.click(), campoCliente);
                console.log('✅ Campo cliente clicado via JavaScript');
            }
            
            // Aguardar dropdown aparecer
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 600ms para 300ms
            console.log('⏳ Aguardando dropdown aparecer...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Garantir que o campo está focado
            try {
                await campoCliente.focus();
                console.log('✅ Campo cliente focado');
            } catch (error) {
                console.log(`⚠️ Erro ao focar campo: ${error.message}, tentando via JavaScript...`);
                await this.page.evaluate(el => el.focus(), campoCliente);
                console.log('✅ Campo cliente focado via JavaScript');
            }
            
            // Limpar o campo usando múltiplas abordagens
            try {
                // Tentar usar clear() se disponível
                if (typeof campoCliente.clear === 'function') {
                    await campoCliente.clear();
                    console.log('✅ Campo limpo usando clear()');
                } else {
                    console.log('⚠️ clear() não disponível, usando abordagem alternativa...');
                    // Usar Ctrl+A + Backspace para limpar
                    await this.page.keyboard.down('Control');
                    await this.page.keyboard.press('KeyA');
                    await this.page.keyboard.up('Control');
                    await this.page.keyboard.press('Backspace');
                    console.log('✅ Campo limpo usando Ctrl+A + Backspace');
                }
            } catch (error) {
                // Fallback: definir valor diretamente via JavaScript
                await this.page.evaluate((el) => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente);
                console.log('✅ Campo limpo usando JavaScript direto');
            }
            
            // Aguardar um pouco após limpar
            await new Promise(resolve => setTimeout(resolve, 100)); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 100ms para velocidade máxima
            
            // Verificar se o campo está realmente vazio
            const valorCampo = await this.page.evaluate(el => el.value, campoCliente);
            if (valorCampo && valorCampo.trim() !== '') {
                console.log(`⚠️ Campo ainda contém valor: "${valorCampo}", tentando limpar novamente...`);
                // Tentar limpar novamente usando JavaScript direto
                await this.page.evaluate((el) => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente);
                await new Promise(resolve => setTimeout(resolve, 100)); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 100ms para velocidade máxima
            }
            
            // Buscar pelo nome do cliente no dropdown
            try {
                // Tentar digitar usando page.type() primeiro
                                // 🚀 OTIMIZAÇÃO: Digitação ULTRA-rápida para velocidade máxima
                await this.page.type(seletorUsado, nomeCliente, { delay: 1 }); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Digitação instantânea para velocidade máxima
            } catch (error) {
                // Tentar abordagem alternativa com campoCliente.type()
                try {
                    // 🚀 OTIMIZAÇÃO: Digitação ULTRA-rápida para velocidade máxima
                await campoCliente.type(nomeCliente, { delay: 1 }); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Digitação instantânea para velocidade máxima
                } catch (error2) {
                    // Última tentativa: usar JavaScript direto
                    try {
                        await this.page.evaluate((el, nome) => {
                            el.value = nome;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }, campoCliente, nomeCliente);
                    } catch (error3) {
                        throw new Error(`Não foi possível digitar no campo cliente: ${error3.message}`);
                    }
                }
            }
            
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 500ms para 300ms
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Tentar encontrar e clicar no cliente correto pelo nome
            let clienteEncontrado = await this.encontrarEClicarCliente(nomeCliente, cnpj);

            // Se não encontrou e temos o código, tentar pelo código
            if (!clienteEncontrado && codigoCliente && codigoCliente.trim() !== '') {
                console.log(`🔄 Cliente não encontrado pelo sistema "${sistemaCliente}", tentando pelo código "${codigoCliente}"...`);
                
                // Limpar o campo e tentar novamente com o código
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, codigoCliente, cnpj);
                clienteEncontrado = await this.encontrarEClicarCliente(codigoCliente, cnpj);
            }
            
            // Se ainda não encontrou e temos a base, tentar pela base
            if (!clienteEncontrado && baseCliente && baseCliente.trim() !== '') {
                console.log(`🔄 Cliente não encontrado pelo código "${codigoCliente}", tentando pela base "${baseCliente}"...`);
                
                // Limpar o campo e tentar novamente com a base
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, baseCliente, cnpj);
                clienteEncontrado = await this.encontrarEClicarCliente(baseCliente, cnpj);
            }

            // Por último, somente tentar por sistema se NÃO for genérico (evita "Onvio")
            const sistemaEhGenerico = sistemaCliente && /onvio/i.test(sistemaCliente);
            if (!clienteEncontrado && sistemaCliente && sistemaCliente.trim() !== '' && !sistemaEhGenerico) {
                console.log(`🔄 Tentando pelo sistema (não genérico): ${sistemaCliente}`);
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, sistemaCliente, cnpj);
                clienteEncontrado = await self.encontrarEClicarCliente(sistemaCliente, cnpj);
            }
            
            if (clienteEncontrado) {
                // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera após clicar no cliente de 1000ms para 500ms
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verificar se a página carregou corretamente
                const urlAtual = this.page.url();
                
            } else {
                console.log('❌ Cliente não encontrado na lista de clientes (tentou nome, sistema, código e base)');
                throw new Error(`Cliente não encontrado: ${nomeCliente} / Sistema: ${sistemaCliente} / Código: ${codigoCliente} / Base: ${baseCliente} (CNPJ: ${cnpj})`);
            }
            
        } catch (error) {
            console.log(`❌ Erro ao selecionar cliente por CNPJ:`, error.message);
            
            // Se o erro for específico de cliente não encontrado, retornar erro mais claro
            if (error.message.includes('Cliente não encontrado')) {
                throw new Error(`❌ CLIENTE NÃO ENCONTRADO: ${error.message}. Verifique se o cliente está cadastrado na Onvio e se as credenciais estão corretas.`);
            }
            
            throw error;
        }
    }

    /**
     * 🔄 Tenta buscar cliente pelo campo "sistema" como fallback
     */
    async tentarBuscaPorSistema(campoCliente, seletorUsado, sistemaCliente, cnpj) {
        try {
            console.log(`🔄 Limpando campo e tentando buscar pelo sistema: "${sistemaCliente}"`);
            
            // Focar no campo
            await campoCliente.focus();
            
            // Limpar completamente usando Ctrl+A + Backspace
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');
            console.log('✅ Campo limpo com Ctrl+A + Backspace');
            
            // Aguardar um pouco
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verificar se o campo está realmente vazio
            const valorCampo = await this.page.evaluate(el => el.value, campoCliente);
            if (valorCampo && valorCampo.trim() !== '') {
                console.log(`⚠️ Campo ainda contém valor: "${valorCampo}", forçando limpeza via JavaScript...`);
                await this.page.evaluate((el) => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente);
            }
            
            // Digitar o valor do campo "sistema"
            try {
                await this.page.type(seletorUsado, sistemaCliente, { delay: 1 });
                console.log(`✅ Sistema "${sistemaCliente}" digitado no campo`);
            } catch (error) {
                // Fallback: usar JavaScript para definir valor
                await this.page.evaluate((el, sistema) => {
                    el.value = sistema;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente, sistemaCliente);
                console.log(`✅ Sistema "${sistemaCliente}" definido via JavaScript`);
            }
            
            // Aguardar dropdown atualizar
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.log(`❌ Erro ao tentar buscar por sistema: ${error.message}`);
            throw error;
        }
    }

    /**
     * 🔢 Extrai apenas o número da base do sistema do cliente
     * Ex: "Base 1" -> "1", "Base 2" -> "2", "Base 3" -> "3"
     */
    extrairNumeroBase(sistema) {
        if (!sistema || typeof sistema !== 'string') {
            return null;
        }
        
        // Mapear algarismos romanos para números
        const romanosParaNumeros = {
            'I': '1',
            'II': '2', 
            'III': '3',
            'IV': '4',
            'V': '5',
            'VI': '6',
            'VII': '7',
            'VIII': '8',
            'IX': '9',
            'X': '10'
        };
        
        // Buscar por padrões como "Base 1", "Base 2", etc.
        const match = sistema.match(/base\s*(\d+)/i);
        if (match) {
            return match[1]; // Retorna apenas o número
        }
        
        // Buscar por padrões como "BASE I", "BASE II", etc.
        const matchRomano = sistema.match(/base\s*([IVX]+)/i);
        if (matchRomano) {
            const romano = matchRomano[1].toUpperCase();
            return romanosParaNumeros[romano] || null;
        }
        
        // Se não encontrar "Base X", tentar extrair apenas números
        const numeroMatch = sistema.match(/(\d+)/);
        if (numeroMatch) {
            return numeroMatch[1];
        }
        
        // Se não encontrar números, tentar algarismos romanos soltos
        const romanoMatch = sistema.match(/\b([IVX]+)\b/i);
        if (romanoMatch) {
            const romano = romanoMatch[1].toUpperCase();
            return romanosParaNumeros[romano] || null;
        }
        
        return null;
    }

    /**
     * 🔍 Busca o nome do cliente no banco de dados pelo CNPJ
     */
    async buscarNomeClientePorCNPJ(cnpj) {
        try {
            // Limpar CNPJ para busca (remover caracteres não numéricos)
            const cnpjLimpo = cnpj.replace(/\D/g, '');
            console.log(`🔍 [buscarNomeClientePorCNPJ] Buscando cliente com CNPJ: ${cnpj} (limpo: ${cnpjLimpo})`);
            
            // ✅ Buscar tanto pelo CNPJ formatado quanto pelo limpo
            // A coluna no banco é cpf_cnpj (snake_case)
            const [clientes] = await db.query(
                `SELECT razao_social, sistema, base, codigo, cpf_cnpj 
                 FROM clientes 
                 WHERE cpf_cnpj = ? OR cpf_cnpj = ? OR REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '/', ''), '-', '') = ?
                 LIMIT 1`,
                [cnpj, cnpj.replace(/\D/g, ''), cnpjLimpo]
            );
            
            console.log(`🔍 [buscarNomeClientePorCNPJ] Resultado da query: ${clientes.length} cliente(s) encontrado(s)`);
            
            if (clientes.length > 0) {
                console.log(`✅ [buscarNomeClientePorCNPJ] Cliente encontrado:`, {
                    razao_social: clientes[0].razao_social,
                    cpf_cnpj: clientes[0].cpf_cnpj,
                    sistema: clientes[0].sistema,
                    base: clientes[0].base,
                    codigo: clientes[0].codigo
                });
                
                // Extrair número da base (onde o cliente está)
                let base = null;
                if (clientes[0].base) {
                    base = this.extrairNumeroBase(clientes[0].base);
                } else if (clientes[0].sistema) {
                    base = this.extrairNumeroBase(clientes[0].sistema);
                }
                
                return {
                    nome: clientes[0].razao_social, // ✅ Usar razao_social ao invés de nome
                    sistema: clientes[0].sistema,
                    base: base,
                    codigo: clientes[0].codigo
                };
            }
            
            console.log(`⚠️ [buscarNomeClientePorCNPJ] Cliente não encontrado no banco`);
            return null;
        } catch (error) {
            console.error(`❌ [buscarNomeClientePorCNPJ] Erro ao buscar cliente:`, error);
            return null;
        }
    }

    /**
     * 🔍 Busca o cliente no banco de dados pelo código
     */
    async buscarClientePorCodigo(codigo) {
        try {
            const [clientes] = await db.query(
                'SELECT nome, sistema, base, codigo, cnpjCpf FROM clientes WHERE codigo = ? LIMIT 1',
                [codigo]
            );
            
            if (clientes.length > 0) {
                // Extrair número da base (onde o cliente está)
                let base = null;
                if (clientes[0].base) {
                    base = this.extrairNumeroBase(clientes[0].base);
                } else if (clientes[0].sistema) {
                    base = this.extrairNumeroBase(clientes[0].sistema);
                }
                
                return {
                    nome: clientes[0].nome,
                    sistema: clientes[0].sistema,
                    base: base,
                    codigo: clientes[0].codigo,
                    cnpjCpf: clientes[0].cnpjCpf
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 🔍 Busca dados do cliente pelo ID (método principal)
     */
    async buscarDadosClientePorId(clienteId) {
        try {
            console.log(`🔍 [buscarDadosClientePorId] Buscando cliente com ID: ${clienteId}`);
            
            // ✅ Usar razao_social e cpf_cnpj (snake_case)
            const [clientes] = await db.query(
                'SELECT razao_social, sistema, base, codigo, cpf_cnpj FROM clientes WHERE id = ? LIMIT 1',
                [clienteId]
            );
            
            console.log(`🔍 [buscarDadosClientePorId] Resultado da query: ${clientes.length} cliente(s) encontrado(s)`);
            
            if (clientes.length > 0) {
                console.log(`✅ [buscarDadosClientePorId] Cliente encontrado:`, {
                    razao_social: clientes[0].razao_social,
                    cpf_cnpj: clientes[0].cpf_cnpj,
                    sistema: clientes[0].sistema,
                    base: clientes[0].base,
                    codigo: clientes[0].codigo
                });
                
                // Extrair número da base (onde o cliente está)
                let base = null;
                if (clientes[0].base) {
                    base = this.extrairNumeroBase(clientes[0].base);
                } else if (clientes[0].sistema) {
                    base = this.extrairNumeroBase(clientes[0].sistema);
                }
                
                return {
                    nome: clientes[0].razao_social, // ✅ Usar razao_social ao invés de nome
                    sistema: clientes[0].sistema,
                    base: base,
                    codigo: clientes[0].codigo,
                    cnpjCpf: clientes[0].cpf_cnpj
                };
            }
            
            console.log(`⚠️ [buscarDadosClientePorId] Cliente não encontrado no banco`);
            return null;
        } catch (error) {
            console.error(`❌ [buscarDadosClientePorId] Erro ao buscar cliente:`, error);
            return null;
        }
    }

    /**
     * 👤 Seleciona cliente usando dados já obtidos (método otimizado)
     */
    async selecionarClientePorDados(dadosCliente) {
        try {
            const { nome: nomeCliente, sistema: sistemaCliente, base: baseCliente, codigo: codigoCliente, cnpjCpf } = dadosCliente;
            console.log(`👤 Selecionando cliente com dados: Nome: ${nomeCliente}, Sistema: ${sistemaCliente}, Base: ${baseCliente}, Código: ${codigoCliente}`);
            
            // 🧠 DELAY INTELIGENTE: Aguardo o tempo necessário para a página processar
            console.log('⏳ Aguardando processamento da seleção de cliente...');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Tentar encontrar o campo "Selecione um cliente"
            const seletoresCampoCliente = [
                'input[placeholder*="Selecione um cliente"]',
                'input[placeholder*="Select a client"]',
                'input[placeholder*="cliente"]',
                'input[placeholder*="client"]',
                'select[placeholder*="cliente"]',
                'select[placeholder*="client"]',
                '.cliente-select input',
                '.client-select input',
                '[data-testid*="cliente"]',
                '[data-testid*="client"]'
            ];
            
            let campoCliente = null;
            let seletorUsado = '';
            
            for (const seletor of seletoresCampoCliente) {
                try {
                    const elemento = await this.page.$(seletor);
                    if (elemento) {
                        campoCliente = elemento;
                        seletorUsado = seletor;
                        console.log(`✅ Campo cliente encontrado via: ${seletor}`);
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Erro ao buscar seletor ${seletor}: ${e.message}`);
                }
            }
            
            if (!campoCliente) {
                console.log('⚠️ Campo cliente não encontrado, tentando filtro direto...');
                await this.filtrarPorCNPJ(cnpjCpf);
                return;
            }
            
            // Clicar no campo para abrir o dropdown
            try {
                await campoCliente.click();
                console.log('✅ Campo cliente clicado, aguardando dropdown...');
            } catch (error) {
                console.log(`⚠️ Erro ao clicar no campo: ${error.message}, tentando abordagem alternativa...`);
                await this.page.evaluate(el => el.click(), campoCliente);
                console.log('✅ Campo cliente clicado via JavaScript');
            }
            
            // Aguardar dropdown aparecer
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 600ms para 300ms
            console.log('⏳ Aguardando dropdown aparecer...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Garantir que o campo está focado
            try {
                await campoCliente.focus();
                console.log('✅ Campo cliente focado');
            } catch (error) {
                console.log(`⚠️ Erro ao focar campo: ${error.message}, tentando via JavaScript...`);
                await this.page.evaluate(el => el.focus(), campoCliente);
                console.log('✅ Campo cliente focado via JavaScript');
            }
            
            // Limpar o campo
            try {
                if (typeof campoCliente.clear === 'function') {
                    await campoCliente.clear();
                    console.log('✅ Campo limpo usando clear()');
                } else {
                    await this.page.keyboard.down('Control');
                    await this.page.keyboard.press('KeyA');
                    await this.page.keyboard.up('Control');
                    await this.page.keyboard.press('Backspace');
                    console.log('✅ Campo limpo usando Ctrl+A + Backspace');
                }
            } catch (error) {
                await this.page.evaluate((el) => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente);
                console.log('✅ Campo limpo usando JavaScript direto');
            }
            
            // Aguardar um pouco após limpar
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verificar se o campo está realmente vazio
            const valorCampo = await this.page.evaluate(el => el.value, campoCliente);
            if (valorCampo && valorCampo.trim() !== '') {
                console.log(`⚠️ Campo ainda contém valor: "${valorCampo}", tentando limpar novamente...`);
                await this.page.evaluate((el) => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, campoCliente);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Tentar encontrar e clicar no cliente correto
            let clienteEncontrado = false;
            
            // 1. Tentar pelo nome
            if (nomeCliente && nomeCliente.trim() !== '') {
                console.log(`🎯 Tentando buscar pelo nome: ${nomeCliente}`);
                try {
                    await this.page.type(seletorUsado, nomeCliente, { delay: 1 });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    clienteEncontrado = await this.encontrarEClicarCliente(nomeCliente, cnpjCpf);
                } catch (error) {
                    console.log(`⚠️ Erro ao buscar pelo nome: ${error.message}`);
                }
            }
            
            // 2. Se não encontrou pelo nome, tentar pelo sistema
            if (!clienteEncontrado && sistemaCliente && sistemaCliente.trim() !== '') {
                console.log(`🔄 Tentando pelo sistema: ${sistemaCliente}`);
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, sistemaCliente, cnpjCpf);
                clienteEncontrado = await this.encontrarEClicarCliente(sistemaCliente, cnpjCpf);
            }
            
            // 3. Se ainda não encontrou, tentar pelo código
            if (!clienteEncontrado && codigoCliente && codigoCliente.trim() !== '') {
                console.log(`🔄 Tentando pelo código: ${codigoCliente}`);
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, codigoCliente, cnpjCpf);
                clienteEncontrado = await this.encontrarEClicarCliente(codigoCliente, cnpjCpf);
            }
            
            // 4. Se ainda não encontrou, tentar pela base
            if (!clienteEncontrado && baseCliente && baseCliente.trim() !== '') {
                console.log(`🔄 Tentando pela base: ${baseCliente}`);
                await this.tentarBuscaPorSistema(campoCliente, seletorUsado, baseCliente, cnpjCpf);
                clienteEncontrado = await this.encontrarEClicarCliente(baseCliente, cnpjCpf);
            }
            
            if (clienteEncontrado) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log('❌ Cliente não encontrado na lista de clientes');
                throw new Error(`Cliente não encontrado: ${nomeCliente} / Sistema: ${sistemaCliente} / Código: ${codigoCliente} / Base: ${baseCliente} (CNPJ: ${cnpjCpf})`);
            }
            
        } catch (error) {
            console.log(`❌ Erro ao selecionar cliente por dados:`, error.message);
            throw error;
        }
    }

    /**
     * 🎯 Encontra e clica no cliente correto na lista
     */
    async encontrarEClicarCliente(nomeCliente, cnpj) {
        try {
            console.log(`🎯 Procurando cliente: ${nomeCliente} (CNPJ: ${cnpj})`);
            
            // 🧠 DELAY INTELIGENTE: Aguardo o tempo necessário para a página processar
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 800ms para 400ms
            console.log('⏳ Aguardando processamento da busca de cliente...');
            await new Promise(resolve => setTimeout(resolve, 400));
            
            // Tentar diferentes seletores para lista de clientes
            // Baseado no HTML fornecido, priorizar os seletores mais específicos
            const seletoresLista = [
                'li[role="option"]', // Prioridade alta - baseado no HTML fornecido
                '.bento-combobox-container-item', // Prioridade alta - baseado no HTML fornecido
                '.bento-combobox-container-list li', // Prioridade alta - baseado no HTML fornecido
                '.cliente-item',
                '.client-item',
                '.cliente-option',
                '.client-option',
                '.dropdown-item',
                '.select-option',
                'div[role="option"]',
                '.cliente-linha',
                '.client-row'
            ];
            
            let clienteEncontrado = false;
            
            for (const seletor of seletoresLista) {
                try {
                    const elementos = await this.page.$$(seletor);
                    
                    if (elementos.length > 0) {
                        console.log(`🔍 Encontrados ${elementos.length} itens na lista com seletor: ${seletor}`);
                        
                        // Procurar pelo cliente com melhor match
                        let melhorMatch = null;
                        let melhorScore = 0;
                        
                        for (const elemento of elementos) {
                            const textoElemento = await this.page.evaluate(el => el.textContent, elemento);
                            
                            if (textoElemento) {
                                const textoLimpo = textoElemento.toLowerCase().trim();
                                const nomeLimpo = nomeCliente.toLowerCase().trim();
                                
                                // Calcular score de similaridade
                                let score = 0;
                                
                                // Match exato
                                if (textoLimpo === nomeLimpo) {
                                    score = 100;
                                }
                                // Nome contém o texto do elemento
                                else if (nomeLimpo.includes(textoLimpo)) {
                                    score = 80;
                                }
                                // Texto do elemento contém o nome
                                else if (textoLimpo.includes(nomeLimpo)) {
                                    score = 70;
                                }
                                // Match parcial (palavras em comum)
                                else {
                                    const palavrasNome = nomeLimpo.split(/\s+/);
                                    const palavrasTexto = textoLimpo.split(/\s+/);
                                    const palavrasComuns = palavrasNome.filter(palavra => 
                                        palavrasTexto.some(texto => texto.includes(palavra) || palavra.includes(texto))
                                    );
                                    score = palavrasComuns.length * 10;
                                }
                                
                                if (score > melhorScore) {
                                    melhorScore = score;
                                    melhorMatch = { elemento, texto: textoElemento, score };
                                }
                            }
                        }
                        
                        // Se encontrou um match com score mínimo
                        if (melhorMatch && melhorMatch.score >= 20) {
                            console.log(`✅ Melhor match encontrado: "${melhorMatch.texto}" (Score: ${melhorMatch.score})`);
                            
                            // Clicar no cliente
                            await melhorMatch.elemento.click();
                            clienteEncontrado = true;
                            break;
                        }
                        
                        if (clienteEncontrado) break;
                    }
                } catch (e) {
                    console.log(`⚠️ Erro com seletor ${seletor}:`, e.message);
                }
            }
            
            if (!clienteEncontrado) {
                console.log('❌ Cliente não encontrado na lista');
                // Log adicional para debug
                console.log(`🔍 Nome procurado: "${nomeCliente}"`);
                console.log(`🔍 CNPJ procurado: "${cnpj}"`);
                console.log('❌ Falha na seleção do cliente - processo será interrompido');
            }
            
            return clienteEncontrado;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 📁 Tenta navegar para área específica de documentos do cliente
     */
    async navegarParaDocumentosCliente() {
        try {
            console.log('📁 Tentando navegar para área específica de documentos do cliente...');
            
            // Aguardar um pouco para a página carregar
            await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 500ms para velocidade máxima
            
            // Tentar diferentes seletores para área de documentos do cliente
            const seletoresDocumentosCliente = [
                'a[href*="documents/client"]',
                'a[href*="documentos/cliente"]',
                'a[href*="client/documents"]',
                'a[href*="cliente/documentos"]',
                '.client-documents',
                '.cliente-documentos',
                '.documents-client',
                '.documentos-cliente',
                '[data-testid*="client-documents"]',
                '[data-testid*="cliente-documentos"]'
            ];
            
            let encontrou = false;
            for (const seletor of seletoresDocumentosCliente) {
                try {
                    const elemento = await this.page.$(seletor);
                    if (elemento) {
                        await elemento.click();
                        encontrou = true;
                        break;
                    }
                } catch (e) {
                    // Continua para o próximo seletor
                }
            }
            
            if (!encontrou) {
                console.log('⚠️ Área específica de documentos do cliente não encontrada');
            }
            
        } catch (error) {
            // Não falha a operação, apenas loga o erro
        }
    }

    /**
     * 🔍 Filtra documentos por CNPJ (MÉTODO DESCONTINUADO - não usado mais)
     * @deprecated Este método não é mais usado, pois agora paramos quando o cliente não é encontrado
     */

    async filtrarPorCNPJ(cnpj) {

        try {

            console.log(`🔍 Aplicando filtro por CNPJ: ${cnpj}`);

            

            // Limpar CNPJ (remover caracteres não numéricos)

            const cnpjLimpo = cnpj.replace(/\D/g, '');

            

            // Tentar diferentes seletores de filtro

            const seletoresFiltro = [

                'input[placeholder*="CNPJ"]',

                'input[name*="cnpj"]',

                'input[name*="cpf"]',

                'input[data-testid*="cnpj"]',

                'input[data-testid*="cpf"]',

                '.filter-cnpj input',

                '.filter-cpf input',
                'input[type="search"]',
                'input[placeholder*="buscar"]',
                'input[placeholder*="search"]'
            ];

            

            let encontrou = false;
            let elemento = null;

            // ✅ AGUARDAR e TENTAR com retry para encontrar o seletor
            const maxTentativas = 5;
            const delayEntreTentativas = 1000;

            for (let tentativa = 1; tentativa <= maxTentativas && !encontrou; tentativa++) {
                console.log(`🔍 Tentativa ${tentativa}/${maxTentativas} de encontrar filtro CNPJ...`);

                for (const seletor of seletoresFiltro) {
                try {
                        // ✅ AGUARDAR o seletor aparecer antes de tentar usar
                        await this.page.waitForSelector(seletor, { timeout: 2000, visible: true });
                        elemento = await this.page.$(seletor);

                    if (elemento) {
                            console.log(`✅ Filtro CNPJ encontrado via seletor: ${seletor}`);
                        await elemento.click();
                            await new Promise(resolve => setTimeout(resolve, 300)); // Aguardar campo ficar ativo
                        await elemento.clear();
                            await new Promise(resolve => setTimeout(resolve, 200));
                            await elemento.type(cnpjLimpo, { delay: 50 });
                        encontrou = true;
                            console.log(`✅ CNPJ ${cnpjLimpo} digitado com sucesso`);
                        break;
                    }
                } catch (e) {
                        // Seletor não encontrado nesta tentativa, continua para o próximo
                        continue;
                    }
                }

                // Se não encontrou, aguardar antes de tentar novamente
                if (!encontrou && tentativa < maxTentativas) {
                    console.log(`⏳ Aguardando ${delayEntreTentativas}ms antes de tentar novamente...`);
                    await new Promise(resolve => setTimeout(resolve, delayEntreTentativas));
                }
            }

            

            if (!encontrou) {

                console.error('❌ Filtro CNPJ não encontrado após várias tentativas. Sem o CNPJ, não é possível encontrar o cliente!');
                throw new Error('Campo de filtro CNPJ não encontrado na página. Não é possível buscar o cliente sem digitar o CNPJ.');

            }

            

            // Aguardar aplicação do filtro

            console.log('⏳ Aguardando aplicação do filtro CNPJ...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            

        } catch (error) {
            console.error(`❌ Erro ao filtrar por CNPJ: ${error.message}`);
            throw error; // ✅ Re-lançar erro para que o chamador saiba que falhou
        }

    }



    /**

     * 📅 Filtra documentos por competência

     */

    async filtrarPorCompetencia(competencia) {

        try {

            console.log(`📅 Aplicando filtro por competência: ${competencia}`);

            

            // Tentar diferentes seletores de filtro de data

            const seletoresData = [

                'input[type="date"]',

                'input[placeholder*="data"]',

                'input[placeholder*="date"]',

                'input[name*="data"]',

                'input[name*="date"]',

                '.filter-data input',

                '.filter-date input'

            ];

            

            let encontrou = false;

            for (const seletor of seletoresData) {

                try {

                    const elemento = await this.page.$(seletor);

                    if (elemento) {

                        await elemento.click();

                        await elemento.clear();

                        await elemento.type(competencia);

                        encontrou = true;

                        break;

                    }

                } catch (e) {

                    // Continua para o próximo seletor

                }

            }

            

            if (!encontrou) {

                console.log('⚠️ Filtro de competência não encontrado, continuando sem filtro...');

            }

            

            // Aguardar aplicação do filtro

            await new Promise(resolve => setTimeout(resolve, 1000));

            

        } catch (error) {

        }

    }



    /**

     * 📄 Extrai documentos da página atual com espera robusta e retry
     */
    async extrairDocumentos(maxTentativas = 1, delayEntreTentativas = 2000) {
        try {
            console.log('📄 Extraindo documentos da página (apenas 1 tentativa, sem retry)...');
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera inicial de 500ms para 200ms
            await new Promise(resolve => setTimeout(resolve, 200));
            // 2. Verificar se a página está carregada e estável
            try {
                // 🚀 OTIMIZAÇÃO: Reduzir timeout de 3000ms para 1500ms
                await this.page.waitForFunction(
                    () => document.readyState === 'complete',
                    { timeout: 1500 }
                );
            } catch (e) {
                console.log('⚠️ Timeout aguardando readyState, continuando...');
            }
            // 3. Aguardar elementos de carregamento desaparecerem (se existirem)
            try {
                const seletoresLoading = [
                    '.loading', '.spinner', '.loader', '.carregando',
                    '[data-loading="true"]', '.is-loading', '.loading-spinner'
                ];
                for (const seletor of seletoresLoading) {
                    try {
                        // 🚀 OTIMIZAÇÃO: Reduzir timeout de 500ms para 200ms
                        await this.page.waitForFunction(
                            (sel) => !document.querySelector(sel),
                            { timeout: 200 },
                            seletor
                        );
                    } catch (e) {}
                }
            } catch (e) {
                console.log('⚠️ Erro ao aguardar elementos de loading, continuando...');
            }
            // 4. Tentar extrair documentos com seletores específicos (apenas uma vez)
            const documentos = await this.tentarExtrairComSeletores();
            if (documentos.length === 0) {
                console.log('❌ Nenhum documento encontrado nesta tentativa.');
                await this.logarEstruturaPagina();
                return [];
            }
            console.log(`✅ Extração bem-sucedida: ${documentos.length} documentos encontrados`);
            return documentos;
        } catch (error) {
            return [];
        }
    }

    /**
     * 🔍 Tenta extrair documentos usando diferentes seletores
     */
    async tentarExtrairComSeletores() {
        // Primeiro, tentar seletores específicos do Onvio baseados no HTML fornecido
        const seletoresOnvio = [
            'dms-grid-text-cell', // Elemento específico do Onvio
            '[dms-grid-text-cell]', // Atributo do elemento
            '.dms-grid-text-cell', // Classe CSS
            'div[dms-content-truncated]', // Elementos com conteúdo truncado
            'a[ng-href*="documents"]', // Links de documentos
            '.cell-text', // Texto das células
            '[uib-tooltip*="DAS MEI"]', // Elementos com tooltip contendo DAS MEI
            '[uib-tooltip*="GUIA"]' // Elementos com tooltip contendo GUIA
        ];

        let documentos = [];
        
        // Tentar seletores específicos do Onvio primeiro
        for (const seletor of seletoresOnvio) {
            try {
                const elementos = await this.page.$$(seletor);
                
                if (elementos.length > 0) {
                    documentos = await this.processarElementosDocumentos(elementos);
                    
                    if (documentos.length > 0) {
                        return documentos;
                    }
                }
            } catch (e) {
                console.log(`⚠️ Erro com seletor Onvio ${seletor}:`, e.message);
            }
        }

        // Se não encontrou com seletores Onvio, tentar seletores genéricos
        const seletoresLista = [
            '.document-list', '.documents-list', '.file-list', '.arquivo-list',
            '[data-testid="documents-list"]', '.table-documents', '.table-files',
            '.documents-table', '.files-table', 'table', '.list-container',
            '.items-list', '.content-list', '.grid-container', '.card-container'
        ];

            for (const seletor of seletoresLista) {
            try {
                // Verificar se o seletor existe na página
                const existeSeletor = await this.page.$(seletor);
                if (!existeSeletor) {
                    continue;
                }
                
                // Aguardar elementos aparecerem dentro do seletor
                try {
                    await this.page.waitForFunction(
                        (sel) => {
                            const container = document.querySelector(sel);
                            return container && container.children.length > 0;
                        },
                        { timeout: 5000 },
                        seletor
                    );
                } catch (e) {
                    console.log(`⚠️ Timeout aguardando elementos em ${seletor}, tentando mesmo assim...`);
                }

                    // Tentar diferentes padrões de elementos
                    const padroesElementos = [
                    `${seletor} .document-item`, `${seletor} .file-item`, `${seletor} tr`,
                    `${seletor} .item`, `${seletor} .row`, `${seletor} .line`,
                    `${seletor} .entry`, `${seletor} .card`, `${seletor} .grid-item`
                    ];
                    
                    for (const padrao of padroesElementos) {
                        try {
                            const elementos = await this.page.$$(padrao);
                    if (elementos.length > 0) {
                                documentos = await this.processarElementosDocumentos(elementos);

                                if (documentos.length > 0) {
                                    return documentos;
                                }
                            }
                        } catch (e) {
                            // Continua para o próximo padrão
                        }
                    }

                } catch (e) {
                    // Continua para o próximo seletor
                }
            }
            
            // Se não encontrou nada, tentar buscar elementos diretamente na página
            console.log('🔍 Tentando buscar elementos diretamente na página...');
        const elementosDiretos = await this.page.$$('tr, .item, .row, .line, .entry, .document-item, .file-item, .card, .grid-item, dms-grid-text-cell, .cell-text, a[ng-href*="documents"]');
            
            if (elementosDiretos.length > 0) {
                documentos = await this.processarElementosDocumentos(elementosDiretos);
            }
            
        return documentos;
    }

    /**
     * 📝 Loga a estrutura da página para debug
     */
    async logarEstruturaPagina() {
        try {
            const estruturaPagina = await this.page.evaluate(() => {
                const elementos = document.querySelectorAll('*');
                const estrutura = {};
                elementos.forEach(el => {
                    const tag = el.tagName.toLowerCase();
                    const classes = Array.from(el.classList).join('.');
                    const id = el.id;
                    if (classes || id) {
                        const seletor = `${tag}${id ? '#' + id : ''}${classes ? '.' + classes : ''}`;
                        estrutura[seletor] = el.textContent?.substring(0, 100) || '';
                    }
                });
                return estrutura;
            });
        } catch (e) {
        }
    }

    /**

     * 🔧 Processa elementos de documentos para extrair informações

     */

    async processarElementosDocumentos(elementos) {

        const documentos = [];

        

        for (let i = 0; i < elementos.length; i++) {

            try {

                const elemento = elementos[i];

                

                // 🎯 PRIORIDADE: Extrair título usando função extrairTexto que prioriza atributos Onvio
                const titulo = await this.extrairTexto(elemento, [
                    // Seletores específicos do Onvio (prioridade alta)
                    'dms-grid-text-cell',
                    '[uib-tooltip]',
                    '[aria-label]',
                    '.cell-text',

                    // Seletores genéricos (prioridade baixa)
                    '.document-title',
                    '.file-title',
                    '.arquivo-titulo',
                    'td:nth-child(1)',
                    'td:nth-child(2)',
                    '.nome-arquivo',
                    '.title',
                    '.name',
                    '.nome',
                    'a',
                    'span',
                    'div'
                ]);

                

                const data = await this.extrairTexto(elemento, [

                    '.document-date',

                    '.file-date',

                    '.arquivo-data',

                    'td:nth-child(2)',

                    'td:nth-child(3)',
                    '.data-criacao',
                    '.date',
                    '.data',
                    'time',
                    '[datetime]'
                ]);

                

                const tipo = await this.extrairTexto(elemento, [

                    '.document-type',

                    '.file-type',

                    '.arquivo-tipo',

                    'td:nth-child(3)',

                    'td:nth-child(4)',
                    '.tipo-documento',
                    '.type',
                    '.tipo',
                    '.extension',
                    '.ext'
                ]);

                

                // Extrair link de download se disponível

                const linkDownload = await this.extrairLinkDownload(elemento);

                

                // Extrair texto completo do elemento para debug
                const textoCompleto = await this.page.evaluate(el => el.textContent, elemento);
                
                // Log adicional para debug dos elementos Onvio
                const tagName = await this.page.evaluate(el => el.tagName, elemento);
                const className = await this.page.evaluate(el => el.className, elemento);
                const attributes = await this.page.evaluate(el => {
                    const attrs = {};
                    for (let attr of el.attributes) {
                        attrs[attr.name] = attr.value;
                    }
                    return attrs;
                }, elemento);
                
                if (titulo && titulo.trim().length > 2 && !titulo.includes('Selecione') && !titulo.includes('Select')) {
                    const documento = {
                        titulo: titulo.trim(),
                        nome: titulo.trim(), // Adicionar propriedade nome para compatibilidade
                        data: data ? data.trim() : null,
                        tipo: tipo ? tipo.trim() : null,
                        linkDownload,
                        href: linkDownload, // Adicionar href para compatibilidade
                        textoCompleto: textoCompleto ? textoCompleto.trim() : null,
                        index: i,
                        elemento: elemento // Adicionar referência ao elemento DOM para poder clicar
                    };
                    
                    documentos.push(documento);
                } else if (textoCompleto && textoCompleto.trim().length > 10) {
                    documentos.push({
                        titulo: textoCompleto.trim().substring(0, 100),
                        nome: textoCompleto.trim().substring(0, 100), // Adicionar propriedade nome para compatibilidade
                        data: null,
                        tipo: 'texto',
                        linkDownload,
                        href: linkDownload, // Adicionar href para compatibilidade
                        textoCompleto: textoCompleto.trim(),
                        index: i,
                        elemento: elemento // Adicionar referência ao elemento DOM para poder clicar
                    });

                }

                

            } catch (error) {

            }

        }

        

        console.log(`        📊 Total de documentos processados: ${documentos.length}`);
        return documentos;

    }



    /**

     * 📝 Extrai texto de um elemento usando múltiplos seletores

     */

    async extrairTexto(elemento, seletores) {

        for (const seletor of seletores) {

            try {

                const textoElemento = await elemento.$(seletor);

                if (textoElemento) {

                    const texto = await this.page.evaluate(el => el.textContent, textoElemento);

                    if (texto && texto.trim()) {

                        return texto;

                    }

                }

            } catch (e) {

            }

        }

        
        // Se não encontrou com seletores específicos, tentar extrair texto direto do elemento
        try {
            const textoDireto = await this.page.evaluate(el => el.textContent, elemento);
            if (textoDireto && textoDireto.trim()) {
                return textoDireto;
            }
        } catch (e) {
            // Se falhar, retorna null
        }
        
        // 🎯 PRIORIDADE: Tentar extrair texto de elementos específicos do Onvio
        try {
            const textoOnvio = await this.page.evaluate(el => {
                // 1. PRIORIDADE MÁXIMA: uib-tooltip (contém o nome exato do arquivo)
                const tooltip = el.getAttribute('uib-tooltip');
                if (tooltip && tooltip.trim()) {
                    return tooltip;
                }
                
                // 2. PRIORIDADE ALTA: aria-label (contém o nome do arquivo)
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel && ariaLabel.trim()) {
                    return ariaLabel;
                }
                
                // 3. PRIORIDADE MÉDIA: text do elemento dms-grid-text-cell
                if (el.tagName === 'DMS-GRID-TEXT-CELL' || el.classList.contains('dms-grid-text-cell')) {
                    const textAttr = el.getAttribute('text');
                    if (textAttr && textAttr.trim()) {
                        return textAttr;
                    }
                }
                
                // 4. PRIORIDADE BAIXA: texto dentro de links (pode conter nome do arquivo)
                const link = el.querySelector('a');
                if (link && link.textContent && link.textContent.trim()) {
                    const linkText = link.textContent.trim();
                    // Filtrar apenas se parecer ser um nome de arquivo
                    if (linkText.length > 3 && !linkText.includes('http') && !linkText.includes('www')) {
                        return linkText;
                    }
                }
                
                // 5. PRIORIDADE MÍNIMA: texto dentro de spans
                const span = el.querySelector('span');
                if (span && span.textContent && span.textContent.trim()) {
                    const spanText = span.textContent.trim();
                    // Filtrar apenas se parecer ser um nome de arquivo
                    if (spanText.length > 3 && !spanText.includes('http') && !spanText.includes('www')) {
                        return spanText;
                    }
                }
                
                return null;
            }, elemento);

            if (textoOnvio && textoOnvio.trim()) {
                return textoOnvio;
            }
        } catch (e) {}

        return null;

    }



    /**

     * 🔗 Extrai link de download de um elemento

     */

    async extrairLinkDownload(elemento) {

        try {

            const seletoresDownload = [

                'a[href*="download"]',

                'a[href*="baixar"]',

                'a[href*=".pdf"]',

                'a[href*=".doc"]',

                'a[href*=".xls"]',

                '.download-link',

                '.btn-download',

                'button[data-download]'

            ];

            

            for (const seletor of seletoresDownload) {

                try {

                    const linkElemento = await elemento.$(seletor);

                    if (linkElemento) {

                        const href = await this.page.evaluate(el => el.href, linkElemento);

                        if (href) {

                            return href;

                        }

                    }

                } catch (e) {

                }

            }

            

            return null;

        } catch (error) {

            return null;

        }

    }



    /**

     * 💾 Fecha o navegador e limpa recursos

     */

    async fecharNavegador() {

        try {

            if (this.browser) {

                await this.browser.close();

                this.browser = null;

                this.page = null;

                this.isLoggedIn = false;

                this.sessionData = null;

            }

        } catch (error) {

        }

    }



    /**

     * 🔄 Reinicia a sessão se necessário

     */

    async reiniciarSessao() {

        try {

            await this.fecharNavegador();

            await this.initializeBrowser();

            return true;

        } catch (error) {

            return false;

        }

    }

    /**
     * 🔍 Encontra e clica em uma parte específica na sidebar
     */
    async encontrarEClicarParteSidebar(parte, nivel) {
        try {
            console.log(`    🔍 Procurando "${parte}" no nível ${nivel}...`);
            
            // 🎯 NOVA FUNCIONALIDADE: Armazenar o histórico de navegação para voltar depois
            // Armazenar o item da sidebar que está sendo clicado (exceto o primeiro nível)
            if (nivel > 0) {
                this.ultimoItemSidebarSelecionado = parte;
            } else if (nivel === 0 && this.ultimoItemSidebarSelecionado === null) {
                // Para o primeiro nível, armazenar se ainda não tiver nada
                this.ultimoItemSidebarSelecionado = parte;
            }
            
            // ESTRATÉGIA 0: AGUARDAR CARREGAMENTO DOS ELEMENTOS
            console.log(`    ⏳ Aguardando carregamento dos elementos...`);
            
            // Aguardar até que elementos com o texto apareçam na página
            const elementoCarregou = await this.aguardarElementoCarregar(parte);
            if (!elementoCarregou) {
                console.log(`    ❌ Elemento "${parte}" não carregou na página`);
                console.log(`    🔍 Tentando verificar se o elemento existe mas não está visível...`);
                
                // Verificar se o elemento existe mas pode estar oculto
                const elementoExisteOculto = await this.page.evaluate((texto) => {
                    const todosElementos = Array.from(document.querySelectorAll('*'));
                    const elementosComTexto = todosElementos.filter(el => {
                        const textoEl = el.textContent || el.innerText || el.title || '';
                        return textoEl.toLowerCase().includes(texto.toLowerCase());
                    });
                    return elementosComTexto.length > 0;
                }, parte);
                
                if (elementoExisteOculto) {
                }
                
                return false;
            }
            
            console.log(`    ✅ Elemento "${parte}" carregou! Agora vou clicar...`);
            
            // ESTRATÉGIA 1: Buscar e clicar diretamente no contexto do navegador
            const resultadoClique = await this.page.evaluate((texto) => {
                const todosElementos = Array.from(document.querySelectorAll('*'));
                
                // Filtrar elementos que contêm o texto e são visíveis
                const elementosComTexto = todosElementos.filter(el => {
                    const textoEl = el.textContent || el.innerText || el.title || '';
                    const temTexto = textoEl.toLowerCase().includes(texto.toLowerCase());
                    const temDimensoes = el.offsetWidth > 0 && el.offsetHeight > 0;
                    const naoOculto = window.getComputedStyle(el).display !== 'none' && 
                                    window.getComputedStyle(el).visibility !== 'hidden';
                    
                    return temTexto && temDimensoes && naoOculto;
                });
                
                if (elementosComTexto.length === 0) {
                    return { sucesso: false, erro: 'Nenhum elemento encontrado' };
                }
                
                // Ordenar por relevância: links e botões primeiro, depois outros elementos
                const elementosOrdenados = elementosComTexto.sort((a, b) => {
                    const aScore = (a.tagName === 'A' ? 10 : 0) + 
                                 (a.tagName === 'BUTTON' ? 8 : 0) + 
                                 (a.onclick ? 5 : 0) + 
                                 (a.getAttribute('role') === 'button' ? 3 : 0) +
                                 (window.getComputedStyle(a).cursor === 'pointer' ? 2 : 0);
                    
                    const bScore = (b.tagName === 'A' ? 10 : 0) + 
                                 (b.tagName === 'BUTTON' ? 8 : 0) + 
                                 (b.onclick ? 5 : 0) + 
                                 (b.getAttribute('role') === 'button' ? 3 : 0) +
                                 (window.getComputedStyle(b).cursor === 'pointer' ? 2 : 0);
                    
                    return bScore - aScore;
                });
                
                // Tentar clicar no elemento mais relevante
                for (const elemento of elementosOrdenados.slice(0, 5)) {
                    try {
                        // Verificar se é clicável
                        const isClickable = elemento.tagName === 'A' || 
                                          elemento.tagName === 'BUTTON' || 
                                          elemento.onclick || 
                                          elemento.getAttribute('role') === 'button' ||
                                          window.getComputedStyle(elemento).cursor === 'pointer' ||
                                          elemento.getAttribute('tabindex') !== null;
                        
                        if (!isClickable) {
                            continue;
                        }
                        
                        // Tentar clicar usando diferentes métodos
                        let cliqueSucesso = false;
                        
                        // Método 1: Clique nativo
                        try {
                            elemento.click();
                            cliqueSucesso = true;
                        } catch (e) {
                            // Método 2: Disparar evento de clique
                            try {
                                const eventoClique = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                elemento.dispatchEvent(eventoClique);
                                cliqueSucesso = true;
                            } catch (e2) {
                                // Método 3: Disparar mousedown + mouseup
                                try {
                                    const eventoMouseDown = new MouseEvent('mousedown', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    });
                                    const eventoMouseUp = new MouseEvent('mouseup', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    });
                                    
                                    elemento.dispatchEvent(eventoMouseDown);
                                    elemento.dispatchEvent(eventoMouseUp);
                                    cliqueSucesso = true;
                                } catch (e3) {
                                    continue;
                                }
                            }
                        }
                        
                        if (cliqueSucesso) {
                            return {
                                sucesso: true,
                                elemento: {
                                    tagName: elemento.tagName,
                                    textContent: elemento.textContent || elemento.innerText || elemento.title || '',
                                    className: elemento.className,
                                    id: elemento.id
                                }
                            };
                        }
                        
                    } catch (e) {
                        continue;
                    }
                }
                
                return { sucesso: false, erro: 'Nenhum elemento clicável encontrado' };
                
            }, parte);
            
            if (resultadoClique.sucesso) {
                // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera após clique de 2000ms para 800ms
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // ESTRATÉGIA 2: Verificar se o clique realmente funcionou
                const mudancaDetectada = await this.verificarMudancaPagina();
                if (mudancaDetectada) {
                    return true;
                } else {
                    // ESTRATÉGIA 3: Tentar clique alternativo se o primeiro não funcionou
                    return await this.tentarCliqueAlternativo(parte, nivel);
                }
                
            } else {
                // ESTRATÉGIA 4: Tentar clique alternativo como fallback
                return await this.tentarCliqueAlternativo(parte, nivel);
            }
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🔍 Verifica se houve mudança na página após um clique
     */
    async verificarMudancaPagina() {
        try {
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 1000ms para 300ms
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verificar se há mudanças visuais (novos elementos, mudanças de URL, etc.)
            const mudancas = await this.page.evaluate(() => {
                // Verificar se há elementos de loading
                const loadings = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="progress"]');
                if (loadings.length > 0) {
                    return true; // Página está carregando
                }
                
                // Verificar se há mudanças na URL
                if (window.location.href !== window.location.href) {
                    return true; // URL mudou
                }
                
                // Verificar se há novos elementos ou mudanças visuais
                const elementosPrincipais = document.querySelectorAll('main, [role="main"], .content, .main');
                if (elementosPrincipais.length > 0) {
                    // Verificar se o conteúdo principal mudou
                    for (const el of elementosPrincipais) {
                        if (el.children.length > 0) {
                            return true; // Há conteúdo principal
                        }
                    }
                }
                
                return false;
            });
            
            return mudancas;
        } catch (error) {
            return false;
        }
    }

    /**
     * 🔄 Tenta clique alternativo se o método principal falhar
     */
    async tentarCliqueAlternativo(parte, nivel) {
        try {
            console.log(`    🔄 Tentando método alternativo para "${parte}"...`);
            
            // ESTRATÉGIA ALTERNATIVA: Usar Puppeteer com seletores mais específicos
            const seletoresAlternativos = [
                `a:contains("${parte}")`,
                `button:contains("${parte}")`,
                `[role="button"]:contains("${parte}")`,
                `[class*="clickable"]:contains("${parte}")`,
                `[class*="folder"]:contains("${parte}")`,
                `[class*="item"]:contains("${parte}")`
            ];
            
            for (const seletor of seletoresAlternativos) {
                try {
                    // Usar XPath para busca por texto
                    const xpath = `//*[contains(text(), '${parte}') and (self::a or self::button or @role='button' or contains(@class, 'clickable'))]`;
                    const elementos = await this.buscarPorXPath(xpath);
                    
                    if (elementos.length > 0) {
                        const elemento = elementos[0];
                        
                        // Verificar se está visível
                        const visivel = await elemento.isVisible();
                        if (!visivel) continue;
                        
                        // Tentar clicar
                        await elemento.click();
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            console.log(`    ❌ Método alternativo também falhou para "${parte}"`);
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🔍 Verifica se um elemento está visível e clicável
     */
    async verificarVisibilidadeElemento(elemento) {
        try {
            const info = await this.page.evaluate(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                
                // Verificar dimensões
                const temDimensoes = rect.width > 0 && rect.height > 0;
                
                // Verificar se está oculto por CSS
                const naoOculto = style.display !== 'none' && 
                                style.visibility !== 'hidden' && 
                                style.opacity !== '0';
                
                // Verificar se parece clicável
                const isClickable = el.tagName === 'A' || 
                                  el.tagName === 'BUTTON' || 
                                  el.onclick || 
                                  el.getAttribute('role') === 'button' ||
                                  el.classList.contains('clickable') || 
                                  style.cursor === 'pointer' ||
                                  el.getAttribute('tabindex') !== null;
                
                // Verificar se está na viewport
                const naViewport = rect.top >= 0 && 
                                 rect.left >= 0 && 
                                 rect.bottom <= window.innerHeight && 
                                 rect.right <= window.innerWidth;
                
                // Verificar se não está coberto por outro elemento
                let naoCoberto = true;
                try {
                    const elementoNoTopo = document.elementFromPoint(
                        rect.left + rect.width / 2, 
                        rect.top + rect.height / 2
                    );
                    naoCoberto = elementoNoTopo === el || el.contains(elementoNoTopo);
                } catch (e) {
                    naoCoberto = true; // Se não conseguir verificar, assume que não está coberto
                }
                
                return {
                    temDimensoes,
                    naoOculto,
                    isClickable,
                    naViewport,
                    naoCoberto,
                    rect: {
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        left: rect.left
                    }
                };
            }, elemento);
            
            return info;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 🎯 Tenta clicar em um elemento usando múltiplas estratégias
     */
    async tentarCliqueRobusto(elemento, nomeElemento) {
        try {
            // Estratégia 1: Verificar se o elemento está visível e clicável
            const infoElemento = await this.verificarVisibilidadeElemento(elemento);
            if (!infoElemento) {
                return false;
            }
            
            if (!infoElemento.temDimensoes) {
                return false;
            }
            
            if (!infoElemento.naoOculto) {
                return false;
            }
            
            if (!infoElemento.isClickable) {
                return false;
            }
            
            if (!infoElemento.naoCoberto) {
                // Tentar scroll para o elemento
                try {
                    await elemento.scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                }
            }
            
            // Estratégia 2: Tentar clique direto
            try {
                await elemento.click();
                return true;
            } catch (e) {
            }
            
            // Estratégia 3: Tentar clique via JavaScript
            try {
                await this.page.evaluate(el => el.click(), elemento);
                return true;
            } catch (e) {
            }
            
            // Estratégia 4: Tentar clique via coordenadas do mouse
            try {
                const rect = await this.page.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    };
                }, elemento);
                
                await this.page.mouse.click(rect.x, rect.y);
                return true;
            } catch (e) {
            }
            
            // Estratégia 5: Tentar clique via dispatch de evento
            try {
                await this.page.evaluate(el => {
                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    el.dispatchEvent(clickEvent);
                }, elemento);
                return true;
            } catch (e) {
            }
            
            // Estratégia 6: Tentar clique via mousedown + mouseup
            try {
                await this.page.evaluate(el => {
                    const mousedownEvent = new MouseEvent('mousedown', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    const mouseupEvent = new MouseEvent('mouseup', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    el.dispatchEvent(mousedownEvent);
                    el.dispatchEvent(mouseupEvent);
                }, elemento);
                return true;
            } catch (e) {
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🔍 Busca ampla por elemento com texto específico em toda a página
     */
    async buscarElementoPorTextoAmplo(texto) {
        try {
            // Usar evaluate para buscar elementos que contenham o texto
            const elementos = await this.page.evaluate((texto) => {
                const todosElementos = Array.from(document.querySelectorAll('*'));
                const elementosFiltrados = todosElementos.filter(el => {
                    const textoEl = el.textContent || el.innerText || el.title || '';
                    return textoEl.toLowerCase().includes(texto.toLowerCase()) && 
                           (el.tagName === 'A' || el.tagName === 'LI' || 
                            el.tagName === 'SPAN' || el.tagName === 'DIV' ||
                            el.tagName === 'BUTTON') &&
                           el.offsetWidth > 0 && el.offsetHeight > 0; // Elementos visíveis
                });
                
                // Ordenar por relevância e clicabilidade
                elementosFiltrados.sort((a, b) => {
                    const textoA = (a.textContent || a.innerText || '').toLowerCase();
                    const textoB = (b.textContent || b.innerText || '').toLowerCase();
                    
                    // Priorizar elementos com texto exato
                    const matchExatoA = textoA === texto.toLowerCase();
                    const matchExatoB = textoB === texto.toLowerCase();
                    
                    if (matchExatoA && !matchExatoB) return -1;
                    if (!matchExatoA && matchExatoB) return 1;
                    
                    // Priorizar elementos clicáveis
                    const clicavelA = a.tagName === 'A' || a.tagName === 'BUTTON' || a.onclick;
                    const clicavelB = b.tagName === 'A' || b.tagName === 'BUTTON' || b.onclick;
                    
                    if (clicavelA && !clicavelB) return -1;
                    if (!clicavelA && clicavelB) return 1;
                    
                    return 0;
                });
                
                // Retornar apenas os primeiros 10 elementos mais relevantes
                return elementosFiltrados.slice(0, 10).map(el => ({
                    tagName: el.tagName,
                    textContent: el.textContent || el.innerText || el.title || '',
                    className: el.className,
                    id: el.id,
                    href: el.href || '',
                    isClickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick,
                    rect: el.getBoundingClientRect()
                }));
            }, texto);
            
            if (elementos && elementos.length > 0) {
                // Tentar clicar no primeiro elemento clicável
                for (const elementoInfo of elementos) {
                    if (elementoInfo.isClickable) {
                        try {
                            // Buscar o elemento real na página
                            const seletor = elementoInfo.id ? `#${elementoInfo.id}` : 
                                          elementoInfo.className ? `.${elementoInfo.className.split(' ')[0]}` : 
                                          `${elementoInfo.tagName.toLowerCase()}`;
                            
                            const elementoReal = await this.page.$(seletor);
                            if (elementoReal) {
                                // Tentar clique robusto
                                const cliqueSucesso = await this.tentarCliqueRobusto(elementoReal, elementoInfo.textContent);
                                if (cliqueSucesso) {
                                    return true;
                                }
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🎯 Busca específica para elementos da interface Onvio
     */
    async buscarElementoOnvio(texto) {
        try {
            // Seletores específicos da interface Onvio
            const seletoresOnvio = [
                '.onvio-tree-item',
                '.tree-item',
                '.folder-item',
                '.document-item',
                '.nav-item',
                '.menu-item',
                '[data-testid*="tree"]',
                '[data-testid*="folder"]',
                '[data-testid*="document"]',
                '.MuiTreeItem-root',
                '.MuiListItem-root',
                '.MuiButton-root',
                '.MuiLink-root'
            ];
            
            for (const seletor of seletoresOnvio) {
                try {
                    const elementos = await this.page.$$(seletor);
                    
                    for (const elemento of elementos) {
                        const textoElemento = await this.page.evaluate(el => {
                            return el.textContent || el.innerText || el.title || el.getAttribute('aria-label') || '';
                        }, elemento);
                        
                        if (textoElemento.toLowerCase().includes(texto.toLowerCase())) {
                            // Verificar se é clicável
                            const isClicavel = await this.page.evaluate(el => {
                                return el.tagName === 'A' || el.tagName === 'BUTTON' || 
                                       el.onclick || el.getAttribute('role') === 'button' ||
                                       el.classList.contains('clickable') || 
                                       el.style.cursor === 'pointer' ||
                                       el.getAttribute('tabindex') !== null;
                            }, elemento);
                            
                            if (isClicavel) {
                                // Usar clique robusto
                                const cliqueSucesso = await this.tentarCliqueRobusto(elemento, textoElemento);
                                if (cliqueSucesso) {
                                    return true;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Continua para o próximo seletor
                }
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🎯 Busca inteligente por elementos em toda a interface (lateral e meio)
     */
    async buscarElementoInteligente(texto) {
        try {
            // Estratégia 1: Busca específica para interface Onvio (prioridade máxima)
            const elementoOnvio = await this.buscarElementoOnvio(texto);
            if (elementoOnvio) {
                return elementoOnvio;
            }
            
            // Estratégia 2: Buscar na sidebar (prioridade alta)
            const elementoSidebar = await this.buscarNaSidebar(texto);
            if (elementoSidebar) {
                return elementoSidebar;
            }
            
            // Estratégia 3: Buscar na área principal (meio da tela)
            const elementoMeio = await this.buscarNaAreaPrincipal(texto);
            if (elementoMeio) {
                return elementoMeio;
            }
            
            // Estratégia 4: Busca ampla por toda a página
            const elementoAmplo = await this.buscarElementoPorTextoAmplo(texto);
            if (elementoAmplo) {
                return elementoAmplo;
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 📁 Busca elemento especificamente na sidebar
     */
    async buscarNaSidebar(texto) {
        try {
            // Seletores específicos para sidebar
            const seletoresSidebar = [
                '.sidebar *',
                '.left-panel *',
                '.navigation *',
                '.menu *',
                '.tree *',
                '.folder-tree *',
                '[role="tree"] *',
                '[role="navigation"] *'
            ];
            
            for (const seletor of seletoresSidebar) {
                try {
                    const elementos = await this.page.$$(seletor);
                    
                    for (const elemento of elementos) {
                        const textoElemento = await this.page.evaluate(el => {
                            return el.textContent || el.innerText || el.title || '';
                        }, elemento);
                        
                        if (textoElemento.toLowerCase().includes(texto.toLowerCase())) {
                            // Verificar se é clicável
                            const isClicavel = await this.page.evaluate(el => {
                                return el.tagName === 'A' || el.tagName === 'BUTTON' || 
                                       el.onclick || el.getAttribute('role') === 'button' ||
                                       el.classList.contains('clickable') || 
                                       el.style.cursor === 'pointer';
                            }, elemento);
                            
                            if (isClicavel) {
                                // Usar clique robusto
                                const cliqueSucesso = await this.tentarCliqueRobusto(elemento, textoElemento);
                                if (cliqueSucesso) {
                                    return true;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Continua para o próximo seletor
                }
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 📋 Busca elemento na área principal (meio da tela)
     */
    async buscarNaAreaPrincipal(texto) {
        try {
            // Seletores para área principal
            const seletoresMeio = [
                '.main-content *',
                '.content *',
                '.center-panel *',
                '.right-panel *',
                '.document-area *',
                '.file-list *',
                '.folder-list *',
                '.item-list *'
            ];
            
            for (const seletor of seletoresMeio) {
                try {
                    const elementos = await this.page.$$(seletor);
                    
                    for (const elemento of elementos) {
                        const textoElemento = await this.page.evaluate(el => {
                            return el.textContent || el.innerText || el.title || '';
                        }, elemento);
                        
                        if (textoElemento.toLowerCase().includes(texto.toLowerCase())) {
                            // Verificar se é clicável
                            const isClicavel = await this.page.evaluate(el => {
                                return el.tagName === 'A' || el.tagName === 'BUTTON' || 
                                       el.onclick || el.getAttribute('role') === 'button' ||
                                       el.classList.contains('clickable') || 
                                       el.style.cursor === 'pointer';
                            }, elemento);
                            
                            if (isClicavel) {
                                // Usar clique robusto
                                const cliqueSucesso = await this.tentarCliqueRobusto(elemento, textoElemento);
                                if (cliqueSucesso) {
                                    return true;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Continua para o próximo seletor
                }
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🗂️ Navega pela sidebar esquerda baseado no caminho do documento
     */
    async navegarPelaSidebar(tituloDocumento, competencia = null, obrigacaoClienteId = null, empresaId = null, atividadeIdEspecifica = null) {
        // ✅ TIMEOUT TOTAL: Máximo de 60 segundos para toda a navegação
        const timeoutTotal = 60000; // 60 segundos
        const inicioTempo = Date.now();
        
        try {
            console.log(`🗂️ Navegando pela sidebar com caminho: ${tituloDocumento}`);
            if (competencia) {
                console.log(`📅 Competência para busca de arquivo: ${competencia}`);
            }
            if (obrigacaoClienteId) {
                console.log(`🎯 Obrigação Cliente ID: ${obrigacaoClienteId}`);
            }
            
            // Armazenar o caminho da sidebar para poder voltar depois
            this.caminhoSidebarAtual = tituloDocumento;
            
            // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera inicial de 3000ms para 1000ms
            console.log(`⏳ Aguardando carregamento inicial da página...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Dividir o caminho em partes (pastas/arquivos)
            const partesCaminho = tituloDocumento.split('/').filter(parte => parte.trim() !== '');
            console.log(`📁 Partes do caminho: ${partesCaminho.join(' > ')}`);
            
                // PRIMEIRO: Verificar se já existem links item-name na página
                console.log(`🔍 Verificando links a.item-name já disponíveis...`);
                try {
                    const itemLinks = await this.page.$$('a.item-name');
                    console.log(`🔗 Encontrados ${itemLinks.length} links a.item-name na página`);
                    
                    if (itemLinks.length > 0) {
                        // Mostrar alguns exemplos dos links encontrados
                        for (let i = 0; i < Math.min(5, itemLinks.length); i++) {
                            const linkText = await itemLinks[i].evaluate(el => el.textContent?.trim());
                            const linkHref = await itemLinks[i].evaluate(el => el.href);
                            console.log(`  🔗 ${i + 1}: "${linkText}" -> ${linkHref?.substring(0, 50)}...`);
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Erro ao verificar links item-name:`, e.message);
                }
            
            // Para cada parte do caminho, navegar
            for (let i = 0; i < partesCaminho.length; i++) {
                // ✅ Verificar timeout total antes de processar cada parte
                const tempoDecorrido = Date.now() - inicioTempo;
                if (tempoDecorrido > timeoutTotal) {
                    console.log(`⏱️ TIMEOUT TOTAL: ${timeoutTotal/1000}s ultrapassados. Abortando navegação pela sidebar.`);
                    throw new Error(`Timeout máximo de ${timeoutTotal/1000}s atingido ao navegar pela sidebar`);
                }
                
                const parte = partesCaminho[i].trim();
                const isUltimaParte = (i === partesCaminho.length - 1);
                
                console.log(`🔍 Procurando parte ${i + 1}/${partesCaminho.length}: "${parte}" ${isUltimaParte ? '(ÚLTIMA - PASTA DE DOCUMENTOS)' : '(PASTA)'}`);
                
                // ✅ TIMEOUT POR PARTE: Máximo de 20 segundos por parte
                const timeoutPorParte = 20000; // 20 segundos
                const inicioParte = Date.now();
                
                // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera entre navegações de 2000ms para 500ms
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // 🔍 BUSCA SIMPLIFICADA: Usar a mesma lógica da rota baixar-atividades
                let elementoEncontrado = null;
                let tentativas = 0;
                const maxTentativas = 3;
                
                while (!elementoEncontrado && tentativas < maxTentativas) {
                    // ✅ Verificar timeout por parte
                    const tempoParte = Date.now() - inicioParte;
                    if (tempoParte > timeoutPorParte) {
                        console.log(`⏱️ TIMEOUT: ${timeoutPorParte/1000}s ultrapassados tentando encontrar "${parte}". Abortando e seguindo para próxima atividade.`);
                        throw new Error(`Timeout de ${timeoutPorParte/1000}s ao tentar encontrar "${parte}" na sidebar`);
                    }
                    tentativas++;
                    console.log(`    🔍 Tentativa ${tentativas}/${maxTentativas} para encontrar "${parte}"...`);
                    
                    try {
                        // PRIMEIRO: Mostrar estrutura da SIDEBAR ESQUERDA para debug
                        console.log(`    🔍 DEBUG: Analisando SIDEBAR ESQUERDA onde estão as pastas...`);
                        const elementosAreaPrincipal = await this.page.evaluate(() => {
                            const elementos = [];
                            
                            // Buscar ESPECIFICAMENTE por a.ng-binding (elemento real dos links!)
                            const areasprincipais = [
                                'a.ng-binding',                   // LINKS REAIS das pastas/documentos!
                                'dms-grid-text-cell',            // Container dos links
                                'span',                          // SPANS com nomes das pastas!
                                'a',                             // TODOS os links
                                'body'                           // Todo o body como fallback
                            ];
                            
                            areasprincipais.forEach(seletor => {
                                try {
                                    const containers = document.querySelectorAll(seletor);
                                    containers.forEach(container => {
                                        // Se for a.ng-binding ou dms-grid-text-cell diretamente, analisar o próprio elemento
                                        if (seletor === 'a.ng-binding' || seletor === 'dms-grid-text-cell') {
                                            const texto = container.textContent?.trim() || '';
                                            const title = container.title || container.getAttribute('title') || '';
                                            const ariaLabel = container.getAttribute('aria-label') || '';
                                            const href = container.href || container.getAttribute('href') || '';
                                            
                                            elementos.push({
                                                tagName: container.tagName.toLowerCase(),
                                                texto: texto,
                                                className: container.className || '',
                                                id: container.id || '',
                                                href: href,
                                                title: title,
                                                ariaLabel: ariaLabel,
                                                container: `${seletor} [DIRETO]`
                                            });
                                        } else {
                                            // Para outros seletores, buscar filhos
                                            const elementosFilhos = container.querySelectorAll('*');
                                            elementosFilhos.forEach(el => {
                                                const texto = el.textContent?.trim() || '';
                                                const title = el.title || '';
                                                const name = el.getAttribute('name') || '';
                                                
                                                if (texto.length > 0 || title.length > 0 || name.length > 0) {
                                                    elementos.push({
                                                        tagName: el.tagName.toLowerCase(),
                                                        texto: texto,
                                                        className: el.className || '',
                                                        id: el.id || '',
                                                        href: el.href || '',
                                                        title: title,
                                                        name: name,
                                                        container: seletor
                                                    });
                                                }
                                            });
                                        }
                                    });
                                } catch (e) {
                                    // Ignorar erros de seletores
                                }
                            });
                            
                            // Se não encontrou nada nas áreas principais, buscar em elementos com texto "contabil"
                            if (elementos.length === 0) {
                                const todosElementos = document.querySelectorAll('*');
                                todosElementos.forEach(el => {
                                    const texto = el.textContent?.trim() || '';
                                    if (texto.toLowerCase().includes('contabil') || 
                                        texto.toLowerCase().includes('pasta') ||
                                        texto.toLowerCase().includes('documento') ||
                                        texto.toLowerCase().includes('arquivo')) {
                                        elementos.push({
                                            tagName: el.tagName.toLowerCase(),
                                            texto: texto,
                                            className: el.className || '',
                                            id: el.id || '',
                                            href: el.href || '',
                                            container: 'fallback-search'
                                        });
                                    }
                                });
                            }
                            
                            return elementos.slice(0, 2000); // TODOS OS ELEMENTOS para análise completa!
                        });
                        
                        // ✅ LOG REMOVIDO: Log completo de elementos removido para não poluir o console
                        
                        // ESTRATÉGIA 1: BUSCA DIRETA baseada no log detalhado
                        console.log(`    🔍 BUSCA DIRETA: Procurando "${parte}" na página...`);
                        const elementos = await this.page.evaluate((textoBusca) => {
                            const elementos = [];
                            console.log(`🔍 DENTRO DO PAGE.EVALUATE: Procurando por "${textoBusca}"`);
                            
                            // Função para verificar match (case-insensitive)
                            const isTextMatch = (texto, busca) => {
                                if (!texto || !busca) return false;
                                
                                const textoNormalizado = texto.toLowerCase().trim();
                                const buscaNormalizada = busca.toLowerCase().trim();
                                
                                // Match exato
                                if (textoNormalizado === buscaNormalizada) return true;
                                
                                // Match parcial (contém)
                                if (textoNormalizado.includes(buscaNormalizada)) return true;
                                
                                // Match com normalização de acentos
                                const textoSemAcentos = textoNormalizado
                                    .replace(/[àáâãäå]/g, 'a')
                                    .replace(/[èéêë]/g, 'e')
                                    .replace(/[ìíîï]/g, 'i')
                                    .replace(/[òóôõö]/g, 'o')
                                    .replace(/[ùúûü]/g, 'u')
                                    .replace(/ç/g, 'c');
                                    
                                const buscaSemAcentos = buscaNormalizada
                                    .replace(/[àáâãäå]/g, 'a')
                                    .replace(/[èéêë]/g, 'e')
                                    .replace(/[ìíîï]/g, 'i')
                                    .replace(/[òóôõö]/g, 'o')
                                    .replace(/[ùúûü]/g, 'u')
                                    .replace(/ç/g, 'c');
                                
                                return textoSemAcentos.includes(buscaSemAcentos);
                            };
                            
                            // ESTRATÉGIA 1: Busca direta nos seletores específicos do log
                            console.log(`🔍 ESTRATÉGIA 1: Busca direta nos seletores do log...`);
                            
                            // Baseado no log: [a] texto:"Contabilidade" | class:"ng-binding"
                            const linksNgBinding = document.querySelectorAll('a.ng-binding');
                            console.log(`🔍 Links a.ng-binding encontrados: ${linksNgBinding.length}`);
                            
                            linksNgBinding.forEach((el, index) => {
                                    const texto = el.textContent?.trim() || '';
                                console.log(`🔍 Link ${index + 1}: "${texto}"`);
                                
                                if (isTextMatch(texto, textoBusca)) {
                                    console.log(`✅ MATCH EXATO ENCONTRADO: "${texto}" (a.ng-binding)`);
                                    elementos.push({
                                        tagName: 'a',
                                        texto: texto,
                                        href: el.href || '',
                                        className: el.className || '',
                                        id: el.id || '',
                                        role: el.getAttribute('role') || '',
                                        title: el.title || '',
                                        ariaLabel: el.getAttribute('aria-label') || '',
                                        elemento: el
                                    });
                                }
                            });
                            
                            // Baseado no log: [span] texto:"Contabilidade"
                            if (elementos.length === 0) {
                                console.log(`🔍 ESTRATÉGIA 2: Buscando em spans...`);
                                const spans = document.querySelectorAll('span');
                                console.log(`🔍 Spans encontrados: ${spans.length}`);
                                
                                spans.forEach((el, index) => {
                                    const texto = el.textContent?.trim() || '';
                                    if (texto && texto.length < 50) { // Só textos curtos
                                        console.log(`🔍 Span ${index + 1}: "${texto}"`);
                                        
                                        if (isTextMatch(texto, textoBusca)) {
                                            console.log(`✅ MATCH EXATO ENCONTRADO: "${texto}" (span)`);
                                            elementos.push({
                                                tagName: 'span',
                                                texto: texto,
                                                href: el.href || '',
                                                className: el.className || '',
                                                id: el.id || '',
                                                role: el.getAttribute('role') || '',
                                                title: el.title || '',
                                                ariaLabel: el.getAttribute('aria-label') || '',
                                                elemento: el
                                            });
                                        }
                                    }
                                });
                                }
                            
                            // Baseado no log: [div] texto:"Contabilidade" | class:"wj-cell"
                            if (elementos.length === 0) {
                                console.log(`🔍 ESTRATÉGIA 3: Buscando em divs wj-cell...`);
                                const divsWjCell = document.querySelectorAll('div.wj-cell');
                                console.log(`🔍 Divs wj-cell encontrados: ${divsWjCell.length}`);
                                
                                divsWjCell.forEach((el, index) => {
                                    const texto = el.textContent?.trim() || '';
                                    if (texto && texto.length < 50) {
                                        console.log(`🔍 Div wj-cell ${index + 1}: "${texto}"`);
                                        
                                        if (isTextMatch(texto, textoBusca)) {
                                            console.log(`✅ MATCH EXATO ENCONTRADO: "${texto}" (div.wj-cell)`);
                                            elementos.push({
                                                tagName: 'div',
                                                texto: texto,
                                                href: el.href || '',
                                                className: el.className || '',
                                                id: el.id || '',
                                                role: el.getAttribute('role') || '',
                                                title: el.title || '',
                                                ariaLabel: el.getAttribute('aria-label') || '',
                                                elemento: el
                                            });
                                        }
                                    }
                                });
                            }
                            
                            // ESTRATÉGIA 4: Busca em todos os elementos (fallback)
                            if (elementos.length === 0) {
                                console.log(`🔍 ESTRATÉGIA 4: Busca geral em todos os elementos...`);
                                const todosElementos = document.querySelectorAll('*');
                                console.log(`🔍 Total de elementos na página: ${todosElementos.length}`);
                                
                                let contador = 0;
                                for (const el of todosElementos) {
                                    const texto = el.textContent?.trim() || '';
                                    
                                    if (texto && texto.length < 50 && isTextMatch(texto, textoBusca)) {
                                        console.log(`✅ MATCH GERAL ENCONTRADO: "${texto}" (${el.tagName})`);
                                            elementos.push({
                                                tagName: el.tagName.toLowerCase(),
                                                texto: texto,
                                            href: el.href || '',
                                            className: el.className || '',
                                            id: el.id || '',
                                            role: el.getAttribute('role') || '',
                                            title: el.title || '',
                                            ariaLabel: el.getAttribute('aria-label') || '',
                                                elemento: el
                                            });
                                        contador++;
                                        
                                        // Limitar a 5 resultados para performance
                                        if (contador >= 5) break;
                                        }
                                    }
                            }
                            
                            console.log(`🔍 RESULTADO FINAL: ${elementos.length} elementos encontrados`);
                            return elementos;
                        }, parte);
                        
                        // Garantir que elementos seja sempre um array
                        const elementosArray = elementos || [];
                        
                        console.log(`    📊 RESULTADO FINAL: Encontrados ${elementosArray.length} elementos candidatos para "${parte}"`);
                        
                        // Log DETALHADO dos candidatos para debug
                        if (elementosArray.length > 0) {
                            console.log(`    🎯 CANDIDATOS ENCONTRADOS:`);
                            elementosArray.slice(0, 10).forEach((candidato, index) => {
                                console.log(`      ${index + 1}. [${candidato.tagName}] "${candidato.texto}" | href: "${candidato.href?.substring(0, 50)}..." | class: "${candidato.className}"`);
                            });
                        } else {
                            console.log(`    ❌ NENHUM CANDIDATO ENCONTRADO! Verificando problemas na busca...`);
                        }
                        
                        // Log dos primeiros 5 candidatos para debug (antigo)
                        if (elementosArray.length > 0) {
                            console.log(`    🔍 Primeiros candidatos encontrados:`);
                            elementosArray.slice(0, 5).forEach((el, index) => {
                                console.log(`    ${index + 1}. "${el.texto.substring(0, 50)}" (${el.tagName}${el.className ? '.' + el.className.split(' ')[0] : ''})`);
                            });
                        }
                        
                        if (elementosArray.length > 0) {
                            // Ordenar por relevância (exato primeiro, depois parcial)
                            elementosArray.sort((a, b) => {
                                const aExato = a.texto.toLowerCase() === parte.toLowerCase();
                                const bExato = b.texto.toLowerCase() === parte.toLowerCase();
                                
                                if (aExato && !bExato) return -1;
                                if (!aExato && bExato) return 1;
                                
                                // Se ambos são exatos ou parciais, priorizar por tipo
                                const aCliqueavel = a.tagName === 'a' || a.tagName === 'button' || a.role === 'button';
                                const bCliqueavel = b.tagName === 'a' || b.tagName === 'button' || b.role === 'button';
                                
                                if (aCliqueavel && !bCliqueavel) return -1;
                                if (!aCliqueavel && bCliqueavel) return 1;
                                
                                return 0;
                            });
                            
                            elementoEncontrado = elementosArray[0];
                            console.log(`    ✅ Elemento "${parte}" encontrado: ${elementoEncontrado.texto} (${elementoEncontrado.tagName})`);
                        }
                        
                    } catch (error) {
                        console.log(`    ❌ Erro na busca:`, error.message);
                    }
                    
                    if (!elementoEncontrado) {
                            console.log(`    ⏳ Elemento não encontrado, tentando estratégias de fallback...`);
                            
                            // ESTRATÉGIA DE DEBUG: Busca simples e direta
                            try {
                                console.log(`    🔍 DEBUG: Busca simples em elementos específicos...`);
                                const debugInfo = await this.page.evaluate((textoBusca) => {
                                    console.log(`🔍 DEBUG: Procurando por "${textoBusca}"`);
                                    
                                    // Função para verificar match (case-insensitive)
                                    const isTextMatch = (texto, busca) => {
                                        if (!texto || !busca) return false;
                                        
                                        const textoNormalizado = texto.toLowerCase().trim();
                                        const buscaNormalizada = busca.toLowerCase().trim();
                                        
                                        // Match exato
                                        if (textoNormalizado === buscaNormalizada) return true;
                                        
                                        // Match parcial (contém)
                                        if (textoNormalizado.includes(buscaNormalizada)) return true;
                                        
                                        return false;
                                    };
                                    
                                    // Buscar diretamente nos elementos que aparecem no log
                                    const seletores = [
                                        'a.ng-binding',
                                        'span',
                                        'div.wj-cell',
                                        'dms-grid-text-cell',
                                        'div.cell-text'
                                    ];
                                    
                                    const resultados = [];
                                    
                                    seletores.forEach(seletor => {
                                        const elementos = document.querySelectorAll(seletor);
                                        console.log(`🔍 DEBUG: Seletor "${seletor}": ${elementos.length} elementos`);
                                        
                                        elementos.forEach((el, index) => {
                                            const texto = el.textContent?.trim() || '';
                                            
                                            if (texto && texto.length < 100) { // Só textos curtos
                                                console.log(`🔍 DEBUG: Seletor "${seletor}" - Elemento ${index + 1}: "${texto}"`);
                                                
                                                if (isTextMatch(texto, textoBusca)) {
                                                    console.log(`✅ DEBUG: Match encontrado! "${texto}" (${el.tagName})`);
                                                    resultados.push({
                                                        tagName: el.tagName.toLowerCase(),
                                                        texto: texto,
                                                        href: el.href || '',
                                                        className: el.className || '',
                                                        id: el.id || '',
                                                        seletor: seletor
                                                    });
                                                }
                                            }
                                        });
                                    });
                                    
                                    console.log(`🔍 DEBUG: Total de matches encontrados: ${resultados.length}`);
                                    return resultados;
                                }, parte);
                                
                                if (debugInfo && debugInfo.length > 0) {
                                    console.log(`    ✅ DEBUG: Encontrados ${debugInfo.length} matches exatos!`);
                                    debugInfo.forEach((match, index) => {
                                        console.log(`    ${index + 1}. [${match.tagName}] "${match.texto}" | seletor: "${match.seletor}"`);
                                    });
                                    
                                    // Usar o primeiro match encontrado
                                    const primeiroMatch = debugInfo[0];
                                    elementoEncontrado = {
                                        tagName: primeiroMatch.tagName,
                                        texto: primeiroMatch.texto,
                                        href: primeiroMatch.href,
                                        className: primeiroMatch.className,
                                        id: primeiroMatch.id,
                                        role: '',
                                        title: '',
                                        ariaLabel: '',
                                        elemento: null
                                    };
                                    console.log(`    ✅ DEBUG: Elemento encontrado via busca simples!`);
                                } else {
                                    console.log(`    ❌ DEBUG: Nenhum match encontrado`);
                                }
                                
                            } catch (error) {
                                console.log(`    ❌ Erro no debug simples:`, error.message);
                            }
                            
                            // ESTRATÉGIA DE FALLBACK 1: Buscar especificamente em bm-tree-item
                            try {
                                console.log(`    🔍 FALLBACK 1: Buscando em bm-tree-item...`);
                                const elementoFallback = await this.page.evaluate((textoBusca) => {
                                    const treeItems = document.querySelectorAll('bm-tree-item');
                                    console.log(`🔍 FALLBACK: Encontrados ${treeItems.length} bm-tree-item`);
                                    
                                    for (const item of treeItems) {
                                        const texto = item.textContent?.trim() || '';
                                        const title = item.getAttribute('title') || '';
                                        const name = item.getAttribute('name') || '';
                                        
                                        console.log(`🔍 FALLBACK: Item - texto: "${texto}", title: "${title}", name: "${name}"`);
                                        
                                        // Função para verificar match (case-insensitive)
                                        const isTextMatch = (texto, busca) => {
                                            if (!texto || !busca) return false;
                                            
                                            const textoNormalizado = texto.toLowerCase().trim();
                                            const buscaNormalizada = busca.toLowerCase().trim();
                                            
                                            // Match exato
                                            if (textoNormalizado === buscaNormalizada) return true;
                                            
                                            // Match parcial (contém)
                                            if (textoNormalizado.includes(buscaNormalizada)) return true;
                                            
                                            return false;
                                        };
                                        
                                        if (isTextMatch(texto, textoBusca) ||
                                            isTextMatch(title, textoBusca) ||
                                            isTextMatch(name, textoBusca)) {
                                            
                                            console.log(`✅ FALLBACK: Match encontrado em bm-tree-item!`);
                                            return {
                                                tagName: 'bm-tree-item',
                                                texto: texto || title || name,
                                                href: item.getAttribute('href') || '',
                                                className: item.className || '',
                                                id: item.id || '',
                                                role: item.getAttribute('role') || '',
                                                title: title,
                                                ariaLabel: item.getAttribute('aria-label') || '',
                                                elemento: item
                                            };
                                        }
                                    }
                                    
                                    return null;
                                }, parte);
                                
                                if (elementoFallback) {
                                    elementoEncontrado = elementoFallback;
                                    console.log(`    ✅ FALLBACK 1: Elemento "${parte}" encontrado via bm-tree-item!`);
                                }
                            } catch (error) {
                                console.log(`    ❌ Erro na estratégia de fallback 1:`, error.message);
                            }
                            
                            // ESTRATÉGIA DE FALLBACK 2: Busca específica pelo seletor a.ng-binding
                            if (!elementoEncontrado) {
                                try {
                                    console.log(`    🔍 FALLBACK 2: Busca específica em a.ng-binding...`);
                                    const elementoFallback2 = await this.page.evaluate((textoBusca) => {
                                        console.log(`🔍 FALLBACK 2: Procurando por "${textoBusca}" em a.ng-binding`);
                                        
                                        const links = document.querySelectorAll('a.ng-binding');
                                        console.log(`🔍 FALLBACK 2: Encontrados ${links.length} links a.ng-binding`);
                                        
                                        for (let i = 0; i < links.length; i++) {
                                            const el = links[i];
                                            const texto = el.textContent?.trim() || '';
                                            console.log(`🔍 FALLBACK 2: Link ${i + 1}: "${texto}"`);
                                            
                                            if (texto === textoBusca) {
                                                console.log(`✅ FALLBACK 2: Match exato encontrado! "${texto}"`);
                                                return {
                                                    tagName: 'a',
                                                    texto: texto,
                                                    href: el.href || '',
                                                    className: el.className || '',
                                                    id: el.id || '',
                                                    role: el.getAttribute('role') || '',
                                                    title: el.title || '',
                                                    ariaLabel: el.getAttribute('aria-label') || '',
                                                    elemento: el
                                                };
                                            }
                                        }
                                        
                                        console.log(`🔍 FALLBACK 2: Nenhum match encontrado em a.ng-binding`);
                                        return null;
                                    }, parte);
                                    
                                    if (elementoFallback2) {
                                        elementoEncontrado = elementoFallback2;
                                        console.log(`    ✅ FALLBACK 2: Elemento "${parte}" encontrado via a.ng-binding!`);
                                    }
                                } catch (error) {
                                    console.log(`    ❌ Erro na estratégia de fallback 2:`, error.message);
                                }
                            }
                            
                            // ESTRATÉGIA DE FALLBACK 3: Busca específica pelos elementos do log
                            if (!elementoEncontrado) {
                                try {
                                    console.log(`    🔍 FALLBACK 3: Busca específica pelos elementos do log...`);
                                    const elementoFallback3 = await this.page.evaluate((textoBusca) => {
                                        // Buscar especificamente pelos elementos que aparecem no log
                                        const seletoresLog = [
                                            'span',                   // [span] texto:"Contabilidade"
                                            'div.wj-cell',           // [div] texto:"Contabilidade" | class:"wj-cell"
                                            'dms-grid-text-cell',    // [dms-grid-text-cell] texto:"Contabilidade"
                                            'div.cell-text'          // [div] texto:"Contabilidade" | class:"cell-text"
                                        ];
                                        
                                        for (const seletor of seletoresLog) {
                                            console.log(`🔍 FALLBACK 3: Testando seletor "${seletor}"...`);
                                            const elementos = document.querySelectorAll(seletor);
                                            console.log(`🔍 FALLBACK 3: Encontrados ${elementos.length} elementos com "${seletor}"`);
                                            
                                            for (const el of elementos) {
                                                const texto = el.textContent?.trim() || '';
                                                console.log(`🔍 FALLBACK 3: Verificando "${texto}" (${el.tagName})`);
                                                
                                                if (texto === textoBusca) {
                                                    console.log(`✅ FALLBACK 3: Match exato encontrado! "${texto}" (${el.tagName})`);
                                                    return {
                                                        tagName: el.tagName.toLowerCase(),
                                                        texto: texto,
                                                        href: el.href || '',
                                                        className: el.className || '',
                                                        id: el.id || '',
                                                        role: el.getAttribute('role') || '',
                                                        title: el.title || '',
                                                        ariaLabel: el.getAttribute('aria-label') || '',
                                                        elemento: el
                                                    };
                                                }
                                            }
                                        }
                                        
                                        return null;
                                    }, parte);
                                    
                                    if (elementoFallback3) {
                                        elementoEncontrado = elementoFallback3;
                                        console.log(`    ✅ FALLBACK 3: Elemento "${parte}" encontrado via seletores do log!`);
                                    }
                                } catch (error) {
                                    console.log(`    ❌ Erro na estratégia de fallback 3:`, error.message);
                                }
                            }
                            
                            // ESTRATÉGIA DE FALLBACK 4: Busca por texto exato em qualquer elemento
                            if (!elementoEncontrado) {
                                try {
                                    console.log(`    🔍 FALLBACK 4: Busca por texto exato em qualquer elemento...`);
                                    const elementoFallback4 = await this.page.evaluate((textoBusca) => {
                                        const todosElementos = document.querySelectorAll('*');
                                        console.log(`🔍 FALLBACK 4: Verificando ${todosElementos.length} elementos...`);
                                        
                                        for (const el of todosElementos) {
                                            const texto = el.textContent?.trim() || '';
                                            
                                            if (texto === textoBusca) {
                                                console.log(`✅ FALLBACK 4: Match exato encontrado! "${texto}" (${el.tagName})`);
                                                return {
                                                    tagName: el.tagName.toLowerCase(),
                                                    texto: texto,
                                                    href: el.href || '',
                                                    className: el.className || '',
                                                    id: el.id || '',
                                                    role: el.getAttribute('role') || '',
                                                    title: el.title || '',
                                                    ariaLabel: el.getAttribute('aria-label') || '',
                                                    elemento: el
                                                };
                                            }
                                        }
                                        
                                        return null;
                                    }, parte);
                                    
                                    if (elementoFallback4) {
                                        elementoEncontrado = elementoFallback4;
                                        console.log(`    ✅ FALLBACK 4: Elemento "${parte}" encontrado via busca exata!`);
                                    }
                                } catch (error) {
                                    console.log(`    ❌ Erro na estratégia de fallback 4:`, error.message);
                                }
                            }
                            
                            if (!elementoEncontrado) {
                                // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera entre tentativas de 2000ms para 500ms
                                console.log(`    ⏳ Elemento ainda não encontrado, aguardando mais...`);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                    }
                }
                
                if (elementoEncontrado) {
                    console.log(`    ✅ Elemento "${parte}" encontrado! Texto: "${elementoEncontrado.texto}"`);
                    console.log(`    🎯 Clicando no elemento...`);
                    
                    try {
                        // Clicar usando busca por texto (mais confiável que tentar serializar elemento)
                        const clicouComSucesso = await this.page.evaluate((textoBusca, dadosElemento) => {
                            // Buscar novamente o elemento na página usando os dados
                            const elementos = Array.from(document.querySelectorAll('*'));
                            const elemento = elementos.find(el => {
                                const texto = el.textContent?.trim() || '';
                                const className = el.className || '';
                                const id = el.id || '';
                                
                                return texto === dadosElemento.texto && 
                                       className === dadosElemento.className && 
                                       id === dadosElemento.id &&
                                       el.tagName.toLowerCase() === dadosElemento.tagName;
                            });
                            
                            if (elemento) {
                                console.log(`🎯 Elemento localizado! Clicando...`);
                                elemento.click();
                                return true;
                            }
                            
                            // Fallback: buscar por texto aproximado
                            const elementoPorTexto = elementos.find(el => {
                                const texto = el.textContent?.trim() || '';
                                return texto.includes(textoBusca) && texto.length < 200;
                            });
                            
                            if (elementoPorTexto) {
                                console.log(`🎯 Elemento localizado por texto! Clicando...`);
                                elementoPorTexto.click();
                                return true;
                            }
                            
                            return false;
                        }, parte, elementoEncontrado);
                        
                        if (clicouComSucesso) {
                        console.log(`    ✅ Clique realizado em "${parte}"`);
                        } else {
                            console.log(`    ❌ Não foi possível clicar em "${parte}"`);
                        }
                        
                        // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera após clique de 1000ms para 500ms
                        console.log(`    ⏳ Aguardando carregamento após clique...`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                    } catch (error) {
                        console.log(`    ❌ Erro ao clicar em "${parte}":`, error.message);
                            console.log(`❌ Parte "${parte}" não encontrada!`);
                            return { sucesso: false, erro: `Parte "${parte}" não encontrada` };
                    }
                    
                } else {
                    console.log(`    ❌ Elemento "${parte}" não encontrado após ${maxTentativas} tentativas`);
                    console.log(`❌ Parte "${parte}" não encontrada!`);
                    return { sucesso: false, erro: `Parte "${parte}" não encontrada` };
                }
                
                // 🎯 SE É A ÚLTIMA PARTE, FAZER OVERVIEW DOS ARQUIVOS
                if (isUltimaParte) {
                    console.log(`🎯 ÚLTIMA PARTE ATINGIDA! Fazendo overview dos arquivos...`);
                    
                    // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera após clique de 3000ms para 1500ms
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Agora fazer overview dos arquivos na pasta
                    if (competencia) {
                        const resultadoBusca = await this.fazerOverviewArquivosPorCompetencia(competencia, obrigacaoClienteId, empresaId);
                        
                        if (resultadoBusca.sucesso) {
                            return resultadoBusca;
                        } else {
                            console.log(`⚠️ Falha no overview: ${resultadoBusca.erro}`);
                            return resultadoBusca;
                        }
                    } else {
                        // Se não tem competência, apenas extrair documentos
                        const documentos = await this.extrairDocumentos();
                        return {
                            sucesso: true,
                            arquivo: documentos[0] || null,
                            mensagem: `Navegação concluída para: ${parte}`,
                            totalDocumento: documentos.length
                        };
                    }
                }
            }
            
            // Se chegou aqui sem competência, apenas navegação
            console.log(`✅ Navegação concluída`);
            return { sucesso: true, mensagem: "Navegação concluída" };
            
        } catch (error) {
            console.log(`❌ Erro na navegação pela sidebar:`, error.message);
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * 🔍 Verifica se chegou na camada de arquivos (não mais pastas)
     */
    async verificarSeCamadaArquivos() {
        try {
            console.log(`        🔍 Verificando se chegou na camada de arquivos...`);
            
            // Verificar se há elementos que indicam arquivos (não pastas)
            const indicadoresArquivo = await this.page.evaluate(() => {
                const elementos = document.querySelectorAll('*');
                const indicadores = [];
                
                for (const el of elementos) {
                    const texto = el.textContent || el.innerText || '';
                    const tagName = el.tagName.toLowerCase();
                    const className = el.className || '';
                    
                    // Indicadores de que é um arquivo (não pasta)
                    if (
                        // Ícones de arquivo
                        texto.includes('.pdf') || texto.includes('.doc') || texto.includes('.xls') ||
                        texto.includes('.xml') || texto.includes('.txt') || texto.includes('.zip') ||
                        
                        // Classes que indicam arquivos
                        className.includes('file') || className.includes('document') ||
                        className.includes('pdf') || className.includes('download') ||
                        
                        // Atributos que indicam arquivos
                        el.getAttribute('data-type') === 'file' ||
                        el.getAttribute('data-file-type') ||
                        el.getAttribute('href')?.includes('.pdf') ||
                        el.getAttribute('href')?.includes('.doc') ||
                        
                        // Elementos com role de link para download
                        el.getAttribute('role') === 'link' ||
                        el.getAttribute('role') === 'button'
                    ) {
                        indicadores.push({
                            tagName,
                            className,
                            texto: texto.substring(0, 100),
                            href: el.getAttribute('href'),
                            dataType: el.getAttribute('data-type'),
                            role: el.getAttribute('role')
                        });
                    }
                }
                
                return indicadores.slice(0, 20); // Retornar apenas os primeiros 20
            });
            
            if (indicadoresArquivo.length > 0) {
                return true;
            }
            
            console.log(`        ℹ️ Nenhum indicador de arquivo encontrado, provavelmente ainda é uma pasta`);
            return false;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 🔍 Busca e clica no arquivo correto baseado na competência
     */
    async buscarArquivoPorCompetencia(competencia) {
        try {
            console.log(`        🔍 Buscando arquivo por competência: ${competencia}`);
            
            // Extrair mês e ano da competência (formato: "MM/AAAA" ou "M/AAAA")
            const [mes, ano] = competencia.split('/');
            if (!mes || !ano) {
                console.log(`        ⚠️ Formato de competência inválido: ${competencia}`);
                return null;
            }
            
            console.log(`        📅 Buscando arquivo com mês: ${mes}, ano: ${ano}`);
            
            // Buscar elementos que podem ser arquivos
            const arquivosEncontrados = await this.page.evaluate((mes, ano) => {
                const elementos = document.querySelectorAll('*');
                const arquivos = [];
                
                for (const el of elementos) {
                    const texto = el.textContent || el.innerText || '';
                    const tagName = el.tagName.toLowerCase();
                    const className = el.className || '';
                    
                    // Verificar se o texto contém indicadores de mês/ano
                    const temMes = texto.toLowerCase().includes(mes.toLowerCase()) ||
                                  texto.toLowerCase().includes(String(parseInt(mes)).toLowerCase());
                    const temAno = texto.includes(ano);
                    
                    // Verificar se parece ser um arquivo
                    const pareceArquivo = 
                        tagName === 'a' || tagName === 'button' ||
                        className.includes('file') || className.includes('document') ||
                        className.includes('download') || className.includes('clickable') ||
                        el.getAttribute('role') === 'link' || el.getAttribute('role') === 'button' ||
                        el.getAttribute('tabindex') !== null ||
                        el.onclick !== null;
                    
                    if (temMes && temAno && pareceArquivo) {
                        arquivos.push({
                            elemento: el,
                            tagName,
                            className,
                            texto: texto.substring(0, 100),
                            href: el.getAttribute('href'),
                            role: el.getAttribute('role'),
                            tabIndex: el.getAttribute('tabindex'),
                            temMes,
                            temAno
                        });
                    }
                }
                
                return arquivos.slice(0, 10); // Retornar apenas os primeiros 10
            }, mes, ano);
            
            if (arquivosEncontrados.length === 0) {
                console.log(`        ⚠️ Nenhum arquivo encontrado para competência: ${competencia}`);
                return null;
            }
            
            console.log(`        🔍 Encontrados ${arquivosEncontrados.length} arquivos candidatos para competência: ${competencia}`);
            
            // Ordenar por relevância (priorizar elementos mais específicos)
            const arquivosOrdenados = arquivosEncontrados.sort((a, b) => {
                // Priorizar elementos com role específico
                if (a.role && !b.role) return -1;
                if (!a.role && b.role) return 1;
                
                // Priorizar elementos clicáveis
                if (a.tagName === 'a' && b.tagName !== 'a') return -1;
                if (a.tagName !== 'a' && b.tagName === 'a') return 1;
                
                // Priorizar elementos com tabindex
                if (a.tabIndex && !b.tabIndex) return -1;
                if (!a.tabIndex && b.tabIndex) return 1;
                
                return 0;
            });
            
            console.log(`        🎯 Tentando clicar no arquivo mais relevante: "${arquivosOrdenados[0].texto}"`);
            
            // Tentar clicar no primeiro arquivo mais relevante
            const arquivoSelecionado = arquivosOrdenados[0];
            
            // Buscar o elemento real na página
            const seletor = arquivoSelecionado.id ? `#${arquivoSelecionado.id}` : 
                          arquivoSelecionado.className ? `.${arquivoSelecionado.className.split(' ')[0]}` : 
                          `${arquivoSelecionado.tagName.toLowerCase()}`;
            
            const elementoReal = await this.page.$(seletor);
            if (elementoReal) {
                // Primeira tentativa: clicar diretamente em um link interno do item que já contenha /document/
                try {
                    const linkInterno = await this.page.evaluateHandle((sel) => {
                        const el = document.querySelector(sel);
                        if (!el) return null;
                        const link = el.querySelector('a[href*="/document/"]');
                        return link || null;
                    }, seletor);
                    if (linkInterno && linkInterno.asElement) {
                        try { await linkInterno.asElement().click(); } catch(_) {}
                        try { await new Promise(r => setTimeout(r, 400)); } catch(_) {}
                    }
                } catch(_) {}
                // Tentar clique robusto inicial
                const cliqueSucesso = await this.tentarCliqueRobusto(elementoReal, arquivoSelecionado.texto);
                if (cliqueSucesso) {
                    // Repetir tentativas de ABRIR com duplo clique até a URL conter "/document/"
                    let navegouParaDocumento = false;
                    for (let i = 0; i < 6; i++) {
                        // Tenta duplo clique direto no ElementHandle
                        try { await elementoReal.click({ clickCount: 2, delay: 30 }); } catch(_) {}
                        try { await new Promise(r => setTimeout(r, 500)); } catch(_) {}
                        if (/\/document\//i.test(this.page.url())) { navegouParaDocumento = true; break; }
                        
                        // Tenta duplo clique via bounding box
                        try {
                            const box = await elementoReal.boundingBox();
                            if (box) { await this.page.mouse.click(box.x + box.width/2, box.y + box.height/2, { clickCount: 2, delay: 30 }); }
                        } catch(_) {}
                        try { await new Promise(r => setTimeout(r, 500)); } catch(_) {}
                        if (/\/document\//i.test(this.page.url())) { navegouParaDocumento = true; break; }
                        
                        // Fallback: clicar novamente via DOM por texto
                        try {
                            const clicado = await this.page.evaluate((textoAlvo) => {
                                const candidatos = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], div, span'));
                                const alvo = candidatos.find(el => {
                                    const t = (el.textContent || '').toLowerCase();
                                    return t.includes((textoAlvo || '').toLowerCase());
                                });
                                if (!alvo) return false;
                                try { alvo.scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
                                // Emular duplo clique
                                const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window}));
                                try { fire(alvo, 'pointerdown'); fire(alvo, 'mousedown'); fire(alvo, 'pointerup'); fire(alvo, 'mouseup'); } catch(_) {}
                                try { fire(alvo, 'pointerdown'); fire(alvo, 'mousedown'); fire(alvo, 'pointerup'); fire(alvo, 'mouseup'); } catch(_) {}
                                try { if (typeof alvo.click === 'function') { alvo.click(); alvo.click(); } else { alvo.dispatchEvent(new Event('click', { bubbles: true })); alvo.dispatchEvent(new Event('click', { bubbles: true })); } } catch(_) {}
                                return true;
                            }, arquivoSelecionado.texto);
                            if (!clicado) {
                                const reEl = await this.page.$(seletor);
                                if (reEl) {
                                    try { const box2 = await reEl.boundingBox(); if (box2) { await this.page.mouse.click(box2.x + box2.width/2, box2.y + box2.height/2, { clickCount: 2, delay: 30 }); } } catch(_) {}
                                }
                            }
                        } catch (_) {}
                        
                        try { await new Promise(r => setTimeout(r, 500)); } catch(_) {}
                        if (/\/document\//i.test(this.page.url())) { navegouParaDocumento = true; break; }
                    }
                    
                    // Agora já deve estar na página do documento; extrair informações reais
                    const infoAberto = await this.extrairInfoArquivo();
                    return {
                        nome: arquivoSelecionado.texto,
                        tipo: arquivoSelecionado.tagName,
                        href: infoAberto?.linkDocumento || infoAberto?.urlAtual || arquivoSelecionado.href,
                        competencia: competencia,
                        linkDocumento: infoAberto?.linkDocumento || null,
                        urlAtual: infoAberto?.urlAtual || null
                    };
                }
            }
            
            console.log(`        ❌ Falha ao clicar no arquivo: "${arquivoSelecionado.texto}"`);
            return null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 📄 Extrai informações básicas do arquivo (sem base64)
     */
    async extrairInfoArquivo() {
        try {
            const info = await this.page.evaluate(() => {
                // Tentar obter URL atual
                const urlAtual = window.location.href;
                
                // Tentar encontrar link de download ou visualização
                let linkDocumento = null;
                
                // Buscar por botões de download
                const botoesDownload = document.querySelectorAll('button[class*="download"], button[class*="baixar"], a[class*="download"], a[class*="baixar"]');
                if (botoesDownload.length > 0) {
                    linkDocumento = botoesDownload[0].getAttribute('href') || botoesDownload[0].getAttribute('data-url');
                }
                
                // Buscar por links de visualização
                if (!linkDocumento) {
                    const linksVisualizacao = document.querySelectorAll('a[class*="view"], a[class*="visualizar"], a[class*="open"]');
                    if (linksVisualizacao.length > 0) {
                        linkDocumento = linksVisualizacao[0].href;
                    }
                }
                
                // Buscar por iframes com src
                if (!linkDocumento) {
                    const iframes = document.querySelectorAll('iframe[src]');
                    if (iframes.length > 0) {
                        linkDocumento = iframes[0].src;
                    }
                }
                
                return {
                    urlAtual: urlAtual,
                    linkDocumento: linkDocumento
                };
            });
            
            return info;
            
        } catch (error) {
            return {
                urlAtual: null,
                linkDocumento: null
            };
        }
    }

    /**
     * 📄 Extrai o conteúdo base64 do documento após clicá-lo
     */
    async extrairConteudoDocumento() {
        try {
            // Aguardar um pouco para o documento carregar completamente
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verificar se há um PDF viewer ou documento carregado
            const conteudoEncontrado = await this.page.evaluate(() => {
                // Tentar diferentes estratégias para encontrar o conteúdo
                
                // 1. Verificar se há um PDF viewer
                const pdfViewer = document.querySelector('embed[type="application/pdf"]') ||
                                document.querySelector('object[type="application/pdf"]') ||
                                document.querySelector('iframe[src*=".pdf"]');
                
                if (pdfViewer) {
                    return { tipo: 'pdf-viewer', elemento: 'pdf-viewer' };
                }
                
                // 2. Verificar se há um link de download direto
                const downloadLink = document.querySelector('a[href*=".pdf"]') ||
                                   document.querySelector('a[href*=".doc"]') ||
                                   document.querySelector('a[href*=".xls"]') ||
                                   document.querySelector('a[download]');
                
                if (downloadLink) {
                    return { tipo: 'download-link', elemento: 'download-link', href: downloadLink.href };
                }
                
                // 3. Verificar se há um botão de download
                const downloadButton = document.querySelector('button[onclick*="download"]') ||
                                     document.querySelector('button[onclick*="baixar"]') ||
                                     document.querySelector('button[onclick*="export"]');
                
                if (downloadButton) {
                    return { tipo: 'download-button', elemento: 'download-button' };
                }
                
                // 4. Verificar se há um iframe com o documento
                const iframeDoc = document.querySelector('iframe[src*="document"]') ||
                                document.querySelector('iframe[src*="view"]');
                
                if (iframeDoc) {
                    return { tipo: 'iframe', elemento: 'iframe', src: iframeDoc.src };
                }
                
                return null;
            });
            
            if (!conteudoEncontrado) {
                return null;
            }
            
            let conteudoBase64 = null;
            
            switch (conteudoEncontrado.tipo) {
                case 'pdf-viewer':
                    // Tentar extrair do PDF viewer
                    conteudoBase64 = await this.extrairPDFViewer();
                    break;
                    
                case 'download-link':
                    // Tentar baixar via link direto
                    conteudoBase64 = await this.extrairViaDownloadLink(conteudoEncontrado.href);
                    break;
                    
                case 'download-button':
                    // Tentar clicar no botão de download
                    conteudoBase64 = await this.extrairViaDownloadButton();
                    break;
                    
                case 'iframe':
                    // Tentar extrair do iframe
                    conteudoBase64 = await this.extrairViaIframe(conteudoEncontrado.src);
                    break;
                    
                default:
                    console.log(`        ⚠️ Tipo de conteúdo não suportado: ${conteudoEncontrado.tipo}`);
                    return null;
            }
            
            if (conteudoBase64) {
                return conteudoBase64;
            } else {
                console.log(`        ⚠️ Não foi possível extrair o conteúdo base64`);
                return null;
            }
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 📄 Extrai conteúdo de um PDF viewer
     */
    async extrairPDFViewer() {
        try {
            // Tentar obter o conteúdo do PDF viewer
            const pdfContent = await this.page.evaluate(() => {
                const pdfViewer = document.querySelector('embed[type="application/pdf"]') ||
                                document.querySelector('object[type="application/pdf"]');
                
                if (pdfViewer && pdfViewer.src) {
                    return pdfViewer.src;
                }
                
                return null;
            });
            
            if (pdfContent) {
                // Tentar baixar o PDF e converter para base64
                try {
                    const response = await this.page.goto(pdfContent, { waitUntil: 'networkidle0' });
                    const buffer = await response.buffer();
                    const base64 = buffer.toString('base64');
                    
                    return base64;
                } catch (e) {
                    return null;
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 📄 Extrai conteúdo via link de download direto
     */
    async extrairViaDownloadLink(href) {
        try {
            // Navegar para o link de download
            const response = await this.page.goto(href, { waitUntil: 'networkidle0' });
            const buffer = await response.buffer();
            const base64 = buffer.toString('base64');
            
            return base64;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 📄 Extrai conteúdo via botão de download
     */
    async extrairViaDownloadButton() {
        try {
            // Encontrar e clicar no botão de download
            const downloadButton = await this.page.$('button[onclick*="download"], button[onclick*="baixar"], button[onclick*="export"]');
            
            if (downloadButton) {
                await downloadButton.click();
                
                // Aguardar o download começar
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Tentar interceptar o download
                const downloadPromise = new Promise((resolve) => {
                    this.page.on('response', async (response) => {
                        if (response.url().includes('.pdf') || response.url().includes('.doc') || response.url().includes('.xls')) {
                            try {
                                const buffer = await response.buffer();
                                const base64 = buffer.toString('base64');
                                resolve(base64);
                            } catch (e) {
                                resolve(null);
                            }
                        }
                    });
                });
                
                // Aguardar o download com timeout
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
                const resultado = await Promise.race([downloadPromise, timeoutPromise]);
                
                if (resultado) {
                    return resultado;
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 📄 Extrai conteúdo via iframe
     */
    async extrairViaIframe(src) {
        try {
            // Navegar para o conteúdo do iframe
            const response = await this.page.goto(src, { waitUntil: 'networkidle0' });
            const buffer = await response.buffer();
            const base64 = buffer.toString('base64');
            
            return base64;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * ⏳ Aguarda um elemento específico carregar na página
     */
    // 🚀 OTIMIZAÇÃO: Timeout ultra-rápido para velocidade máxima
    // 🚀 OTIMIZAÇÃO: Reduzir timeout padrão de 3000ms para 1500ms
    async aguardarElementoCarregar(texto, timeoutMaximo = 1500) {
        try {
            const inicio = Date.now();
            while (Date.now() - inicio < timeoutMaximo) {
                const elementoExiste = await this.page.evaluate((textoBusca) => {
                    // 🎯 MELHORIA: Buscar elementos de forma mais inteligente
                    const seletoresSidebar = [
                        'dms-sidebar-item',
                        'dms-sidebar-folder', 
                        'dms-sidebar-file',
                        'dms-sidebar-link',
                        'li',
                        'a',
                        'button',
                        'span',
                        'div'
                    ];
                    
                    // Primeiro, tentar seletores específicos da sidebar
                    for (const seletor of seletoresSidebar) {
                        const elementos = document.querySelectorAll(seletor);
                        for (const el of elementos) {
                            const textoEl = el.textContent || el.innerText || el.title || '';
                            if (textoEl.toLowerCase().includes(textoBusca.toLowerCase())) {
                                const temDimensoes = el.offsetWidth > 0 && el.offsetHeight > 0;
                                const naoOculto = window.getComputedStyle(el).display !== 'none' && 
                                                window.getComputedStyle(el).visibility !== 'hidden';
                                
                                if (temDimensoes && naoOculto) {
                                    return true;
                                }
                            }
                        }
                    }
                    
                    // Se não encontrou com seletores específicos, buscar em todos os elementos
                    const todosElementos = Array.from(document.querySelectorAll('*'));
                    const elementosComTexto = todosElementos.filter(el => {
                        const textoEl = el.textContent || el.innerText || el.title || '';
                        const temTexto = textoEl.toLowerCase().includes(textoBusca.toLowerCase());
                        const temDimensoes = el.offsetWidth > 0 && el.offsetHeight > 0;
                        const naoOculto = window.getComputedStyle(el).display !== 'none' && 
                                        window.getComputedStyle(el).visibility !== 'hidden';
                        
                        return temTexto && temDimensoes && naoOculto;
                    });
                    
                    return elementosComTexto.length > 0;
                }, texto);
                if (elementoExiste) {
                    return true;
                }
                // 🚀 OTIMIZAÇÃO: Reduzir intervalo entre tentativas para velocidade
                await new Promise(resolve => setTimeout(resolve, 100));
                console.log(`        ⏳ Aguardando... (${Math.round((Date.now() - inicio)/1000)}s)`);
            }
            console.log(`        ❌ Timeout: Elemento "${texto}" não carregou em ${timeoutMaximo/1000}s`);
            return false;
        } catch (error) {
            console.log(`        ⚠️ Erro ao aguardar elemento:`, error.message);
            return false;
        }
    }

    /**
     * 🎯 Verifica se o arquivo clicado corresponde à competência esperada
     */
    async verificarSeArquivoCorrespondeCompetencia(competencia) {
        try {
            // Extrair mês e ano da competência (formato: "MM/AAAA" ou "M/AAAA")
            const [mes, ano] = competencia.split('/');
            if (!mes || !ano) {
                console.log(`        ⚠️ Formato de competência inválido: ${competencia}`);
                return null;
            }
            
            console.log(`        📅 Verificando arquivo com mês: ${mes}, ano: ${ano}`);
            
            // Verificar se o arquivo atual contém a competência esperada
            const arquivoAtual = await this.page.evaluate((mes, ano) => {
                // Buscar por elementos que podem ser o arquivo atual
                const elementos = document.querySelectorAll('*');
                let arquivoEncontrado = null;
                
                for (const el of elementos) {
                    const texto = el.textContent || el.innerText || '';
                    const tagName = el.tagName.toLowerCase();
                    const className = el.className || '';
                    
                    // Verificar se o texto contém indicadores de mês/ano
                    const temMes = texto.toLowerCase().includes(mes.toLowerCase()) ||
                                  texto.toLowerCase().includes(String(parseInt(mes)).toLowerCase());
                    const temAno = texto.includes(ano);
                    
                    // Verificar se parece ser um arquivo
                    const pareceArquivo = 
                        tagName === 'a' || tagName === 'button' ||
                        className.includes('file') || className.includes('document') ||
                        className.includes('pdf') || className.includes('download') ||
                        className.includes('clickable') ||
                        el.getAttribute('role') === 'link' || el.getAttribute('role') === 'button' ||
                        el.getAttribute('tabindex') !== null ||
                        el.onclick !== null;
                    
                    // Verificar se contém extensão de arquivo
                    const temExtensao = texto.includes('.pdf') || texto.includes('.doc') || 
                                       texto.includes('.xls') || texto.includes('.xml');
                    
                    if (temMes && temAno && (pareceArquivo || temExtensao)) {
                        arquivoEncontrado = {
                            elemento: el,
                            tagName,
                            className,
                            texto: texto.substring(0, 100),
                            href: el.getAttribute('href'),
                            role: el.getAttribute('role'),
                            tabIndex: el.getAttribute('tabindex')
                        };
                        break; // Encontrou o primeiro arquivo que corresponde
                    }
                }
                
                return arquivoEncontrado;
            }, mes, ano);
            
            if (arquivoAtual) {
                return {
                    nome: arquivoAtual.texto,
                    tipo: arquivoAtual.tagName,
                    href: arquivoAtual.href
                };
            } else {
                console.log(`        ⚠️ Nenhum arquivo correspondente encontrado para competência: ${competencia}`);
                return null;
            }
            
        } catch (error) {
            return null;
        }
    }

    /**
     * 🎯 NOVA FUNÇÃO: Faz match automático e conclui atividade automaticamente
     */
    async fazerMatchEAutomatizarAtividade(arquivoEncontrado, obrigacaoClienteId, empresaId, atividadeIdEspecifica = null) {
        try {
            console.log(`🎯 INICIANDO MATCH AUTOMÁTICO!`);
            console.log(`🎯 Obrigação Cliente ID: ${obrigacaoClienteId}`);
            console.log(`🎯 Empresa ID: ${empresaId}`);
            console.log(`🎯 Arquivo encontrado: ${arquivoEncontrado.nome || arquivoEncontrado.titulo}`);
            console.log(`🎯 Iniciando match automático para obrigação ${obrigacaoClienteId}...`);
            
            // 1. Buscar a atividade correspondente no banco de dados
            let query = `
                SELECT 
                    oac.id AS atividadeId,
                    oac.texto AS atividadeTexto,
                    oac.tipo AS atividadeTipo,
                    oac.obrigacao_cliente_id AS obrigacaoClienteId,
                    oc.cliente_id AS clienteId,
                    c.razao_social AS clienteNome,
                    c.cpf_cnpj AS clienteCnpj,
                    ao.titulo_documento AS tituloDocumento,
                    oc.ano_referencia,
                    oc.mes_referencia
                FROM obrigacoes_atividades_clientes oac
                JOIN obrigacoes_clientes oc ON oac.obrigacao_cliente_id = oc.id
                JOIN obrigacoes o ON oc.obrigacao_id = o.id
                JOIN clientes c ON oc.cliente_id = c.id
                LEFT JOIN atividades_obrigacao ao ON o.id = ao.obrigacao_id AND oac.tipo = ao.tipo
                WHERE oac.obrigacao_cliente_id = ? 
                AND c.empresa_id = ?
                AND oac.tipo = 'Integração: Onvio'
                AND oac.concluida = 0
                AND oac.cancelada = 0`;
            
            let params = [obrigacaoClienteId, empresaId];
            
            // Se temos um ID específico da atividade, filtrar por ele
            if (atividadeIdEspecifica) {
                query += ` AND oac.id = ?`;
                params.push(atividadeIdEspecifica);
                console.log(`🎯 Filtrando por atividade específica ID: ${atividadeIdEspecifica}`);
            }
            
            query += ` ORDER BY oac.ordem LIMIT 1`;
            
            const [atividades] = await db.query(query, params);
            
            if (atividades.length === 0) {
                console.log(`⚠️ Nenhuma atividade 'Integração: Onvio' encontrada para obrigação ${obrigacaoClienteId} (já foi concluída?)`);
                return { sucesso: false, erro: 'Nenhuma atividade de integração encontrada - atividade já foi concluída' };
            }
            
            const atividade = atividades[0];
            
            // 2. Verificar se o arquivo encontrado corresponde à atividade
            const arquivoCorresponde = this.verificarCorrespondenciaArquivoAtividade(
                arquivoEncontrado, 
                atividade
            );
            
            if (!arquivoCorresponde) {
                console.log(`⚠️ Arquivo não corresponde à atividade esperada`);
                return { sucesso: false, erro: 'Arquivo não corresponde à atividade' };
            }
            
            console.log(`✅ Arquivo corresponde à atividade! Fazendo match...`);
            
            // 3. Garantir que estamos no documento (URL com /document/) antes de extrair info e inserir comentário
            if (!/\/document\//i.test(this.page.url())) {
                // Tentar abrir novamente por nome com duplo clique agressivo
                try {
                    for (let i = 0; i < 6; i++) {
                        try {
                            await this.page.evaluate((nome) => {
                                const candidatos = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], div, span'));
                                const alvo = candidatos.find(el => (el.textContent || '').toLowerCase().includes((nome || '').toLowerCase()));
                                if (!alvo) return;
                                try { alvo.scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
                                const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window}));
                                try { fire(alvo, 'pointerdown'); fire(alvo, 'mousedown'); fire(alvo, 'pointerup'); fire(alvo, 'mouseup'); } catch(_) {}
                                try { fire(alvo, 'pointerdown'); fire(alvo, 'mousedown'); fire(alvo, 'pointerup'); fire(alvo, 'mouseup'); } catch(_) {}
                                try { if (typeof alvo.click === 'function') { alvo.click(); alvo.click(); } else { alvo.dispatchEvent(new Event('click', { bubbles: true })); alvo.dispatchEvent(new Event('click', { bubbles: true })); } } catch(_) {}
                            }, documento.titulo || documento.nome);
                        } catch (_) {}
                        try { await new Promise(r => setTimeout(r, 500)); } catch(_) {}
                        if (/\/document\//i.test(this.page.url())) break;
                    }
                } catch (_) {}
            }

            // 3. Extrair informações do documento e inserir comentário
            // 🎯 PRIORIDADE: Extrair informações do documento atual
            const infoArquivo = await this.extrairInfoArquivo();
            const linkDocumento = infoArquivo?.urlAtual || infoArquivo?.linkDocumento || arquivoEncontrado.urlAtual || arquivoEncontrado.linkDocumento || arquivoEncontrado.href;
            const dataHora = new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Inserir comentário detalhado com link do documento
            const comentario = `Documento encontrado automaticamente via integração Onvio: ${arquivoEncontrado.nome || arquivoEncontrado.titulo}\n\nLink: ${linkDocumento}\n\nData da busca: ${dataHora}`;
            
            await db.query(`
                INSERT INTO comentarios_obrigacao (obrigacao_id, usuario_id, comentario, tipo, criado_em)
                VALUES (?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '-06:00'))
            `, [obrigacaoClienteId, this.usuarioId, comentario, 'usuario']);
            
            console.log(`💾 Comentário salvo no banco com link do documento: ${linkDocumento}`);
            
            // 4. Marcar atividade como concluída
            await db.query(`
                UPDATE obrigacoes_atividades_clientes 
                SET concluida = 1, data_conclusao = CONVERT_TZ(NOW(), '+00:00', '-06:00'), concluido_por = ?
                WHERE id = ?
            `, [this.usuarioId, atividade.atividadeId]);
            
            // 5. Verificar se todas as atividades da obrigação estão concluídas
            const [todasAtividades] = await db.query(`
                SELECT COUNT(*) as total, SUM(CASE WHEN concluida = 1 THEN 1 ELSE 0 END) as concluidas
                FROM obrigacoes_atividades_clientes 
                WHERE obrigacao_cliente_id = ?
            `, [obrigacaoClienteId]);
            
            if (todasAtividades[0].total === todasAtividades[0].concluidas) {
                // Opcional: Marcar obrigação como concluída também
                await db.query(`
                    UPDATE obrigacoes_clientes 
                    SET status = 'concluida', dataConclusao = CONVERT_TZ(NOW(), '+00:00', '-03:00'
                    WHERE id = ?
                `, [obrigacaoClienteId]);
            }
            
            return { 
                sucesso: true, 
                mensagem: 'Match realizado e atividade concluída com sucesso',
                atividadeId: atividade.atividadeId,
                clienteNome: atividade.clienteNome,
                arquivoNome: arquivoEncontrado.nome || arquivoEncontrado.titulo
            };
            
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * 🔍 Verifica se o arquivo encontrado corresponde à atividade esperada
     * Replica a lógica da rota /baixar-atividades: match por nome OU competência
     */
    verificarCorrespondenciaArquivoAtividade(arquivoEncontrado, atividade) {
        try {
            console.log(`🔍 Verificando correspondência entre arquivo e atividade:`);
            console.log(`   📄 Arquivo: ${arquivoEncontrado.nome || arquivoEncontrado.titulo}`);
            console.log(`   📋 Atividade: ${atividade.atividadeTexto}`);
            
            // Extrai o título do documento da atividade
            let tituloDocumento = '';
            if (atividade.tituloDocumento) {
                tituloDocumento = atividade.tituloDocumento;
            } else if (atividade.titulo_documento) {
                tituloDocumento = atividade.titulo_documento;
            } else {
                // Extrair da atividadeTexto (última parte do caminho)
                const partes = atividade.atividadeTexto.split('/');
                tituloDocumento = partes[partes.length - 1] || atividade.atividadeTexto;
            }
            
            console.log(`   📝 Título do documento extraído: ${tituloDocumento}`);
            
            // Replicar a lógica da rota /baixar-atividades
            const nomeDoc = (arquivoEncontrado.nome || arquivoEncontrado.titulo || '').toLowerCase();
            const tituloEsperado = (tituloDocumento || '').toLowerCase();
            
            // Match por nome
            let matchNome = false;
            if (tituloEsperado && nomeDoc.includes(tituloEsperado)) {
                matchNome = true;
                console.log(`   ✅ Match por nome: "${tituloEsperado}" encontrado em "${nomeDoc}"`);
            }
            
            // Match por competência (se disponível na atividade)
            let matchCompetencia = false;
            if (atividade.ano_referencia && atividade.mes_referencia) {
                const competencia = `${String(atividade.mes_referencia).padStart(2, '0')}/${atividade.ano_referencia}`;
                console.log(`   📅 Competência da atividade: ${competencia}`);
                
                // Verificar diferentes formatos de competência no nome do arquivo
                if (competencia && nomeDoc.includes(competencia.replace('/', ''))) {
                    matchCompetencia = true;
                } else if (competencia && nomeDoc.includes(competencia.replace('/', '-'))) {
                    matchCompetencia = true;
                } else if (competencia && nomeDoc.includes(competencia.replace('/', '.'))) {
                    matchCompetencia = true;
                } else if (competencia && nomeDoc.includes(competencia.replace('/', '_'))) {
                    matchCompetencia = true;
                } else if (competencia && nomeDoc.includes(competencia)) {
                    matchCompetencia = true;
                }
                
                if (matchCompetencia) {
                    console.log(`   ✅ Match por competência: "${competencia}" encontrado em "${nomeDoc}"`);
                } else {
                    console.log(`   ❌ Competência "${competencia}" não encontrada em "${nomeDoc}"`);
                    console.log(`   🔍 Formatos verificados: ${competencia.replace('/', '')}, ${competencia.replace('/', '-')}, ${competencia.replace('/', '.')}, ${competencia.replace('/', '_')}, ${competencia}`);
                }
            } else {
                console.log(`   ⚠️ Competência não disponível na atividade`);
            }
            
            // Retorna true se houver match por nome OU competência
            const resultado = matchNome || matchCompetencia;
            console.log(`   🎯 Resultado final: ${resultado ? 'MATCH' : 'NÃO MATCH'} (nome: ${matchNome}, competência: ${matchCompetencia})`);
            
            return resultado;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * ⏳ Aguarda elementos de loading desaparecerem
     */
    async aguardarElementosLoading() {
        try {
            const seletoresLoading = [
                '.loading', '.spinner', '.loader', '.carregando',
                '[data-loading="true"]', '.is-loading', '.loading-spinner',
                '.progress-bar', '.loading-indicator', '.wait-spinner'
            ];
            
            for (const seletor of seletoresLoading) {
                try {
                    await this.page.waitForFunction(
                        (sel) => !document.querySelector(sel),
                        { timeout: 5000 },
                        seletor
                    );
                } catch (e) {
                    // Elemento não existe ou já desapareceu, continuar
                }
            }
        } catch (e) {
            console.log('⚠️ Erro ao aguardar elementos de loading, continuando...');
        }
    }

    /**
     * 📜 Tenta rolar a página para carregar mais conteúdo (lazy loading)
     */
    async tentarRolarPagina() {
        try {
            await this.page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
                window.scrollTo(0, 0);
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
        }
    }

    /**
     * 🖱️ Aguarda documento estar clicável
     */
    async aguardarDocumentoClicavel(documento, maxTentativas = 5) {
        try {
            console.log(`🖱️ Aguardando documento estar clicável: ${documento.titulo || documento.nome}`);
            
            for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
                try {
                    // Verificar se o elemento está visível e clicável
                    const estaVisivel = await this.page.evaluate((el) => {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        return rect.width > 0 && rect.height > 0 && 
                               style.visibility !== 'hidden' && 
                               style.display !== 'none' &&
                               !el.disabled;
                    }, documento.elemento);
                    
                    if (estaVisivel) {
                        return true;
                    }
                    
                    console.log(`⏳ Documento não está visível na tentativa ${tentativa}, aguardando...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (e) {
                    console.log(`⚠️ Erro ao verificar visibilidade na tentativa ${tentativa}:`, e.message);
                }
            }
            
            console.log(`⚠️ Documento não ficou clicável após ${maxTentativas} tentativas`);
            return false;
            
        } catch (error) {
            console.error('❌ Erro ao aguardar documento clicável:', error);
            return false;
        }
    }

    /**
     * 📄 Aguarda carregamento do documento após clicar
     * Agora aceita nomeDocumento para garantir que é o documento certo
     */
    async aguardarCarregamentoDocumento(maxTentativas = 1, nomeDocumento = null) {
        try {
            console.log('📄 Aguardando carregamento do documento (apenas 1 tentativa)...');
            // Aguarda só uma vez, ultra-rápido
            if (nomeDocumento) {
                const seletorHeader = `bmcfv-header[document-name="${nomeDocumento}"]`;
                const seletorViewer = `bm-core-file-viewer[document-name="${nomeDocumento}"]`;
                const header = await this.page.$(seletorHeader);
                const viewer = await this.page.$(seletorViewer);
                if (header || viewer) return true;
            }
            // Aguarda elementos específicos do documento aparecerem (apenas uma vez)
            const seletoresDocumento = [
                '.document-viewer', '.pdf-viewer', '.file-viewer',
                '.document-content', '.file-content', '.viewer-container',
                'iframe[src*="pdf"]', 'embed[type="application/pdf"]',
                'dms-viewer' // NOVO: elemento específico do Onvio
            ];
            for (const seletor of seletoresDocumento) {
                try {
                    const el = await this.page.$(seletor);
                    if (el) {
                        if (seletor === 'dms-viewer') {
                            console.log('✅ dms-viewer encontrado! Documento carregado com sucesso.');
                        }
                        return true;
                    }
                } catch (e) {}
            }
            // Não seguir se não carregou: manter controle para novas tentativas de clique
            console.log('⚠️ Documento não carregou. Não seguir; requer novos cliques.');
            return false;
        } catch (error) {
            console.error('❌ Erro ao aguardar documento carregar:', error);
            return false;
        }
    }

    /**
     * 🔄 Retry inteligente para encontrar documentos sem recomeçar navegação
     */
    async retryInteligenteMesmoLocal(competencia, maxTentativas = 3) {
        try {
            console.log(`🔄 Iniciando retry inteligente no mesmo local para competência: ${competencia}`);
            
            for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
                console.log(`🔄 Retry ${tentativa}/${maxTentativas} no mesmo local...`);
                
                // 🚀 OTIMIZAÇÃO: Aguardo ultra-rápido para velocidade máxima
                const tempoEspera = 500 * tentativa;
                console.log(`⏳ Aguardando ${tempoEspera}ms...`);
                await new Promise(resolve => setTimeout(resolve, tempoEspera));
                
                // Tentar rolar a página para carregar mais conteúdo
                await this.tentarRolarPagina();
                
                // Aguardar elementos de loading desaparecerem
                await this.aguardarElementosLoading();
                
                // Tentar extrair documentos novamente
                // 🚀 OTIMIZAÇÃO: Extração ultra-rápida para velocidade máxima
                const documentos = await this.extrairDocumentos(2, 800);
                
                if (documentos.length > 0) {
                    console.log(`✅ Encontrados ${documentos.length} documentos no retry ${tentativa}`);
                    
                    // Filtrar por competência
                    const documentosFiltrados = this.filtrarDocumentosPorCompetencia(documentos, competencia);
                    
                    if (documentosFiltrados.length > 0) {
                        return { sucesso: true, documentos: documentosFiltrados };
                    } else {
                        console.log(`⚠️ Retry ${tentativa}: documentos encontrados mas nenhum para competência ${competencia}`);
                    }
                } else {
                    console.log(`⚠️ Retry ${tentativa}: nenhum documento encontrado`);
                }
                
                // Se for a última tentativa, tentar recarregar a página
                if (tentativa === maxTentativas - 1) {
                    console.log(`🔄 Última tentativa: recarregando página...`);
                    try {
                        // 🚀 OTIMIZAÇÃO: Recarregamento ultra-rápido para velocidade máxima
                        await this.page.reload({ waitUntil: 'domcontentloaded' });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (e) {
                        console.log('⚠️ Erro ao recarregar página, continuando...');
                    }
                }
            }
            
            console.log(`❌ Retry inteligente falhou após ${maxTentativas} tentativas`);
            return { sucesso: false, documentos: [] };
            
        } catch (error) {
            return { sucesso: false, documentos: [] };
        }
    }

    /**
     * 🆕 NOVO MÉTODO: Faz overview dos arquivos na pasta atual e encontra o correto por competência
     * Este método é chamado ANTES de clicar na última parte (pasta de documentos)
     * Ele faz um overview de todos os arquivos visíveis, identifica o correto por competência,
     * e só então clica no arquivo selecionado para processamento
     * 
     * 🚀 NOVA FUNCIONALIDADE: Retry inteligente que não recomeça a navegação
     */
    async fazerOverviewArquivosPorCompetencia(competencia, obrigacaoClienteId, empresaId, maxTentativas = 2, atividadeIdEspecifica = null) { // ✅ OTIMIZAÇÃO: 2 tentativas máximo - se não encontrar, pular para próxima
        try {
            console.log(`🔍 OVERVIEW DOS ARQUIVOS: Analisando arquivos na pasta atual para competência ${competencia}`);
            
            let tentativa = 1;
            let documentos = [];
            let documentosFiltrados = [];
            
            // Loop de tentativas para garantir que os documentos apareçam E sejam filtrados corretamente
            while (tentativa <= maxTentativas) {
                console.log(`🔄 Tentativa ${tentativa}/${maxTentativas} de fazer overview dos arquivos...`);


                
                
                // 1. Aguardar carregamento inicial da página
                // 🚀 OTIMIZAÇÃO: Reduzir tempo de espera de 500ms para 200ms
                console.log('⏳ Aguardando carregamento inicial da página...');
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // 2. Verificar se a página está estável
                try {
                    await this.page.waitForFunction(
                        () => document.readyState === 'complete',
                        { timeout: 3000 } // 🚀 OTIMIZAÇÃO ULTRA-AGGRESSIVA: Reduzido para 3000ms para velocidade máxima
                    );
                } catch (e) {
                    console.log('⚠️ Timeout aguardando readyState, continuando...');
                }
                
                // 3. Aguardar elementos de carregamento desaparecerem
                await this.aguardarElementosLoading();
                
                // 4. Tentar extrair documentos com retry
                console.log(`📄 Fazendo OVERVIEW de todos os arquivos visíveis na pasta (tentativa ${tentativa})...`);
                // 🚀 OTIMIZAÇÃO: Reduzir tentativas de 3 para 2 e delay de 2000ms para 500ms
                documentos = await this.extrairDocumentos(2, 500);
                
                if (documentos.length === 0) {
                    console.log(`⏳ Nenhum arquivo encontrado na tentativa ${tentativa}, aguardando mais tempo...`);
                    
                    // 🚀 OTIMIZAÇÃO: Reduzir tempos de espera progressivos para velocidade
                    // 🚀 OTIMIZAÇÃO: Aguardo ultra-rápido para velocidade máxima
                const tempoEspera = 500 * tentativa;
                    console.log(`⏳ Aguardando ${tempoEspera}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, tempoEspera));
                    
                    // Tentar rolar a página para carregar mais conteúdo
                    await this.tentarRolarPagina();
                    
                    tentativa++;
                    continue;
                }
                
                console.log(`✅ OVERVIEW: Encontrados ${documentos.length} arquivos na pasta (tentativa ${tentativa})`);
                
                // 5. Filtrar documentos por competência
            console.log(`🔍 Filtrando arquivos por competência: ${competencia}`);
                documentosFiltrados = this.filtrarDocumentosPorCompetencia(documentos, competencia);
            
            if (documentosFiltrados.length === 0) {
                    console.log(`⚠️ Nenhum arquivo encontrado para competência: ${competencia} na tentativa ${tentativa}`);
                    
                    // ✅ OTIMIZAÇÃO: Se não encontrou após 2 tentativas, considerar como não encontrado e pular
                    // Não fazer retry inteligente nem recarregamento de página
                    if (tentativa < maxTentativas) {
                        console.log(`🔄 Tentando novamente com mais tempo de espera...`);
                        
                        // 🚀 OTIMIZAÇÃO: Reduzir tempos de espera progressivos para velocidade
                        const tempoEspera = 2000 * tentativa;
                        console.log(`⏳ Aguardando ${tempoEspera}ms antes da próxima tentativa...`);
                        await new Promise(resolve => setTimeout(resolve, tempoEspera));
                        
                        // Tentar rolar a página para carregar mais conteúdo
                        await this.tentarRolarPagina();
                        
                        tentativa++;
                        continue;
                    } else {
                        // ✅ Após segunda tentativa, considerar como não encontrado e retornar erro
                        // SEM retry inteligente, SEM recarregamento de página
                        console.log(`❌ Nenhum arquivo encontrado para competência ${competencia} após ${maxTentativas} tentativas. Pulando para próxima atividade.`);
                        return { sucesso: false, erro: `Nenhum arquivo encontrado para competência ${competencia} após ${maxTentativas} tentativas` };
                    }
                }
                
                // Se chegou aqui, encontrou documentos filtrados
                console.log(`✅ OVERVIEW: Encontrados ${documentosFiltrados.length} arquivos para competência ${competencia} na tentativa ${tentativa}`);
                break;
            }
            
            if (!documentosFiltrados || documentosFiltrados.length === 0) {
                console.log(`❌ Nenhum arquivo encontrado para competência: ${competencia} após ${maxTentativas} tentativas`);
                return { sucesso: false, erro: `Nenhum arquivo encontrado para competência ${competencia} após múltiplas tentativas` };
            }
            
            console.log(`✅ OVERVIEW: Encontrados ${documentosFiltrados.length} arquivos para competência ${competencia}`);
            
            // 6. Mostrar todos os arquivos encontrados para debug
            documentosFiltrados.forEach((doc, index) => {
                console.log(`📄 Arquivo ${index + 1}: ${doc.nome} (${doc.tipo})`);
            });
            
            // 7. Pegar o primeiro documento que corresponde à competência
            const documento = documentosFiltrados[0];
            console.log(`🎯 Arquivo selecionado para processamento: ${documento.titulo || documento.nome}`);
            
            try {
                // 8. Aguardar documento estar clicável
                await this.aguardarDocumentoClicavel(documento);
                
                // 9. Abrir o documento: PRIORIZAR elemento armazenado (mais confiável) e depois buscar link se necessário
                console.log(`🔍 Tentando clicar no documento usando elemento armazenado: ${documento.titulo || documento.nome}`);
                
                // 🎯 PRIORIDADE 1: Usar o elemento já armazenado e validado (mais confiável)
                let clicouComSucesso = false;
                if (documento.elemento) {
                    try {
                        // Tentar encontrar link dentro do elemento armazenado
                        const linkNoElemento = await documento.elemento.$('a[href*="/document/"]');
                        if (linkNoElemento) {
                            console.log(`✅ Link encontrado dentro do elemento armazenado, clicando...`);
                            await linkNoElemento.click();
                            await new Promise(r => setTimeout(r, 400));
                            clicouComSucesso = true;
                        } else {
                            // Se não tem link, clicar diretamente no elemento
                            console.log(`✅ Clicando diretamente no elemento armazenado...`);
                            await documento.elemento.click({ clickCount: 2, delay: 20 });
                            await new Promise(r => setTimeout(r, 400));
                            clicouComSucesso = true;
                        }
                    } catch (erroElemento) {
                        console.log(`⚠️ Erro ao clicar no elemento armazenado: ${erroElemento.message}`);
                        // Continuar para tentativa com busca mais precisa
                    }
                }
                
                // 🎯 PRIORIDADE 2: Se não clicou com elemento armazenado, buscar de forma mais precisa validando competência
                if (!clicouComSucesso) {
                    try {
                        const tituloBusca = (documento.titulo || documento.nome).toLowerCase().trim();
                        console.log(`🔍 Buscando elemento na página com título: ${tituloBusca} e competência: ${competencia}`);
                        
                        // Extrair mês e ano da competência para validação
                        let mes, ano;
                        if (competencia.includes('/')) {
                            const [mesStr, anoStr] = competencia.split('/');
                            mes = parseInt(mesStr);
                            ano = parseInt(anoStr);
                        } else {
                            if (competencia.length === 6) {
                                mes = parseInt(competencia.substring(0, 2));
                                ano = parseInt(competencia.substring(2, 6));
                            } else if (competencia.length === 5) {
                                mes = parseInt(competencia.substring(0, 1));
                                ano = parseInt(competencia.substring(1, 5));
                            }
                        }
                        
                        const handle = await this.page.evaluateHandle((tituloParaBuscar, mesParaValidar, anoParaValidar) => {
                            // Buscar todas as linhas possíveis
                            const linhas = Array.from(document.querySelectorAll('tr, .wj-row, .grid-row, div'));
                            
                            // Função para validar competência no texto
                            const validarCompetencia = (texto) => {
                                const mesComPadding = mesParaValidar.toString().padStart(2, '0');
                                const mesSemPadding = mesParaValidar.toString();
                                const anoStr = anoParaValidar.toString();
                                
                                // Verificar formatos: mm/yyyy, mmyyyy, mm.yyyy, mm_yyyy, etc.
                                const formatos = [
                                    mesComPadding + '/' + anoStr,
                                    mesSemPadding + '/' + anoStr,
                                    mesComPadding + anoStr,
                                    mesSemPadding + anoStr,
                                    mesComPadding + '.' + anoStr,
                                    mesSemPadding + '.' + anoStr,
                                    mesComPadding + '_' + anoStr,
                                    mesSemPadding + '_' + anoStr
                                ];
                                
                                return formatos.some(formato => texto.includes(formato));
                            };
                            
                            // Tentar encontrar linha que contenha o título E a competência correta
                            const linhaExata = linhas.find(el => {
                                const texto = (el.textContent || '').toLowerCase().trim();
                                
                                // Primeiro verificar se contém o título
                                const temTitulo = texto.includes(tituloParaBuscar) || 
                                                 texto === tituloParaBuscar ||
                                                 texto.replace(/\s+/g, ' ').includes(tituloParaBuscar.replace(/\s+/g, ' '));
                                
                                if (!temTitulo) return false;
                                
                                // Se tem título, validar também a competência
                                return validarCompetencia(texto);
                            });
                            
                            if (linhaExata) {
                                console.log('✅ Linha encontrada com título e competência corretos');
                                // Tentar encontrar link dentro da linha
                                const link = linhaExata.querySelector('a[href*="/document/"]');
                                if (link) return link;
                                // Se não tem link, retornar a própria linha
                                return linhaExata;
                            }
                            
                            return null;
                        }, tituloBusca, mes, ano);
                        
                        if (handle && handle.asElement) {
                            console.log(`✅ Elemento encontrado na busca com validação de competência, clicando...`);
                            try { 
                                await handle.asElement().click(); 
                                await new Promise(r => setTimeout(r, 400));
                                clicouComSucesso = true;
                            } catch(erroClick) {
                                console.log(`⚠️ Erro ao clicar no elemento encontrado: ${erroClick.message}`);
                            }
                        } else {
                            console.log(`⚠️ Nenhum elemento encontrado na busca com validação de competência`);
                        }
                    } catch(erroBusca) {
                        console.log(`⚠️ Erro ao buscar elemento na página: ${erroBusca.message}`);
                    }
                }
                
                // 🎯 PRIORIDADE 3: Retry com duplo clique no elemento armazenado (fallback)
                for (let i = 0; i < 8 && !clicouComSucesso; i++) {
                    if (/\/document\//i.test(this.page.url())) {
                        clicouComSucesso = true;
                        break;
                    }
                    if (documento.elemento) {
                        try { 
                            await documento.elemento.click({ clickCount: 2, delay: 20 }); 
                            await new Promise(r => setTimeout(r, 500));
                        } catch (_) {}
                    }
                }
                
                // 10. Validar abertura: se ainda não abriu, abortar sem automação
                const urlAposClique = this.page.url();
                const carregouViewer = await this.aguardarCarregamentoDocumento();
                if (!/\/document\//i.test(urlAposClique) && !carregouViewer) {
                    console.log('⚠️ Documento não abriu (sem /document/). Abortando sem acionar automação.');
                    return {
                        sucesso: false,
                        erro: 'Documento não abriu (sem /document/)',
                        totalDocumentos: documentosFiltrados.length
                    };
                }
                
                // 11. Extrair informações do documento
                const infoArquivo = await this.extrairInfoArquivo();
                
                const arquivoEncontrado = {
                    nome: documento.titulo || documento.nome,
                    tipo: documento.tipo || 'documento',
                    href: documento.href,
                    competencia: competencia,
                    linkDocumento: infoArquivo.linkDocumento,
                    urlAtual: infoArquivo.urlAtual
                };
                
                // 12. Se temos obrigacaoClienteId e empresaId, tentar fazer match automático
                if (obrigacaoClienteId && empresaId) {
                    console.log(`🎯 AUTOMAÇÃO ATIVADA! Tentando match automático...`);
                    
                    try {
                        const resultadoMatch = await this.fazerMatchEAutomatizarAtividade(
                            arquivoEncontrado, 
                            obrigacaoClienteId, 
                            empresaId,
                            atividadeIdEspecifica
                        );
                        
                        if (resultadoMatch.sucesso) {
                            console.log(`✅ MATCH AUTOMÁTICO REALIZADO COM SUCESSO!`);
                            console.log(`✅ Documento: ${arquivoEncontrado.nome}`);
                            console.log(`✅ Competência: ${competencia}`);
                            console.log(`✅ Atividade marcada como concluída`);
                            
                            // ✅ NÃO VOLTAR PARA PASTA ANTERIOR após match automático bem-sucedido
                            // Isso evita que o sistema continue processando outras atividades
                            // O código que chamou esta função deve decidir se continua ou não
                            console.log(`⏹️ Match automático concluído. Retornando sem tentar voltar para pasta anterior.`);
                            
                            return {
                                sucesso: true,
                                arquivo: arquivoEncontrado,
                                mensagem: `Documento encontrado e atividade concluída automaticamente: ${arquivoEncontrado.nome}`,
                                matchImediato: true,
                                atividadeConcluida: true,
                                comentarioInserido: true,
                                competencia: competencia,
                                totalDocumentos: documentosFiltrados.length
                            };
                        } else {
                            console.log(`⚠️ Match falhou para ${arquivoEncontrado.nome}: ${resultadoMatch.erro}`);
                            
                            // 13. VOLTAR PARA A PASTA ANTERIOR mesmo com falha
                            await this.voltarParaPastaAnterior(null, null, this.caminhoSidebarAtual, competencia, obrigacaoClienteId, empresaId);
                            
                            return {
                                sucesso: false,
                                erro: `Match falhou: ${resultadoMatch.erro}`,
                                arquivo: arquivoEncontrado,
                                competencia: competencia
                            };
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao fazer match automático para ${arquivoEncontrado.nome}:`, error);
                        
                        // 13. VOLTAR PARA A PASTA ANTERIOR mesmo com erro
                        await this.voltarParaPastaAnterior(null, null, this.caminhoSidebarAtual, competencia, obrigacaoClienteId, empresaId);
                        
                        return {
                            sucesso: false,
                            erro: `Erro no match: ${error.message}`,
                            arquivo: arquivoEncontrado,
                            competencia: competencia
                        };
                    }
                } else {
                    // Sem automação, retornar o documento encontrado
                    console.log(`✅ Documento encontrado (sem automação): ${arquivoEncontrado.nome}`);
                    
                    // 13. VOLTAR PARA A PASTA ANTERIOR
                    await this.voltarParaPastaAnterior(null, null, this.caminhoSidebarAtual, competencia, obrigacaoClienteId, empresaId);
                    
                    return {
                        sucesso: true,
                        arquivo: arquivoEncontrado,
                        mensagem: `Documento encontrado para competência: ${arquivoEncontrado.nome}`,
                        matchImediato: true,
                        competencia: competencia,
                        totalDocumentos: documentosFiltrados.length
                    };
                }
                
            } catch (error) {
                console.error(`❌ Erro ao processar documento ${documento.titulo || documento.nome}:`, error);
                
                // 13. VOLTAR PARA A PASTA ANTERIOR mesmo com erro
                await this.voltarParaPastaAnterior(null, null, this.caminhoSidebarAtual, competencia, obrigacaoClienteId, empresaId);
                
                return {
                    sucesso: false,
                    erro: `Erro ao processar documento: ${error.message}`,
                    competencia: competencia
                };
            }
            
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * 🔍 Filtra documentos por competência baseado no nome do arquivo
     * Aceita formatos: mm/yyyy e mmyyyy
     */
    filtrarDocumentosPorCompetencia(documentos, competencia) {
        try {
            console.log(`🔍 Filtrando ${documentos.length} documentos por competência: ${competencia}`);
            
            let mes, ano;
            
            // Verificar se é formato mm/yyyy ou mmyyyy
            if (competencia.includes('/')) {
                // Formato: mm/yyyy (ex: "7/2025" -> mês: 7, ano: 2025)
            const [mesStr, anoStr] = competencia.split('/');
                mes = parseInt(mesStr);
                ano = parseInt(anoStr);
            } else {
                // Formato: mmyyyy (ex: "072025" -> mês: 7, ano: 2025)
                if (competencia.length === 6) {
                    const mesStr = competencia.substring(0, 2);
                    const anoStr = competencia.substring(2, 6);
                    mes = parseInt(mesStr);
                    ano = parseInt(anoStr);
                } else if (competencia.length === 5) {
                    // Formato: myyyy (ex: "72025" -> mês: 7, ano: 2025)
                    const mesStr = competencia.substring(0, 1);
                    const anoStr = competencia.substring(1, 5);
                    mes = parseInt(mesStr);
                    ano = parseInt(anoStr);
                } else {
                    console.log(`⚠️ Formato de competência não reconhecido: ${competencia}`);
                    return [];
                }
            }
            
            if (isNaN(mes) || isNaN(ano)) {
                console.log(`⚠️ Competência inválida: ${competencia}`);
                return [];
            }
            
            console.log(`📅 Buscando documentos com mês: ${mes}, ano: ${ano}`);
            console.log(`🔍 Formatos aceitos: ${mes}, ${mes.toString().padStart(2, '0')}, ${ano}`);
            
            const documentosFiltrados = documentos.filter(documento => {
                // Usar a propriedade correta (titulo em vez de nome)
                const nome = (documento.titulo || documento.nome || '').toLowerCase();
                
                if (!nome) {
                    console.log(`⚠️ Documento sem nome/título:`, documento);
                    return false;
                }
                
                console.log(`🔍 Analisando documento: "${documento.titulo || documento.nome}"`);
                
                // Verificar se o nome contém o ano
                if (!nome.includes(ano.toString())) {
                    console.log(`❌ Ano ${ano} não encontrado em: "${documento.titulo || documento.nome}"`);
                    return false;
                }
                
                // Verificar se o nome contém o mês de forma PRECISA
                const mesComPadding = mes.toString().padStart(2, '0');
                const mesSemPadding = mes.toString();
                
                // Verificar formato mmyyyy (ex: 072025) - deve ser EXATO
                const formatoCompleto = mesComPadding + ano.toString();
                const formatoCompletoSemPadding = mesSemPadding + ano.toString();
                
                // Verificar formato mm/yyyy (ex: 04/2025) - deve ser EXATO
                const formatoCompletoComBarra = mesComPadding + '/' + ano.toString();
                const formatoSemPaddingComBarra = mesSemPadding + '/' + ano.toString();
                
                // Verificar formato mm-yyyy (ex: 04-2025)
                const formatoCompletoComHifen = mesComPadding + '-' + ano.toString();
                const formatoSemPaddingComHifen = mesSemPadding + '-' + ano.toString();
                
                // Verificar formato mm.yyyy (ex: 04.2025)
                const formatoCompletoComPonto = mesComPadding + '.' + ano.toString();
                const formatoSemPaddingComPonto = mesSemPadding + '.' + ano.toString();
                
                // Verificar formato mm yyyy (ex: 04 2025)
                const formatoCompletoComEspaco = mesComPadding + ' ' + ano.toString();
                const formatoSemPaddingComEspaco = mesSemPadding + ' ' + ano.toString();
                
                // Verificar formato mm_yyyy (ex: 04_2025) - NOVO!
                const formatoCompletoComUnderscore = mesComPadding + '_' + ano.toString();
                const formatoSemPaddingComUnderscore = mesSemPadding + '_' + ano.toString();
                
                // Verificar se o mês aparece de forma PRECISA (não como parte de outro número)
                const temFormatoExato = nome.includes(formatoCompleto) || 
                                       nome.includes(formatoCompletoSemPadding) ||
                                       nome.includes(formatoCompletoComBarra) ||
                                       nome.includes(formatoSemPaddingComBarra) ||
                                       nome.includes(formatoCompletoComHifen) ||
                                       nome.includes(formatoSemPaddingComHifen) ||
                                       nome.includes(formatoCompletoComPonto) ||
                                       nome.includes(formatoSemPaddingComPonto) ||
                                       nome.includes(formatoCompletoComEspaco) ||
                                       nome.includes(formatoSemPaddingComEspaco) ||
                                       nome.includes(formatoCompletoComUnderscore) ||
                                       nome.includes(formatoSemPaddingComUnderscore);
                
                // Verificar se o mês aparece isoladamente (com regex para evitar falsos positivos)
                const regexMesIsolado = new RegExp(`\\b${mes}\\b|\\b${mesComPadding}\\b`, 'g');
                const temMesIsolado = regexMesIsolado.test(nome);
                
                console.log(`🔍 Verificando mês ${mes} (${mesComPadding}/${mesSemPadding}) em: "${documento.titulo || documento.nome}"`);
                console.log(`🔍 Formatos exatos verificados: ${formatoCompleto}, ${formatoCompletoSemPadding}, ${formatoCompletoComBarra}, ${formatoSemPaddingComBarra}, ${formatoCompletoComUnderscore}, ${formatoSemPaddingComUnderscore}`);
                console.log(`🔍 Mês isolado encontrado: ${temMesIsolado}`);
                
                if (!temFormatoExato && !temMesIsolado) {
                    console.log(`❌ Mês ${mes} não encontrado de forma precisa em: "${documento.titulo || documento.nome}"`);
                    return false;
                }
                
                console.log(`✅ Documento "${documento.titulo || documento.nome}" corresponde à competência ${competencia}`);
                return true;
            });
            
            console.log(`✅ Filtrados ${documentosFiltrados.length} documentos para competência ${competencia}`);
            return documentosFiltrados;
            
        } catch (error) {
            console.error('❌ Erro ao filtrar documentos por competência:', error);
            return [];
        }
    }

    /**
     * ↩️ Volta para a pasta anterior clicando no item da sidebar que foi selecionado anteriormente
     * Este método é chamado após processar um documento para não recomeçar toda a navegação
     */
    async voltarParaPastaAnterior(tituloEsperado = null, nivel = 0, caminhoSidebar = null, competencia = null, obrigacaoClienteId = null, empresaId = null) {
        try {
            console.log(`↩️ Tentando voltar para a pasta anterior...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // ✅ REMOVIDO: goBack() removido completamente - não usar nunca!
            // 🎯 CORREÇÃO: Se temos o caminho da sidebar, usar a EXATA mesma lógica do início
            if (caminhoSidebar) {
                console.log(`🎯 Tentando voltar usando caminho da sidebar: ${caminhoSidebar}`);
                // ✅ SEM goBack - apenas usar sidebar para voltar
            }
            
            // Fallback: tentar usar o último item da sidebar
            let voltouViaSidebar = false;
            if (this.ultimoItemSidebarSelecionado) {
                console.log(`🎯 Tentando clicar de volta no item da sidebar: "${this.ultimoItemSidebarSelecionado}"`);
                console.log(`🎯 URL atual antes de tentar voltar: ${this.page.url()}`);
                // 🎯 CORREÇÃO: Usar a EXATA mesma lógica de busca do início da navegação
                const encontrou = await this.encontrarEClicarParteSidebar(this.ultimoItemSidebarSelecionado, 0);
                if (encontrou) {
                    console.log(`✅ Voltou para a pasta anterior clicando na sidebar: "${this.ultimoItemSidebarSelecionado}"`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    voltouViaSidebar = true;
                } else {
                    console.log(`⏳ Item da sidebar não encontrado, partindo para fallback...`);
                }
            } else {
                console.log(`⚠️ Nenhum item da sidebar armazenado para navegação de volta`);
            }
            
            if (voltouViaSidebar) {
                return true;
            }
            
            // Fallback: tentar reconstruir caminho na sidebar se necessário
            if (caminhoSidebar) {
                console.log(`🔄 Tentando reconstruir caminho na sidebar: ${caminhoSidebar}`);
                const resultadoSidebar = await this.navegarPelaSidebar(caminhoSidebar, competencia, obrigacaoClienteId, empresaId);
                if (resultadoSidebar && resultadoSidebar.sucesso) {
                    console.log('✅ Caminho reconstruído com sucesso!');
                    return true;
                } else {
                    console.log('❌ Falha ao reconstruir caminho na sidebar. Reiniciando navegação do zero...');
                    await this.reiniciarSessao();
                    return false;
                }
            } else {
                console.log('❌ Sem caminhoSidebar fornecido para reconstrução. Reiniciando navegação do zero...');
                await this.reiniciarSessao();
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao voltar para pasta anterior:', error);
            await this.reiniciarSessao();
            return false;
        }
    }

    /**
     * 📋 Consulta histórico de comentários de automação Onvio
     * Retorna todos os comentários de sistema relacionados à integração Onvio
     */
    async consultarHistoricoComentariosOnvio(empresaId = null, obrigacaoClienteId = null, dataInicio = null, dataFim = null) {
        try {
            let query = `
                SELECT 
                    co.id,
                    co.obrigacao_id AS obrigacaoId,
                    co.comentario,
                    co.criado_em AS criadoEm,
                    co.tipo,
                    oc.cliente_id AS clienteId,
                    c.razao_social AS clienteNome,
                    c.cpf_cnpj AS clienteCnpj,
                    c.empresa_id AS empresaId
                FROM comentarios_obrigacao co
                JOIN obrigacoes_clientes oc ON co.obrigacao_id = oc.id
                JOIN clientes c ON oc.cliente_id = c.id
                WHERE co.tipo = 'sistema' 
                AND co.comentario LIKE '%INTEGRAÇÃO ONVIO%'
            `;
            
            const params = [];
            
            if (empresaId) {
                query += ` AND c.empresa_id = ?`;
                params.push(empresaId);
            }
            
            if (obrigacaoClienteId) {
                query += ` AND co.obrigacao_id = ?`;
                params.push(obrigacaoClienteId);
            }
            
            if (dataInicio) {
                query += ` AND DATE(co.criado_em) >= ?`;
                params.push(dataInicio);
            }
            
            if (dataFim) {
                query += ` AND DATE(co.criado_em) <= ?`;
                params.push(dataFim);
            }
            
            query += ` ORDER BY co.criado_em DESC`;
            
            const [comentarios] = await db.query(query, params);
            
            // Processar comentários para extrair informações estruturadas
            const comentariosProcessados = comentarios.map(comentario => {
                const info = this.extrairInfoComentario(comentario.comentario);
                return {
                    id: comentario.id,
                    obrigacaoId: comentario.obrigacaoId,
                    clienteNome: comentario.clienteNome,
                    clienteCnpj: comentario.clienteCnpj,
                    empresaId: comentario.empresaId,
                    criadoEm: comentario.criadoEm,
                    tipo: comentario.tipo,
                    comentarioOriginal: comentario.comentario,
                    infoProcessada: info
                };
            });
            
            return {
                sucesso: true,
                total: comentariosProcessados.length,
                comentarios: comentariosProcessados
            };
            
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * 🔍 Extrai informações estruturadas de um comentário de automação
     */
    extrairInfoComentario(comentario) {
        try {
            const info = {};
            
            // Extrair nome do arquivo
            const matchNome = comentario.match(/📄 Nome do Arquivo: (.+)/);
            if (matchNome) info.nomeArquivo = matchNome[1].trim();
            
            // Extrair link do documento
            const matchLink = comentario.match(/🔗 Link do Documento: (.+)/);
            if (matchLink) info.linkDocumento = matchLink[1].trim();
            
            // Extrair data/hora da busca
            const matchData = comentario.match(/📅 Data\/Hora da Busca: (.+)/);
            if (matchData) info.dataHoraBusca = matchData[1].trim();
            
            // Extrair competência
            const matchCompetencia = comentario.match(/📊 Competência: (.+)/);
            if (matchCompetencia) info.competencia = matchCompetencia[1].trim();
            
            // Extrair tipo de arquivo
            const matchTipo = comentario.match(/📋 Tipo de Arquivo: (.+)/);
            if (matchTipo) info.tipoArquivo = matchTipo[1].trim();
            
            // Extrair empresa ID
            const matchEmpresa = comentario.match(/🏢 Empresa ID: (.+)/);
            if (matchEmpresa) info.empresaId = matchEmpresa[1].trim();
            
            // Extrair cliente
            const matchCliente = comentario.match(/👤 Cliente: (.+)/);
            if (matchCliente) info.cliente = matchCliente[1].trim();
            
            // Extrair atividade
            const matchAtividade = comentario.match(/🎯 Atividade: (.+)/);
            if (matchAtividade) info.atividade = matchAtividade[1].trim();
            
            return info;
            
        } catch (error) {
            return {};
        }
    }

    /**
     * 📊 Gera relatório de automações Onvio realizadas
     */
    async gerarRelatorioAutomacoesOnvio(empresaId = null, dataInicio = null, dataFim = null) {
        try {
            console.log(`📊 Gerando relatório de automações Onvio...`);
            
            const historico = await this.consultarHistoricoComentariosOnvio(empresaId, null, dataInicio, dataFim);
            
            if (!historico.sucesso) {
                return historico;
            }
            
            // Estatísticas gerais
            const estatisticas = {
                totalAutomacoes: historico.comentarios.length,
                porEmpresa: {},
                porCompetencia: {},
                porTipoArquivo: {},
                porCliente: {}
            };
            
            historico.comentarios.forEach(comentario => {
                const info = comentario.infoProcessada;
                
                // Por empresa
                if (info.empresaId) {
                    estatisticas.porEmpresa[info.empresaId] = (estatisticas.porEmpresa[info.empresaId] || 0) + 1;
                }
                
                // Por competência
                if (info.competencia && info.competencia !== 'Não especificada') {
                    estatisticas.porCompetencia[info.competencia] = (estatisticas.porCompetencia[info.competencia] || 0) + 1;
                }
                
                // Por tipo de arquivo
                if (info.tipoArquivo && info.tipoArquivo !== 'Não especificado') {
                    estatisticas.porTipoArquivo[info.tipoArquivo] = (estatisticas.porTipoArquivo[info.tipoArquivo] || 0) + 1;
                }
                
                // Por cliente
                if (info.cliente) {
                    estatisticas.porCliente[info.cliente] = (estatisticas.porCliente[info.cliente] || 0) + 1;
                }
            });
            
            return {
                sucesso: true,
                periodo: {
                    inicio: dataInicio,
                    fim: dataFim
                },
                estatisticas: estatisticas,
                detalhes: historico.comentarios
            };
            
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * 🔍 Busca elementos usando XPath (compatível com Puppeteer v24+)
     */
    async buscarPorXPath(xpath) {
        try {
            const elementos = await this.page.evaluate((xpath) => {
                const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );
                
                const elementos = [];
                for (let i = 0; i < result.snapshotLength; i++) {
                    elementos.push(result.snapshotItem(i));
                }
                return elementos;
            }, xpath);
            
            return elementos;
        } catch (error) {
            console.log(`❌ Erro ao buscar por XPath: ${xpath}`, error.message);
            return [];
        }
    }

    /**
     * 🔍 Busca elementos por texto (compatível com Puppeteer v24+)
     */
    async buscarPorTexto(texto, tipos = ['button', 'a', 'input', 'div', 'span']) {
        try {
            const elementos = await this.page.evaluate((texto, tipos) => {
                const elementos = [];
                
                // Função para verificar se o elemento contém o texto
                const contemTexto = (el) => {
                    const textoElemento = el.textContent || el.value || el.placeholder || '';
                    return textoElemento.toLowerCase().includes(texto.toLowerCase());
                };
                
                // Buscar por todos os tipos especificados
                for (const tipo of tipos) {
                    const elementosTipo = document.querySelectorAll(tipo);
                    for (const el of elementosTipo) {
                        if (contemTexto(el)) {
                            elementos.push({
                                tagName: el.tagName.toLowerCase(),
                                textContent: el.textContent || '',
                                value: el.value || '',
                                className: el.className || '',
                                id: el.id || '',
                                href: el.href || '',
                                role: el.getAttribute('role') || '',
                                type: el.type || '',
                                element: el
                            });
                        }
                    }
                }
                
                return elementos;
            }, texto, tipos);
            
            return elementos;
        } catch (error) {
            console.log(`❌ Erro ao buscar por texto: ${texto}`, error.message);
            return [];
        }
    }

    /**
     * 🔐 Processar MFA com autenticador TOTP
     */
    async processarMFAComAutenticador(credenciais) {
        try {
            console.log('🔐 Processando MFA com Autenticador Google/TOTP...');

            // Aguardar um pouco para garantir que a página carregou completamente
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Tentar clicar no botão "Autenticador Google ou similar"
            console.log('🔍 Procurando botão "Autenticador Google ou similar"...');
            
            const resultado = await this.page.evaluate(() => {
                const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]'));
                const botaoAutenticador = botoes.find(botao => {
                    const texto = botao.textContent?.trim() || botao.value || botao.getAttribute('aria-label') || '';
                    return texto.includes('Autenticador Google ou similar') || 
                           texto.includes('Google Authenticator') || 
                           texto.includes('Autenticador') || 
                           texto.includes('Authenticator') ||
                           texto.includes('TOTP') ||
                           texto.includes('Aplicativo autenticador');
                });
                
                if (botaoAutenticador) {
                    console.log(`🔍 Botão encontrado: "${botaoAutenticador.textContent?.trim() || botaoAutenticador.value}"`);
                    botaoAutenticador.click();
                    return { sucesso: true, texto: botaoAutenticador.textContent?.trim() || botaoAutenticador.value };
                }
                
                return { sucesso: false, texto: 'Botão não encontrado' };
            });

            if (!resultado.sucesso) {
                throw new Error('Botão "Autenticador Google ou similar" não encontrado');
            }

            console.log(`✅ Clicado no botão: "${resultado.texto}"`);

            // Aguardar campo de código TOTP aparecer
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verificar se o campo de código apareceu
            const seletoresCampoTOTP = [
                'input[type="text"]',
                'input[type="number"]',
                'input[name*="code"]',
                'input[name*="otp"]',
                'input[name*="totp"]',
                'input[placeholder*="código"]',
                'input[placeholder*="code"]'
            ];

            let campoEncontrado = null;
            for (const seletor of seletoresCampoTOTP) {
                try {
                    await this.page.waitForSelector(seletor, { timeout: 2000 });
                    campoEncontrado = seletor;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!campoEncontrado) {
                throw new Error('Campo de código TOTP não encontrado na página');
            }

            console.log(`🔍 Campo de código TOTP encontrado: ${campoEncontrado}`);

            // Gerar código TOTP em tempo real usando o MFA Secret
            if (!credenciais.mfaSecret) {
                throw new Error('MFA Secret não encontrado nas credenciais');
            }

            const { authenticator } = require('otplib');
            const codigo = authenticator.generate(credenciais.mfaSecret);
            console.log(`🔑 Código TOTP gerado: ${codigo}`);

            // Preencher o campo com o código TOTP
            await this.page.focus(campoEncontrado);
            await this.page.type(campoEncontrado, codigo);
            console.log(`✅ Código TOTP preenchido no campo`);

            // Tentar submeter o formulário
            const botaoSubmitEncontrado = await this.page.evaluate(() => {
                // Procurar por botões de submit
                const botoes = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const botaoSubmit = botoes.find(botao => {
                    const texto = botao.textContent?.trim() || botao.value || '';
                    return botao.type === 'submit' || 
                           texto.includes('Continuar') || 
                           texto.includes('Verificar') || 
                           texto.includes('Submit') ||
                           texto.includes('Continue') ||
                           texto.includes('Next') ||
                           texto.includes('Próximo');
                });
                
                if (botaoSubmit) {
                    botaoSubmit.click();
                    return { sucesso: true, texto: botaoSubmit.textContent?.trim() || botaoSubmit.value };
                }
                
                return { sucesso: false };
            });
            
            if (botaoSubmitEncontrado.sucesso) {
                console.log(`✅ Formulário MFA submetido via botão: "${botaoSubmitEncontrado.texto}"`);
            } else {
                // Tentar pressionar Enter
                await this.page.keyboard.press('Enter');
                console.log(`✅ Enter pressionado para submeter`);
            }

            // Aguardar redirecionamento
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;

        } catch (error) {
            console.log('❌ Erro ao processar MFA com autenticador:', error.message);
            throw error;
        }
    }

    /**
     * 🔄 Verifica e troca de base se necessário
     */
    async verificarETrocarBase(baseDesejada) {
        try {
            if (!baseDesejada) {
                console.log('⚠️ Base não informada, pulando verificação de base');
                return true;
            }

            
            // 1. Garantir que o menu de perfil esteja aberto (evitar abrir e fechar por duplo clique)
            const seletorMenuAberto = '.bm-header-modal-mask.bm-header-profile-menu-active, .profile-linked-accounts';
            let menuAberto = await this.page.$(seletorMenuAberto);
            
            if (!menuAberto) {
                let tentativasPerfil = 0;
                const maxTentativasPerfil = 10;
                
                // Possíveis alvos clicáveis para abrir o menu de perfil (avatar/botão)
                const seletoresCliquePerfil = [
                    'button[aria-haspopup="menu"]',
                    'button[aria-label*="perfil"]',
                    'button[aria-label*="profile"]',
                    '.header-profile button',
                    '.header-profile',
                    'img[alt*="perfil"]',
                    'img[alt*="profile"]',
                    '[class*="avatar"]',
                    '[class*="profile-avatar"]',
                    '[class*="profile-button"]',
                    '[class*="profile"]:not(.bm-header-modal-mask):not(.bm-header-profile-menu-active)'
                ];
                
                while (!menuAberto && tentativasPerfil < maxTentativasPerfil) {
                    tentativasPerfil++;
                    let clicou = false;
                    for (const seletor of seletoresCliquePerfil) {
                        try {
                            const el = await this.page.$(seletor);
                            if (el) {
                                // Tenta hover antes do clique para garantir visibilidade
                                try { const box = await el.boundingBox(); if (box) { await this.page.mouse.move(box.x + box.width/2, box.y + box.height/2); } } catch(_) {}
                                try { await el.click(); } catch(_) {}
                                // Se ainda não abrir, tenta clique por coordenadas do bounding box
                                if (!menuAberto) {
                                    try {
                                        const box = await el.boundingBox();
                                        if (box) {
                                            await this.page.mouse.click(box.x + box.width/2, box.y + box.height/2, { delay: 20 });
                                        }
                                    } catch (_) {}
                                }
                                clicou = true;
                                break;
                            }
                        } catch (_) {
                            // ignora e tenta próximo seletor
                        }
                    }
                    
                    // Aguardar o menu abrir de fato (aparecer máscara ou conteúdo do menu)
                    try {
                        await this.page.waitForSelector(seletorMenuAberto, { timeout: 1500 });
                    } catch (_) {
                        // segue tentando
                    }
                    
                    menuAberto = await this.page.$(seletorMenuAberto);
                    if (!menuAberto) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // Se não conseguiu clicar em nada, evita loop quente
                    if (!clicou) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                if (!menuAberto) {
                    console.log('⚠️ Não foi possível abrir o menu de perfil, continuando sem troca de base');
                    return true;
                }
            }
            
            console.log('✅ Menu de perfil aberto');
            
            // 2. Tentar identificar a base atual; se não conseguir, seguir para o menu de troca
            let baseAtualTexto = null;
            try {
                const baseAtualElement = await this.page.$('.profile__client');
                if (baseAtualElement) {
                    baseAtualTexto = await this.page.evaluate(el => el.textContent, baseAtualElement);
                }
            } catch (_) {}

            if (baseAtualTexto) {
                console.log(`📍 Base atual: ${baseAtualTexto}`);
                const baseAtualNumero = this.extrairNumeroBase(baseAtualTexto);
                console.log(`📍 Base atual (número): ${baseAtualNumero}`);
                if (baseAtualNumero === baseDesejada) {
                    console.log(`✅ Base já está correta (${baseDesejada}), não precisa trocar`);
                    await this.page.click('body');
                    return true;
                }
            } else {
                console.log('⚠️ Elemento da base atual não encontrado, seguindo para o menu de troca...');
            }
            
            // 5. Clicar no botão de troca de base (robusto)
            const seletoresIconeTroca = [
                '.profile__name .bento-icon-start-process',
                '.profile__name i.bento-icon-start-process',
                '.bento-icon-start-process'
            ];
            
            let clicouIconeTroca = false;
            for (const seletor of seletoresIconeTroca) {
                try {
                    await this.page.waitForSelector(seletor, { timeout: 2000 });
                    const el = await this.page.$(seletor);
                    if (!el) continue;
                    
                    // Tenta click direto
                    try { await el.click({ delay: 50 }); } catch (_) {}
                    
                    // Verifica se abriu
                    try {
                        await this.page.waitForSelector('.profile-linked-accounts__group', { timeout: 1500 });
                        clicouIconeTroca = true;
                        break;
                    } catch (_) {}
                    
                    // Tenta scrollIntoView + click via JS
                    try {
                        await this.page.evaluate(elm => { elm.scrollIntoView({ block: 'center', inline: 'center' }); }, el);
                        await this.page.evaluate(elm => { if (elm && typeof elm.click === 'function') { elm.click(); } }, el);
                    } catch (_) {}
                    
                    try {
                        await this.page.waitForSelector('.profile-linked-accounts__group', { timeout: 1500 });
                        clicouIconeTroca = true;
                        break;
                    } catch (_) {}
                    
                    // Tenta clique por coordenadas
                    try {
                        const box = await el.boundingBox();
                        if (box) {
                            await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 30 });
                        }
                    } catch (_) {}
                    
                    try {
                        await this.page.waitForSelector('.profile-linked-accounts__group', { timeout: 1500 });
                        clicouIconeTroca = true;
                        break;
                    } catch (_) {}
                } catch (_) {
                    // tenta próximo seletor
                }
            }
            
            if (!clicouIconeTroca) {
                console.log('⚠️ Botão de troca de base não respondeu ao clique');
                return true;
            }
            
            console.log('✅ Menu de troca de base aberto');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 6. Procurar pela base desejada na lista e tentar clicar até entrar em carregamento
            const basesDisponiveis = await this.page.$$('.profile-linked-accounts__group');
            console.log(`🔍 Encontradas ${basesDisponiveis.length} bases disponíveis`);
            
            let baseEncontrada = false;
            let tentativasBase = 0;
            const maxTentativasBase = 5;
            
            while (!baseEncontrada && tentativasBase < maxTentativasBase) {
                tentativasBase++;
                console.log(`🔄 Tentativa ${tentativasBase}/${maxTentativasBase} de troca de base...`);
                
                // Procurar pela base desejada
                for (const baseElement of basesDisponiveis) {
                    const textoBase = await this.page.evaluate(el => el.textContent, baseElement);
                    console.log(`🔍 Verificando base: ${textoBase}`);
                    
                    // Extrair número da base (I, II, III ou 1, 2, 3)
                    const numeroBase = this.extrairNumeroBase(textoBase);
                    console.log(`🔍 Base extraída: ${numeroBase}`);
                    
                    if (numeroBase === baseDesejada) {
                        console.log(`✅ Base ${baseDesejada} encontrada! Clicando...`);
                        
                        // Clicar especificamente na linha da base (grupo) via DOM por texto
                        try {
                            const clicked = await this.page.evaluate((baseDesejadaTexto) => {
                                const grupos = Array.from(document.querySelectorAll('.profile-linked-accounts__group'));
                                const alvo = grupos.find(g => {
                                    const label = g.querySelector('.profile-linked-accounts__client');
                                    return label && /BASE\s*I\b/i.test(label.textContent || '');
                                });
                                if (!alvo) return false;
                                // Rolagem até o elemento
                                try { alvo.scrollIntoView({ block: 'center', inline: 'center' }); } catch(_) {}
                                // Disparo de eventos para garantir clique em apps Angular
                                const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window}));
                                try { fire(alvo, 'pointerdown'); } catch(_) {}
                                try { fire(alvo, 'mousedown'); } catch(_) {}
                                try { fire(alvo, 'pointerup'); } catch(_) {}
                                try { fire(alvo, 'mouseup'); } catch(_) {}
                                try { if (alvo && typeof (alvo).click === 'function') { (alvo).click(); } else { alvo && alvo.dispatchEvent(new Event('click', { bubbles: true })); } } catch(_) {}
                                return true;
                            }, `BASE ${baseDesejada}`);
                            if (!clicked) {
                                // Fallback no ElementHandle se o evaluate não encontrou
                                const clientLabel = await baseElement.$('.profile-linked-accounts__client');
                                if (clientLabel) {
                                    try { await this.page.evaluate(el => el.scrollIntoView({ block: 'center' }), clientLabel); } catch (_) {}
                                    try { await clientLabel.click({ delay: 30 }); } catch (_) { await baseElement.click(); }
                                } else {
                                    await baseElement.click();
                                }
                            }
                        } catch (_) {
                            // Fallback direto
                            const clientLabel = await baseElement.$('.profile-linked-accounts__client');
                            if (clientLabel) {
                                try { await this.page.evaluate(el => el.scrollIntoView({ block: 'center' }), clientLabel); } catch (_) {}
                                try { await clientLabel.click({ delay: 30 }); } catch (_) { await baseElement.click(); }
                            } else {
                                await baseElement.click();
                            }
                        }
                        
                        // Aguarda o menu fechar (opcional) antes de validar
                        try { await this.page.waitForSelector('.profile-linked-accounts', { state: 'detached', timeout: 1500 }); } catch (_) {}
                        
                        // Confirmar olhando o texto do elemento de base no cabeçalho com o menu ainda aberto
                        let confirmouTroca = false;
                        for (let i = 0; i < 8; i++) {
                            await new Promise(r => setTimeout(r, 300));
                            try {
                                const elAtual = await this.page.$('.profile__client');
                                if (elAtual) {
                                    const txt = await this.page.evaluate(el => (el.textContent || '').trim(), elAtual);
                                    const num = this.extrairNumeroBase(txt);
                                    if (num === baseDesejada) {
                                        confirmouTroca = true;
                                        break;
                                    }
                                }
                            } catch (_) {}
                        }

                        if (!confirmouTroca) {
                            console.log('⚠️ Base não confirmou após clique, nova tentativa...');
                            continue;
                        }

                        console.log(`✅ Troca de base confirmada.`);
                        baseEncontrada = true;

                        // Fechar o menu e navegar para Documentos novamente
                        try { await this.page.click('body'); } catch (_) {}
                        try { await this.navegarParaAreaDocumentos(); } catch (_) {}
                        break;
                    }
                }
                
                if (!baseEncontrada) {
                    console.log(`⚠️ Base ${baseDesejada} não encontrada na lista na tentativa ${tentativasBase}`);
                    if (tentativasBase < maxTentativasBase) {
                        console.log(`⏳ Aguardando antes da próxima tentativa...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            
            if (!baseEncontrada) {
                console.log(`⚠️ Base ${baseDesejada} não encontrada após ${maxTentativasBase} tentativas`);
                // Fechar o menu clicando fora
                await this.page.click('body');
                
                // Mesmo sem conseguir trocar a base, tentar navegar para "Meus Documentos"
                console.log(`📁 Tentando navegar para "Meus Documentos" mesmo sem troca de base...`);
                try {
                    await this.navegarParaAreaDocumentos();
                    return true;
                } catch (error) {
                    console.log(`⚠️ Erro ao navegar para "Meus Documentos": ${error.message}`);
                    return false;
                }
            }
            
            // 7. Verificar se a troca foi bem-sucedida
            console.log(`⏳ Verificando se a troca para base ${baseDesejada} foi bem-sucedida...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const novaBaseElement = await this.page.$('.profile__client');
            if (novaBaseElement) {
                const novaBaseTexto = await this.page.evaluate(el => el.textContent, novaBaseElement);
                const novaBaseNumero = this.extrairNumeroBase(novaBaseTexto);
                console.log(`📍 Nova base: ${novaBaseTexto} (${novaBaseNumero})`);
                
                if (novaBaseNumero === baseDesejada) {
                    console.log(`✅ Troca de base bem-sucedida!`);
                    return true;
                } else {
                    console.log(`⚠️ Troca de base pode não ter funcionado - base atual: ${novaBaseNumero}, desejada: ${baseDesejada}`);
                    // Mesmo sem troca bem-sucedida, tentar navegar para "Meus Documentos"
                    console.log(`📁 Tentando navegar para "Meus Documentos" mesmo com troca não confirmada...`);
                    try {
                        await this.navegarParaAreaDocumentos();
                        return true;
                    } catch (error) {
                        console.log(`⚠️ Erro ao navegar para "Meus Documentos": ${error.message}`);
                        return false;
                    }
                }
            } else {
                console.log(`⚠️ Não foi possível verificar a nova base`);
                // Mesmo sem verificação, tentar navegar para "Meus Documentos"
                console.log(`📁 Tentando navegar para "Meus Documentos" mesmo sem verificação de base...`);
                try {
                    await this.navegarParaAreaDocumentos();
                    return true;
                } catch (error) {
                    console.log(`⚠️ Erro ao navegar para "Meus Documentos": ${error.message}`);
                    return false;
                }
            }
            
            return true;
            
        } catch (error) {
            
            // Mesmo com erro, tentar navegar para "Meus Documentos"
            try {
                await this.navegarParaAreaDocumentos();
                return true;
            } catch (navError) {
                console.log(`⚠️ Erro ao navegar para "Meus Documentos": ${navError.message}`);
                return false;
            }
        }
    }
}

// Instância singleton do serviço
const onvioService = new OnvioService();

module.exports = {

    onvioService,

    OnvioService

};

