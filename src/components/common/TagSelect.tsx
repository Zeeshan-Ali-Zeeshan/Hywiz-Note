import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Tag } from 'lucide-react';
import { useTagsStore } from '../../stores/useTagsStore';

interface TagSelectProps {
  selectedTags: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  // When true, renders the selected chips + internal trigger. When false, only renders the dropdown body.
  renderSelected?: boolean;
  // Controlled open state for dropdown. If undefined, component manages its own open state.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Optional external anchor; clicks inside this ref won't close the dropdown
  anchorRef?: React.RefObject<HTMLElement>;
  // Optional placement hint for dropdown when renderSelected is true (default: down)
  placement?: 'up' | 'down';
  // Render dropdown in a portal attached to body for clipping-safe positioning (default: true)
  usePortal?: boolean;
}

export const TagSelect: React.FC<TagSelectProps> = ({
  selectedTags,
  onChange,
  placeholder = "Select tags...",
  className = "",
  disabled = false,
  renderSelected = true,
  open,
  onOpenChange,
  anchorRef,
  placement,
  usePortal = true
}) => {
  const { tags, fetchTags, createTag } = useTagsStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [computedPlacement, setComputedPlacement] = useState<'up' | 'down'>(() => (typeof window !== 'undefined' ? 'down' : 'down'));
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});

  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? !!open : internalOpen;
  const setOpen = (next: boolean) => {
    console.log('TagSelect: setOpen called with', next, 'isControlled:', isControlled);
    if (isControlled) {
      onOpenChange && onOpenChange(next);
    } else {
      setInternalOpen(next);
      onOpenChange && onOpenChange(next);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Auto placement if not explicitly provided
  useEffect(() => {
    if (!isOpen) return;
    const decide = () => {
      if (!anchorRef?.current) return setComputedPlacement('down');
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setComputedPlacement(spaceAbove > spaceBelow ? 'up' : 'down');
    };
    decide();
    window.addEventListener('resize', decide);
    window.addEventListener('scroll', decide, true);
    return () => {
      window.removeEventListener('resize', decide);
      window.removeEventListener('scroll', decide, true);
    };
  }, [isOpen, anchorRef]);

  // Compute portal position when open
  useEffect(() => {
    if (!isOpen || !usePortal) return;
    const updatePosition = () => {
      if (!anchorRef?.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const width = 235; // fixed dropdown width in pixels
      const chosen = placement ?? computedPlacement;
      const style: React.CSSProperties = {
        position: 'fixed',
        left: Math.round(rect.left),
        width,
        zIndex: 50
      };
      if (chosen === 'up') {
        style.bottom = Math.round(window.innerHeight - rect.top + 8);
      } else {
        style.top = Math.round(rect.bottom + 8);
      }
      setPortalStyle(style);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef, placement, computedPlacement, usePortal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      const clickedInsideDropdown = dropdownRef.current?.contains(targetNode);
      const clickedInsideAnchor = anchorRef?.current?.contains(targetNode);
      
      // Debug logging
      console.log('TagSelect click outside check:', {
        isOpen,
        clickedInsideDropdown,
        clickedInsideAnchor,
        targetElement: (targetNode as Element)?.tagName,
        targetClasses: (targetNode as Element)?.className
      });
      
      if (!clickedInsideDropdown && !clickedInsideAnchor) {
        console.log('TagSelect closing dropdown due to outside click');
        setOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, anchorRef]);

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedTags.includes(tag._id)
  );

  const handleTagSelect = (tagId: string) => {
    console.log('TagSelect: Tag selected', tagId);
    const newSelectedTags = [...selectedTags, tagId];
    onChange(newSelectedTags);
    setSearchQuery('');
  };

  const handleTagRemove = (tagId: string) => {
    const newSelectedTags = selectedTags.filter(id => id !== tagId);
    onChange(newSelectedTags);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const newTag = await createTag({ name: newTagName.trim() });
      const newSelectedTags = [...selectedTags, newTag._id];
      onChange(newSelectedTags);
      setNewTagName('');
      setSearchQuery('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getTagById = (tagId: string) => {
    return tags.find(tag => tag._id === tagId);
  };

  const selectedTagObjects = selectedTags.map(tagId => getTagById(tagId)).filter(Boolean);

  return (
    <div className={`relative ${className}`} style={{ outline: 'none', boxShadow: 'none !important' }}>
      {renderSelected && (
        <div className="flex flex-wrap gap-1.5 min-h-[32px] p-1.5 border border-gray-300 rounded-lg bg-white">
          {selectedTagObjects.map((tag) => (
            <div
              key={tag!._id}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
            >
              <div
                className="w-1.5 h-1.5 rounded-full bg-gray-400"
              />
              <span>{tag!.name}</span>
               <button
                 type="button"
                 onClick={() => handleTagRemove(tag!._id)}
                 className="ml-1 hover:text-blue-600 focus:outline-none"
                 style={{ outline: 'none', boxShadow: 'none !important' }}
                 disabled={disabled}
               >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Add Tag Button */}
           <button
             type="button"
             onClick={() => setOpen(!isOpen)}
             className="flex items-center gap-1 px-1.5 py-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full text-xs transition-colors focus:outline-none"
             style={{ outline: 'none', boxShadow: 'none !important' }}
             disabled={disabled}
           >
            <Plus size={12} />
            <span>Add Tag</span>
          </button>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (!usePortal ? (
        <div
          ref={dropdownRef}
          className={`${renderSelected ? ((placement ?? computedPlacement) === 'up' ? 'absolute left-0 right-0 bottom-full mb-1' : 'absolute top-full left-0 right-0 mt-1') : ''} rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto w-[235px]`}
          style={{ 
            backgroundColor: '#000000', 
            borderColor: '#3a3a3a',
            borderWidth: '1px',
            borderStyle: 'solid',
            outline: 'none',
            boxShadow: 'none !important'
          }}
        >
          {/* Search Input */}
          <div className="p-2" style={{ borderBottom: '1px solid #3a3a3a' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg focus:outline-none text-xs"
              style={{
                backgroundColor: '#2f2f2f',
                color: '#e5e5e5',
                border: '1px solid #3a3a3a',
                outline: 'none',
                boxShadow: 'none !important'
              }}
              autoFocus
            />
          </div>

          {/* Create New Tag */}
          <div className="p-2" style={{ borderBottom: '1px solid #3a3a3a' }}>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Create new tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg focus:outline-none text-xs"
                style={{
                  backgroundColor: '#2f2f2f',
                  color: '#e5e5e5',
                  border: '1px solid #3a3a3a'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
              />
               <button
                 type="button"
                 onClick={handleCreateTag}
                 disabled={!newTagName.trim() || isCreating}
                 className="px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs focus:outline-none"
                 style={{ outline: 'none', boxShadow: 'none !important' }}
               >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>

          {/* Tags List */}
          <div className="p-1.5">
            {filteredTags.length === 0 ? (
              <div className="text-center text-xs py-3" style={{ color: '#9ca3af' }}>
                {searchQuery ? 'No tags found matching your search.' : 'No tags available.'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag._id);
                  return (
                     <button
                       key={tag._id}
                       type="button"
                       onClick={() => handleTagSelect(tag._id)}
                       className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left rounded-lg transition-colors focus:outline-none ${
                         isSelected 
                           ? 'bg-blue-100 dark:bg-blue-900 black:bg-blue-900 text-blue-900 dark:text-blue-100 black:text-blue-100' 
                           : 'hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333]'
                       }`}
                       style={{ outline: 'none', boxShadow: 'none !important' }}
                     >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: '#9ca3af' }}
                      />
                      <span className="text-xs" style={{ color: '#e5e5e5' }}>{tag.name}</span>
                      <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>({tag.noteCount})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Portal rendering - attached to body
        createPortal(
           <div
             ref={dropdownRef}
             style={{
               ...portalStyle,
               backgroundColor: '#282828', 
               borderColor: '#3a3a3a',
               borderWidth: '1px',
               borderStyle: 'solid',
               outline: 'none',
               boxShadow: 'none !important'
             }}
             className={`rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto w-[235px]`}
           >
            {/* Search Input */}
            <div className="p-2" style={{ borderBottom: '1px solid #3a3a3a' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg focus:outline-none text-xs"
                style={{
                  backgroundColor: '#2f2f2f',
                  color: '#e5e5e5',
                  border: '1px solid #3a3a3a'
                }}
                autoFocus
              />
            </div>

            {/* Create New Tag */}
            <div className="p-2" style={{ borderBottom: '1px solid #3a3a3a' }}>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Create new tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg focus:outline-none text-xs"
                  style={{
                    backgroundColor: '#2f2f2f',
                    color: '#e5e5e5',
                    border: '1px solid #3a3a3a'
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
                />
               <button
                 type="button"
                 onClick={handleCreateTag}
                 disabled={!newTagName.trim() || isCreating}
                 className="px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs focus:outline-none"
                 style={{ outline: 'none', boxShadow: 'none !important' }}
               >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            {/* Tags List */}
            <div className="p-1.5">
              {filteredTags.length === 0 ? (
                <div className="text-center text-xs py-3" style={{ color: '#9ca3af' }}>
                  {searchQuery ? 'No tags found matching your search.' : 'No tags available.'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag._id);
                    return (
                     <button
                       key={tag._id}
                       type="button"
                       onClick={() => handleTagSelect(tag._id)}
                       className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left rounded-lg transition-colors focus:outline-none ${
                         isSelected 
                           ? 'bg-blue-100 dark:bg-blue-900 black:bg-blue-900 text-blue-900 dark:text-blue-100 black:text-blue-100' 
                           : 'hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333]'
                       }`}
                       style={{ outline: 'none', boxShadow: 'none !important' }}
                     >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: '#9ca3af' }}
                        />
                        <span className="text-xs" style={{ color: '#e5e5e5' }}>{tag.name}</span>
                        <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>({tag.noteCount})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      ))}
    </div>
  );
}; 