import React from 'react';
import { extractTitleFromYjs, getPlainTextPreview } from '../../lib/yjsUtils';

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
  yjsUpdate?: string | { type: 'Buffer'; data: number[] } | Uint8Array;
}

interface NotesSectionProps {
  notes: WorkspaceNote[];
  onCreateNote: () => void;
  onNoteClick: (note: WorkspaceNote) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedNotebookName?: string;
}

const NotesSection: React.FC<NotesSectionProps> = ({ 
  notes, 
  onCreateNote, 
  onNoteClick,
  searchQuery,
  onSearchChange,
  selectedNotebookName
}) => {
  const getNoteTitle = (note: WorkspaceNote) => {
    if (note.yjsUpdate) {
      const t = extractTitleFromYjs(note.yjsUpdate);
      if (t && t.trim()) return t;
    }
    return note.title || 'Untitled Note';
  };

  const getNotePreview = (note: WorkspaceNote) => {
    if (note.yjsUpdate) {
      const p = getPlainTextPreview(note.yjsUpdate);
      if (p && p.trim()) return p;
    }
    return note.preview || '';
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 black:bg-[#242424]">
      {/* Header - Reduced padding, no shadow */}
      <div className="bg-white dark:bg-gray-900 black:bg-[#242424] border-b border-gray-100 dark:border-gray-800 black:border-[#3a3a3a] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
            <div>
              <h2 className="text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-300 dark:to-purple-400 black:from-blue-300 black:to-purple-400 bg-clip-text text-transparent">
                {selectedNotebookName ? `${selectedNotebookName}` : 'All Notes'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400 mt-1">
                {notes.length} note{notes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes List - Reduced padding, seamless flow */}
      <div className="flex-1 px-8 py-4 overflow-auto">
        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note, index) => (
              <div
                key={note._id}
                onClick={() => onNoteClick(note)}
                className="group bg-white dark:bg-gray-900 black:bg-[#242424] rounded-lg p-4 cursor-pointer transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg hover:shadow-blue-100/10 border border-gray-100 dark:border-gray-800 black:border-[#3a3a3a] relative overflow-hidden"
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                {/* Content */}
                <div className="relative z-10 space-y-2">
                  <h3 className="font-bold text-gray-900 dark:text-white black:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 black:group-hover:text-blue-300 transition-colors duration-200 text-xs">
                    {getNoteTitle(note)}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 black:text-gray-300 group-hover:text-gray-700 dark:group-hover:text-gray-200 black:group-hover:text-gray-200 transition-colors duration-200 leading-relaxed">
                    {getNotePreview(note)}
                  </p>
                </div>
                {/* Hover indicator */}
                <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-0 group-hover:scale-100"></div>
                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 black:bg-[#242424] rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-4xl text-blue-500">📝</span>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <span className="text-white text-xs font-bold">+</span>
              </div>
            </div>
            <h3 className="text-sm font-bold bg-gradient-to-r from-gray-500 to-blue-600 dark:from-gray-300 dark:to-blue-400 black:from-gray-300 black:to-blue-400 bg-clip-text text-transparent mb-2">
              {searchQuery ? 'No notes match your search' : selectedNotebookName ? `No notes in ${selectedNotebookName}` : 'No notes yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 mb-4 max-w-md text-xs leading-relaxed">
              {searchQuery 
                ? 'Try adjusting your search terms to find what you\'re looking for.' 
                : selectedNotebookName 
                  ? `This notebook is empty. Create your first note to get started.`
                  : 'Create your first note to get started and organize your thoughts.'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateNote}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg shadow-md font-semibold text-xs"
              >
                Create Your First Note
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesSection; 