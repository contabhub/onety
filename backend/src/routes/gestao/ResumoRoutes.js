const express = require("express");
const router = express.Router();
const resumoController = require("../../controllers/gestao/resumoController");

router.get("/:empresaId", resumoController.obterResumo);

module.exports = router;
