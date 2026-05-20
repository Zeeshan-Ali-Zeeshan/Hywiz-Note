import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Star, Trash2 } from 'lucide-react';
import { TemplateEditor } from '../components/editor/TemplateEditor';
import { useTemplatesStore } from '../stores/useTemplatesStore';
import { useToastStore } from '../stores/useToastStore';

const Templates: React.FC = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ templateId: string; templateName: string } | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Pixel-based resizing state
  const [templatesListWidth, setTemplatesListWidth] = useState(320); // optimized for 1920px screens
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [templatesListCollapsed, setTemplatesListCollapsed] = useState(false);

  const {
    templates,
    loading,
    error,
    fetchTemplates,
    setFilters,
    clearError,
    deleteTemplate
  } = useTemplatesStore();

  const { showToast } = useToastStore();

  // Fetch templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filter templates based on search only (ownership is handled by backend)
  const filteredTemplates = templates.filter((template) =>
    template.title.toLowerCase().includes(search.toLowerCase()) ||
    template.description.toLowerCase().includes(search.toLowerCase()) ||
    template.category.toLowerCase().includes(search.toLowerCase())
  );

  // Sync selected template with URL param on load and when params/templates change
  useEffect(() => {
    const fromParam = searchParams.get('template');
    if (fromParam && fromParam !== selectedTemplateId) {
      setSelectedTemplateId(fromParam);
    }
  }, [searchParams, templates]);

  // Default to first filtered template when none selected
  useEffect(() => {
    if (!selectedTemplateId && filteredTemplates.length > 0) {
      setSelectedTemplateId(filteredTemplates[0]._id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId) || filteredTemplates[0];

  // Update search filter
  useEffect(() => {
    setFilters({ search });
  }, [search, setFilters]);

  // Drag logic for resizing
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;
      newWidth = Math.max(150, Math.min(containerRect.width - 150, newWidth));
      setTemplatesListWidth(newWidth);
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

  const handleCloseEditor = () => {
    setSelectedTemplateId(null);
    // remove query param
    const next = new URLSearchParams(searchParams);
    next.delete('template');
    setSearchParams(next);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    // reflect in URL
    const next = new URLSearchParams(searchParams);
    next.set('template', templateId);
    setSearchParams(next);
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection when clicking delete
    
    const template = templates.find(t => t._id === templateId);
    if (!template) return;
    
    // Show confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${template.title}"? This action cannot be undone.`)) {
      try {
        await deleteTemplate(templateId);
        showToast('Template deleted successfully', 'success');
        
        // If the deleted template was selected, clear the selection
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId(null);
        }
        
        // Refresh templates
        await fetchTemplates();
      } catch (error) {
        console.error('Failed to delete template:', error);
        showToast('Failed to delete template', 'error');
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 min-h-0 max-w-[1920px] mx-auto w-full">
      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0 h-full"
        ref={containerRef}
      >
        {/* Templates List Panel */}
        {!templatesListCollapsed && (
          <div
            className="flex flex-col bg-white transition-all duration-75 lg:flex border-r border-gray-200 z-20 flex-shrink-0"
            style={{
              width: templatesListWidth,
              minWidth: 150,
              maxWidth: '80vw',
              height: '100%',
              position: 'relative',
            }}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white z-10" style={{ position: 'relative' }}>
              <h2 className="text-xs font-semibold text-gray-900 dark:text-white black:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Templates
              </h2>
              <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <div className="relative" style={{ width: '100%', minWidth: 0 }}>
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search templates"
                    title=""
                    className="pl-7 pr-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-700 black:bg-gray-900 text-gray-900 dark:text-gray-100 black:text-gray-100 border border-gray-300 dark:border-gray-600 black:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Error Display */}
            {error && (
              <div className="px-3 py-2 bg-red-600 text-white text-xs">
                {error}
                <button 
                  onClick={clearError}
                  className="ml-2 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            {/* Templates List */}
            <div className="flex-1 overflow-y-auto bg-white">
              {loading ? (
                <div className="p-4 text-gray-500 text-xs">Loading templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-4 text-gray-500 text-xs">
                  {search ? 'No templates found matching your search.' : 'No templates available.'}
                </div>
              ) : (
                <ul className="p-1.5 space-y-1.5">
                  {filteredTemplates.map((template) => {
                    const isActive = selectedTemplateId === template._id;
                    return (
                      <li
                        key={template._id}
                        className={`group relative p-2.5 rounded-md cursor-pointer transition-all duration-300 border bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 hover:backdrop-blur-sm shadow-sm text-gray-700 dark:text-gray-300 black:text-gray-300 border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 ${
                          isActive ? 'ring-1 ring-offset-1 ring-blue-500/40 dark:ring-blue-400/40 black:ring-blue-400/40' : ''
                        }`}
                        onClick={() => handleTemplateSelect(template._id)}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shadow-sm transition-all duration-300 bg-gray-100 dark:bg-gray-700 black:bg-[#333333]`}>
                            <div className={`text-violet-600 dark:text-violet-400 black:text-violet-400`}>
                              <BookOpen className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <h3 className="text-sm font-medium truncate max-w-[180px]">{template.title}</h3>
                              {template.isPinned && (
                                <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400 truncate mt-0.5">
                              {template.description}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="text-xs text-violet-600 dark:text-violet-400 black:text-violet-400">
                                Template
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                                {template.category}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                                {template.isPublic ? 'Public' : 'Private'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Delete button - positioned at top right */}
                        <button
                          onClick={(e) => handleDeleteTemplate(template._id, e)}
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 black:text-gray-500 black:hover:text-red-400"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Glassy effect overlay - hover or active */}
                        <div className={`absolute inset-0 rounded-md pointer-events-none transition-opacity duration-200 ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-md" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
        
        {/* Draggable Divider - Always visible on large screens */}
        {!templatesListCollapsed && (
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
            onDoubleClick={() => setTemplatesListWidth(320)}
          >
            {/* Visual indicator: always visible */}
            <div
              className="absolute inset-y-0 left-1/2 transform -translate-x-1/2"
              style={{
                width: 2,
                background: '#fff',
                borderRadius: 1,
                height: '100%',
                opacity: 0.7,
              }}
            />
            {/* Larger hit area for easier clicking */}
            <div
              className="absolute inset-0 bg-white"
              style={{ cursor: 'col-resize' }}
            />
          </div>
        )}
        
        {/* Template Preview Panel using TemplateEditor */}
        {selectedTemplate ? (
          <div className="flex-1 bg-gray-50 min-w-0 overflow-x-hidden">
            <TemplateEditor
              key={selectedTemplate._id} // Force remount when template changes
              templateId={selectedTemplate._id}
              onClose={handleCloseEditor}
              templatesListCollapsed={templatesListCollapsed}
              setTemplatesListCollapsed={setTemplatesListCollapsed}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 min-w-0 overflow-x-hidden">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white black:text-white mb-2">Select a template to view</h3>
              <p className="text-gray-500">Choose a template from the list to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Templates; 