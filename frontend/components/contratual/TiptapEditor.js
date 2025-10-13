'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { 
  FaBold, 
  FaItalic, 
  FaUnderline, 
  FaAlignLeft, 
  FaAlignCenter, 
  FaAlignRight, 
  FaAlignJustify,
  FaListUl,
  FaListOl,
  FaUndo,
  FaRedo,
  FaImage
} from 'react-icons/fa'
import { useState, useRef, useEffect } from 'react'
import styles from '../../styles/contratual/TiptapEditor.module.css'

// Função para processar HTML e converter imagens para formato correto
const processHtmlContent = (htmlContent) => {
  if (!htmlContent) return htmlContent;
  
  console.log('Processando HTML original:', htmlContent.substring(0, 200) + '...');
  
  // Remove as divs com text-align center que envolvem imagens
  let processedHtml = htmlContent.replace(
    /<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (match, content) => {
      // Se o conteúdo tem uma imagem, retorna apenas a imagem
      if (content.includes('<img')) {
        console.log('Encontrada imagem em div centralizada:', content.substring(0, 100) + '...');
        return content;
      }
      return match;
    }
  );
  
  // Garante que as imagens tenham os estilos corretos
  processedHtml = processedHtml.replace(
    /<img([^>]*)>/gi,
    (match, attributes) => {
      // Se já tem style, adiciona os estilos necessários
      if (attributes.includes('style=')) {
        return `<img${attributes} style="max-width: 100%; height: auto; display: block; margin: 1em auto;">`;
      } else {
        return `<img${attributes} style="max-width: 100%; height: auto; display: block; margin: 1em auto;">`;
      }
    }
  );
  
  // Verifica se há imagens em base64 e garante que estejam corretas
  const base64Images = processedHtml.match(/<img[^>]*src="data:image[^"]*"[^>]*>/gi);
  if (base64Images) {
    console.log('Encontradas', base64Images.length, 'imagens em base64');
    base64Images.forEach((img, index) => {
      console.log(`Imagem ${index + 1} base64:`, img.substring(0, 100) + '...');
    });
  }
  
  console.log('HTML processado:', processedHtml.substring(0, 200) + '...');
  
  return processedHtml;
};

