import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Share, Pin, Book, Maximize2, FileText, Link, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import { RichTextEditor } from '../editor/RichTextEditor';
import { Note } from '../../stores/useNotesStore';
// import NoteHistoryModal from './NoteHistoryModal'; // Uncomment if file exists
import { useTagsStore } from '../../stores/useTagsStore';
import { useNotebooksStore } from '../../stores/useNotebooksStore';
import { useUIStore } from '../../stores/useUIStore';
import './note-editor-print.css';
import '../editor/editor-overrides.css';
import { EditorToolbar } from '../editor/EditorToolbar';
import { NoteMoreMenu } from './NoteMoreMenu';
import { useParams } from 'react-router-dom';
import { ShareButton } from './ShareButton';
import { copyToClipboard, generateShareLink, showToast } from '../../lib/utils';
import { useTemplatesStore } from '../../stores/useTemplatesStore';
import { Template } from '../../stores/useTemplatesStore';
import socket from '../../lib/socket';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import debounce from 'lodash.debounce';
import { extractTitleFromYjs } from '../../lib/yjsUtils';
import { MinimalTitleEditor } from './MinimalTitleEditor';
import { useTasksStore } from '../../stores/useTasksStore';
import { TagSelect } from '../common/TagSelect';
import { LinkModal } from '../editor/LinkModal';

interface NoteEditorProps {
  noteId: string;
  onClose: () => void;
  type?: 'note' | 'template';
  readOnly?: boolean;
  notesListCollapsed?: boolean;
  setNotesListCollapsed?: (collapsed: boolean) => void;
  shared?: boolean;
}

let noteEditorDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

export const NoteEditor: React.FC<NoteEditorProps> = ({ noteId: propNoteId, onClose, type = 'note', readOnly = false, notesListCollapsed, setNotesListCollapsed, shared }) => {
  const notesStore = useNotesStore();
  const { syncTasksFromNote } = useTasksStore(); // Get sync function
  const templatesStore = useTemplatesStore();
  const { tags, fetchTags, createTag } = useTagsStore();
  const { notebooks, fetchNotebooks } = useNotebooksStore();
  const { openImportExportModal, fontSize, layoutStyle } = useUIStore();
  const [item, setItem] = useState<Note | Template | null>(null);
  const [titleValue, setTitleValue] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('');

  const [collabEmail, setColabEmail] = useState('');
  const [collabPermission, setColabPermission] = useState('read');
  const [sharingError, setSharingError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const shareModalRef = useRef<HTMLDivElement>(null);
  const [backlinks, setBacklinks] = useState<{ _id: string; title: string }[]>([]);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");
  const [selectedMoveNotebook, setSelectedMoveNotebook] = useState(type === 'note' && item && 'primaryNotebookId' in item && typeof item.primaryNotebookId === 'object' && item.primaryNotebookId && '_id' in item.primaryNotebookId ? item.primaryNotebookId._id : '');
  const [editorInstance, setEditorInstance] = useState<any>(null);
  // Link modal state for inserting/editing links from toolbar
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const params = useParams();
  const noteId = propNoteId || params.noteId;
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const initialTitleSetRef = useRef(false);
  const [yjsReady, setYjsReady] = useState(false);
  // Add a ref to track if we're initializing the Yjs title from the DB
  const initializingTitleRef = useRef(true);
  // Add a ref to track the last initialized noteId
  const lastInitializedNoteIdRef = useRef<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const tagsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!noteId) return;
    socket.emit('join-note', noteId);
  }, [noteId]);

  // Use local state only if not controlled by props
  const isCollapsed = typeof notesListCollapsed === 'boolean' ? notesListCollapsed : previewCollapsed;
  const handleCollapseToggle = () => {
    if (typeof setNotesListCollapsed === 'function') {
      setNotesListCollapsed(!isCollapsed);
    } else {
      setPreviewCollapsed(v => !v);
    }
  };

  // Use correct store based on type
  const fetchItem = type === 'note' ? notesStore.fetchNote : templatesStore.fetchTemplate;
  const autoSaveItem = type === 'note' ? notesStore.autoSaveNote : templatesStore.updateTemplate;
  const pinItem = type === 'note' ? notesStore.pinNote : templatesStore.pinTemplate;
  const updateItem = type === 'note' ? notesStore.updateNote : templatesStore.updateTemplate;

  const shareItem = type === 'note' ? notesStore.shareNote : templatesStore.shareTemplate;
  const addCollaborator = type === 'note' ? notesStore.shareNote : templatesStore.addCollaborator;
  const updateCollaborator = type === 'note' ? notesStore.updateCollaborator : templatesStore.updateCollaboratorPermission;
  const removeCollaborator = type === 'note' ? notesStore.removeCollaborator : templatesStore.removeCollaborator;
  const uploadAttachment = type === 'note' ? notesStore.uploadAttachment : undefined;
  const removeAttachment = type === 'note' ? notesStore.removeAttachment : undefined;
  const fetchBacklinks = type === 'note' ? notesStore.fetchBacklinks : async () => [];
  const duplicateItem = type === 'note' ? notesStore.duplicateNote : templatesStore.duplicateTemplate;

  const noteFromStore = type === 'note' ? useNotesStore(state => state.notes.find(n => n._id === noteId)) : null;

  // Computed title that prefers Yjs value when available on item
  const computedTitle = (() => {
    if (titleValue && titleValue.trim()) return titleValue;
    const y = item && 'yjsUpdate' in item ? (item as any).yjsUpdate : undefined;
    if (y) {
      try {
        const t = extractTitleFromYjs(y);
        if (t && t.trim()) return t;
      } catch { }
    }
    return titleValue || 'Untitled';
  })();

  // Load item data
  useEffect(() => {
    if (!noteId) {
      return;
    }
    const loadItem = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchItem(noteId || '');
        setItem(data);
        if (!initialTitleSetRef.current) {
          setTitleValue(data.title || '');
          initialTitleSetRef.current = true;
        }

      } catch (error) {
        setError('Failed to load item. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadItem();
  }, [noteId, fetchItem]);

  // Ensure the header title (and Share button title) reflects Yjs title even before provider sync
  useEffect(() => {
    if (!item) return;
    // Prefer Yjs-derived title when available
    if ('yjsUpdate' in item && item.yjsUpdate) {
      try {
        const yTitle = extractTitleFromYjs((item as any).yjsUpdate);
        if (!initialTitleSetRef.current && yTitle && yTitle.trim() && yTitle !== titleValue) {
          setTitleValue(yTitle);
          initialTitleSetRef.current = true;
        }
      } catch { }
    }
  }, [item]);

  // Sync local state with store note ONLY on initial load or noteId change
  useEffect(() => {
    if (type === 'note') {
      console.log('NoteEditor: Checking noteFromStore', { noteFromStore, noteId, item });

      if (!noteFromStore) {
        console.log('NoteEditor: Note not found in store, will auto-close');
        // Note was deleted or not found
        setItem(null);
        setTitleValue('');
        setContent('');
        setError('Note not found or was deleted.');
        setTimeout(() => onClose(), 1500); // Auto-close after 1.5s
        return;
      }
      // Only update if noteId changes or item is null
      if (!item || noteFromStore._id !== item._id) {
        console.log('NoteEditor: Updating from store note', noteFromStore);
        setItem(noteFromStore);
        if (!initialTitleSetRef.current) {
          setTitleValue(noteFromStore.title || '');
          initialTitleSetRef.current = true;
        }

        setError(null);
      }
    }
  }, [noteFromStore, type, onClose]);

  // Title is now managed by Yjs observer, no need to set from item.title

  useEffect(() => {
    fetchTags();
    fetchNotebooks();
  }, [fetchTags, fetchNotebooks]);

  useEffect(() => {
    setSelectedTags(
      type === 'note' && item
        ? item.tags
          .map(t =>
            typeof t === 'string'
              ? t
              : (t && typeof t === 'object' && '_id' in t
                ? (t as any)._id
                : undefined)
          )
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
    );
    setSelectedNotebook(
      type === 'note' && item && 'primaryNotebookId' in item && typeof item.primaryNotebookId === 'string'
        ? item.primaryNotebookId
        : (type === 'note' && item && 'primaryNotebookId' in item && item.primaryNotebookId && typeof item.primaryNotebookId === 'object' && '_id' in item.primaryNotebookId ? item.primaryNotebookId._id : '')
    );
  }, [item]);



  // Load backlinks
  useEffect(() => {
    if (noteId) {
      fetchBacklinks(noteId).then(setBacklinks).catch(() => setBacklinks([]));
    }
  }, [noteId, fetchBacklinks]);

  // Collaborative title logic (remove socket.io for title updates)
  // If you want to sync title in real-time, use Yjs awareness or a shared Yjs field instead

  // Add Save button logic
  // const handleSave = () => {
  //   const plainTextContent = content.replace(/<[^>]*>/g, '').trim();
  //   autoSaveItem(noteId || '', title, content, plainTextContent);
  //   // Removed socket.emit for note-title-update and note-update
  // };

  // Handle content changes
  const handleTagsChange = async (selected: any[] | string[]) => {
    // Accept either array of string ids or array of option objects with value
    let values: string[] = [];
    if (Array.isArray(selected)) {
      if (selected.length > 0 && typeof selected[0] === 'string') {
        values = selected as string[];
      } else {
        values = (selected as any[]).map((opt: any) => opt?.value).filter(Boolean);
      }
    }
    setSelectedTags(values);
    if (noteId) {
      try {
        await updateItem(noteId || '', { tags: values });
        setItem(prev => {
          if (!prev) return null;
          if (Array.isArray(prev.tags) && prev.tags.length > 0 && typeof prev.tags[0] === 'string') {
            // tags are string[]
            return { ...prev, tags: values };
          } else {
            // tags are object[]
            return {
              ...prev,
              tags: tags.filter(t => values.includes(typeof t === 'string' ? t : (t && typeof t === 'object' && '_id' in t ? t._id : ''))),
            };
          }
        });
      } catch (err) {
      }
    }
  };

  const handleCreateTag = async (inputValue: string) => {
    try {
      const newTag = await createTag({ name: inputValue });
      setSelectedTags(prev => [...prev, newTag._id]);
      if (noteId) {
        await updateItem(noteId || '', { tags: [...selectedTags, newTag._id] });
        setItem(prev => {
          if (!prev) return null;
          if (Array.isArray(prev.tags) && prev.tags.length > 0 && typeof prev.tags[0] === 'string') {
            // tags are string[]
            return { ...prev, tags: [...selectedTags, newTag._id] };
          } else {
            // tags are object[]
            return {
              ...prev,
              tags: tags.filter(t => [...selectedTags, newTag._id].includes(typeof t === 'string' ? t : (t && typeof t === 'object' && '_id' in t ? t._id : ''))),
            };
          }
        });
      }
    } catch (err) {
    }
  };

  const handleNotebookChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedNotebook(value);
    if (noteId) {
      try {
        await updateItem(noteId || '', { primaryNotebookId: value });
        setItem(prev => {
          if (!prev) return null;
          const found = notebooks.find(nb => nb._id === value);
          return found ? { ...prev, primaryNotebookId: found } : prev;
        });
      } catch (err) {
      }
    }
  };



  const handleAddCollaborator = async () => {
    setSharingError('');
    try {
      // For demo: use email as userId (in real app, lookup userId by email)
      if (noteId && addCollaborator) {
        await addCollaborator?.(noteId || '', collabEmail, collabPermission);
      }
      setColabEmail('');
      setColabPermission('read');
      // Optionally reload item
      if (noteId) fetchItem(noteId || '');
    } catch (err) {
      setSharingError('Failed to add collaborator');
    }
  };

  const handleUpdatePermission = async (userId: string, permission: string) => {
    try {
      if (noteId && updateCollaborator) {
        await updateCollaborator?.(noteId || '', userId, permission);
      }
      if (noteId) fetchItem(noteId || '');
    } catch (err) {
      setSharingError('Failed to update permission');
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      if (noteId && removeCollaborator) {
        await removeCollaborator?.(noteId || '', userId);
      }
      if (noteId) fetchItem(noteId || '');
    } catch (err) {
      setSharingError('Failed to remove collaborator');
    }
  };

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !item) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (item && item._id && uploadAttachment) {
        await uploadAttachment?.(item._id || '', e.target.files[0]);
      }
      // Refetch item to update attachments
      if (noteId) fetchItem(noteId || '');
    } catch (err) {
      setUploadError('Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Handle remove attachment
  const handleRemoveAttachment = async (filename: string) => {
    if (!item) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (item && item._id && removeAttachment) {
        await removeAttachment?.(item._id || '', filename);
      }
      if (noteId) fetchItem(noteId || '');
    } catch (err) {
      setUploadError('Failed to remove attachment');
    } finally {
      setUploading(false);
    }
  };

  // Close modal on outside click
  useEffect(() => {
    if (!shareModalOpen) return;
    function handleClick(e: MouseEvent) {
      if (shareModalRef.current && !shareModalRef.current.contains(e.target as Node)) {
        setShareModalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareModalOpen]);

  useEffect(() => {
    if (!editorInstance) return;
    const handleFocus = () => setEditorFocused(true);
    const handleBlur = () => setEditorFocused(false);
    const handleSelectionUpdate = () => {
      if (!editorInstance) return;
      const { from, to } = editorInstance.state.selection;
      // Show toolbar if focused or if there is a selection
      setShowToolbar(editorInstance.isFocused || from !== to);
    };
    editorInstance.on('focus', handleFocus);
    editorInstance.on('blur', handleBlur);
    editorInstance.on('selectionUpdate', handleSelectionUpdate);
    // Initial check
    handleSelectionUpdate();
    return () => {
      editorInstance.off('focus', handleFocus);
      editorInstance.off('blur', handleBlur);
      editorInstance.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editorInstance]);

  // Hide toolbar if not focused, no selection, and no popover open
  useEffect(() => {
    if (!editorInstance) return;
    if (!editorFocused && editorInstance.state.selection.from === editorInstance.state.selection.to) {
      setShowToolbar(false);
    }
  }, [editorFocused, editorInstance]);

  useEffect(() => {
    if (!shareDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        shareButtonRef.current &&
        !shareButtonRef.current.contains(e.target as Node) &&
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(e.target as Node)
      ) {
        setShareDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareDropdownOpen]);

  useEffect(() => {
    if (shareDropdownOpen) {
      // Refetch the item and update state when the share dropdown is opened
      if (noteId) {
        fetchItem(noteId || '');
      }
    }
  }, [shareDropdownOpen, noteId, fetchItem]);

  // Helper: is content empty?
  const isContentEmpty = editorInstance ? editorInstance.getHTML().replace(/<[^>]*>/g, '').trim() === '' : true;

  // Type guards
  function isNote(obj: any): obj is Note {
    return obj && typeof obj === 'object' && 'primaryNotebookId' in obj;
  }
  function isTemplate(obj: any): obj is Template {
    return obj && typeof obj === 'object' && !('primaryNotebookId' in obj);
  }

  const userTemplates = templatesStore.templates.filter(t => !t.isDeleted && t.userId); // adjust as needed for user
  const filteredTemplates = userTemplates.filter(t =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase())
  );
  const selectedTemplate = userTemplates.find(t => t._id === selectedTemplateId);

  useEffect(() => {
    if (showTemplateModal) {
      templatesStore.fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTemplateModal]);

  // --- Yjs Collaboration Setup ---
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [yTitle, setYTitle] = useState<Y.Text | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false); // NEW: for transition state

  // Persist title for templates; for notes rely on Yjs save to avoid per-keystroke socket spam
  const debouncedPersistTitle = useMemo(
    () =>
      debounce(async (newTitle: string) => {
        if (!noteId || type === 'note') return;
        try {
          await updateItem(noteId || '', { title: newTitle });
        } catch (err) {
          console.error('Failed to persist title', err);
        }
      }, 800),
    [noteId, updateItem, type]
  );

  useEffect(() => {
    return () => {
      debouncedPersistTitle.cancel();
    };
  }, [debouncedPersistTitle]);

  const applyLocalTitle = (newTitle: string) => {
    if (!noteId) return;
    const cleanTitle = newTitle.trimStart();
    if (titleValue === cleanTitle) return;
    setTitleValue(cleanTitle);
    setItem(prev => (prev ? { ...prev, title: cleanTitle } : prev));
    useNotesStore.setState(state => ({
      notes: state.notes.map(n => (n._id === noteId ? { ...n, title: cleanTitle } : n)),
      currentNote:
        state.currentNote?._id === noteId
          ? { ...state.currentNote, title: cleanTitle }
          : state.currentNote,
    }));
    try {
      const yTitle = ydoc?.getText('title');
      if (yTitle) {
        yTitle.delete(0, yTitle.length);
        yTitle.insert(0, cleanTitle);
      }
    } catch (error) {
      console.warn('Failed to sync Yjs title locally', error);
    }
    // Only persist immediately for non-note types; notes will sync when Yjs save runs
    if (type !== 'note') {
      debouncedPersistTitle(cleanTitle);
    }
  };

  // Add a unique sessionId for each note open
  const sessionIdRef = useRef(0);
  useEffect(() => {
    sessionIdRef.current += 1;
  }, [noteId]);

  // Add a ref to track the latest active noteId
  const activeNoteIdRef = useRef(noteId);
  useEffect(() => {
    activeNoteIdRef.current = noteId;
  }, [noteId]);

  // --- Create Yjs doc/provider once per noteId ---
  useEffect(() => {
    if (!noteId) return;
    const ydocInstance = new Y.Doc();
    const providerInstance = new WebsocketProvider('ws://localhost:3001', `note-${noteId}`, ydocInstance);
    setYdoc(ydocInstance);
    setProvider(providerInstance);
    return () => {
      providerInstance.destroy();
      ydocInstance.destroy();
      setYdoc(null);
      setProvider(null);
    };
  }, [noteId]);

  // Apply canonical Yjs update from backend into existing ydoc (no re-create)
  useEffect(() => {
    if (!ydoc || !item) return;
    if ('yjsUpdate' in item && typeof item.yjsUpdate === 'string' && item.yjsUpdate) {
      try {
        const update = Uint8Array.from(atob(item.yjsUpdate || ''), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc, update);
        console.log('[YJS DEBUG] Applied canonical Yjs update for note:', noteId || '');
      } catch (e) {
        console.error('[YJS ERROR] Failed to apply canonical Yjs update:', e);
      }
    } else if ('fallbackContent' in item && typeof item.fallbackContent === 'string' && item.fallbackContent) {
      console.warn('[YJS WARNING] No Yjs update found, fallbackContent present. Editor should convert HTML to ProseMirror JSON and insert into Yjs doc.');
    }
  }, [ydoc, item, noteId]);

  // --- Attach Yjs observers for content when editorInstance, ydoc, and provider are ready ---
  useEffect(() => {
    if (!noteId || !editorInstance || !ydoc || !provider || isTransitioning) return;
    const currentSessionId = sessionIdRef.current;

    // --- Content observer ---
    const yXml = ydoc.getXmlFragment('prosemirror');
    const updateContent = () => {
      if (sessionIdRef.current !== currentSessionId) return;
      if (!yjsReady) return;
      if (noteId !== activeNoteIdRef.current) return;
      if (editorInstance && typeof editorInstance.getHTML === 'function') {
        // Debounce content saves (2s after last keystroke)
        if (noteEditorDebounceTimeout) {
          clearTimeout(noteEditorDebounceTimeout);
        }
        // Content is now managed by Yjs only, no backend sync needed
      }
    };
    yXml.observeDeep(updateContent);

    // Set Yjs ready after initial content/title is set
    setTimeout(() => setYjsReady(true), 200);

    return () => {
      yXml.unobserveDeep(updateContent);
    };
  }, [noteId, editorInstance, ydoc, provider, isTransitioning]);

  // 2. Only show spinner if loading, item is null, or isTransitioning
  if (loading || !item || isTransitioning) {
    return (
      <div
        className={
          (isFullScreen
            ? "fixed inset-0 z-50 bg-white dark:bg-gray-900 black:bg-[#242424] flex flex-col"
            : "flex-1 flex flex-col bg-white dark:bg-gray-900 black:bg-[#242424] h-full") +
          " transition-opacity duration-300 opacity-100 animate-fade-in"
        }
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-800 black:bg-[#242424] shadow-sm">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 black:text-gray-400">Loading…</div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-gray-700 dark:text-gray-300 black:text-gray-300 text-sm">Loading editor…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black-100">
        <div className="text-center">
          <h3 className="text-lg font-medium text-white-900 mb-2">Error</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Item not found</h3>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Only render editor if content is loaded and ydoc/provider are ready
  if (typeof content !== 'string' || !ydoc || !provider) {
    return null;
  }

  // Pass yjsUpdate to RichTextEditor
  return (
    <div className={
      (isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900 black:bg-[#242424] flex flex-col" : "flex-1 flex flex-col bg-white dark:bg-gray-900 black:bg-[#242424] h-full") +
      (isCollapsed ? " w-full" : "") +
      " transition-opacity duration-300 opacity-100 animate-fade-in"
    }>
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-800 black:bg-[#242424] shadow-sm overflow-x-visible">
        {/* Left: Navigation, Controls, and Title */}
        <div className="flex items-center gap-1.5 flex-1">
          {/* Collapse/Expand Preview Button */}
          {!shared && (
            <button
              onClick={handleCollapseToggle}
              className="p-1 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 black:bg-[#2f2f2f] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#2a2a2a] transition-all duration-200 border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a]"
              aria-label={isCollapsed ? 'Show preview' : 'Hide preview'}
            >
              {isCollapsed ? <ChevronRight size={14} className="text-gray-500" /> : <ChevronLeft size={14} className="text-gray-500" />}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullScreen(f => !f)}
            className="p-1 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 black:bg-[#2f2f2f] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#2a2a2a] transition-all duration-200 border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] text-gray-600 dark:text-gray-300 black:text-gray-300"
            aria-label="Expand item"
            disabled={readOnly}
          >
            <Maximize2 size={14} />
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 black:bg-[#3a3a3a] mx-1"></div>

          {/* Notebook Info */}
          {type === 'note' && !readOnly && (
            <button
              onClick={() => setMoveModalOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors cursor-pointer"
              title="Manage notebooks"
            >
              <Book size={12} className="text-gray-500" />
              <span className="text-gray-900 text-xs font-medium">
                {(() => {
                  if (item && 'notebookIds' in item && item.notebookIds && item.notebookIds.length > 0) {
                    const notebookNames = item.notebookIds.map(notebookId => {
                      if (typeof notebookId === 'object' && 'name' in notebookId) {
                        return notebookId.name;
                      } else if (typeof notebookId === 'string') {
                        const notebook = notebooks.find(nb => nb._id === notebookId);
                        return notebook ? notebook.name : 'Unknown';
                      }
                      return 'Unknown';
                    }).filter(name => name !== 'Unknown');

                    if (notebookNames.length === 0) {
                      return 'No Notebooks';
                    } else if (notebookNames.length === 1) {
                      return notebookNames[0];
                    } else {
                      return `${notebookNames[0]} +${notebookNames.length - 1}`;
                    }
                  }
                  return 'No Notebooks';
                })()}
              </span>
            </button>
          )}
          {type === 'note' && readOnly && item && 'notebookIds' in item && item.notebookIds && item.notebookIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300">
              <Book size={16} className="text-gray-500" />
              <span className="text-gray-900 text-sm font-medium">
                {(() => {
                  const notebookNames = item.notebookIds.map(notebookId => {
                    if (typeof notebookId === 'object' && 'name' in notebookId) {
                      return notebookId.name;
                    } else if (typeof notebookId === 'string') {
                      const notebook = notebooks.find(nb => nb._id === notebookId);
                      return notebook ? notebook.name : 'Unknown';
                    }
                    return 'Unknown';
                  }).filter(name => name !== 'Unknown');

                  if (notebookNames.length === 0) {
                    return 'No Notebooks';
                  } else if (notebookNames.length === 1) {
                    return notebookNames[0];
                  } else {
                    return `${notebookNames[0]} +${notebookNames.length - 1}`;
                  }
                })()}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-[#333] mx-2"></div>

          {/* Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText size={18} className="text-gray-500 flex-shrink-0" />
            <button
              className="text-left truncate bg-transparent border-none outline-none focus:outline-none text-gray-900 text-lg font-semibold flex-1 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
              style={{ cursor: 'pointer' }}
              title="Click to move note to different notebook"
              onClick={() => setMoveModalOpen(true)}
            >
              {computedTitle}
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        {!readOnly && (
          <div className="flex items-center gap-3">
            {/* Share Button Group */}
            <div className="flex items-center">
              <ShareButton
                noteId={noteId || ''}
                noteTitle={computedTitle}
                className="rounded-l-lg rounded-r-none bg-[#818cf8] hover:bg-[#6366f1] text-black px-4 h-9 border border-[#818cf8] border-r-0 focus:outline-none transition-all duration-200 text-sm font-medium flex items-center gap-2"
                open={shareDropdownOpen}
                setOpen={setShareDropdownOpen}
                ref={shareButtonRef}
                dropdownRef={shareDropdownRef}
                onShareChange={() => {
                  if (noteId) {
                    fetchItem(noteId || '');
                  }
                }}
              />
              <button
                className="rounded-r-lg rounded-l-none bg-[#818cf8] hover:bg-[#6366f1] text-black px-3 h-8 border border-[#818cf8] border-l border-l-white/20 focus:outline-none transition-all duration-200 flex items-center justify-center"
                title="Copy note link"
                onClick={async () => {
                  const link = generateShareLink(noteId || '');
                  const success = await copyToClipboard(link);
                  showToast(success ? 'Link copied!' : 'Failed to copy link', success ? 'success' : 'error');
                }}
              >
                <Link className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* More Menu */}
            <NoteMoreMenu
              noteId={noteId || ''}
              noteTitle={computedTitle}
              setShareDropdownOpen={setShareDropdownOpen}
              editor={editorInstance}
              content={content}
              onToggleCollapse={handleCollapseToggle}
              onOpenTagsDropdown={() => setIsTagsDropdownOpen(true)}
            />
          </div>
        )}
      </div>
      {/* Fixed toolbar */}
      {!readOnly && (
        <div className="bg-white border-b border-gray-200 min-w-0 w-full overflow-x-visible">
          <EditorToolbar editor={editorInstance} noteId={noteId} onOpenLinkModal={() => setLinkModalOpen(true)} />
        </div>
      )}
      {/* Fixed title */}
      {!readOnly && (
        <div className="bg-white px-4 text-2xl font-semibold h-12 border-b border-gray-200 flex items-center">
          <div className="w-full">
            <MinimalTitleEditor
              ydoc={ydoc as any}
              provider={provider as any}
              initialTitle={titleValue || ''}
              readOnly={readOnly}
              onTitleChange={(newTitle) => {
                setTitleValue(newTitle);
                applyLocalTitle(newTitle);
              }}
            />
          </div>
        </div>
      )}
      {readOnly && (
        <div className="bg-white border-b border-gray-200">
          <input
            type="text"
            value={titleValue}
            readOnly
            disabled
            placeholder="Title"
            className="overflow-hidden w-full text-3xl font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:outline-none focus:border-none focus:ring-0 focus:ring-transparent cursor-default px-6 py-4"
            style={{ letterSpacing: '-0.02em' }}
          />
        </div>
      )}
      {/* Scrollable text editor area only */}
      <div className={`flex-1 overflow-y-auto min-w-0 w-full scrollbar-hide editor-font-${fontSize} editor-layout-${layoutStyle}`}>
        <RichTextEditor
          noteId={noteId || ''}
          readOnly={readOnly}
          hideToolbar={true}
          onEditorReady={setEditorInstance}
          initialContent={content}
          ydoc={ydoc}
          provider={provider}
          yjsUpdate={item && (item as any).yjsUpdate}
          noteData={item}
          syncTasksFromNote={syncTasksFromNote} // Pass sync
        />
        {/* Item Content */}
        <div id="item-print-content" className="relative">
          {(!readOnly && isContentEmpty) && (
            <div
              className="absolute left-1/2 z-20"
              style={{ top: '30%', transform: 'translateX(-50%)' }}
            >
              <button
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 focus:outline-none text-base font-medium shadow border border-gray-200 opacity-95 backdrop-blur"
                onClick={() => setShowTemplateModal(true)}
              >
                <FileText className="w-5 h-5" />
                My templates
              </button>
            </div>
          )}
        </div>
        {/* Backlinks Section */}
        {backlinks.length > 0 && (
          <div className="mt-4 p-3 bg-gray-700 rounded border border-gray-600">
            <div className="font-semibold text-gray-300 mb-2">Linked from:</div>
            <ul className="list-disc pl-5">
              {backlinks.map(link => (
                <li key={link._id}>
                  <a href={`?item=${link._id}`} className="text-blue-400 hover:underline">{link.title}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editorInstance && (
        <LinkModal
          editor={editorInstance}
          isOpen={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
        />
      )}

      {/* Sharing Section - now in modal */}
      {!readOnly && shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div ref={shareModalRef} className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative animate-fade-in">
            <div className="font-semibold text-lg text-gray-700 mb-4 flex items-center gap-2">
              <Share className="w-5 h-5 text-blue-500" /> Share this item
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={collabEmail}
                onChange={e => setColabEmail(e.target.value)}
                placeholder="Collaborator email or username"
                className="border rounded px-2 py-1 text-sm flex-1"
              />
              <select
                value={collabPermission}
                onChange={e => setColabPermission(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="read">Read</option>
                <option value="write">Edit</option>
                <option value="admin">Admin</option>
              </select>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                onClick={handleAddCollaborator}
                type="button"
                disabled={!collabEmail}
              >
                Add
              </button>
            </div>
            {sharingError && <div className="text-xs text-red-500 mb-2">{sharingError}</div>}
            {item.collaborators && item.collaborators.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Collaborators:</div>
                <ul>
                  {item.collaborators.map((c: any) => (
                    <li key={c.userId} className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-700">{typeof c.userId === 'object' ? c.userId.email || c.userId.name || c.userId._id : c.userId}</span>
                      <select
                        value={c.permission}
                        onChange={e => handleUpdatePermission(c.userId, e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs"
                      >
                        <option value="read">Read</option>
                        <option value="write">Edit</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        className="text-xs text-red-500 ml-2"
                        onClick={() => handleRemoveCollaborator(c.userId)}
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {moveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={() => setMoveModalOpen(false)}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 mb-6">
              <FileText className="text-gray-500" />
              <span className="text-gray-900 text-xl font-semibold">Manage Notebooks</span>
              <span className="text-gray-500">{titleValue || "Untitled"}</span>
            </div>

            {/* Current Notebooks */}
            {item && 'notebookIds' in item && item.notebookIds && item.notebookIds.length > 0 && (
              <div className="mb-6">
                <h3 className="text-gray-900 text-sm font-medium mb-3">Current Notebooks:</h3>
                <div className="space-y-2">
                  {item.notebookIds.map((notebookId, index) => {
                    const notebookName = typeof notebookId === 'object' && 'name' in notebookId
                      ? notebookId.name
                      : typeof notebookId === 'string'
                        ? notebooks.find(nb => nb._id === notebookId)?.name || 'Unknown'
                        : 'Unknown';
                    const isPrimary = typeof item.primaryNotebookId === 'object' && 'name' in item.primaryNotebookId
                      ? item.primaryNotebookId.name === notebookName
                      : typeof item.primaryNotebookId === 'string'
                        ? item.primaryNotebookId === notebookId
                        : false;

                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-[#232323] rounded-lg">
                        <div className="flex items-center gap-2">
                          <Book className="w-4 h-4 text-gray-400" />
                          <span className="text-white text-sm">{notebookName}</span>
                          {isPrimary && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Primary</span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (noteId && isNote(item)) {
                              const currentNotebookIds = item.notebookIds.filter((_, i) => i !== index);
                              await updateItem(noteId || '', { notebookIds: currentNotebookIds });

                              // Refresh the item data
                              try {
                                const updatedItem = await fetchItem(noteId || '');
                                setItem(updatedItem);
                              } catch (error) {
                                console.error('Failed to refresh item after removing notebook:', error);
                              }
                            }
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Remove from this notebook"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add to Notebook */}
            <div className="mb-6">
              <h3 className="text-white text-sm font-medium mb-3">Add to Notebook:</h3>
              <input
                type="text"
                value={moveSearch}
                onChange={e => setMoveSearch(e.target.value)}
                placeholder="Search notebooks..."
                className="w-full mb-4 px-3 py-2 rounded bg-[#232323] text-white border border-[#333] focus:outline-none"
              />
              <div className="max-h-40 overflow-y-auto">
                {notebooks
                  .filter(nb => nb.name.toLowerCase().includes(moveSearch.toLowerCase()))
                  .filter(nb => !(isNote(item) && item.notebookIds?.some((notebookId: any) =>
                    typeof notebookId === 'object' && 'name' in notebookId
                      ? notebookId.name === nb.name
                      : typeof notebookId === 'string'
                        ? notebookId === nb._id
                        : false
                  )))
                  .map(nb => (
                    <button
                      key={nb._id}
                      className="w-full flex items-center gap-2 px-4 py-2 rounded text-left transition-colors text-white hover:bg-[#232323]"
                      onClick={async () => {
                        if (noteId && isNote(item)) {
                          const currentNotebookIds = item.notebookIds || [];
                          const newNotebookIds = [...currentNotebookIds, nb._id];
                          await updateItem(noteId || '', { notebookIds: newNotebookIds });

                          // Refresh the item data
                          try {
                            const updatedItem = await fetchItem(noteId || '');
                            setItem(updatedItem);
                          } catch (error) {
                            console.error('Failed to refresh item after adding notebook:', error);
                          }

                          setMoveSearch('');
                        }
                      }}
                    >
                      <Book className="w-4 h-4" />
                      <span>{nb.name}</span>
                      <div className="ml-auto text-blue-400 text-sm">+ Add</div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-[#232323] text-white hover:bg-[#333]"
                onClick={() => {
                  setMoveModalOpen(false);
                  setMoveSearch('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-0 relative animate-fade-in border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Choose a template to start with</h2>
              <button className="text-gray-500 hover:text-gray-700 p-1" onClick={() => setShowTemplateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="relative">
                <input
                  type="text"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="Find template"
                  className="w-full pl-10 pr-4 py-2 rounded bg-white text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#818cf8]"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </div>
            </div>
            {/* Templates List */}
            <div className="px-6 py-2 max-h-64 overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No templates found</div>
              ) : (
                <ul>
                  {filteredTemplates.map(t => (
                    <li
                      key={t._id}
                      className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors ${selectedTemplateId === t._id ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedTemplateId(t._id)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      <span className="flex-1">{t.title}</span>
                      {t.isPinned && <Pin className="w-4 h-4 text-[#818cf8]" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 rounded bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded bg-[#818cf8] text-black font-semibold transition-colors ${!selectedTemplateId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#6366f1]'}`}
                disabled={!selectedTemplateId}
                onClick={() => {
                  if (selectedTemplate) {
                    setTitleValue(selectedTemplate.title || '');
                    autoSaveItem(noteId || '', selectedTemplate.title || '');
                    setShowTemplateModal(false);
                  }
                }}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with Add Tag button */}
      {!readOnly && (
        <div className="editor-footer flex items-center gap-3 p-1.5 border-t border-gray-200 bg-white min-w-0 w-full" style={{ height: 32 }}>
          {/* Add Tag Button with anchored dropdown */}
          <div className="relative">
            <button
              ref={tagsButtonRef}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 focus:outline-none group relative"
              onClick={() => setIsTagsDropdownOpen(v => !v)}
              type="button"
              aria-label="Add tag"
            >
              <span className="relative inline-block">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20.59 13.41a2 2 0 0 0 0-2.82l-7.18-7.18a2 2 0 0 0-2.82 0l-5.18 5.18a2 2 0 0 0 0 2.82l7.18 7.18a2 2 0 0 0 2.82 0l5.18-5.18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
                </svg>
                <svg width="10" height="10" viewBox="0 0 10 10" className="absolute -bottom-1 -right-1" fill="none">
                  <circle cx="5" cy="5" r="5" fill="#232323" />
                  <path d="M5 2v6M2 5h6" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="ml-2 text-gray-400 group-hover:text-white">Add tag</span>
            </button>
            {isTagsDropdownOpen && (
              <div className="absolute left-0 z-50" style={{ top: 'auto', bottom: '100%', marginBottom: 8 }}>
                <TagSelect
                  renderSelected={false}
                  selectedTags={selectedTags}
                  onChange={(ids) => { setSelectedTags(ids); handleTagsChange(ids.map(id => ({ value: id })) as any); }}
                  open={isTagsDropdownOpen}
                  onOpenChange={setIsTagsDropdownOpen}
                  anchorRef={tagsButtonRef}
                  placement="up"
                  usePortal={true}
                />
              </div>
            )}
          </div>

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {selectedTags.slice(0, 3).map((tagId) => {
                  const tag = tags.find(t => t._id === tagId);
                  return tag ? (
                    <span
                      key={tag._id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full bg-gray-400"
                      />
                      {tag.name}
                    </span>
                  ) : null;
                })}
                {selectedTags.length > 3 && (
                  <span className="text-xs text-gray-500">+{selectedTags.length - 3}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Removed popup pane; using anchored dropdown instead */}
    </div>
  );
};