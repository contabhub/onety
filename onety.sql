-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: onety_onety:3306
-- Tempo de geração: 04/11/2025 às 16:56
-- Versão do servidor: 9.4.0
-- Versão do PHP: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `onety`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `alternativa`
--

CREATE TABLE `alternativa` (
  `id` int NOT NULL,
  `questao_id` int NOT NULL,
  `opcao` varchar(500) NOT NULL,
  `correto` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `anexos_atividade`
--

CREATE TABLE `anexos_atividade` (
  `id` int NOT NULL,
  `atividade_tarefa_id` int NOT NULL,
  `nome_arquivo` varchar(255) DEFAULT NULL,
  `pdf` longblob,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `api_keys`
--

CREATE TABLE `api_keys` (
  `id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `chave` varchar(255) NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `arquivos_baixados_automaticamente`
--

CREATE TABLE `arquivos_baixados_automaticamente` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `pdf` longblob,
  `nome_arquivo` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `assinaturas`
--

CREATE TABLE `assinaturas` (
  `id` int NOT NULL,
  `contrato_id` int DEFAULT NULL,
  `documento_id` int DEFAULT NULL,
  `signatario_id` int DEFAULT NULL,
  `cpf` varchar(14) NOT NULL,
  `assinado_em` datetime DEFAULT NULL,
  `endereco_ip` varchar(45) DEFAULT NULL,
  `navegador_usuario` varchar(255) DEFAULT NULL,
  `hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `atividades_obrigacao`
--

CREATE TABLE `atividades_obrigacao` (
  `id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `ordem` int DEFAULT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `texto` text,
  `descricao` text,
  `tipo_cancelamento` varchar(100) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pdf_layout_id` int DEFAULT NULL,
  `titulo_documento` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `atividades_processo`
--

CREATE TABLE `atividades_processo` (
  `id` int NOT NULL,
  `processo_id` int NOT NULL,
  `ordem` int DEFAULT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `texto` text,
  `descricao` text,
  `tipo_cancelamento` varchar(100) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `empresa_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `atividades_tarefas`
--

CREATE TABLE `atividades_tarefas` (
  `id` int NOT NULL,
  `tarefa_id` int NOT NULL,
  `atividade_id` int NOT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `texto` text,
  `descricao` text,
  `tipo_cancelamento` varchar(100) DEFAULT NULL,
  `concluido` tinyint(1) DEFAULT '0',
  `cancelado` tinyint(1) DEFAULT '0',
  `justificativa` text,
  `data_conclusao` datetime DEFAULT NULL,
  `data_cancelamento` date DEFAULT NULL,
  `concluido_por` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `boletos`
--

CREATE TABLE `boletos` (
  `id` int NOT NULL,
  `inter_conta_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `link_boleto` varchar(500) DEFAULT NULL,
  `codigo_barras` varchar(150) DEFAULT NULL,
  `data_emissao` date DEFAULT NULL,
  `data_vencimento` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `numero_venda` varchar(100) DEFAULT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `pagador_nome` varchar(255) DEFAULT NULL,
  `pagador_cpf_cnpj` varchar(18) DEFAULT NULL,
  `pagador_email` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `pago_recebido_id` int DEFAULT NULL,
  `pdf_boleto` varchar(500) DEFAULT NULL,
  `codigo_solicitacao` varchar(255) DEFAULT NULL,
  `contrato_id` int DEFAULT NULL,
  `venda_id` int DEFAULT NULL,
  `valor_recebido` decimal(15,2) DEFAULT NULL,
  `data_pagamento` datetime DEFAULT NULL,
  `data_cancelamento` datetime DEFAULT NULL,
  `motivo_cancelamento` varchar(255) DEFAULT NULL,
  `gerado_manualmente` tinyint(1) DEFAULT '0',
  `vencimento_original_venda` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `boletos_historico`
--

CREATE TABLE `boletos_historico` (
  `id` int NOT NULL,
  `boleto_id` int NOT NULL,
  `codigo_solicitacao` varchar(255) DEFAULT NULL,
  `status_anterior` varchar(100) DEFAULT NULL,
  `status_atual` varchar(100) DEFAULT NULL,
  `payload` text,
  `data_evento` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `boleto_drafts`
--

CREATE TABLE `boleto_drafts` (
  `id` bigint NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `empresa_id` int DEFAULT NULL,
  `linha_digitavel` varchar(60) NOT NULL,
  `boleto_meta` json DEFAULT NULL,
  `formulario` json DEFAULT NULL,
  `status` enum('rascunho','finalizado') DEFAULT 'rascunho',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `caixinha`
--

CREATE TABLE `caixinha` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `banco` varchar(150) DEFAULT NULL,
  `descricao_banco` varchar(255) DEFAULT NULL,
  `tipo_conta` varchar(50) DEFAULT NULL,
  `inicio_lancamento` date DEFAULT NULL,
  `numero_conta` varchar(50) DEFAULT NULL,
  `agencia` varchar(20) DEFAULT NULL,
  `saldo` decimal(15,2) DEFAULT '0.00',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `campos_adicionais`
--

CREATE TABLE `campos_adicionais` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `tipo` varchar(100) NOT NULL,
  `opcoes` text,
  `obrigatorio` tinyint(1) DEFAULT '0',
  `ordem` int DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `captura_boletos`
--

CREATE TABLE `captura_boletos` (
  `id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `linha_digitavel` varchar(255) NOT NULL,
  `boleto_meta` text,
  `formulario` text,
  `status` enum('capturado','finalizado') DEFAULT 'capturado',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cargos`
--

CREATE TABLE `cargos` (
  `id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `empresa_id` int NOT NULL,
  `permissoes` json DEFAULT NULL,
  `permissoes_modulos` json DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `centro_custo`
--

CREATE TABLE `centro_custo` (
  `id` int NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `situacao` enum('ativo','inativo') DEFAULT 'ativo',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `empresa_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `certificados_clientes`
--

CREATE TABLE `certificados_clientes` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `nome_arquivo` varchar(255) DEFAULT NULL,
  `pfx` longblob,
  `data_vencimento` date DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes`
--

CREATE TABLE `clientes` (
  `id` int NOT NULL,
  `tipo_pessoa` enum('fisica','juridica') NOT NULL,
  `cpf_cnpj` varchar(18) DEFAULT NULL,
  `nome_fantasia` varchar(255) DEFAULT NULL,
  `razao_social` varchar(255) DEFAULT NULL,
  `apelido` varchar(150) DEFAULT NULL,
  `email_principal` varchar(255) DEFAULT NULL,
  `telefone_comercial` varchar(50) DEFAULT NULL,
  `telefone_celular` varchar(50) DEFAULT NULL,
  `abertura_empresa` date DEFAULT NULL,
  `optante_simples` tinyint(1) DEFAULT '0',
  `pais` varchar(100) DEFAULT NULL,
  `cep` varchar(15) DEFAULT NULL,
  `endereco` varchar(255) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `rua` varchar(50) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `observacoes` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `empresa_id` int NOT NULL,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `data_inicio` date DEFAULT NULL,
  `data_fim` date DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `regime_tributario` varchar(100) DEFAULT NULL,
  `tipo_inscricao` varchar(100) DEFAULT NULL,
  `sistema` varchar(100) DEFAULT NULL,
  `tipo` enum('Fixo','Eventual') DEFAULT 'Fixo',
  `status_complementar` varchar(100) DEFAULT NULL,
  `responsavel_legal` varchar(255) DEFAULT NULL,
  `base` varchar(100) DEFAULT NULL,
  `codigo` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes_campos_adicionais`
--

CREATE TABLE `clientes_campos_adicionais` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `campo_adicional_id` int NOT NULL,
  `valor` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes_dores`
--

CREATE TABLE `clientes_dores` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `dor` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes_grupos`
--

CREATE TABLE `clientes_grupos` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes_grupos_vinculo`
--

CREATE TABLE `clientes_grupos_vinculo` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `grupo_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `clientes_solucoes`
--

CREATE TABLE `clientes_solucoes` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `solucao` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cliente_respostas`
--

CREATE TABLE `cliente_respostas` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `resposta_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `comentarios_obrigacao`
--

CREATE TABLE `comentarios_obrigacao` (
  `id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `comentario` text NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo` varchar(100) DEFAULT NULL,
  `anexos` longblob
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `comentarios_tarefa`
--

CREATE TABLE `comentarios_tarefa` (
  `id` int NOT NULL,
  `tarefa_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `comentario` text NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `arquivo` longblob,
  `nome_arquivo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `conciliacoes`
--

CREATE TABLE `conciliacoes` (
  `id` int NOT NULL,
  `transacao_api_id` int DEFAULT NULL,
  `transacao_id` int DEFAULT NULL,
  `status` enum('conciliada','revogada','ignorada','pendente') DEFAULT 'pendente',
  `data_conciliacao` datetime DEFAULT NULL,
  `data_revogacao` datetime DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `observacao` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contas`
--

CREATE TABLE `contas` (
  `id` int NOT NULL,
  `api_id` varchar(255) DEFAULT NULL,
  `conector_id` varchar(255) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `status_execucao` varchar(100) DEFAULT NULL,
  `expiracao_consentimento` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `agencia` varchar(20) DEFAULT NULL,
  `conta` varchar(50) DEFAULT NULL,
  `senha` varchar(255) DEFAULT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `banco` varchar(150) DEFAULT NULL,
  `descricao_banco` varchar(255) DEFAULT NULL,
  `tipo_conta` varchar(50) DEFAULT NULL,
  `numero_conta` varchar(50) DEFAULT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `inter_cliente_id` varchar(255) DEFAULT NULL,
  `inter_cliente_secret` varchar(255) DEFAULT NULL,
  `inter_cert` text,
  `inter_key` text,
  `inter_conta_corrente` varchar(50) DEFAULT NULL,
  `inter_apelido` varchar(150) DEFAULT NULL,
  `inter_padrao` tinyint(1) DEFAULT '0',
  `inter_status` varchar(100) DEFAULT NULL,
  `inter_ativado` tinyint(1) DEFAULT '0',
  `inter_conta_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contas_inter`
--

CREATE TABLE `contas_inter` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `apelido` varchar(150) DEFAULT NULL,
  `conta_corrente` varchar(50) DEFAULT NULL,
  `cliente_id` varchar(255) NOT NULL,
  `cliente_secret` varchar(255) NOT NULL,
  `certificado` text,
  `key` text,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contas_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `conteudos`
--

CREATE TABLE `conteudos` (
  `id` int NOT NULL,
  `grupo_id` int NOT NULL,
  `tipo` enum('video','pdf','texto','quiz','link','outro') NOT NULL,
  `titulo` varchar(150) NOT NULL,
  `descricao` text,
  `url` text,
  `obrigatorio` tinyint(1) DEFAULT '1',
  `ordem` int DEFAULT '1',
  `ativo` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contratada`
--

CREATE TABLE `contratada` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `razao_social` varchar(255) DEFAULT NULL,
  `endereco` varchar(255) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `cep` varchar(15) DEFAULT NULL,
  `cnpj` varchar(18) DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `ativo` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contratos`
--

CREATE TABLE `contratos` (
  `id` int NOT NULL,
  `modelos_contrato_id` int DEFAULT NULL,
  `conteudo` longtext,
  `status` enum('pendente','assinado','cancelado','expirado','reprovado','rascunho') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pendente',
  `autentique` tinyint(1) DEFAULT '0',
  `autentique_id` varchar(255) DEFAULT NULL,
  `criado_por` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expirado_em` datetime DEFAULT NULL,
  `comeca_em` date DEFAULT NULL,
  `termina_em` date DEFAULT NULL,
  `pre_cliente_id` int DEFAULT NULL,
  `cliente_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `rejeitado_por` varchar(255) DEFAULT NULL,
  `pdf_download` varchar(500) DEFAULT NULL,
  `assinatura_download` varchar(500) DEFAULT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `valor_recorrente` decimal(15,2) DEFAULT '0.00',
  `desconto` decimal(15,2) DEFAULT '0.00',
  `observacoes` text,
  `produto_id` int DEFAULT NULL,
  `centro_custo_id` int DEFAULT NULL,
  `caixinha_id` int DEFAULT NULL,
  `conta_api_id` int DEFAULT NULL,
  `categoria_id` int DEFAULT NULL,
  `subcategoria_id` int DEFAULT NULL,
  `produtos_dados` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contrato_produto`
--

CREATE TABLE `contrato_produto` (
  `id` int NOT NULL,
  `contrato_id` int NOT NULL,
  `produto_id` int NOT NULL,
  `departamento_id` int DEFAULT NULL,
  `quantidade` int DEFAULT '1',
  `valor` decimal(15,2) DEFAULT '0.00',
  `desconto` decimal(15,2) DEFAULT '0.00',
  `observacoes` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `conversas`
--

CREATE TABLE `conversas` (
  `id` int NOT NULL,
  `times_atendimento_instancia_id` int NOT NULL,
  `nome` varchar(255) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `lead_id` int DEFAULT NULL,
  `status` enum('aberta','em andamento','fechada') DEFAULT 'aberta',
  `usuario_responsavel_id` int DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `conversas_transferencias`
--

CREATE TABLE `conversas_transferencias` (
  `id` int NOT NULL,
  `conversas_id` int NOT NULL,
  `de_usuario_id` int DEFAULT NULL,
  `para_usuario_id` int DEFAULT NULL,
  `transferido_por` varchar(255) DEFAULT NULL,
  `transferido_para` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_arquivos`
--

CREATE TABLE `crm_arquivos` (
  `id` int NOT NULL,
  `lead_id` int NOT NULL,
  `nome_arquivo` varchar(255) NOT NULL,
  `arquivo_url` varchar(500) NOT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `enviado_por` varchar(255) DEFAULT NULL,
  `data_envio` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_atividades`
--

CREATE TABLE `crm_atividades` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `observacao` text,
  `data` date DEFAULT NULL,
  `hora` time DEFAULT NULL,
  `duracao` int DEFAULT NULL,
  `tipo_id` int DEFAULT NULL,
  `status` enum('pendente','concluida') DEFAULT 'pendente',
  `lead_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_campos_personalizados`
--

CREATE TABLE `crm_campos_personalizados` (
  `id` int NOT NULL,
  `categoria_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `tipo` enum('texto','numero','data','lista','url','endereco') NOT NULL,
  `descricao` text,
  `opcoes` text,
  `obrigatorio` tinyint(1) DEFAULT '0',
  `ordem` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_categorias_personalizadas`
--

CREATE TABLE `crm_categorias_personalizadas` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `padrao` tinyint(1) DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_contatos`
--

CREATE TABLE `crm_contatos` (
  `id` int NOT NULL,
  `lead_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_empresa`
--

CREATE TABLE `crm_empresa` (
  `id` int NOT NULL,
  `lead_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `cnpj` varchar(18) DEFAULT NULL,
  `endereco` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_notas`
--

CREATE TABLE `crm_notas` (
  `id` int NOT NULL,
  `lead_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `conteudo` text NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_tipos_atividades`
--

CREATE TABLE `crm_tipos_atividades` (
  `id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `empresa_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `crm_valores_personalizados`
--

CREATE TABLE `crm_valores_personalizados` (
  `id` int NOT NULL,
  `lead_id` int NOT NULL,
  `campo_id` int NOT NULL,
  `valor` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `departamentos`
--

CREATE TABLE `departamentos` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `departamento_global_id` int DEFAULT NULL,
  `responsavel_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `departamentos_globais`
--

CREATE TABLE `departamentos_globais` (
  `id` int NOT NULL COMMENT 'ID único do departamento global',
  `nome` varchar(100) NOT NULL COMMENT 'Nome do departamento global (único)',
  `descricao` text COMMENT 'Descrição detalhada do departamento global',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora de criação',
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data e hora da última atualização'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tabela de departamentos globais que servem como template para departamentos das empresas';

-- --------------------------------------------------------

--
-- Estrutura para tabela `documentos`
--

CREATE TABLE `documentos` (
  `id` int NOT NULL,
  `modelos_contrato_id` int DEFAULT NULL,
  `conteudo` longtext,
  `status` enum('pendente','assinado','cancelado','expirado','reprovado','rascunho') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pendente',
  `autentique` tinyint(1) DEFAULT '0',
  `autentique_id` varchar(255) DEFAULT NULL,
  `criado_por` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expirado_em` datetime DEFAULT NULL,
  `comeca_em` date DEFAULT NULL,
  `termina_em` date DEFAULT NULL,
  `pre_cliente_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `rejeitado_por` varchar(255) DEFAULT NULL,
  `pdf_download` varchar(500) DEFAULT NULL,
  `assinatura_download` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `empresas`
--

CREATE TABLE `empresas` (
  `id` int NOT NULL,
  `cnpj` varchar(18) NOT NULL,
  `nome` varchar(150) NOT NULL,
  `razaoSocial` varchar(200) DEFAULT NULL,
  `admin_usuario_id` int DEFAULT NULL,
  `cep` varchar(9) DEFAULT NULL,
  `rua` varchar(150) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_referencia` date DEFAULT NULL,
  `status` enum('em implantação','produção','em atraso','suspenso','cancelado') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `situacao_conta` enum('ativo','inativo') NOT NULL,
  `cnae_primario` varchar(20) DEFAULT NULL,
  `cnae_descricao` text,
  `cnae_classe` varchar(50) DEFAULT NULL,
  `data_fundacao` date DEFAULT NULL,
  `regime_tributario` enum('simples','lucro real','lucro presumido','mei') DEFAULT NULL,
  `optante_mei` tinyint(1) DEFAULT NULL,
  `inscricao_municipal` varchar(50) DEFAULT NULL,
  `inscricao_estadual` varchar(50) DEFAULT NULL,
  `tipo_empresa` enum('franqueado','nao_franqueado','franqueadora','franqueado_nao_contador') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `pfx` text,
  `senhaPfx` text,
  `apiKey_ePlugin` text,
  `logo_url` text,
  `pesquisaSatisfacaoAtiva` tinyint(1) DEFAULT '0',
  `onvioLogin` text,
  `onvioSenha` text,
  `onvioCodigoAutenticacao` text,
  `onvioMfaSecret` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `empresas_conteudos`
--

CREATE TABLE `empresas_conteudos` (
  `empresa_id` int NOT NULL,
  `conteudo_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `status` enum('pendente','concluido') NOT NULL DEFAULT 'pendente',
  `concluido_em` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `empresas_grupos`
--

CREATE TABLE `empresas_grupos` (
  `empresa_id` int NOT NULL,
  `grupo_id` int NOT NULL,
  `status` enum('bloqueado','em_andamento','concluido') NOT NULL DEFAULT 'bloqueado',
  `concluido_em` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `enquete_grupos`
--

CREATE TABLE `enquete_grupos` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `classificacao` varchar(100) DEFAULT NULL,
  `titulo` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `enquete_perguntas`
--

CREATE TABLE `enquete_perguntas` (
  `id` int NOT NULL,
  `grupo_id` int NOT NULL,
  `texto` text NOT NULL,
  `tipo` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `enquete_respostas`
--

CREATE TABLE `enquete_respostas` (
  `id` int NOT NULL,
  `pergunta_id` int NOT NULL,
  `particularidade_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `etiquetas`
--

CREATE TABLE `etiquetas` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `cor` varchar(20) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `funil_fases`
--

CREATE TABLE `funil_fases` (
  `id` int NOT NULL,
  `funil_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `descricao` text,
  `ordem` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `funis`
--

CREATE TABLE `funis` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `padrao` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `grupos`
--

CREATE TABLE `grupos` (
  `id` int NOT NULL,
  `modulo_id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` mediumtext,
  `ordem` int DEFAULT '1',
  `ativo` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `historico_leads`
--

CREATE TABLE `historico_leads` (
  `id` int NOT NULL,
  `lead_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `tipo` enum('nota','atividade','movimentacao') NOT NULL,
  `titulo` varchar(255) DEFAULT NULL,
  `descricao` text,
  `referencia_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `historico_transferencias`
--

CREATE TABLE `historico_transferencias` (
  `id` int NOT NULL,
  `transferencia_id` int NOT NULL,
  `tipo` enum('entrada','saida') NOT NULL,
  `caixinha_id` int NOT NULL,
  `saldo_anterior` decimal(15,2) DEFAULT '0.00',
  `saldo_atual` decimal(15,2) DEFAULT '0.00',
  `data` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `instancias`
--

CREATE TABLE `instancias` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `instancia_nome` varchar(150) NOT NULL,
  `instancia_id` varchar(255) NOT NULL,
  `token` text NOT NULL,
  `cliente_token` text,
  `status` enum('desconectado','conectando','conectado') DEFAULT 'desconectado',
  `telefone` varchar(20) DEFAULT NULL,
  `ultimo_qr_code` text,
  `qr_expira_em` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `integracao_tipo` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `inter_tokens`
--

CREATE TABLE `inter_tokens` (
  `id` int NOT NULL,
  `acesso_token` text NOT NULL,
  `expiracao_local` datetime NOT NULL,
  `tipo_token` varchar(100) DEFAULT NULL,
  `escopo` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `inter_tokens_cache`
--

CREATE TABLE `inter_tokens_cache` (
  `id` int NOT NULL,
  `inter_conta_id` int NOT NULL,
  `token_acesso` text NOT NULL,
  `tipo_token` varchar(100) DEFAULT NULL,
  `escopo` text,
  `expira_em` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expiracao_local` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `leads`
--

CREATE TABLE `leads` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `notas_internas` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `usuario_id` int DEFAULT NULL,
  `empresa_id` int DEFAULT NULL,
  `funil_id` int DEFAULT NULL,
  `funil_fase_id` int DEFAULT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `status` enum('aberto','ganhou','perdeu') DEFAULT 'aberto',
  `data_prevista` date DEFAULT NULL,
  `temperatura` enum('frio','quente','neutro') DEFAULT 'neutro'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `leads_etiquetas`
--

CREATE TABLE `leads_etiquetas` (
  `id` int NOT NULL,
  `lead_id` int NOT NULL,
  `etiqueta_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `links_externos`
--

CREATE TABLE `links_externos` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `link` varchar(500) NOT NULL,
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `lista_signatarios`
--

CREATE TABLE `lista_signatarios` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `funcao_assinatura` enum('Aprovador','Assinar como parte','Assinar como testemunha','Assinar como administrador','Assinar como avalista','Assinar como contador','Assinar como cedente','Assinar como cessionário','Assinar como contratada','Assinar como contratante','Assinar como devedor','Assinar como emitente','Assinar como outorgante','Assinar como locador','Assinar como locatário','Assinar como outorgado','Assinar como endossante','Assinar como endossatário','Assinar como gestor','Assinar como interveniente','Assinar como parte compradora','Assinar como parte vendedora','Assinar como procurador','Assinar como advogado','Assinar como representante legal','Assinar como responsável solidário','Assinar como validador','Assinar para acusar recebimento','Assinar como segurado','Assinar como proponente','Assinar como corretor') DEFAULT 'Assinar como parte',
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `mensagens`
--

CREATE TABLE `mensagens` (
  `id` int NOT NULL,
  `conversas_id` int NOT NULL,
  `enviador_tipo` enum('usuario','cliente','agente') NOT NULL,
  `enviador_id` int DEFAULT NULL,
  `tipo_mensagem` enum('text','image','audio','file','video') DEFAULT 'text',
  `conteudo` text,
  `midia_url` varchar(500) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `lido` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `modelos_contrato`
--

CREATE TABLE `modelos_contrato` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `conteudo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `criado_por` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `global` tinyint(1) DEFAULT '0',
  `empresa_id` int DEFAULT NULL,
  `straton` tinyint(1) DEFAULT '0',
  `funcionario` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `modulos`
--

CREATE TABLE `modulos` (
  `id` int NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `logo_url` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `modulos_empresa`
--

CREATE TABLE `modulos_empresa` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `modulo_id` int NOT NULL,
  `status` enum('liberado','bloqueado','em_andamento') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes`
--

CREATE TABLE `obrigacoes` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `departamento_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `frequencia` varchar(50) DEFAULT NULL,
  `dia_semana` varchar(20) DEFAULT NULL,
  `acao_qtd_dias` int DEFAULT NULL,
  `meta_qtd_dias` int DEFAULT NULL,
  `meta_tipo_dias` varchar(50) DEFAULT NULL,
  `vencimento_tipo` varchar(50) DEFAULT NULL,
  `vencimento_dia` int DEFAULT NULL,
  `fato_gerador` varchar(255) DEFAULT NULL,
  `orgao` varchar(255) DEFAULT NULL,
  `gera_multa` tinyint(1) DEFAULT '0',
  `usar_relatorio` tinyint(1) DEFAULT '0',
  `reenviar_email` tinyint(1) DEFAULT '0',
  `data_criacao` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_atividades_clientes`
--

CREATE TABLE `obrigacoes_atividades_clientes` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `obrigacao_cliente_id` int NOT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `texto` text,
  `descricao` text,
  `tipo_cancelamento` varchar(100) DEFAULT NULL,
  `ordem` int DEFAULT NULL,
  `concluida` tinyint(1) DEFAULT '0',
  `cancelada` tinyint(1) DEFAULT '0',
  `justificativa` text,
  `data_conclusao` datetime DEFAULT NULL,
  `data_cancelamento` datetime DEFAULT NULL,
  `cancelado_por` int DEFAULT NULL,
  `concluido_por` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `anexo` longblob,
  `nome_arquivo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_clientes`
--

CREATE TABLE `obrigacoes_clientes` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `nome` varchar(255) DEFAULT NULL,
  `descricao` text,
  `status` enum('pendente','concluida','em_atraso','cancelada') DEFAULT 'pendente',
  `data_baixa` datetime DEFAULT NULL,
  `concluido_por` int DEFAULT NULL,
  `baixado_automaticamente` tinyint(1) DEFAULT '0',
  `data_criacao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_cancelamento` datetime DEFAULT NULL,
  `ano_referencia` int DEFAULT NULL,
  `mes_referencia` int DEFAULT NULL,
  `vencimento` date DEFAULT NULL,
  `acao` varchar(255) DEFAULT NULL,
  `meta` varchar(255) DEFAULT NULL,
  `responsavel_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_clientes_responsaveis`
--

CREATE TABLE `obrigacoes_clientes_responsaveis` (
  `id` int NOT NULL,
  `obrigacao_cliente_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_email_templates`
--

CREATE TABLE `obrigacoes_email_templates` (
  `id` int NOT NULL,
  `atividade_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `assunto` varchar(255) DEFAULT NULL,
  `corpo` text,
  `destinatario` text,
  `cc` text,
  `co` text,
  `variaveis` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_particularidades`
--

CREATE TABLE `obrigacoes_particularidades` (
  `id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `particularidade_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_responsaveis_cliente`
--

CREATE TABLE `obrigacoes_responsaveis_cliente` (
  `id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `obrigacoes_responsaveis_fixo`
--

CREATE TABLE `obrigacoes_responsaveis_fixo` (
  `id` int NOT NULL,
  `obrigacao_id` int NOT NULL,
  `usuario_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pago_recebido`
--

CREATE TABLE `pago_recebido` (
  `id` int NOT NULL,
  `tipo` enum('pago','recebido') NOT NULL,
  `empresa_id` int NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  `observacoes` text,
  `valor` decimal(15,2) DEFAULT '0.00',
  `vencimento` date DEFAULT NULL,
  `pago_recebido` tinyint(1) DEFAULT '0',
  `data_recebimento` date DEFAULT NULL,
  `data` date DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `categoria_id` int DEFAULT NULL,
  `transacoes_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `parcelamentos`
--

CREATE TABLE `parcelamentos` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `tipo` varchar(100) NOT NULL,
  `status` varchar(50) DEFAULT 'pendente',
  `valor_total` decimal(12,2) NOT NULL,
  `parcelas` int NOT NULL,
  `vencimento` date DEFAULT NULL,
  `data_atualizacao` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `numero` varchar(50) DEFAULT NULL,
  `guia_pdf` longblob
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `particularidades`
--

CREATE TABLE `particularidades` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `categoria` varchar(255) DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `descricao` text,
  `categoria_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `particularidades_categorias`
--

CREATE TABLE `particularidades_categorias` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pdf_layouts`
--

CREATE TABLE `pdf_layouts` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `departamento_id` int DEFAULT NULL,
  `status` enum('pendente','pronto') DEFAULT 'pendente',
  `versao` varchar(50) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `pdf` longblob,
  `empresa_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pdf_layout_campos`
--

CREATE TABLE `pdf_layout_campos` (
  `id` int NOT NULL,
  `layout_id` int NOT NULL,
  `tipo_campo` varchar(100) NOT NULL,
  `valor_esperado` varchar(255) DEFAULT NULL,
  `posicao_linha` int DEFAULT NULL,
  `posicao_coluna` int DEFAULT NULL,
  `regex_validacao` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pesquisas_satisfacao`
--

CREATE TABLE `pesquisas_satisfacao` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `data_envio` datetime DEFAULT NULL,
  `data_resposta` datetime DEFAULT NULL,
  `nota` int DEFAULT NULL,
  `comentario` text,
  `status` enum('enviado','respondido','sem_resposta') DEFAULT 'sem_resposta',
  `nps_classificacao` varchar(50) DEFAULT NULL,
  `token` varchar(255) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pesquisas_satisfacao_franqueados`
--

CREATE TABLE `pesquisas_satisfacao_franqueados` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `franqueado_id` int NOT NULL,
  `token` varchar(48) NOT NULL,
  `status` enum('enviado','respondido','expirado') DEFAULT 'enviado',
  `data_envio` datetime DEFAULT NULL,
  `data_resposta` datetime DEFAULT NULL,
  `nota_satisfacao_geral` int DEFAULT NULL,
  `comentario_geral` text,
  `nota_atendimento` int DEFAULT NULL,
  `comentario_atendimento` text,
  `nota_ti` int DEFAULT NULL,
  `comentario_ti` text,
  `nota_parceiros` int DEFAULT NULL,
  `comentario_parceiros` text,
  `utiliza_backoffice_pessoal` tinyint(1) DEFAULT '0',
  `utiliza_backoffice_fiscal` tinyint(1) DEFAULT '0',
  `utiliza_backoffice_contabil` tinyint(1) DEFAULT '0',
  `nao_utiliza_backoffice` tinyint(1) DEFAULT '0',
  `nota_dep_pessoal` int DEFAULT NULL,
  `comentario_pessoal` text,
  `nota_demanda_pessoal` int DEFAULT NULL,
  `nota_dep_fiscal` int DEFAULT NULL,
  `comentario_fiscal` text,
  `nota_demanda_fiscal` int DEFAULT NULL,
  `nota_dep_contabil` int DEFAULT NULL,
  `comentario_contabil` text,
  `nota_demanda_contabil` int DEFAULT NULL,
  `nps_classificacao` enum('sala_vermelha','sala_amarela','sala_verde') DEFAULT 'sala_vermelha',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `playbooks`
--

CREATE TABLE `playbooks` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `conteudo` text NOT NULL,
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pre_clientes`
--

CREATE TABLE `pre_clientes` (
  `id` int NOT NULL,
  `tipo` enum('pessoa_fisica','empresa') NOT NULL,
  `nome` varchar(255) NOT NULL,
  `cpf_cnpj` varchar(18) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `endereco` varchar(255) DEFAULT NULL,
  `cep` varchar(15) DEFAULT NULL,
  `numero` varchar(10) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `rg` varchar(20) DEFAULT NULL,
  `estado_civil` varchar(50) DEFAULT NULL,
  `profissao` varchar(100) DEFAULT NULL,
  `sexo` enum('masculino','feminino','outro') DEFAULT NULL,
  `nacionalidade` varchar(100) DEFAULT NULL,
  `representante` varchar(255) DEFAULT NULL,
  `funcao` varchar(100) DEFAULT NULL,
  `funcionario` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = não é funcionário; 1 = é funcionário',
  `lead_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `departamento_id` int DEFAULT NULL,
  `cargo_id` int DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Estrutura para tabela `processos`
--

CREATE TABLE `processos` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `departamento_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `data_referencia` date DEFAULT NULL,
  `dias_meta` int DEFAULT NULL,
  `dias_prazo` int DEFAULT NULL,
  `notificar_abertura` tinyint(1) DEFAULT '0',
  `notificar_finalizacao` tinyint(1) DEFAULT '0',
  `pode_finalizar_antes_subatendimentos` tinyint(1) DEFAULT '0',
  `responsavel_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `padrao_franqueadora` tinyint(1) DEFAULT '0',
  `departamento_global_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `processos_email_templates`
--

CREATE TABLE `processos_email_templates` (
  `id` int NOT NULL,
  `empresa_id` int DEFAULT NULL,
  `atividade_id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `assunto` varchar(255) DEFAULT NULL,
  `corpo` text,
  `destinatario` text,
  `cc` text,
  `co` text,
  `variaveis` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `processos_vinculos`
--

CREATE TABLE `processos_vinculos` (
  `id` int NOT NULL,
  `processo_pai_id` int NOT NULL,
  `processo_filho_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `produtos`
--

CREATE TABLE `produtos` (
  `id` int NOT NULL,
  `codigo` varchar(100) DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `descricao` text,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `empresa_id` int DEFAULT NULL,
  `global` tinyint(1) DEFAULT '0',
  `tipo` enum('servico','produto') DEFAULT 'produto',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `produto_lead`
--

CREATE TABLE `produto_lead` (
  `id` int NOT NULL,
  `produto_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `valor_id_venda` decimal(15,2) DEFAULT '0.00',
  `desconto` decimal(15,2) DEFAULT '0.00',
  `quantidade` int DEFAULT '1',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `prova`
--

CREATE TABLE `prova` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `conteudo_id` int DEFAULT NULL,
  `grupo_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `prova_empresa`
--

CREATE TABLE `prova_empresa` (
  `id` int NOT NULL,
  `prova_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `viewer_id` int NOT NULL,
  `nota` decimal(5,2) DEFAULT NULL
) ;

-- --------------------------------------------------------

--
-- Estrutura para tabela `questao`
--

CREATE TABLE `questao` (
  `id` int NOT NULL,
  `prova_id` int NOT NULL,
  `enunciado` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `recorrencias`
--

CREATE TABLE `recorrencias` (
  `id` int NOT NULL,
  `frequencia` enum('diaria','semanal','mensal','anual') NOT NULL,
  `total_parcelas` int DEFAULT NULL,
  `indeterminada` tinyint(1) DEFAULT '0',
  `intervalo_personalizado` int DEFAULT NULL,
  `tipo_intervalo` enum('dias','semanas','meses','anos') DEFAULT NULL,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `recorrencias_vendas`
--

CREATE TABLE `recorrencias_vendas` (
  `id` int NOT NULL,
  `contrato_id` int DEFAULT NULL,
  `tipo_intervalo` enum('dias','semanas','meses','anos') NOT NULL,
  `intervalo` int NOT NULL DEFAULT '1',
  `indeterminado` tinyint(1) DEFAULT '0',
  `total_ciclos` int DEFAULT NULL,
  `status` enum('ativo','pausado','encerrado') DEFAULT 'ativo',
  `tipo_origem` enum('contrato','venda') NOT NULL DEFAULT 'contrato',
  `venda_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `redefinir_senha`
--

CREATE TABLE `redefinir_senha` (
  `id` int NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `codigo` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `usado` tinyint(1) NOT NULL DEFAULT '0',
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `serpro_requisicoes`
--

CREATE TABLE `serpro_requisicoes` (
  `id` bigint UNSIGNED NOT NULL,
  `empresa_id` int NOT NULL,
  `cnpj_empresa` varchar(14) NOT NULL,
  `tipo_operacao` varchar(100) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) NOT NULL,
  `detalhes` text,
  `custo` decimal(10,2) DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `signatarios`
--

CREATE TABLE `signatarios` (
  `id` int NOT NULL,
  `contrato_id` int DEFAULT NULL,
  `documento_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `telefone` varchar(50) DEFAULT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `token_acesso` varchar(255) DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `public_id` varchar(255) DEFAULT NULL,
  `funcao_assinatura` enum('Aprovador','Assinar como parte','Assinar como testemunha','Assinar como administrador','Assinar como avalista','Assinar como contador','Assinar como cedente','Assinar como cessionário','Assinar como contratada','Assinar como contratante','Assinar como devedor','Assinar como emitente','Assinar como outorgante','Assinar como locador','Assinar como locatário','Assinar como outorgado','Assinar como endossante','Assinar como endossatário','Assinar como gestor','Assinar como interveniente','Assinar como parte compradora','Assinar como parte vendedora','Assinar como procurador','Assinar como advogado','Assinar como representante legal','Assinar como responsável solidário','Assinar como validador','Assinar para acusar recebimento','Assinar como segurado','Assinar como proponente','Assinar como corretor') DEFAULT 'Assinar como parte',
  `assinado_em` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `sitfis`
--

CREATE TABLE `sitfis` (
  `id` int NOT NULL,
  `cliente_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `binary_file` longblob,
  `status` varchar(50) DEFAULT NULL,
  `pendencias` text,
  `data_criacao` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `straton_categorias`
--

CREATE TABLE `straton_categorias` (
  `id` int NOT NULL,
  `empresa_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `tipo_id` int NOT NULL,
  `ordem` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `padrao` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `straton_subcategorias`
--

CREATE TABLE `straton_subcategorias` (
  `id` int NOT NULL,
  `empresa_id` int DEFAULT NULL,
  `nome` varchar(255) NOT NULL,
  `categoria_id` int NOT NULL,
  `ordem` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `padrao` tinyint(1) DEFAULT '0',
  `dre` varchar(255) DEFAULT NULL,
  `mostrar_dre` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `tarefas`
--

CREATE TABLE `tarefas` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `departamento_id` int DEFAULT NULL,
  `processo_id` int DEFAULT NULL,
  `atividade_id` int DEFAULT NULL,
  `cliente_id` int DEFAULT NULL,
  `assunto` varchar(255) NOT NULL,
  `data_acao` date DEFAULT NULL,
  `data_meta` date DEFAULT NULL,
  `data_prazo` date DEFAULT NULL,
  `descricao` text,
  `responsavel_id` int DEFAULT NULL,
  `anexos` longblob,
  `pode_finalizar_antes_subatendimento` tinyint(1) DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) DEFAULT 'pendente',
  `tarefa_pai_id` int DEFAULT NULL,
  `data_conclusao` datetime DEFAULT NULL,
  `data_cancelamento` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `times_atendimento`
--

CREATE TABLE `times_atendimento` (
  `id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `padrao` tinyint(1) DEFAULT '0',
  `empresa_id` int NOT NULL,
  `departamento_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `times_atendimento_instancias`
--

CREATE TABLE `times_atendimento_instancias` (
  `id` int NOT NULL,
  `times_atendimento_id` int NOT NULL,
  `instancia_id` int NOT NULL,
  `nivel_acesso` enum('leitura','total') DEFAULT 'leitura',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `times_atendimento_usuarios`
--

CREATE TABLE `times_atendimento_usuarios` (
  `id` int NOT NULL,
  `times_atendimento_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `role` enum('Supervisor','Usuario') DEFAULT 'Usuario',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `tipos`
--

CREATE TABLE `tipos` (
  `id` int NOT NULL,
  `nome` varchar(255) NOT NULL,
  `empresa_id` int NOT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `padrao` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `transacoes`
--

CREATE TABLE `transacoes` (
  `id` int NOT NULL,
  `caixinha_id` int DEFAULT NULL,
  `conta_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `tipo` enum('entrada','saida') NOT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `descricao` varchar(500) DEFAULT NULL,
  `data_transacao` date DEFAULT NULL,
  `origem` varchar(100) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_vencimento` date DEFAULT NULL,
  `situacao` enum('em aberto','recebido','vencidos','conciliado') DEFAULT 'em aberto',
  `observacao` text,
  `parcelamento` int DEFAULT NULL,
  `intervalo_parcelas` int DEFAULT NULL,
  `anexo` varchar(500) DEFAULT NULL,
  `categoria_id` int DEFAULT NULL,
  `subcategoria_id` int DEFAULT NULL,
  `centro_custo_id` int DEFAULT NULL,
  `pluggy_transacao_id` varchar(255) DEFAULT NULL,
  `recorrencia_id` int DEFAULT NULL,
  `boleto_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `transacoes_api`
--

CREATE TABLE `transacoes_api` (
  `id` int NOT NULL,
  `pluggy_transacao_id` varchar(255) DEFAULT NULL,
  `conta_id` int DEFAULT NULL,
  `descricao` varchar(500) DEFAULT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `moeda` varchar(10) DEFAULT NULL,
  `data` datetime DEFAULT NULL,
  `categoria` varchar(255) DEFAULT NULL,
  `situacao` enum('em aberto','recebido','vencidos','ignorada') DEFAULT 'em aberto',
  `anexo` varchar(500) DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `contas_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `transferencias_caixinha`
--

CREATE TABLE `transferencias_caixinha` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `caixinha_id` int NOT NULL,
  `transferencia_caixinha_id` int NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) DEFAULT '0.00',
  `data_transferencia` date DEFAULT NULL,
  `anexo` varchar(500) DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `user_notifications`
--

CREATE TABLE `user_notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `empresa_id` bigint UNSIGNED DEFAULT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `data_json` json DEFAULT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` bigint UNSIGNED DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `senha` text NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `avatar_url` text,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('ativo','inativo') NOT NULL,
  `preferencias` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `usuarios_empresas`
--

CREATE TABLE `usuarios_empresas` (
  `id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `cargo_id` int DEFAULT NULL,
  `departamento_id` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `variaveis_personalizadas`
--

CREATE TABLE `variaveis_personalizadas` (
  `id` int NOT NULL,
  `empresa_id` int DEFAULT NULL,
  `variavel` varchar(100) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `global` tinyint(1) DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `vendas`
--

CREATE TABLE `vendas` (
  `id` int NOT NULL,
  `numero_venda` varchar(100) DEFAULT NULL,
  `tipo_venda` enum('orcamento','venda avulsa','venda recorrente','recorrente','mensal','anual','contrato') NOT NULL DEFAULT 'orcamento',
  `cliente_id` int DEFAULT NULL,
  `categoria_id` int DEFAULT NULL,
  `subcategoria_id` int DEFAULT NULL,
  `produtos_id` int DEFAULT NULL,
  `empresa_id` int NOT NULL,
  `centro_custo_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `data_venda` date DEFAULT NULL,
  `situacao` enum('orcamento','venda avulsa','venda recorrente','aprovado','ativo','pago','cancelado','pendente','processado','vencido') NOT NULL DEFAULT 'orcamento',
  `valor_venda` decimal(15,2) DEFAULT '0.00',
  `desconto_venda` decimal(15,2) DEFAULT '0.00',
  `pagamento` varchar(100) DEFAULT NULL,
  `conta_recebimento_api` varchar(255) DEFAULT NULL,
  `parcelamento` int DEFAULT NULL,
  `vencimento` date DEFAULT NULL,
  `natureza` varchar(100) DEFAULT NULL,
  `observacoes` text,
  `observacoes_fiscais` text,
  `boleto_id` int DEFAULT NULL,
  `contrato_id` int DEFAULT NULL,
  `mes_referencia` int DEFAULT NULL,
  `ano_referencia` int DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `webhooks`
--

CREATE TABLE `webhooks` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nome` varchar(150) NOT NULL,
  `url` varchar(500) NOT NULL,
  `eventos_tipos` text NOT NULL,
  `status` enum('ativo','inativo') DEFAULT 'ativo',
  `ultimo_sucesso_em` datetime DEFAULT NULL,
  `ultimo_erro_em` datetime DEFAULT NULL,
  `erro_quantidade` int DEFAULT '0',
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `webhook_eventos`
--

CREATE TABLE `webhook_eventos` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `webhook_id` int NOT NULL,
  `tipo` varchar(150) NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','delivery','delivered','failed') DEFAULT 'pending',
  `tentativas` int DEFAULT '0',
  `proxima_tentativa_em` datetime DEFAULT NULL,
  `ultimo_erro_em` datetime DEFAULT NULL,
  `criado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `alternativa`
--
ALTER TABLE `alternativa`
  ADD PRIMARY KEY (`id`),
  ADD KEY `alternativa_ibfk_1` (`questao_id`);

--
-- Índices de tabela `anexos_atividade`
--
ALTER TABLE `anexos_atividade`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_anexos_atividade_tarefa` (`atividade_tarefa_id`);

--
-- Índices de tabela `api_keys`
--
ALTER TABLE `api_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `chave` (`chave`);

--
-- Índices de tabela `arquivos_baixados_automaticamente`
--
ALTER TABLE `arquivos_baixados_automaticamente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_abaixados_empresa` (`empresa_id`),
  ADD KEY `fk_abaixados_cliente` (`cliente_id`);

--
-- Índices de tabela `assinaturas`
--
ALTER TABLE `assinaturas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_assinaturas_contratos` (`contrato_id`),
  ADD KEY `fk_assinaturas_documentos` (`documento_id`),
  ADD KEY `fk_assinaturas_signatarios` (`signatario_id`);

--
-- Índices de tabela `atividades_obrigacao`
--
ALTER TABLE `atividades_obrigacao`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_atividades_obrigacao_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_atividades_obrigacao_layout` (`pdf_layout_id`);

--
-- Índices de tabela `atividades_processo`
--
ALTER TABLE `atividades_processo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_atividades_processo` (`processo_id`),
  ADD KEY `fk_atividades_processo_empresa` (`empresa_id`);

--
-- Índices de tabela `atividades_tarefas`
--
ALTER TABLE `atividades_tarefas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_atividades_tarefa_tarefa` (`tarefa_id`),
  ADD KEY `fk_atividades_tarefa_atividade` (`atividade_id`),
  ADD KEY `fk_atividades_tarefa_concluido` (`concluido_por`);

--
-- Índices de tabela `boletos`
--
ALTER TABLE `boletos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_boletos_empresas` (`empresa_id`),
  ADD KEY `fk_boletos_inter_conta` (`inter_conta_id`),
  ADD KEY `fk_boletos_contratos` (`contrato_id`),
  ADD KEY `idx_boletos_status` (`status`),
  ADD KEY `idx_boletos_venc` (`data_vencimento`),
  ADD KEY `fk_boletos_vendas` (`venda_id`);

--
-- Índices de tabela `boletos_historico`
--
ALTER TABLE `boletos_historico`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_boletos_historico_boletos` (`boleto_id`);

--
-- Índices de tabela `boleto_drafts`
--
ALTER TABLE `boleto_drafts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_boleto_drafts_usuarios` (`usuario_id`),
  ADD KEY `fk_boleto_drafts_empresas` (`empresa_id`);

--
-- Índices de tabela `caixinha`
--
ALTER TABLE `caixinha`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_caixinha_empresas` (`empresa_id`),
  ADD KEY `fk_caixinha_clientes` (`cliente_id`);

--
-- Índices de tabela `campos_adicionais`
--
ALTER TABLE `campos_adicionais`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_campos_empresa` (`empresa_id`);

--
-- Índices de tabela `captura_boletos`
--
ALTER TABLE `captura_boletos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_captura_boletos_usuarios` (`usuario_id`),
  ADD KEY `fk_captura_boletos_empresas` (`empresa_id`);

--
-- Índices de tabela `cargos`
--
ALTER TABLE `cargos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Índices de tabela `centro_custo`
--
ALTER TABLE `centro_custo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_centro_custo_empresas` (`empresa_id`);

--
-- Índices de tabela `certificados_clientes`
--
ALTER TABLE `certificados_clientes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_certificados_cliente` (`cliente_id`);

--
-- Índices de tabela `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_empresas` (`empresa_id`);

--
-- Índices de tabela `clientes_campos_adicionais`
--
ALTER TABLE `clientes_campos_adicionais`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_campos_cliente` (`cliente_id`),
  ADD KEY `fk_clientes_campos_campo` (`campo_adicional_id`);

--
-- Índices de tabela `clientes_dores`
--
ALTER TABLE `clientes_dores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_dores_cliente` (`cliente_id`);

--
-- Índices de tabela `clientes_grupos`
--
ALTER TABLE `clientes_grupos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_grupos_empresa` (`empresa_id`);

--
-- Índices de tabela `clientes_grupos_vinculo`
--
ALTER TABLE `clientes_grupos_vinculo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_vinculo_cliente` (`cliente_id`),
  ADD KEY `fk_clientes_vinculo_grupo` (`grupo_id`);

--
-- Índices de tabela `clientes_solucoes`
--
ALTER TABLE `clientes_solucoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_clientes_solucoes_cliente` (`cliente_id`);

--
-- Índices de tabela `cliente_respostas`
--
ALTER TABLE `cliente_respostas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cliente_respostas_cliente` (`cliente_id`);

--
-- Índices de tabela `comentarios_obrigacao`
--
ALTER TABLE `comentarios_obrigacao`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_comentarios_obrigacao_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_comentarios_obrigacao_usuario` (`usuario_id`);

--
-- Índices de tabela `comentarios_tarefa`
--
ALTER TABLE `comentarios_tarefa`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_comentarios_tarefa_tarefa` (`tarefa_id`),
  ADD KEY `fk_comentarios_tarefa_usuario` (`usuario_id`);

--
-- Índices de tabela `conciliacoes`
--
ALTER TABLE `conciliacoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_conciliacoes_transacao_api` (`transacao_api_id`),
  ADD KEY `fk_conciliacoes_transacao` (`transacao_id`),
  ADD KEY `fk_conciliacoes_usuario` (`usuario_id`);

--
-- Índices de tabela `contas`
--
ALTER TABLE `contas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_contas_empresas` (`empresa_id`),
  ADD KEY `fk_contas_clientes` (`cliente_id`),
  ADD KEY `fk_contas_inter` (`inter_conta_id`);

--
-- Índices de tabela `contas_inter`
--
ALTER TABLE `contas_inter`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_contas_inter_empresas` (`empresa_id`),
  ADD KEY `fk_contas_inter_contas` (`contas_id`);

--
-- Índices de tabela `conteudos`
--
ALTER TABLE `conteudos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `grupo_id` (`grupo_id`);

--
-- Índices de tabela `contratada`
--
ALTER TABLE `contratada`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_contratada_empresas` (`empresa_id`);

--
-- Índices de tabela `contratos`
--
ALTER TABLE `contratos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ccontratos_clientes` (`cliente_id`),
  ADD KEY `fk_contratos_centro_custo` (`centro_custo_id`),
  ADD KEY `fk_contratos_empresas` (`empresa_id`),
  ADD KEY `fk_contratos_modelos` (`modelos_contrato_id`),
  ADD KEY `fk_contratos_pre_clientes` (`pre_cliente_id`),
  ADD KEY `fk_contratos_produtos` (`produto_id`);

--
-- Índices de tabela `contrato_produto`
--
ALTER TABLE `contrato_produto`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_contrato_produto_depart` (`contrato_id`,`produto_id`,`departamento_id`),
  ADD KEY `fk_cp_produto` (`produto_id`),
  ADD KEY `fk_cp_departamento` (`departamento_id`);

--
-- Índices de tabela `conversas`
--
ALTER TABLE `conversas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_conversas_times_instancias` (`times_atendimento_instancia_id`),
  ADD KEY `fk_conversas_leads` (`lead_id`),
  ADD KEY `fk_conversas_usuarios` (`usuario_responsavel_id`);

--
-- Índices de tabela `conversas_transferencias`
--
ALTER TABLE `conversas_transferencias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ct_conversas` (`conversas_id`),
  ADD KEY `fk_ct_de_usuario` (`de_usuario_id`),
  ADD KEY `fk_ct_para_usuario` (`para_usuario_id`);

--
-- Índices de tabela `crm_arquivos`
--
ALTER TABLE `crm_arquivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_arquivos_leads` (`lead_id`);

--
-- Índices de tabela `crm_atividades`
--
ALTER TABLE `crm_atividades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_atividades_tipos` (`tipo_id`),
  ADD KEY `fk_crm_atividades_leads` (`lead_id`);

--
-- Índices de tabela `crm_campos_personalizados`
--
ALTER TABLE `crm_campos_personalizados`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_campos_personalizados_categoria` (`categoria_id`);

--
-- Índices de tabela `crm_categorias_personalizadas`
--
ALTER TABLE `crm_categorias_personalizadas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_categorias_personalizadas_empresas` (`empresa_id`);

--
-- Índices de tabela `crm_contatos`
--
ALTER TABLE `crm_contatos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_contatos_leads` (`lead_id`),
  ADD KEY `fk_crm_contatos_empresas` (`empresa_id`);

--
-- Índices de tabela `crm_empresa`
--
ALTER TABLE `crm_empresa`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_empresa_leads` (`lead_id`);

--
-- Índices de tabela `crm_notas`
--
ALTER TABLE `crm_notas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_notas_leads` (`lead_id`),
  ADD KEY `fk_crm_notas_usuarios` (`usuario_id`);

--
-- Índices de tabela `crm_tipos_atividades`
--
ALTER TABLE `crm_tipos_atividades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_crm_tipos_atividades_empresas` (`empresa_id`);

--
-- Índices de tabela `crm_valores_personalizados`
--
ALTER TABLE `crm_valores_personalizados`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lead_campo` (`lead_id`,`campo_id`),
  ADD KEY `fk_valores_personalizados_campos` (`campo_id`);

--
-- Índices de tabela `departamentos`
--
ALTER TABLE `departamentos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_nome_empresa` (`empresa_id`,`nome`),
  ADD KEY `idx_empresa_id` (`empresa_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_departamento_global_id` (`departamento_global_id`),
  ADD KEY `idx_responsavel_id` (`responsavel_id`);

--
-- Índices de tabela `departamentos_globais`
--
ALTER TABLE `departamentos_globais`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nome` (`nome`),
  ADD KEY `idx_nome` (`nome`),
  ADD KEY `idx_criado_em` (`criado_em`);

--
-- Índices de tabela `documentos`
--
ALTER TABLE `documentos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_documentos_modelos` (`modelos_contrato_id`),
  ADD KEY `fk_documentos_pre_clientes` (`pre_cliente_id`),
  ADD KEY `fk_documentos_empresas` (`empresa_id`);

--
-- Índices de tabela `empresas`
--
ALTER TABLE `empresas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cnpj` (`cnpj`),
  ADD KEY `fk_empresas_admin` (`admin_usuario_id`);

--
-- Índices de tabela `empresas_conteudos`
--
ALTER TABLE `empresas_conteudos`
  ADD PRIMARY KEY (`empresa_id`,`conteudo_id`),
  ADD KEY `conteudo_id` (`conteudo_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Índices de tabela `empresas_grupos`
--
ALTER TABLE `empresas_grupos`
  ADD PRIMARY KEY (`empresa_id`,`grupo_id`),
  ADD KEY `grupo_id` (`grupo_id`);

--
-- Índices de tabela `enquete_grupos`
--
ALTER TABLE `enquete_grupos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_enquete_grupos_empresa` (`empresa_id`);

--
-- Índices de tabela `enquete_perguntas`
--
ALTER TABLE `enquete_perguntas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_enquete_perguntas_grupo` (`grupo_id`);

--
-- Índices de tabela `enquete_respostas`
--
ALTER TABLE `enquete_respostas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_enquete_respostas_pergunta` (`pergunta_id`),
  ADD KEY `fk_enquete_respostas_particularidade` (`particularidade_id`);

--
-- Índices de tabela `etiquetas`
--
ALTER TABLE `etiquetas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_etiquetas_empresas` (`empresa_id`);

--
-- Índices de tabela `funil_fases`
--
ALTER TABLE `funil_fases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_funil_fases_funis` (`funil_id`);

--
-- Índices de tabela `funis`
--
ALTER TABLE `funis`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_funis_empresas` (`empresa_id`);

--
-- Índices de tabela `grupos`
--
ALTER TABLE `grupos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `modulo_id` (`modulo_id`);

--
-- Índices de tabela `historico_leads`
--
ALTER TABLE `historico_leads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_hl_leads` (`lead_id`),
  ADD KEY `fk_hl_usuarios` (`usuario_id`);

--
-- Índices de tabela `historico_transferencias`
--
ALTER TABLE `historico_transferencias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_hist_transf_transferencias` (`transferencia_id`),
  ADD KEY `fk_hist_transf_caixinha` (`caixinha_id`);

--
-- Índices de tabela `instancias`
--
ALTER TABLE `instancias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_instancias_empresas` (`empresa_id`);

--
-- Índices de tabela `inter_tokens`
--
ALTER TABLE `inter_tokens`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `inter_tokens_cache`
--
ALTER TABLE `inter_tokens_cache`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_inter_tokens_cache_contas_inter` (`inter_conta_id`),
  ADD KEY `fk_inter_tokens_cache_expiracao` (`expiracao_local`);

--
-- Índices de tabela `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_leads_usuarios` (`usuario_id`),
  ADD KEY `fk_leads_empresas` (`empresa_id`),
  ADD KEY `fk_leads_funis` (`funil_id`),
  ADD KEY `fk_leads_funil_fases` (`funil_fase_id`);

--
-- Índices de tabela `leads_etiquetas`
--
ALTER TABLE `leads_etiquetas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lead_etiqueta` (`lead_id`,`etiqueta_id`),
  ADD KEY `fk_leads_etiquetas_etiquetas` (`etiqueta_id`);

--
-- Índices de tabela `links_externos`
--
ALTER TABLE `links_externos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_links_externos_empresas` (`empresa_id`);

--
-- Índices de tabela `lista_signatarios`
--
ALTER TABLE `lista_signatarios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_lista_signatarios_empresas` (`empresa_id`);

--
-- Índices de tabela `mensagens`
--
ALTER TABLE `mensagens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_mensagens_conversas` (`conversas_id`),
  ADD KEY `fk_mensagens_usuarios` (`enviador_id`);

--
-- Índices de tabela `modelos_contrato`
--
ALTER TABLE `modelos_contrato`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_modelos_contrato_empresas` (`empresa_id`);

--
-- Índices de tabela `modulos`
--
ALTER TABLE `modulos`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `modulos_empresa`
--
ALTER TABLE `modulos_empresa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `empresa_id` (`empresa_id`,`modulo_id`),
  ADD KEY `fk_modulos_empresa_modulo` (`modulo_id`);

--
-- Índices de tabela `obrigacoes`
--
ALTER TABLE `obrigacoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_empresa` (`empresa_id`),
  ADD KEY `fk_obrigacoes_departamento` (`departamento_id`);

--
-- Índices de tabela `obrigacoes_atividades_clientes`
--
ALTER TABLE `obrigacoes_atividades_clientes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_atividades_cliente` (`cliente_id`),
  ADD KEY `fk_obrigacoes_atividades_obrigacao` (`obrigacao_cliente_id`),
  ADD KEY `fk_obrigacoes_atividades_cancelado` (`cancelado_por`),
  ADD KEY `fk_obrigacoes_atividades_concluido` (`concluido_por`);

--
-- Índices de tabela `obrigacoes_clientes`
--
ALTER TABLE `obrigacoes_clientes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_clientes_cliente` (`cliente_id`),
  ADD KEY `fk_obrigacoes_clientes_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_obrigacoes_clientes_concluido` (`concluido_por`),
  ADD KEY `fk_obrigacoes_clientes_responsavel` (`responsavel_id`);

--
-- Índices de tabela `obrigacoes_clientes_responsaveis`
--
ALTER TABLE `obrigacoes_clientes_responsaveis`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_responsavel_obrigacao` (`obrigacao_cliente_id`),
  ADD KEY `fk_obrigacoes_responsavel_usuario` (`usuario_id`);

--
-- Índices de tabela `obrigacoes_email_templates`
--
ALTER TABLE `obrigacoes_email_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_email_template_atividade` (`atividade_id`);

--
-- Índices de tabela `obrigacoes_particularidades`
--
ALTER TABLE `obrigacoes_particularidades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_particularidade_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_obrigacoes_particularidade_particularidade` (`particularidade_id`);

--
-- Índices de tabela `obrigacoes_responsaveis_cliente`
--
ALTER TABLE `obrigacoes_responsaveis_cliente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_resp_cliente_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_obrigacoes_resp_cliente_cliente` (`cliente_id`),
  ADD KEY `fk_obrigacoes_resp_cliente_usuario` (`usuario_id`);

--
-- Índices de tabela `obrigacoes_responsaveis_fixo`
--
ALTER TABLE `obrigacoes_responsaveis_fixo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_obrigacoes_responsaveis_fixo_obrigacao` (`obrigacao_id`),
  ADD KEY `fk_obrigacoes_responsaveis_fixo_usuario` (`usuario_id`);

--
-- Índices de tabela `pago_recebido`
--
ALTER TABLE `pago_recebido`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pago_recebido_empresas` (`empresa_id`),
  ADD KEY `fk_pago_recebido_categorias` (`categoria_id`),
  ADD KEY `fk_pago_recebido_transacoes` (`transacoes_id`);

--
-- Índices de tabela `parcelamentos`
--
ALTER TABLE `parcelamentos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_parcelamentos_cliente` (`cliente_id`),
  ADD KEY `fk_parcelamentos_empresa` (`empresa_id`);

--
-- Índices de tabela `particularidades`
--
ALTER TABLE `particularidades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_particularidades_empresa` (`empresa_id`),
  ADD KEY `fk_particularidades_categoria` (`categoria_id`);

--
-- Índices de tabela `particularidades_categorias`
--
ALTER TABLE `particularidades_categorias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_particularidades_categorias_empresa` (`empresa_id`);

--
-- Índices de tabela `pdf_layouts`
--
ALTER TABLE `pdf_layouts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pdf_layout_departamento` (`departamento_id`),
  ADD KEY `fk_pdf_layout_empresa` (`empresa_id`);

--
-- Índices de tabela `pdf_layout_campos`
--
ALTER TABLE `pdf_layout_campos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pdf_layout_campos_layout` (`layout_id`);

--
-- Índices de tabela `pesquisas_satisfacao`
--
ALTER TABLE `pesquisas_satisfacao`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `fk_pesquisa_empresa` (`empresa_id`),
  ADD KEY `fk_pesquisa_cliente` (`cliente_id`);

--
-- Índices de tabela `pesquisas_satisfacao_franqueados`
--
ALTER TABLE `pesquisas_satisfacao_franqueados`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pesq_franqueadora` (`empresa_id`),
  ADD KEY `fk_pesq_franqueado` (`franqueado_id`);

--
-- Índices de tabela `playbooks`
--
ALTER TABLE `playbooks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_playbooks_empresas` (`empresa_id`);

--
-- Índices de tabela `pre_clientes`
--
ALTER TABLE `pre_clientes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pre_clientes_leads` (`lead_id`),
  ADD KEY `fk_pre_clientes_empresas` (`empresa_id`),
  ADD KEY `idx_pre_clientes_funcionario` (`funcionario`),
  ADD KEY `fk_pre_clientes_departamento` (`departamento_id`),
  ADD KEY `fk_pre_clientes_cargo` (`cargo_id`);

--
-- Índices de tabela `processos`
--
ALTER TABLE `processos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_processos_empresa` (`empresa_id`),
  ADD KEY `fk_processos_departamento` (`departamento_id`),
  ADD KEY `fk_processos_responsavel` (`responsavel_id`),
  ADD KEY `fk_processos_departamento_global` (`departamento_global_id`);

--
-- Índices de tabela `processos_email_templates`
--
ALTER TABLE `processos_email_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_processos_email_template_atividade` (`atividade_id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Índices de tabela `processos_vinculos`
--
ALTER TABLE `processos_vinculos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_processo_pai` (`processo_pai_id`),
  ADD KEY `fk_processo_filho` (`processo_filho_id`);

--
-- Índices de tabela `produtos`
--
ALTER TABLE `produtos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_produtos_empresas` (`empresa_id`);

--
-- Índices de tabela `produto_lead`
--
ALTER TABLE `produto_lead`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_produto_lead_produtos` (`produto_id`),
  ADD KEY `fk_produto_lead_leads` (`lead_id`);

--
-- Índices de tabela `prova`
--
ALTER TABLE `prova`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_prova_conteudo` (`conteudo_id`),
  ADD KEY `idx_prova_grupo` (`grupo_id`);

--
-- Índices de tabela `prova_empresa`
--
ALTER TABLE `prova_empresa`
  ADD PRIMARY KEY (`id`),
  ADD KEY `prova_empresa_ibfk_1` (`prova_id`),
  ADD KEY `prova_empresa_ibfk_2` (`empresa_id`),
  ADD KEY `prova_empresa_ibfk_3` (`viewer_id`);

--
-- Índices de tabela `questao`
--
ALTER TABLE `questao`
  ADD PRIMARY KEY (`id`),
  ADD KEY `questao_ibfk_1` (`prova_id`);

--
-- Índices de tabela `recorrencias`
--
ALTER TABLE `recorrencias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_recorrencias_empresas` (`empresa_id`);

--
-- Índices de tabela `recorrencias_vendas`
--
ALTER TABLE `recorrencias_vendas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_rec_vendas_contratos` (`contrato_id`),
  ADD KEY `fk_rec_vendas_vendas` (`venda_id`);

--
-- Índices de tabela `redefinir_senha`
--
ALTER TABLE `redefinir_senha`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_codigo` (`codigo`);

--
-- Índices de tabela `serpro_requisicoes`
--
ALTER TABLE `serpro_requisicoes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id` (`id`),
  ADD KEY `fk_serpro_empresa` (`empresa_id`);

--
-- Índices de tabela `signatarios`
--
ALTER TABLE `signatarios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_signatarios_contratos` (`contrato_id`),
  ADD KEY `fk_signatarios_documentos` (`documento_id`),
  ADD KEY `fk_signatarios_empresas` (`empresa_id`);

--
-- Índices de tabela `sitfis`
--
ALTER TABLE `sitfis`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sitfis_cliente` (`cliente_id`),
  ADD KEY `fk_sitfis_empresa` (`empresa_id`);

--
-- Índices de tabela `straton_categorias`
--
ALTER TABLE `straton_categorias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_straton_categorias_tipos` (`tipo_id`),
  ADD KEY `fk_straton_categorias_empresa` (`empresa_id`);

--
-- Índices de tabela `straton_subcategorias`
--
ALTER TABLE `straton_subcategorias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_straton_subcategorias_categorias` (`categoria_id`),
  ADD KEY `fk_straton_subcategorias_empresa` (`empresa_id`);

--
-- Índices de tabela `tarefas`
--
ALTER TABLE `tarefas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tarefas_empresa` (`empresa_id`),
  ADD KEY `fk_tarefas_departamento` (`departamento_id`),
  ADD KEY `fk_tarefas_processo` (`processo_id`),
  ADD KEY `fk_tarefas_atividade` (`atividade_id`),
  ADD KEY `fk_tarefas_cliente` (`cliente_id`),
  ADD KEY `fk_tarefas_responsavel` (`responsavel_id`),
  ADD KEY `fk_tarefas_tarefa_pai` (`tarefa_pai_id`);

--
-- Índices de tabela `times_atendimento`
--
ALTER TABLE `times_atendimento`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_times_atendimento_empresas` (`empresa_id`),
  ADD KEY `fk_times_atendimento_departamentos` (`departamento_id`);

--
-- Índices de tabela `times_atendimento_instancias`
--
ALTER TABLE `times_atendimento_instancias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_time_instancia` (`times_atendimento_id`,`instancia_id`),
  ADD KEY `fk_tai_instancias` (`instancia_id`);

--
-- Índices de tabela `times_atendimento_usuarios`
--
ALTER TABLE `times_atendimento_usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_time_usuario` (`times_atendimento_id`,`usuario_id`),
  ADD KEY `fk_ta_usuarios_usuarios` (`usuario_id`);

--
-- Índices de tabela `tipos`
--
ALTER TABLE `tipos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tipos_empresas` (`empresa_id`);

--
-- Índices de tabela `transacoes`
--
ALTER TABLE `transacoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_transacoes_caixinha` (`caixinha_id`),
  ADD KEY `fk_transacoes_contas` (`conta_id`),
  ADD KEY `fk_transacoes_empresas` (`empresa_id`),
  ADD KEY `fk_transacoes_clientes` (`cliente_id`),
  ADD KEY `fk_transacoes_categoria` (`categoria_id`),
  ADD KEY `fk_transacoes_subcategoria` (`subcategoria_id`),
  ADD KEY `fk_transacoes_centro_custo` (`centro_custo_id`),
  ADD KEY `fk_transacoes_recorrencia` (`recorrencia_id`),
  ADD KEY `fk_transacoes_boleto` (`boleto_id`);

--
-- Índices de tabela `transacoes_api`
--
ALTER TABLE `transacoes_api`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_transacoes_api_empresas` (`empresa_id`),
  ADD KEY `fk_transacoes_api_clientes` (`cliente_id`),
  ADD KEY `fk_transacoes_api_contas` (`contas_id`);

--
-- Índices de tabela `transferencias_caixinha`
--
ALTER TABLE `transferencias_caixinha`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_transferencias_caixinha_empresas` (`empresa_id`),
  ADD KEY `fk_transferencias_caixinha_origem` (`caixinha_id`),
  ADD KEY `fk_transferencias_caixinha_destino` (`transferencia_caixinha_id`);

--
-- Índices de tabela `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_unread` (`user_id`,`read_at`),
  ADD KEY `idx_user_created` (`user_id`,`created_at`),
  ADD KEY `idx_module_type` (`module`,`type`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_entity` (`entity_type`,`entity_id`);

--
-- Índices de tabela `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices de tabela `usuarios_empresas`
--
ALTER TABLE `usuarios_empresas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_id` (`usuario_id`,`empresa_id`),
  ADD KEY `fk_usuarios_empresas_cargo` (`cargo_id`),
  ADD KEY `fk_usuarios_empresas_empresa` (`empresa_id`),
  ADD KEY `fk_usuarios_empresas_departamento` (`departamento_id`);

--
-- Índices de tabela `variaveis_personalizadas`
--
ALTER TABLE `variaveis_personalizadas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_variaveis_personalizadas_empresas` (`empresa_id`);

--
-- Índices de tabela `vendas`
--
ALTER TABLE `vendas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_vendas_empresa_numero` (`empresa_id`,`numero_venda`),
  ADD KEY `fk_vendas_boletos` (`boleto_id`),
  ADD KEY `fk_vendas_categorias` (`categoria_id`),
  ADD KEY `fk_vendas_centro_custo` (`centro_custo_id`),
  ADD KEY `fk_vendas_clientes` (`cliente_id`),
  ADD KEY `fk_vendas_contratos` (`contrato_id`),
  ADD KEY `fk_vendas_produtos` (`produtos_id`),
  ADD KEY `fk_vendas_subcategorias` (`subcategoria_id`),
  ADD KEY `fk_vendas_usuarios` (`usuario_id`);

--
-- Índices de tabela `webhooks`
--
ALTER TABLE `webhooks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_webhooks_empresas` (`empresa_id`);

--
-- Índices de tabela `webhook_eventos`
--
ALTER TABLE `webhook_eventos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_we_empresas` (`empresa_id`),
  ADD KEY `fk_we_webhooks` (`webhook_id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `alternativa`
--
ALTER TABLE `alternativa`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `anexos_atividade`
--
ALTER TABLE `anexos_atividade`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `api_keys`
--
ALTER TABLE `api_keys`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `arquivos_baixados_automaticamente`
--
ALTER TABLE `arquivos_baixados_automaticamente`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `assinaturas`
--
ALTER TABLE `assinaturas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `atividades_obrigacao`
--
ALTER TABLE `atividades_obrigacao`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `atividades_processo`
--
ALTER TABLE `atividades_processo`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `atividades_tarefas`
--
ALTER TABLE `atividades_tarefas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `boletos`
--
ALTER TABLE `boletos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `boletos_historico`
--
ALTER TABLE `boletos_historico`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `boleto_drafts`
--
ALTER TABLE `boleto_drafts`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `caixinha`
--
ALTER TABLE `caixinha`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `campos_adicionais`
--
ALTER TABLE `campos_adicionais`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `captura_boletos`
--
ALTER TABLE `captura_boletos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `cargos`
--
ALTER TABLE `cargos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `centro_custo`
--
ALTER TABLE `centro_custo`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `certificados_clientes`
--
ALTER TABLE `certificados_clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes`
--
ALTER TABLE `clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes_campos_adicionais`
--
ALTER TABLE `clientes_campos_adicionais`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes_dores`
--
ALTER TABLE `clientes_dores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes_grupos`
--
ALTER TABLE `clientes_grupos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes_grupos_vinculo`
--
ALTER TABLE `clientes_grupos_vinculo`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `clientes_solucoes`
--
ALTER TABLE `clientes_solucoes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `cliente_respostas`
--
ALTER TABLE `cliente_respostas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `comentarios_obrigacao`
--
ALTER TABLE `comentarios_obrigacao`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `comentarios_tarefa`
--
ALTER TABLE `comentarios_tarefa`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `conciliacoes`
--
ALTER TABLE `conciliacoes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contas`
--
ALTER TABLE `contas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contas_inter`
--
ALTER TABLE `contas_inter`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `conteudos`
--
ALTER TABLE `conteudos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contratada`
--
ALTER TABLE `contratada`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contratos`
--
ALTER TABLE `contratos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contrato_produto`
--
ALTER TABLE `contrato_produto`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `conversas`
--
ALTER TABLE `conversas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `conversas_transferencias`
--
ALTER TABLE `conversas_transferencias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_arquivos`
--
ALTER TABLE `crm_arquivos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_atividades`
--
ALTER TABLE `crm_atividades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_campos_personalizados`
--
ALTER TABLE `crm_campos_personalizados`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_categorias_personalizadas`
--
ALTER TABLE `crm_categorias_personalizadas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_contatos`
--
ALTER TABLE `crm_contatos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_empresa`
--
ALTER TABLE `crm_empresa`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_notas`
--
ALTER TABLE `crm_notas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_tipos_atividades`
--
ALTER TABLE `crm_tipos_atividades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `crm_valores_personalizados`
--
ALTER TABLE `crm_valores_personalizados`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `departamentos`
--
ALTER TABLE `departamentos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `departamentos_globais`
--
ALTER TABLE `departamentos_globais`
  MODIFY `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID único do departamento global';

--
-- AUTO_INCREMENT de tabela `documentos`
--
ALTER TABLE `documentos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `empresas`
--
ALTER TABLE `empresas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `enquete_grupos`
--
ALTER TABLE `enquete_grupos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `enquete_perguntas`
--
ALTER TABLE `enquete_perguntas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `enquete_respostas`
--
ALTER TABLE `enquete_respostas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `etiquetas`
--
ALTER TABLE `etiquetas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `funil_fases`
--
ALTER TABLE `funil_fases`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `funis`
--
ALTER TABLE `funis`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `grupos`
--
ALTER TABLE `grupos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `historico_leads`
--
ALTER TABLE `historico_leads`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `historico_transferencias`
--
ALTER TABLE `historico_transferencias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `instancias`
--
ALTER TABLE `instancias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `inter_tokens`
--
ALTER TABLE `inter_tokens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `inter_tokens_cache`
--
ALTER TABLE `inter_tokens_cache`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `leads`
--
ALTER TABLE `leads`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `leads_etiquetas`
--
ALTER TABLE `leads_etiquetas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `links_externos`
--
ALTER TABLE `links_externos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `lista_signatarios`
--
ALTER TABLE `lista_signatarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `mensagens`
--
ALTER TABLE `mensagens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `modelos_contrato`
--
ALTER TABLE `modelos_contrato`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `modulos`
--
ALTER TABLE `modulos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `modulos_empresa`
--
ALTER TABLE `modulos_empresa`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes`
--
ALTER TABLE `obrigacoes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_atividades_clientes`
--
ALTER TABLE `obrigacoes_atividades_clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_clientes`
--
ALTER TABLE `obrigacoes_clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_clientes_responsaveis`
--
ALTER TABLE `obrigacoes_clientes_responsaveis`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_email_templates`
--
ALTER TABLE `obrigacoes_email_templates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_particularidades`
--
ALTER TABLE `obrigacoes_particularidades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_responsaveis_cliente`
--
ALTER TABLE `obrigacoes_responsaveis_cliente`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `obrigacoes_responsaveis_fixo`
--
ALTER TABLE `obrigacoes_responsaveis_fixo`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pago_recebido`
--
ALTER TABLE `pago_recebido`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `parcelamentos`
--
ALTER TABLE `parcelamentos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `particularidades`
--
ALTER TABLE `particularidades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `particularidades_categorias`
--
ALTER TABLE `particularidades_categorias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pdf_layouts`
--
ALTER TABLE `pdf_layouts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pdf_layout_campos`
--
ALTER TABLE `pdf_layout_campos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pesquisas_satisfacao`
--
ALTER TABLE `pesquisas_satisfacao`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pesquisas_satisfacao_franqueados`
--
ALTER TABLE `pesquisas_satisfacao_franqueados`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `playbooks`
--
ALTER TABLE `playbooks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pre_clientes`
--
ALTER TABLE `pre_clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `processos`
--
ALTER TABLE `processos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `processos_email_templates`
--
ALTER TABLE `processos_email_templates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `processos_vinculos`
--
ALTER TABLE `processos_vinculos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produto_lead`
--
ALTER TABLE `produto_lead`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `prova`
--
ALTER TABLE `prova`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `prova_empresa`
--
ALTER TABLE `prova_empresa`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `questao`
--
ALTER TABLE `questao`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `recorrencias`
--
ALTER TABLE `recorrencias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `recorrencias_vendas`
--
ALTER TABLE `recorrencias_vendas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `redefinir_senha`
--
ALTER TABLE `redefinir_senha`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `serpro_requisicoes`
--
ALTER TABLE `serpro_requisicoes`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `signatarios`
--
ALTER TABLE `signatarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `sitfis`
--
ALTER TABLE `sitfis`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `straton_categorias`
--
ALTER TABLE `straton_categorias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `straton_subcategorias`
--
ALTER TABLE `straton_subcategorias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `tarefas`
--
ALTER TABLE `tarefas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `times_atendimento`
--
ALTER TABLE `times_atendimento`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `times_atendimento_instancias`
--
ALTER TABLE `times_atendimento_instancias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `times_atendimento_usuarios`
--
ALTER TABLE `times_atendimento_usuarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `tipos`
--
ALTER TABLE `tipos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `transacoes`
--
ALTER TABLE `transacoes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `transacoes_api`
--
ALTER TABLE `transacoes_api`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `transferencias_caixinha`
--
ALTER TABLE `transferencias_caixinha`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `user_notifications`
--
ALTER TABLE `user_notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `usuarios_empresas`
--
ALTER TABLE `usuarios_empresas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `variaveis_personalizadas`
--
ALTER TABLE `variaveis_personalizadas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `vendas`
--
ALTER TABLE `vendas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `webhooks`
--
ALTER TABLE `webhooks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `webhook_eventos`
--
ALTER TABLE `webhook_eventos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `alternativa`
--
ALTER TABLE `alternativa`
  ADD CONSTRAINT `alternativa_ibfk_1` FOREIGN KEY (`questao_id`) REFERENCES `questao` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `anexos_atividade`
--
ALTER TABLE `anexos_atividade`
  ADD CONSTRAINT `fk_anexos_atividade_tarefa` FOREIGN KEY (`atividade_tarefa_id`) REFERENCES `atividades_tarefas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `arquivos_baixados_automaticamente`
--
ALTER TABLE `arquivos_baixados_automaticamente`
  ADD CONSTRAINT `fk_abaixados_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_abaixados_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `assinaturas`
--
ALTER TABLE `assinaturas`
  ADD CONSTRAINT `fk_assinaturas_contratos` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`),
  ADD CONSTRAINT `fk_assinaturas_documentos` FOREIGN KEY (`documento_id`) REFERENCES `documentos` (`id`),
  ADD CONSTRAINT `fk_assinaturas_signatarios` FOREIGN KEY (`signatario_id`) REFERENCES `signatarios` (`id`);

--
-- Restrições para tabelas `atividades_obrigacao`
--
ALTER TABLE `atividades_obrigacao`
  ADD CONSTRAINT `fk_atividades_obrigacao_layout` FOREIGN KEY (`pdf_layout_id`) REFERENCES `pdf_layouts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_atividades_obrigacao_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `atividades_processo`
--
ALTER TABLE `atividades_processo`
  ADD CONSTRAINT `fk_atividades_processo` FOREIGN KEY (`processo_id`) REFERENCES `processos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_atividades_processo_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `atividades_tarefas`
--
ALTER TABLE `atividades_tarefas`
  ADD CONSTRAINT `fk_atividades_tarefa_atividade` FOREIGN KEY (`atividade_id`) REFERENCES `atividades_processo` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_atividades_tarefa_concluido` FOREIGN KEY (`concluido_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_atividades_tarefa_tarefa` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `boletos`
--
ALTER TABLE `boletos`
  ADD CONSTRAINT `fk_boletos_contratos` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`),
  ADD CONSTRAINT `fk_boletos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_boletos_inter_conta` FOREIGN KEY (`inter_conta_id`) REFERENCES `contas_inter` (`id`),
  ADD CONSTRAINT `fk_boletos_vendas` FOREIGN KEY (`venda_id`) REFERENCES `vendas` (`id`);

--
-- Restrições para tabelas `boletos_historico`
--
ALTER TABLE `boletos_historico`
  ADD CONSTRAINT `fk_boletos_historico_boletos` FOREIGN KEY (`boleto_id`) REFERENCES `boletos` (`id`);

--
-- Restrições para tabelas `boleto_drafts`
--
ALTER TABLE `boleto_drafts`
  ADD CONSTRAINT `fk_boleto_drafts_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_boleto_drafts_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `caixinha`
--
ALTER TABLE `caixinha`
  ADD CONSTRAINT `fk_caixinha_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  ADD CONSTRAINT `fk_caixinha_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `campos_adicionais`
--
ALTER TABLE `campos_adicionais`
  ADD CONSTRAINT `fk_campos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `captura_boletos`
--
ALTER TABLE `captura_boletos`
  ADD CONSTRAINT `fk_captura_boletos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_captura_boletos_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `cargos`
--
ALTER TABLE `cargos`
  ADD CONSTRAINT `cargos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `centro_custo`
--
ALTER TABLE `centro_custo`
  ADD CONSTRAINT `fk_centro_custo_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `certificados_clientes`
--
ALTER TABLE `certificados_clientes`
  ADD CONSTRAINT `fk_certificados_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `clientes`
--
ALTER TABLE `clientes`
  ADD CONSTRAINT `fk_clientes_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `clientes_campos_adicionais`
--
ALTER TABLE `clientes_campos_adicionais`
  ADD CONSTRAINT `fk_clientes_campos_campo` FOREIGN KEY (`campo_adicional_id`) REFERENCES `campos_adicionais` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_clientes_campos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `clientes_dores`
--
ALTER TABLE `clientes_dores`
  ADD CONSTRAINT `fk_clientes_dores_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `clientes_grupos`
--
ALTER TABLE `clientes_grupos`
  ADD CONSTRAINT `fk_clientes_grupos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `clientes_grupos_vinculo`
--
ALTER TABLE `clientes_grupos_vinculo`
  ADD CONSTRAINT `fk_clientes_vinculo_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_clientes_vinculo_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `clientes_grupos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `clientes_solucoes`
--
ALTER TABLE `clientes_solucoes`
  ADD CONSTRAINT `fk_clientes_solucoes_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `cliente_respostas`
--
ALTER TABLE `cliente_respostas`
  ADD CONSTRAINT `fk_cliente_respostas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `comentarios_obrigacao`
--
ALTER TABLE `comentarios_obrigacao`
  ADD CONSTRAINT `fk_comentarios_obrigacao_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes_clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_comentarios_obrigacao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `comentarios_tarefa`
--
ALTER TABLE `comentarios_tarefa`
  ADD CONSTRAINT `fk_comentarios_tarefa_tarefa` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_comentarios_tarefa_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `conciliacoes`
--
ALTER TABLE `conciliacoes`
  ADD CONSTRAINT `fk_conciliacoes_transacao` FOREIGN KEY (`transacao_id`) REFERENCES `transacoes` (`id`),
  ADD CONSTRAINT `fk_conciliacoes_transacao_api` FOREIGN KEY (`transacao_api_id`) REFERENCES `transacoes_api` (`id`),
  ADD CONSTRAINT `fk_conciliacoes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `contas`
--
ALTER TABLE `contas`
  ADD CONSTRAINT `fk_contas_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  ADD CONSTRAINT `fk_contas_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_contas_inter` FOREIGN KEY (`inter_conta_id`) REFERENCES `contas_inter` (`id`);

--
-- Restrições para tabelas `contas_inter`
--
ALTER TABLE `contas_inter`
  ADD CONSTRAINT `fk_contas_inter_contas` FOREIGN KEY (`contas_id`) REFERENCES `contas` (`id`),
  ADD CONSTRAINT `fk_contas_inter_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `conteudos`
--
ALTER TABLE `conteudos`
  ADD CONSTRAINT `conteudos_ibfk_1` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contratada`
--
ALTER TABLE `contratada`
  ADD CONSTRAINT `fk_contratada_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `contratos`
--
ALTER TABLE `contratos`
  ADD CONSTRAINT `fk_ccontratos_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_contratos_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centro_custo` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_contratos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_contratos_modelos` FOREIGN KEY (`modelos_contrato_id`) REFERENCES `modelos_contrato` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_contratos_pre_clientes` FOREIGN KEY (`pre_cliente_id`) REFERENCES `pre_clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_contratos_produtos` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `contrato_produto`
--
ALTER TABLE `contrato_produto`
  ADD CONSTRAINT `fk_cp_contrato` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`),
  ADD CONSTRAINT `fk_cp_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`),
  ADD CONSTRAINT `fk_cp_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`);

--
-- Restrições para tabelas `conversas`
--
ALTER TABLE `conversas`
  ADD CONSTRAINT `fk_conversas_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`),
  ADD CONSTRAINT `fk_conversas_times_instancias` FOREIGN KEY (`times_atendimento_instancia_id`) REFERENCES `times_atendimento_instancias` (`id`),
  ADD CONSTRAINT `fk_conversas_usuarios` FOREIGN KEY (`usuario_responsavel_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `conversas_transferencias`
--
ALTER TABLE `conversas_transferencias`
  ADD CONSTRAINT `fk_ct_conversas` FOREIGN KEY (`conversas_id`) REFERENCES `conversas` (`id`),
  ADD CONSTRAINT `fk_ct_de_usuario` FOREIGN KEY (`de_usuario_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_ct_para_usuario` FOREIGN KEY (`para_usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `crm_arquivos`
--
ALTER TABLE `crm_arquivos`
  ADD CONSTRAINT `fk_crm_arquivos_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `crm_atividades`
--
ALTER TABLE `crm_atividades`
  ADD CONSTRAINT `fk_crm_atividades_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`),
  ADD CONSTRAINT `fk_crm_atividades_tipos` FOREIGN KEY (`tipo_id`) REFERENCES `crm_tipos_atividades` (`id`);

--
-- Restrições para tabelas `crm_campos_personalizados`
--
ALTER TABLE `crm_campos_personalizados`
  ADD CONSTRAINT `fk_campos_personalizados_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `crm_categorias_personalizadas` (`id`);

--
-- Restrições para tabelas `crm_categorias_personalizadas`
--
ALTER TABLE `crm_categorias_personalizadas`
  ADD CONSTRAINT `fk_crm_categorias_personalizadas_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `crm_contatos`
--
ALTER TABLE `crm_contatos`
  ADD CONSTRAINT `fk_crm_contatos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_crm_contatos_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `crm_empresa`
--
ALTER TABLE `crm_empresa`
  ADD CONSTRAINT `fk_crm_empresa_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `crm_notas`
--
ALTER TABLE `crm_notas`
  ADD CONSTRAINT `fk_crm_notas_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`),
  ADD CONSTRAINT `fk_crm_notas_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `crm_tipos_atividades`
--
ALTER TABLE `crm_tipos_atividades`
  ADD CONSTRAINT `fk_crm_tipos_atividades_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `crm_valores_personalizados`
--
ALTER TABLE `crm_valores_personalizados`
  ADD CONSTRAINT `fk_valores_personalizados_campos` FOREIGN KEY (`campo_id`) REFERENCES `crm_campos_personalizados` (`id`),
  ADD CONSTRAINT `fk_valores_personalizados_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `departamentos`
--
ALTER TABLE `departamentos`
  ADD CONSTRAINT `departamentos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `departamentos_ibfk_2` FOREIGN KEY (`departamento_global_id`) REFERENCES `departamentos_globais` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `departamentos_ibfk_3` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `documentos`
--
ALTER TABLE `documentos`
  ADD CONSTRAINT `fk_documentos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_documentos_modelos` FOREIGN KEY (`modelos_contrato_id`) REFERENCES `modelos_contrato` (`id`),
  ADD CONSTRAINT `fk_documentos_pre_clientes` FOREIGN KEY (`pre_cliente_id`) REFERENCES `pre_clientes` (`id`);

--
-- Restrições para tabelas `empresas`
--
ALTER TABLE `empresas`
  ADD CONSTRAINT `fk_empresas_admin` FOREIGN KEY (`admin_usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `empresas_conteudos`
--
ALTER TABLE `empresas_conteudos`
  ADD CONSTRAINT `empresas_conteudos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `empresas_conteudos_ibfk_2` FOREIGN KEY (`conteudo_id`) REFERENCES `conteudos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `empresas_conteudos_ibfk_3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `empresas_grupos`
--
ALTER TABLE `empresas_grupos`
  ADD CONSTRAINT `empresas_grupos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `empresas_grupos_ibfk_2` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `enquete_grupos`
--
ALTER TABLE `enquete_grupos`
  ADD CONSTRAINT `fk_enquete_grupos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `enquete_perguntas`
--
ALTER TABLE `enquete_perguntas`
  ADD CONSTRAINT `fk_enquete_perguntas_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `enquete_grupos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `enquete_respostas`
--
ALTER TABLE `enquete_respostas`
  ADD CONSTRAINT `fk_enquete_respostas_particularidade` FOREIGN KEY (`particularidade_id`) REFERENCES `particularidades` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_enquete_respostas_pergunta` FOREIGN KEY (`pergunta_id`) REFERENCES `enquete_perguntas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `etiquetas`
--
ALTER TABLE `etiquetas`
  ADD CONSTRAINT `fk_etiquetas_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `funil_fases`
--
ALTER TABLE `funil_fases`
  ADD CONSTRAINT `fk_funil_fases_funis` FOREIGN KEY (`funil_id`) REFERENCES `funis` (`id`);

--
-- Restrições para tabelas `funis`
--
ALTER TABLE `funis`
  ADD CONSTRAINT `fk_funis_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `grupos`
--
ALTER TABLE `grupos`
  ADD CONSTRAINT `grupos_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `historico_leads`
--
ALTER TABLE `historico_leads`
  ADD CONSTRAINT `fk_hl_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`),
  ADD CONSTRAINT `fk_hl_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `historico_transferencias`
--
ALTER TABLE `historico_transferencias`
  ADD CONSTRAINT `fk_hist_transf_caixinha` FOREIGN KEY (`caixinha_id`) REFERENCES `caixinha` (`id`),
  ADD CONSTRAINT `fk_hist_transf_transferencias` FOREIGN KEY (`transferencia_id`) REFERENCES `transferencias_caixinha` (`id`);

--
-- Restrições para tabelas `instancias`
--
ALTER TABLE `instancias`
  ADD CONSTRAINT `fk_instancias_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `inter_tokens_cache`
--
ALTER TABLE `inter_tokens_cache`
  ADD CONSTRAINT `fk_inter_tokens_cache_contas_inter` FOREIGN KEY (`inter_conta_id`) REFERENCES `contas_inter` (`id`),
  ADD CONSTRAINT `fk_inter_tokens_cache_expiracao` FOREIGN KEY (`expiracao_local`) REFERENCES `inter_tokens` (`id`);

--
-- Restrições para tabelas `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `fk_leads_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_leads_funil_fases` FOREIGN KEY (`funil_fase_id`) REFERENCES `funil_fases` (`id`),
  ADD CONSTRAINT `fk_leads_funis` FOREIGN KEY (`funil_id`) REFERENCES `funis` (`id`),
  ADD CONSTRAINT `fk_leads_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `leads_etiquetas`
--
ALTER TABLE `leads_etiquetas`
  ADD CONSTRAINT `fk_leads_etiquetas_etiquetas` FOREIGN KEY (`etiqueta_id`) REFERENCES `etiquetas` (`id`),
  ADD CONSTRAINT `fk_leads_etiquetas_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `links_externos`
--
ALTER TABLE `links_externos`
  ADD CONSTRAINT `fk_links_externos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `lista_signatarios`
--
ALTER TABLE `lista_signatarios`
  ADD CONSTRAINT `fk_lista_signatarios_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `mensagens`
--
ALTER TABLE `mensagens`
  ADD CONSTRAINT `fk_mensagens_conversas` FOREIGN KEY (`conversas_id`) REFERENCES `conversas` (`id`),
  ADD CONSTRAINT `fk_mensagens_usuarios` FOREIGN KEY (`enviador_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `modelos_contrato`
--
ALTER TABLE `modelos_contrato`
  ADD CONSTRAINT `fk_modelos_contrato_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `modulos_empresa`
--
ALTER TABLE `modulos_empresa`
  ADD CONSTRAINT `fk_modulos_empresa_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_modulos_empresa_modulo` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `obrigacoes`
--
ALTER TABLE `obrigacoes`
  ADD CONSTRAINT `fk_obrigacoes_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_obrigacoes_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `obrigacoes_atividades_clientes`
--
ALTER TABLE `obrigacoes_atividades_clientes`
  ADD CONSTRAINT `fk_obrigacoes_atividades_cancelado` FOREIGN KEY (`cancelado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_obrigacoes_atividades_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_atividades_concluido` FOREIGN KEY (`concluido_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_obrigacoes_atividades_obrigacao` FOREIGN KEY (`obrigacao_cliente_id`) REFERENCES `obrigacoes_clientes` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `obrigacoes_clientes`
--
ALTER TABLE `obrigacoes_clientes`
  ADD CONSTRAINT `fk_obrigacoes_clientes_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_clientes_concluido` FOREIGN KEY (`concluido_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_obrigacoes_clientes_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_clientes_responsavel` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `obrigacoes_clientes_responsaveis`
--
ALTER TABLE `obrigacoes_clientes_responsaveis`
  ADD CONSTRAINT `fk_obrigacoes_responsavel_obrigacao` FOREIGN KEY (`obrigacao_cliente_id`) REFERENCES `obrigacoes_clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_responsavel_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `obrigacoes_email_templates`
--
ALTER TABLE `obrigacoes_email_templates`
  ADD CONSTRAINT `fk_email_template_atividade` FOREIGN KEY (`atividade_id`) REFERENCES `atividades_obrigacao` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `obrigacoes_particularidades`
--
ALTER TABLE `obrigacoes_particularidades`
  ADD CONSTRAINT `fk_obrigacoes_particularidade_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_particularidade_particularidade` FOREIGN KEY (`particularidade_id`) REFERENCES `particularidades` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `obrigacoes_responsaveis_cliente`
--
ALTER TABLE `obrigacoes_responsaveis_cliente`
  ADD CONSTRAINT `fk_obrigacoes_resp_cliente_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_resp_cliente_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_resp_cliente_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `obrigacoes_responsaveis_fixo`
--
ALTER TABLE `obrigacoes_responsaveis_fixo`
  ADD CONSTRAINT `fk_obrigacoes_responsaveis_fixo_obrigacao` FOREIGN KEY (`obrigacao_id`) REFERENCES `obrigacoes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_obrigacoes_responsaveis_fixo_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `pago_recebido`
--
ALTER TABLE `pago_recebido`
  ADD CONSTRAINT `fk_pago_recebido_categorias` FOREIGN KEY (`categoria_id`) REFERENCES `straton_categorias` (`id`),
  ADD CONSTRAINT `fk_pago_recebido_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_pago_recebido_transacoes` FOREIGN KEY (`transacoes_id`) REFERENCES `transacoes` (`id`);

--
-- Restrições para tabelas `parcelamentos`
--
ALTER TABLE `parcelamentos`
  ADD CONSTRAINT `fk_parcelamentos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_parcelamentos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `particularidades`
--
ALTER TABLE `particularidades`
  ADD CONSTRAINT `fk_particularidades_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `particularidades_categorias` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_particularidades_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `particularidades_categorias`
--
ALTER TABLE `particularidades_categorias`
  ADD CONSTRAINT `fk_particularidades_categorias_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `pdf_layouts`
--
ALTER TABLE `pdf_layouts`
  ADD CONSTRAINT `fk_pdf_layout_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pdf_layout_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `pdf_layout_campos`
--
ALTER TABLE `pdf_layout_campos`
  ADD CONSTRAINT `fk_pdf_layout_campos_layout` FOREIGN KEY (`layout_id`) REFERENCES `pdf_layouts` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `pesquisas_satisfacao`
--
ALTER TABLE `pesquisas_satisfacao`
  ADD CONSTRAINT `fk_pesquisa_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pesquisa_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `pesquisas_satisfacao_franqueados`
--
ALTER TABLE `pesquisas_satisfacao_franqueados`
  ADD CONSTRAINT `fk_pesq_franqueado` FOREIGN KEY (`franqueado_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_pesq_franqueadora` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `playbooks`
--
ALTER TABLE `playbooks`
  ADD CONSTRAINT `fk_playbooks_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `pre_clientes`
--
ALTER TABLE `pre_clientes`
  ADD CONSTRAINT `fk_pre_clientes_cargo` FOREIGN KEY (`cargo_id`) REFERENCES `cargos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pre_clientes_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pre_clientes_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_pre_clientes_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`);

--
-- Restrições para tabelas `processos`
--
ALTER TABLE `processos`
  ADD CONSTRAINT `fk_processos_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_processos_departamento_global` FOREIGN KEY (`departamento_global_id`) REFERENCES `departamentos_globais` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_processos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_processos_responsavel` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `processos_email_templates`
--
ALTER TABLE `processos_email_templates`
  ADD CONSTRAINT `fk_processos_email_template_atividade` FOREIGN KEY (`atividade_id`) REFERENCES `atividades_processo` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `processos_email_templates_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Restrições para tabelas `processos_vinculos`
--
ALTER TABLE `processos_vinculos`
  ADD CONSTRAINT `fk_processo_filho` FOREIGN KEY (`processo_filho_id`) REFERENCES `processos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_processo_pai` FOREIGN KEY (`processo_pai_id`) REFERENCES `processos` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `produtos`
--
ALTER TABLE `produtos`
  ADD CONSTRAINT `fk_produtos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `produto_lead`
--
ALTER TABLE `produto_lead`
  ADD CONSTRAINT `fk_produto_lead_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`),
  ADD CONSTRAINT `fk_produto_lead_produtos` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`);

--
-- Restrições para tabelas `prova`
--
ALTER TABLE `prova`
  ADD CONSTRAINT `fk_prova_conteudo` FOREIGN KEY (`conteudo_id`) REFERENCES `conteudos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_prova_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `prova_empresa`
--
ALTER TABLE `prova_empresa`
  ADD CONSTRAINT `prova_empresa_ibfk_1` FOREIGN KEY (`prova_id`) REFERENCES `prova` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `prova_empresa_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `prova_empresa_ibfk_3` FOREIGN KEY (`viewer_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `questao`
--
ALTER TABLE `questao`
  ADD CONSTRAINT `questao_ibfk_1` FOREIGN KEY (`prova_id`) REFERENCES `prova` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `recorrencias`
--
ALTER TABLE `recorrencias`
  ADD CONSTRAINT `fk_recorrencias_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `recorrencias_vendas`
--
ALTER TABLE `recorrencias_vendas`
  ADD CONSTRAINT `fk_rec_vendas_contratos` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_rec_vendas_vendas` FOREIGN KEY (`venda_id`) REFERENCES `vendas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `serpro_requisicoes`
--
ALTER TABLE `serpro_requisicoes`
  ADD CONSTRAINT `fk_serpro_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `signatarios`
--
ALTER TABLE `signatarios`
  ADD CONSTRAINT `fk_signatarios_contratos` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`),
  ADD CONSTRAINT `fk_signatarios_documentos` FOREIGN KEY (`documento_id`) REFERENCES `documentos` (`id`),
  ADD CONSTRAINT `fk_signatarios_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `sitfis`
--
ALTER TABLE `sitfis`
  ADD CONSTRAINT `fk_sitfis_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sitfis_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `straton_categorias`
--
ALTER TABLE `straton_categorias`
  ADD CONSTRAINT `fk_straton_categorias_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_straton_categorias_tipos` FOREIGN KEY (`tipo_id`) REFERENCES `tipos` (`id`);

--
-- Restrições para tabelas `straton_subcategorias`
--
ALTER TABLE `straton_subcategorias`
  ADD CONSTRAINT `fk_straton_subcategorias_categorias` FOREIGN KEY (`categoria_id`) REFERENCES `straton_categorias` (`id`),
  ADD CONSTRAINT `fk_straton_subcategorias_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Restrições para tabelas `tarefas`
--
ALTER TABLE `tarefas`
  ADD CONSTRAINT `fk_tarefas_atividade` FOREIGN KEY (`atividade_id`) REFERENCES `atividades_processo` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tarefas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tarefas_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tarefas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_tarefas_processo` FOREIGN KEY (`processo_id`) REFERENCES `processos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tarefas_responsavel` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tarefas_tarefa_pai` FOREIGN KEY (`tarefa_pai_id`) REFERENCES `tarefas` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `times_atendimento`
--
ALTER TABLE `times_atendimento`
  ADD CONSTRAINT `fk_times_atendimento_departamentos` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`),
  ADD CONSTRAINT `fk_times_atendimento_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `times_atendimento_instancias`
--
ALTER TABLE `times_atendimento_instancias`
  ADD CONSTRAINT `fk_tai_instancias` FOREIGN KEY (`instancia_id`) REFERENCES `instancias` (`id`),
  ADD CONSTRAINT `fk_tai_times` FOREIGN KEY (`times_atendimento_id`) REFERENCES `times_atendimento` (`id`);

--
-- Restrições para tabelas `times_atendimento_usuarios`
--
ALTER TABLE `times_atendimento_usuarios`
  ADD CONSTRAINT `fk_ta_usuarios_times` FOREIGN KEY (`times_atendimento_id`) REFERENCES `times_atendimento` (`id`),
  ADD CONSTRAINT `fk_ta_usuarios_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `tipos`
--
ALTER TABLE `tipos`
  ADD CONSTRAINT `fk_tipos_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `transacoes`
--
ALTER TABLE `transacoes`
  ADD CONSTRAINT `fk_transacoes_boleto` FOREIGN KEY (`boleto_id`) REFERENCES `boletos` (`id`),
  ADD CONSTRAINT `fk_transacoes_caixinha` FOREIGN KEY (`caixinha_id`) REFERENCES `caixinha` (`id`),
  ADD CONSTRAINT `fk_transacoes_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `straton_categorias` (`id`),
  ADD CONSTRAINT `fk_transacoes_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centro_custo` (`id`),
  ADD CONSTRAINT `fk_transacoes_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  ADD CONSTRAINT `fk_transacoes_contas` FOREIGN KEY (`conta_id`) REFERENCES `contas` (`id`),
  ADD CONSTRAINT `fk_transacoes_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_transacoes_recorrencia` FOREIGN KEY (`recorrencia_id`) REFERENCES `recorrencias` (`id`),
  ADD CONSTRAINT `fk_transacoes_subcategoria` FOREIGN KEY (`subcategoria_id`) REFERENCES `straton_subcategorias` (`id`);

--
-- Restrições para tabelas `transacoes_api`
--
ALTER TABLE `transacoes_api`
  ADD CONSTRAINT `fk_transacoes_api_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  ADD CONSTRAINT `fk_transacoes_api_contas` FOREIGN KEY (`contas_id`) REFERENCES `contas` (`id`),
  ADD CONSTRAINT `fk_transacoes_api_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `transferencias_caixinha`
--
ALTER TABLE `transferencias_caixinha`
  ADD CONSTRAINT `fk_transferencias_caixinha_destino` FOREIGN KEY (`transferencia_caixinha_id`) REFERENCES `caixinha` (`id`),
  ADD CONSTRAINT `fk_transferencias_caixinha_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_transferencias_caixinha_origem` FOREIGN KEY (`caixinha_id`) REFERENCES `caixinha` (`id`);

--
-- Restrições para tabelas `usuarios_empresas`
--
ALTER TABLE `usuarios_empresas`
  ADD CONSTRAINT `fk_usuarios_empresas_cargo` FOREIGN KEY (`cargo_id`) REFERENCES `cargos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_usuarios_empresas_departamento` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_usuarios_empresas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_usuarios_empresas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `variaveis_personalizadas`
--
ALTER TABLE `variaveis_personalizadas`
  ADD CONSTRAINT `fk_variaveis_personalizadas_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `vendas`
--
ALTER TABLE `vendas`
  ADD CONSTRAINT `fk_vendas_boletos` FOREIGN KEY (`boleto_id`) REFERENCES `boletos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_categorias` FOREIGN KEY (`categoria_id`) REFERENCES `straton_categorias` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centro_custo` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_clientes` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_contratos` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_produtos` FOREIGN KEY (`produtos_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_subcategorias` FOREIGN KEY (`subcategoria_id`) REFERENCES `straton_subcategorias` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_vendas_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

--
-- Restrições para tabelas `webhooks`
--
ALTER TABLE `webhooks`
  ADD CONSTRAINT `fk_webhooks_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`);

--
-- Restrições para tabelas `webhook_eventos`
--
ALTER TABLE `webhook_eventos`
  ADD CONSTRAINT `fk_we_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  ADD CONSTRAINT `fk_we_webhooks` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
