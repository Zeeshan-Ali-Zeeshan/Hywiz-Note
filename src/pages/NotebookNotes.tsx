import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useNotesStore } from '../stores/useNotesStore';
import { useNotebooksStore } from '../stores/useNotebooksStore';
import { useTagsStore } from '../stores/useTagsStore';
import { NotesToolbar } from '../components/notes/NotesToolbar';
import { NotesList } from '../components/notes/NotesList';
import { NoteEditor } from '../components/notes/NoteEditor';
import { NotesFilters } from '../components/notes/NotesFilters';
import { ChevronDown } from 'lucide-react';

export const NotebookNotes: React.FC = () => {
  const { id: notebookId } = useParams<{ id: string }>();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [notesListWidth, setNotesListWidth] = useState(400); // default in px
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [notesListCollapsed, setNotesListCollapsed] = useState(false);
  const [showNotebookDropdown, setShowNotebookDropdown] = useState(false);
  const notebookButtonRef = useRef<HTMLButtonElement | null>(null);
  const notebookDropdownRef = useRef<HTMLDivElement | null>(null);

  const {
    notes,
    fetchNotes,
    loading,
    viewMode,
    selectedNotes,
    clearSelection,
    currentNote,
    setCurrentNote,
    deleteNote
  } = useNotesStore();
  const { fetchNotebooks, notebooks } = useNotebooksStore();
  const { fetchTags } = useTagsStore();

  useEffect(() => {
    fetchNotes();
    fetchNotebooks();
    fetchTags();
  }, [fetchNotes, fetchNotebooks, fetchTags]);

  // If no notebookId in URL, navigate to first notebook as default
  useEffect(() => {
    if (!notebookId && notebooks && notebooks.length > 0) {
      navigate(`/notebooks/${notebooks[0]._id}`, { replace: true });
    }
  }, [notebookId, notebooks, navigate]);

  // Close notebook dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showNotebookDropdown &&
        notebookDropdownRef.current &&
        !notebookDropdownRef.current.contains(target) &&
        notebookButtonRef.current &&
        !notebookButtonRef.current.contains(target)
      ) {
        setShowNotebookDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotebookDropdown]);

  // Filter notes for this notebook
  const notebookNotes = notes.filter(note =>
    Array.isArray(note.notebookIds)
      ? note.notebookIds.some(
          (nb: any) => (typeof nb === 'string' ? nb === notebookId : nb._id === notebookId)
        )
      : false
  );

  // Get notebook name
  const notebook = notebooks.find(nb => nb._id === notebookId);

  // Handle note selection from URL query parameter or current note from store
  useEffect(() => {
    const noteIdFromUrl = searchParams.get('note');
    if (noteIdFromUrl) {
      setSelectedNoteId(noteIdFromUrl);
    } else if (currentNote && !selectedNoteId) {
      setSelectedNoteId(currentNote._id);
    }
  }, [searchParams, currentNote, selectedNoteId]);

  const handleNoteSelect = (noteId: string) => {
    setSelectedNoteId(noteId);
    clearSelection();
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('note', noteId);
    setSearchParams(newSearchParams);
  };

  const handleCloseEditor = () => {
    setSelectedNoteId(null);
    setCurrentNote(null);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('note');
    setSearchParams(newSearchParams);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    await fetchNotes();
    if (selectedNoteId === noteId) {
      const remainingNotes = notebookNotes.filter(note => note._id !== noteId);
      if (remainingNotes.length > 0) {
        handleNoteSelect(remainingNotes[0]._id);
      } else {
        handleCloseEditor();
      }
    }
  };

  // Debug log for selectedNoteId
  console.log('selectedNoteId:', selectedNoteId);

  // Robust drag logic with debug logs
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;
      newWidth = Math.max(150, Math.min(containerRect.width - 150, newWidth)); // min 150px, max so editor is at least 150px
      setNotesListWidth(newWidth);
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

  return (
    <div className="h-screen flex flex-col bg-white min-h-0 max-w-[1920px] mx-auto w-full">
      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0 h-full"
        ref={containerRef}
      >
        {/* Notes List Panel */}
        {!notesListCollapsed && (
          <div
            className="flex flex-col bg-white transition-all duration-75 lg:flex"
            style={{
              width: notesListWidth,
              minWidth: 150,
              maxWidth: '80vw',
              height: '100%',
            }}
          >
            {/* Toolbar and Notebook Name in one row */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-[#23272B]">
              <div className="flex items-center gap-2 relative">
                <button
                  ref={notebookButtonRef}
                  type="button"
                  onClick={() => setShowNotebookDropdown(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white text-gray-900 hover:bg-gray-100 text-xs"
                >
                  <span className="font-semibold truncate max-w-[160px]">{notebook ? notebook.name : 'Notebook'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showNotebookDropdown && (
                  <div
                    ref={notebookDropdownRef}
                    className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg w-56 max-h-64 overflow-auto"
                  >
                    <ul className="py-1 text-sm text-gray-800">
                      {notebooks.map(nb => (
                        <li key={nb._id}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNotebookDropdown(false);
                              navigate(`/notebooks/${nb._id}`);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${nb._id === notebookId ? 'bg-gray-50 font-semibold' : ''}`}
                          >
                            {nb.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex-1 flex justify-end">
                <NotesToolbar
                  onToggleFilters={() => setShowFilters(!showFilters)}
                  showFilters={showFilters}
                  onNoteCreated={handleNoteSelect}
                />
              </div>
            </div>
            {/* Filters */}
            {showFilters && (
              <div className="border-b border-gray-200">
                <NotesFilters onClose={() => setShowFilters(false)} />
              </div>
            )}
            {/* Notes List */}
            <div className="flex-1 overflow-hidden">
              <NotesList
                notes={notebookNotes}
                loading={loading}
                viewMode={viewMode}
                onNoteSelect={handleNoteSelect}
                selectedNoteId={selectedNoteId}
                onDeleteNote={handleDeleteNote}
              />
            </div>
          </div>
        )}
        {/* Draggable Divider - Always visible on large screens */}
        {!notesListCollapsed && (
          <div
            className="hidden lg:block relative"
            style={{
              width: 12,
              minWidth: 12,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              dragging.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            onDoubleClick={() => setNotesListWidth(400)}
          >
            {/* Visual indicator: always visible */}
            <div
              className="absolute inset-y-0 left-1/2 transform -translate-x-1/2"
              style={{
                width: 2,
                background: '#ccc',
                borderRadius: 1,
                height: '100%',
                opacity: 0.7,
              }}
            />
            {/* Larger hit area for easier clicking */}
            <div
              className="absolute inset-0"
              style={{ cursor: 'col-resize' }}
            />
          </div>
        )}
        {/* Note Editor Panel */}
        {selectedNoteId ? (
          <div className="flex-1 bg-white min-w-0 overflow-x-hidden">
            <NoteEditor
              noteId={selectedNoteId as string}
              onClose={handleCloseEditor}
              notesListCollapsed={notesListCollapsed}
              setNotesListCollapsed={setNotesListCollapsed}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-white min-w-0 overflow-x-hidden">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white black:text-white mb-2">Select a note to view</h3>
              <p className="text-gray-500 text-xs">Choose a note from the list to start reading or editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookNotes; 