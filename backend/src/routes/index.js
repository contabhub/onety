const express = require("express");
const router = express.Router();

// Rotas do Onety
const authRoutes = require('./onety/auth');
const empresasRoutes = require('./onety/empresas');
const usuariosRoutes = require('./onety/usuarios');
const usuariosEmpresasRoutes = require('./onety/usuarios_empresas');
const modulosRoutes = require('./onety/modulos');
const modulosEmpresaRoutes = require('./onety/modulos_empresa');
const conteudoRoutes = require('./onety/conteudo');
const provaRoutes = require('./onety/prova');
const questaoRoutes = require('./onety/questao');
const alternativaRoutes = require('./onety/alternativa');
const provaEmpresaRoutes = require('./onety/prova_empresa');
const cargosRoutes = require('./onety/cargos');
const departamentosRoutes = require('./onety/departamentos');
const gruposRoutes = require('./onety/grupos');
const empresasGruposRoutes = require('./onety/empresas-grupos');
const empresasConteudosRoutes = require('./onety/empresas-conteudos');
const provaGrupoRoutes = require('./onety/prova_grupo');
const notificacoesRoutes = require('./onety/notificacoes');



// Rotas do Atendimento
const apikeyRoutes = require('./atendimento/apikey');
const conversasRoutes = require('./atendimento/conversas');
const conversasTransferenciasRoutes = require('./atendimento/conversas_transferencias');
const etiquetasRoutes = require('./atendimento/etiquetas');
const instanciasRoutes = require('./atendimento/instancias');
const leadsRoutes = require('./atendimento/leads');
const leadsEtiquetasRoutes = require('./atendimento/leads_etiquetas');
const linksExternosRoutes = require('./atendimento/links_externos');
const mensagensRoutes = require('./atendimento/mensagens');
const timesAtendimentoRoutes = require('./atendimento/times_atendimento');
const timesAtendimentoInstanciasRoutes = require('./atendimento/times_atendimento_instancias');
const timesAtendimentoUsuariosRoutes = require('./atendimento/times_atendimento_usuarios');
const webhookRoutes = require('./atendimento/webhook');
const webhookIntegracaoRoutes = require('./atendimento/webhook-integracao');
const webhookMonitorRoutes = require('./atendimento/webhook-monitor');
const zapimessagesRoutes = require('./atendimento/zapimessages');
const usuariosAtendimentoRoutes = require('./atendimento/usuarios');

// Rotas do Comercial
const arquivosRoutes = require('./comercial/arquivos');
const atividadesRoutes = require('./comercial/atividades');
const camposPersonalizadosRoutes = require('./comercial/camposPersonalizados');
const categoriasCamposRoutes = require('./comercial/categoriasCampos');
const contatosRoutes = require('./comercial/contatos');
const crmRoutes = require('./comercial/crm');
const empresaLeadsRoutes = require('./comercial/empresa_leads');
const funilFasesRoutes = require('./comercial/funil_fases');
const funisRoutes = require('./comercial/funis');
const historicoLeadsRoutes = require('./comercial/historicoLeads');
const leadsComercialRoutes = require('./comercial/leads');
const notasRoutes = require('./comercial/notas');
const playbooksRoutes = require('./comercial/playbooks');
const preClientesRoutes = require('./comercial/pre_clientes');
const produtosComercialRoutes = require('./comercial/produtos');
const tiposAtividadeRoutes = require('./comercial/tiposAtividade');
const valoresPersonalizadosRoutes = require('./comercial/valoresPersonalizados');

// Rotas do Contratual
const contratosRoutes = require('./contratual/contratos');
const assinaturasRoutes = require('./contratual/assinaturas');
const signatariosRoutes = require('./contratual/signatarios');
const modelosContratoRoutes = require('./contratual/modelos_contrato');
const variaveisPersonalizadasRoutes = require('./contratual/variaveis_personalizadas');
const contratadaRoutes = require('./contratual/contratada');
const contratosAutentiqueRoutes = require('./contratual/contratos-autentique');
const documentosAutentiqueRoutes = require('./contratual/documentos-autentique');
const documentosRoutes = require('./contratual/documentos');
const listaSignatariosRoutes = require('./contratual/lista_signatarios');
const rascunhosRoutes = require('./contratual/rascunhos');
const rascunhosDocumentosRoutes = require('./contratual/rascunhos_documentos');

