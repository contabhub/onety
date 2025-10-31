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
import { Settings, Mail, X, Plus, ChevronDown } from 'lucide-react';
import styles from '../../styles/gestao/EmailTemplateModal.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EmailTemplateModal({ 
  isOpen, 
  onClose, 
  atividadeId, 
  obrigacaoClienteId,
  processoId,
  tipo = 'obrigacao'
}) {
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
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAssuntoDropdown, setShowAssuntoDropdown] = useState(false);
  const [showVariaveisDropdown, setShowVariaveisDropdown] = useState(false);
  const [showContatoDropdown, setShowContatoDropdown] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [variavelPreSelecionada, setVariavelPreSelecionada] = useState('');
  const [corAtual, setCorAtual] = useState('');
  const [highlightAtual, setHighlightAtual] = useState('');
  const assuntoDropdownRef = useRef(null);
  const variaveisDropdownRef = useRef(null);
  const contatoDropdownRef = useRef(null);
  const fontDropdownRef = useRef(null);
  const colorDropdownRef = useRef(null);
  const highlightDropdownRef = useRef(null);
  const [isLight, setIsLight] = useState(false);

  // Editor TipTap
  const editor = useEditor({
    extensions: [
      StarterKit,
      Bold,
      Italic,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ 
        placeholder: "Digite o corpo do e-mail aqui...",
        showOnlyWhenEditable: true,
      }),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: template.corpo,
    immediatelyRender: false,
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      console.log('🔍 [DEBUG] HTML gerado pelo TipTap:', html);
      console.log('🔍 [DEBUG] HTML contém cores:', html.includes('color:'));
      console.log('🔍 [DEBUG] HTML contém highlight:', html.includes('background-color:'));
      setTemplate(prev => ({
        ...prev,
        corpo: html
      }));
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEmpty) {
      editor.commands.setContent("<p><br></p>");
    }
  }, [editor]);

  useEffect(() => {
    if (editor && template.corpo !== undefined && !editor.isDestroyed) {
      // Só atualizar o conteúdo se for diferente do atual
      const currentContent = editor.getHTML();
      if (currentContent !== template.corpo) {
        editor.commands.setContent(template.corpo || '');
      }
    }
  }, [template.corpo, editor]);

  // Detectar mudanças na cor ativa do editor
  useEffect(() => {
    if (editor) {
      const attributes = editor.getAttributes('textStyle');
      if (attributes.color) {
        setCorAtual(attributes.color);
      } else {
        setCorAtual('');
      }
    }
  }, [editor]);

  // Detectar mudanças no highlight ativo do editor
  useEffect(() => {
    if (editor) {
      const attributes = editor.getAttributes('highlight');
      if (attributes.color) {
        setHighlightAtual(attributes.color);
      } else {
        setHighlightAtual('');
      }
    }
  }, [editor]);

  // Focar o editor quando o modal abrir
  useEffect(() => {
    if (isOpen && editor && !editor.isDestroyed) {
      setTimeout(() => {
        editor.chain().focus().run();
      }, 100);
    }
  }, [isOpen, editor]);

  // Detectar tema atual e reagir a mudanças
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getTheme = () => document.documentElement.getAttribute('data-theme') === 'light';
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = e.detail;
      if (detail && (detail.theme === 'light' || detail.theme === 'dark')) {
        setIsLight(detail.theme === 'light');
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener('titan-theme-change', handleChange);
    return () => window.removeEventListener('titan-theme-change', handleChange);
  }, []);

  useEffect(() => {
    if (isOpen && atividadeId) {
      carregarTemplate();
      carregarVariaveis();
    } else if (isOpen) {
      setTemplate({
        nome: '',
        assunto: '',
        corpo: '',
        destinatario: '',
        cc: '',
        co: '',
        variaveis: {}
      });
    }
  }, [isOpen, atividadeId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (assuntoDropdownRef.current && !assuntoDropdownRef.current.contains(event.target)) {
        setShowAssuntoDropdown(false);
      }
      if (variaveisDropdownRef.current && !variaveisDropdownRef.current.contains(event.target)) {
        setShowVariaveisDropdown(false);
      }
      if (contatoDropdownRef.current && !contatoDropdownRef.current.contains(event.target)) {
        setShowContatoDropdown(false);
      }
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target)) {
        setShowFontDropdown(false);
      }
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target)) {
        setShowColorDropdown(false);
      }
      if (highlightDropdownRef.current && !highlightDropdownRef.current.contains(event.target)) {
        setShowHighlightDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const carregarTemplate = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        setLoading(false);
        return;
      }
      
      let endpoint = '';
      
      if (tipo === 'processo') {
        endpoint = `${BASE_URL}/gestao/processos/email-template/${atividadeId}`;
      } else if (tipo === 'obrigacao') {
        endpoint = `${BASE_URL}/gestao/obrigacoes/atividades/${atividadeId}/email-template`;
      } else {
        throw new Error('Tipo inválido para carregar template');
      }
      
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data) {
        const templateData = {
          nome: data.nome || '',
          assunto: data.assunto || '',
          corpo: data.corpo || '',
          destinatario: data.destinatario || '',
          cc: data.cc || '',
          co: data.co || '',
          variaveis: data.variaveis || {}
        };
        setTemplate(templateData);
      } else {
        setTemplate({
          nome: '',
          assunto: '',
          corpo: '',
          destinatario: '',
          cc: '',
          co: '',
          variaveis: {}
        });
      }
    } catch (err) {
      console.error('Erro ao carregar template:', err);
      setTemplate({
        nome: '',
        assunto: '',
        corpo: '',
        destinatario: '',
        cc: '',
        co: '',
        variaveis: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarVariaveis = async () => {
    try {
      if (tipo === 'processo') {
        const variaveisProcesso = {
          assunto: {
            'processo.nome': 'Nome do processo',
            'processo.departamento': 'Departamento do processo',
            'processo.responsavel': 'Responsável pelo processo',
            'empresa.nome': 'Nome da empresa',
            'datas.hoje': 'Data atual'
          },
          processo: {
            'processo.nome': 'Nome do processo',
            'processo.departamento': 'Departamento do processo',
            'processo.responsavel': 'Responsável pelo processo',
            'processo.responsavel.email': 'E-mail do responsável',
            'processo.diasMeta': 'Dias para meta',
            'processo.diasPrazo': 'Dias para prazo',
            'processo.dataReferencia': 'Data de referência'
          },
          empresa: {
            'empresa.nome': 'Nome da empresa',
            'empresa.cnpj': 'CNPJ da empresa',
            'empresa.razaoSocial': 'Razão social da empresa'
          },
          datas: {
            'datas.hoje': 'Data atual'
          }
        };
        setVariaveisDisponiveis(variaveisProcesso);
        return;
      }
      
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const endpoint = `${BASE_URL}/gestao/obrigacoes/variaveis-disponiveis`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setVariaveisDisponiveis(data);
    } catch (err) {
      console.error('Erro ao carregar variáveis:', err);
    }
  };

  const salvarTemplate = async () => {
    try {
      setSaving(true);
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        alert('Erro ao salvar template.');
        setSaving(false);
        return;
      }
      
      // ✅ Extrair apenas as variáveis usadas no template
      const variaveisUsadas = getVariaveisUsadas();
      const variaveisInvalidas = getVariaveisInvalidas();
      
      // ✅ Criar objeto apenas com as variáveis válidas usadas
      const variaveisTemplate = {};
      
      for (const variavel of variaveisUsadas) {
        if (!variaveisInvalidas.includes(variavel)) {
          // Encontrar em qual categoria está a variável
          for (const categoria in variaveisDisponiveis) {
            const categoriaVariaveis = variaveisDisponiveis[categoria];
            if (categoriaVariaveis && categoriaVariaveis[variavel]) {
              if (!variaveisTemplate[categoria]) {
                variaveisTemplate[categoria] = {};
              }
              variaveisTemplate[categoria][variavel] = categoriaVariaveis[variavel];
              break;
            }
          }
        }
      }
      
      const templateComVariaveis = {
        ...template,
        variaveis: variaveisTemplate
      };
      
      let endpoint = '';
      if (tipo === 'processo') {
        endpoint = `${BASE_URL}/gestao/processos/email-template/${atividadeId}`;
      } else if (tipo === 'obrigacao') {
        endpoint = `${BASE_URL}/gestao/obrigacoes/atividades/${atividadeId}/email-template`;
      } else {
        throw new Error('Tipo inválido para salvar template');
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify(templateComVariaveis),
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.variaveisInvalidas) {
          alert(`❌ Variáveis inválidas encontradas: ${data.variaveisInvalidas.join(', ')}`);
        } else {
          alert('Erro ao salvar template.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      onClose();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
    } finally {
      setSaving(false);
    }
  };

  const inserirVariavelNoAssunto = (variavel) => {
    const novaVariavel = `[${variavel}]`;
    setTemplate(prev => ({
      ...prev,
      assunto: prev.assunto + novaVariavel
    }));
    setShowAssuntoDropdown(false);
  };

  const handleAssuntoDropdown = (e) => {
    e.preventDefault();
    setShowAssuntoDropdown((v) => !v);
  };

  const handleContatoDropdown = (e) => {
    e.preventDefault();
    setShowContatoDropdown((v) => !v);
  };

  const selecionarVariavel = (variavel) => {
    setVariavelPreSelecionada(variavel);
    setShowContatoDropdown(false);
    setShowVariaveisDropdown(false);
  };

  const getVariaveisAssunto = () => {
    return variaveisDisponiveis.assunto || {};
  };

  const getVariaveisContato = () => {
    const variaveisContato = {};
    
    if (variaveisDisponiveis.contato) {
      Object.entries(variaveisDisponiveis.contato).forEach(([variavel, descricao]) => {
        variaveisContato[variavel] = descricao;
      });
    }
    
    if (variaveisDisponiveis.cliente) {
      Object.entries(variaveisDisponiveis.cliente).forEach(([variavel, descricao]) => {
        variaveisContato[variavel] = descricao;
      });
    }
    
    if (variaveisDisponiveis.obrigacao) {
      Object.entries(variaveisDisponiveis.obrigacao).forEach(([variavel, descricao]) => {
        variaveisContato[variavel] = descricao;
      });
    }
    
    if (variaveisDisponiveis.tarefa) {
      Object.entries(variaveisDisponiveis.tarefa).forEach(([variavel, descricao]) => {
        variaveisContato[variavel] = descricao;
      });
    }
    
    return variaveisContato;
  };

  const getAllVariaveis = () => {
    const todasVariaveis = {};
    Object.entries(variaveisDisponiveis).forEach(([categoria, variaveis]) => {
      if (categoria !== 'assunto') {
        Object.entries(variaveis).forEach(([variavel, descricao]) => {
          todasVariaveis[variavel] = descricao;
        });
      }
    });
    return todasVariaveis;
  };

  // Funções para formatação de texto usando TipTap
  const formatarTexto = (comando) => {
    if (!editor) return;
    
    switch (comando) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strikethrough':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'code':
        editor.chain().focus().toggleCode().run();
        break;
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'number':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'alignLeft':
        editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        editor.chain().focus().setTextAlign('right').run();
        break;
      default:
        return;
    }
  };

  const inserirVariavelPreSelecionada = () => {
    if (!variavelPreSelecionada || !editor) return;
    
    const variavelTexto = `[${variavelPreSelecionada}]`;
    editor.commands.insertContent(variavelTexto);
    
    setVariavelPreSelecionada('');
  };

  const aplicarFonte = (fonte) => {
    if (!editor) return;
    
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) || 'texto';
    const html = `<span style="font-family: ${fonte};">${selectedText}</span>`;
    editor.chain().focus().insertContent(html).run();
    setShowFontDropdown(false);
  };

  const aplicarAlinhamento = (alinhamento) => {
    if (!editor) return;
    
    editor.chain().focus().setTextAlign(alinhamento).run();
  };

  const aplicarCorTexto = (cor) => {
    if (!editor) return;
    
    editor.chain().focus().setColor(cor).run();
    setCorAtual(cor);
    setShowColorDropdown(false);
  };

  const aplicarHighlight = (cor) => {
    if (!editor) return;
    
    editor.chain().focus().toggleHighlight({ color: cor }).run();
    setHighlightAtual(cor);
    setShowHighlightDropdown(false);
  };

  const extrairVariaveis = (texto) => {
    if (!texto) return [];
    const regex = /\[([^\]]+)\]/g;
    const variaveis = [];
    let match;
    
    while ((match = regex.exec(texto)) !== null) {
      variaveis.push(match[1]);
    }
    
    return [...new Set(variaveis)];
  };

  const validarVariavel = (variavel) => {
    for (const categoria in variaveisDisponiveis) {
      const categoriaVariaveis = variaveisDisponiveis[categoria];
      if (categoriaVariaveis && categoriaVariaveis[variavel]) {
        return true;
      }
    }
    return false;
  };

  const getVariaveisUsadas = () => {
    const todasVariaveis = [];
    
    if (template.assunto) todasVariaveis.push(...extrairVariaveis(template.assunto));
    if (template.corpo) todasVariaveis.push(...extrairVariaveis(template.corpo));
    if (template.destinatario) todasVariaveis.push(...extrairVariaveis(template.destinatario));
    if (template.cc) todasVariaveis.push(...extrairVariaveis(template.cc));
    if (template.co) todasVariaveis.push(...extrairVariaveis(template.co));
    
    return [...new Set(todasVariaveis)];
  };

  const getVariaveisInvalidas = () => {
    const variaveisUsadas = getVariaveisUsadas();
    return variaveisUsadas.filter(variavel => !validarVariavel(variavel));
  };



  if (!isOpen) return null;

  // Garantir que o template esteja inicializado
  if (!template || typeof template !== 'object') return null;

  // Garantir que todas as propriedades do template existam
  const safeTemplate = {
    nome: template.nome || '',
    assunto: template.assunto || '',
    corpo: template.corpo || '',
    destinatario: template.destinatario || '',
    cc: template.cc || '',
    co: template.co || '',
    variaveis: template.variaveis || {}
  };

  // Garantir que o componente só renderize quando estiver pronto
  if (loading || !editor) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.loading}>Carregando...</div>
        </div>
      </div>
    );
  }

  // Constantes para fontes
  const fonts = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
    { value: 'Impact, sans-serif', label: 'Impact' },
    { value: 'Tahoma, sans-serif', label: 'Tahoma' },
    { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' }
  ];

  const alignments = [
    { value: 'left', label: 'Alinhar à esquerda', icon: '◀' },
    { value: 'center', label: 'Centralizar', icon: '◀▶' },
    { value: 'right', label: 'Alinhar à direita', icon: '▶' },
    { value: 'justify', label: 'Justificar', icon: '◀▶◀' }
  ];

  const textColors = [
    // Cores básicas
    { value: '#000000', label: 'Preto' },
    { value: '#FFFFFF', label: 'Branco' },
    
    // Tons de cinza
    { value: '#333333', label: 'Cinza Escuro' },
    { value: '#666666', label: 'Cinza Médio' },
    { value: '#999999', label: 'Cinza Claro' },
    { value: '#CCCCCC', label: 'Cinza Muito Claro' },
    
    // Cores primárias
    { value: '#FF0000', label: 'Vermelho' },
    { value: '#00FF00', label: 'Verde' },
    { value: '#0000FF', label: 'Azul' },
    
    // Cores secundárias
    { value: '#FFFF00', label: 'Amarelo' },
    { value: '#FF00FF', label: 'Rosa' },
    { value: '#00FFFF', label: 'Ciano' },
    { value: '#FFA500', label: 'Laranja' },
    { value: '#800080', label: 'Roxo' },
    
    // Cores escuras
    { value: '#800000', label: 'Marrom' },
    { value: '#008000', label: 'Verde Escuro' },
    { value: '#000080', label: 'Azul Escuro' },
    { value: '#008080', label: 'Ciano Escuro' },
  ];

  const highlightColors = [
    // Cores de highlight suaves e legíveis
    { value: '#ffc078', label: 'Laranja' },
    { value: '#8ce99a', label: 'Verde' },
    { value: '#74c0fc', label: 'Azul' },
    { value: '#b197fc', label: 'Roxo' },
    { value: '#ffa8a8', label: 'Rosa' },
    { value: '#ffd43b', label: 'Amarelo' },
    { value: '#ff8787', label: 'Vermelho' },
    { value: '#51cf66', label: 'Verde Claro' },
    { value: '#339af0', label: 'Azul Claro' },
    { value: '#cc5de8', label: 'Roxo Claro' },
    { value: '#ff6b6b', label: 'Vermelho Claro' },
    { value: '#fcc419', label: 'Amarelo Claro' },
    { value: '#69db7c', label: 'Verde Suave' },
    { value: '#4dabf7', label: 'Azul Suave' },
    { value: '#da77f2', label: 'Rosa Suave' },
    { value: '#ff922b', label: 'Laranja Suave' },
  ];

  

  return (
    <div className={`${styles.overlay} ${isLight ? styles.overlayLight : ''}`}>
      <div className={`${styles.modal} ${isLight ? styles.modalLight : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Settings size={24} className={styles.headerIcon} />
            <h2 className={styles.headerTitle}>Configurando e-mail</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className={`${styles.tabs} ${isLight ? styles.tabsLight : ''}`}>
          <button
            onClick={() => setActiveTab('template')}
            className={`${styles.tab} ${activeTab === 'template' ? styles.tabActive : ''}`}
          >
            Texto Padrão
          </button>
          <button
            onClick={() => setActiveTab('variaveis')}
            className={`${styles.tab} ${activeTab === 'variaveis' ? styles.tabActive : ''}`}
          >
            Variáveis
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'template' ? (
            <div className={styles.tabContent}>
              {/* ✅ Indicador de variáveis */}
              {(() => {
                const variaveisUsadas = getVariaveisUsadas();
                const variaveisInvalidas = getVariaveisInvalidas();
                const variaveisValidas = variaveisUsadas.filter(v => !variaveisInvalidas.includes(v));
                
                if (variaveisUsadas.length > 0) {
                  return (
                    <div className={`${styles.alert} ${variaveisInvalidas.length > 0 ? styles.alertError : styles.alertInfo}`}>
                      <div className={styles.alertTitle}>
                        📊 Variáveis detectadas: {variaveisUsadas.length} 
                        {variaveisValidas.length > 0 && ` (${variaveisValidas.length} válidas)`}
                      </div>
                      <div className={styles.alertVars}>
                        {variaveisUsadas.map(v => (
                          <span key={v} className={`${styles.varBadge} ${variaveisInvalidas.includes(v) ? styles.varBadgeError : styles.varBadgeInfo}`}>
                            [{v}]
                          </span>
                        ))}
                      </div>
                      {variaveisInvalidas.length > 0 && (
                        <div className={styles.alertErrorText}>
                          ⚠️ Variáveis inválidas: {variaveisInvalidas.join(', ')}
                        </div>
                      )}
                      {variaveisValidas.length > 0 && (
                        <div className={styles.alertSuccessText}>
                          ✅ Variáveis que serão salvas: {variaveisValidas.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className={styles.stack}>
                <div className={styles.field}>
                  <label className={styles.label}>Destinatário</label>
                  <input
                    type="text"
                    value={safeTemplate.destinatario}
                    onChange={(e) => setTemplate(prev => ({ ...prev, destinatario: e.target.value }))}
                    className={`${styles.input} ${styles.inputWide}`}
                    placeholder="Selecione a categoria de e-mail para seleção dos contatos..."
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Assunto</label>
                  <div className={styles.dropdownContainer}>
                    <input
                      type="text"
                      value=""
                      readOnly
                      className={`${styles.input} ${styles.inputWide}`}
                      placeholder="Escolha uma variável"
                      onClick={handleAssuntoDropdown}
                    />
                    <button
                      onClick={handleAssuntoDropdown}
                      className={styles.dropdownButton}
                      tabIndex={-1}
                      type="button"
                    >
                      <ChevronDown size={16} />
                    </button>
                    {showAssuntoDropdown && (
                      <div
                        ref={assuntoDropdownRef}
                        className={styles.dropdown}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <div className={styles.dropdownHeader}>Escolha uma variável</div>
                        {Object.entries(getVariaveisAssunto()).map(([variavel, descricao]) => (
                          <button
                            key={variavel}
                            onClick={() => inserirVariavelNoAssunto(variavel)}
                            className={styles.dropdownItem}
                            type="button"
                          >
                            [{variavel}]
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Campo de input para o assunto */}
                  <input
                    type="text"
                    value={safeTemplate.assunto}
                    onChange={(e) => setTemplate(prev => ({ ...prev, assunto: e.target.value }))}
                    className={`${styles.input} ${styles.inputWide} ${styles.inputMarginTop}`}
                    placeholder="Digite o assunto do e-mail aqui..."
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.corpoHeader}>
                    <label className={styles.label}>Corpo do e-mail</label>
                    <div className={styles.corpoControls}>
                      <div className={styles.dropdownContainer}>
                        <input
                          type="text"
                          placeholder="Escolha uma variável"
                          value={variavelPreSelecionada ? `[${variavelPreSelecionada}]` : ''}
                          className={styles.contactInput}
                          onClick={handleContatoDropdown}
                          readOnly
                        />
                        <button
                          onClick={handleContatoDropdown}
                          className={styles.dropdownButton}
                          tabIndex={-1}
                          type="button"
                        >
                          <ChevronDown size={16} />
                        </button>
                        {showContatoDropdown && (
                          <div
                            ref={contatoDropdownRef}
                            className={styles.dropdown}
                            onMouseDown={e => e.preventDefault()}
                          >
                            <div className={styles.dropdownHeader}>Escolha uma variável</div>
                            {Object.entries(getVariaveisContato()).map(([variavel, descricao]) => (
                              <button
                                key={variavel}
                                onClick={() => selecionarVariavel(variavel)}
                                className={styles.dropdownItem}
                                type="button"
                              >
                                [{variavel}]
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={inserirVariavelPreSelecionada}
                        className={`${styles.addVariableButton} ${!variavelPreSelecionada ? styles.addVariableDisabled : ''}`}
                        disabled={!variavelPreSelecionada}
                      >
                        + Adicionar Variável{variavelPreSelecionada ? `: [${variavelPreSelecionada}]` : ''}
                      </button>
                    </div>
                  </div>

                  {/* Editor de texto rico com TipTap */}
                  <div className={styles.editorContainer}>
                    <div className={`${styles.toolbar} ${isLight ? styles.toolbarLight : ''}`}>
                      <button 
                        onClick={() => formatarTexto('bold')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('bold') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Negrito"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1024 1024">
                          <path fill="currentColor" d="M697.8 481.4c33.6-35 54.2-82.3 54.2-134.3v-10.2C752 229.3 663.9 142 555.3 142H259.4c-15.1 0-27.4 12.3-27.4 27.4v679.1c0 16.3 13.2 29.5 29.5 29.5h318.7c117 0 211.8-94.2 211.8-210.5v-11c0-73-37.4-137.3-94.2-175.1M328 238h224.7c57.1 0 103.3 44.4 103.3 99.3v9.5c0 54.8-46.3 99.3-103.3 99.3H328zm366.6 429.4c0 62.9-51.7 113.9-115.5 113.9H328V542.7h251.1c63.8 0 115.5 51 115.5 113.9z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => formatarTexto('italic')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('italic') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Itálico"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M10 4v3h2.21l-3.42 10H6v3h8v-3h-2.21l3.42-10H18V4z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => formatarTexto('underline')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('underline') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Sublinhado"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M12 17a5 5 0 0 0 5-5V4h-2v8a3 3 0 0 1-6 0V4H7v8a5 5 0 0 0 5 5m-7 2v2h14v-2z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => formatarTexto('strikethrough')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('strike') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Tachado"
                      >
                        S
                      </button>
                      <div className={styles.toolbarSeparator}></div>
                      <button 
                        onClick={() => formatarTexto('quote')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('blockquote') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Citação"
                      >
                        "
                      </button>
                      <button 
                        onClick={() => formatarTexto('code')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('code') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Código"
                      >
                        &lt;/&gt;
                      </button>
                      <div className={styles.toolbarSeparator}></div>
                      <button 
                        onClick={() => formatarTexto('bullet')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('bulletList') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Lista com marcadores"
                      >
                        •
                      </button>
                      <button 
                        onClick={() => formatarTexto('number')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive('orderedList') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Lista numerada"
                      >
                        1.
                      </button>
                      <div className={styles.toolbarSeparator}></div>
                      
                      {/* Botões de Alinhamento */}
                      <button 
                        onClick={() => formatarTexto('alignLeft')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive({ textAlign: 'left' }) || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Alinhar à esquerda"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M3 3h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3zm0 4h18v2H3z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => formatarTexto('alignCenter')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive({ textAlign: 'center' }) || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Centralizar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M4 3h16v2H4zm2 4h12v2H6zm-2 4h16v2H4zm2 4h12v2H6zm-2 4h16v2H4z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => formatarTexto('alignRight')} 
                        className={`${styles.toolbarButton} ${(editor?.isActive({ textAlign: 'right' }) || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                        title="Alinhar à direita"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M3 3h18v2H3zm6 4h12v2H9zm-6 4h18v2H3zm6 4h12v2H9zm-6 4h18v2H3z" />
                        </svg>
                      </button>
                      <div className={styles.toolbarSeparator}></div>
                      
                      {/* Botão de Cor do Texto */}
                      <div className={styles.toolbarPicker}>
                        <button 
                          onClick={() => setShowColorDropdown(!showColorDropdown)}
                          className={`${styles.toolbarButton} ${(editor?.isActive('textStyle') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                          title="Cor do texto"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          {corAtual && (<span className={styles.colorDot} style={{ backgroundColor: corAtual }} />)}
                        </button>
                        {showColorDropdown && (
                          <div ref={colorDropdownRef} className={styles.colorPicker}>
                            <div className={styles.colorPickerHeader}></div>
                            {textColors.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => aplicarCorTexto(color.value)}
                                className={styles.colorSwatch}
                                style={{ ['--swatch-color']: color.value, ['--swatch-border']: editor?.isActive('textStyle', { color: color.value }) ? '2px solid #2563eb' : '1px solid #d1d5db' }}
                                title={color.label}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botão de Highlight com Cores */}
                      <div className={styles.toolbarPicker}>
                        <button 
                          onClick={() => setShowHighlightDropdown(!showHighlightDropdown)}
                          className={`${styles.toolbarButton} ${(editor?.isActive('highlight') || false) ? styles.active : ''} ${isLight ? styles.light : ''}`}
                          title="Cor de destaque"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M15.6 11.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 7.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
                          </svg>
                          {highlightAtual && (<span className={styles.colorDot} style={{ backgroundColor: highlightAtual }} />)}
                        </button>
                        {showHighlightDropdown && (
                          <div ref={highlightDropdownRef} className={styles.colorPicker}>
                            {highlightColors.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => aplicarHighlight(color.value)}
                                className={styles.colorSwatch}
                                style={{ ['--swatch-color']: color.value, ['--swatch-border']: editor?.isActive('highlight', { color: color.value }) ? '2px solid #2563eb' : '1px solid #d1d5db' }}
                                title={color.label}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botão de Fonte */}
                      <div className={styles.toolbarPicker}>
                        <button 
                          onClick={() => setShowFontDropdown(!showFontDropdown)}
                          className={`${styles.toolbarButton} ${isLight ? styles.light : ''}`}
                          title="Fonte"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M9 4v3h5v12h3V7h5V4H9zM3 12h3v7h3v-7H12V9H3v3z"/>
                          </svg>
                        </button>
                        {showFontDropdown && (
                          <div ref={fontDropdownRef} className={styles.fontPicker}>
                            {fonts.map((font) => (
                              <button
                                key={font.value}
                                onClick={() => aplicarFonte(font.value)}
                                className={styles.fontButton}
                                title={font.label}
                              >
                                {font.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div 
                      className={styles.editorWrapper}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (editor && !editor.isDestroyed) {
                          editor.chain().focus().run();
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (editor && !editor.isDestroyed) {
                          editor.chain().focus().run();
                        }
                      }}
                    >
                      <EditorContent 
                        editor={editor}
                        className={styles.editor}
                      />
                    </div>
                  </div>

                  {showVariaveisDropdown && (
                    <div ref={variaveisDropdownRef} className={styles.variaveisDropdown}>
                      {Object.entries(variaveisDisponiveis).map(([categoria, variaveis]) => (
                        <div key={categoria} className={styles.variaveisCategory}>
                          <h4 className={styles.variaveisCategoryTitle}>{categoria}</h4>
                          {Object.entries(variaveis).map(([variavel, descricao]) => (
                            <button
                              key={variavel}
                              onClick={() => selecionarVariavel(variavel)}
                              className={styles.variaveisItem}
                              title={descricao}
                            >
                              [{variavel}]
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.tabContent}>
              <div className={styles.varIntro}>
                <p className={styles.varIntroText}>
                  Clique em uma variável para inserir no corpo do e-mail. As variáveis serão substituídas pelos valores reais quando o e-mail for enviado.
                </p>
              </div>

              <div className={styles.varsGrid}>
                {Object.entries(variaveisDisponiveis).map(([categoria, variaveis]) => (
                  <div key={categoria} className={styles.variableCategory}>
                    <h3 className={styles.variableCategoryTitle}>
                      {categoria}
                    </h3>
                    <div className={styles.variableList}>
                      {Object.entries(variaveis).map(([variavel, descricao]) => (
                        <button
                          key={variavel}
                          onClick={() => selecionarVariavel(variavel)}
                          className={styles.variableButton}
                          title={descricao}
                        >
                          <div className={styles.variableName}>[{variavel}]</div>
                          <div className={styles.variableDescription}>{descricao}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button 
            onClick={onClose} 
            className={styles.cancelButton}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={salvarTemplate}
            disabled={saving}
            className={`${styles.saveButton} ${saving ? styles.saveButtonDisabled : ''}`}
          >
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
      <style jsx global>{`
        .ProseMirror:focus {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .ProseMirror {
          outline: none !important;
          border: none !important;
          min-height: 200px !important;
          padding: var(--onity-space-m) !important;
          cursor: text !important;
          width: 100% !important;
          height: 100% !important;
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          color: var(--onity-color-text) !important;
          background: transparent !important;
        }
        
        .ProseMirror p {
          margin: 0;
          padding: 0;
          min-height: 1.5em;
          color: var(--onity-color-text) !important;
        }
        
        .ProseMirror ul, .ProseMirror ol {
          margin: 0;
          padding-left: 20px;
        }
        
        .ProseMirror blockquote {
          border-left: 3px solid var(--onity-color-border);
          margin: 0;
          padding-left: var(--onity-space-m);
          color: var(--onity-color-text);
        }
        
        .ProseMirror code {
          background-color: var(--onity-color-bg);
          padding: 2px 4px;
          border-radius: var(--onity-radius-xs);
          font-family: monospace;
          color: var(--onity-color-text);
        }
        
        .ProseMirror mark {
          border-radius: 2px;
          padding: 1px 2px;
        }
        
        /* Garantir que toda a área seja clicável */
        .ProseMirror:empty::before {
          content: attr(data-placeholder);
          color: var(--onity-color-text);
          pointer-events: none;
          position: absolute;
        }
      `}</style>
    </div>
  );
}

// Estilos do modal
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

const modalStyle = {
  background: "rgba(11, 11, 17, 0.6)",
  borderRadius: "var(--titan-radius-lg)",
  maxWidth: "800px",
  width: "90%",
  padding: "var(--titan-spacing-lg)",
  boxShadow: "var(--titan-shadow-lg)",
  maxHeight: "90vh",
  overflowY: "auto",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "sans-serif",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--titan-spacing-lg)"
};

const headerContentStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--titan-spacing-sm)",
};

const headerTitleStyle = {
  margin: 0,
  fontSize: "var(--titan-font-size-xl)",
  fontWeight: "var(--titan-font-weight-semibold)",
  color: "var(--titan-text-high)"
};

const closeButtonStyle = {
  background: "none",
  border: "none",
  fontSize: "24px",
  cursor: "pointer",
  color: "var(--titan-text-med)",
  padding: "4px",
  borderRadius: "var(--titan-radius-sm)",
  transition: "all var(--titan-transition-fast)",
};

const tabStyle = (active) => ({
  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
  fontWeight: "var(--titan-font-weight-medium)",
  fontSize: "var(--titan-font-size-sm)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: active ? "var(--titan-primary)" : "var(--titan-text-med)",
  borderBottom: active ? "2px solid var(--titan-primary)" : "2px solid transparent",
  transition: "all var(--titan-transition-fast)",
});

const contentStyle = {
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  marginBottom: "var(--titan-spacing-lg)"
};

const tabContentStyle = {
  padding: "var(--titan-spacing-lg)",
  height: "100%",
  overflowY: "auto",
};

const footerStyle = {
  display: "flex",
  gap: "var(--titan-spacing-sm)",
  justifyContent: "flex-end",
  marginBottom: "var(--titan-spacing-lg)"
};

const buttonStyle = {
  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
  borderRadius: "var(--titan-radius-sm)",
  fontSize: "var(--titan-font-size-sm)",
  fontWeight: "var(--titan-font-weight-medium)",
  cursor: "pointer",
  border: "none",
  transition: "all var(--titan-transition-fast)",
};

const cancelButtonStyle = {
  ...buttonStyle,
  background: "rgba(255, 255, 255, 0.15)",
  color: "var(--titan-text-high)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
};

const saveButtonStyle = {
  ...buttonStyle,
  background: "var(--titan-primary)",
  color: "white",
  border: "none",
};

const inputStyle = {
  width: "100%",
  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
  borderRadius: "var(--titan-radius-sm)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  fontSize: "var(--titan-font-size-sm)",
  outline: "none",
  boxShadow: "none",
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  color: "var(--titan-text-high)",
  cursor: "pointer",
  transition: "all var(--titan-transition-fast)",
};

const destinatarioInputStyle = {
  ...inputStyle,
  width: "96%",
  fontSize: "var(--titan-font-size-xs)",
};

const assuntoInputStyle = {
  ...inputStyle,
  width: "96%",
  fontSize: "var(--titan-font-size-xs)",
};

const labelStyle = {
  display: "block",
  fontSize: "var(--titan-font-size-sm)",
  fontWeight: "var(--titan-font-weight-medium)",
  color: "var(--titan-text-high)",
  marginBottom: "var(--titan-spacing-sm)",
};

const fieldStyle = {
  marginBottom: "var(--titan-spacing-md)",
};

const dropdownContainerStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const dropdownButtonStyle = {
  position: "absolute",
  right: "var(--titan-spacing-sm)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--titan-text-med)",
  display: "flex",
  alignItems: "center",
  transition: "all var(--titan-transition-fast)",
};

const dropdownStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  background: "rgba(11, 11, 17, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  boxShadow: "var(--titan-shadow-lg)",
  zIndex: 10,
  maxHeight: "200px",
  overflowY: "auto",
  marginTop: "2px",
};

const dropdownHeaderStyle = {
  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
  background: "var(--titan-primary)",
  color: "white",
  fontSize: "var(--titan-font-size-sm)",
  fontWeight: "var(--titan-font-weight-medium)",
};

const dropdownItemStyle = {
  width: "100%",
  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--titan-font-size-xs)",
  textAlign: "left",
  fontFamily: "monospace",
  color: "var(--titan-primary)",
  transition: "background-color var(--titan-transition-fast)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
};

const corpoHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "var(--titan-spacing-sm)",
};

const corpoControlsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--titan-spacing-sm)",
};

const contactInputStyle = {
  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-sm)",
  fontSize: "var(--titan-font-size-xs)",
  width: "180px",
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  color: "var(--titan-text-high)",
  cursor: "pointer",
  transition: "all var(--titan-transition-fast)",
};

const addVariableButtonStyle = {
  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
  background: "var(--titan-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--titan-radius-sm)",
  fontSize: "var(--titan-font-size-xs)",
  cursor: "pointer",
  transition: "all var(--titan-transition-fast)",
};

const editorContainerStyle = {
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  overflow: "hidden",
};

const toolbarStyle = (isLight) => ({
  display: "flex",
  alignItems: "center",
  gap: "var(--titan-spacing-xs)",
  padding: "var(--titan-spacing-sm)",
  background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.1)",
  borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
  flexWrap: "wrap",
  borderRadius: "var(--titan-radius-md) var(--titan-radius-md) 0 0",
});

const toolbarButtonStyle = (active, isLight) => ({
  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
  background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.1)",
  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-xs)",
  cursor: "pointer",
  fontSize: "var(--titan-font-size-xs)",
  fontWeight: "var(--titan-font-weight-semibold)",
  minWidth: "24px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all var(--titan-transition-fast)",
  color: active ? "#fff" : (isLight ? "var(--titan-text-high)" : "#fff"),
  backgroundColor: active
    ? "var(--titan-primary)"
    : (isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.1)"),
});

const toolbarSeparatorStyle = {
  width: "1px",
  height: "16px",
  background: "rgba(255, 255, 255, 0.3)",
  margin: "0 var(--titan-spacing-xs)",
};

const toolbarSelectStyle = {
  padding: "var(--titan-spacing-xs)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-xs)",
  fontSize: "var(--titan-font-size-xs)",
  background: "rgba(255, 255, 255, 0.1)",
  color: "var(--titan-text-high)",
};

const editorTextareaStyle = {
  width: "100%",
  minHeight: "200px",
  padding: "var(--titan-spacing-md)",
  border: "none",
  outline: "none",
  fontSize: "var(--titan-font-size-sm)",
  fontFamily: "inherit",
  resize: "none",
  lineHeight: "1.5",
  position: "relative",
  backgroundColor: "transparent",
  color: "var(--titan-text-high)",
};

const editorWrapperStyle = {
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  padding: "0",
  minHeight: "200px",
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  cursor: "text",
  outline: "none",
  boxShadow: "none",
  overflow: "hidden",
  position: "relative",
};

const editorPlaceholderStyle = {
  position: "absolute",
  top: "var(--titan-spacing-md)",
  left: "var(--titan-spacing-md)",
  color: "var(--titan-text-med)",
  fontSize: "var(--titan-font-size-sm)",
  fontFamily: "inherit",
  pointerEvents: "none",
  zIndex: 1,
};

const variaveisDropdownStyle = {
  position: "absolute",
  top: "100%",
  right: 0,
  background: "rgba(11, 11, 17, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  boxShadow: "var(--titan-shadow-lg)",
  zIndex: 10,
  maxHeight: "300px",
  overflowY: "auto",
  width: "250px",
};

const variaveisCategoryStyle = {
  padding: "var(--titan-spacing-sm)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
};

const variaveisCategoryTitleStyle = {
  fontSize: "var(--titan-font-size-xs)",
  fontWeight: "var(--titan-font-weight-semibold)",
  color: "var(--titan-text-high)",
  marginBottom: "var(--titan-spacing-sm)",
  textTransform: "capitalize",
};

const variaveisItemStyle = {
  width: "100%",
  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--titan-font-size-xs)",
  textAlign: "left",
  fontFamily: "monospace",
  color: "var(--titan-primary)",
  transition: "background-color var(--titan-transition-fast)",
  display: "block",
  marginBottom: "2px",
};

const variableButtonStyle = {
  width: "100%",
  textAlign: "left",
  padding: "var(--titan-spacing-sm)",
  background: "transparent",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-sm)",
  cursor: "pointer",
  fontSize: "var(--titan-font-size-sm)",
  transition: "all var(--titan-transition-fast)",
  color: "var(--titan-text-high)",
};

const variableCategoryStyle = {
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  padding: "var(--titan-spacing-md)",
  backgroundColor: "rgba(255, 255, 255, 0.05)",
};

const variableNameStyle = {
  fontFamily: "monospace",
  color: "var(--titan-primary)",
  fontSize: "var(--titan-font-size-sm)",
  fontWeight: "var(--titan-font-weight-medium)",
};

const variableDescriptionStyle = {
  color: "var(--titan-text-med)",
  fontSize: "var(--titan-font-size-xs)",
  marginTop: "var(--titan-spacing-xs)",
}; 

const fontPickerStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  background: "rgba(11, 11, 17, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  boxShadow: "var(--titan-shadow-lg)",
  zIndex: 10,
  padding: "var(--titan-spacing-sm)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--titan-spacing-xs)",
  width: "180px",
};

const fontButtonStyle = {
  width: "100%",
  padding: "var(--titan-spacing-sm)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--titan-font-size-xs)",
  textAlign: "left",
  transition: "background-color var(--titan-transition-fast)",
  borderRadius: "var(--titan-radius-xs)",
  color: "var(--titan-text-high)",
};

const colorPickerStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  background: "rgba(11, 11, 17, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "var(--titan-radius-md)",
  boxShadow: "var(--titan-shadow-lg)",
  zIndex: 10,
  padding: "var(--titan-spacing-sm)",
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "var(--titan-spacing-xs)",
  width: "220px",
  maxHeight: "250px",
  overflowY: "auto",
};