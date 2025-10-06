import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, UserCheck, Smile, Mic, MicOff, Square, RotateCcw, Paperclip, FileText, Image, Video, File, Music, X, Trash2, Forward } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import styles from './MessageComposer.module.css';

export default function MessageComposer({ 
  conversationId, 
  onMessageSent, 
  selectedConversation, 
  hasAssignedUser,
  onAssumeConversation,
  selectionMode = false,
  selectedMessages = [],
  onExitSelectionMode = () => {},
  onForwardMessages = () => {},
  onDeleteMessages = () => {}
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [assuming, setAssuming] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sendingVideo, setSendingVideo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [sendingDocument, setSendingDocument] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [companyStatus, setCompanyStatus] = useState(null);
  
  const emojiPickerRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Função para verificar se a empresa está cancelada
  const isCompanyCanceled = () => {
    if (!companyStatus) return false;
    return String(companyStatus).toLowerCase().includes('cancel');
  };

  // Função para verificar se o usuário pode enviar mensagens
  const canSendMessages = () => {
    if (!selectedConversation) return false;
    
    // Se a empresa está cancelada, não pode enviar
    if (isCompanyCanceled()) return false;
    
    // Se não há usuário atribuído, pode enviar
    if (!hasAssignedUser) return true;
    
    // Verificar se o usuário atual é o responsável pela conversa
    const currentUserId = (JSON.parse(localStorage.getItem('userData') || '{}').id);
    const assignedUserId = selectedConversation.assigned_user_id;
    
    if (String(currentUserId) === String(assignedUserId)) {
      return true; // É o responsável
    }
    
    // Verificar se é Admin/Superadmin por múltiplas fontes
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const roleCandidates = [userData?.userRole, userData?.nivel].filter(Boolean).map(r => String(r).toLowerCase());
    const permsAdm = Array.isArray(userData?.permissoes?.adm) ? userData.permissoes.adm.map(v => String(v).toLowerCase()) : [];
    const isAdminUser = roleCandidates.includes('superadmin') || roleCandidates.includes('administrador') || roleCandidates.includes('admin') || permsAdm.includes('superadmin') || permsAdm.includes('administrador') || permsAdm.includes('admin');
    
    console.log('🔍 Verificação de permissões:', {
      currentUserId,
      assignedUserId,
      roleCandidates,
      permsAdm,
      hasAssignedUser,
      companyStatus,
      isCanceled: isCompanyCanceled(),
      isAdminUser
    });
    
    if (isAdminUser) {
      return true; // Admin/Superadmin sempre podem enviar
    }
    
    return false; // Não pode enviar
  };

  // Buscar status da empresa
  useEffect(() => {
    const fetchCompanyStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId || JSON.parse(localStorage.getItem('userData') || '{}').companyId;
        
        if (!token || !companyId) return;
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/company/${companyId}`, {
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        setCompanyStatus(data.status || null);
        
        console.log('🏢 Status da empresa carregado:', data.status);
      } catch (err) {
        console.error('❌ Erro ao buscar status da empresa:', err);
      }
    };
    
    fetchCompanyStatus();
  }, []);

  // Fechar seletor ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
    };

    if (showEmojiPicker || showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showAttachmentMenu]);

  // Função para inserir emoji no texto
  const handleEmojiClick = (emojiObject) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emojiObject.emoji + message.slice(end);
      setMessage(newMessage);
      
      // Reposicionar cursor após o emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emojiObject.emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(prev => prev + emojiObject.emoji);
    }
    setShowEmojiPicker(false);
  };

  // Função para alternar seletor de emojis
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
    setShowAttachmentMenu(false); // Fechar menu de anexos
  };

  // Função para alternar menu de anexos
  const toggleAttachmentMenu = () => {
    setShowAttachmentMenu(prev => !prev);
    setShowEmojiPicker(false); // Fechar seletor de emojis
  };

  // Função para abrir seletor de arquivos
  const openFileSelector = (type) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type;
      fileInputRef.current.click();
    }
    setShowAttachmentMenu(false);
  };

  // Função para lidar com seleção de arquivo
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.type;
    
    // Verificar se é uma imagem
    if (fileType.startsWith('image/')) {
      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setSelectedImage(file);
        // Limpar outros arquivos se houver
        setSelectedVideo(null);
        setVideoPreview(null);
        setSelectedDocument(null);
        setDocumentPreview(null);
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('video/')) {
      // Criar preview do vídeo
      const reader = new FileReader();
      reader.onload = (e) => {
        setVideoPreview(e.target.result);
        setSelectedVideo(file);
        // Limpar outros arquivos se houver
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedDocument(null);
        setDocumentPreview(null);
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('application/') || fileType.startsWith('text/')) {
      // Criar preview do documento
      setDocumentPreview({
        name: file.name,
        size: file.size,
        type: file.type
      });
      setSelectedDocument(file);
      // Limpar outros arquivos se houver
      setSelectedImage(null);
      setImagePreview(null);
      setSelectedVideo(null);
      setVideoPreview(null);
    } else {
      alert('Tipo de arquivo não suportado. Por favor, selecione uma imagem, vídeo ou documento.');
    }

    // Limpar input
    event.target.value = '';
  };

  // Função para converter arquivo para data URI
  const fileToDataURI = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Função para enviar imagem
  const sendImage = async () => {
    if (!conversationId || !selectedConversation || !selectedImage) return;

    setSendingImage(true);
    try {
      const token = localStorage.getItem('token');
      const instanceName = selectedConversation.instance_name;
      const customerPhone = selectedConversation.customer_phone;
      const senderId = (JSON.parse(localStorage.getItem('userData') || '{}').id);

      if (!instanceName || !customerPhone) {
        throw new Error('Informações da instância ou telefone do cliente não encontradas');
      }

      // Converter imagem para data URI
      const imageDataURI = await fileToDataURI(selectedImage);

      console.log('📸 Enviando imagem:', {
        instanceName,
        customerPhone,
        imageSize: selectedImage.size,
        imageType: selectedImage.type,
        fileName: selectedImage.name,
        dataURIPrefix: imageDataURI.substring(0, 50) + '...',
        isDataURI: imageDataURI.startsWith('data:')
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send-media`,
        {
          instanceName,
          number: customerPhone,
          mediaMessage: {
            mediatype: 'image',
            media: imageDataURI,
            caption: message.trim() || null, // Usar mensagem atual como legenda se houver
            fileName: selectedImage.name,
            mimetype: selectedImage.type
          },
          options: {
            delay: 1200,
            presence: "composing"
          },
          sender_id: senderId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('📸 Imagem enviada:', response.data);
      
      // Limpar preview e imagem selecionada
      setImagePreview(null);
      setSelectedImage(null);
      
      // Limpar mensagem se foi usada como legenda
      if (message.trim()) {
        setMessage('');
      }

    } catch (error) {
      console.error('❌ Erro ao enviar imagem:', error);
      console.error('📋 Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Erro ao enviar imagem. Tente novamente.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para envio da imagem.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Erro interno do servidor. Verifique os logs do backend.';
      } else if (error.message.includes('Informações da instância')) {
        errorMessage = 'Informações da conversa incompletas.';
      }
      
      alert(errorMessage);
    } finally {
      setSendingImage(false);
    }
  };

  // Função para remover imagem selecionada
  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Função para enviar vídeo
  const sendVideo = async () => {
    if (!conversationId || !selectedConversation || !selectedVideo) return;

    setSendingVideo(true);
    try {
      const token = localStorage.getItem('token');
      const instanceName = selectedConversation.instance_name;
      const customerPhone = selectedConversation.customer_phone;
      const senderId = (JSON.parse(localStorage.getItem('userData') || '{}').id);

      if (!instanceName || !customerPhone) {
        throw new Error('Informações da instância ou telefone do cliente não encontradas');
      }

      // Converter vídeo para data URI
      const videoDataURI = await fileToDataURI(selectedVideo);

      console.log('🎥 Enviando vídeo:', {
        instanceName,
        customerPhone,
        videoSize: selectedVideo.size,
        videoType: selectedVideo.type,
        fileName: selectedVideo.name,
        dataURIPrefix: videoDataURI.substring(0, 50) + '...',
        isDataURI: videoDataURI.startsWith('data:')
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send-media`,
        {
          instanceName,
          number: customerPhone,
          mediaMessage: {
            mediatype: 'video',
            media: videoDataURI,
            caption: message.trim() || null, // Usar mensagem atual como legenda se houver
            fileName: selectedVideo.name,
            mimetype: selectedVideo.type
          },
          options: {
            delay: 1200,
            presence: "composing"
          },
          sender_id: senderId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('🎥 Vídeo enviado:', response.data);
      
      // Limpar preview e vídeo selecionado
      setVideoPreview(null);
      setSelectedVideo(null);
      
      // Limpar mensagem se foi usada como legenda
      if (message.trim()) {
        setMessage('');
      }

    } catch (error) {
      console.error('❌ Erro ao enviar vídeo:', error);
      console.error('📋 Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Erro ao enviar vídeo. Tente novamente.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para envio do vídeo.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Erro interno do servidor. Verifique os logs do backend.';
      } else if (error.message.includes('Informações da instância')) {
        errorMessage = 'Informações da conversa incompletas.';
      }
      
      alert(errorMessage);
    } finally {
      setSendingVideo(false);
    }
  };

  // Função para remover vídeo selecionado
  const removeSelectedVideo = () => {
    setSelectedVideo(null);
    setVideoPreview(null);
  };

  // Função para enviar documento
  const sendDocument = async () => {
    if (!conversationId || !selectedConversation || !selectedDocument) return;

    setSendingDocument(true);
    try {
      const token = localStorage.getItem('token');
      const instanceName = selectedConversation.instance_name;
      const customerPhone = selectedConversation.customer_phone;
      const senderId = (JSON.parse(localStorage.getItem('userData') || '{}').id);

      if (!instanceName || !customerPhone) {
        throw new Error('Informações da instância ou telefone do cliente não encontradas');
      }

      // Converter documento para data URI
      const documentDataURI = await fileToDataURI(selectedDocument);

      console.log('📄 Enviando documento:', {
        instanceName,
        customerPhone,
        documentSize: selectedDocument.size,
        documentType: selectedDocument.type,
        fileName: selectedDocument.name,
        dataURIPrefix: documentDataURI.substring(0, 50) + '...',
        isDataURI: documentDataURI.startsWith('data:')
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send-media`,
        {
          instanceName,
          number: customerPhone,
          mediaMessage: {
            mediatype: 'document',
            media: documentDataURI,
            caption: message.trim() || null, // Usar mensagem atual como legenda se houver
            fileName: selectedDocument.name,
            mimetype: selectedDocument.type
          },
          options: {
            delay: 1200,
            presence: "composing"
          },
          sender_id: senderId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('📄 Documento enviado:', response.data);
      
      // Limpar preview e documento selecionado
      setDocumentPreview(null);
      setSelectedDocument(null);
      
      // Limpar mensagem se foi usada como legenda
      if (message.trim()) {
        setMessage('');
      }

    } catch (error) {
      console.error('❌ Erro ao enviar documento:', error);
      console.error('📋 Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Erro ao enviar documento. Tente novamente.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para envio do documento.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Erro interno do servidor. Verifique os logs do backend.';
      } else if (error.message.includes('Informações da instância')) {
        errorMessage = 'Informações da conversa incompletas.';
      }
      
      alert(errorMessage);
    } finally {
      setSendingDocument(false);
    }
  };

  // Função para remover documento selecionado
  const removeSelectedDocument = () => {
    setSelectedDocument(null);
    setDocumentPreview(null);
  };

  // Função para iniciar gravação de áudio
  const startRecording = async () => {
    try {
      console.log('🎤 Solicitando acesso ao microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('✅ Acesso ao microfone concedido');
      
      // Tentar usar formato mais compatível com WhatsApp
      let mediaRecorder;
      let mimeType = 'audio/webm'; // default
      
      try {
        // Tentar MP4 primeiro (melhor para WhatsApp)
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
          mimeType = 'audio/mp4';
          console.log('🎵 Usando formato: audio/mp4');
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
          mimeType = 'audio/webm;codecs=opus';
          console.log('🎵 Usando formato: audio/webm;codecs=opus');
        } else {
          // Fallback para o formato padrão
          mediaRecorder = new MediaRecorder(stream);
          mimeType = mediaRecorder.mimeType || 'audio/webm';
          console.log('🎵 Usando formato padrão:', mimeType);
        }
      } catch (error) {
        // Se falhar, usar formato padrão
        mediaRecorder = new MediaRecorder(stream);
        mimeType = mediaRecorder.mimeType || 'audio/webm';
        console.log('🎵 Fallback para formato:', mimeType);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Dados de áudio recebidos:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('⏹️ Gravação parada. Processando áudio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('🎵 Áudio blob criado:', { size: audioBlob.size, type: audioBlob.type });
        await sendAudio(audioBlob);
        
        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
        console.log('🔇 Stream de áudio parado');
      };

      console.log('🎬 Iniciando gravação...');
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Iniciar contador de tempo
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          console.log('⏱️ Tempo de gravação:', newTime, 's');
          return newTime;
        });
      }, 1000);
      
      console.log('⏰ Timer iniciado:', recordingIntervalRef.current);

      console.log('✅ Gravação iniciada com sucesso!');

    } catch (error) {
      console.error('❌ Erro ao acessar microfone:', error);
      
      let errorMessage = 'Erro ao acessar o microfone.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão negada para acessar o microfone. Verifique as configurações do navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhum microfone encontrado. Verifique se há um microfone conectado.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microfone está sendo usado por outro aplicativo.';
      }
      
      alert(errorMessage);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  // Função para parar gravação
  const stopRecording = () => {
    console.log('🛑 Parando gravação...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      console.log('✅ Gravação parada, processando áudio...');
    } else {
      console.log('⚠️ Não há gravação ativa para parar');
    }
  };

  // Função para cancelar gravação
  const cancelRecording = () => {
    console.log('❌ Cancelando gravação...');
    if (mediaRecorderRef.current && isRecording) {
      // Parar o stream sem processar o áudio
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      // Limpar dados de áudio
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      
      console.log('✅ Gravação cancelada');
    } else {
      console.log('⚠️ Não há gravação ativa para cancelar');
    }
  };

  // Função para converter audio blob para data URI completo
  const blobToDataURI = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result); // Data URI completo: data:audio/wav;base64,xxxxx
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Função para enviar áudio
  const sendAudio = async (audioBlob) => {
    if (!conversationId || !selectedConversation) return;

    setSendingAudio(true);
    try {
      const token = localStorage.getItem('token');
      const instanceName = selectedConversation.instance_name;
      const customerPhone = selectedConversation.customer_phone;
      const senderId = (JSON.parse(localStorage.getItem('userData') || '{}').id);

      if (!instanceName || !customerPhone) {
        throw new Error('Informações da instância ou telefone do cliente não encontradas');
      }

      // Converter áudio para data URI completo
      const audioDataURI = await blobToDataURI(audioBlob);

      console.log('🎵 Enviando áudio:', {
        instanceName,
        customerPhone,
        audioSize: audioBlob.size,
        audioType: audioBlob.type,
        duration: recordingTime,
        dataURIPrefix: audioDataURI.substring(0, 50) + '...',
        isDataURI: audioDataURI.startsWith('data:')
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send-audio`,
        {
          instanceName,
          number: customerPhone,
          audioMessage: {
            audio: audioDataURI // Enviando data URI completo - backend vai extrair base64
          },
          options: {
            delay: 1200,
            presence: "recording",
            encoding: true
          },
          sender_id: senderId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('🎵 Áudio enviado:', response.data);
      setRecordingTime(0);

    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
      console.error('📋 Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Erro ao enviar áudio. Tente novamente.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para envio do áudio.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Erro interno do servidor. Verifique os logs do backend.';
      } else if (error.message.includes('Informações da instância')) {
        errorMessage = 'Informações da conversa incompletas.';
      }
      
      alert(errorMessage);
    } finally {
      setSendingAudio(false);
    }
  };

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

  // Função para assumir a conversa
  const handleAssumeConversation = async () => {
    if (!conversationId || assuming) return;
    
    setAssuming(true);
    try {
      await onAssumeConversation();
      // A conversa será atualizada pelo componente pai
    } catch (error) {
      console.error('Erro ao assumir conversa:', error);
      alert('Erro ao assumir conversa. Tente novamente.');
    } finally {
      setAssuming(false);
    }
  };

  // Função para reiniciar conversa concluída
  const handleRestartConversation = async () => {
    if (!conversationId || restarting) return;
    
    setRestarting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conversationId}/reopen`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('✅ Conversa reiniciada:', response.data);
      
      // Notificar o componente pai sobre a mudança
      if (onMessageSent) {
        // Simular uma atualização da conversa
        const updatedConversation = { 
          ...selectedConversation, 
          status: 'aberta' 
        };
        // Podemos usar onMessageSent para forçar uma atualização
        onMessageSent({ type: 'conversation_updated', conversation: updatedConversation });
      }
      
      // Recarregar a página para atualizar todos os componentes
      window.location.reload();
      
    } catch (error) {
      console.error('Erro ao reiniciar conversa:', error);
      
      let errorMessage = 'Erro ao reiniciar conversa. Tente novamente.';
      
      if (error.response?.status === 404) {
        errorMessage = 'Conversa não encontrada.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Você não tem permissão para reiniciar esta conversa.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Esta conversa não pode ser reiniciada.';
      }
      
      alert(errorMessage);
    } finally {
      setRestarting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending || !conversationId || !selectedConversation) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      
      // Extrair informações necessárias da conversa selecionada
      const instanceName = selectedConversation.instance_name;
      const customerPhone = selectedConversation.customer_phone;
      const text = message.trim();
      
      console.log('🔍 Dados da conversa:', {
        conversationId,
        instanceName,
        customerPhone,
        selectedConversation
      });
      
      if (!instanceName || !customerPhone) {
        throw new Error('Informações da instância ou telefone do cliente não encontradas');
      }
      
      // Validar formato do telefone (deve incluir código do país)
      if (!customerPhone.startsWith('55')) {
        console.warn('⚠️ Telefone não inclui código do país (55). Adicionando automaticamente.');
        // Adicionar código do Brasil se não estiver presente
        const formattedPhone = customerPhone.startsWith('+') ? customerPhone : `+55${customerPhone}`;
        console.log('📱 Telefone formatado:', formattedPhone);
      }
      
      const senderId = (JSON.parse(localStorage.getItem('userData') || '{}').id);
      
      console.log('📤 Enviando mensagem:', { 
        instanceName, 
        number: customerPhone, 
        text, 
        sender_id: senderId 
      });
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send`,
        {
          instanceName,
          number: customerPhone,
          text,
          sender_id: senderId,
          options: {}
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('📤 Mensagem enviada:', response.data);

      // Adicionar mensagem localmente com estrutura da API
      const newMessage = {
        id: response.data.id || Date.now(),
        conversation_id: conversationId,
        sender_type: 'user', // Usuário atual enviando
        sender_id: (JSON.parse(localStorage.getItem('userData') || '{}').id),
        message_type: 'text',
        content: text,
        media_url: null,
        created_at: new Date().toISOString(),
        read: 0
      };

      // Não adicionar localmente - deixar o WebSocket atualizar
      // onMessageSent(newMessage);
      setMessage('');
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      let errorMessage = 'Erro ao enviar mensagem. Tente novamente.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos para envio da mensagem.';
        console.error('📋 Dados enviados:', {
          instanceName: selectedConversation?.instance_name,
          number: selectedConversation?.customer_phone,
          text: message.trim(),
          sender_id: (JSON.parse(localStorage.getItem('userData') || '{}').id)
        });
      } else if (error.message.includes('Informações da instância')) {
        errorMessage = 'Informações da conversa incompletas.';
      }
      
      alert(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Função para formatar tempo de gravação - MOVIDA PARA ANTES DOS RETURNS
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Funções para gerenciar seleção de mensagens
  const handleExitSelectionMode = () => {
    onExitSelectionMode();
  };

  const handleForwardMessages = () => {
    onForwardMessages(selectedMessages);
  };

  const handleDeleteMessages = () => {
    if (window.confirm(`Tem certeza que deseja excluir ${selectedMessages.length} mensagem(ns) selecionada(s)?`)) {
      onDeleteMessages(selectedMessages);
    }
  };

  // Debug: Log do estado de gravação apenas quando muda - MOVIDO PARA ANTES DOS RETURNS
  useEffect(() => {
    if (isRecording || recordingTime > 0 || sendingAudio) {
      console.log('🔍 Estado de gravação:', { isRecording, recordingTime, sendingAudio });
    }
  }, [isRecording, recordingTime, sendingAudio]);

  // RENDERIZAÇÃO CONDICIONAL - TODOS OS HOOKS JÁ FORAM EXECUTADOS
  
  // Barra de seleção de mensagens
  if (selectionMode) {
    return (
      <div className={styles.selectionBar}>
        <div className={styles.selectionLeft}>
          <button
            onClick={handleExitSelectionMode}
            className={styles.closeButton}
            title="Fechar seleção"
          >
            <X size={20} />
          </button>
          <span className={styles.selectionCount}>
            {selectedMessages.length} selecionada{selectedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.selectionActions}>
          <button
            onClick={handleForwardMessages}
            disabled={selectedMessages.length === 0}
            className={styles.forwardButton}
            title="Encaminhar mensagens"
          >
            <Forward size={18} />
            <span>Encaminhar</span>
          </button>
          <button
            onClick={handleDeleteMessages}
            disabled={selectedMessages.length === 0}
            className={styles.deleteButton}
            title="Excluir mensagens"
          >
            <Trash2 size={18} />
            <span>Excluir</span>
          </button>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className={styles.container}>
        <div className={styles.disabledState}>
          Selecione uma conversa para enviar mensagens
        </div>
      </div>
    );
  }

  // Se a conversa está concluída, mostrar botão para reiniciar
  if (selectedConversation?.status === 'fechada') {
    return (
      <div className={styles.container}>
        <div className={styles.assumeConversationContainer}>
          <div className={styles.assumeMessage}>
            <RotateCcw size={24} className={styles.assumeIcon} />
            <div className={styles.assumeText}>
              <h4>Conversa concluída</h4>
              <p>Esta conversa foi finalizada. Deseja reiniciá-la para continuar o atendimento?</p>
            </div>
          </div>
          <button
            onClick={handleRestartConversation}
            disabled={restarting}
            className={styles.assumeButton}
          >
            {restarting ? (
              <div className={styles.loadingSpinner}></div>
            ) : (
              <>
                <RotateCcw size={18} />
                <span>Reiniciar</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Se não há usuário responsável, mostrar mensagem para assumir conversa
  if (!hasAssignedUser) {
    return (
      <div className={styles.container}>
        <div className={styles.assumeConversationContainer}>
          <div className={styles.assumeMessage}>
            <UserCheck size={24} className={styles.assumeIcon} />
            <div className={styles.assumeText}>
              <h4>Conversa sem responsável</h4>
              <p>Esta conversa não possui um usuário responsável. Deseja assumi-la?</p>
            </div>
          </div>
          <button
            onClick={handleAssumeConversation}
            disabled={assuming}
            className={styles.assumeButton}
          >
            {assuming ? (
              <div className={styles.loadingSpinner}></div>
            ) : (
              <>
                <UserCheck size={18} />
                <span>Assumir Conversa</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Se a empresa está cancelada, mostrar aviso
  if (isCompanyCanceled()) {
    return (
      <div className={styles.container}>
        <div className={styles.warningContainer}>
          <div className={styles.assumeMessage}>
            <div className={styles.warningHeader}>
              <div className={styles.warningIconContainer}>
                <FileText size={20} color="#dc2626" />
              </div>
              <div className={styles.warningBadge}>
                Atenção!
              </div>
            </div>
            <div className={styles.assumeText}>
              <p className={styles.warningText}>
                Envio de mensagens está suspenso.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se há usuário responsável mas não é o usuário atual e não é administrador
  if (hasAssignedUser && !canSendMessages()) {
    const assignedUserName = selectedConversation.assigned_user_name || 'Usuário';
    const teamName = selectedConversation.team_name || 'Equipe';
    
    return (
      <div className={styles.container}>
        <div className={styles.warningContainer}>
          <div className={styles.assumeMessage}>
            <div className={styles.warningHeader}>
              <div className={styles.warningIconContainer}>
                <FileText size={20} color="#92400e" />
              </div>
              <div className={styles.warningBadge}>
                Atenção!
              </div>
            </div>
            <div className={styles.assumeText}>
              <p className={styles.warningText}>
                Este contato está em atendimento pelo usuário <strong>{assignedUserName}</strong> na equipe <strong>{teamName}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        className={styles.hiddenFileInput}
        onChange={handleFileSelect}
        accept="image/*,video/*,application/*,text/*"
      />
      
      {/* Preview da imagem selecionada */}
      {imagePreview && (
        <div className={styles.imagePreviewContainer}>
          <div className={styles.imagePreview}>
            <img src={imagePreview} alt="Preview" className={styles.previewImage} />
            <div className={styles.imageInfo}>
              <span className={styles.imageName}>{selectedImage?.name}</span>
              <span className={styles.imageSize}>
                {(selectedImage?.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <button
              type="button"
              onClick={removeSelectedImage}
              className={styles.removeImageButton}
              title="Remover imagem"
            >
              ×
            </button>
          </div>
          <div className={styles.imageActions}>
            <button
              type="button"
              onClick={sendImage}
              disabled={sendingImage}
              className={styles.sendImageButton}
            >
              {sendingImage ? (
                <div className={styles.loadingSpinner}></div>
              ) : (
                <>
                  <Image size={16} />
                  <span>Enviar Imagem</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview do vídeo selecionado */}
      {videoPreview && (
        <div className={styles.imagePreviewContainer}>
          <div className={styles.imagePreview}>
            <video 
              src={videoPreview} 
              controls 
              className={`${styles.previewImage} ${styles.videoPreview}`}
            />
            <div className={styles.imageInfo}>
              <span className={styles.imageName}>{selectedVideo?.name}</span>
              <span className={styles.imageSize}>
                {(selectedVideo?.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <button
              type="button"
              onClick={removeSelectedVideo}
              className={styles.removeImageButton}
              title="Remover vídeo"
            >
              ×
            </button>
          </div>
          <div className={styles.imageActions}>
            <button
              type="button"
              onClick={sendVideo}
              disabled={sendingVideo}
              className={styles.sendImageButton}
            >
              {sendingVideo ? (
                <div className={styles.loadingSpinner}></div>
              ) : (
                <>
                  <Video size={16} />
                  <span>Enviar Vídeo</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview do documento selecionado */}
      {documentPreview && (
        <div className={styles.imagePreviewContainer}>
          <div className={styles.imagePreview}>
            <div className={styles.documentPreviewContainer}>
              <File size={32} color="#666" />
              <span className={styles.documentName}>{documentPreview.name}</span>
            </div>
            <div className={styles.imageInfo}>
              <span className={styles.imageName}>{documentPreview.name}</span>
              <span className={styles.imageSize}>
                {(documentPreview.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <button
              type="button"
              onClick={removeSelectedDocument}
              className={styles.removeImageButton}
              title="Remover documento"
            >
              ×
            </button>
          </div>
          <div className={styles.imageActions}>
            <button
              type="button"
              onClick={sendDocument}
              disabled={sendingDocument}
              className={styles.sendImageButton}
            >
              {sendingDocument ? (
                <div className={styles.loadingSpinner}></div>
              ) : (
                <>
                  <File size={16} />
                  <span>Enviar Documento</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Indicador de gravação */}
      {isRecording && (
        <div className={styles.recordingIndicator}>
          <div className={styles.recordingDot}></div>
          <span>Gravando... {formatRecordingTime(recordingTime)}</span>
          <button
            type="button"
            onClick={cancelRecording}
            className={styles.cancelButton}
            title="Cancelar gravação"
          >
            Cancelar
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputContainer}>
          <div className={styles.inputWrapper}>
            <button
              type="button"
              className={styles.emojiButton}
              onClick={toggleEmojiPicker}
              title="Adicionar emoji"
            >
              <Smile size={20} />
            </button>
            <button
              type="button"
              className={styles.attachmentButton}
              onClick={toggleAttachmentMenu}
              title="Anexar arquivo"
            >
              <Paperclip size={20} />
            </button>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedImage ? "Digite uma legenda para a imagem (opcional)..." : selectedVideo ? "Digite uma legenda para o vídeo (opcional)..." : selectedDocument ? "Digite uma legenda para o documento (opcional)..." : "Digite sua mensagem..."}
              className={styles.input}
              rows={1}
              disabled={sending}
            />
          </div>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className={styles.emojiPickerContainer}>
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={300}
                height={400}
                searchDisabled={false}
                skinTonesDisabled={false}
                previewConfig={{
                  showPreview: false
                }}
              />
            </div>
          )}
          {showAttachmentMenu && (
            <div ref={attachmentMenuRef} className={styles.attachmentMenuContainer}>
              <div className={styles.attachmentMenu}>
                <button
                  type="button"
                  className={styles.attachmentOption}
                  onClick={() => openFileSelector('image/*')}
                  disabled={sendingImage}
                >
                  <Image size={20} />
                  <span>Imagem</span>
                </button>
                <button
                  type="button"
                  className={styles.attachmentOption}
                  onClick={() => openFileSelector('video/*')}
                  disabled={sendingVideo}
                >
                  <Video size={20} />
                  <span>Vídeo</span>
                </button>
                <button
                  type="button"
                  className={styles.attachmentOption}
                  onClick={() => openFileSelector('application/*,text/*')}
                  disabled={sendingDocument}
                >
                  <File size={20} />
                  <span>Documento</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!message.trim() || sending || isRecording || sendingImage || sendingVideo || sendingDocument || selectedImage || selectedVideo || selectedDocument}
          className={styles.sendButton}
          title={sending ? 'Enviando...' : 'Enviar mensagem'}
        >
          {sending ? (
            <div className={styles.loadingSpinner}></div>
          ) : (
            <Send size={20} />
          )}
        </button>
        {/* Botão de microfone */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={sending || sendingAudio || sendingImage || sendingVideo || sendingDocument}
          className={`${styles.micButton} ${isRecording ? styles.recording : ''}`}
          title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
        >
          {sendingAudio ? (
            <div className={styles.loadingSpinner}></div>
          ) : isRecording ? (
            <Square size={20} />
          ) : (
            <Mic size={20} />
          )}
        </button>
      </form>
    </div>
  );
}

