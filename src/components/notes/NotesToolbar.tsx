import React, { useState } from 'react';
import { 
  Filter, SortAsc, SortDesc, 
  Grid, List, Trash2, Archive, Pin
} from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import IconButton from '../common/IconButton';

export const NotesToolbar: React.FC<{ 
  onNoteCreated?: (noteId: string) => void; 
  showFilters?: boolean; 
  onToggleFilters?: () => void;
}> = ({ onNoteCreated, onToggleFilters }) => {
  const { 
    createNote, 
    viewMode, 
    setViewMode, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    setSortOrder,
    selectedNotes,
    bulkOperation
  } = useNotesStore();
  
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);


  const handleBulkAction = async (action: 'delete' | 'archive' | 'pin') => {
    if (selectedNotes.length === 0) return;

    try {
      await bulkOperation(action, selectedNotes);
    } catch (error) {
      console.error(`Failed to ${action} notes:`, error);
    }
  };

  const sortOptions = [
    { value: 'updatedAt', label: 'Last Modified' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'title', label: 'Title' },
    { value: 'primaryNotebookId', label: 'Notebook' },
  ];

  const viewOptions = [
    { value: 'list', label: 'List View', icon: List },
    { value: 'grid', label: 'Grid View', icon: Grid },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 black:bg-gray-900 px-0 py-0 border-b border-gray-200 dark:border-gray-700 black:border-gray-800">
      <div className="flex items-center justify-end gap-1.5">
        {/* Center Section - Bulk Actions */}
        {selectedNotes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
              {selectedNotes.length} selected
            </span>
            <IconButton
              onClick={() => handleBulkAction('pin')}
              icon={<Pin className="w-3.5 h-3.5" />}
              tooltip="Pin Notes"
              variant="ghost"
              size="sm"
              className="text-gray-500 dark:text-gray-400 black:text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 black:hover:text-yellow-400"
            />
            <IconButton
              onClick={() => handleBulkAction('archive')}
              icon={<Archive className="w-3.5 h-3.5" />}
              tooltip="Archive Notes"
              variant="ghost"
              size="sm"
              className="text-gray-500 dark:text-gray-400 black:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 black:hover:text-blue-400"
            />
            <IconButton
              onClick={() => handleBulkAction('delete')}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              tooltip="Delete Notes"
              variant="ghost"
              size="sm"
              className="text-gray-500 dark:text-gray-400 black:text-gray-400 hover:text-red-500 dark:hover:text-red-400 black:hover:text-red-400"
            />
          </div>
        )}
        {/* Right Section */}
        <div className="flex items-center gap-1.5">
          {/* Filter Button */}
          <IconButton
            onClick={onToggleFilters}
            icon={<Filter className="w-4 h-4" />}
            tooltip="Filter"
            variant="ghost"
            size="sm"
            className="text-gray-600 dark:text-gray-400 black:text-gray-400"
          />
          {/* View Toggle */}
          <div className="relative">
            <IconButton
              onClick={() => setShowViewMenu(!showViewMenu)}
              icon={viewMode === 'list' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              tooltip="View"
              variant="ghost"
              size="sm"
              className="text-gray-600 dark:text-gray-400 black:text-gray-400"
            />

            {showViewMenu && (
              <div className="absolute right-0 mt-2 w-28 bg-white dark:bg-gray-800 black:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 black:border-gray-800 py-1 z-50">
                {viewOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setViewMode(option.value as 'list' | 'grid');
                        setShowViewMenu(false);
                      }}
                      className={`w-full px-2 py-1.5 text-left text-xs flex items-center space-x-2 ${
                        viewMode === option.value
                          ? 'text-blue-600 dark:text-blue-400 black:text-blue-400 bg-blue-50 dark:bg-blue-900/20 black:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-gray-800'
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sort Menu */}
          <div className="relative">
            <IconButton
              onClick={() => setShowSortMenu(!showSortMenu)}
              icon={sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              tooltip="Sort"
              variant="ghost"
              size="sm"
              className="text-gray-500 dark:text-gray-400 black:text-gray-400"
            />

            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 black:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 black:border-gray-800 py-1 z-50">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value as any);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-2 py-1.5 text-left text-xs ${
                      sortBy === option.value
                        ? 'text-blue-600 dark:text-blue-400 black:text-blue-400 bg-blue-50 dark:bg-blue-900/20 black:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-gray-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <hr className="my-1 border-gray-200 dark:border-gray-700 black:border-gray-800" />
                <button
                  onClick={() => {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    setShowSortMenu(false);
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-gray-800"
                >
                  {sortOrder === 'asc' ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close menus */}
      {(showSortMenu || showViewMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowSortMenu(false);
            setShowViewMenu(false);
          }}
        />
      )}
    </div>
  );
};