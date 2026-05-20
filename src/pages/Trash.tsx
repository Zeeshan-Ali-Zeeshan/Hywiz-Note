import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, X, Search, Calendar } from 'lucide-react';
import { useNotesStore } from '../stores/useNotesStore';
import { getPlainTextPreview, extractTitleFromYjs } from '../lib/yjsUtils';

export const Trash: React.FC = () => {
  const { notes, fetchNotes, restoreNote, permanentDeleteNote, bulkPermanentDelete } = useNotesStore();
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotes({ deleted: true });
  }, [fetchNotes]);

  const handleRestore = async (noteId: string) => {
    try {
      await restoreNote(noteId);
      setSelectedNotes(prev => prev.filter(id => id !== noteId));
    } catch (error) {
      console.error('Failed to restore note:', error);
    }
  };

  const handlePermanentDelete = async (noteId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
      try {
        await permanentDeleteNote(noteId);
        setSelectedNotes(prev => prev.filter(id => id !== noteId));
      } catch (error) {
        console.error('Failed to permanently delete note:', error);
      }
    }
  };

  const handleBulkRestore = async () => {
    try {
      for (const noteId of selectedNotes) {
        await restoreNote(noteId);
      }
      setSelectedNotes([]);
    } catch (error) {
      console.error('Failed to bulk restore notes:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to permanently delete ${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      try {
        await bulkPermanentDelete(selectedNotes);
        setSelectedNotes([]);
      } catch (error) {
        console.error('Failed to bulk delete notes:', error);
      }
    }
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNotes(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleSelectAll = () => {
    if (selectedNotes.length === filteredNotes.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(filteredNotes.map(note => note._id));
    }
  };

  const filteredNotes = notes.filter(note => {
    // First ensure we only show deleted notes
    if (!note.isDeleted) return false;
    
    // If no search query, show all deleted notes
    if (!searchQuery.trim()) return true;
    
    // Apply search filter
    const title = note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : (note.title || '');
    const content = note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) : (note.content || '');
    
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto w-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white black:text-white">Trash</h1>
            <p className="text-xs text-gray-600 mt-1">
              {filteredNotes.length} deleted note{filteredNotes.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {selectedNotes.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBulkRestore}
                className="flex items-center space-x-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-xs">Restore ({selectedNotes.length})</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span className="text-xs">Delete Forever ({selectedNotes.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-b border-gray-200 p-3">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search deleted notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
            />
          </div>
          
          {filteredNotes.length > 0 && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedNotes.length === filteredNotes.length}
                onChange={handleSelectAll}
                className="rounded"
              />
              <span className="ml-2 text-xs text-gray-600">Select all</span>
            </label>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {filteredNotes.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-xs font-medium text-gray-900 dark:text-white black:text-white mb-2">
                {searchQuery ? 'No deleted notes found' : 'Trash is empty'}
              </h3>
              <p className="text-xs text-gray-500">
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Deleted notes will appear here and can be restored within 30 days'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map((note) => (
              <div
                key={note._id}
                className="bg-white/80 hover:backdrop-blur-sm rounded-lg p-3 shadow-sm border border-gray-200/60"
              >
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedNotes.includes(note._id)}
                    onChange={() => handleSelectNote(note._id)}
                    className="mt-1 rounded"
                  />

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white black:text-white mb-1 text-xs">{note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : 'Untitled'}</h3>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) : 'No content'}
                    </p>
                    
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>
                        {typeof note.primaryNotebookId === 'object' && note.primaryNotebookId !== null && 'name' in note.primaryNotebookId
                          ? note.primaryNotebookId.name
                          : typeof note.primaryNotebookId === 'string' && note.primaryNotebookId
                          ? note.primaryNotebookId
                          : 'My Notes'}
                      </span>
                      {note.deletedAt && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Deleted {new Date(note.deletedAt as string).toLocaleDateString()}</span>
                        </div>
                      )}
                      {note.tags.length > 0 && (
                        <div className="flex space-x-1">
                          {note.tags.slice(0, 2).map((tag) => (
                            <span
                              key={typeof tag === 'object' ? tag._id : tag}
                              className="px-1.5 py-0.5 bg-gray-100 rounded-full text-xs"
                            >
                              {typeof tag === 'object' ? tag.name : tag}
                            </span>
                          ))}
                          {note.tags.length > 2 && (
                            <span className="text-gray-400 text-xs">+{note.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      onClick={() => handleRestore(note._id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Restore note"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(note._id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete forever"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {filteredNotes.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500 text-center">
            Notes in trash are automatically deleted after 30 days. 
            Restore important notes before they're permanently removed.
          </p>
        </div>
      )}
    </div>
  );
};

export default Trash;