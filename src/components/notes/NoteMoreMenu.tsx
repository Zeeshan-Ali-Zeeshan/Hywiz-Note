import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  ExternalLink,
  Share2,
  Link as LinkIcon,
  FileText,
  Copy,
  CopyPlus,
  Tag,
  Save,
  Star,
  BookMarked,
  Home,
  ArrowLeftRight,
  Command,
  ChevronsRight,
  Search,
  Info,
  Printer,
  Trash2,
  Folder,
  ChevronRight,
  Download,
} from 'lucide-react';
import { copyToClipboard, generateShareLink } from '../../lib/utils';
import { useToastStore } from '../../stores/useToastStore';
import { useNotesStore } from '../../stores/useNotesStore';
import { useTemplatesStore } from '../../stores/useTemplatesStore';
import { useNotebooksStore } from '../../stores/useNotebooksStore';
import { useWorkspacesStore } from '../../stores/useWorkspacesStore';
import * as Y from 'yjs';

// Comprehensive Yjs debugging utility
const debugYjsDocument = (ydoc: Y.Doc, label: string) => {
  console.log(`\n=== YJS DEBUG: ${label} ===`);
  console.log('📋 Document state:', {
    clientID: ydoc.clientID,
    hasContent: ydoc.share.size > 0,
    sharedTypes: Array.from(ydoc.share.keys())
  });
  
  // Check all shared types
  for (const [name, sharedType] of ydoc.share) {
    if (sharedType instanceof Y.Text) {
      const text = sharedType.toString();
      console.log(`📝 Y.Text "${name}": "${text}" (length: ${text.length})`);
    } else if (sharedType instanceof Y.XmlFragment) {
      const content = sharedType.toJSON ? sharedType.toJSON() : 'no toJSON available';
      console.log(`🔖 Y.XmlFragment "${name}":`, content);
      if (Array.isArray(content)) {
        console.log(`   └─ Length: ${content.length}, Type: ${typeof content}`);
      }
    } else if (sharedType instanceof Y.Map) {
      console.log(`🗺️ Y.Map "${name}":`, sharedType.toJSON());
    } else if (sharedType instanceof Y.Array) {
      console.log(`📊 Y.Array "${name}":`, sharedType.toJSON());
    }
  }
  
  // Specific prosemirror check
  try {
    const prosemirrorXml = ydoc.getXmlFragment('prosemirror');
    const prosemirrorContent = prosemirrorXml.toJSON ? prosemirrorXml.toJSON() : [];
    console.log('🎯 Prosemirror specific check:', {
      exists: !!prosemirrorXml,
      hasToJSON: typeof prosemirrorXml.toJSON === 'function',
      content: prosemirrorContent,
      contentType: typeof prosemirrorContent,
      isArray: Array.isArray(prosemirrorContent),
      length: Array.isArray(prosemirrorContent) ? prosemirrorContent.length : 'N/A'
    });
  } catch (e) {
    console.log('🎯 Prosemirror check failed:', e);
  }
  
  // Generate and analyze update
  const update = Y.encodeStateAsUpdate(ydoc);
  console.log('📦 Update info:', {
    updateSize: update.length,
    base64Length: btoa(String.fromCharCode(...update)).length,
    hasRealContent: update.length > 50 // Empty docs are usually ~30-50 bytes
  });
  
  console.log(`=== END YJS DEBUG: ${label} ===\n`);
};


// Dynamic menu based on current note state
const getMenuItems = (currentNote: any) => [
  { icon: <ExternalLink size={16} />, label: 'Open in Lite editor' },
  { icon: <Share2 size={16} />, label: 'Share', action: 'share' },
  { icon: <LinkIcon size={16} color='white' />, label: 'Copy link' },
  'divider',
  { icon: <ArrowLeftRight size={16} />, label: 'Move', action: 'move' },
  { icon: <Copy size={16} />, label: 'Copy to' },
  { icon: <CopyPlus size={16} />, label: 'Duplicate' },
  'divider',
  { icon: <Tag size={16} />, label: 'Edit tags' },
  { icon: <Save size={16} />, label: 'Save as Template' },
  'divider',
  { icon: <Star size={16} />, label: currentNote?.isShortcut ? 'Remove from Shortcuts' : 'Add to Shortcuts' },
  { icon: <BookMarked size={16} />, label: 'Pin to Notebook' },
  { icon: <Home size={16} />, label: currentNote?.isPinned ? 'Unpin from Home' : 'Pin to Home' },
  'divider',
  { icon: <FileText size={16} />, label: 'Note width' },
  { icon: <Command size={16} />, label: 'Slash commands' },
  { icon: <ChevronsRight size={16} />, label: 'Toggle Preview Sections' },
  'divider',
  { icon: <Search size={16} />, label: 'Find in note' },
  { icon: <Info size={16} />, label: 'Note info' },
  'divider',
  { icon: <Printer size={16} />, label: 'Print' },
  { icon: <Trash2 size={16} />, label: 'Move to Trash' },
];

interface NoteMoreMenuProps {
  noteId: string;
  noteTitle?: string;
  setShareDropdownOpen: (open: boolean) => void;
  isTemplate?: boolean;
  editor?: any; // TipTap Editor instance
  content?: string; // Raw content for printing
  onToggleCollapse?: () => void; // Function to toggle preview sections collapse
  onOpenTagsDropdown?: () => void; // Function to open the tags dropdown in footer
}

