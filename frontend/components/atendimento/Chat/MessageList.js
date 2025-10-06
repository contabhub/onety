import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Play, Pause, Check, MoreVertical } from 'lucide-react';
import styles from './MessageList.module.css';

// Componente customizado para player de áudio
const AudioPlayer = ({ audioUrl, mimeType, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * totalDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginTop: '8px',
      maxWidth: '300px'
    }}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      >
        <source src={audioUrl} type={mimeType || 'audio/ogg'} />
      </audio>

      <button
        onClick={togglePlayPause}
        style={{
          background: '#007bff',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white'
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div style={{ flex: 1, minWidth: '100px' }}>
        <div
          style={{
            height: '4px',
            backgroundColor: '#e0e0e0',
            borderRadius: '2px',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={handleSeek}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: '#007bff',
              borderRadius: '2px',
              width: `${progress}%`,
              transition: 'width 0.1s ease'
            }}
          />
        </div>
      </div>

      <span style={{
        fontSize: '12px',
        color: '#666',
        minWidth: '45px',
        textAlign: 'right'
      }}>
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
    </div>
  );
};

// Função para renderizar diferentes tipos de mensagem
const renderMessageContent = (message) => {
  switch (message.message_type) {
    case 'audio':
      try {
        let audioContent = message.content;

        // Tentar fazer parse apenas se for string e parecer JSON (começar com { ou [)
        if (typeof message.content === 'string' && message.content.trim().startsWith('{')) {
          try {
            audioContent = JSON.parse(message.content);
          } catch (parseError) {
            console.warn('Erro ao fazer parse do conteúdo de áudio:', parseError);
            // Se falhar, usar como objeto vazio e depender do media_url
            audioContent = {};
          }
        } else if (typeof message.content === 'string') {
          // Se for string simples (como "audio"), usar objeto vazio
          audioContent = {};
        }

        return (
          <div className="audio-message">
            {(audioContent?.audioUrl || message.media_url) && (
              <AudioPlayer
                audioUrl={audioContent?.audioUrl || message.media_url}
                mimeType={audioContent?.mimeType || 'audio/ogg'}
                duration={audioContent?.seconds || 0}
              />
            )}
          </div>
        );
      } catch (e) {
        console.error('Erro ao renderizar áudio:', e);
        return '🎵 Mensagem de áudio (erro ao carregar)';
      }

    case 'photo':
    case 'image':
      try {
        let photoContent = message.content;
        let caption = null;

        // Verificar se o content é um JSON ou string simples
        if (typeof message.content === 'string' && message.content.trim().startsWith('{')) {
          try {
            photoContent = JSON.parse(message.content);
            caption = photoContent?.caption || null;
          } catch (parseError) {
            console.warn('Erro ao fazer parse do conteúdo de foto:', parseError);
            photoContent = {};
            // Se não conseguir fazer parse, usar o content como caption
            caption = message.content;
          }
        } else if (typeof message.content === 'string') {
          // Se content é uma string simples, usar como caption
          caption = message.content;
          photoContent = {};
        }

        return (
          <div className="photo-message">
            {(photoContent?.photoUrl || message.media_url) && (
              <img
                src={photoContent?.photoUrl || message.media_url}
                alt="Imagem enviada"
                style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px' }}
                onError={(e) => {
                  console.error('Erro ao carregar imagem:', e);
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
            )}
            {/* Mostrar caption se existir */}
            {caption && (
              <div style={{
                marginTop: '8px',
                fontSize: '14px',
                color: '#fff',
                lineHeight: '1.4'
              }}>
                {caption}
              </div>
            )}
            {/* Fallback para erro de carregamento */}
            <div style={{ display: 'none', color: '#666', fontSize: '14px' }}>
              📷 Imagem (erro ao carregar)
            </div>
          </div>
        );
      } catch (e) {
        return '📷 Imagem (erro ao carregar)';
      }

    case 'video':
      try {
        let videoContent = message.content;
        let caption = null;

        // Verificar se o content é um JSON ou string simples
        if (typeof message.content === 'string' && message.content.trim().startsWith('{')) {
          try {
            videoContent = JSON.parse(message.content);
            caption = videoContent?.caption || null;
          } catch (parseError) {
            console.warn('Erro ao fazer parse do conteúdo de vídeo:', parseError);
            videoContent = {};
            // Se não conseguir fazer parse, usar o content como caption
            caption = message.content;
          }
        } else if (typeof message.content === 'string') {
          // Se content é uma string simples, usar como caption
          caption = message.content;
          videoContent = {};
        }

        return (
          <div className="video-message">
            {(videoContent?.videoUrl || message.media_url) && (
              <video
                controls
                style={{
                  maxWidth: '300px',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  backgroundColor: '#000'
                }}
                onError={(e) => {
                  console.error('Erro ao carregar vídeo:', e);
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              >
                <source src={videoContent?.videoUrl || message.media_url} type="video/mp4" />
                <source src={videoContent?.videoUrl || message.media_url} type="video/webm" />
                Seu navegador não suporta reprodução de vídeo.
              </video>
            )}
            {/* Fallback para erro de carregamento */}
            <div style={{ display: 'none', color: '#666', fontSize: '14px' }}>
              🎥 Vídeo (erro ao carregar)
            </div>
            {/* Mostrar caption se existir */}
            {caption && (
              <div style={{
                marginTop: '8px',
                fontSize: '14px',
                color: '#fff',
                lineHeight: '1.4'
              }}>
                {caption}
              </div>
            )}
          </div>
        );
      } catch (e) {
        return '🎥 Vídeo (erro ao carregar)';
      }

    case 'file':
    case 'document': // Manter compatibilidade com o tipo antigo
      try {
        let docContent = message.content;
        let caption = null;

        // Verificar se o content é um JSON ou string simples
        if (typeof message.content === 'string' && message.content.trim().startsWith('{')) {
          try {
            docContent = JSON.parse(message.content);
            caption = docContent?.caption || null;
          } catch (parseError) {
            console.warn('Erro ao fazer parse do conteúdo de documento:', parseError);
            docContent = {};
            // Se não conseguir fazer parse, usar o content como caption
            caption = message.content;
          }
        } else if (typeof message.content === 'string') {
          // Se content é uma string simples, usar como caption
          caption = message.content;
          docContent = {};
        }

        const documentUrl = docContent?.documentUrl || message.media_url;
        // Tentar extrair nome do arquivo da URL se não estiver disponível
        let fileName = docContent?.fileName || 'Documento';
        if (fileName === 'Documento' && documentUrl) {
          try {
            const url = new URL(documentUrl);
            const pathParts = url.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart && lastPart !== 'upload') {
              // Decodificar URL encoding
              fileName = decodeURIComponent(lastPart);
            }
          } catch (e) {
            // Se não conseguir extrair da URL, manter 'Documento'
          }
        }
        const mimeType = docContent?.mimeType || 'application/octet-stream';

        // Determinar ícone baseado no tipo de arquivo
        const getFileIcon = (mimeType, fileName) => {
          if (mimeType.includes('pdf')) return '📕';
          if (mimeType.includes('word') || fileName.toLowerCase().includes('.doc')) return '📘';
          if (mimeType.includes('excel') || fileName.toLowerCase().includes('.xls')) return '📗';
          if (mimeType.includes('powerpoint') || fileName.toLowerCase().includes('.ppt')) return '📙';
          if (mimeType.includes('text')) return '📝';
          if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
          return '📄';
        };

        return (
          <div
            className="document-message"
            onClick={() => {
              if (!documentUrl) return;

              // Abrir arquivo diretamente em nova aba
              window.open(documentUrl, '_blank', 'noopener,noreferrer');
            }}
            style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
              maxWidth: '300px',
              cursor: documentUrl ? 'pointer' : 'default',
              transition: 'background-color 0.2s, transform 0.1s'
            }}
            onMouseOver={(e) => {
              if (documentUrl) {
                e.target.style.backgroundColor = '#e9ecef';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              if (documentUrl) {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.transform = 'translateY(0)';
              }
            }}
            title={documentUrl ? `Clique para abrir ${fileName}` : ''}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>
                {getFileIcon(mimeType, fileName)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '500',
                  fontSize: '14px',
                  color: '#333',
                  wordBreak: 'break-word'
                }}>
                  {fileName}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  textTransform: 'uppercase'
                }}>
                  {mimeType.split('/')[1] || 'arquivo'}
                </div>
              </div>
            </div>

            {/* Mostrar caption se existir */}
            {caption && (
              <div style={{
                marginTop: '8px',
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.4',
                fontStyle: 'italic'
              }}>
                {caption}
              </div>
            )}
          </div>
        );
      } catch (e) {
        return '📄 Documento (erro ao carregar)';
      }

    case 'text':
    default:
      return message.content || '';
  }
};

