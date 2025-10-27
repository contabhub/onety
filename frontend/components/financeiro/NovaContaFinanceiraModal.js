import { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/financeiro/botao';
import { Input } from '../../components/financeiro/input';
import { Label } from '../../components/financeiro/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/financeiro/select';
import { Checkbox } from '../../components/financeiro/checkbox';
import {
  X,
  Building2,
  Calculator,
  CreditCard,
  PiggyBank,
  Wallet,
  Database,
  Receipt,
  DollarSign,
  HelpCircle,
  Upload,
  FileText,
  CheckCircle,
  ChevronUp,
  Banknote
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from '../../styles/financeiro/nova-conta-modal.module.css';
import '../../styles/financeiro/confirmar-exclusao.module.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

import dynamic from 'next/dynamic';

// Importação dinâmica do componente OpenFinancePluggy
const OpenFinancePluggy = dynamic(() => import('../../pages/financeiro/contas-a-receber/open-finance'), { ssr: false });
import ReactSelect from 'react-select';

const Stepper = ({ currentStep, steps }) => {
  return (
    <div className={styles.novaContaStepper}>
      {steps.map((step, index) => (
        <div key={index} className={styles.novaContaStepperItem}>
          <div className={styles.novaContaStepperStepContainer}>
            <div className={cn(
              styles.novaContaStepperStep,
              index + 1 <= currentStep
                ? styles.novaContaStepperStepActive
                : styles.novaContaStepperStepInactive
            )}>
              {index + 1 <= currentStep ? (
                index + 1 < currentStep ? <CheckCircle className={styles.novaContaStepperIcon} /> : index + 1
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              styles.novaContaStepperLabel,
              index + 1 <= currentStep ? styles.novaContaStepperLabelActive : styles.novaContaStepperLabelInactive
            )}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              styles.novaContaStepperLine,
              index + 1 < currentStep ? styles.novaContaStepperLineActive : styles.novaContaStepperLineInactive
            )} />
          )}
        </div>
      ))}
    </div>
  );
};

