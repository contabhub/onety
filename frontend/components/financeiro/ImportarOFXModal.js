import { useState, useRef } from 'react';
import { Button } from './botao';
import styles from '../../styles/financeiro/importar-ofx.module.css';
import { Input } from './input';
import { Label } from './label';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ImportarOFXModal({ isOpen, onClose, onImportSuccess, tipo }) {
  const [ofxBase64, setOfxBase64] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensão do arquivo
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      toast.error('Por favor, selecione um arquivo no formato OFX.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      setOfxBase64(base64String);
      setSelectedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleImport = async () => {
    if (!ofxBase64) {
      toast.error('Por favor, selecione um arquivo OFX para importar.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      if (!token || !empresaId) {
        toast.error('Token ou ID da empresa não encontrado.');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ofx-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          arquivoBase64: ofxBase64,
          company_id: empresaId,
          tipo: tipo // 'pagar' ou 'receber'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao importar arquivo OFX');
      }

      const result = await response.json();
      console.log('OFX importado:', result);
      
      toast.success('Arquivo OFX importado com sucesso!');
      onImportSuccess();
      handleClose();
    } catch (error) {
      console.error('Erro ao importar OFX:', error);
      toast.error('Erro ao importar arquivo OFX. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOfxBase64(null);
    setSelectedFileName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.importarOfxOverlay}>
      <div className={styles.importarOfxModal}>
        {/* Header */}
        <div className={styles.importarOfxHeader}>
          <h1 className={styles.importarOfxTitle}>
            Importar arquivo OFX - Contas a {tipo === 'pagar' ? 'pagar' : 'receber'}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className={styles.importarOfxCancelBtn}
          >
            <X className={styles.importarOfxIcon} />
          </Button>
        </div>

        {/* Content */}
        <div className={styles.importarOfxContent}>
          <div className={styles.importarOfxSpaceY}>
            <div className={styles.importarOfxTextCenter}>
              <p className={styles.importarOfxDescription}>
                Importe seu extrato bancário no formato OFX para gerenciar suas contas a {tipo === 'pagar' ? 'pagar' : 'receber'}.
              </p>
            </div>

            <Card className={styles.importarOfxCard}>
              <CardContent>
                <div className={styles.importarOfxFlexStart}>
                  <div className={styles.importarOfxCardIconBg}>
                    <FileText className={styles.importarOfxIcon} />
                  </div>
                  <div className={styles.importarOfxFlex1}>
                    <div className={styles.importarOfxSpaceY}>
                      <div>
                        <h3 className={styles.importarOfxCardTitle}>
                          Selecione o arquivo OFX
                        </h3>
                        <p className={styles.importarOfxCardText}>
                          Nós aceitamos extratos no formato OFX/Money 2000. 
                          O arquivo será processado e as transações serão importadas automaticamente.
                        </p>
                      </div>

                      <div className={styles.importarOfxGap}>
                        <Button
                          className={styles.importarOfxSelectBtn}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                        >
                          <Upload className={styles.importarOfxIcon} />
                          {ofxBase64 ? 'Arquivo selecionado ✓' : 'Selecionar arquivo OFX'}
                        </Button>
                        <input
                          type="file"
                          accept=".ofx"
                          ref={fileInputRef}
                          className={styles.importarOfxHidden}
                          onChange={handleFileChange}
                        />
                      </div>

                      {selectedFileName && (
                        <div className={styles.importarOfxFileSelected}>
                          <CheckCircle className={styles.importarOfxIcon} />
                          <span className={styles.importarOfxFileText}>{selectedFileName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className={styles.importarOfxTip}>
              <div className={styles.importarOfxFlexStart}>
                <div className={styles.importarOfxTipIcon}>
                  <div className={styles.importarOfxTipDot}></div>
                </div>
                <div>
                  <h4 className={styles.importarOfxTipTitle}>Dica importante</h4>
                  <p className={styles.importarOfxDescription}>
                    Certifique-se de que o arquivo OFX contém as transações do período desejado. 
                    Após a importação, você poderá revisar e categorizar as transações importadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.importarOfxFooter}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className={styles.importarOfxCancelBtn}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleImport}
            disabled={!ofxBase64 || isLoading}
            className={styles.importarOfxImportBtn}
          >
            {isLoading ? 'Importando...' : 'Importar arquivo'}
          </Button>
        </div>
      </div>
    </div>
  );
} 