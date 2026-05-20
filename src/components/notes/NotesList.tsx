import React, { useEffect } from 'react';
import { Trash2, Users, Globe, FileText, Star } from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import { Note } from '../../stores/useNotesStore';
import { getPlainTextPreview, extractTitleFromYjs } from '../../lib/yjsUtils';
import { useTagsStore } from '../../stores/useTagsStore';

interface NotesListProps {
  notes?: Note[];
  loading: boolean;
  viewMode: 'list' | 'grid' | 'snippets';
  onNoteSelect: (noteId: string) => void;
  selectedNoteId: string | null;
  onDeleteNote: (noteId: string) => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes: notesProp,
  loading,
  viewMode: _viewMode,
  onNoteSelect,
  selectedNoteId,
  onDeleteNote
}) => {
  const storeNotes = useNotesStore(state => state.notes);
  const { tags: availableTags, fetchTags } = useTagsStore();

  const notes = notesProp ?? storeNotes;

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  if (loading) {
    return (
      <div className="p-3">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5"></div>
              <div className="h-2.5 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xs font-medium text-gray-900 mb-2">No notes found</h3>
          <p className="text-xs text-gray-500 mb-3">Create your first note to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1.5 space-y-1.5">
          {notes.map(note => {
            const isActive = selectedNoteId === note._id;
            const displayTitle =
              (note.title && note.title.trim()) ||
              (note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : '') ||
              'Untitled Note';
            const previewText =
              (typeof note.preview === 'string' && note.preview.trim().length > 0
                ? note.preview
                : note.yjsUpdate
                ? getPlainTextPreview(note.yjsUpdate)
                : '') || 'No content';
            return (
              <div
                key={note._id}
                className={`group relative p-2.5 rounded-md cursor-pointer transition-all duration-300 border bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 hover:backdrop-blur-sm shadow-sm text-gray-700 dark:text-gray-300 black:text-gray-300 border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 ${
                  isActive ? 'ring-1 ring-offset-1 ring-blue-500/40 dark:ring-blue-400/40 black:ring-blue-400/40' : ''
                }`}
                onClick={() => onNoteSelect(note._id)}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shadow-sm transition-all duration-300 bg-gray-100 dark:bg-gray-700 black:bg-[#333333]`}>
                    <div className={`text-sky-600 dark:text-sky-400 black:text-sky-400`}>
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="text-sm font-medium truncate max-w-[180px]">
                        {displayTitle}
                      </h3>
                      {note.isPinned && (
                        <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400 truncate mt-0.5">
                      {previewText}
                    </p>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <span className="text-xs text-sky-600 dark:text-sky-400 black:text-sky-400">
                        Note
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                        {typeof note.primaryNotebookId === 'object' && note.primaryNotebookId !== null && 'name' in note.primaryNotebookId
                          ? (note.primaryNotebookId as any).name
                          : typeof note.primaryNotebookId === 'string' && note.primaryNotebookId
                          ? note.primaryNotebookId
                          : 'My Notes'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                        {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Delete button */}
                <button
                  onClick={e => { 
                    e.stopPropagation(); 
                    onDeleteNote(note._id);
                  }}
                  className="absolute right-1.5 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 black:text-gray-500 black:hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                
                {/* Glassy effect overlay - hover or active */}
                <div className={`absolute inset-0 rounded-md pointer-events-none transition-opacity duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-md" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};