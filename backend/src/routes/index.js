const express = require("express");
const router = express.Router();


const authRoutes = require('./onety/auth');
const empresasRoutes = require('./onety/empresas');
const usuariosRoutes = require('./onety/usuarios');
const usuariosEmpresasRoutes = require('./onety/usuarios_empresas');
const modulosRoutes = require('./onety/modulos');
const modulosEmpresaRoutes = require('./onety/modulos_empresa');
const conteudoRoutes = require('./onety/conteudo');
const empresaConteudoRoutes = require('./onety/empresa_conteudo');
const provaRoutes = require('./onety/prova');
const questaoRoutes = require('./onety/questao');
const alternativaRoutes = require('./onety/alternativa');
const provaEmpresaRoutes = require('./onety/prova_empresa');





router.use('/auth', authRoutes);
router.use('/empresas', empresasRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/usuarios-empresas', usuariosEmpresasRoutes);
router.use('/modulos', modulosRoutes);
router.use('/modulos-empresa', modulosEmpresaRoutes);
router.use('/conteudo', conteudoRoutes);
router.use('/empresa-conteudo', empresaConteudoRoutes);
router.use('/prova', provaRoutes);
router.use('/questao', questaoRoutes);
router.use('/alternativa', alternativaRoutes);
router.use('/prova-empresa', provaEmpresaRoutes);




router.get("/", (req, res) => {
  res.send("API rodando!");
});

module.exports = router;
