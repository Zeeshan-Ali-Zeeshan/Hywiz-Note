import React, { useEffect, useState, useRef } from 'react';
import { Calendar, Tag, Book } from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import { useTagsStore } from '../../stores/useTagsStore';
import { useNotebooksStore } from '../../stores/useNotebooksStore';

export const NotesFilters: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { fetchNotes } = useNotesStore();
  const { tags, fetchTags } = useTagsStore();
  const { notebooks, fetchNotebooks } = useNotebooksStore();

  const [selectedNotebook, setSelectedNotebook] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  // Click outside to close
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose && onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    fetchTags();
    fetchNotebooks();
  }, [fetchTags, fetchNotebooks]);

  // Fetch notes when filters change
  useEffect(() => {
    const filters: any = {};
    if (selectedNotebook) filters.notebook = selectedNotebook;
    if (selectedTags.length > 0) filters.tags = { $all: selectedTags.join(',') };
    if (createdFrom) filters.createdFrom = createdFrom;
    if (createdTo) filters.createdTo = createdTo;
    fetchNotes(filters);
  }, [selectedNotebook, selectedTags, createdFrom, createdTo, fetchNotes]);

  const handleClearAll = () => {
    setSelectedNotebook('');
    setSelectedTags([]);
    setCreatedFrom('');
    setCreatedTo('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className="relative w-[320px] theme-glass-panel rounded-lg shadow-xl px-6 py-5 flex flex-col gap-5 border border-gray-200"
      >
        {/* Title Row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold text-gray-900">Add Filters</span>
          <button
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded transition-colors"
            onClick={handleClearAll}
          >
            Clear all
          </button>
        </div>
        {/* Filter Rows */}
        <div className="flex flex-col gap-4">
          {/* Tags */}
          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 w-[70px] text-sm">Tags</span>
            <div className="flex-1">
              <div className="relative">
                <select
                  className="appearance-none w-full glass-card border border-gray-300 rounded-md px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 pr-6"
                  value={selectedTags[0] || ''}
                  onChange={e => setSelectedTags(e.target.value ? [e.target.value] : [])}
                >
                  <option value="" className="text-gray-500">Select</option>
                  {tags.map(tag => (
                    <option key={tag._id} value={tag._id} className="bg-white text-gray-900">{tag.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {/* Located in */}
          <div className="flex items-center gap-3">
            <Book className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 w-[70px] text-sm">Located in</span>
            <div className="flex-1">
              <div className="relative">
                <select
                  className="appearance-none w-full glass-card border border-gray-300 rounded-md px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 pr-6"
                  value={selectedNotebook}
                  onChange={e => setSelectedNotebook(e.target.value)}
                >
                  <option value="" className="text-gray-500">Notebook</option>
                  {notebooks.map(nb => (
                    <option key={nb._id} value={nb._id} className="bg-white text-gray-900">{nb.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {/* Created */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 w-[70px] text-sm">Created</span>
            <div className="flex-1">
              <input
                type="date"
                className="w-full glass-card border border-gray-300 rounded-md px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder-gray-400"
                value={createdFrom}
                onChange={e => setCreatedFrom(e.target.value)}
                placeholder="Date"
              />
            </div>
          </div>
          {/* Updated */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 w-[70px] text-sm">Updated</span>
            <div className="flex-1">
              <input
                type="date"
                className="w-full glass-card border border-gray-300 rounded-md px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder-gray-400"
                value={createdTo}
                onChange={e => setCreatedTo(e.target.value)}
                placeholder="Date"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