// Rotas do Financeiro
const automacaoRoutes = require('./financeiro/automacao');
const boletosRoutes = require('./financeiro/boletos');
const boletosDraftsRoutes = require('./financeiro/boletos_drafts');
const categoriasFinanceiroRoutes = require('./financeiro/categorias');
const centroDeCustoRoutes = require('./financeiro/centro_de_custo');
const clientesFinanceiroRoutes = require('./financeiro/clientes');
const conciliacoesRoutes = require('./financeiro/conciliacoes');
const caixinhaRoutes = require('./financeiro/caixinha');
const contratosFinanceiroRoutes = require('./financeiro/contratos');
const departamentosFinanceiroRoutes = require('./financeiro/departamentos');
const exportarRoutes = require('./financeiro/exportar');
const importarRoutes = require('./financeiro/importar');
const ofxImportRoutes = require('./financeiro/ofxImport');
const pagoRecebidoRoutes = require('./financeiro/pago_recebido');
const produtosServicosRoutes = require('./financeiro/produtos_servicos');
const recorrenciaVendasContratosRoutes = require('./financeiro/recorrencia_vendas');
const recorrenciasRoutes = require('./financeiro/recorrencias');
const subCategoriasRoutes = require('./financeiro/sub_categorias');
const tiposRoutes = require('./financeiro/tipos');
const transacoesRoutes = require('./financeiro/transacoes');
const transferenciasCaixinhasRoutes = require('./financeiro/transferencias_caixinha');
const vendasRoutes = require('./financeiro/vendas');
const openfinanceRoutes = require('../apis/openfinance');
const contasRoutes = require('./financeiro/contas');
const transacoesApiRoutes = require('./financeiro/transacoes-api');

// Rotas da Gestão
const gestaoCargosRoutes = require('./gestao/cargosRoutes');
const gestaoCamposAdicionaisRoutes = require('./gestao/camposAdicionaisRoutes');
const gestaoProcessosRoutes = require('./gestao/processosRoutes');
const gestaoTarefasRoutes = require('./gestao/tarefasRoutes');
const gestaoDepartamentoRoutes = require('./gestao/departamentoRoutes');
const gestaoClientesRoutes = require('./gestao/clientesRoutes');
const gestaoCompetenciasRoutes = require('./gestao/competenciasRoutes');
const gestaoDasRoutes = require('./gestao/dasRoutes');
const gestaoDctfwebRoutes = require('./gestao/dctfwebRoutes');
const gestaoEmailRoutes = require('./gestao/emailRoutes');
const gestaoGuiaRoutes = require('./gestao/guiaRoutes');
const gestaoIntegracoesRoutes = require('./gestao/integracoesRoutes');
const gestaoObrigacoesRoutes = require('./gestao/obrigacoesRoutes');
const gestaoObrigacoesClientesRoutes = require('./gestao/obrigacoesClientesRoutes');
const gestaoOnvioRoutes = require('./gestao/onvioRoutes');
const gestaoParcelamentoRoutes = require('./gestao/parcelamentoRoutes');
const gestaoPdfLayoutRoutes = require('./gestao/pdfLayoutRoutes');
const gestaoPesquisaRoutes = require('./gestao/pesquisaRoutes');
const gestaoRelatoriosRoutes = require('./gestao/relatoriosRoutes');
const gestaoSerproRoutes = require('./gestao/serproRoutes');
const gestaoSitfisRoutes = require('./gestao/sitfisRoutes');
const gestaoEpluginRoutes = require('./gestao/epluginRoutes');
const gestaoDriveRoutes = require('./gestao/driveRoutes');
const gestaoEnqueteRoutes = require('./gestao/enqueteRoutes');
const gestaoResumoRoutes = require('./gestao/ResumoRoutes');




