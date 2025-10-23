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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className={cn(styles.importarOfxModal, "w-full max-w-2xl rounded-lg shadow-xl animate-in slide-in-from-bottom-4 duration-300")}>
        {/* Header */}
        <div className={cn(styles.importarOfxHeader, "flex items-center justify-between p-6")}>
          <h1 className={cn(styles.importarOfxTitle, "text-xl font-semibold")}>
            Importar arquivo OFX - Contas a {tipo === 'pagar' ? 'pagar' : 'receber'}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className={cn(styles.importarOfxTitle, "h-8 w-8 p-0 hover:importar-ofx-description")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className={cn(styles.importarOfxDescription, "mb-4")}>
              Importe seu extrato bancário no formato OFX para gerenciar suas contas a {tipo === 'pagar' ? 'pagar' : 'receber'}.
            </p>
          </div>

          <Card className={styles.importarOfxCard}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={cn(styles.importarOfxCardIconBg, "w-16 h-16 rounded-lg flex items-center justify-center")}>
                  <FileText className={cn(styles.importarOfxIcon, "w-8 h-8")} />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className={cn(styles.importarOfxCardTitle, "text-lg font-medium mb-2")}>
                      Selecione o arquivo OFX
                    </h3>
                    <p className={cn(styles.importarOfxCardText, "text-sm mb-4")}>
                      Nós aceitamos extratos no formato OFX/Money 2000. 
                      O arquivo será processado e as transações serão importadas automaticamente.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className={cn(
                        styles.importarOfxSelectBtn,
                        ofxBase64 && "bg-primary/80"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Upload className={cn(styles.importarOfxIcon, "w-4 h-4 mr-2")} />
                      {ofxBase64 ? 'Arquivo selecionado ✓' : 'Selecionar arquivo OFX'}
                    </Button>
                    <input
                      type="file"
                      accept=".ofx"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </div>

                  {selectedFileName && (
                    <div className={cn(styles.importarOfxFileSelected, "flex items-center gap-2 p-3 rounded-lg")}>
                      <CheckCircle className={cn(styles.importarOfxIcon, "w-4 h-4")} />
                      <span className={cn(styles.importarOfxFileText, "text-sm")}>{selectedFileName}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className={cn(styles.importarOfxTip, "rounded-lg p-4")}>
            <div className="flex items-start gap-3">
              <div className={cn(styles.importarOfxTipIcon, "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5")}>
                <div className="h-2 w-2 bg-white rounded-full"></div>
              </div>
              <div>
                <h4 className={cn(styles.importarOfxTipTitle, "font-medium mb-1")}>Dica importante</h4>
                <p className={cn(styles.importarOfxDescription, "text-sm")}>
                  Certifique-se de que o arquivo OFX contém as transações do período desejado. 
                  Após a importação, você poderá revisar e categorizar as transações importadas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(styles.importarOfxFooter, "flex items-center justify-between p-6")}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className={cn(styles.importarOfxCancelBtn, "px-8 py-2 text-base font-semibold")}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleImport}
            disabled={!ofxBase64 || isLoading}
            className={cn(styles.importarOfxImportBtn, "px-8 py-2 text-base font-semibold disabled:opacity-50")}
          >
            {isLoading ? 'Importando...' : 'Importar arquivo'}
          </Button>
        </div>
      </div>
    </div>
  );
} 