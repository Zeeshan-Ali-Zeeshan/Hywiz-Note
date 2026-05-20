import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Maximize2, FileText, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { TemplateEditorToolbar } from './EditorToolbar';
import { useTemplatesStore } from '../../stores/useTemplatesStore';
import { Template } from '../../stores/useTemplatesStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTagsStore } from '../../stores/useTagsStore';
import { TagSelect } from '../common/TagSelect';
import { TemplateShareButton } from './TemplateShareButton';
import { NoteMoreMenu } from '../notes/NoteMoreMenu';
import { MinimalTitleEditor } from '../notes/MinimalTitleEditor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import debounce from 'lodash.debounce';

// Comprehensive Yjs debugging utility (same as in NoteMoreMenu)
const debugYjsDocument = (ydoc: Y.Doc, label: string) => {
  console.log(`\n=== YJS DEBUG: ${label} ===`);
  console.log('📋 Document state:', {
    clientID: ydoc.clientID,
    hasContent: ydoc.share.size > 0,
    sharedTypes: Array.from(ydoc.share.keys())
  });
  
  // Check all shared types
  for (const [name, sharedType] of ydoc.share) {
    if (sharedType instanceof Y.Text) {
      const text = sharedType.toString();
      console.log(`📝 Y.Text "${name}": "${text}" (length: ${text.length})`);
    } else if (sharedType instanceof Y.XmlFragment) {
      const content = sharedType.toJSON ? sharedType.toJSON() : 'no toJSON available';
      console.log(`🔖 Y.XmlFragment "${name}":`, content);
      if (Array.isArray(content)) {
        console.log(`   └─ Length: ${content.length}, Type: ${typeof content}`);
      }
    } else if (sharedType instanceof Y.Map) {
      console.log(`🗺️ Y.Map "${name}":`, sharedType.toJSON());
    } else if (sharedType instanceof Y.Array) {
      console.log(`📊 Y.Array "${name}":`, sharedType.toJSON());
    }
  }
  
  // Specific prosemirror check
  try {
    const prosemirrorXml = ydoc.getXmlFragment('prosemirror');
    const prosemirrorContent = prosemirrorXml.toJSON ? prosemirrorXml.toJSON() : [];
    console.log('🎯 Prosemirror specific check:', {
      exists: !!prosemirrorXml,
      hasToJSON: typeof prosemirrorXml.toJSON === 'function',
      content: prosemirrorContent,
      contentType: typeof prosemirrorContent,
      isArray: Array.isArray(prosemirrorContent),
      length: Array.isArray(prosemirrorContent) ? prosemirrorContent.length : 'N/A'
    });
  } catch (e) {
    console.log('🎯 Prosemirror check failed:', e);
  }
  
  // Generate and analyze update
  const update = Y.encodeStateAsUpdate(ydoc);
  console.log('📦 Update info:', {
    updateSize: update.length,
    base64Length: btoa(String.fromCharCode(...update)).length,
    hasRealContent: update.length > 50 // Empty docs are usually ~30-50 bytes
  });
  
  console.log(`=== END YJS DEBUG: ${label} ===\n`);
};