// Rotas do Onety
router.use('/auth', authRoutes);
router.use('/empresas', empresasRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/usuarios-empresas', usuariosEmpresasRoutes);
router.use('/modulos', modulosRoutes);      
router.use('/modulos-empresa', modulosEmpresaRoutes);
router.use('/conteudo', conteudoRoutes);
router.use('/prova', provaRoutes);
router.use('/questao', questaoRoutes);
router.use('/alternativa', alternativaRoutes);
router.use('/prova-empresa', provaEmpresaRoutes);
router.use('/cargos', cargosRoutes);
router.use('/departamentos', departamentosRoutes);
router.use('/grupos', gruposRoutes);
router.use('/empresas-grupos', empresasGruposRoutes);
router.use('/empresas-conteudos', empresasConteudosRoutes);
router.use('/prova-grupo', provaGrupoRoutes);
router.use('/notificacoes', notificacoesRoutes);

// Rotas do Atendimento
router.use('/atendimento/apikey', apikeyRoutes);
router.use('/atendimento/conversas', conversasRoutes);
router.use('/atendimento/conversas-transferencias', conversasTransferenciasRoutes);
router.use('/atendimento/etiquetas', etiquetasRoutes);
router.use('/atendimento/instancias', instanciasRoutes);
router.use('/atendimento/leads', leadsRoutes);
router.use('/atendimento/leads-etiquetas', leadsEtiquetasRoutes);
router.use('/atendimento/links-externos', linksExternosRoutes);
router.use('/atendimento/mensagens', mensagensRoutes);
router.use('/atendimento/times-atendimento', timesAtendimentoRoutes);
router.use('/atendimento/times-atendimento-instancias', timesAtendimentoInstanciasRoutes);
router.use('/atendimento/times-atendimento-usuarios', timesAtendimentoUsuariosRoutes);
router.use('/atendimento/webhook', webhookRoutes);
router.use('/atendimento/webhook-integracao', webhookIntegracaoRoutes);
router.use('/atendimento/webhook-monitor', webhookMonitorRoutes);
router.use('/atendimento/zapimessages', zapimessagesRoutes);
router.use('/atendimento/usuarios', usuariosAtendimentoRoutes);

// Rotas do Comercial
router.use('/comercial/arquivos', arquivosRoutes);
router.use('/comercial/atividades', atividadesRoutes);
router.use('/comercial/campos-personalizados', camposPersonalizadosRoutes);
router.use('/comercial/categorias-campos', categoriasCamposRoutes);
router.use('/comercial/contatos', contatosRoutes);
router.use('/comercial/crm', crmRoutes);
router.use('/comercial/empresa-leads', empresaLeadsRoutes);
router.use('/comercial/funil-fases', funilFasesRoutes);
router.use('/comercial/funis', funisRoutes);
router.use('/comercial/historico-leads', historicoLeadsRoutes);
router.use('/comercial/leads', leadsComercialRoutes);
router.use('/comercial/notas', notasRoutes);
router.use('/comercial/playbooks', playbooksRoutes);
router.use('/comercial/pre-clientes', preClientesRoutes);
router.use('/comercial/produtos', produtosComercialRoutes);
router.use('/comercial/tipos-atividade', tiposAtividadeRoutes);
router.use('/comercial/valores-personalizados', valoresPersonalizadosRoutes);

// Rotas do Contratual
router.use('/contratual/contratos', contratosRoutes);
router.use('/contratual/assinaturas', assinaturasRoutes);
router.use('/contratual/signatarios', signatariosRoutes);
router.use('/contratual/modelos-contrato', modelosContratoRoutes);
router.use('/contratual/variaveis-personalizadas', variaveisPersonalizadasRoutes);
router.use('/contratual/contratada', contratadaRoutes);
router.use('/contratual/contratos-autentique', contratosAutentiqueRoutes);
router.use('/contratual/documentos-autentique', documentosAutentiqueRoutes);
router.use('/contratual/documentos', documentosRoutes);
router.use('/contratual/lista-signatarios', listaSignatariosRoutes);
router.use('/contratual/rascunhos', rascunhosRoutes);
router.use('/contratual/rascunhos-documentos', rascunhosDocumentosRoutes);

// Rotas do Financeiro
router.use('/financeiro/automacao', automacaoRoutes);
router.use('/financeiro/boletos', boletosRoutes);
router.use('/financeiro/boletos-drafts', boletosDraftsRoutes);
router.use('/financeiro/categorias', categoriasFinanceiroRoutes);
router.use('/financeiro/centro-de-custo', centroDeCustoRoutes);
router.use('/financeiro/clientes', clientesFinanceiroRoutes);
router.use('/financeiro/conciliacoes', conciliacoesRoutes);
router.use('/financeiro/caixinha', caixinhaRoutes);
router.use('/financeiro/contratos', contratosFinanceiroRoutes);
router.use('/financeiro/departamentos', departamentosFinanceiroRoutes);
router.use('/financeiro/exportar', exportarRoutes);
router.use('/financeiro/importar', importarRoutes);
router.use('/financeiro/ofx-import', ofxImportRoutes);
router.use('/financeiro/pago-recebido', pagoRecebidoRoutes);
router.use('/financeiro/produtos-servicos', produtosServicosRoutes);
router.use('/financeiro/recorrencia-vendas-contratos', recorrenciaVendasContratosRoutes);
router.use('/financeiro/recorrencias', recorrenciasRoutes);
router.use('/financeiro/sub-categorias', subCategoriasRoutes);
router.use('/financeiro/tipos', tiposRoutes);
router.use('/financeiro/transacoes', transacoesRoutes);
router.use('/financeiro/transferencias-caixinha', transferenciasCaixinhasRoutes);
router.use('/financeiro/vendas', vendasRoutes);
router.use('/financeiro/vendas', vendasRoutes);
router.use('/financeiro/contratos', contratosFinanceiroRoutes);
router.use('/openfinance', openfinanceRoutes);
router.use('/financeiro/contas', contasRoutes);
router.use('/financeiro/transacoes-api', transacoesApiRoutes);


// Rotas da Gestão
router.use('/gestao/cargos', gestaoCargosRoutes);
router.use('/gestao/campos-adicionais', gestaoCamposAdicionaisRoutes);
router.use('/gestao/processos', gestaoProcessosRoutes);
router.use('/gestao/tarefas', gestaoTarefasRoutes);
router.use('/gestao/departamentos', gestaoDepartamentoRoutes);
router.use('/gestao/clientes', gestaoClientesRoutes);
router.use('/gestao/competencias', gestaoCompetenciasRoutes);
router.use('/gestao/das', gestaoDasRoutes);
router.use('/gestao/dctfweb', gestaoDctfwebRoutes);
router.use('/gestao/email', gestaoEmailRoutes);
router.use('/gestao/guia', gestaoGuiaRoutes);
router.use('/gestao/integracoes', gestaoIntegracoesRoutes);
router.use('/gestao/obrigacoes', gestaoObrigacoesRoutes);
router.use('/gestao/obrigacoes-clientes', gestaoObrigacoesClientesRoutes);
router.use('/gestao/onvio', gestaoOnvioRoutes);
router.use('/gestao/parcelamento', gestaoParcelamentoRoutes);
router.use('/gestao/pdf-layout', gestaoPdfLayoutRoutes);
router.use('/gestao/pesquisa', gestaoPesquisaRoutes);
router.use('/gestao/relatorios', gestaoRelatoriosRoutes);
router.use('/gestao/serpro', gestaoSerproRoutes);
router.use('/gestao/sitfis', gestaoSitfisRoutes);
router.use('/gestao/eplugin', gestaoEpluginRoutes);
router.use('/gestao/drive', gestaoDriveRoutes);
router.use('/gestao/enquete', gestaoEnqueteRoutes);
router.use('/gestao/resumo', gestaoResumoRoutes);




router.get("/", (req, res) => {
  res.send("API rodando!");
});

module.exports = router;
