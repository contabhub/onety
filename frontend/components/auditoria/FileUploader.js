import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import styles from '../../styles/auditoria/FileUploader.module.css';

const FileUploader = ({
  acceptedFileTypes = ['.zip', '.pdf'],
  fileType,
  onFileProcessed,
  maxSize = 5242880, // 5MB default
}) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError(null);
      setProgress(0);
      
      if (acceptedFiles.length === 0) {
        return;
      }

      const selectedFile = acceptedFiles[0];
      
      if (selectedFile.size > maxSize) {
        setError(`Arquivo muito grande. Tamanho máximo: ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
        return;
      }

      setFile(selectedFile);
      setUploading(true);
      
      try {
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 300);

        clearInterval(progressInterval);
        setProgress(100);
        onFileProcessed(selectedFile, fileType);
      } catch (err) {
        setError(err.message || 'Erro ao processar o arquivo');
        setProgress(0);
      } finally {
        setUploading(false);
      }
    },
    [fileType, maxSize, onFileProcessed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip']
    },
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    setFile(null);
    setError(null);
    setProgress(0);
  };

  const getFileTypeLabel = () => {
    switch (fileType) {
      case 'SPED_FISCAL': return 'SPED Fiscal';
      case 'SPED_CONTRIBUICOES': return 'SPED Contribuições';
      case 'ECD': return 'ECD';
      case 'ECF': return 'ECF';
      case 'INVOICE_ZIP': return 'Notas Fiscais (ZIP)';
      default: return 'Arquivo';
    }
  };

  const dropzoneClassName = [
    styles.dropzone,
    isDragActive ? styles.dropzoneActive : '',
  ].join(' ').trim();

  const dropzoneIconClass = [
    styles.dropzoneIcon,
    isDragActive ? styles.dropzoneIconActive : '',
  ].join(' ').trim();

  return (
    <div className={styles.container}>
      {!file ? (
        <div
          {...getRootProps()}
          className={dropzoneClassName}
        >
          <input {...getInputProps()} />
          <Upload className={dropzoneIconClass} />
          <p className={styles.dropzoneTitle}>
            {isDragActive ? 'Solte o arquivo aqui' : `Arraste ou clique para fazer upload do ${getFileTypeLabel()}`}
          </p>
          <p className={styles.dropzoneHint}>
            {acceptedFileTypes.join(', ')} (Max: {(maxSize / 1024 / 1024).toFixed(1)}MB)
          </p>
        </div>
      ) : (
        <div className={styles.fileCard}>
          <div className={styles.fileHeader}>
            <div className={styles.fileInfo}>
              <FileText className={styles.fileIcon} />
              <div className={styles.fileDetails}>
                <p className={styles.fileName}>
                  {file.name}
                </p>
                <p className={styles.fileSize}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className={styles.removeButton}
            >
              <X className={styles.fileIconSmall} />
            </button>
          </div>
          
          {uploading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressTrack}>
                <div 
                  className={styles.progressBar}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className={styles.progressText}>
                {progress < 100 ? 'Processando...' : 'Concluído!'}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;

