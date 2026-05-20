import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  BookOpen,
  Search, 
  Star, 
  MoreVertical, 
  Trash2, 
} from 'lucide-react';
import { useNotesStore } from '../stores/useNotesStore';
import { useTemplatesStore } from '../stores/useTemplatesStore';
import { NoteEditor } from '../components/notes/NoteEditor';
import { TemplateEditor } from '../components/editor/TemplateEditor';
import { useToastStore } from '../stores/useToastStore';
import notebookImg from '../components/layout/notebook.png';
import { extractTitleFromYjs, getPlainTextPreview } from '../lib/yjsUtils';

interface ShortcutItem {
  id: string;
  name: string;
  type: 'note' | 'template';
  icon: React.ReactNode;
  color: string;
  lastModified: string;
  description?: string;
  tags?: string[];
  isPinned?: boolean;
}

export const Shortcuts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notes, fetchNotes, toggleShortcut: toggleNoteShortcut } = useNotesStore();
  const { templates, fetchTemplates, toggleShortcut: toggleTemplateShortcut } = useTemplatesStore();
  const { showToast } = useToastStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShortcutId, setSelectedShortcutId] = useState<string | null>(null);
  const [selectedShortcutType, setSelectedShortcutType] = useState<'note' | 'template' | null>(null);
  const [shortcutsListCollapsed, setShortcutsListCollapsed] = useState(false);
  
  // Pixel-based resizing state
  const [shortcutsListWidth, setShortcutsListWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    fetchNotes();
    fetchTemplates();
  }, [fetchNotes, fetchTemplates]);

  // Handle shortcut selection from URL query parameter
  useEffect(() => {
    const shortcutIdFromUrl = searchParams.get('shortcut');
    const shortcutTypeFromUrl = searchParams.get('type') as 'note' | 'template' | null;
    
    if (shortcutIdFromUrl && shortcutTypeFromUrl) {
      setSelectedShortcutId(shortcutIdFromUrl);
      setSelectedShortcutType(shortcutTypeFromUrl);
    }
  }, [searchParams]);

  // Drag logic for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;
      newWidth = Math.max(150, Math.min(containerRect.width - 150, newWidth));
      setShortcutsListWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Get all notes and templates marked as shortcuts
  const shortcutNotes = notes.filter(note => note.isShortcut);
  const shortcutTemplates = templates.filter(template => template.isShortcut);
  
  const allShortcuts: ShortcutItem[] = [
    ...shortcutNotes.map(note => ({
      id: note._id,
      name: note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : 'Untitled Note',
      type: 'note' as const,
      icon: <FileText className="w-3.5 h-3.5" />,
      color: 'bg-blue-500',
      lastModified: new Date(note.updatedAt).toLocaleDateString(),
      description: note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) : 'Quick access note',
      tags: [],
      isPinned: note.isPinned
    })),
    ...shortcutTemplates.map(template => ({
      id: template._id,
      name: template.yjsUpdate ? extractTitleFromYjs(template.yjsUpdate) : 'Untitled Template',
      type: 'template' as const,
      icon: <BookOpen className="w-3.5 h-3.5" />,
      color: 'bg-purple-500',
      lastModified: new Date(template.updatedAt).toLocaleDateString(),
      description: template.yjsUpdate ? getPlainTextPreview(template.yjsUpdate) : template.description || 'No description',
      tags: [],
      isPinned: template.isPinned
    }))
  ];

  const filteredShortcuts = allShortcuts.filter(shortcut =>
    shortcut.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShortcutSelect = (shortcutId: string, type: 'note' | 'template') => {
    setSelectedShortcutId(shortcutId);
    setSelectedShortcutType(type);
    
    // Update URL without navigation
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('shortcut', shortcutId);
    newSearchParams.set('type', type);
    setSearchParams(newSearchParams);
  };

  const handleCloseEditor = () => {
    setSelectedShortcutId(null);
    setSelectedShortcutType(null);
    
    // Remove shortcut from URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('shortcut');
    newSearchParams.delete('type');
    setSearchParams(newSearchParams);
  };

  const handleRemoveShortcut = async (shortcutId: string, type: 'note' | 'template') => {
    try {
      if (type === 'note') {
        await toggleNoteShortcut(shortcutId, false);
        showToast('Note removed from shortcuts', 'success');
      } else {
        await toggleTemplateShortcut(shortcutId, false);
        showToast('Template removed from shortcuts', 'success');
      }
    } catch (error) {
      console.error('Failed to remove shortcut:', error);
      showToast('Failed to remove shortcut', 'error');
    }
  };

  const selectedShortcut = allShortcuts.find(s => s.id === selectedShortcutId);

    return (
    <div className="h-screen flex flex-col bg-gray-50 min-h-0 max-w-[1920px] mx-auto w-full">
      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0 h-full"
        ref={containerRef}
      >
        {/* Shortcuts List Panel */}
        {!shortcutsListCollapsed && (
          <div
            className="flex flex-col bg-white transition-all duration-75 lg:flex border-r border-gray-200 z-20"
            style={{
              width: shortcutsListWidth,
              minWidth: 150,
              maxWidth: '80vw',
              height: '100%',
              position: 'relative',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-2.5 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500 dark:text-yellow-400 black:text-yellow-400" />
                <h1 className="text-sm font-semibold text-gray-900 dark:text-white black:text-white">Shortcuts</h1>
                <span className="bg-gray-100 dark:bg-gray-700 black:bg-gray-700 text-gray-600 dark:text-gray-300 black:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                  {filteredShortcuts.length}
                </span>
              </div>
              <button
                onClick={() => setShortcutsListCollapsed(true)}
                className="lg:hidden p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 black:text-gray-400 black:hover:text-gray-300"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-2.5 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 black:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shortcuts..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 black:bg-gray-900 border border-gray-300 dark:border-gray-600 black:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 black:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                />
              </div>
            </div>

            {/* Shortcuts List */}
            <div className="flex-1 overflow-y-auto">
              {filteredShortcuts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400 black:text-gray-400 px-4">
                  <Star className="w-10 h-10 mb-2 text-gray-400 dark:text-gray-500 black:text-gray-500" />
                  <h3 className="text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400 black:text-gray-400">
                    {searchQuery ? 'No shortcuts found' : 'No shortcuts yet'}
                  </h3>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-500 black:text-gray-500 max-w-xs">
                    {searchQuery 
                      ? 'Try adjusting your search terms'
                      : 'Add notes and templates to shortcuts for quick access'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-1.5 space-y-1.5">
                  {filteredShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className={`group relative p-2.5 rounded-md cursor-pointer transition-all duration-300 border bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 hover:backdrop-blur-sm shadow-sm text-gray-700 dark:text-gray-300 black:text-gray-300 ${
                        selectedShortcutId === shortcut.id
                          ? 'ring-1 ring-offset-1 ring-blue-500/40 dark:ring-blue-400/40 black:ring-blue-400/40 border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60'
                          : 'border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60'
                      }`}
                      onClick={() => handleShortcutSelect(shortcut.id, shortcut.type)}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shadow-sm transition-all duration-300 ${
                          selectedShortcutId === shortcut.id 
                            ? 'bg-white/10' 
                            : 'bg-gray-100 dark:bg-gray-700 black:bg-[#333333]'
                        }`}>
                          <div className={`${
                            shortcut.type === 'note'
                              ? 'text-sky-600 dark:text-sky-400 black:text-sky-400'
                              : 'text-violet-600 dark:text-violet-400 black:text-violet-400'
                          }`}>
                            {shortcut.icon}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <h3 className="text-sm font-medium truncate max-w-[180px]">{shortcut.name}</h3>
                            {shortcut.isPinned && (
                              <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400 truncate mt-0.5">
                            {shortcut.description}
                          </p>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <span className="text-xs text-blue-600 dark:text-blue-400 black:text-blue-400">
                              {shortcut.type === 'note' ? 'Note' : 'Template'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                              {shortcut.lastModified}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveShortcut(shortcut.id, shortcut.type);
                        }}
                        className="absolute right-1.5 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 black:text-gray-500 black:hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      
                      {/* Glassy effect overlay - hover or active */}
                      <div className={`absolute inset-0 rounded-md pointer-events-none transition-opacity duration-200 ${
                        selectedShortcutId === shortcut.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resize Handle */}
        <div
          className="hidden lg:block w-1 bg-gray-200 dark:bg-gray-700 black:bg-[#3a3a3a] cursor-col-resize hover:bg-gray-300 dark:hover:bg-gray-600 black:hover:bg-[#4a4a4a] transition-colors"
          onMouseDown={(e) => {
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedShortcutId && selectedShortcutType ? (
            <>
              {/* Editor Content */}
              <div className="flex-1 overflow-hidden">
                {selectedShortcutType === 'note' ? (
                  <NoteEditor
                    noteId={selectedShortcutId}
                    onClose={handleCloseEditor}
                    type="note"
                    notesListCollapsed={shortcutsListCollapsed}
                    setNotesListCollapsed={setShortcutsListCollapsed}
                  />
                ) : (
                  <TemplateEditor
                    templateId={selectedShortcutId}
                    onClose={handleCloseEditor}
                    templatesListCollapsed={shortcutsListCollapsed}
                    setTemplatesListCollapsed={setShortcutsListCollapsed}
                  />
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800 black:bg-[#242424]">
              <div className="text-center">
                <Star className="w-16 h-16 text-gray-400 dark:text-gray-500 black:text-gray-500 mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">
                  Select a Shortcut
                </h3>
                <p className="text-gray-500 dark:text-gray-400 black:text-gray-400 max-w-md">
                  Choose a shortcut from the list to start editing. Your shortcuts provide quick access to your most important notes and templates.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shortcuts;