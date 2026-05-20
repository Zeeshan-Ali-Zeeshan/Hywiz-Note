import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { useNotesStore } from '../stores/useNotesStore';
import { useNotebooksStore } from '../stores/useNotebooksStore';
import { useTasksStore } from '../stores/useTasksStore';
import { useAuthStore } from '../stores/useAuthStore';
import { NotesToolbar } from '../components/notes/NotesToolbar';
import { NotesList } from '../components/notes/NotesList';
import { NoteEditor } from '../components/notes/NoteEditor';
import { NotesFilters } from '../components/notes/NotesFilters';
import { hasTasksInYjs, extractTitleFromYjs, extractPlainTextFromYjs } from '../lib/yjsUtils';

const Tasks: React.FC = () => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [notesListCollapsed, setNotesListCollapsed] = useState(false);

  const { isAuthenticated, user } = useAuthStore();
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

  const { fetchNotebooks } = useNotebooksStore();
  // We don't need the tasks store since tasks are embedded in notes

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Pixel-based resizing state (copied to match Notes page)
  const [notesListWidth, setNotesListWidth] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    fetchNotes();
    fetchNotebooks();
  }, [fetchNotes, fetchNotebooks]);



  // Handle note selection from URL query parameter or current note from store
  useEffect(() => {
    const noteIdFromUrl = searchParams.get('note');
    if (noteIdFromUrl) {
      setSelectedNoteId(noteIdFromUrl);
    } else if (currentNote && !selectedNoteId) {
      setSelectedNoteId(currentNote._id);
    }
  }, [searchParams, currentNote, selectedNoteId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;
      newWidth = Math.max(150, Math.min(containerRect.width - 150, newWidth));
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

  // Filter to only show notes that actually have tasks
  const notesWithTasks = (notes || []).filter(note => {
    const title = extractTitleFromYjs(note.yjsUpdate) || 'Untitled';
    const hasTasks = hasTasksInYjs(note.yjsUpdate as any);
    
    // Enhanced detection: also check for common task patterns in plain text
    let hasTaskPatterns = hasTasks;
    if (!hasTaskPatterns && note.yjsUpdate) {
      try {
        const plainText = extractPlainTextFromYjs(note.yjsUpdate);
        // Look for task-like patterns in plain text
        hasTaskPatterns = /(\[\s*\]|\[x\]|\[✓\])/i.test(plainText) || 
                         plainText.toLowerCase().includes('task') ||
                         plainText.toLowerCase().includes('todo');
      } catch (error) {
        // Fallback: if title suggests tasks, include it
        hasTaskPatterns = title.toLowerCase().includes('task') || 
                         title.toLowerCase().includes('test') ||
                         title.toLowerCase().includes('todo');
      }
    }
    
    return hasTaskPatterns;
  });


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
      const remainingNotes = notesWithTasks.filter(note => note._id !== noteId);
      if (remainingNotes.length > 0) {
        handleNoteSelect(remainingNotes[0]._id);
      } else {
        handleCloseEditor();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-white max-w-[1920px] mx-auto w-full">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 h-full" ref={containerRef}>
        {/* Notes List Panel */}
        {!notesListCollapsed && (
          <div
            className="flex flex-col bg-white transition-all duration-75 lg:flex flex-shrink-0"
            style={{
              width: notesListWidth,
              minWidth: 180,
              maxWidth: '80vw',
              height: '100%',
            }}
          >
            {/* Toolbar */}
            <NotesToolbar 
              onToggleFilters={() => setShowFilters(!showFilters)}
              showFilters={showFilters}
              onNoteCreated={handleNoteSelect}
            />

            {/* Filters */}
            {showFilters && (
              <div className="border-b border-gray-200">
                <NotesFilters onClose={() => setShowFilters(false)} />
              </div>
            )}

            {/* Notes List - only notes with tasks */}
            <div className="flex-1 overflow-hidden">
              <NotesList 
                notes={notesWithTasks}
                loading={loading}
                viewMode={viewMode}
                onNoteSelect={handleNoteSelect}
                selectedNoteId={selectedNoteId}
                onDeleteNote={handleDeleteNote}
              />
            </div>
          </div>
        )}

        {/* Draggable Divider */}
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
            <div className="absolute inset-0" style={{ cursor: 'col-resize' }} />
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
          <div className="hidden lg:flex flex-1 items-center justify-center bg-white min-w-0 overflow-x:hidden">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Select a note to add tasks</h3>
              <p className="text-gray-500">Choose a note from the left panel to open it and add task lists using the Tasks button in the editor toolbar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;