export function NovaContaFinanceiraModal({ isOpen, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [integracaoEscolhida, setIntegracaoEscolhida] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    banco: '',
    descricao: '',
    contaPadrao: false,
    agencia: '',
    numero_conta: ''
  });

  // Estados para campos do Inter
  const [interEnabled, setInterEnabled] = useState(false);
  const [interData, setInterData] = useState({
    client_id: '',
    client_secret: '',
    cert_file: null,
    key_file: null,
    conta_corrente: '',
    apelido: '',
    ambiente: 'prod',
    is_default: false,
    status: 'ativo'
  });

  // Nova ordem dos passos: Conta, Cadastro, Integração, Importação, Conclusão
  const steps = ['Conta', 'Cadastro', 'Integração', 'Importação', 'Conclusão'];

  const tiposConta = [
    {
      id: 'conta-corrente',
      title: 'Conta Corrente',
      icon: Building2,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'caixinha',
      title: 'Caixinha',
      icon: Calculator,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'cartao-credito',
      title: 'Cartão de Crédito',
      icon: CreditCard,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'poupanca',
      title: 'Poupança',
      icon: PiggyBank,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'investimento',
      title: 'Investimento',
      icon: Wallet,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'aplicacao-automatica',
      title: 'Aplicação Automática',
      icon: Database,
      category: 'Contas bancárias e contas de movimentação'
    },
    {
      id: 'receba-facil',
      title: 'Receba Fácil',
      icon: Receipt,
      category: 'Contas de recebimento'
    },
    {
      id: 'outras-contas-recebimento',
      title: 'Outras contas de recebimento',
      icon: DollarSign,
      category: 'Contas de recebimento'
    },
    {
      id: 'outro-tipo',
      title: 'Outro tipo de conta',
      icon: HelpCircle,
      category: 'Outros tipos de conta'
    }
  ];

  // const handleNext = () => {
  //   if (currentStep < 4) {
  //     setCurrentStep(currentStep + 1);
  //   }
  // };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTipoSelect = (tipo) => {
    setSelectedTipo(tipo);
  };


  const [ofxBase64, setOfxBase64] = useState(null);


  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('Nenhum arquivo selecionado');
      return;
    }

    console.log('Arquivo selecionado:', { 
      name: file.name, 
      size: file.size, 
      type: file.type 
    });

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      console.log('Arquivo lido, tamanho do resultado:', result.length);
      
      const base64String = result.split(',')[1];
      console.log('Base64 extraído, tamanho:', base64String?.length);
      
      setOfxBase64(base64String);
      console.log('OFX Base64 definido no estado');
      
      // Mostrar os campos de saldo quando um arquivo for selecionado
      setShowSaldoFields(true);
    };
    
    reader.onerror = (error) => {
      console.error('Erro ao ler arquivo:', error);
      toast.error('Erro ao ler arquivo OFX. Tente novamente.');
    };
    
    reader.readAsDataURL(file);
  };

  // Função para converter arquivo para base64
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Função para lidar com upload de arquivos do Inter
  const handleInterFileChange = async (field, file) => {
    setInterData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const formatDateToMysql = (dateStr) => {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };


  const criarContaFinanceira = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const company_id = userData.EmpresaId;
      const cliente_id = userData.id || null;

      // Preparar dados do Inter se habilitado
      let interCertB64 = null;
      let interKeyB64 = null;

      if (interEnabled && interData.cert_file && interData.key_file) {
        try {
          const certB64 = await convertFileToBase64(interData.cert_file);
          const keyB64 = await convertFileToBase64(interData.key_file);
          interCertB64 = certB64;
          interKeyB64 = keyB64;
        } catch (error) {
          console.error('Erro ao converter arquivos do Inter:', error);
          toast.error('Erro ao processar arquivos do Inter. Tente novamente.');
          return;
        }
      }

      // 1. Criar conta na tabela contas tradicional
      const responseContaTradicional = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/contas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          item_id: `manual-${Date.now()}`, // ID único para contas manuais
          empresa_id: company_id,
          cliente_id,
          banco: formData.banco,
          descricao_banco: formData.descricao,
          tipo_conta: selectedTipo === 'caixinha' ? null : tipoContaPessoa,
          numero_conta: selectedTipo === 'caixinha' ? null : formData.numero_conta,
          agencia: selectedTipo === 'caixinha' ? null : formData.agencia,
          tipo: selectedTipo,
          saldo: saldoBancario || null,
          inicio_lancamento: inicioLancamento ? formatDateToMysql(inicioLancamento) : null
        })
      });

      const contaTradicionalData = await responseContaTradicional.json();
      console.log('Conta tradicional criada:', contaTradicionalData);

      // 2. Se tiver OFX, faça o POST do OFX vinculado à conta_id criada
      if (ofxBase64 && contaTradicionalData.id) {
        console.log('Iniciando importação do OFX...');
        console.log('URL da API:', `${process.env.NEXT_PUBLIC_API_URL}/ofx-import`);
        console.log('Dados do OFX:', {
          arquivoBase64Length: ofxBase64?.length,
          conta_id: contaTradicionalData.id,
          company_id: company_id
        });
        
        try {
          const requestBody = {
            arquivoBase64: ofxBase64,
            conta_id: contaTradicionalData.id,
            company_id: company_id
          };
          
          console.log('Request body preparado:', {
            arquivoBase64Length: requestBody.arquivoBase64?.length,
            conta_id: requestBody.conta_id,
            company_id: requestBody.company_id
          });
          
          const responseOfx = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ofx-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(requestBody),
          });

          console.log('Resposta do servidor:', {
            status: responseOfx.status,
            statusText: responseOfx.statusText,
            ok: responseOfx.ok
          });

          if (!responseOfx.ok) {
            console.error('Erro na resposta do OFX:', responseOfx.status, responseOfx.statusText);
            const errorText = await responseOfx.text();
            console.error('Erro detalhado:', errorText);
            toast.error('Erro ao importar OFX. Verifique o console para mais detalhes.');
          } else {
            const ofxData = await responseOfx.json();
            console.log('OFX importado com sucesso:', ofxData);
            toast.success('OFX importado com sucesso!');
          }
        } catch (error) {
          console.error('Erro ao importar OFX:', error);
          toast.error('Erro ao importar OFX. Tente novamente.');
        }
      } else {
        console.log('OFX não será importado:', { 
          temOfx: !!ofxBase64, 
          temContaId: !!contaTradicionalData.id,
          ofxLength: ofxBase64?.length 
        });
      }

      // 3. Criar conta via contas-api APENAS se tiver integração (Inter habilitado)
      if (interEnabled) {
        console.log('Inter habilitado, criando conta na API...');
        const responseConta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/contas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            // Campos básicos da conta
            item_id: `manual-${Date.now()}`, // ID único para contas manuais
            client_user_id: cliente_id,
            company_id,
            cliente_id,
            banco: formData.banco,
            descricao_banco: formData.descricao,
            tipo_conta: tipoContaPessoa,
            numero_conta: formData.numero_conta,
            agencia: formData.agencia,
            tipo: selectedTipo,
            
            // Campos do Inter
            inter_enabled: interEnabled,
            inter_client_id: interEnabled ? interData.client_id : null,
            inter_client_secret: interEnabled ? interData.client_secret : null,
            inter_cert_b64: interEnabled ? interCertB64 : null,
            inter_key_b64: interEnabled ? interKeyB64 : null,
            inter_conta_corrente: interEnabled ? interData.conta_corrente : null,
            inter_apelido: interEnabled ? interData.apelido : null,
            inter_ambiente: interEnabled ? interData.ambiente : 'prod',
            inter_is_default: interEnabled ? interData.is_default : false,
            inter_status: interEnabled ? interData.status : 'ativo'
          })
        });

        const contaData = await responseConta.json();
        console.log('Conta API criada:', contaData);
      } else {
        console.log('Inter não habilitado, conta criada apenas na tabela tradicional');
      }

      // Toast de sucesso e callback
      toast.success('Conta criada com sucesso!');
      
      // Notificar sucesso para atualizar a lista de contas
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 4) {
      // Validação específica para caixinhas (não precisa de campos de saldo)
      if (selectedTipo === 'caixinha') {
        await criarContaFinanceira();
        setCurrentStep(5); // Avança para conclusão
        return;
      } else {
        // Validar campos obrigatórios para contas bancárias se não tiver OFX
        if (!ofxBase64 && (!inicioLancamento || !saldoBancario)) {
          alert('Por favor, preencha todos os campos obrigatórios ou importe um arquivo OFX.');
          return;
        }
        await criarContaFinanceira();
        setCurrentStep(5); // Avança para conclusão
        return;
      }
    }
    // Validação dos campos obrigatórios no cadastro
    if (currentStep === 2) {
      // Validação específica para caixinhas (não precisa de agência, número da conta nem tipo de pessoa)
      if (selectedTipo === 'caixinha') {
        if (!formData.banco || !formData.descricao) {
          alert('Por favor, preencha todos os campos obrigatórios do cadastro.');
          return;
        }
      } else {
        // Validação para contas bancárias (precisa de agência, número da conta e tipo de pessoa)
        if (!formData.banco || !formData.descricao || !formData.agencia || !formData.numero_conta || !tipoContaPessoa) {
          alert('Por favor, preencha todos os campos obrigatórios do cadastro.');
          return;
        }
      }
      
      // Validação dos campos obrigatórios do Inter se habilitado
      if (interEnabled) {
        if (!interData.client_id || !interData.client_secret || !interData.conta_corrente || 
            !interData.cert_file || !interData.key_file) {
          alert('Por favor, preencha todos os campos obrigatórios da integração com o Inter.');
          return;
        }
      }
    }
    
    // Validação adicional para OpenFinance com Inter habilitado
    if (currentStep === 3 && integracaoEscolhida === 'openfinance' && interEnabled) {
      if (!interData.client_id || !interData.client_secret || !interData.conta_corrente || 
          !interData.cert_file || !interData.key_file) {
        alert('Por favor, preencha todos os campos obrigatórios da integração com o Inter antes de prosseguir.');
        return;
      }
    }
    // Avança normalmente para o próximo passo
    setCurrentStep(currentStep + 1);
  };


  const [connectors, setConnectors] = useState([]);

  useEffect(() => {
    // IDs dos conectores que devem ser bloqueados/excluídos
    const blockedConnectorIds = [217, 203, 209, 214, 216, 219, 201, 247, 218, 238, 206, 280, 205, 229, 208, 221, 227];
    
    const fetchConnectors = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/openfinance/connectors`);
        const data = await res.json();
        
        // Filtra os conectores, removendo aqueles com IDs bloqueados
        const filteredConnectors = data.connectors.results.filter(
          (connector) => 
            !blockedConnectorIds.includes(connector.id)
        );
        
        setConnectors(filteredConnectors);
      } catch (err) {
        console.error('Erro ao buscar connectors:', err);
      }
    };

    fetchConnectors();
  }, []);

  const [selectedBank, setSelectedBank] = useState(null);




  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const [tipoContaPessoa, setTipoContaPessoa] = useState(null);

  const handleTipoContaPessoa = (tipo) => {
    setTipoContaPessoa(prev => (prev === tipo ? null : tipo)); // toggle
  };

  const renderStep1 = () => (
    <div className={styles.novaContaStepContainer}>
      <div className={styles.novaContaStepHeader}>
        <h2 className={styles.novaContaStepTitle}>
          Selecione o tipo de conta que você quer cadastrar
        </h2>
      </div>

      <div className={styles.novaContaStepContent}>
        {/* Contas bancárias e contas de movimentação */}
        <div className={styles.novaContaCategorySection}>
          <h3 className={styles.novaContaCategoryTitle}>Contas bancárias e contas de movimentação</h3>
          <div className={styles.novaContaTypeGrid}>
            {tiposConta.filter(tipo => tipo.category === 'Contas bancárias e contas de movimentação').map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => handleTipoSelect(tipo.id)}
                className={cn(
                  styles.novaContaTypeCard,
                  selectedTipo === tipo.id ? styles.novaContaTypeCardSelected : ""
                )}
              >
                <tipo.icon className={styles.novaContaTypeIcon} />
                <span className={styles.novaContaTypeText}>{tipo.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Contas de recebimento */}
        <div className={styles.novaContaCategorySection}>
          <h3 className={styles.novaContaCategoryTitle}>Contas de recebimento</h3>
          <div className={styles.novaContaTypeGrid}>
            {tiposConta.filter(tipo => tipo.category === 'Contas de recebimento').map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => handleTipoSelect(tipo.id)}
                className={cn(
                  styles.novaContaTypeCard,
                  selectedTipo === tipo.id ? styles.novaContaTypeCardSelected : ""
                )}
              >
                <tipo.icon className={styles.novaContaTypeIcon} />
                <span className={styles.novaContaTypeText}>{tipo.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Outros tipos de conta */}
        <div className={styles.novaContaCategorySection}>
          <h3 className={styles.novaContaCategoryTitle}>Outros tipos de conta</h3>
          <div className={styles.novaContaTypeGrid}>
            {tiposConta.filter(tipo => tipo.category === 'Outros tipos de conta').map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => handleTipoSelect(tipo.id)}
                className={cn(
                  styles.novaContaTypeCard,
                  selectedTipo === tipo.id ? styles.novaContaTypeCardSelected : ""
                )}
              >
                <tipo.icon className={styles.novaContaTypeIcon} />
                <span className={styles.novaContaTypeText}>{tipo.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepEscolhaIntegracao = () => (
    <div className={styles.novaContaIntegrationContainer}>
      {integracaoEscolhida === 'openfinance' ? (
        <div className={styles.novaContaIntegrationContent}>
          {/* Mostrar status da configuração do Inter */}
          {interEnabled && (
            <div className={styles.novaContaInterStatus}>
              <div className={styles.novaContaInterStatusHeader}>
                <Banknote className={styles.novaContaInterIcon} />
                <h3 className={styles.novaContaInterTitle}>Configuração do Inter</h3>
              </div>
              <div className={styles.novaContaInterDetails}>
                <p>✅ Integração com Banco Inter habilitada</p>
                <p>📋 Conta: {interData.conta_corrente || 'Não informada'}</p>
                <p>🏷️ Apelido: {interData.apelido || 'Não informado'}</p>
                <p>🌍 Ambiente: {interData.ambiente === 'prod' ? 'Produção' : 'Homologação'}</p>
                {interData.is_default && <p>⭐ Conta padrão do Inter</p>}
              </div>
            </div>
          )}
          <OpenFinancePluggy onSuccess={handleOpenFinanceSuccess} />
          
          {/* Botão para voltar e configurar Inter se necessário */}
          <div className={styles.novaContaBackButtonContainer}>
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className={styles.novaContaBackButton}
            >
              ← Voltar para configurar Inter
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h2 className={styles.novaContaIntegrationTitle}>
            Como deseja cadastrar sua conta?
          </h2>
          <div className={styles.novaContaIntegrationButtons}>
            <Button
              className={styles.novaContaIntegrationButton}
              onClick={() => {
                setIntegracaoEscolhida('openfinance');
                setCurrentStep(3); // Step 3: integração Open Finance
              }}
            >
              <span>Conectar via Open Finance</span>
              <span className={styles.novaContaIntegrationSubtitle}>Importação automática do extrato</span>
            </Button>
            <Button
              variant="outline"
              className={styles.novaContaIntegrationButtonOutline}
              onClick={() => {
                setIntegracaoEscolhida('manual');
                setCurrentStep(4); // Avança direto para a próxima etapa
              }}
            >
              <span>Continuar sem integração</span>
              <span className={styles.novaContaIntegrationSubtitle}>Cadastro manual da conta</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Substituir o placeholder pelo componente real
  const renderStepOpenFinance = () => (
    <div className={styles.novaContaOpenFinanceContainer}>
      <OpenFinancePluggy onSuccess={handleOpenFinanceSuccess} />
      <Button onClick={() => setCurrentStep(4)} className={styles.novaContaOpenFinanceButton}>Avançar para cadastro manual</Button>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.novaContaStepContainer}>
      <div className={styles.novaContaStepHeader}>
        <h2 className={styles.novaContaStepTitle}>
          {selectedTipo === 'caixinha' ? 'Cadastre sua caixinha' : 'Cadastre a conta corrente do seu banco'}
        </h2>
      </div>

      <div className={styles.novaContaFormContainer}>
        <div className={styles.novaContaIconContainer}>
          <div className={styles.novaContaAccountIconBg}>
            {formData.banco === 'Caixinha' ? (
              <div className={styles.novaContaCaixinhaIcon}>
                <Calculator className={styles.novaContaCaixinhaIconInner} />
              </div>
            ) : selectedBank?.institutionUrl ? (
              <img
                src={selectedBank.institutionUrl}
                alt={selectedBank.name}
                className={styles.novaContaBankIcon}
              />
            ) : (
              <FileText className={styles.novaContaDefaultIcon} />
            )}
          </div>
        </div>

        <div className={styles.novaContaFormContent}>
          <div className={styles.novaContaDescription}>
            {selectedTipo === 'caixinha' ? (
              <>
                <p>As <strong>caixinhas</strong> são contas virtuais para organizar suas finanças!</p>
                <p>Você pode criar diferentes caixinhas para objetivos específicos como viagem, emergência, investimentos, etc.</p>
                <p className={styles.novaContaDescriptionSpacing}>As caixinhas não possuem integração bancária automática, mas você pode importar extratos manualmente.</p>
              </>
            ) : (
              <>
                <p>Temos parceria com diversos bancos para <strong>integração bancária automática!</strong></p>
                <p>Com ela, seu extrato é importado automaticamente para a Straton.</p>
                <p className={styles.novaContaDescriptionSpacing}>Se o seu banco não tiver integração, você pode importar o arquivo do extrato manualmente.</p>
              </>
            )}
          </div>

          <div className={styles.novaContaFormFields}>
            <h3 className={styles.novaContaFormSectionTitle}>
              {selectedTipo === 'caixinha' ? 'Informe o nome da sua caixinha' : 'Informe seu banco e crie um apelido para esta conta'}
            </h3>

            <div className={styles.novaContaFormGrid}>
              <div className={styles.novaContaField}>
                <Label htmlFor="banco" className={styles.novaContaLabel}>
                  {selectedTipo === 'caixinha' ? 'Tipo de Caixinha *' : 'Banco *'}
                </Label>
                <ReactSelect
                  options={
                    selectedTipo === 'caixinha' 
                      ? [
                          // Apenas Caixinha quando tipo caixinha for selecionado
                          {
                            value: 'Caixinha',
                            label: (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
                                  <Calculator className="w-3 h-3 text-white" />
                                </div>
                                <span>Caixinha</span>
                              </div>
                            ),
                            raw: { id: 'caixinha', name: 'Caixinha', institutionUrl: null }
                          }
                        ]
                      : [
                          // Apenas opções dos conectores (bancos) para outros tipos
                          ...connectors.map((item) => ({
                            value: item.name,
                            label: (
                              <div className="flex items-center gap-2">
                                {item.institutionUrl && (
                                  <img
                                    src={item.institutionUrl}
                                    alt={item.name}
                                    className="w-5 h-5 rounded-full"
                                  />
                                )}
                                <span>{item.name}</span>
                              </div>
                            ),
                            raw: item, // salva o objeto original se precisar
                          }))
                        ]
                  }
                  value={
                    formData.banco === 'Caixinha' 
                      ? {
                          value: 'Caixinha',
                          label: (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center">
                                <Calculator className="w-3 h-3 text-white" />
                              </div>
                              <span>Caixinha</span>
                            </div>
                          ),
                          raw: { id: 'caixinha', name: 'Caixinha', institutionUrl: null }
                        }
                      : connectors
                          .map((item) => ({
                            value: item.name,
                            label: (
                              <div className="flex items-center gap-2">
                                {item.institutionUrl && (
                                  <img
                                    src={item.institutionUrl}
                                    alt={item.name}
                                    className="w-5 h-5 rounded-full"
                                  />
                                )}
                                <span>{item.name}</span>
                              </div>
                            ),
                            raw: item,
                          }))
                          .find((opt) => opt.value === formData.banco) || null
                  }
                  onChange={(selected) => {
                    if (selected) {
                      handleInputChange('banco', selected.value);
                      setSelectedBank(selected.raw);
                    } else {
                      handleInputChange('banco', '');
                      setSelectedBank(null);
                    }
                  }}
                  placeholder={selectedTipo === 'caixinha' ? "Selecione o tipo de caixinha" : "Selecione o banco ou Caixinha"}
                  isClearable
                  className={styles.novaContaReactSelect}
                  classNamePrefix="react-select"
                />
              </div>

              <div className={styles.novaContaField}>
                <Label htmlFor="descricao" className={styles.novaContaLabel}>Descrição *</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => handleInputChange('descricao', e.target.value)}
                  placeholder="Ex: Itaú - Conta Corrente"
                  required
                  className={styles.novaContaInput}
                />
              </div>

              {selectedTipo !== 'caixinha' && (
                <>
                  <div className={styles.novaContaField}>
                    <Label htmlFor="agencia" className={styles.novaContaLabel}>Agência *</Label>
                    <Input
                      id="agencia"
                      value={formData.agencia}
                      onChange={(e) => handleInputChange('agencia', e.target.value)}
                      placeholder="Digite a agência"
                      required
                      className={styles.novaContaInput}
                    />
                  </div>

                  <div className={styles.novaContaField}>
                    <Label htmlFor="numero_conta" className={styles.novaContaLabel}>Número da Conta *</Label>
                    <Input
                      id="numero_conta"
                      value={formData.numero_conta}
                      onChange={(e) => handleInputChange('numero_conta', e.target.value)}
                      placeholder="Digite o número da conta"
                      required
                      className={styles.novaContaInput}
                    />
                  </div>
                </>
              )}
            </div>


            {selectedTipo !== 'caixinha' && (
              <div className={styles.novaContaCheckboxGroup}>
                <Checkbox
                  id="pf"
                  checked={tipoContaPessoa === 'pf'}
                  onCheckedChange={() => handleTipoContaPessoa('pf')}
                  className={styles.novaContaCheckbox}
                />
                <Label htmlFor="pf" className={styles.novaContaCheckboxLabel}>
                  Pessoa Física
                </Label>

                <Checkbox
                  id="pj"
                  checked={tipoContaPessoa === 'pj'}
                  onCheckedChange={() => handleTipoContaPessoa('pj')}
                  className={styles.novaContaCheckbox}
                />
                <Label htmlFor="pj" className={styles.novaContaCheckboxLabel}>
                  Pessoa Jurídica
                </Label>
              </div>
            )}

            {/* Seção de configuração do Inter - apenas para contas bancárias */}
            {selectedTipo && selectedTipo !== 'caixinha' && (
              <div className={styles.novaContaInterSection}>
                <div className={styles.novaContaInterHeader}>
                  <Checkbox
                    id="inter_enabled"
                    checked={interEnabled}
                    onCheckedChange={(checked) => setInterEnabled(checked)}
                    className={styles.novaContaCheckbox}
                  />
                  <div className={styles.novaContaInterTitleContainer}>
                    <Banknote className={styles.novaContaInterIcon} />
                    <Label htmlFor="inter_enabled" className={styles.novaContaInterTitle}>
                      Habilitar integração com Banco Inter
                    </Label>
                  </div>
                </div>
                
                <p className={styles.novaContaInterDescription}>
                  Configure a integração com o Banco Inter para automatizar a geração de boletos e sincronização de transações.
                </p>

              {interEnabled && (
                <div className={styles.novaContaInterForm}>
                  <div className={styles.novaContaInterGrid}>
                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_client_id" className={styles.novaContaLabel}>Client ID *</Label>
                      <Input
                        id="inter_client_id"
                        value={interData.client_id}
                        onChange={(e) => setInterData(prev => ({ ...prev, client_id: e.target.value }))}
                        placeholder="Digite o Client ID do Inter"
                        required
                        className={styles.novaContaInput}
                      />
                    </div>

                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_client_secret" className={styles.novaContaLabel}>Client Secret *</Label>
                      <Input
                        id="inter_client_secret"
                        type="password"
                        value={interData.client_secret}
                        onChange={(e) => setInterData(prev => ({ ...prev, client_secret: e.target.value }))}
                        placeholder="Digite o Client Secret do Inter"
                        required
                        className={styles.novaContaInput}
                      />
                    </div>

                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_conta_corrente" className={styles.novaContaLabel}>Conta Corrente *</Label>
                      <Input
                        id="inter_conta_corrente"
                        value={interData.conta_corrente}
                        onChange={(e) => setInterData(prev => ({ ...prev, conta_corrente: e.target.value }))}
                        placeholder="Digite o número da conta corrente"
                        required
                        className={styles.novaContaInput}
                      />
                    </div>

                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_apelido" className={styles.novaContaLabel}>Apelido da Conta</Label>
                      <Input
                        id="inter_apelido"
                        value={interData.apelido}
                        onChange={(e) => setInterData(prev => ({ ...prev, apelido: e.target.value }))}
                        placeholder="Ex: Conta Principal"
                        className={styles.novaContaInput}
                      />
                    </div>
                  </div>

                  <div className={styles.novaContaInterGrid}>
                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_ambiente" className={styles.novaContaLabel}>Ambiente</Label>
                      <Select
                        value={interData.ambiente}
                        onValueChange={(value) => setInterData(prev => ({ ...prev, ambiente: value }))}
                      >
                        <SelectTrigger className={styles.novaContaSelect}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={styles.novaContaSelectContent}>
                          <SelectItem value="prod">Produção</SelectItem>
                          <SelectItem value="hml">Homologação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_status" className={styles.novaContaLabel}>Status</Label>
                      <Select
                        value={interData.status}
                        onValueChange={(value) => setInterData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger className={styles.novaContaSelect}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={styles.novaContaSelectContent}>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className={styles.novaContaInterOptions}>
                    <div className={styles.novaContaCheckboxGroup}>
                      <Checkbox
                        id="inter_is_default"
                        checked={interData.is_default}
                        onCheckedChange={(checked) => setInterData(prev => ({ ...prev, is_default: checked }))}
                        className={styles.novaContaCheckbox}
                      />
                      <Label htmlFor="inter_is_default" className={styles.novaContaCheckboxLabel}>
                        Definir como conta padrão do Inter
                      </Label>
                    </div>
                  </div>

                  <div className={styles.novaContaInterGrid}>
                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_cert_file" className={styles.novaContaLabel}>Certificado (.crt) *</Label>
                      <Input
                        id="inter_cert_file"
                        type="file"
                        accept=".crt,.pem"
                        onChange={(e) => handleInterFileChange('cert_file', e.target.files?.[0] || null)}
                        required
                        className={styles.novaContaFileInput}
                      />
                      <p className={styles.novaContaFileDescription}>Arquivo de certificado do Inter</p>
                    </div>

                    <div className={styles.novaContaField}>
                      <Label htmlFor="inter_key_file" className={styles.novaContaLabel}>Chave Privada (.key) *</Label>
                      <Input
                        id="inter_key_file"
                        type="file"
                        accept=".key,.pem"
                        onChange={(e) => handleInterFileChange('key_file', e.target.files?.[0] || null)}
                        required
                        className={styles.novaContaFileInput}
                      />
                      <p className={styles.novaContaFileDescription}>Arquivo de chave privada do Inter</p>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}

          </div>

          {/* <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-16 h-12 bg-blue-500 rounded flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Precisa de ajuda?</h4>
                <a href="#" className="text-blue-600 text-sm hover:underline">
                  Como cadastrar uma conta corrente
                </a>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );

  const fileInputRef = useRef(null);

  const [inicioLancamento, setInicioLancamento] = useState('');
  const [saldoBancario, setSaldoBancario] = useState('');
  const [showSaldoFields, setShowSaldoFields] = useState(false);


  const renderStep3 = () => (
    <div className={styles.novaContaStepContainer}>
      <div className={styles.novaContaStepHeader}>
        <h2 className={styles.novaContaStepTitle}>
          {selectedTipo === 'caixinha' ? 'Finalizar cadastro da sua caixinha' : 'Vamos importar seu extrato para a Straton?'}
        </h2>
        <p className={styles.novaContaStepSubtitle}>
          {selectedTipo === 'caixinha' 
            ? 'Sua caixinha será criada e você poderá importar extratos manualmente quando necessário.'
            : 'Importe seu extrato para gerenciar todos os seus pagamentos e recebimentos.'
          }
        </p>
      </div>

      <div className={styles.novaContaStepContent}>
        <div className={styles.novaContaInfoCard}>
          {selectedTipo === 'caixinha' ? (
            <>
              <p className={styles.novaContaInfoText}>
                As caixinhas são contas virtuais para organizar suas finanças. Você pode criar diferentes caixinhas para objetivos específicos.
              </p>
              <p className={styles.novaContaInfoText}>
                Após criar sua caixinha, você poderá importar extratos manualmente quando necessário.
              </p>
            </>
          ) : (
            <>
              <p className={styles.novaContaInfoText}>
                Nós aceitamos extratos no formato OFX/Money 2000 (que é um tipo de arquivo,
                assim como PDF e XLS).
              </p>
              <p className={styles.novaContaInfoText}>
                Siga o passo a passo abaixo para continuar:
              </p>
            </>
          )}

          <div className={styles.novaContaUploadContainer}>
            <div className={styles.novaContaUploadIcon}>
              <FileText className={styles.novaContaUploadIconInner} />
            </div>
            <div className={styles.novaContaUploadContent}>
              {selectedTipo === 'caixinha' ? (
                <div className={styles.novaContaButtonGroup}>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSaldoFields(true)}
                    className={styles.novaContaSecondaryButton}
                  >
                    Finalizar cadastro da caixinha
                  </Button>
                </div>
              ) : (
                <div className={styles.novaContaButtonGroup}>
                  <Button
                    className={cn(
                      styles.novaContaPrimaryButton,
                      ofxBase64 && styles.novaContaPrimaryButtonSelected
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className={styles.novaContaButtonIcon} />
                    {ofxBase64 ? 'Arquivo selecionado ✓' : 'Importar arquivo'}
                  </Button>
                  <input
                    type="file"
                    accept=".ofx"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  <Button 
                    variant="outline" 
                    onClick={() => setShowSaldoFields(true)}
                    disabled={!!ofxBase64}
                    className={styles.novaContaSecondaryButton}
                  >
                    Continuar sem importação
                  </Button>
                </div>
              )}

              {/* Campos de saldo e início de lançamentos */}
              <div className={cn(
                styles.novaContaSaldoFields,
                showSaldoFields ? styles.novaContaSaldoFieldsVisible : styles.novaContaSaldoFieldsHidden
              )}>
                <div className={styles.novaContaSaldoGrid}>
                  <div className={styles.novaContaField}>
                    <Label htmlFor="inicio_lancamento" className={styles.novaContaLabel}>Início dos lançamentos na Straton</Label>
                    <Input
                      id="inicio_lancamento"
                      placeholder="DD/MM/AAAA"
                      value={inicioLancamento}
                      onChange={(e) => setInicioLancamento(e.target.value)}
                      required={showSaldoFields}
                      className={styles.novaContaInput}
                    />
                    <p className={styles.novaContaFieldDescription}>Informe uma data com formato dd/mm/aaaa.</p>
                  </div>

                  <div className={styles.novaContaField}>
                    <Label htmlFor="saldo_bancario" className={styles.novaContaLabel}>Saldo final bancário *</Label>
                    <Input
                      id="saldo_bancario"
                      placeholder="R$"
                      value={saldoBancario}
                      onChange={(e) => setSaldoBancario(e.target.value)}
                      required={showSaldoFields}
                      className={styles.novaContaInput}
                    />
                  </div>
                </div>

                {/* Botão para fechar os campos */}
                <div className={styles.novaContaHideButtonContainer}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaldoFields(false);
                      // Limpar campos quando fechar (opcional)
                      if (!ofxBase64) {
                        setInicioLancamento('');
                        setSaldoBancario('');
                      }
                    }}
                    className={styles.novaContaHideButton}
                  >
                    <ChevronUp className={styles.novaContaHideButtonIcon} />
                    Ocultar campos
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className={styles.novaContaStepContainer}>
      {selectedTipo === 'caixinha' ? (
        <div className={styles.novaContaSuccessContainer}>
          <div className={styles.novaContaSuccessIcon}>
            <CheckCircle className={styles.novaContaSuccessIconInner} />
          </div>
          <h2 className={styles.novaContaSuccessTitle}>
            Caixinha cadastrada com sucesso!
          </h2>
          <p className={styles.novaContaSuccessSubtitle}>
            Sua caixinha foi criada e está pronta para uso.
          </p>
        </div>
      ) : (
        <div className={styles.novaContaSuccessContainer}>
          <div className={styles.novaContaSuccessIcon}>
            <CheckCircle className={styles.novaContaSuccessIconInner} />
          </div>
          <h2 className={styles.novaContaSuccessTitle}>
            Conta cadastrada com sucesso!
          </h2>
          <p className={styles.novaContaSuccessSubtitle}>
            Sua conta foi criada e está pronta para uso.
          </p>
        </div>
      )}

      <div className={styles.novaContaSummaryCard}>
        <h3 className={styles.novaContaSummaryTitle}>Resumo da conta:</h3>
        <div className={styles.novaContaSummaryContent}>
          <div className={styles.novaContaSummaryRow}>
            <span className={styles.novaContaSummaryLabel}>Tipo:</span>
            <span className={styles.novaContaSummaryValue}>Conta Corrente</span>
          </div>
          <div className={styles.novaContaSummaryRow}>
            <span className={styles.novaContaSummaryLabel}>Banco:</span>
            <span className={styles.novaContaSummaryValue}>{formData.banco || 'Não informado'}</span>
          </div>
          <div className={styles.novaContaSummaryRow}>
            <span className={styles.novaContaSummaryLabel}>Descrição:</span>
            <span className={styles.novaContaSummaryValue}>{formData.descricao || 'Não informado'}</span>
          </div>
          <div className={styles.novaContaSummaryRow}>
            <span className={styles.novaContaSummaryLabel}>Conta padrão:</span>
            <span className={styles.novaContaSummaryValue}>{formData.contaPadrao ? 'Sim' : 'Não'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  async function handleOpenFinanceSuccess(itemId) {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const company_id = userData.EmpresaId;
      const cliente_id = userData.id ? Number(userData.id) : null;

      // Preparar dados do Inter se habilitado
      let interCertB64 = null;
      let interKeyB64 = null;

      if (interEnabled && interData.cert_file && interData.key_file) {
        try {
          const certB64 = await convertFileToBase64(interData.cert_file);
          const keyB64 = await convertFileToBase64(interData.key_file);
          interCertB64 = certB64;
          interKeyB64 = keyB64;
        } catch (error) {
          console.error('Erro ao converter arquivos do Inter:', error);
          toast.error('Erro ao processar arquivos do Inter. Tente novamente.');
          return;
        }
      }

      // 1. Primeiro, buscar as contas do item para pegar o account
      const resSync = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/contas/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId,
          company_id,
          cliente_id
        }),
      });
      
      const syncData = await resSync.json();
      const accounts = syncData.accounts || [];
      
      // Pegar o primeiro account disponível (ou gerar um UUID se não houver)
      const accountId = accounts.length > 0 ? accounts[0].account : `account-${Date.now()}`;

      // 2. Criar conta APENAS na tabela contas-api (OpenFinance não cria na tradicional)
      const resConta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/contas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          company_id,
          cliente_id,
          banco: formData.banco,
          descricao_banco: formData.descricao,
          tipo_conta: tipoContaPessoa,
          numero_conta: formData.numero_conta,
          tipo: selectedTipo,
          agencia: formData.agencia,
          account: accountId, // Adicionar o account
          
          // Campos do Inter
          inter_enabled: interEnabled,
          inter_client_id: interEnabled ? interData.client_id : null,
          inter_client_secret: interEnabled ? interData.client_secret : null,
          inter_cert_b64: interEnabled ? interCertB64 : null,
          inter_key_b64: interEnabled ? interKeyB64 : null,
          inter_conta_corrente: interEnabled ? interData.conta_corrente : null,
          inter_apelido: interEnabled ? interData.apelido : null,
          inter_ambiente: interEnabled ? interData.ambiente : 'prod',
          inter_is_default: interEnabled ? interData.is_default : false,
          inter_status: interEnabled ? interData.status : 'ativo'
        }),
      });
      const contaData = await resConta.json();
      console.log('Conta API criada via OpenFinance:', contaData);

      // 3. Se a conta foi criada com sucesso, sincronizar transações
      if (contaData.id && accounts.length > 0) {
        // Sincronizar transações para cada conta
        for (const acc of accounts) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transacoes-api/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ accountId: acc.account, company_id, cliente_id }),
          });
        }
      }

      // Toast de sucesso e callback
      toast.success('Conta OpenFinance criada com sucesso!');
      
      // Notificar sucesso para atualizar a lista de contas
      if (onSuccess) {
        onSuccess();
      }

      setCurrentStep(5); // Sucesso
    } catch (error) {
      toast.error("Erro ao sincronizar transações. Tente novamente.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.novaContaOverlay}>
      <div className={styles.novaContaModal}>
        {/* Header */}
        <div className={styles.novaContaHeader}>
          <h1 className={styles.novaContaTitle}>Nova conta financeira</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={styles.novaContaCloseButton}
          >
            <X className={styles.novaContaIcon} />
          </Button>
        </div>
        {/* Content */}
        <div className={styles.novaContaContent}>
          <Stepper currentStep={currentStep} steps={steps} />

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && selectedTipo !== 'caixinha' && renderStepEscolhaIntegracao()}
          {currentStep === 4 && renderStep3()}
          {currentStep === 5 && renderStep4()}
        </div>
        {/* Footer */}
        <div className={styles.novaContaFooter}>
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 1) onClose();
              else setCurrentStep(currentStep - 1);
            }}
            disabled={isLoading}
            className={styles.novaContaSecondaryButton}
          >
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {/* Botão avançar/continuar */}
          {currentStep === 1 && (
            <Button
              onClick={() => selectedTipo && setCurrentStep(2)}
              disabled={!selectedTipo}
              className={styles.novaContaPrimaryButton}
            >
              Continuar
            </Button>
          )}
          {currentStep === 2 && (
            <Button
              onClick={() => setCurrentStep(selectedTipo === 'caixinha' ? 4 : 3)}
              disabled={isLoading || (selectedTipo !== 'caixinha' && !tipoContaPessoa)}
              className={styles.novaContaPrimaryButton}
            >
              Continuar
            </Button>
          )}
          {currentStep === 3 && integracaoEscolhida === 'manual' && (
            <Button
              onClick={() => setCurrentStep(4)}
              disabled={isLoading}
              className={styles.novaContaPrimaryButton}
            >
              Continuar
            </Button>
          )}
          {currentStep === 4 && (
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className={styles.novaContaPrimaryButton}
            >
              Finalizar
            </Button>
          )}
          {currentStep === 5 && (
            <Button
              onClick={onClose}
              className={styles.novaContaPrimaryButton}
            >
              Concluir
            </Button>
          )}
          {isLoading && (
            <div className={styles.novaContaLoading}>
              <div className={styles.novaContaLoadingSpinner}></div>
              <span>Criando conta...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}