import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import styles from './MinimalTitleEditor.module.css';

interface MinimalTitleEditorProps {
  ydoc: Y.Doc;
  provider?: WebsocketProvider;
  initialTitle?: string;
  readOnly?: boolean;
  onTitleChange?: (title: string) => void;
}

// Extension to enforce single-line only
const SingleLine = Paragraph.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => true, // Prevent newlines
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          style: {
            default: 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
          },
        },
      },
    ];
  },
});

export const MinimalTitleEditor: React.FC<MinimalTitleEditorProps> = ({ ydoc, provider, initialTitle, readOnly = false, onTitleChange }) => {
  // Use a unique Yjs fragment for the title to avoid conflicts
  const yTitleFragment = ydoc.getXmlFragment('titleXml');
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      SingleLine,
      Collaboration.configure({ document: ydoc, fragment: yTitleFragment }),
    ],
    content: initialTitle ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: initialTitle }] }] } : undefined,
    editable: !readOnly,
    autofocus: true,
    onUpdate: ({ editor }) => {
      if (onTitleChange) {
        onTitleChange(editor.getText());
      }
    },
  }, [ydoc, provider, readOnly]);

  // Prevent multi-line pasting
  useEffect(() => {
    if (!editor) return;
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain') || '';
      if (text.includes('\n')) {
        event.preventDefault();
        editor.commands.setContent(text.replace(/\n/g, ' '));
      }
    };
    editor.view.dom.addEventListener('paste', handlePaste);
    return () => {
      editor.view.dom.removeEventListener('paste', handlePaste);
    };
  }, [editor]);

  // Ref for EditorContent DOM node
  const editorContentRef = useRef<HTMLDivElement>(null);

  // Click handler to focus editor
  const handleContainerClick = () => {
    if (editor && !editor.isFocused) {
      editor.commands.focus('end'); // Place cursor at end
    }
  };

  return (
    <div
      className={styles.minimalTitleEditor}
      onClick={handleContainerClick}
      tabIndex={0}
      style={{ 
        cursor: readOnly ? 'default' : 'text',
        minHeight: '1.5rem',
        width: '100%',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <EditorContent editor={editor} ref={editorContentRef} />
      {!editor?.getText() && (
        <span 
          style={{ 
            color: '#9CA3AF', 
            pointerEvents: 'none',
            position: 'absolute',
            left: '0px'
          }}
        >
          Template Title
        </span>
      )}
    </div>
  );
}; 