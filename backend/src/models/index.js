ObrigacaoCliente.belongsTo(Obrigacao, { foreignKey: 'obrigacaoId', as: 'obrigacao' });
ObrigacaoCliente.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
