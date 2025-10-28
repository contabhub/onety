"use client";

import { useState } from "react";
import styles from "../../styles/financeiro/ExportarFluxoCaixaMensal.module.css";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';


export function ExportarFluxoCaixaMensal({ 
  isOpen, 
  onClose, 
  selectedYear, 
  selectedTipo, 
  showRealizadoOnly,
  dadosConsolidados,
  enableDayFilter,
  selectedDay
}) {
  const [tipoExportacao, setTipoExportacao] = useState("subcategorias");
  const [tipoValor, setTipoValor] = useState("ambos");
  const [isExporting, setIsExporting] = useState(false);

  // 💰 Função para formatar valores monetários
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // 📊 Função para gerar planilha por subcategorias
  const gerarPlanilhaSubcategorias = () => {
    if (!dadosConsolidados) return null;

    const dados = [];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Cabeçalho
    const cabecalho = {
      'Tipo': 'Tipo',
      'Categoria': 'Categoria',
      'Subcategoria': 'Subcategoria'
    };

    // Adicionar colunas de meses baseado no tipoValor
    if (tipoValor === 'previsto' || tipoValor === 'ambos') {
      meses.forEach(mes => {
        cabecalho[`${mes} Previsto`] = `${mes} Previsto`;
      });
    }
    if (tipoValor === 'realizado' || tipoValor === 'ambos') {
      meses.forEach(mes => {
        cabecalho[`${mes} Realizado`] = `${mes} Realizado`;
      });
    }

    // Adicionar totais anuais
    if (tipoValor === 'previsto' || tipoValor === 'ambos') {
      cabecalho['Total Anual Previsto'] = 'Total Anual Previsto';
    }
    if (tipoValor === 'realizado' || tipoValor === 'ambos') {
      cabecalho['Total Anual Realizado'] = 'Total Anual Realizado';
    }

    dados.push(cabecalho);

    // Processar dados
    dadosConsolidados.tipos.forEach(tipo => {
      tipo.categorias.forEach(categoria => {
        categoria.subcategorias.forEach(subcategoria => {
          const linha = {
            'Tipo': tipo.tipo_nome,
            'Categoria': categoria.categoria_nome,
            'Subcategoria': subcategoria.subcategoria_nome
          };

          // Adicionar valores mensais
          for (let mes = 1; mes <= 12; mes++) {
            const valores = subcategoria.valores_mensais[mes];
            const mesNome = meses[mes - 1];

            if (tipoValor === 'previsto' || tipoValor === 'ambos') {
              linha[`${mesNome} Previsto`] = formatCurrency(valores?.previsto || 0);
            }
            if (tipoValor === 'realizado' || tipoValor === 'ambos') {
              linha[`${mesNome} Realizado`] = formatCurrency(valores?.realizado || 0);
            }
          }

          // Adicionar totais anuais
          if (tipoValor === 'previsto' || tipoValor === 'ambos') {
            linha['Total Anual Previsto'] = formatCurrency(subcategoria.total_ano_previsto);
          }
          if (tipoValor === 'realizado' || tipoValor === 'ambos') {
            linha['Total Anual Realizado'] = formatCurrency(subcategoria.total_ano_realizado);
          }

          dados.push(linha);
        });
      });
    });

    return dados;
  };

  // 📊 Função para gerar planilha completa (hierárquica)
  const gerarPlanilhaCompleta = () => {
    if (!dadosConsolidados) return null;

    const dados = [];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Cabeçalho
    const cabecalho = {
      'Nível': 'Nível',
      'Descrição': 'Descrição'
    };

    // Adicionar colunas de meses
    if (tipoValor === 'previsto' || tipoValor === 'ambos') {
      meses.forEach(mes => {
        cabecalho[`${mes} Previsto`] = `${mes} Previsto`;
      });
    }
    if (tipoValor === 'realizado' || tipoValor === 'ambos') {
      meses.forEach(mes => {
        cabecalho[`${mes} Realizado`] = `${mes} Realizado`;
      });
    }

    // Adicionar totais anuais
    if (tipoValor === 'previsto' || tipoValor === 'ambos') {
      cabecalho['Total Anual Previsto'] = 'Total Anual Previsto';
    }
    if (tipoValor === 'realizado' || tipoValor === 'ambos') {
      cabecalho['Total Anual Realizado'] = 'Total Anual Realizado';
    }

    dados.push(cabecalho);

    // Processar tipos
    dadosConsolidados.tipos.forEach(tipo => {
      // Linha do tipo
      const linhaTipo = {
        'Nível': 'TIPO',
        'Descrição': tipo.tipo_nome
      };

      for (let mes = 1; mes <= 12; mes++) {
        const valores = tipo.valores_mensais[mes];
        const mesNome = meses[mes - 1];

        if (tipoValor === 'previsto' || tipoValor === 'ambos') {
          linhaTipo[`${mesNome} Previsto`] = formatCurrency(valores?.previsto || 0);
        }
        if (tipoValor === 'realizado' || tipoValor === 'ambos') {
          linhaTipo[`${mesNome} Realizado`] = formatCurrency(valores?.realizado || 0);
        }
      }

      if (tipoValor === 'previsto' || tipoValor === 'ambos') {
        linhaTipo['Total Anual Previsto'] = formatCurrency(tipo.total_ano_previsto);
      }
      if (tipoValor === 'realizado' || tipoValor === 'ambos') {
        linhaTipo['Total Anual Realizado'] = formatCurrency(tipo.total_ano_realizado);
      }

      dados.push(linhaTipo);

      // Processar categorias
      tipo.categorias.forEach(categoria => {
        const linhaCategoria = {
          'Nível': '  Categoria',
          'Descrição': categoria.categoria_nome
        };

        for (let mes = 1; mes <= 12; mes++) {
          const valores = categoria.valores_mensais[mes];
          const mesNome = meses[mes - 1];

          if (tipoValor === 'previsto' || tipoValor === 'ambos') {
            linhaCategoria[`${mesNome} Previsto`] = formatCurrency(valores?.previsto || 0);
          }
          if (tipoValor === 'realizado' || tipoValor === 'ambos') {
            linhaCategoria[`${mesNome} Realizado`] = formatCurrency(valores?.realizado || 0);
          }
        }

        if (tipoValor === 'previsto' || tipoValor === 'ambos') {
          linhaCategoria['Total Anual Previsto'] = formatCurrency(categoria.total_ano_previsto);
        }
        if (tipoValor === 'realizado' || tipoValor === 'ambos') {
          linhaCategoria['Total Anual Realizado'] = formatCurrency(categoria.total_ano_realizado);
        }

        dados.push(linhaCategoria);

        // Processar subcategorias
        categoria.subcategorias.forEach(subcategoria => {
          const linhaSubcategoria = {
            'Nível': '    Subcategoria',
            'Descrição': subcategoria.subcategoria_nome
          };

          for (let mes = 1; mes <= 12; mes++) {
            const valores = subcategoria.valores_mensais[mes];
            const mesNome = meses[mes - 1];

            if (tipoValor === 'previsto' || tipoValor === 'ambos') {
              linhaSubcategoria[`${mesNome} Previsto`] = formatCurrency(valores?.previsto || 0);
            }
            if (tipoValor === 'realizado' || tipoValor === 'ambos') {
              linhaSubcategoria[`${mesNome} Realizado`] = formatCurrency(valores?.realizado || 0);
            }
          }

          if (tipoValor === 'previsto' || tipoValor === 'ambos') {
            linhaSubcategoria['Total Anual Previsto'] = formatCurrency(subcategoria.total_ano_previsto);
          }
          if (tipoValor === 'realizado' || tipoValor === 'ambos') {
            linhaSubcategoria['Total Anual Realizado'] = formatCurrency(subcategoria.total_ano_realizado);
          }

          dados.push(linhaSubcategoria);
        });
      });

      // Linha em branco entre tipos
      dados.push({});
    });

    // Linha de totais gerais
    const linhaTotais = {
      'Nível': 'TOTAL GERAL',
      'Descrição': ''
    };

    for (let mes = 1; mes <= 12; mes++) {
      const valores = dadosConsolidados.totais_gerais.valores_mensais[mes];
      const mesNome = meses[mes - 1];

      if (tipoValor === 'previsto' || tipoValor === 'ambos') {
        linhaTotais[`${mesNome} Previsto`] = formatCurrency(valores?.previsto || 0);
      }
      if (tipoValor === 'realizado' || tipoValor === 'ambos') {
        linhaTotais[`${mesNome} Realizado`] = formatCurrency(valores?.realizado || 0);
      }
    }

    if (tipoValor === 'previsto' || tipoValor === 'ambos') {
      linhaTotais['Total Anual Previsto'] = formatCurrency(dadosConsolidados.totais_gerais.total_ano_previsto);
    }
    if (tipoValor === 'realizado' || tipoValor === 'ambos') {
      linhaTotais['Total Anual Realizado'] = formatCurrency(dadosConsolidados.totais_gerais.total_ano_realizado);
    }

    dados.push(linhaTotais);

    return dados;
  };

  // 📥 Função para exportar para Excel
  const handleExportar = async () => {
    try {
      setIsExporting(true);

      if (!dadosConsolidados) {
        console.error("Nenhum dado disponível para exportação");
        return;
      }

      // Gerar dados baseado no tipo de exportação
      const dados = tipoExportacao === 'subcategorias' 
        ? gerarPlanilhaSubcategorias()
        : gerarPlanilhaCompleta();

      if (!dados || dados.length === 0) {
        console.error("Nenhum dado para exportar");
        return;
      }

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dados, { skipHeader: true });

      // Ajustar largura das colunas
      const colWidths = Object.keys(dados[0]).map((key) => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;

      // Adicionar worksheet ao workbook
      const nomePlanilha = tipoExportacao === 'subcategorias' 
        ? 'Subcategorias' 
        : 'Fluxo Completo';
      XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);

      // Gerar nome do arquivo
      const tipoFiltro = selectedTipo === 'todos' ? 'Todos' : 
                        selectedTipo === 'entrada' ? 'Entradas' : 'Saídas';
      const tipoValorTexto = tipoValor === 'previsto' ? 'Previsto' :
                            tipoValor === 'realizado' ? 'Realizado' : 'Completo';
      
      let filename = `FluxoCaixaMensal_${selectedYear}_${tipoFiltro}_${tipoValorTexto}_${tipoExportacao}`;
      
      if (enableDayFilter && selectedDay) {
        filename += `_Dia${selectedDay}`;
      }
      
      filename += '.xlsx';

      // Fazer download
      XLSX.writeFile(wb, filename);

      console.log("Relatório exportado com sucesso!");
      onClose();
    } catch (error) {
      console.error("❌ Erro ao exportar:", error);
      console.error(error instanceof Error ? error.message : "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.exportarFluxoCaixaModalOverlay} onClick={onClose}>
      <div className={styles.exportarFluxoCaixaModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.exportarFluxoCaixaHeader}>
          <div>
            <h2 className={styles.exportarFluxoCaixaTitle}>
              Exportar Fluxo de Caixa Mensal
            </h2>
            <p className={styles.exportarFluxoCaixaDescription}>
              Exporte o relatório de fluxo de caixa mensal consolidado por subcategorias
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.exportarFluxoCaixaCloseBtn}
            disabled={isExporting}
          >
            ×
          </button>
        </div>

        <div className={styles.exportarFluxoCaixaContent}>
          {/* Informações dos Filtros Aplicados */}
          <div className={styles.exportarFluxoCaixaFiltersInfo}>
            <h4 className={styles.exportarFluxoCaixaFiltersTitle}>Filtros Aplicados:</h4>
            <div className={styles.exportarFluxoCaixaFiltersList}>
              <div className={styles.exportarFluxoCaixaFilterItem}>
                <span className={styles.exportarFluxoCaixaFilterLabel}>Ano:</span>
                <span className={styles.exportarFluxoCaixaFilterValue}>{selectedYear}</span>
              </div>
              <div className={styles.exportarFluxoCaixaFilterItem}>
                <span className={styles.exportarFluxoCaixaFilterLabel}>Tipo:</span>
                <span className={styles.exportarFluxoCaixaFilterValue}>
                  {selectedTipo === 'todos' ? 'Todos' : 
                   selectedTipo === 'entrada' ? 'Entradas' : 'Saídas'}
                </span>
              </div>
              {showRealizadoOnly && (
                <div className={styles.exportarFluxoCaixaFilterItem}>
                  <span className={styles.exportarFluxoCaixaFilterLabel}>Filtro:</span>
                  <span className={styles.exportarFluxoCaixaFilterValue}>Apenas Realizados</span>
                </div>
              )}
              {enableDayFilter && selectedDay && (
                <div className={styles.exportarFluxoCaixaFilterItem}>
                  <span className={styles.exportarFluxoCaixaFilterLabel}>Filtro por Dia:</span>
                  <span className={styles.exportarFluxoCaixaFilterValue}>Dia {selectedDay} de cada mês</span>
                </div>
              )}
            </div>
          </div>

          {/* Tipo de Relatório */}
          <div className={styles.exportarFluxoCaixaSection}>
            <label className={styles.exportarFluxoCaixaLabel}>Tipo de Relatório</label>
            <div className={styles.exportarFluxoCaixaRadioGroup}>
              <div className={styles.exportarFluxoCaixaRadioItem}>
                <input
                  type="radio"
                  name="tipoExportacao"
                  value="subcategorias"
                  id="subcategorias"
                  checked={tipoExportacao === "subcategorias"}
                  onChange={(e) => setTipoExportacao(e.target.value)}
                  className={styles.exportarFluxoCaixaRadioInput}
                />
                <label htmlFor="subcategorias" className={styles.exportarFluxoCaixaRadioLabel}>
                  <div>
                    <div className={styles.exportarFluxoCaixaRadioTitle}>Por Subcategorias</div>
                    <div className={styles.exportarFluxoCaixaRadioDescription}>
                      Lista todas as subcategorias com valores mensais e totais anuais
                    </div>
                  </div>
                </label>
              </div>
              <div className={styles.exportarFluxoCaixaRadioItem}>
                <input
                  type="radio"
                  name="tipoExportacao"
                  value="completo"
                  id="completo"
                  checked={tipoExportacao === "completo"}
                  onChange={(e) => setTipoExportacao(e.target.value)}
                  className={styles.exportarFluxoCaixaRadioInput}
                />
                <label htmlFor="completo" className={styles.exportarFluxoCaixaRadioLabel}>
                  <div>
                    <div className={styles.exportarFluxoCaixaRadioTitle}>Relatório Completo (Hierárquico)</div>
                    <div className={styles.exportarFluxoCaixaRadioDescription}>
                      Inclui tipos, categorias e subcategorias em estrutura hierárquica
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Tipo de Valor */}
          <div className={styles.exportarFluxoCaixaSection}>
            <label className={styles.exportarFluxoCaixaLabel}>Valores a Exportar</label>
            <div className={styles.exportarFluxoCaixaRadioGroup}>
              <div className={styles.exportarFluxoCaixaRadioItem}>
                <input
                  type="radio"
                  name="tipoValor"
                  value="ambos"
                  id="ambos"
                  checked={tipoValor === "ambos"}
                  onChange={(e) => setTipoValor(e.target.value)}
                  className={styles.exportarFluxoCaixaRadioInput}
                />
                <label htmlFor="ambos" className={styles.exportarFluxoCaixaRadioLabel}>
                  <div>
                    <div className={styles.exportarFluxoCaixaRadioTitle}>Previsto e Realizado</div>
                    <div className={styles.exportarFluxoCaixaRadioDescription}>
                      Exporta ambos os valores (previsto e realizado)
                    </div>
                  </div>
                </label>
              </div>
              <div className={styles.exportarFluxoCaixaRadioItem}>
                <input
                  type="radio"
                  name="tipoValor"
                  value="realizado"
                  id="realizado"
                  checked={tipoValor === "realizado"}
                  onChange={(e) => setTipoValor(e.target.value)}
                  className={styles.exportarFluxoCaixaRadioInput}
                />
                <label htmlFor="realizado" className={styles.exportarFluxoCaixaRadioLabel}>
                  <div>
                    <div className={styles.exportarFluxoCaixaRadioTitle}>Apenas Realizado</div>
                    <div className={styles.exportarFluxoCaixaRadioDescription}>
                      Exporta apenas valores realizados (pagos)
                    </div>
                  </div>
                </label>
              </div>
              <div className={styles.exportarFluxoCaixaRadioItem}>
                <input
                  type="radio"
                  name="tipoValor"
                  value="previsto"
                  id="previsto"
                  checked={tipoValor === "previsto"}
                  onChange={(e) => setTipoValor(e.target.value)}
                  className={styles.exportarFluxoCaixaRadioInput}
                />
                <label htmlFor="previsto" className={styles.exportarFluxoCaixaRadioLabel}>
                  <div>
                    <div className={styles.exportarFluxoCaixaRadioTitle}>Apenas Previsto</div>
                    <div className={styles.exportarFluxoCaixaRadioDescription}>
                      Exporta apenas valores previstos
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Informação sobre formato */}
          <div className={styles.exportarFluxoCaixaInfoBox}>
            <div className={styles.exportarFluxoCaixaInfoContent}>
              <div className={styles.exportarFluxoCaixaStatusIndicator}></div>
              <span className={styles.exportarFluxoCaixaInfoText}>
                O relatório será exportado em formato Excel (.xlsx) com dados consolidados do ano todo
              </span>
            </div>
          </div>
        </div>

        <div className={styles.exportarFluxoCaixaFooter}>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className={styles.exportarFluxoCaixaCancelBtn}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={isExporting || !dadosConsolidados}
            className={styles.exportarFluxoCaixaExportBtn}
          >
            {isExporting ? (
              <>
                <Loader2 className={styles.exportarFluxoCaixaLoadingIcon} />
                Exportando...
              </>
            ) : (
              <>
                <Download className={styles.exportarFluxoCaixaDownloadIcon} />
                Exportar Relatório
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

