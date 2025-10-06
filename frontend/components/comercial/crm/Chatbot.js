import React, { useState, useEffect } from "react";
import { MessageCircle, X, Send, ExternalLink } from "lucide-react";
import Link from "next/link";
import styles from "../../styles/Chatbot.module.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import MarkdownStyle from '../../styles/MarkdownRenderer.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: "assistant", 
      content: "Olá! Sou seu assistente virtual. Como posso ajudá-lo hoje?" 
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState(null);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Prepara o array de mensagens para o contexto
      const messageHistory = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await fetch(`${BASE_URL}/chatbot/responses`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          messages: messageHistory,
          previous_response_id: previousResponseId
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (data.status === "completed") {
        const assistantMessage = { 
          role: "assistant", 
          content: data.response_text || "Desculpe, não consegui processar sua mensagem." 
        };
        setMessages([...newMessages, assistantMessage]);
        setPreviousResponseId(data.id);
      } else {
        // Se não estiver completo, faz polling
        await pollForResponse(data.id, newMessages);
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      const errorMessage = { 
        role: "assistant", 
        content: "Desculpe, ocorreu um erro na comunicação. Tente novamente." 
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  async function pollForResponse(responseId, currentMessages) {
    let attempts = 0;
    const maxAttempts = 30; // 30 tentativas com 2s de intervalo = 1 minuto

    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/chatbot/responses/${responseId}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem('token') || ''}`
          }
        });

        if (!res.ok) {
          throw new Error(`Erro ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        
        if (data.status === "completed") {
          const assistantMessage = { 
            role: "assistant", 
            content: data.response_text || "Resposta processada com sucesso." 
          };
          setMessages([...currentMessages, assistantMessage]);
          setPreviousResponseId(data.id);
          return true; // Sucesso
        } else if (data.status === "failed") {
          throw new Error("Falha no processamento da resposta");
        }
        
        return false; // Continua polling
      } catch (error) {
        console.error("Erro no polling:", error);
        return false;
      }
    };

    const pollInterval = setInterval(async () => {
      attempts++;
      const success = await poll();
      
      if (success || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        if (attempts >= maxAttempts) {
          const timeoutMessage = { 
            role: "assistant", 
            content: "Desculpe, a resposta demorou muito para ser processada. Tente novamente." 
          };
          setMessages([...currentMessages, timeoutMessage]);
        }
        setLoading(false);
      }
    }, 2000); // Poll a cada 2 segundos
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.chatContainer}>
      {!isOpen && (
        <button className={styles.chatButton} onClick={() => setIsOpen(true)}>
          <MessageCircle className={styles.icon} />
        </button>
      )}

      {isOpen && (
        <div className={styles.chatBox}>
          <div className={styles.chatHeader}>
            <div className={styles.headerContent}>
              <img src="/img/gerente-comercial.png" alt="Gerente" className={styles.avatar} />
              <div>
                <h2 className={styles.title}>Assistente IA</h2>
                <Link href="/chatbot" className={styles.fullPageLink}>
                  <ExternalLink className={styles.linkIcon} />
                  Abrir em tela cheia
                </Link>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className={styles.closeButton}>
              <X className={styles.closeIcon} />
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${msg.role === "user" ? styles.user : styles.assistant}`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({ node, ...props }) => <h1 className={`${styles.markdownH1} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    h2: ({ node, ...props }) => <h2 className={`${styles.markdownH2} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    h3: ({ node, ...props }) => <h3 className={`${styles.markdownH3} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    p: ({ node, ...props }) => <p className={`${styles.markdownP} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    ul: ({ node, ...props }) => <ul className={`${styles.markdownUl} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    ol: ({ node, ...props }) => <ol className={`${styles.markdownOl} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    code: ({ node, ...props }) => <code className={`${styles.markdownCode} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    pre: ({ node, ...props }) => <pre className={`${styles.markdownPre} ${MarkdownStyle.markdownContainer}`} {...props} />,
                    a: ({ node, ...props }) => <a className={`${styles.markdownLink} ${MarkdownStyle.markdownContainer}`} {...props} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            ))}
            
            {loading && (
              <div className={styles.loadingMessage}>
                <div className={styles.typingIndicator}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                </div>
                <span className={styles.typingText}>Processando...</span>
              </div>
            )}
          </div>

          <div className={styles.inputArea}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua dúvida..."
              className={styles.input}
              disabled={loading}
            />
            <button onClick={sendMessage} className={styles.sendButton}>
              <Send className={styles.sendIcon} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
