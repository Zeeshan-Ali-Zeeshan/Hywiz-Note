import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Search, Plus, Edit2, Trash2 } from 'lucide-react';

interface Tag {
  _id: string;
  name: string;
  userId: string;
  noteCount: number;
  description: string;
  parentTag?: string;
  createdAt: string;
  updatedAt: string;
}

interface TagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  onAddTag: (tag: Partial<Tag>) => Promise<Tag>;
  onEditTag: (id: string, tag: Partial<Tag>) => Promise<Tag>;
  onDeleteTag: (id: string) => Promise<void>;
}

export const TagsModal: React.FC<TagsModalProps> = ({
  isOpen,
  onClose,
  tags,
  onAddTag,
  onEditTag,
  onDeleteTag
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter tags based on search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      await onAddTag({ name: newTagName.trim() });
      setNewTagName('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleEditTag = async () => {
    if (!editingTag || !editName.trim()) return;
    
    try {
      await onEditTag(editingTag._id, { name: editName.trim() });
      setEditingTag(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to edit tag:', error);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (window.confirm('Are you sure you want to delete this tag?')) {
      try {
        await onDeleteTag(tagId);
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  const startEditing = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditName('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Tags Modal - Appears next to main sidebar */}
      <div 
        ref={modalRef}
        className="fixed left-[252px] top-0 h-full bg-white w-[490px] shadow-xl overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
              <p className="text-xs text-gray-500">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search and Add */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Find tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Add Tag Form */}
          {showAddForm && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg mx-4">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTag}
                    disabled={!newTagName.trim()}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tags List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTags.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchQuery ? 'No tags found matching your search.' : 'No tags yet. Create your first tag!'}
            </div>
          ) : (
            <div className="p-4">
              {editingTag ? (
                // Edit Mode - Full width when editing
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditTag}
                      disabled={!editName.trim()}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode - Grid layout like the second image
                <div className="grid grid-cols-1 gap-3">
                  {filteredTags.map((tag) => (
                    <div key={tag._id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3 text-gray-400" />
                          <span className="font-medium text-gray-900 text-sm">{tag.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditing(tag)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag._id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{tag.noteCount} notes</span>
                        <Tag className="w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
                 </div>
       </div>
     </>
   );
 }; 