import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export class PDFGenerator {

  // Cores personalizadas da Água Souza
  colors = {
    primary: [21, 128, 61], // Verde principal #15803d
    primaryDark: [16, 96, 46], // Verde mais escuro para títulos
    primaryLight: [34, 197, 94], // Verde mais claro para destaques
    secondary: [20, 83, 45], // Verde secundário para subtítulos
    accent: [22, 163, 74], // Verde de destaque para valores
    text: [15, 23, 42], // Texto escuro para legibilidade
    textLight: [71, 85, 105], // Texto mais claro para informações secundárias
    background: [240, 253, 244], // Fundo muito claro para tabelas
    border: [187, 247, 208], // Bordas sutis
  };

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.width;
    this.yPosition = 70; // Aumentado para acomodar o novo header com logo real
  }

  tryLoadLogo() {
    // Como a logo está na pasta public/, sempre retornar true
    // Em produção, você pode implementar uma verificação mais robusta
    return true;
  }

  addHeader(
    title,
    subtitle,
    currentDate,
    empresa
  ) {
    try {
      // ===== SEÇÃO ESQUERDA - LOGO E ELEMENTOS VISUAIS =====

      // Tentar carregar logo real primeiro
      const hasLogo = this.tryLoadLogo();

      if (hasLogo) {
        // Se tiver logo real, usar ela
        const logoUrl = "/aguas-souza-logo.jpg";
        // Posicionar a logo à esquerda com tamanho adequado
        this.doc.addImage(logoUrl, "JPEG", 20, 4, 45, 45, undefined, "FAST");
      } else {
        // // Logo personalizada com formas geométricas
        // this.doc.setFillColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
        // this.doc.setDrawColor(this.colors.primaryLight[0], this.colors.primaryLight[1], this.colors.primaryLight[2]);
        // this.doc.setLineWidth(1);
        // // Gota d'água principal (forma oval)
        // this.doc.ellipse(25, 25, 15, 20, 'F'); // Gota principal preenchida
        // this.doc.ellipse(25, 25, 15, 20, 'D'); // Contorno da gota
        // // Pequenas gotas circulares acima
        // this.doc.circle(35, 15, 3, 'F');
        // this.doc.circle(40, 18, 2, 'F');
        // this.doc.circle(38, 12, 2.5, 'F');
        // // Caminhão estilizado à esquerda
        // this.doc.setFillColor(this.colors.primaryLight[0], this.colors.primaryLight[1], this.colors.primaryLight[2]);
        // this.doc.rect(15, 35, 12, 8, 'F'); // Corpo do caminhão
        // this.doc.circle(18, 43, 2, 'F'); // Roda traseira
        // this.doc.circle(25, 43, 2, 'F'); // Roda dianteira
        // // Texto "ÁGUA SOUZA" dentro da gota (vertical)
        // this.doc.setTextColor(255, 255, 255);
        // this.doc.setFontSize(8);
        // this.doc.text('ÁGUA', 22, 20);
        // this.doc.text('SOUZA', 22, 28);
        // // Texto "Transportes e Locação de Caminhões Ltda." (curvado)
        // this.doc.setTextColor(this.colors.primary[0], this.colors.primary[1], this.colors.primary[2]);
        // this.doc.setFontSize(6);
        // this.doc.text('Transportes e Locação de Caminhões Ltda.', 45, 15);
      }

      // ===== SEÇÃO DIREITA - INFORMAÇÕES DA EMPRESA =====

      const rightX = this.pageWidth - 20;

      // Nome da empresa
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold"); // Deixar em negrito
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );
      this.doc.text(
        empresa?.nome || "ÁGUA SOUZA - Transportes e Locação de Caminhões",
        rightX,
        14,
        { align: "right" }
      );

      // VOLTAR para fonte normal para os próximos textos
      this.doc.setFont("helvetica", "normal");

      // Endereço
      this.doc.setFontSize(10);
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );
      this.doc.text(
        empresa?.endereco || "Estrada dos Bandeirantes, 25100 - Vargem Grande",
        rightX,
        24,
        { align: "right" }
      );
      this.doc.text(
        `${empresa?.cidade || "Rio de Janeiro"} - ${empresa?.estado || "RJ"}`, 
        rightX, 
        29, 
        { align: "right" }
      );

      // Telefone
      this.doc.text(
        `Telefone: ${empresa?.telefone || "(21)3392-4513"}`, 
        rightX, 
        34, 
        { align: "right" }
      );

      // CNPJ
      this.doc.setFontSize(10);
      this.doc.setTextColor(
        this.colors.primaryDark[0],
        this.colors.primaryDark[1],
        this.colors.primaryDark[2]
      );
      this.doc.text("CNPJ:", rightX, 39, { align: "right" });
      this.doc.text(empresa?.cnpj || "00.000.000/0001-00", rightX, 44, { align: "right" });

      // ===== SEÇÃO INFERIOR - TÍTULO DO DOCUMENTO =====

      // Título principal do documento
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );
      this.doc.text(
        title || "RECIBO DE CONTRATO",
        20,
        45,
        { align: "left" }
      );

      // VOLTAR para fonte normal para os próximos textos
      this.doc.setFont("helvetica", "normal");

      // Linha separadora abaixo do título
      this.doc.setDrawColor(
        this.colors.primary[0],
        this.colors.primary[1],
        this.colors.primary[2]
      );
      this.doc.setLineWidth(0.5);
      this.doc.line(20, 47, this.pageWidth - 20, 47);

      // Data de geração (menor, abaixo da linha separadora)
      this.doc.setFontSize(9);
      this.doc.setTextColor(
        this.colors.textLight[0],
        this.colors.textLight[1],
        this.colors.textLight[2]
      );
      this.doc.text(`Gerado em: ${currentDate}`, 20, 52, { align: "left" });
    } catch (error) {
      // Fallback para layout simples se houver erro
      console.log(
        "Erro ao criar header personalizado, usando layout padrão:",
        error
      );

      // Título principal
      this.doc.setFontSize(20);
      this.doc.setTextColor(
        this.colors.primaryDark[0],
        this.colors.primaryDark[1],
        this.colors.primaryDark[2]
      );
      this.doc.text(title, this.pageWidth / 2, 20, { align: "center" });

      // Subtítulo
      this.doc.setFontSize(14);
      this.doc.setTextColor(
        this.colors.primary[0],
        this.colors.primary[1],
        this.colors.primary[2]
      );
      this.doc.text(subtitle, this.pageWidth / 2, 35, { align: "center" });

      // Data de geração
      this.doc.setFontSize(10);
      this.doc.setTextColor(
        this.colors.textLight[0],
        this.colors.textLight[1],
        this.colors.textLight[2]
      );
      this.doc.text(`Gerado em: ${currentDate}`, this.pageWidth / 2, 45, {
        align: "center",
      });
    }
  }

  addSummary(summary, results, reportType) {
    if (!summary) return;

    // Verificar se é um relatório de cliente único
    const isSingleClientReport =
      reportType === "client" && results && results.length > 0;
    const uniqueClients = results
      ? Array.from(new Set(results.map((item) => item.client)))
      : [];
    const isSingleClient = uniqueClients.length === 1;

    if (isSingleClientReport && isSingleClient) {
      const clientName = uniqueClients[0];
      const leftX = 20;
      const rightX = this.pageWidth - 20;
      const pageCenterX = this.pageWidth / 2; // ← RENOMEAR para pageCenterX

      // ========= FAIXA "Somente Cliente ..." (cinza leve) =========
      const faixaAltura = 6;
      const faixaY = this.yPosition - 17;

      this.doc.setFillColor(240, 240, 240);
      this.doc.rect(leftX, faixaY, rightX - leftX, faixaAltura, "F");

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );

      // Texto alinhado à esquerda com pequeno espaçamento
      this.doc.text(
        `Cliente: ${clientName} [1] - Período de ${this.getDateRange(results)}`,
        leftX, // 5 pontos de espaçamento da borda esquerda
        faixaY + 4, // Centralizar verticalmente na faixa
        { align: "left" } // Alinhar à esquerda
      );
      this.yPosition += faixaAltura + -14; 

      // ========= 3 COLUNAS: Cliente do Contrato / CNPJ-CPF / Venc + Situação =========
      const colGap = 10;
      const colW = (rightX - leftX - colGap * 2) / 3;
      const col1X = leftX;
      const col2X = leftX + colW + colGap;
      const col3X = leftX + (colW + colGap) * 2;

      const clientInfo = this.getClientInfo(results[0]);

      // --- Coluna 1: Cliente do Contrato ---
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );
      // this.doc.text("Cliente do Contrato", col1X, this.yPosition);

      // this.doc.setFont("helvetica", "normal");
      // this.doc.setFontSize(10);
      // this.doc.text(clientInfo.name || "", col1X, this.yPosition + 6);

      this.doc.setFontSize(9);
      // Endereço numa linha; se quiser quebrar, faça um split por tamanho
      this.doc.text(clientInfo.address || "", col1X, this.yPosition);
      const cepText = clientInfo.cep ? `CEP: ${clientInfo.cep}` : "";
      if (cepText) this.doc.text(cepText, col1X, this.yPosition + 18);

      // --- Coluna 2: CNPJ / CPF ---
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.text("CNPJ / CPF", col2X, this.yPosition);

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(10);
      this.doc.text(clientInfo.document || "N/A", col2X, this.yPosition + 4);

      // --- Coluna 3: Vencimento + Situação ---
      // Linha 1: Venc (número à direita da etiqueta)
      // const venc = clientInfo.venc || "15";
      // this.doc.setFont("helvetica", "bold");
      // this.doc.setFontSize(9);
      // this.doc.text("Venc", col3X, this.yPosition);

      // this.doc.setFont("helvetica", "normal");
      // this.doc.setFontSize(10);
      // this.doc.text(String(venc), col3X + 22, this.yPosition + 6); 

           // Linha 2: Situação + cápsula "ATIVO"
           const situ = (clientInfo.status || "ATIVO").toUpperCase();
           this.doc.setFont("helvetica", "bold");
           this.doc.setFontSize(9);
           this.doc.text("Situação:", col3X, this.yPosition); // Label "Situação"
           
           // Cápsula retangular de fundo cinza (como no print)
           const pillY = this.yPosition;      // top da cápsula
           const pillH = 8;                   // altura da cápsula
           const pillW = 34;                  // largura da cápsula
           const pillX = col3X + 25;
         
           // this.doc.setFillColor(240, 240, 240);
           // this.doc.rect(pillX, pillY, pillW, pillH, 'F');
         
           this.doc.setFont("helvetica", "bold");
           this.doc.setFontSize(10);
           this.doc.setTextColor(
             this.colors.primary[0],
             this.colors.primary[1],
             this.colors.primary[2]
           );
           // Texto "ATIVO" na mesma altura do label "Situação"
           this.doc.text(situ, pillX - 7, this.yPosition); // ← MESMA ALTURA: this.yPosition

      // this.doc.setFillColor(240, 240, 240);
      // this.doc.rect(pillX, pillY, pillW, pillH, "F");

      // Altura total tomada por este bloco
      this.yPosition += 24;

      // ========= Linha separadora inferior =========
      this.doc.setDrawColor(
        this.colors.primary[0],
        this.colors.primary[1],
        this.colors.primary[2]
      );
      this.doc.setLineWidth(0.3);
      this.doc.line(leftX, this.yPosition - 15, rightX, this.yPosition - 15);
      this.yPosition += 8;
    } else {
      // ===== SUMÁRIO SIMPLES PARA OUTROS RELATÓRIOS =====
      
      // Adicionar faixa com período para todos os tipos de relatório
      const leftX = 20;
      const rightX = this.pageWidth - 20;
      const faixaAltura = 6;
      const faixaY = this.yPosition - 17;

      this.doc.setFillColor(240, 240, 240);
      this.doc.rect(leftX, faixaY, rightX - leftX, faixaAltura, "F");

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.setTextColor(
        this.colors.text[0],
        this.colors.text[1],
        this.colors.text[2]
      );

      // Texto com período alinhado à esquerda
      this.doc.text(
        `Período de ${this.getDateRange(results || [])}`,
        leftX,
        faixaY + 4,
        { align: "left" }
      );
      this.yPosition += faixaAltura - 14;

      this.doc.setFontSize(12);
      this.doc.setTextColor(
        this.colors.primaryDark[0],
        this.colors.primaryDark[1],
        this.colors.primaryDark[2]
      );
      this.doc.text("Resumo Geral", 20, this.yPosition);
      this.yPosition += 10;

      const summaryData = [
        ["Total de Entregas", summary.totalEntregas?.toString() || "0"],
        ["Volume Total (m³)", summary.totalM3?.toFixed(2) || "0.00"],
        ["Valor Total (R$)", summary.totalFaturado?.toFixed(2) || "0.00"],
      ];

             autoTable(this.doc, {
         startY: this.yPosition,
         head: [["Métrica", "Valor"]],
         body: summaryData,
         theme: "grid",
         headStyles: {
           fillColor: this.colors.primary,
           textColor: [255, 255, 255],
           fontStyle: "bold",
         },
         styles: {
           fontSize: 10,
           textColor: this.colors.text,
         },
         alternateRowStyles: {
           fillColor: this.colors.background,
         },
         tableLineColor: this.colors.border,
         tableLineWidth: 0.1,
       });

       this.yPosition += 35; // Reduzido de 60 para 35 para aproximar as tabelas
    }
  }

  // Método auxiliar para obter informações do cliente
  getClientInfo(item) {
    return {
      name: item.client || "Cliente não informado",
      address: item.endereco_principal || "Endereço não informado",
      cep: item.cep || "",
      document: item.cnpj_cpf || "Documento não informado",
    };
  }

  // Método auxiliar para obter período dos dados
  getDateRange(results) {
    if (!results || results.length === 0) return "Período não definido";

    const dates = results
      .map((item) => item.date)
      .filter((date) => date)
      .sort();

    if (dates.length === 0) return "Período não definido";

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    return `${startDate} até ${endDate}`;
  }

  // Função para formatar hora (HH:MM)
  formatTime(timeString) {
    if (!timeString) return "-";

    // Se já estiver no formato HH:MM, retorna como está
    if (timeString.match(/^\d{1,2}:\d{2}$/)) {
      return timeString;
    }

    // Se estiver no formato HH:MM:SS, remove os segundos
    if (timeString.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      return timeString.substring(0, 5);
    }

    // Se for apenas um número (minutos desde meia-noite), converte para HH:MM
    if (timeString.match(/^\d+$/)) {
      const minutes = parseInt(timeString);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}`;
    }

    return timeString;
  }

  // Método para obter estilos de coluna baseado no número de colunas
  getColumnStyles(columnCount) {
    const baseStyles = {};

    // Definir larguras padrão para diferentes tipos de tabelas
    if (columnCount === 12) {
      // Tabela sem coluna cliente (cliente único)
      baseStyles[0] = { cellWidth: 12 }; // OS
      baseStyles[1] = { cellWidth: 18 }; // Data
      baseStyles[2] = { cellWidth: 14 }; // Quantidade
      baseStyles[3] = { cellWidth: 18 }; // Valor
      baseStyles[4] = { cellWidth: 20 }; // Hidrômetro Inicial
      baseStyles[5] = { cellWidth: 20 }; // Hidrômetro Final
      baseStyles[6] = { cellWidth: 15 }; // Base
      baseStyles[7] = { cellWidth: 18 }; // Motorista
      baseStyles[8] = { cellWidth: 14 }; // Veículo
      baseStyles[9] = { cellWidth: 10 }; // Hora Início
      baseStyles[10] = { cellWidth: 10 }; // Hora Fim
      baseStyles[11] = { cellWidth: 14 }; // Status
    } else if (columnCount === 13) {
      // Tabela com coluna cliente (múltiplos clientes)
      baseStyles[0] = { cellWidth: 12 }; // OS
      baseStyles[1] = { cellWidth: 18 }; // Cliente
      baseStyles[2] = { cellWidth: 18 }; // Data
      baseStyles[3] = { cellWidth: 14 }; // Quantidade
      baseStyles[4] = { cellWidth: 15 }; // Valor
      baseStyles[5] = { cellWidth: 15 }; // Hidrômetro Inicial
      baseStyles[6] = { cellWidth: 15 }; // Hidrômetro Final
      baseStyles[7] = { cellWidth: 15 }; // Base
      baseStyles[8] = { cellWidth: 18 }; // Motorista
      baseStyles[9] = { cellWidth: 12 }; // Veículo
      baseStyles[10] = { cellWidth: 10 }; // Hora Início
      baseStyles[11] = { cellWidth: 10 }; // Hora Fim
      baseStyles[12] = { cellWidth: 14 }; // Status
    }

    return baseStyles;
  }

  addPeriodTable(results) {
    let yPos = this.yPosition;
    const valor = parseFloat(results[0]?.value || "0");
    const leftX = 20;
    const rightX = this.pageWidth - 20;

    // Cabeçalho dos itens com fundo cinza
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(leftX, yPos, rightX - leftX, 12, 'F');
    
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(0, 0, 0);
    
    // Cabeçalhos das colunas
    this.doc.text('Qt.', leftX + 5, yPos + 8);
    this.doc.text('Produto/Serviço', leftX + 30, yPos + 8);
    this.doc.text('Detalhe do item', leftX + 120, yPos + 8);
    this.doc.text('Valor unitário', rightX - 80, yPos + 8, { align: 'right' });
    this.doc.text('Subtotal', rightX - 5, yPos + 8, { align: 'right' });

    yPos += 20;

    // Linha do item
    this.doc.setFont("helvetica", "normal");
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(leftX, yPos, rightX - leftX, 15, 'F');
    this.doc.setDrawColor(200, 200, 200);
    this.doc.rect(leftX, yPos, rightX - leftX, 15, 'S');

    this.doc.text('1', leftX + 5, yPos + 10);
    this.doc.text(results[0]?.client || 'Serviço', leftX + 30, yPos + 10);
    this.doc.text(results[0]?.base || '-', leftX + 120, yPos + 10);
    this.doc.text(`${valor.toFixed(2)}`, rightX - 80, yPos + 10, { align: 'right' });
    this.doc.text(`${valor.toFixed(2)}`, rightX - 5, yPos + 10, { align: 'right' });

    yPos += 25;

    // Linha separadora
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(leftX, yPos, rightX, yPos);

    yPos += 15;

    // Seção de totais (layout mais limpo)
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text('Total', rightX - 80, yPos, { align: 'right' });
    this.doc.text(`${valor.toFixed(2)}`, rightX - 5, yPos, { align: 'right' });
    
    yPos += 15;
    this.doc.setFont("helvetica", "bold");
    this.doc.text('Valor líquido', rightX - 80, yPos, { align: 'right' });
    this.doc.text(`${valor.toFixed(2)}`, rightX - 5, yPos, { align: 'right' });

    yPos += 30;

    // Condições de pagamento
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.text('Condição de pagamento:', leftX, yPos);
    
    yPos += 15;
    this.doc.setFont("helvetica", "normal");
    this.doc.text('Forma de pagamento: Boleto Bancário', leftX, yPos);

    yPos += 25;

    // Seção de vencimentos (sem tabela, layout em colunas)
    this.doc.setFont("helvetica", "bold");
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(leftX, yPos, rightX - leftX, 12, 'F');
    
    this.doc.text('Nº', leftX + 5, yPos + 8);
    this.doc.text('Vencimento', leftX + 60, yPos + 8);
    this.doc.text('Valor (R$)', rightX - 5, yPos + 8, { align: 'right' });

    yPos += 20;

    // Dados do vencimento
    this.doc.setFont("helvetica", "normal");
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(leftX, yPos, rightX - leftX, 15, 'F');
    this.doc.setDrawColor(200, 200, 200);
    this.doc.rect(leftX, yPos, rightX - leftX, 15, 'S');

    this.doc.text('1º', leftX + 5, yPos + 10);
    this.doc.text(results[0]?.date || new Date().toLocaleDateString("pt-BR"), leftX + 60, yPos + 10);
    this.doc.text(`${valor.toFixed(2)}`, rightX - 5, yPos + 10, { align: 'right' });

    // Atualizar posição Y
    this.yPosition = yPos + 30;
  }

  addGroupedTable(
    reportType,
    groupedData,
    results
  ) {
    let headers = [];
    let tableData = [];

    switch (reportType) {
      case "base":
        headers = [
          "Base Operacional",
          "Qtd. Entregas",
          "Volume Total (m³)",
          "Valor Total (R$)",
        ];
        tableData = groupedData.map((item) => [
          item.base,
          item.count.toString(),
          `${item.volume.toFixed(2)} m³`,
          `R$ ${item.value.toFixed(2)}`,
        ]);
        break;
      case "client":
        // Para relatório por cliente, usar estrutura detalhada como período
        if (results && results.length > 0) {
          // Verificar se é um único cliente (remover coluna cliente se for o caso)
          const uniqueClients = [
            ...Array.from(new Set(results.map((item) => item.client))),
          ];
          const isSingleClient = uniqueClients.length === 1;

          if (isSingleClient) {
            // Tabela no formato de recibo
            headers = ["Qt.", "Produto/Serviço", "Detalhe do item", "Valor unitário", "Subtotal"];

            tableData = results.map((item) => [
              "1",
              item.client || "Serviço",
              item.base || "-",
              `${item.value || "0.00"}`,
              `${item.value || "0.00"}`
            ]);
          } else {
            // Tabela detalhada com coluna cliente
            headers = [
              "Nº OS",
              "Cliente",
              "Data",
              "Qtd. (m³)",
              "Valor (R$)",
              "Hidrômetro Inicial",
              "Hidrômetro Final",
              "Base",
              "Motorista",
              "Veículo",
              "Hora Início",
              "Hora Fim",
              "Status",
            ];

            tableData = results.map((item) => [
              item.os || "-",
              item.client || "-",
              item.date || "-",
              `${item.quantity || "0"} m³`,
              `R$ ${item.value || "0.00"}`,
              item.hidrometroInicial || "-",
              item.hidrometroFinal || "-",
              item.base || "-",
              item.driver || "-",
              item.vehicle || "-",
              this.formatTime(item.horaInicio),
              this.formatTime(item.horaFim),
              item.status || "-",
            ]);
          }
        } else {
          // Fallback para tabela agrupada simples
          headers = [
            "Cliente",
            "Qtd. Entregas",
            "Volume Total (m³)",
            "Valor Total (R$)",
          ];
          tableData = groupedData.map((item) => [
            item.client,
            item.count.toString(),
            `${item.volume.toFixed(2)} m³`,
            `R$ ${item.value.toFixed(2)}`,
          ]);
        }
        break;
      case "driver":
        headers = [
          "Motorista",
          "Qtd. Entregas",
          "Volume Total (m³)",
          "Valor Total (R$)",
        ];
        tableData = groupedData.map((item) => [
          item.driver,
          item.count.toString(),
          `${item.volume.toFixed(2)} m³`,
          `R$ ${item.value.toFixed(2)}`,
        ]);
        break;
    }

    // Aplicar estilos baseados no tipo de tabela
    const isDetailedTable =
      reportType === "client" && results && results.length > 0;

    // Adicionar título específico para cliente único
    if (reportType === "client" && results && results.length > 0) {
      const uniqueClients = Array.from(new Set(results.map((item) => item.client)));
      const isSingleClient = uniqueClients.length === 1;

      // if (isSingleClient) {
      //   const clientName = uniqueClients[0];
      //   // Adicionar título do cliente antes da tabela
      //   this.doc.setFontSize(14);
      //   this.doc.setTextColor(this.colors.primaryDark[0], this.colors.primaryDark[1], this.colors.primaryDark[2]);
      //   this.doc.text(`Cliente: ${clientName}`, 20, this.yPosition);
      //   this.yPosition += 15;
      // }
    }

    // Verificar se é tabela de recibo (cliente único)
    const isReciboTable = reportType === "client" && results && results.length > 0 && 
                         Array.from(new Set(results.map((item) => item.client))).length === 1;

    if (isReciboTable) {
      // Usar o mesmo formato da addPeriodTable para consistência
      this.addPeriodTable(results);
    } else {
      // Tabela normal para outros casos
      autoTable(this.doc, {
        startY: this.yPosition - 5,
        head: [headers],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: this.colors.primary,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: isDetailedTable ? 9 : 10,
        },
        styles: {
          fontSize: isDetailedTable ? 7 : 10,
          textColor: this.colors.text,
          cellPadding: isDetailedTable ? 1 : 3,
        },
        alternateRowStyles: {
          fillColor: this.colors.background,
        },
        tableLineColor: this.colors.border,
        // Configurações específicas para tabelas detalhadas
        ...(isDetailedTable && {
          columnStyles: this.getColumnStyles(headers.length),
        }),
      });
    }
  }

  addTotals(
    reportType,
    results,
    groupedData
  ) {
    // Para jsPDF v3.0+, precisamos rastrear a posição Y manualmente
    // Vamos usar uma posição fixa ou calcular baseado no conteúdo anterior
    const finalY = this.yPosition + 50; // Posição estimada

    // Adicionar rodapé com informações da empresa
    const pageHeight = this.doc.internal.pageSize.height;
    const footerY = pageHeight - 20;

    // Linha separadora
    this.doc.setDrawColor(
      this.colors.primary[0],
      this.colors.primary[1],
      this.colors.primary[2]
    );
    this.doc.setLineWidth(0.5);
    this.doc.line(20, footerY - 5, this.pageWidth - 20, footerY - 5);

    // Informações da empresa no rodapé
    this.doc.setFontSize(8);
    this.doc.setTextColor(
      this.colors.textLight[0],
      this.colors.textLight[1],
      this.colors.textLight[2]
    );
    this.doc.text(
      "Sistema Straton - Gestão Empresarial",
      this.pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // if (finalY < this.doc.internal.pageSize.height - 20) {
    //   this.doc.setFontSize(11);
    //   this.doc.setTextColor(this.colors.primaryDark[0], this.colors.primaryDark[1], this.colors.primaryDark[2]);
    //   this.doc.text('Totais:', 20, finalY);

    //   if (reportType === 'period') {
    //     const totalVolume = results.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    //     const totalValue = results.reduce((sum, item) => sum + parseFloat(item.value || 0), 0);
    //     this.doc.setTextColor(this.colors.accent[0], this.colors.accent[1], this.colors.accent[2]);
    //     this.doc.text(`Volume Total: ${totalVolume.toFixed(2)} m³`, 20, finalY + 10);
    //     this.doc.text(`Valor Total: R$ ${totalValue.toFixed(2)}`, 20, finalY + 20);
    //   } else if (groupedData) {
    //     const totalCount = groupedData.reduce((sum, item) => sum + item.count, 0);
    //     const totalVolume = groupedData.reduce((sum, item) => sum + item.volume, 0);
    //     const totalValue = groupedData.reduce((sum, item) => sum + item.value, 0);
    //     this.doc.setTextColor(this.colors.accent[0], this.colors.accent[1], this.colors.accent[2]);
    //     this.doc.text(`Total de Entregas: ${totalCount}`, 20, finalY + 10);
    //     this.doc.text(`Volume Total: ${totalVolume.toFixed(2)} m³`, 20, finalY + 20);
    //     this.doc.text(`Valor Total: R$ ${totalValue.toFixed(2)}`, 20, finalY + 30);
    //   }
    // }
  }

  generateReciboEspecifico(contrato, empresa) {
    // Adaptar os dados do contrato para o formato esperado
    const dadosAdaptados = [{
      os: contrato.numero_contrato || contrato.id,
      client: contrato.cliente_nome,
      date: new Date(contrato.data_inicio).toLocaleDateString("pt-BR"),
      quantity: 1, // Quantidade fixa para contratos
      value: (Number(contrato.valor) || 0).toFixed(2),
      hidrometroInicial: "-",
      hidrometroFinal: "-",
      base: empresa.cidade || "Principal",
      driver: contrato.vendedor_nome || "N/A",
      vehicle: "Contrato",
      horaInicio: "-",
      horaFim: "-",
      status: contrato.status || "ativo",
      // Dados adicionais para o cliente
      endereco_principal: empresa.endereco,
      cep: empresa.cep,
      cnpj_cpf: empresa.cnpj
    }];

    const summary = {
      totalEntregas: 1,
      totalM3: 1,
      totalFaturado: Number(contrato.valor) || 0
    };

    const currentDate = new Date().toLocaleDateString("pt-BR");
    const title = `Recibo de Contrato - ${contrato.cliente_nome}`;

    // Adicionar cabeçalho com dados da empresa
    this.addHeader(title, "Recibo de Contrato", currentDate, empresa);

    // Adicionar resumo
    this.addSummary(summary, dadosAdaptados, "client");

    // Adicionar tabela detalhada
    const groupedData = this.getGroupedData("client", dadosAdaptados);
    if (groupedData) {
      this.addGroupedTable("client", groupedData, dadosAdaptados);
    }

    // Adicionar totais
    this.addTotals("client", dadosAdaptados, groupedData || undefined);

    // Salvar o PDF
    const fileName = `recibo_contrato_${contrato.numero_contrato || contrato.id}_${currentDate.replace(/\//g, "-")}.pdf`;
    this.doc.save(fileName);
  }

  generateReport(options) {
    const {
      reportType,
      results,
      summary,
      title = "Relatório Água Souza",
    } = options;

    if (!results || results.length === 0) {
      throw new Error("Não há dados para exportar");
    }

    const currentDate = new Date().toLocaleDateString("pt-BR");
    const reportTypeLabels = {
      period: "Relatório por Período",
      base: "Relatório por Base Operacional",
      client: "Relatório por Cliente",
      driver: "Relatório por Motorista",
    };

    // Adicionar cabeçalho
    this.addHeader(
      title,
      reportTypeLabels[reportType] || "Relatório",
      currentDate
    );

    // Adicionar resumo se disponível
    this.addSummary(summary, results, reportType);

    // Adicionar tabela de dados
    if (reportType === "period") {
      this.addPeriodTable(results);
    } else {
      // Para relatórios agrupados, precisamos dos dados agrupados
      const groupedData = this.getGroupedData(reportType, results);
      if (groupedData) {
        this.addGroupedTable(reportType, groupedData, results);
      }
    }

    // Adicionar totais
    const groupedData = this.getGroupedData(reportType, results);
    this.addTotals(reportType, results, groupedData || undefined);

    // Salvar o PDF
    const fileName = `relatorio_${reportType}_${currentDate.replace(
      /\//g,
      "-"
    )}.pdf`;
    this.doc.save(fileName);
  }

  getGroupedData(reportType, results) {
    if (!results || results.length === 0) return null;

    switch (reportType) {
      case "base":
        const byBase = results.reduce((acc, item) => {
          const baseName = item.base || "Sem Base";
          if (!acc[baseName]) {
            acc[baseName] = { base: baseName, count: 0, volume: 0, value: 0 };
          }
          acc[baseName].count += 1;
          acc[baseName].volume += parseFloat(item.quantity || 0);
          acc[baseName].value += parseFloat(item.value || 0);
          return acc;
        }, {});
        return Object.values(byBase);

      case "client":
        const byClient = results.reduce((acc, item) => {
          const clientName = item.client || "Sem Cliente";
          if (!acc[clientName]) {
            acc[clientName] = {
              client: clientName,
              count: 0,
              volume: 0,
              value: 0,
            };
          }
          acc[clientName].count += 1;
          acc[clientName].volume += parseFloat(item.quantity || 0);
          acc[clientName].value += parseFloat(item.value || 0);
          return acc;
        }, {});
        return Object.values(byClient);

      case "driver":
        const byDriver = results.reduce((acc, item) => {
          const driverName = item.driver || "Sem Motorista";
          if (!acc[driverName]) {
            acc[driverName] = {
              driver: driverName,
              count: 0,
              volume: 0,
              value: 0,
            };
          }
          acc[driverName].count += 1;
          acc[driverName].volume += parseFloat(item.quantity || 0);
          acc[driverName].value += parseFloat(item.value || 0);
          return acc;
        }, {});
        return Object.values(byDriver);

      default:
        return null;
    }
  }
}

// Função utilitária para uso direto
export const generatePDFReport = (
  options
) => {
  return new Promise((resolve, reject) => {
    try {
      const generator = new PDFGenerator();
      generator.generateReport(options);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// Função específica para gerar recibo de contrato
export const generateReciboContrato = async (contrato, empresa) => {
  const generator = new PDFGenerator();
  
  // Criar um método específico para recibo que aceita empresa
  generator.generateReciboEspecifico(contrato, empresa);
};