export default function MessageList({ 
  messages, 
  loading, 
  currentUserId, 
  currentUserName,
  currentUserAvatarUrl, // URL do avatar do usuário atual
  customerAvatarUrl, // URL do avatar do cliente (pode ser midia_url do contato)
  selectionMode = false,
  selectedMessages = [],
  onSelectionChange = () => {},
  onToggleSelection = () => {}
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Estados para paginação
  const [messagesPerPage] = useState(20); // Número de mensagens por página
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Calcular mensagens visíveis baseado na paginação
  const totalMessages = messages.length;
  const startIndex = Math.max(0, totalMessages - (currentPage * messagesPerPage));
  const visibleMessages = messages.slice(startIndex);
  const hasMoreMessages = startIndex > 0;

  // Função para carregar mais mensagens
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);

    // Salvar posição atual do scroll
    const scrollContainer = containerRef.current;
    const oldScrollHeight = scrollContainer?.scrollHeight || 0;

    // Simular delay de carregamento (remover em produção se não necessário)
    await new Promise(resolve => setTimeout(resolve, 300));

    setCurrentPage(prev => prev + 1);

    // Restaurar posição do scroll após carregar
    setTimeout(() => {
      if (scrollContainer) {
        const newScrollHeight = scrollContainer.scrollHeight;
        const scrollDifference = newScrollHeight - oldScrollHeight;
        scrollContainer.scrollTop = scrollDifference;
      }
      setLoadingMore(false);
    }, 50);
  };

  // Reset da paginação quando trocar de conversa
  useEffect(() => {
    if (messages.length > 0) {
      setCurrentPage(1);
      setIsUserScrolling(false);
    }
  }, [messages.length > 0 ? messages[0]?.conversation_id : null]);

  // Auto-scroll para o final quando novas mensagens chegarem
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Verificar se o usuário está no final da conversa
  const checkScrollPosition = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShowScrollButton(!isNearBottom);
  };

  // Handle scroll events
  const handleScroll = () => {
    setIsUserScrolling(true);
    checkScrollPosition();

    // Reset user scrolling flag after a longer delay
    clearTimeout(handleScroll.timeout);
    handleScroll.timeout = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000); // Aumentado para 3 segundos
  };

  // Auto-scroll apenas para novas mensagens e apenas se estiver no final
  useEffect(() => {
    if (visibleMessages.length > 0 && !isUserScrolling && currentPage === 1) {
      // Verificar se está próximo do final antes de fazer scroll
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages.length, currentPage]); // Quando o número de mensagens muda ou página muda

  // Scroll instantâneo quando carregar nova conversa (apenas na primeira página)
  useEffect(() => {
    if (messages.length > 0 && currentPage === 1) {
      setTimeout(() => scrollToBottom('instant'), 100);
    }
  }, [messages.length > 0 ? messages[0]?.conversation_id : null]);
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>Carregando mensagens...</div>
      </div>
    );
  }

  if (totalMessages === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>Nenhuma mensagem ainda</div>
        <div className={styles.emptySubtext}>Inicie a conversa enviando uma mensagem</div>
      </div>
    );
  }

  // Função para determinar se a mensagem é do usuário atual
  const isOutgoingMessage = (message) => {
    // Se sender_type for 'customer', é mensagem recebida
    // Se sender_type for 'user' ou 'agent', é mensagem enviada pelo usuário atual
    return message.sender_type === 'user' || message.sender_type === 'agent';
  };

  // Função para formatar data/hora
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Função para obter o nome do remetente
  const getSenderName = (message) => {
    if (message.sender_type === 'customer') {
      return ''; // Não mostra label para mensagens do cliente
    } else if (message.sender_type === 'user' || message.sender_type === 'agent') {
      // Prioridade: nome da API → apelido da API → currentUserName → fallback
      return message.sender_user_name ||
        message.sender_user_nickname ||
        currentUserName ||
        'Usuário';
    } else if (message.sender_type === 'system') {
      return 'Sistema';
    }
    return 'Usuário';
  };

  // Função para obter o avatar ou ícone do remetente
  const getSenderAvatar = (message) => {
    if (message.sender_type === 'customer') {
      return customerAvatarUrl || null;
    }
    if (message.sender_type === 'user' || message.sender_type === 'agent') {
      return currentUserAvatarUrl || null;
    }
    return null;
  };

  // Função para verificar se uma mensagem está selecionada
  const isMessageSelected = (messageId) => {
    return selectedMessages.includes(messageId);
  };

  // Função para alternar seleção de uma mensagem
  const toggleMessageSelection = (messageId) => {
    onToggleSelection(messageId);
  };

  // Função para iniciar modo de seleção
  const startSelectionMode = () => {
    onSelectionChange(true);
  };

  return (
    <div className={styles.messagesWrapper}>
      <div
        ref={containerRef}
        className={styles.container}
        onScroll={handleScroll}
      >
        {/* Botão para carregar mensagens anteriores */}
        {hasMoreMessages && (
          <div className={styles.loadMoreContainer}>
            <button
              className={styles.loadMoreButton}
              onClick={loadMoreMessages}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <div className={styles.loadingSpinner}></div>
                  Carregando...
                </>
              ) : (
                `Carregar mensagens anteriores (${totalMessages - visibleMessages.length} restantes)`
              )}
            </button>
          </div>
        )}

        {visibleMessages.map((message) => {
          const isOutgoing = isOutgoingMessage(message);
          const isSelected = isMessageSelected(message.id);
          
          const avatarUrl = getSenderAvatar(message);
          return (
            <div
              key={message.id}
              className={`${styles.message} ${
                isOutgoing ? styles.outgoing : styles.incoming
              } ${isSelected ? styles.selected : ''}`}
            >
              {/* Avatar do remetente */}
              {!isOutgoing && (
                <div className={styles.messageAvatar} title={getSenderName(message)}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={getSenderName(message) || 'Avatar'} />
                  ) : (
                    <span>{(getSenderName(message) || 'C').charAt(0)}</span>
                  )}
                </div>
              )}
              {/* Checkbox para seleção */}
              {selectionMode && (
                <div className={styles.messageCheckbox}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMessageSelection(message.id)}
                    className={styles.checkbox}
                  />
                </div>
              )}
              
              <div className={styles.messageContent}>
                <div className={styles.messageInside}>
                  {/* Nome do remetente no topo da mensagem */}
                  {getSenderName(message) && (
                    <div className={styles.messageSender}>
                      {getSenderName(message)}
                    </div>
                  )}

                  <div className={styles.messageText}>
                    {renderMessageContent(message)}
                  </div>
                  
                  {/* Ícone de menu que aparece no hover */}
                  {!selectionMode && (
                    <div 
                      className={styles.messageMenu}
                      onClick={() => startSelectionMode()}
                      title="Selecionar mensagens"
                    >
                      <MoreVertical size={16} />
                    </div>
                  )}
                  
                </div>
              </div>

              {/* Avatar do remetente (lado direito para mensagens enviadas) */}
              {isOutgoing && (
                <div className={styles.messageAvatar} title={getSenderName(message)}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={getSenderName(message) || 'Avatar'} />
                  ) : (
                    <span>{(getSenderName(message) || 'U').charAt(0)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Elemento para scroll automático */}
        <div ref={messagesEndRef} />
      </div>

      {/* Botão flutuante para ir para o final */}
      {showScrollButton && (
        <button
          className={styles.scrollToBottomButton}
          onClick={() => {
            setIsUserScrolling(false);
            scrollToBottom('instant');
          }}
          title="Ir para o final da conversa"
        >
          <ChevronDown size={20} />
        </button>
      )}
    </div>
  );
}
