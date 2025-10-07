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

router.get("/", (req, res) => {
  res.send("API rodando!");
});

module.exports = router;