interface TemplateEditorProps {
  templateId: string;
  onClose: () => void;
  readOnly?: boolean;
  templatesListCollapsed?: boolean;
  setTemplatesListCollapsed?: (collapsed: boolean) => void;
  shared?: boolean;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateId, onClose, readOnly = false, templatesListCollapsed, setTemplatesListCollapsed, shared }) => {
  const templatesStore = useTemplatesStore();
  const { openImportExportModal } = useUIStore();
  const { tags, fetchTags } = useTagsStore();
  const [template, setTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editor, setEditor] = useState<any>(null);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = typeof templatesListCollapsed === 'boolean' ? templatesListCollapsed : localCollapsed;
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [yjsReady, setYjsReady] = useState(false);
  const [yTitle, setYTitle] = useState<Y.Text | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const tagsButtonRef = useRef<HTMLButtonElement>(null);

  // Add session management like NoteEditor
  const sessionIdRef = useRef(0);
  useEffect(() => {
    sessionIdRef.current += 1;
  }, [templateId]);

  // Add a ref to track the latest active templateId
  const activeTemplateIdRef = useRef(templateId);
  useEffect(() => {
    activeTemplateIdRef.current = templateId;
  }, [templateId]);

  // Add a ref to track if we're initializing the Yjs title from the DB
  const initializingTitleRef = useRef(true);
  // Add a ref to track the last initialized templateId
  const lastInitializedTemplateIdRef = useRef<string | null>(null);
  const initialTitleSetRef = useRef(false);

  // Fetch template data and tags
  useEffect(() => {
    console.log('[YJS DEBUG] Template loading effect running for templateId:', templateId);
    if (!templateId) return;
    const loadTemplate = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await templatesStore.fetchTemplate(templateId);
        setTemplate(data);
        setTitle(data.title || '');
        // Set selected tags from template
        if (data.tags && Array.isArray(data.tags)) {
          const tagIds = data.tags.map(tag => typeof tag === 'string' ? tag : tag._id);
          setSelectedTags(tagIds);
        }
      } catch (error) {
        setError('Failed to load template. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
    fetchTags();
  }, [templateId, fetchTags]);

  // --- Create Yjs doc/provider as soon as templateId is available ---
  useEffect(() => {
    console.log('[YJS DEBUG] YDoc creation effect running for templateId:', templateId);
    if (!templateId) return;
    
    const ydocInstance = new Y.Doc();
    const providerInstance = new WebsocketProvider('ws://localhost:3001', `template-${templateId}`, ydocInstance);
    setYdoc(ydocInstance);
    setProvider(providerInstance);
    
    return () => {
      console.log('[YJS DEBUG] Cleaning up YDoc for template:', templateId);
      providerInstance.destroy();
      ydocInstance.destroy();
      setYdoc(null);
      setProvider(null);
    };
  }, [templateId]);

  // Reset state when templateId changes
  useEffect(() => {
    console.log('[YJS DEBUG] State reset effect running for templateId:', templateId);
    initialTitleSetRef.current = false;
    setYjsReady(false);
    setYTitle(null);
    setEditor(null);
    lastInitializedTemplateIdRef.current = null;
  }, [templateId]);

  // Apply Yjs update when template data is available
  useEffect(() => {
    if (!template || !ydoc) return;
    
    // SYSTEMATIC ANALYSIS: Template loading process
    if ('yjsUpdate' in template && typeof template.yjsUpdate === 'string' && template.yjsUpdate) {
      try {
        console.log('\n🔍 TEMPLATE LOAD ANALYSIS START');
        console.log('1️⃣ Template Data Analysis:', {
          templateId: template._id,
          hasYjsUpdate: !!template.yjsUpdate,
          yjsUpdateLength: template.yjsUpdate.length,
          yjsUpdatePreview: template.yjsUpdate.substring(0, 100) + '...',
          templateTitle: template.title
        });
        
        console.log('2️⃣ Before Loading - Empty Ydoc:');
        debugYjsDocument(ydoc, 'TEMPLATE YDOC BEFORE LOAD');
        
        // Decode and apply the update
        const update = Uint8Array.from(atob(template.yjsUpdate || ''), c => c.charCodeAt(0));
        console.log('3️⃣ Decoded Update:', {
          updateLength: update.length,
          firstBytes: Array.from(update.slice(0, 10)),
          lastBytes: Array.from(update.slice(-10))
        });
        
        Y.applyUpdate(ydoc, update);
        console.log('4️⃣ After Loading - Populated Ydoc:');
        debugYjsDocument(ydoc, 'TEMPLATE YDOC AFTER LOAD');
        
        // Check if editor will see this content
        setTimeout(() => {
          console.log('5️⃣ Editor State Check (after 1 second):');
          if (editor) {
            console.log('Editor Analysis:', {
              hasEditor: !!editor,
              editorHTML: editor.getHTML ? editor.getHTML() : 'No getHTML',
              editorJSON: editor.getJSON ? editor.getJSON() : 'No getJSON',
              editorIsEmpty: typeof editor.isEmpty === 'function' ? editor.isEmpty() : 'No isEmpty method'
            });
          } else {
            console.log('❌ No editor available for content check');
          }
          console.log('🔍 TEMPLATE LOAD ANALYSIS END\n');
        }, 1000);
        
      } catch (e) {
        console.error('❌ TEMPLATE LOAD ERROR:', e);
      }
    } else if ('fallbackContent' in template && typeof template.fallbackContent === 'string' && template.fallbackContent) {
      // If no Yjs update, initialize editor with fallbackContent (HTML)
      console.log('[YJS DEBUG] Loading template from fallbackContent:', template.fallbackContent);
      
      // Wait a bit for the editor to be ready, then set content
      setTimeout(() => {
        if (editor && editor.commands) {
          editor.commands.setContent(template.fallbackContent);
          console.log('[YJS DEBUG] Set template content from fallbackContent');
        }
      }, 100);
    }
  }, [template, ydoc, editor]);

  // TITLE-ONLY: Initialize local title state when template loads
  useEffect(() => {
    if (!template) return;
    const initialTitle = template.title || 'Untitled';
    setTitle(initialTitle);
  }, [template]);

  // Debounced function to update Yjs title
  const debouncedUpdateYTitle = useRef(
    debounce((yTitle: Y.Text | null, value: string) => {
      if (yTitle) {
        yTitle.delete(0, yTitle.length);
        yTitle.insert(0, value);
      }
    }, 200)
  ).current;

  // --- Attach Yjs observers for title/content when editorInstance, ydoc, and provider are ready ---
  useEffect(() => {
    console.log('[YJS DEBUG] Observer setup effect running:', { templateId, hasEditor: !!editor, hasYdoc: !!ydoc, hasProvider: !!provider });
    if (!templateId || !editor || !ydoc || !provider) return;
    
    // Prevent multiple setups for the same template
    if (lastInitializedTemplateIdRef.current === templateId) {
      console.log('[YJS DEBUG] Observers already set up for template:', templateId);
      return;
    }
    
    console.log('[YJS DEBUG] Setting up observers for template:', templateId);
    lastInitializedTemplateIdRef.current = templateId;
    const currentSessionId = sessionIdRef.current;
    // Don't create a conflicting title fragment - let MinimalTitleEditor handle it
    setTitle(template?.title || '');

    // --- Title observer removed - MinimalTitleEditor handles its own title fragment ---

    // --- Content observer ---
    const yXml = ydoc.getXmlFragment('prosemirror');
    const updateContent = () => {
      if (sessionIdRef.current !== currentSessionId) return;
      if (!yjsReady) return;
      if (templateId !== activeTemplateIdRef.current) return;
      if (editor && typeof editor.getHTML === 'function') {
        const html = editor.getHTML();
        // Debounce content saves (2s after last keystroke)
        if (templateEditorDebounceTimeoutRef.current) {
          clearTimeout(templateEditorDebounceTimeoutRef.current);
        }
        templateEditorDebounceTimeoutRef.current = setTimeout(() => {
          // Save canonical Yjs update instead of content
          saveCanonicalYjsUpdate();
        }, 2000); // 2s debounce
      }
    };
    yXml.observeDeep(updateContent);

    // Set Yjs ready after initial content/title is set
    setTimeout(() => setYjsReady(true), 200);

    return () => {
      yXml.unobserveDeep(updateContent);
      if (templateEditorDebounceTimeoutRef.current) {
        clearTimeout(templateEditorDebounceTimeoutRef.current);
      }
    };
  }, [templateId, editor, ydoc, provider]);

  // TITLE-ONLY: Title is now handled by MinimalTitleEditor with its own Yjs fragment

  // Add debounce timeout ref
  const templateEditorDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to save canonical YJS update
  const saveCanonicalYjsUpdate = useCallback(async () => {
    if (!ydoc || !templateId) return;
    try {
      const update = Y.encodeStateAsUpdate(ydoc);
      const base64 = btoa(String.fromCharCode(...update));
      await templatesStore.updateTemplateYjsUpdate(templateId, base64);
      console.log('[YJS DEBUG] Canonical Yjs update saved for template:', templateId);
    } catch (e) {
      console.error('[YJS ERROR] Failed to save canonical Yjs update for template:', e);
    }
  }, [ydoc, templateId, templatesStore]);

  // Periodic save of canonical YJS update
  useEffect(() => {
    if (!ydoc || !templateId || !yjsReady) return;
    
    const interval = setInterval(() => {
      saveCanonicalYjsUpdate();
    }, 30000); // Save every 30 seconds
    
    return () => clearInterval(interval);
  }, [ydoc, templateId, yjsReady, saveCanonicalYjsUpdate]);

  // Save on page unload
  useEffect(() => {
    if (!ydoc || !templateId || !yjsReady) return;
    
    const handleBeforeUnload = () => {
      saveCanonicalYjsUpdate();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [ydoc, templateId, yjsReady, saveCanonicalYjsUpdate]);


  const handleTagsChange = async (tagIds: string[]) => {
    setSelectedTags(tagIds);
    if (templateId && template) {
      try {
        await templatesStore.updateTemplate(templateId, { tags: tagIds });
        setTemplate(prev => prev ? { ...prev, tags: tagIds } : null);
      } catch (error) {
        console.error('Failed to update template tags:', error);
      }
    }
  };

  const handleCollapseToggle = () => {
    if (typeof setTemplatesListCollapsed === 'function') {
      setTemplatesListCollapsed(!isCollapsed);
    } else {
      setLocalCollapsed(v => !v);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      console.log('[YJS DEBUG] TemplateEditor unmounting, cleaning up all resources');
      if (templateEditorDebounceTimeoutRef.current) {
        clearTimeout(templateEditorDebounceTimeoutRef.current);
      }
      if (debouncedUpdateYTitle) {
        debouncedUpdateYTitle.cancel();
      }
      // Clean up YDoc and provider
      if (provider) {
        provider.destroy();
      }
      if (ydoc) {
        ydoc.destroy();
      }
    };
  }, [provider, ydoc]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  // Only render editor if fallbackContent is available and ydoc/provider are ready
  if (!ydoc || !provider) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-900">Loading template editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isFullScreen ? "fixed inset-0 z-50 bg-white flex flex-col min-w-0 w-full overflow-hidden" : "flex-1 flex flex-col bg-white h-full min-w-0 w-full overflow-hidden" + (isCollapsed ? " w-full" : "")}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white min-w-0 w-full overflow-x-visible">
        <div className="flex items-center gap-4">
          {/* Collapse/Expand Button */}
          {!shared && (
            <button
              onClick={handleCollapseToggle}
              className="p-1 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label={isCollapsed ? 'Show preview' : 'Hide preview'}
            >
              {isCollapsed ? <ChevronRight size={20} color="#6b7280" /> : <ChevronLeft size={20} color="#6b7280" />}
            </button>
          )}
          <button
            onClick={() => setIsFullScreen(f => !f)}
            className="text-gray-600 bg-gray-100 hover:bg-gray-200 p-1 rounded-md"
            aria-label="Expand item"
            disabled={readOnly}
          >
            <Maximize2 size={20} />
          </button>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-300" />
            {readOnly ? (
              <span className="text-gray-900 text-lg font-semibold bg-transparent border-none outline-none cursor-default" style={{ textDecoration: 'none' }}>{title || "Untitled"}</span>
            ) : (
              <div className="flex-1 min-w-0">
                <MinimalTitleEditor
                  ydoc={ydoc}
                  provider={provider}
                  initialTitle={title || ''}
                  readOnly={readOnly}
                  onTitleChange={newTitle => {
                    // Update the local title state
                    setTitle(newTitle);
                    // Update Yjs title fragment
                    if (ydoc) {
                      try {
                        const yTitle = ydoc.getText('title');
                        if (yTitle) {
                          yTitle.delete(0, yTitle.length);
                          yTitle.insert(0, newTitle);
                        }
                      } catch (error) {
                        console.warn('Failed to update Yjs title:', error);
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
          

        </div>
        <div className="flex items-center">
          {!readOnly && <TemplateShareButton templateId={templateId} />}
          {!readOnly && <NoteMoreMenu noteId={templateId} noteTitle={title} setShareDropdownOpen={() => {}} isTemplate={true} editor={editor} onToggleCollapse={handleCollapseToggle} onOpenTagsDropdown={() => setIsTagsDropdownOpen(true)} />}
        </div>
      </div>
      {/* Fixed toolbar */}
      {!readOnly && (
        <div className="bg-white border-b border-gray-200 min-w-0 w-full overflow-x-visible">
          <TemplateEditorToolbar editor={editor} />
        </div>
      )}
      {/* Fixed title field */}
      {!readOnly && (
        <div className="bg-white px-4 text-2xl font-semibold h-10 border-b border-gray-200 flex items-center">
          <div className="w-full">
            <MinimalTitleEditor
              ydoc={ydoc}
              provider={provider}
              initialTitle={title || ''}
              readOnly={readOnly}
              onTitleChange={newTitle => {
                console.log('Template title changed:', newTitle);
                // Update the local title state
                setTitle(newTitle);
                // Update the template in the backend
                if (templateId) {
                  templatesStore.updateTemplate(templateId, { title: newTitle });
                }
              }}
            />
          </div>
        </div>
      )}
      {readOnly && (
        <div className="bg-white border-b border-gray-200">
          <input
            type="text"
            value={title || ''}
            readOnly
            disabled
            placeholder="Template Title"
            className="overflow-hidden w-full text-3xl font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:outline-none focus:border-none focus:ring-0 focus:ring-transparent cursor-default px-6 py-4"
            style={{ letterSpacing: '-0.02em' }}
          />
        </div>
      )}
      {/* Scrollable text editor area only */}
      <div className="flex-1 overflow-y-auto min-w-0 w-full scrollbar-hide">
        <RichTextEditor
          noteId={templateId}
          readOnly={readOnly}
          hideToolbar={true}
          onEditorReady={setEditor}
          ydoc={ydoc!}
          provider={provider!}
          yjsUpdate={template?.yjsUpdate}
          isTemplate={true}
        />
      </div>
      {/* Footer with Add Tag button */}
      {!readOnly && (
        <div className="editor-footer flex items-center gap-4 p-3 border-t border-gray-200 bg-white min-w-0 w-full" style={{height: 40}}>
          {/* Add Tag Button with anchored dropdown */}
          <div className="relative">
            <button
              ref={tagsButtonRef}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 focus:outline-none group relative"
              onClick={() => setIsTagsDropdownOpen(v => !v)}
              type="button"
              aria-label="Add tag"
            >
              <span className="relative inline-block">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M20.59 13.41a2 2 0 0 0 0-2.82l-7.18-7.18a2 2 0 0 0-2.82 0l-5.18 5.18a2 2 0 0 0 0 2.82l7.18 7.18a2 2 0 0 0 2.82 0l5.18-5.18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
                </svg>
                <svg width="10" height="10" viewBox="0 0 10 10" className="absolute -bottom-1 -right-1" fill="none">
                  <circle cx="5" cy="5" r="5" fill="#ffffff"/>
                  <path d="M5 2v6M2 5h6" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="ml-2 text-gray-600 group-hover:text-gray-800 text-xs">Add tag</span>
            </button>
            {isTagsDropdownOpen && (
              <div className="absolute left-0 z-50" style={{ top: 'auto', bottom: '100%', marginBottom: 8 }}>
                <TagSelect
                  renderSelected={false}
                  selectedTags={selectedTags}
                  onChange={(ids) => { setSelectedTags(ids); handleTagsChange(ids); }}
                  open={isTagsDropdownOpen}
                  onOpenChange={setIsTagsDropdownOpen}
                  anchorRef={tagsButtonRef}
                  placement="up"
                  usePortal={true}
                />
              </div>
            )}
          </div>

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {selectedTags.slice(0, 3).map((tagId) => {
                  const tag = tags.find(t => t._id === tagId);
                  return tag ? (
                    <span
                      key={tag._id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full bg-gray-400"
                      />
                      {tag.name}
                    </span>
                  ) : null;
                })}
                {selectedTags.length > 3 && (
                  <span className="text-xs text-gray-500">+{selectedTags.length - 3}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Removed popup pane; using anchored dropdown instead */}
    </div>
  );
}; 