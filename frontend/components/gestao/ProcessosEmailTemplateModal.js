import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
import { Settings, X, ChevronDown } from 'lucide-react';
import styles from '../../styles/gestao/ProcessosEmailTemplateModal.module.css';

export default function ProcessosEmailTemplateModal({ isOpen, onClose, atividadeId }) {
  const [activeTab, setActiveTab] = useState('template');
  const [template, setTemplate] = useState({
    nome: '',
    assunto: '',
    corpo: '',
    destinatario: '',
    cc: '',
    co: '',
    variaveis: {}
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor TipTap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Preservar quebras de linha e espaços
        hardBreak: {
          keepMarks: false,
          HTMLAttributes: {
            class: 'hard-break',
          },
        },
      }),
      Bold,
      Italic,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Digite o corpo do e-mail aqui...", showOnlyWhenEditable: true }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: template.corpo,
    immediatelyRender: false,
    editable: true,
    onUpdate: ({ editor }) => {
      setTemplate(prev => ({ ...prev, corpo: editor.getHTML() }));
    },
    // Preservar formatação ao colar
    editorProps: {
      handlePaste: (view, event, slice) => {
        // Permitir que o comportamento padrão de colar funcione
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        // Permitir que o comportamento padrão de drop funcione
        return false;
      },
    },
    // Configurações para preservar formatação
    parseOptions: {
      preserveWhitespace: 'full',
    },
  });

  useEffect(() => {
    if (isOpen && atividadeId) {
      carregarTemplate();
    } else if (isOpen) {
      setTemplate({ nome: '', assunto: '', corpo: '', destinatario: '', cc: '', co: '', variaveis: {} });
    }
  }, [isOpen, atividadeId]);

  // Atualizar o editor quando o template mudar
  useEffect(() => {
    if (editor && template.corpo) {
      // Só atualizar se o conteúdo for diferente para evitar loops
      const currentContent = editor.getHTML();
      if (currentContent !== template.corpo) {
        editor.commands.setContent(template.corpo);
      }
    }
  }, [editor, template.corpo]);

  const getEmpresaIdFromStorage = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const id = parsed?.EmpresaId || localStorage.getItem('empresaId') || sessionStorage.getItem('empresaId');
      return id ? Number(id) : null;
    } catch {
      return null;
    }
  };

  const carregarTemplate = async () => {
    try {
      setLoading(true);
      const token = (localStorage.getItem('token') || sessionStorage.getItem('token') || '');
      const empresaId = getEmpresaIdFromStorage();
      const res = await fetch(`${BASE_URL}/gestao/processos/email-template/${atividadeId}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Empresa-Id': empresaId ? empresaId.toString() : '' }
      });
      const data = await res.json();
      
      console.log('Dados carregados do banco:', data); // Debug
      
      if (data && Object.keys(data).length > 0) {
        const templateData = {
          nome: data.nome || '',
          assunto: data.assunto || '',
          corpo: data.corpo || '',
          destinatario: data.destinatario || '',
          cc: data.cc || '',
          co: data.co || '',
          variaveis: data.variaveis || {}
        };
        
        console.log('Template configurado:', templateData); // Debug
        setTemplate(templateData);
        
        // Atualizar o editor diretamente se estiver disponível
        if (editor) {
          editor.commands.setContent(data.corpo || '');
        }
      } else {
        console.log('Nenhum dado encontrado no banco, usando template vazio'); // Debug
        setTemplate({ nome: '', assunto: '', corpo: '', destinatario: '', cc: '', co: '', variaveis: {} });
      }
    } catch (err) {
      console.error('Erro ao carregar template:', err); // Debug
      setTemplate({ nome: '', assunto: '', corpo: '', destinatario: '', cc: '', co: '', variaveis: {} });
    } finally {
      setLoading(false);
    }
  };

  const salvarTemplate = async () => {
    try {
      setSaving(true);
      const token = (localStorage.getItem('token') || sessionStorage.getItem('token') || '');
      const empresaId = getEmpresaIdFromStorage();
      await fetch(`${BASE_URL}/gestao/processos/email-template/${atividadeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Empresa-Id': empresaId ? empresaId.toString() : '' },
        body: JSON.stringify(template)
      });
      onClose();
    } catch (err) {
      alert('Erro ao salvar template. Verifique o console para mais detalhes.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  
// Estilos do TipTap movidos para CSS Module (.editorContent :global)

  if (loading || !editor) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.loadingText}>Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Settings size={24} style={{ color: 'var(--onity-color-primary)' }} />
            <h2 className={styles.title}>Configurar e-mail</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        {/* Conteúdo */}
        <div className={styles.section}>
          <label className={styles.label}>
            Assunto
          </label>
          <input
            type="text"
            value={template.assunto}
            onChange={e => setTemplate(prev => ({ ...prev, assunto: e.target.value }))}
            className={styles.input}
            placeholder="Assunto do e-mail"
          />

          <label className={styles.label}>
            Corpo do e-mail
          </label>
          <div className={styles.editorContainer}>
            <EditorContent 
              editor={editor} 
              className={styles.editorContent}
            />
          </div>

          <label className={styles.label}>
            Destinatário
          </label>
          <input
            type="text"
            value={template.destinatario}
            onChange={e => setTemplate(prev => ({ ...prev, destinatario: e.target.value }))}
            className={styles.input}
            placeholder="E-mail do destinatário"
          />

          <label className={styles.label}>
            CC
          </label>
          <input
            type="text"
            value={template.cc}
            onChange={e => setTemplate(prev => ({ ...prev, cc: e.target.value }))}
            className={styles.input}
            placeholder="E-mails em cópia (CC)"
          />

          <label className={styles.label}>
            CO
          </label>
          <input
            type="text"
            value={template.co}
            onChange={e => setTemplate(prev => ({ ...prev, co: e.target.value }))}
            className={styles.input}
            placeholder="E-mails em cópia oculta (CO)"
          />
        </div>

        {/* Botões */}
        <div className={styles.actions}>
          <button
            onClick={onClose}
            className={styles.buttonCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={salvarTemplate}
            disabled={saving}
            className={styles.buttonSave}
          >
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  );
} 