import React, { useState, useEffect } from 'react';
import { Search, Star, Calendar, Filter, Save, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '../../stores/useNotesStore';
import { useNotebooksStore } from '../../stores/useNotebooksStore';
import { useTagsStore } from '../../stores/useTagsStore';
import { getPlainTextPreview } from '../../lib/yjsUtils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchFilters {
  query: string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
  primaryNotebookId: string | null;
  tags: string[];
  hasAttachments: boolean;

  isPinned: boolean;
  sortBy: 'relevance' | 'updatedAt' | 'createdAt' | 'title';
  sortOrder: 'asc' | 'desc';
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { searchResults, searchNotes, loading } = useNotesStore();
  const { notebooks } = useNotebooksStore();
  const { tags } = useTagsStore();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    dateRange: 'all',
    primaryNotebookId: null,
    tags: [],
    hasAttachments: false,
    isPinned: false,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Load saved searches from localStorage
    const saved = localStorage.getItem('savedSearches');
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  }, []);

  const handleSearch = async () => {
    if (!filters.query.trim()) return;

    setIsSearching(true);
    try {
      await searchNotes(filters.query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveSearch = () => {
      const newSavedSearch = {
        id: Date.now().toString(),
      name: `Search: ${filters.query}`,
        filters: { ...filters }
      };
    
    const updatedSearches = [...savedSearches, newSavedSearch];
    setSavedSearches(updatedSearches);
    localStorage.setItem('savedSearches', JSON.stringify(updatedSearches));
  };

  const handleLoadSavedSearch = (savedSearch: typeof savedSearches[0]) => {
    setFilters(savedSearch.filters);
  };

  const handleNoteClick = (noteId: string) => {
    // Navigate to the note using React Router
    navigate(`/notes?note=${noteId}`);
    onClose();
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      dateRange: 'all',
      primaryNotebookId: null,
      tags: [],
      hasAttachments: false,
      isPinned: false,
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Search Notes</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
            {/* Search Input */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
                  placeholder="Search notes..."
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
            <button
                onClick={handleSearch}
                className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Search
            </button>
        </div>

            {/* Filters */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Date Range</h3>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="year">This year</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Notebook</h3>
                <select
                  value={filters.primaryNotebookId || ''}
                  onChange={(e) => setFilters({ ...filters, primaryNotebookId: e.target.value || null })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All notebooks</option>
                  {notebooks.map((notebook) => (
                    <option key={notebook._id} value={notebook._id}>
                      {notebook.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <label key={tag._id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.tags.includes(tag._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, tags: [...filters.tags, tag._id] });
                          } else {
                            setFilters({ ...filters, tags: filters.tags.filter(t => t !== tag._id) });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600">{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.hasAttachments}
                    onChange={(e) => setFilters({ ...filters, hasAttachments: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Has attachments</span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.isPinned}
                    onChange={(e) => setFilters({ ...filters, isPinned: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Pinned notes only</span>
                </label>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sort By</h3>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="relevance">Relevance</option>
                  <option value="updatedAt">Last updated</option>
                  <option value="createdAt">Created date</option>
                  <option value="title">Title</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sort Order</h3>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>

              <button
                onClick={clearFilters}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
              >
                Clear all filters
              </button>
            </div>

            {/* Save Search */}
            {filters.query && (
              <div className="mt-6 pt-6 border-t">
                      <button
                  onClick={handleSaveSearch}
                  className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save this search
                      </button>
                </div>
              )}

              {/* Saved Searches */}
              {savedSearches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Saved Searches</h3>
                  <div className="space-y-2">
                    {savedSearches.map((savedSearch) => (
                      <button
                        key={savedSearch.id}
                        onClick={() => handleLoadSavedSearch(savedSearch)}
                        className="flex items-center justify-between w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <span className="font-medium">{savedSearch.name}</span>
                        <span className="text-sm text-gray-500">{savedSearch.filters.query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* Search Results */}
          {filters.query && (
            <div className="p-6">
              {isSearching || loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </h3>
                    <button
                      onClick={handleSearch}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Search
                    </button>
                  </div>
                  <div className="space-y-3">
                    {searchResults.map((note) => (
                      <div
                        key={note._id}
                        onClick={() => handleNoteClick(note._id)}
                        className="p-4 border border-gray-200/60 rounded-lg cursor-pointer bg-white/80 hover:backdrop-blur-sm shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{note.title}</h4>
                          <div className="flex items-center space-x-2">
                            {note.isPinned && <Star className="w-4 h-4 text-yellow-500" />}
                            <span className="text-sm text-gray-500">
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) : 'No content'}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{note.primaryNotebookId?.name}</span>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex space-x-1">
                              {note.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag._id}
                                  className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-700"
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                  <p className="text-gray-500">Try adjusting your search terms or filters</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;