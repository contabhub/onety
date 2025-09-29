const express = require("express");
const router = express.Router();


const authRoutes = require('./onety/auth');
const empresasRoutes = require('./onety/empresas');
const usuariosRoutes = require('./onety/usuarios');
const usuariosEmpresasRoutes = require('./onety/usuarios_empresas');
const modulosRoutes = require('./onety/modulos');
const modulosEmpresaRoutes = require('./onety/modulos_empresa');





router.use('/auth', authRoutes);
router.use('/empresas', empresasRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/usuarios-empresas', usuariosEmpresasRoutes);
router.use('/modulos', modulosRoutes);
router.use('/modulos-empresa', modulosEmpresaRoutes);




router.get("/", (req, res) => {
  res.send("API rodando!");
});

module.exports = router;