export const NoteMoreMenu: React.FC<NoteMoreMenuProps> = ({ noteId, noteTitle, setShareDropdownOpen, isTemplate = false, editor, content, onToggleCollapse, onOpenTagsDropdown }) => {
  const [open, setOpen] = useState(false);
  const [showCopyToModal, setShowCopyToModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showNoteInfoModal, setShowNoteInfoModal] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [showNoteWidthModal, setShowNoteWidthModal] = useState(false);
  const [noteWidth, setNoteWidth] = useState('standard');
  const [findText, setFindText] = useState('');
  
  // Enhanced modal states
  const [showEnhancedMoveModal, setShowEnhancedMoveModal] = useState(false);
  const [showEnhancedCopyModal, setShowEnhancedCopyModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{type: 'notebook' | 'workspace', id: string, name: string} | null>(null);
  const [copySearch, setCopySearch] = useState('');
  const [moveSearch, setMoveSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareMenuItemRef = useRef<HTMLDivElement>(null);
  const showToast = useToastStore.getState().showToast;
  const duplicateNote = useNotesStore(state => state.duplicateNote);
  const copyNoteTo = useNotesStore(state => state.copyNoteTo);
  const toggleShortcut = useNotesStore(state => state.toggleShortcut);
  const deleteNote = useNotesStore(state => state.deleteNote);
  const updateNote = useNotesStore(state => state.updateNote);
  const createTemplate = useTemplatesStore(state => state.createTemplate);
  const duplicateTemplate = useTemplatesStore(state => state.duplicateTemplate);
  const createNoteFromTemplate = useTemplatesStore(state => state.createNoteFromTemplate);
  const currentNote = useNotesStore(state => state.notes.find(note => note._id === noteId));
  
  // Store hooks for notebooks and workspaces
  const { notebooks, fetchNotebooks } = useNotebooksStore();
  const { workspaces, fetchWorkspaces } = useWorkspacesStore();

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Fetch notebooks and workspaces when modals open
  useEffect(() => {
    if (showEnhancedMoveModal || showEnhancedCopyModal) {
      fetchNotebooks();
      fetchWorkspaces();
    }
  }, [showEnhancedMoveModal, showEnhancedCopyModal, fetchNotebooks, fetchWorkspaces]);

  const handleMenuClick = (item: any, index: number) => {
    if (index === 0) {
      // Open in Lite editor
      window.open(`/lite-editor/${noteId}`, '_blank');
    } else if (item.action === 'share') {
      setShareDropdownOpen(true);
    } else if (item.label === 'Copy link') {
      copyToClipboard(generateShareLink(noteId)).then(success => {
        if (success) {
          showToast('Link copied to clipboard!', 'success');
        } else {
          showToast('Failed to copy link', 'error');
        }
      });
    } else if (item.action === 'move') {
      setShowEnhancedMoveModal(true);
    } else if (item.label === 'Copy to') {
      setShowEnhancedCopyModal(true);
    } else if (item.label === 'Duplicate') {
      handleDuplicate();
    } else if (item.label === 'Edit tags') {
      if (onOpenTagsDropdown) {
        onOpenTagsDropdown();
      } else {
        setShowTagsModal(true);
      }
    } else if (item.label === 'Save as Template') {
      handleSaveAsTemplate();
    } else if (item.label === 'Add to Shortcuts') {
      handleAddToShortcuts();
    } else if (item.label === 'Pin to Notebook') {
      handlePinToNotebook();
    } else if (item.label === 'Pin to Home') {
      handlePinToHome();
    } else if (item.label === 'Note width') {
      setShowNoteWidthModal(true);
    } else if (item.label === 'Slash commands') {
      handleShowSlashCommands();
    } else if (item.label === 'Toggle Preview Sections') {
      handleToggleCollapsibleSections();
    } else if (item.label === 'Find in note') {
      setShowFindModal(true);
    } else if (item.label === 'Note info') {
      setShowNoteInfoModal(true);
    } else if (item.label === 'Print') {
      handlePrint();
    } else if (item.label === 'Move to Trash') {
      handleMoveToTrash();
    }
    setOpen(false);
  };

  const handleDuplicate = async () => {
    try {
      if (isTemplate) {
        const duplicatedTemplate = await duplicateTemplate(noteId);
        showToast('Template duplicated successfully!', 'success');
        
        // Navigate to the duplicated template if possible
        if (duplicatedTemplate && window.location.pathname.includes('/template/')) {
          setTimeout(() => {
            window.location.href = `/template/${duplicatedTemplate._id}`;
          }, 1000);
        }
      } else {
        const duplicatedNote = await duplicateNote(noteId);
      showToast('Note duplicated successfully!', 'success');
        
        // Navigate to the duplicated note if possible
        if (duplicatedNote && window.location.pathname.includes('/note/')) {
          setTimeout(() => {
            window.location.href = `/note/${duplicatedNote._id}`;
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to duplicate:', error);
      showToast(isTemplate ? 'Failed to duplicate template' : 'Failed to duplicate note', 'error');
    }
  };

  const handleMoveNote = async () => {
    if (!selectedDestination) {
      showToast('Please select a destination', 'error');
      return;
    }

    try {
      if (selectedDestination.type === 'notebook') {
        await updateNote(noteId, { 
          primaryNotebookId: selectedDestination.id,
          notebookIds: [selectedDestination.id]
        });
        showToast(`Note moved to ${selectedDestination.name}`, 'success');
      } else if (selectedDestination.type === 'workspace') {
        // Move note to workspace
        await updateNote(noteId, { 
          workspaceId: selectedDestination.id,
          primaryNotebookId: undefined // Remove from current notebook when moving to workspace
        });
        showToast(`Note moved to ${selectedDestination.name}`, 'success');
      }
      
      setShowEnhancedMoveModal(false);
      setSelectedDestination(null);
    } catch (error) {
      console.error('Failed to move note:', error);
      showToast('Failed to move note', 'error');
    }
  };

  const handleCopyNote = async () => {
    if (!selectedDestination) {
      showToast('Please select a destination', 'error');
      return;
    }

    try {
      if (isTemplate) {
        // For templates, create a note from the template in the selected destination
        if (selectedDestination.type === 'notebook') {
          const newNote = await createNoteFromTemplate(noteId, selectedDestination.id);
          showToast(`Note created from template in ${selectedDestination.name}`, 'success');
          
          // Navigate to the new note
          setTimeout(() => {
            window.location.href = `/note/${newNote._id}`;
          }, 1000);
        } else if (selectedDestination.type === 'workspace') {
          // Create note from template in workspace
          const newNote = await createNoteFromTemplate(noteId, selectedDestination.id);
          showToast(`Note created from template in ${selectedDestination.name}`, 'success');
          
          // Navigate to the new note
          setTimeout(() => {
            window.location.href = `/note/${newNote._id}`;
          }, 1000);
        }
      } else {
        await copyNoteTo(noteId, selectedDestination.type, selectedDestination.id);
        showToast(`Note copied to ${selectedDestination.name}`, 'success');
      }
      
      setShowEnhancedCopyModal(false);
      setSelectedDestination(null);
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast(isTemplate ? 'Failed to create note from template' : 'Failed to copy note', 'error');
    }
  };

  const handleAddToShortcuts = async () => {
    try {
      await toggleShortcut(noteId, true);
      showToast('Note added to shortcuts successfully!', 'success');
    } catch (error) {
      console.error('Failed to add note to shortcuts:', error);
      showToast('Failed to add note to shortcuts', 'error');
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      console.log('=== SAVE AS TEMPLATE DEBUG ===');
      console.log('Editor instance:', editor);
      console.log('Content prop:', content);
      console.log('CurrentNote:', currentNote);
      console.log('Note title prop:', noteTitle);
      
      // Get current content from editor if available, otherwise fall back to stored content
      let currentContent = '';
      
      if (editor && editor.getHTML) {
        currentContent = editor.getHTML();
        console.log('✅ Template content from editor:', currentContent);
        console.log('✅ Content length:', currentContent.length);
      } else if (content) {
        currentContent = content;
        console.log('⚠️ Template content from prop:', currentContent);
        console.log('⚠️ Content length:', currentContent.length);
      } else if (currentNote?.content) {
        currentContent = currentNote.content;
        console.log('⚠️ Template content from stored note:', currentContent);
        console.log('⚠️ Content length:', currentContent.length);
      } else {
        console.log('❌ No content source found');
        console.log('❌ Editor available:', !!editor);
        console.log('❌ Content prop available:', !!content);
        console.log('❌ Current note available:', !!currentNote);
      }
      
      if (!currentContent || currentContent.trim() === '' || currentContent.trim() === '<p></p>') {
        console.log('❌ Content validation failed:', {
          content: currentContent,
          trimmed: currentContent?.trim(),
          length: currentContent?.length
        });
        showToast('No content to save as template', 'info');
        return;
      }
      
      // Get current title
      const currentTitle = noteTitle || currentNote?.title || 'Untitled Template';
      console.log('✅ Template title:', currentTitle);
      console.log('Title sources:', {
        noteTitle,
        currentNoteTitle: currentNote?.title,
        fallback: 'Untitled Template'
      });
      
      // Get Yjs update directly from the editor if available (preserves all content)
      let yjsUpdate = null;
      
      // SYSTEMATIC ANALYSIS: Check editor state and content
      console.log('\n🔍 TEMPLATE SAVE ANALYSIS START');
      
      // 0️⃣ COMPREHENSIVE EDITOR INSPECTION
      console.log('0️⃣ Comprehensive Editor Inspection:');
      if (editor) {
        console.log('📍 Editor Object:', {
          editorType: editor.constructor.name,
          hasGetHTML: typeof editor.getHTML === 'function',
          hasGetJSON: typeof editor.getJSON === 'function',
          hasCommands: !!editor.commands,
          hasStorage: !!editor.storage,
          hasState: !!editor.state,
          hasView: !!editor.view
        });
        
        if (editor.getHTML) {
          const html = editor.getHTML();
          console.log('📄 Current HTML:', html);
          console.log('📏 HTML Length:', html.length);
          console.log('📝 Is Empty HTML:', html === '<p></p>' || html.trim() === '');
        }
        
        if (editor.getJSON) {
          const json = editor.getJSON();
          console.log('📋 Current JSON:', json);
          console.log('📊 JSON Content Length:', json?.content?.length || 0);
        }
        
        if (editor.storage) {
          console.log('💾 Storage Keys:', Object.keys(editor.storage));
          if (editor.storage.collaboration) {
            console.log('🤝 Collaboration Info:', {
              hasCollaboration: !!editor.storage.collaboration,
              hasYdoc: !!editor.storage.collaboration.ydoc,
              ydocType: editor.storage.collaboration.ydoc?.constructor?.name
            });
          }
        }
      } else {
        console.log('❌ NO EDITOR PROVIDED TO NoteMoreMenu');
      }
      
      console.log('1️⃣ Editor Analysis:', {
        hasEditor: !!editor,
        hasStorage: !!editor?.storage,
        hasCollaboration: !!editor?.storage?.collaboration,
        hasYdoc: !!editor?.storage?.collaboration?.ydoc,
        editorHTML: editor?.getHTML ? editor.getHTML() : 'No getHTML method',
        editorJSON: editor?.getJSON ? editor.getJSON() : 'No getJSON method'
      });
      
      if (editor && editor.storage?.collaboration?.ydoc) {
        const editorYdoc = editor.storage.collaboration.ydoc;
        console.log('2️⃣ Editor Yjs Document Analysis:');
        debugYjsDocument(editorYdoc, 'EDITOR ORIGINAL');
        
        // 🔧 CRITICAL FIX: Force editor to sync current content to Yjs
        // The TipTap editor might have pending changes that haven't been synced to Yjs yet
        try {
          const currentEditorHTML = editor.getHTML();
          console.log('📝 Current editor HTML:', currentEditorHTML);
          
          // Get the prosemirror XML fragment and check if it's in sync with editor
          const yXml = editorYdoc.getXmlFragment('prosemirror');
          const xmlContent = yXml.toJSON ? yXml.toJSON() : [];
          
          // If Yjs content is empty but editor has content, we need to sync manually
          if ((!xmlContent || (Array.isArray(xmlContent) && xmlContent.length === 0)) && 
              currentEditorHTML && currentEditorHTML !== '<p></p>' && currentEditorHTML.trim()) {
            
            console.log('🔄 SYNCING: Editor has content but Yjs is empty - forcing sync');
            
            // Force editor to trigger a Yjs update by making a small change and undoing it
            editor.commands.insertContent(' ');
            editor.commands.undo();
            
            // Wait a moment for the sync to happen
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('3️⃣ After Force Sync:');
            debugYjsDocument(editorYdoc, 'EDITOR AFTER SYNC');
          }
        } catch (syncError) {
          console.warn('⚠️ Force sync failed:', syncError);
        }
        
        // Clone the editor's Yjs document to avoid modifying the original
        const templateYdoc = new Y.Doc();
        
        // Apply the current state of the editor to our template doc
        const editorUpdate = Y.encodeStateAsUpdate(editorYdoc);
        Y.applyUpdate(templateYdoc, editorUpdate);
        
        console.log('4️⃣ Cloned Document Analysis:');
        debugYjsDocument(templateYdoc, 'TEMPLATE CLONE');
        
        // If still no content, create from editor HTML as fallback
        const templateXml = templateYdoc.getXmlFragment('prosemirror');
        const templateContent = templateXml.toJSON ? templateXml.toJSON() : [];
        
        if (!templateContent || (Array.isArray(templateContent) && templateContent.length === 0)) {
          console.log('🔄 FALLBACK: Creating content from editor HTML');
          
          try {
            // Create basic ProseMirror structure from HTML
            const editorHTML = editor.getHTML();
            if (editorHTML && editorHTML !== '<p></p>' && editorHTML.trim()) {
              // Parse HTML into basic ProseMirror JSON structure
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = editorHTML;
              
              const createPMNode = (element: Element): any => {
                const tagName = element.tagName.toLowerCase();
                
                if (tagName === 'p') {
                  return {
                    type: 'paragraph',
                    content: Array.from(element.childNodes).map(child => {
                      if (child.nodeType === Node.TEXT_NODE) {
                        return { type: 'text', text: child.textContent || '' };
                      }
                      return null;
                    }).filter(Boolean)
                  };
                } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
                  return {
                    type: 'heading',
                    attrs: { level: parseInt(tagName.charAt(1)) },
                    content: Array.from(element.childNodes).map(child => {
                      if (child.nodeType === Node.TEXT_NODE) {
                        return { type: 'text', text: child.textContent || '' };
                      }
                      return null;
                    }).filter(Boolean)
                  };
                }
                
                // Default: treat as paragraph
                return {
                  type: 'paragraph',
                  content: [{ type: 'text', text: element.textContent || '' }]
                };
              };
              
              const pmNodes = Array.from(tempDiv.children).map(createPMNode);
              if (pmNodes.length > 0) {
                templateXml.insert(0, pmNodes);
                console.log('✅ Created ProseMirror content from HTML');
              }
            }
          } catch (htmlError) {
            console.warn('⚠️ HTML to ProseMirror conversion failed:', htmlError);
          }
        }
        
        // Set the title in the template document
        const yTitle = templateYdoc.getText('title');
        yTitle.delete(0, yTitle.length);
        yTitle.insert(0, currentTitle);
        
        console.log('5️⃣ Final Template Document:');
        debugYjsDocument(templateYdoc, 'TEMPLATE FINAL');
        
        // Generate final yjsUpdate
        yjsUpdate = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(templateYdoc)));
        
        console.log('6️⃣ Final Template Data:', {
          yjsUpdateLength: yjsUpdate.length,
          yjsUpdatePreview: yjsUpdate.substring(0, 100) + '...',
          templateTitle: currentTitle
        });
        
      } else {
        console.log('❌ NO EDITOR COLLABORATION - Creating minimal template');
        const ydoc = new Y.Doc();
        const yTitle = ydoc.getText('title');
        yTitle.insert(0, currentTitle);
        
        // Try to add content from HTML if available
        if (currentContent && currentContent !== '<p></p>') {
          const plainText = currentContent.replace(/<[^>]*>/g, '').trim();
          if (plainText) {
            const yContent = ydoc.getText('content');
            yContent.insert(0, plainText);
          }
        }
        
        debugYjsDocument(ydoc, 'FALLBACK TEMPLATE');
        yjsUpdate = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc)));
      }
      
      console.log('🔍 TEMPLATE SAVE ANALYSIS END\n');
      
      const templateData = {
        yjsUpdate: yjsUpdate,
        tags: currentNote?.tags || [],
        isPublic: false
      };
      
      console.log('📤 Sending template data to API:', templateData);
      console.log('📤 Template data size:', JSON.stringify(templateData).length);
      
      const result = await createTemplate(templateData);
      console.log('✅ Template created successfully:', result);
      
      showToast('Note saved as template successfully!', 'success');
    } catch (error: any) {
      console.error('❌ Failed to save note as template:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      showToast('Failed to save note as template', 'error');
    }
  };

  const handlePinToNotebook = async () => {
    try {
      if (!currentNote) {
        showToast('No note selected', 'error');
        return;
      }

      // Show modal to select notebook
      setShowEnhancedMoveModal(true);
      showToast('Select a notebook to pin this note to', 'info');
    } catch (error) {
      console.error('Failed to pin to notebook:', error);
      showToast('Failed to pin to notebook', 'error');
    }
  };

  const handlePinToHome = async () => {
    try {
      if (!currentNote) {
        showToast('No note selected', 'error');
        return;
      }

      // Toggle pin to home status
      const newPinnedStatus = !currentNote.isPinned;
      await updateNote(noteId, { isPinned: newPinnedStatus });
      showToast(
        newPinnedStatus 
          ? 'Note pinned to home successfully!' 
          : 'Note unpinned from home', 
        'success'
      );
    } catch (error) {
      console.error('Failed to pin to home:', error);
      showToast('Failed to pin to home', 'error');
    }
  };

  const handleShowSlashCommands = () => {
    showToast('Press "/" in the editor to see available commands', 'info');
  };

  const handleToggleCollapsibleSections = () => {
    try {
      if (onToggleCollapse) {
        // Use the provided collapse handler
        onToggleCollapse();
        showToast('Preview sections toggled', 'success');
      } else {
        // Fallback: try to find the collapse button in the DOM
        const collapseButton = document.querySelector('[aria-label*="preview"], [aria-label*="Collapse"], [aria-label*="Expand"]');
        
        if (collapseButton && collapseButton instanceof HTMLElement) {
          collapseButton.click();
          showToast('Preview sections toggled', 'success');
        } else {
          // Fallback: try to find any collapse button in the editor header
          const editorHeader = document.querySelector('.flex.items-center.justify-between.px-3.py-2');
          const collapseBtn = editorHeader?.querySelector('button[aria-label*="preview"], button[aria-label*="Collapse"], button[aria-label*="Expand"]');
          
          if (collapseBtn && collapseBtn instanceof HTMLElement) {
            collapseBtn.click();
            showToast('Preview sections toggled', 'success');
          } else {
            showToast('Collapse functionality not found. Please use the collapse button in the top bar.', 'info');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle preview sections:', error);
      showToast('Failed to toggle preview sections', 'error');
    }
  };

  const handlePrint = () => {
    try {
      // Get title - use prop first, then try to find in DOM
      let itemTitle = noteTitle || '';
      
      if (!itemTitle) {
        // Try to find title in DOM as fallback
        let titleElement = document.querySelector('.text-3xl.font-medium.text-gray-900') as HTMLElement;
        if (!titleElement) {
          titleElement = document.querySelector('input[placeholder*="title"], input[placeholder*="Title"]') as HTMLElement;
        }
        if (!titleElement) {
          titleElement = document.querySelector('.text-3xl') as HTMLElement;
        }
        
        if (titleElement) {
          if (titleElement.tagName === 'INPUT') {
            itemTitle = (titleElement as HTMLInputElement).value;
          } else {
            itemTitle = titleElement.textContent || '';
          }
        }
      }
      
      if (!itemTitle) {
        itemTitle = isTemplate ? 'Untitled Template' : 'Untitled Note';
      }

      // Get content from editor or content prop
      let itemContent = '';
      
      if (editor && editor.getHTML) {
        // Get content from TipTap editor
        itemContent = editor.getHTML();
        console.log('Content from editor.getHTML():', itemContent);
      } else if (content) {
        // Use provided content prop
        itemContent = content;
        console.log('Content from prop:', itemContent);
      } else {
        // Fallback: try to get from DOM
        let editorElement = document.querySelector('.ProseMirror') as HTMLElement;
        if (!editorElement) {
          editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement;
        }
        if (editorElement) {
          itemContent = editorElement.innerHTML;
          console.log('Content from DOM fallback:', itemContent);
        }
      }
      
      // Clean up content
      if (!itemContent || itemContent.trim() === '' || itemContent.trim() === '<p></p>') {
        itemContent = '<p>No content to print.</p>';
      } else {
        // Remove any title elements from the content to avoid duplication
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = itemContent;
        
        // Remove any large headings that might be the title
        const largeTitles = tempDiv.querySelectorAll('h1, .text-3xl, .text-2xl');
        largeTitles.forEach(title => {
          if (title.textContent?.trim() === itemTitle.trim()) {
            title.remove();
          }
        });
        
        itemContent = tempDiv.innerHTML;
      }
      
      console.log('Final title:', itemTitle);
      console.log('Final content:', itemContent);
      console.log('Content length:', itemContent.length);

      // Ensure we have content to print
      if (!itemContent || itemContent.trim().length < 10) {
        showToast('No content to print', 'info');
        return;
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        showToast('Please allow popups to enable printing', 'error');
        return;
      }

      // Create the complete HTML document for printing
      const printHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Print - ${itemTitle}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #000;
              background: #fff;
              padding: 1in;
            }
            
            .print-title {
              font-size: 2rem;
              font-weight: 600;
              margin-bottom: 2rem;
              color: #000;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 1rem;
            }
            
            .print-content {
              font-size: 1rem;
              line-height: 1.8;
              color: #374151;
            }
            
            .print-content h1 {
              font-size: 1.5rem;
              font-weight: 600;
              margin: 1.5rem 0 1rem 0;
              color: #000;
            }
            
            .print-content h2 {
              font-size: 1.25rem;
              font-weight: 600;
              margin: 1.25rem 0 0.75rem 0;
              color: #000;
            }
            
            .print-content h3 {
              font-size: 1.125rem;
              font-weight: 600;
              margin: 1rem 0 0.5rem 0;
              color: #000;
            }
            
            .print-content p {
              margin-bottom: 1rem;
            }
            
            .print-content ul, .print-content ol {
              margin: 1rem 0;
              padding-left: 2rem;
              list-style-position: outside;
            }
            
            .print-content ul {
              list-style-type: disc;
            }
            
            .print-content ul ul {
              list-style-type: circle;
              margin: 0.5rem 0;
            }
            
            .print-content ul ul ul {
              list-style-type: square;
            }
            
            .print-content ol {
              list-style-type: decimal;
            }
            
            .print-content ol ol {
              list-style-type: lower-alpha;
              margin: 0.5rem 0;
            }
            
            .print-content ol ol ol {
              list-style-type: lower-roman;
            }
            
            .print-content li {
              margin-bottom: 0.5rem;
              display: list-item;
              list-style-position: outside;
            }
            
            .print-content li p {
              margin: 0;
              display: inline;
            }
            
            /* Task List styling */
            .print-content [data-type="taskList"] {
              list-style: none !important;
              padding-left: 0 !important;
            }
            
            .print-content [data-type="taskItem"] {
              display: block !important;
              list-style: none !important;
              margin-bottom: 0.5rem;
              padding-left: 0 !important;
              margin-left: 0 !important;
            }
            
            .print-content [data-type="taskItem"] input[type="checkbox"] {
              margin-right: 0.25rem;
              margin-top: 0;
              vertical-align: baseline;
              width: 0.875rem;
              height: 0.875rem;
              display: inline;
            }
            
            /* Alternative task list selectors */
            .print-content .task-list,
            .print-content ul.task-list {
              list-style: none !important;
              padding-left: 0 !important;
            }
            
            .print-content .task-list-item,
            .print-content .task-item,
            .print-content li.task-list-item,
            .print-content li.task-item {
              list-style: none !important;
              display: block !important;
              margin-bottom: 0.5rem;
              padding-left: 0 !important;
              margin-left: 0 !important;
            }
            
            .print-content .task-list-item input[type="checkbox"],
            .print-content .task-item input[type="checkbox"],
            .print-content li.task-list-item input[type="checkbox"],
            .print-content li.task-item input[type="checkbox"] {
              margin-right: 0.25rem;
              margin-top: 0;
              vertical-align: baseline;
              width: 0.875rem;
              height: 0.875rem;
              display: inline;
            }
            
            /* Regular list items (exclude task lists) */
            .print-content ul:not([data-type="taskList"]) > li:not([data-type="taskItem"]) {
              list-style: disc outside !important;
            }
            
            .print-content ol:not([data-type="taskList"]) > li:not([data-type="taskItem"]) {
              list-style: decimal outside !important;
            }
            
            .print-content blockquote {
              border-left: 4px solid #d1d5db;
              padding-left: 1rem;
              margin: 1rem 0;
              font-style: italic;
              color: #6b7280;
            }
            
            .print-content code {
              background-color: #f3f4f6;
              padding: 0.125rem 0.25rem;
              border-radius: 0.25rem;
              font-family: 'Courier New', monospace;
              font-size: 0.875rem;
            }
            
            .print-content pre {
              background-color: #f3f4f6;
              padding: 1rem;
              border-radius: 0.5rem;
              overflow-x: auto;
              margin: 1rem 0;
            }
            
            .print-content pre code {
              background: none;
              padding: 0;
            }
            
            .print-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 1rem 0;
            }
            
            .print-content th, .print-content td {
              border: 1px solid #d1d5db;
              padding: 0.5rem;
              text-align: left;
            }
            
            .print-content th {
              background-color: #f9fafb;
              font-weight: 600;
            }
            
            .print-content a {
              color: #2563eb;
              text-decoration: underline;
            }
            
            .print-content strong {
              font-weight: 600;
            }
            
            .print-content em {
              font-style: italic;
            }
            
            @media print {
              body {
                padding: 0;
              }
              
              .print-title {
                page-break-after: avoid;
              }
              
              .print-content h1, .print-content h2, .print-content h3 {
                page-break-after: avoid;
              }
              
              .print-content pre, .print-content blockquote {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-title">${itemTitle}</div>
          <div class="print-content">${itemContent}</div>
          <script>
            window.onload = function() {
              // Small delay to ensure content is rendered
              setTimeout(function() {
                window.print();
                // Close window after print dialog
                window.onafterprint = function() {
                  window.close();
                };
              }, 100);
            };
          </script>
        </body>
        </html>
      `;

      // Write the content to the new window
      printWindow.document.write(printHTML);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Failed to print:', error);
      showToast('Failed to print', 'error');
    }
  };

  const handleMoveToTrash = async () => {
    try {
      if (window.confirm(`Are you sure you want to move "${noteTitle || 'this note'}" to trash?`)) {
        await deleteNote(noteId);
        showToast('Note moved to trash', 'success');
        // Close the note editor if it's currently open
        window.history.back();
      }
    } catch (error) {
      console.error('Failed to move note to trash:', error);
      showToast('Failed to move note to trash', 'error');
    }
  };

  const handleFindInNote = (text: string) => {
    if (!text.trim()) return;
    
    // Use browser's built-in find functionality
    if ('find' in window && typeof (window as any).find === 'function') {
      (window as any).find(text, false, false, true, false, true, false);
    } else {
      // Fallback for browsers that don't support window.find
      showToast('Find functionality not supported in this browser', 'error');
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const getWordCount = (content: string) => {
    if (!content) return 0;
    // Strip HTML tags and count words
    const text = content.replace(/<[^>]*>/g, '');
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharCount = (content: string) => {
    if (!content) return 0;
    // Strip HTML tags and count characters
    const text = content.replace(/<[^>]*>/g, '');
    return text.length;
  };

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={btnRef}
          aria-label="More options"
          onClick={() => setOpen((v) => !v)}
          className="text-gray-900 dark:text-white black:text-white hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] transition-colors"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        {open && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              minWidth: 220,
              background: '#181818',
              color: '#fff',
              borderRadius: 8,
              boxShadow: '0 4px 32px 0 rgba(0,0,0,0.35)',
              padding: 0,
              zIndex: 1000,
              border: '1px solid #232323',
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {getMenuItems(currentNote).map((item, i) =>
              typeof item === 'string' ? (
                <div key={i} style={{ borderTop: '1px solid #232323', margin: '4px 0' }} />
              ) : (
                <div
                  key={item.label}
                  ref={item.action === 'share' ? shareMenuItemRef : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    position: 'relative',
                  }}
                  onClick={() => handleMenuClick(item, i)}
                >
                  {item.icon}
                  <span style={{ flex: 1 }}>{item.label}</span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Find in Note Modal */}
      {showFindModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Find in Note</h3>
            <input
              type="text"
              placeholder="Enter text to search..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && findText.trim()) {
                  handleFindInNote(findText);
                  setShowFindModal(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFindModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (findText.trim()) {
                    handleFindInNote(findText);
                    setShowFindModal(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={!findText.trim()}
              >
                Find
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Info Modal */}
      {showNoteInfoModal && currentNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Note Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Title:</span>
                <span className="ml-2 text-gray-900">{noteTitle || 'Untitled'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <span className="ml-2 text-gray-900">{formatDate(currentNote.createdAt)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Modified:</span>
                <span className="ml-2 text-gray-900">{formatDate(currentNote.updatedAt)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Word Count:</span>
                <span className="ml-2 text-gray-900">{getWordCount(currentNote.content || '')}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Character Count:</span>
                <span className="ml-2 text-gray-900">{getCharCount(currentNote.content || '')}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Note ID:</span>
                <span className="ml-2 text-gray-900 font-mono text-xs">{noteId}</span>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowNoteInfoModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Width Modal */}
      {showNoteWidthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Note Width</h3>
            <div className="space-y-3">
              {[
                { value: 'narrow', label: 'Narrow (600px)', description: 'Good for focused reading' },
                { value: 'standard', label: 'Standard (800px)', description: 'Default width' },
                { value: 'wide', label: 'Wide (1000px)', description: 'More space for content' },
                { value: 'full', label: 'Full Width', description: 'Use entire screen width' }
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="noteWidth"
                    value={option.value}
                    checked={noteWidth === option.value}
                    onChange={(e) => setNoteWidth(e.target.value)}
                    className="text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNoteWidthModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Apply note width setting by updating the note
                    await updateNote(noteId, { noteWidth: noteWidth as 'narrow' | 'standard' | 'wide' | 'full' });
                  showToast(`Note width set to ${noteWidth}`, 'success');
                  setShowNoteWidthModal(false);
                  } catch (error) {
                    showToast('Failed to update note width', 'error');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy To Modal */}
      {showCopyToModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Copy Note To</h3>
            <p className="text-gray-600 mb-4">Choose where to copy this note:</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  showToast('Feature coming soon!', 'info');
                  setShowCopyToModal(false);
                }}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-md flex items-center gap-3"
              >
                <Folder className="w-4 h-4" />
                <span>Copy to Notebook...</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
              <button
                onClick={() => {
                  showToast('Feature coming soon!', 'info');
                  setShowCopyToModal(false);
                }}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-md flex items-center gap-3"
              >
                <Download className="w-4 h-4" />
                <span>Export as...</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowCopyToModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      {showTagsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 black:bg-[#242424] rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white black:text-white">Edit Tags</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 black:text-gray-400 mb-3">
                Add or remove tags for this note:
              </p>
              <div className="space-y-2">
                {currentNote?.tags && Array.isArray(currentNote.tags) && currentNote.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentNote.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 black:bg-blue-900/30 text-blue-700 dark:text-blue-300 black:text-blue-300 rounded-full text-xs"
                      >
                        {typeof tag === 'string' ? tag : tag.name}
                        <button
                          onClick={async () => {
                            try {
                              const updatedTags = currentNote.tags.filter((_, i) => i !== index);
                              await updateNote(noteId, { tags: updatedTags as string[] });
                              showToast('Tag removed successfully', 'success');
                            } catch (error) {
                              showToast('Failed to remove tag', 'error');
                            }
                          }}
                          className="ml-1 text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400">No tags added yet</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTagsModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 black:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] rounded-md"
              >
                Close
              </button>
              <button
                onClick={() => {
                  showToast('Tag management will be enhanced in future updates', 'info');
                  setShowTagsModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Move Modal */}
      {showEnhancedMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Move {isTemplate ? 'Template' : 'Note'}</h3>
            <p className="text-gray-600 mb-4">Choose where to move "{noteTitle || (isTemplate ? 'this template' : 'this note')}":</p>
            
            {/* Search */}
            <input
              type="text"
              placeholder="Search notebooks and workspaces..."
              value={moveSearch}
              onChange={(e) => setMoveSearch(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Destination List */}
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Notebooks</h4>
              {notebooks
                .filter(notebook => 
                  !moveSearch || 
                  notebook.name.toLowerCase().includes(moveSearch.toLowerCase())
                )
                .map((notebook) => (
                  <button
                    key={notebook._id}
                    onClick={() => setSelectedDestination({
                      type: 'notebook',
                      id: notebook._id,
                      name: notebook.name
                    })}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedDestination?.id === notebook._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: notebook.color || '#6366f1' }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{notebook.name}</div>
                        <div className="text-sm text-gray-500">{notebook.noteCount} notes</div>
                      </div>
                    </div>
                  </button>
                ))}

              <h4 className="text-sm font-medium text-gray-700 mb-2 mt-4">Workspaces</h4>
              {workspaces
                .filter(workspace => 
                  !moveSearch || 
                  workspace.name.toLowerCase().includes(moveSearch.toLowerCase())
                )
                .map((workspace) => (
                  <button
                    key={workspace._id}
                    onClick={() => setSelectedDestination({
                      type: 'workspace',
                      id: workspace._id,
                      name: workspace.name
                    })}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedDestination?.id === workspace._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: workspace.color || '#10b981' }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{workspace.name}</div>
                        <div className="text-sm text-gray-500">{workspace.noteCount} notes</div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEnhancedMoveModal(false);
                  setSelectedDestination(null);
                  setMoveSearch('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveNote}
                disabled={!selectedDestination}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move {isTemplate ? 'Template' : 'Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Copy Modal */}
      {showEnhancedCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{isTemplate ? 'Create Note from Template' : 'Copy Note'}</h3>
            <p className="text-gray-600 mb-4">{isTemplate ? 'Choose where to create a note from' : 'Choose where to copy'} "{noteTitle || (isTemplate ? 'this template' : 'this note')}":</p>
            
            {/* Search */}
            <input
              type="text"
              placeholder="Search notebooks and workspaces..."
              value={copySearch}
              onChange={(e) => setCopySearch(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Destination List */}
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Notebooks</h4>
              {notebooks
                .filter(notebook => 
                  !copySearch || 
                  notebook.name.toLowerCase().includes(copySearch.toLowerCase())
                )
                .map((notebook) => (
                  <button
                    key={notebook._id}
                    onClick={() => setSelectedDestination({
                      type: 'notebook',
                      id: notebook._id,
                      name: notebook.name
                    })}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedDestination?.id === notebook._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: notebook.color || '#6366f1' }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{notebook.name}</div>
                        <div className="text-sm text-gray-500">{notebook.noteCount} notes</div>
                      </div>
                    </div>
                  </button>
                ))}

              <h4 className="text-sm font-medium text-gray-700 mb-2 mt-4">Workspaces</h4>
              {workspaces
                .filter(workspace => 
                  !copySearch || 
                  workspace.name.toLowerCase().includes(copySearch.toLowerCase())
                )
                .map((workspace) => (
                  <button
                    key={workspace._id}
                    onClick={() => setSelectedDestination({
                      type: 'workspace',
                      id: workspace._id,
                      name: workspace.name
                    })}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selectedDestination?.id === workspace._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: workspace.color || '#10b981' }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{workspace.name}</div>
                        <div className="text-sm text-gray-500">{workspace.noteCount} notes</div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEnhancedCopyModal(false);
                  setSelectedDestination(null);
                  setCopySearch('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyNote}
                disabled={!selectedDestination}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTemplate ? 'Create Note' : 'Copy Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NoteMoreMenu; 