const TiptapEditor = ({ 
  content = '', 
  onChange, 
  onInsertVariable,
  showVariableButton = true,
  placeholder = 'Digite o conteúdo do template...',
  onImageUrlWarning,
  onEditorReady
}) => {
  const [showVariaveis, setShowVariaveis] = useState(false)
  const imageInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: processHtmlContent(content),
    onUpdate: ({ editor }) => {
      console.log('Editor atualizado, HTML atual:', editor.getHTML().substring(0, 200) + '...');
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: styles.editorContent,
        'data-placeholder': placeholder,
      },
      // Limpa formatação excessiva ao colar texto de outros lugares
      transformPastedHTML(html) {
        // Remove estilos inline excessivos, mantendo apenas formatação básica
        let cleanHtml = html
          // Remove classes CSS
          .replace(/\sclass="[^"]*"/gi, '')
          // Remove IDs
          .replace(/\sid="[^"]*"/gi, '')
          // Remove data attributes
          .replace(/\sdata-[a-z-]*="[^"]*"/gi, '')
          // Remove estilos inline complexos, mas preserva formatação básica
          .replace(/\sstyle="([^"]*)"/gi, (match, styleContent) => {
            // Preserva apenas estilos de formatação de texto básicos
            const allowedStyles = []
            if (styleContent.includes('font-weight: bold') || styleContent.includes('font-weight:bold')) {
              allowedStyles.push('font-weight: bold')
            }
            if (styleContent.includes('font-style: italic') || styleContent.includes('font-style:italic')) {
              allowedStyles.push('font-style: italic')
            }
            if (styleContent.includes('text-decoration: underline') || styleContent.includes('text-decoration:underline')) {
              allowedStyles.push('text-decoration: underline')
            }
            if (styleContent.includes('text-align:')) {
              const alignMatch = styleContent.match(/text-align:\s*(left|center|right|justify)/i)
              if (alignMatch) {
                allowedStyles.push(`text-align: ${alignMatch[1]}`)
              }
            }
            return allowedStyles.length > 0 ? ` style="${allowedStyles.join('; ')}"` : ''
          })
          // Remove tags span vazias ou sem propósito
          .replace(/<span[^>]*>\s*<\/span>/gi, '')
          // Remove quebras de linha duplas desnecessárias
          .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>')
          // Remove espaços excessivos entre tags
          .replace(/>\s+</g, '><')
          // Remove espaços excessivos antes e depois de variáveis
          .replace(/\s*(\{\{[^}]+\}\})\s*/g, ' $1 ')
          // Remove comentários HTML
          .replace(/<!--[\s\S]*?-->/g, '')
          // Remove tags meta, link, style
          .replace(/<(meta|link|style)[^>]*>.*?<\/\1>/gi, '')
          .replace(/<(meta|link)[^>]*>/gi, '')
        
        console.log('HTML original colado:', html.substring(0, 200) + '...')
        console.log('HTML limpo após transformação:', cleanHtml.substring(0, 200) + '...')
        
        return cleanHtml
      },
    },
    immediatelyRender: false,
  })

  // Expor a referência do editor quando estiver pronto
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Atualiza o editor quando o conteúdo muda externamente
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      const processedContent = processHtmlContent(content);
      console.log('Atualizando editor com conteúdo processado:', processedContent.substring(0, 200) + '...');
      editor.commands.setContent(processedContent);
    }
  }, [content, editor])

  // Adiciona suporte para colar imagens e validação de URLs externas
  useEffect(() => {
    if (!editor) return

    const handlePaste = (event) => {
      const items = Array.from(event.clipboardData?.items || [])
      const image = items.find(item => item.type.indexOf('image') === 0)
      
      if (image) {
        event.preventDefault()
        const file = image.getAsFile()
        const reader = new FileReader()
        
        reader.onload = () => {
          editor.chain().focus().setImage({ src: reader.result }).run()
        }
        
        reader.readAsDataURL(file)
      } else {
        // Verifica se há HTML colado com imagens de URLs externas
        const html = event.clipboardData?.getData('text/html')
        if (html && html.includes('<img')) {
          const imgUrlMatch = html.match(/<img[^>]*src=["'](?!data:)[^"']+["'][^>]*>/gi)
          if (imgUrlMatch && imgUrlMatch.length > 0) {
            event.preventDefault()
            // Chama a função de callback se fornecida
            if (onImageUrlWarning) {
              onImageUrlWarning('Imagens coladas de outros sites não são suportadas. Baixe a imagem para seu computador e use o botão de upload para inseri-la.')
            } else {
              console.warn('Imagens coladas de outros sites não são suportadas. Baixe a imagem para seu computador e use o botão de upload para inseri-la.')
            }
            return
          }
        }
        
        // Log para debug: mostra quando texto formatado é colado
        if (html && html.length > 0) {
          console.log('Texto formatado colado - será limpo automaticamente pelo transformPastedHTML')
        }
      }
    }

    editor.view.dom.addEventListener('paste', handlePaste)
    
    return () => {
      editor.view.dom.removeEventListener('paste', handlePaste)
    }
  }, [editor, onImageUrlWarning])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = function (event) {
      editor.chain().focus().setImage({ src: event.target.result }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleInsertVariable = (variableName) => {
    const tag = `{{${variableName}}}`
    editor.commands.insertContent(tag)
  }

  if (!editor) {
    return null
  }

  return (
    <div className={styles.editorWrapper}>
      <div className={styles.toolbar}>
        {/* Botão de inserir variável */}
        {showVariableButton && (
          <button
            type="button"
            onClick={() => setShowVariaveis(!showVariaveis)}
            className={styles.toolbarButton}
            title="Inserir Variável"
          >
            📝
          </button>
        )}

        {/* Separador */}
        <div className={styles.separator}></div>

        {/* Formatação básica */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${styles.toolbarButton} ${editor.isActive('bold') ? styles.active : ''}`}
          title="Negrito"
        >
          <FaBold />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${styles.toolbarButton} ${editor.isActive('italic') ? styles.active : ''}`}
          title="Itálico"
        >
          <FaItalic />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${styles.toolbarButton} ${editor.isActive('underline') ? styles.active : ''}`}
          title="Sublinhado"
        >
          <FaUnderline />
        </button>

        <div className={styles.separator}></div>

        {/* Alinhamento */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`${styles.toolbarButton} ${editor.isActive('textAlign', { align: 'left' }) ? styles.active : ''}`}
          title="Alinhar à esquerda"
        >
          <FaAlignLeft />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`${styles.toolbarButton} ${editor.isActive('textAlign', { align: 'center' }) ? styles.active : ''}`}
          title="Centralizar"
        >
          <FaAlignCenter />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`${styles.toolbarButton} ${editor.isActive('textAlign', { align: 'right' }) ? styles.active : ''}`}
          title="Alinhar à direita"
        >
          <FaAlignRight />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`${styles.toolbarButton} ${editor.isActive('textAlign', { align: 'justify' }) ? styles.active : ''}`}
          title="Justificar"
        >
          <FaAlignJustify />
        </button>

        <div className={styles.separator}></div>

        {/* Listas */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${styles.toolbarButton} ${editor.isActive('bulletList') ? styles.active : ''}`}
          title="Lista com marcadores"
        >
          <FaListUl />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${styles.toolbarButton} ${editor.isActive('orderedList') ? styles.active : ''}`}
          title="Lista numerada"
        >
          <FaListOl />
        </button>

        <div className={styles.separator}></div>

        {/* Desfazer/Refazer */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={styles.toolbarButton}
          title="Desfazer"
        >
          <FaUndo />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={styles.toolbarButton}
          title="Refazer"
        >
          <FaRedo />
        </button>

        <div className={styles.separator}></div>

        {/* Upload de imagem */}
        <button
          type="button"
          onClick={() => imageInputRef.current.click()}
          className={styles.toolbarButton}
          title="Inserir imagem"
        >
          <FaImage />
        </button>
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
      </div>

      {/* Modal de variáveis */}
      {showVariaveis && (
        <div className={styles.variablesModal}>
          <div className={styles.variablesContent}>
            <h3>Inserir Variável</h3>
            <div className={styles.variablesList}>
              {[
                'nome_cliente',
                'email_cliente',
                'telefone_cliente',
                'cpf_cliente',
                'cnpj_cliente',
                'endereco_cliente',
                'data_contrato',
                'valor_contrato',
                'descricao_servico',
                'prazo_entrega',
                'forma_pagamento',
                'empresa',
                'representante_legal'
              ].map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => {
                    handleInsertVariable(variable)
                    setShowVariaveis(false)
                  }}
                  className={styles.variableButton}
                >
                  {variable}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowVariaveis(false)}
              className={styles.closeButton}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} className={styles.editor} />
    </div>
  )
}

export default TiptapEditor 