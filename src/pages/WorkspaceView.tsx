import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspacesStore, WorkspaceWithContent } from '../stores/useWorkspacesStore';
import { useNotebooksStore } from '../stores/useNotebooksStore';
import { useNotesStore } from '../stores/useNotesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useToastStore } from '../stores/useToastStore';
import { Note } from '../stores/useNotesStore';
import WorkspaceHeader from '../components/workspace/WorkspaceHeader';
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar';
import NotesSection from '../components/workspace/NotesSection';
import { NoteEditor } from '../components/notes/NoteEditor';
import { notebooks as mockNotebooks, workspaceNotes } from '../data/mockData';

// Define the workspace note type to match WorkspaceWithContent
interface WorkspaceNote {
  _id: string;
  title?: string;
  preview?: string;
  date: string;
  thumbnail?: string;
  tags: string[];
  isPinned: boolean;
  category: string;
  notebookIds: string[];
}

const WorkspaceView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchWorkspace } = useWorkspacesStore();
  const { createNotebook } = useNotebooksStore();
  const { createNote, fetchNote } = useNotesStore();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceWithContent | null>(null);

  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>('1');
  const [selectedNote, setSelectedNote] = useState<WorkspaceNote | null>(null);
  const [search, setSearch] = useState('');
  
  // New state for note editor
  const [currentEditingNote, setCurrentEditingNote] = useState<Note | null>(null);
  const [noteEditorLoading, setNoteEditorLoading] = useState(false);
  const [notebookSwitching, setNotebookSwitching] = useState(false);

  // Resizable sidebar width (must be declared before any early returns)
  const [sidebarWidth, setSidebarWidth] = useState<number>(288); // 18rem default
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<boolean>(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - rect.left;
      newWidth = Math.max(220, Math.min(rect.width - 320, newWidth));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Handle notebook selection and reset note states
  const handleNotebookSelect = (notebookId: string) => {
    if (notebookId === selectedNotebookId) return; // Don't do anything if same notebook
    
    setNotebookSwitching(true);
    setSelectedNotebookId(notebookId);
    // Reset note states when switching notebooks
    setSelectedNote(null);
    setCurrentEditingNote(null);
    setNoteEditorLoading(false); // Clear any note loading state
    // Clear search query when switching notebooks
    setSearch('');
    
    // Clear switching state after a brief delay
    setTimeout(() => setNotebookSwitching(false), 300);
  };

  // Additional effect to ensure note states are reset when notebook changes
  useEffect(() => {
    // Reset note states when notebook changes
    setSelectedNote(null);
    setCurrentEditingNote(null);
  }, [selectedNotebookId]);

  // Modal states
  const [showCreateNotebookModal, setShowCreateNotebookModal] = useState(false);
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);

  // Form data
  const [newNotebookData, setNewNotebookData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  const [newNoteData, setNewNoteData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWorkspace(id);
        if (!mounted) return;
        setData(res);
        // Default select first notebook (but don't auto-load a note on initial load)
        if (res.notebooks?.length) {
          setSelectedNotebookId(res.notebooks[0]._id);
        }
      } catch (e: any) {
        setError('Failed to load workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id, fetchWorkspace]);

  const filteredNotebooks = useMemo(() => {
    if (!data) return mockNotebooks;
    const q = search.toLowerCase();
    return data.notebooks.filter(nb => nb.name.toLowerCase().includes(q));
  }, [data, search]);

  const notesForView = useMemo(() => {
    if (!data) return workspaceNotes;
    let notes = (data.notes as WorkspaceNote[]) || [];
    
    // Filter notes by selected notebook
    if (selectedNotebookId) {
      notes = notes.filter(note => {
        // Check if the note belongs to the selected notebook
        return note.notebookIds && note.notebookIds.includes(selectedNotebookId);
      });
    }
    
    // If no notes found for the selected notebook, return empty array
    if (notes.length === 0) {
      return [];
    }
    
    return notes;
  }, [data, selectedNotebookId]);

  // Group notes by notebook for sidebar dropdown
  const notesByNotebook = useMemo(() => {
    const map: Record<string, { _id: string; title?: string; yjsUpdate?: string | { type: 'Buffer'; data: number[] } | Uint8Array }[]> = {};
    if (!data) return map;
    const notes = (data.notes as any[]) || [];
    for (const note of notes) {
      const list = note.notebookIds || [];
      for (const nbId of list) {
        if (!map[nbId]) map[nbId] = [];
        map[nbId].push({ _id: note._id, title: note.title, yjsUpdate: note.yjsUpdate });
      }
    }
    return map;
  }, [data]);

  // Handle note click to open editor
  const handleNoteClick = async (note: WorkspaceNote) => {
    try {
      setNoteEditorLoading(true);
      console.log('Note clicked:', note);
      console.log('Note ID:', note._id);
      
      // Fetch the full note data from the store
      const fullNote = await fetchNote(note._id);
      console.log('Full note fetched:', fullNote);
      
      setCurrentEditingNote(fullNote);
      setNoteEditorLoading(false);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      setNoteEditorLoading(false);
      showToast('Failed to load note', 'error');
    }
  };

  // Handle back from note editor
  const handleBackFromEditor = () => {
    setCurrentEditingNote(null);
    setNoteEditorLoading(false); // Clear any loading state
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookData.name.trim() || !id || !user) return;

    setCreatingNotebook(true);
    try {
      await createNotebook({
        name: newNotebookData.name,
        description: newNotebookData.description,
        workspaceId: id,
        color: newNotebookData.color,
        userId: user.id
      });
      
      setShowCreateNotebookModal(false);
      setNewNotebookData({ name: '', description: '', color: '#3B82F6' });
      showToast('Notebook created successfully!', 'success');
      
      // Refresh workspace data and select the new notebook
      if (id) {
        const res = await fetchWorkspace(id);
        setData(res);
        // Select the newly created notebook
        if (res.notebooks?.length) {
          const newNotebook = res.notebooks.find(nb => nb.name === newNotebookData.name);
          if (newNotebook) {
            handleNotebookSelect(newNotebook._id);
          }
        }
      }
    } catch (error) {
      showToast('Failed to create notebook', 'error');
    } finally {
      setCreatingNotebook(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteData.title.trim() || !id || !user) return;

    setCreatingNote(true);
    try {
      const notebookId = selectedNotebookId || (data?.notebooks?.[0]?._id);
      
      await createNote({
        workspaceId: id,
        notebookIds: notebookId ? [notebookId] : [],
        primaryNotebookId: notebookId,
        userId: user.id
      });
      
      setShowCreateNoteModal(false);
      setNewNoteData({ title: '', content: '' });
      showToast('Note created successfully!', 'success');
      
      // Refresh workspace data to show the new note
      if (id) {
        const res = await fetchWorkspace(id);
        setData(res);
      }
    } catch (error) {
      showToast('Failed to create note', 'error');
    } finally {
      setCreatingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-red-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-red-600 mb-4 text-lg font-medium">{error || 'Workspace not found'}</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const workspace = data?.workspace || { name: 'Name Of Work Space' };
  const currentNotebook = data?.notebooks.find(n => n._id === selectedNotebookId) || data?.notebooks[0] || mockNotebooks[0];


  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 black:bg-[#242424]">
      {/* Header */}
      <WorkspaceHeader
        workspaceName={workspace.name}
        notebookName={currentNotebook?.name}
        noteTitle={currentEditingNote ? (currentEditingNote.title || 'Untitled Note') : undefined}
        onCreateNote={() => setShowCreateNoteModal(true)}
        onBackClick={handleBackFromEditor}
        showBackButton={!!currentEditingNote}
        leftWidth={sidebarWidth}
        workspaceId={workspace._id}
        selectedNotebookId={selectedNotebookId}
        notebooksForShare={(data?.notebooks || []).map(n => ({ _id: n._id, name: n.name }))}
      />
      {/* Main Content - No gaps, seamless flow */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden max-w-[1920px] mx-auto w-full bg-white dark:bg-gray-900 black:bg-[#242424]">
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, minWidth: 220, maxWidth: '50vw' }} className="h-full bg-white dark:bg-gray-900 black:bg-[#181818] flex-shrink-0">
          <WorkspaceSidebar
          workspaceName={workspace.name}
          notebooks={filteredNotebooks}
          selectedNotebookId={selectedNotebookId}
          searchQuery={search}
          onSearchChange={setSearch}
          onNotebookSelect={handleNotebookSelect}
          onCreateNotebook={() => setShowCreateNotebookModal(true)}
          onCreateNote={() => setShowCreateNoteModal(true)}
            notesByNotebook={notesByNotebook}
            onNoteSelect={async (noteId: string) => {
              try {
                setNoteEditorLoading(true);
                const fullNote = await fetchNote(noteId);
                setCurrentEditingNote(fullNote);
              } catch (e) {
                showToast('Failed to load note', 'error');
              } finally {
                setNoteEditorLoading(false);
              }
            }}
          />
        </div>

        {/* Unified Draggable Divider - extends from header to bottom with seamless connection */}
        <div
          className="hidden lg:block relative group flex-shrink-0"
          style={{ width: 12, minWidth: 12, height: '100%', cursor: 'col-resize', zIndex: 20 }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          onDoubleClick={() => setSidebarWidth(288)}
        >
          {/* Main divider line - extends from header to bottom */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none bg-gray-300 dark:bg-gray-600 black:bg-[#4a4a4a] shadow-sm" style={{ width: 2, height: '100%' }} />
          {/* Header extension - connects to the header divider */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none bg-gray-400 dark:bg-gray-500 black:bg-[#5a5a5a] shadow-md" style={{ width: 3, height: '48px' }} />
          {/* Hover handle embellishment - enhanced */}
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-400 dark:bg-gray-500 black:bg-[#5a5a5a] shadow-lg rounded-md" style={{ width: 24, height: 60 }} />
          {/* Resize cursor area */}
          <div className="absolute inset-0" style={{ cursor: 'col-resize' }} />
        </div>
        {/* Main Content Area */}
        {currentEditingNote ? (
          <div className="flex-1 bg-white dark:bg-gray-900 black:bg-[#242424] min-w-0 overflow-x-hidden">
            <NoteEditor
              noteId={currentEditingNote._id}
              onClose={handleBackFromEditor}
            />
          </div>
        ) : noteEditorLoading ? (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 black:bg-[#242424] min-w-0 overflow-x-hidden">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 font-medium">Loading note...</p>
            </div>
          </div>
        ) : notebookSwitching ? (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 black:bg-[#242424] min-w-0 overflow-x-hidden">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 font-medium">Switching notebook...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-gray-900 black:bg-[#242424] min-w-0 overflow-x-hidden">
            <NotesSection
              notes={notesForView}
              onCreateNote={() => setShowCreateNoteModal(true)}
              onNoteClick={handleNoteClick}
              searchQuery={search}
              onSearchChange={setSearch}
              selectedNotebookName={currentNotebook?.name}
            />
          </div>
        )}
      </div>
      {/* Modals remain unchanged */}

      {/* Create Notebook Modal */}
      {showCreateNotebookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded shadow-md"></div>
              </div>
              <h2 className="text-sm font-bold bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent">Create New Notebook</h2>
            </div>
            
            <form onSubmit={handleCreateNotebook}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Notebook Name *
                </label>
                <input
                  type="text"
                  value={newNotebookData.name}
                  onChange={(e) => setNewNotebookData({ ...newNotebookData, name: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  placeholder="Enter notebook name"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Description
                </label>
                <textarea
                  value={newNotebookData.description}
                  onChange={(e) => setNewNotebookData({ ...newNotebookData, description: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg resize-none"
                  placeholder="Enter notebook description"
                  rows={3}
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newNotebookData.color}
                    onChange={(e) => setNewNotebookData({ ...newNotebookData, color: e.target.value })}
                    className="w-16 h-16 border-2 border-gray-300 rounded-xl cursor-pointer transition-all duration-200 hover:border-blue-500 shadow-lg hover:shadow-xl"
                  />
                  <div className="flex-1 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl shadow-lg"></div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateNotebookModal(false)}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingNotebook || !newNotebookData.name.trim()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {creatingNotebook ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Notebook'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Note Modal */}
      {showCreateNoteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-green-600 rounded shadow-md"></div>
              </div>
              <h2 className="text-sm font-bold bg-gradient-to-r from-gray-900 to-green-600 bg-clip-text text-transparent">Create New Note</h2>
            </div>

            <form onSubmit={handleCreateNote}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Note Title *
                </label>
                <input
                  type="text"
                  value={newNoteData.title}
                  onChange={(e) => setNewNoteData({ ...newNoteData, title: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  placeholder="Enter note title"
                  required
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Content
                </label>
                <textarea
                  value={newNoteData.content}
                  onChange={(e) => setNewNoteData({ ...newNoteData, content: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg resize-none"
                  placeholder="Enter note content"
                  rows={4}
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateNoteModal(false)}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingNote || !newNoteData.title.trim()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {creatingNote ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Note'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceView;