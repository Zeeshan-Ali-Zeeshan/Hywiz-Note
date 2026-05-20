import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Undo,
  Redo,
  Quote,
  Minus,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Link,
  Image,
  Table,
  CheckSquare,
  Square,
  ChevronDown,
  Plus,
  Paintbrush,
  Underline,
  List,
  ListOrdered,
} from 'lucide-react';
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '../../stores/useNotesStore';
import { showToast } from '../../lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
  noteId?: string;
  note?: {
    title: string;
  };
  onOpenLinkModal?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, noteId, note, onOpenLinkModal }) => {
  // All hooks at the top
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number | null>(null); // Store cursor position for image insertion
  const { uploadAttachment, fetchNotes } = useNotesStore();
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState<any>(null);
  const [highlightHovered] = useState(false);
  const [moreHovered] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const [highlightTimeout] = useState<NodeJS.Timeout | null>(null);
  const highlightDropdownRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  console.log('[TOOLBAR DEBUG] EditorToolbar rendered with noteId:', noteId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const isOutsideAllDropdowns = !target.closest('.dropdown-container');
      if (isOutsideAllDropdowns) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Override focus effects for toolbar buttons
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .editor-toolbar button:focus {
        outline: none !important;
        box-shadow: none !important;
      }
      .editor-toolbar button:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  useEffect(() => {
    if (activeDropdown === 'more' || activeDropdown === 'highlight') {
      if (!moreHovered && !highlightHovered) {
        setActiveDropdown(null);
      }
    }
  }, [moreHovered, highlightHovered]);
  useEffect(() => {
    if (activeDropdown === 'more' && highlightHovered) {
      setActiveDropdown('highlight');
    }
    if (activeDropdown === 'highlight' && !highlightHovered) {
      const timeout = setTimeout(() => {
        setActiveDropdown('more');
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [highlightHovered]);
  useEffect(() => {
    return () => {
      if (highlightTimeout !== null) {
        clearTimeout(highlightTimeout);
      }
    };
  }, [highlightTimeout]);
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentTextColor, setCurrentTextColor] = useState<string>('#111827');

  // Function to get theme-aware text color
  const getThemeTextColor = () => {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'black' ? '#ffffff' : '#111827';
  };

  // Update current text color when editor state changes
  useEffect(() => {
    if (!editor) return;
    
    const updateTextColor = () => {
      const editorColor = editor.getAttributes('textStyle').color;
      setCurrentTextColor(editorColor || getThemeTextColor());
    };

    // Update initially
    updateTextColor();

    // Listen for editor updates
    const handleTransaction = () => {
      updateTextColor();
    };

    editor.on('transaction', handleTransaction);

    // Listen for theme changes
    const handleThemeChange = () => {
      updateTextColor();
    };

    // Observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => {
      editor.off('transaction', handleTransaction);
      observer.disconnect();
    };
  }, [editor]);
  
  // Only after all hooks, check for editor
  if (!editor) {
    return <div className="editor-toolbar" />;
  }

  // Utilities to improve color swatch visibility without changing the chosen color
  const parseColorToRgb = (input: string): { r: number; g: number; b: number } | null => {
    if (!input) return null;
    const s = input.trim();
    // hex #rgb or #rrggbb
    if (s[0] === '#') {
      const hex = s.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b };
      }
      return null;
    }
    // rgb/rgba
    const rgbMatch = s.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(p => parseFloat(p.trim()));
      if (parts.length >= 3) {
        return { r: parts[0], g: parts[1], b: parts[2] };
      }
    }
    return null;
  };

  const getLuminance = (r: number, g: number, b: number) => {
    const srgb = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };

  // currentTextColor is now managed by useState and useEffect above
  const rgb = parseColorToRgb(currentTextColor);
  const luminance = rgb ? getLuminance(rgb.r, rgb.g, rgb.b) : 0.2;
  // If the fill is very light, use dark inner stroke; if dark, use white inner stroke
  const innerStroke = luminance > 0.7 ? '#111827' : '#ffffff';
  const outerStroke = luminance > 0.7 ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.45)';

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[IMAGE UPLOAD DEBUG] handleImageUpload triggered');
    
    const file = e.target.files?.[0];
    
    if (!file) {
      console.log('[IMAGE UPLOAD DEBUG] ✗ No file selected');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      console.log('[IMAGE UPLOAD DEBUG] ✗ File is not an image');
      showToast('Please select an image file', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // CRITICAL: Never use blob URLs - they break after restarts
    // Always require server upload for persistence
    
    if (!noteId) {
      console.error('[IMAGE UPLOAD DEBUG] ✗ No noteId - cannot upload image');
      showToast('Note not loaded yet. Please wait and try again.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Retry logic for upload failures
    const maxRetries = 3;
    let retryCount = 0;
    let attachment = null;
    
    while (retryCount < maxRetries && !attachment) {
      try {
        console.log(`[IMAGE UPLOAD DEBUG] Upload attempt ${retryCount + 1}/${maxRetries}`);
        console.log('[IMAGE UPLOAD DEBUG] Calling uploadAttachment with:', {
          noteId: noteId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        attachment = await uploadAttachment(noteId, file);
        
        if (attachment && attachment.url) {
          console.log('[IMAGE UPLOAD DEBUG] ✓ Upload successful!');
          console.log('[IMAGE UPLOAD DEBUG] Attachment URL:', attachment.url);
          break; // Success, exit retry loop
        } else {
          throw new Error('Upload succeeded but no URL returned');
        }
      } catch (err: any) {
        retryCount++;
        console.error(`[IMAGE UPLOAD DEBUG] ✗ Upload attempt ${retryCount} failed:`, err);
        
        if (retryCount >= maxRetries) {
          // All retries exhausted
          const errorMsg = err?.response?.data?.message || err?.message || 'Failed to upload image';
          console.error('[IMAGE UPLOAD DEBUG] ✗✗✗ All upload attempts failed');
          showToast(`Image upload failed: ${errorMsg}. Please try again.`, 'error');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return; // Don't insert anything - no blob URL fallback
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.log(`[IMAGE UPLOAD DEBUG] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Validate we have a server URL (never use blob URLs)
    if (!attachment || !attachment.url) {
      console.error('[IMAGE UPLOAD DEBUG] ✗✗✗ No valid server URL - cannot insert image');
      showToast('Image upload failed. Please try again.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Validate URL is not a blob URL (safety check)
    if (attachment.url.startsWith('blob:')) {
      console.error('[IMAGE UPLOAD DEBUG] ✗✗✗ Server returned blob URL - this should never happen!');
      showToast('Invalid image URL. Please try again.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Build server URL
    const serverUrl = attachment.url.startsWith('http') 
      ? attachment.url 
      : `http://localhost:3001${attachment.url}`;
    
    console.log('[IMAGE UPLOAD DEBUG] ✓ Server URL validated:', serverUrl);
    console.log('[IMAGE UPLOAD DEBUG] Inserting image into editor...');
    
    // Insert image at saved cursor position or current position
    const imageNode = {
      type: 'image',
      attrs: {
        src: serverUrl,
        alt: file.name || '',
      }
    };
    
    try {
      // If we have a saved cursor position, restore it first
      if (cursorPositionRef.current !== null) {
        const savedPos = cursorPositionRef.current;
        cursorPositionRef.current = null; // Clear after use
        console.log('[IMAGE UPLOAD DEBUG] Restoring cursor to saved position:', savedPos);
        
        // Wait a bit for editor to be ready, then insert
        setTimeout(() => {
          editor.chain()
            .setTextSelection(savedPos)
            .focus()
            .insertContent(imageNode)
            .run();
        }, 50);
      } else {
        // Use current cursor position
        console.log('[IMAGE UPLOAD DEBUG] Using current cursor position:', editor.state.selection.from);
        editor.chain()
          .focus()
          .insertContent(imageNode)
          .run();
      }
      
      console.log('[IMAGE UPLOAD DEBUG] ✓✓✓ Image inserted successfully with server URL');
      showToast('Image uploaded successfully', 'success');
      
      // Optionally refresh notes in background
      Promise.resolve(fetchNotes()).catch(() => {});
    } catch (insertError) {
      console.error('[IMAGE UPLOAD DEBUG] ✗ Failed to insert image:', insertError);
      showToast('Failed to insert image. Please try again.', 'error');
    }
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
    console.log('[IMAGE UPLOAD DEBUG] Input reset complete');
    console.log('═══════════════════════════════════════════════════════');
  };

  // Open modal and fetch notes if needed
  const openLinkModal = () => {
    if (onOpenLinkModal) {
      onOpenLinkModal();
    }
    // Fetch in background; do not block modal on errors
    Promise.resolve(fetchNotes()).catch(() => {});
  };

  // Helper to append a paragraph at the end if the last node is not a paragraph
  const appendParagraphIfNeeded = (editor: Editor) => {
    const { doc } = editor.state;
    const lastNode = doc.lastChild;
    if (!lastNode || lastNode.type.name !== 'paragraph' || lastNode.content.size !== 0) {
      // Insert an empty paragraph at the end
      editor.commands.insertContentAt(doc.content.size, { type: 'paragraph' });
    }
  };

  return (
          <div className="editor-toolbar flex items-center justify-start gap-1 p-1 bg-white border-b border-gray-200 relative">
      {/* Main Toolbar Bar */}
      <div className="flex items-center gap-1 px-1 py-0.5">
        {/* Insert Button with Dropdown */}
        <div className="relative dropdown-container">
          <button
            type="button"
            className="flex items-center gap-1 px-1 py-0.5 rounded-full bg-white hover:bg-gray-100 focus:outline-none"
            style={{ minWidth: 0, boxShadow: 'none !important' }}
            onClick={() => toggleDropdown('insert')}
          >
            <span className="flex items-center justify-center w-3 h-3 rounded-full bg-[#818cf8]">
              <Plus className="w-2 h-2 text-black" />
            </span>
            <span className="text-gray-900 font-semibold text-xs" style={{ lineHeight: 1 }}>Insert</span>
            <ChevronDown className="w-2 h-2 text-gray-700" />
          </button>
          {activeDropdown === 'insert' && (
            <div
              className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 flex flex-col gap-1"
              style={{
                minWidth: window.innerWidth >= 1920 ? '160px' : '140px',
                maxWidth: window.innerWidth >= 1920 ? '180px' : '160px'
              }}
              onMouseEnter={() => setActiveDropdown('insert')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  appendParagraphIfNeeded(editor);
                  closeDropdown();
                }}
              >
                <Table className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} />
                Insert Table
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
                onClick={() => {
                  // Store cursor position before opening file dialog
                  if (editor) {
                    cursorPositionRef.current = editor.state.selection.from;
                  }
                  fileInputRef.current?.click();
                  closeDropdown();
                }}
              >
                <Image className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} />
                Insert Image
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
                onClick={() => {
                  openLinkModal();
                  closeDropdown();
                }}
              >
                <Link className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} />
                Insert Note Link
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
                onClick={() => {
                  openLinkModal();
                  closeDropdown();
                }}
              >
                <Link className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} />
                Insert Link
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
                onClick={() => {
                  editor.chain().focus().toggleTaskList().run();
                  closeDropdown();
                }}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Task
              </button>
              

            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Font Size Dropdown */}
        <div className="relative inline-block dropdown-container ml-1">
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
            onClick={() => toggleDropdown('fontSize')}
          >
            <span className="text-gray-900 font-medium text-xs">
              {editor.getAttributes('textStyle').fontSize
                ? editor.getAttributes('textStyle').fontSize.replace('px', '')
                : 'Font Size'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-700" />
          </button>
          {activeDropdown === 'fontSize' && (
            <div
              className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 min-w-[80px] flex flex-col gap-1"
              onMouseEnter={() => setActiveDropdown('fontSize')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              {[12, 14, 16, 18, 24, 32].map(size => (
                <button
                  key={size}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.getAttributes('textStyle').fontSize === `${size}px` ? 'text-[#6366f1]' : ''}`}
                  onClick={() => {
                    (editor.chain().focus() as any).setFontSize(`${size}px`).run();
                    setActiveDropdown(null);
                  }}
                >
                  {size}
                </button>
              ))}
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${!editor.getAttributes('textStyle').fontSize ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  (editor.chain().focus() as any).unsetFontSize().run();
                  setActiveDropdown(null);
                }}
              >
                Default
              </button>
            </div>
          )}
        </div>
        {/* Text Color Palette */}
        <div className="relative inline-block dropdown-container ml-1">
          <button
            ref={colorBtnRef}
            type="button"
            onClick={() => toggleDropdown('color')}
            className="flex items-center justify-center w-6 h-6 p-0 bg-transparent"
            title="Text Color"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="22" height="22" fill="none" viewBox="0 0 24 24" style={{ color: 'rgb(115, 115, 115)' }}><path fill="url(#pattern0_12129_209028)" d="M2 2h20v20H2z"></path><circle cx="12" cy="12" r="5.833" fill={currentTextColor}></circle><defs><pattern id="pattern0_12129_209028" width="1" height="1" patternContentUnits="objectBoundingBox"><use xlinkHref="#image0_12129_209028" transform="scale(.01667)"></use></pattern><image xlinkHref="data:image/png;base64,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" id="image0_12129_209028" width="60" height="60" preserveAspectRatio="none"></image></defs></svg>
                </span>
              <ChevronDown className="w-3 h-3 ml-1 text-gray-700 dark:text-gray-300" />
              </span>
            </button>
            {activeDropdown === 'color' && (
                              <div
                  ref={colorDropdownRef}
                  className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1.5 rounded shadow-xl border border-gray-200"
                  style={{ minWidth: 180 }}
                  onMouseEnter={() => setActiveDropdown('color')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  {/* Auto button */}
                  <button
                    onClick={() => {
                      editor.chain().focus().setColor('').run();
                      closeDropdown();
                    }}
                    className="flex items-center gap-1 w-full px-1.5 py-1 rounded border border-gray-300 mb-1 focus:outline-none bg-white text-xs"
                  >
                    <span className="w-4 h-4 rounded-full border border-[#888] flex items-center justify-center bg-gradient-to-br from-[#fff] to-[#eee] relative">
                      <span style={{ position: 'absolute', width: '100%', height: 2, background: '#888', transform: 'rotate(-45deg)', top: '50%', left: 0, marginTop: -1 }} />
                    </span>
                    <span>Auto</span>
                  </button>
                  {/* Color swatches grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {[
                      '#8a8a8a', '#666666', '#404040', '#1a1a1a', '#000000', '#8a4fd9', '#b33fd9',
                      '#d63030', '#d67330', '#d9b833', '#40d973', '#33b3d9', '#335fd9', '#2a40d9'
                    ].map((color, idx) => (
                      <button
                        key={color + idx}
                        onClick={() => {
                          editor.chain().focus().setColor(color).run();
                          closeDropdown();
                        }}
                        className="w-5 h-5 rounded-full border border-[#888] hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
            )}
          </div>
        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {/* Block style dropdown (Aa) */}
        <div className="relative inline-block dropdown-container">
          <button
            type="button"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
            onClick={() => toggleDropdown('block')}
          >
            <span className="text-base font-bold">Aa</span>
            <span className="text-gray-900 font-medium text-xs">
              {editor.isActive('heading', { level: 1 }) ? 'Large header' :
                editor.isActive('heading', { level: 2 }) ? 'Medium header' :
                  editor.isActive('heading', { level: 3 }) ? 'Small header' :
                    'Normal text'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-700" />
          </button>
                      {activeDropdown === 'block' && (
              <div
                className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 min-w-[180px] flex flex-col gap-1"
                onMouseEnter={() => setActiveDropdown('block')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${!editor.isActive('heading', { level: 1 }) && !editor.isActive('heading', { level: 2 }) && !editor.isActive('heading', { level: 3 }) ? 'text-[#6366f1]' : ''}`}
                  onClick={() => {
                    editor.chain().focus().setParagraph().run();
                    closeDropdown();
                  }}
                >
                  <span className="text-xs font-bold">Aa</span> Normal text
                </button>
                <button
                  className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 1 }) ? 'text-[#6366f1]' : ''}`}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                    closeDropdown();
                  }}
                >
                  <span className="text-sm font-bold">H1</span> Large header
                </button>
                <button
                  className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 2 }) ? 'text-[#6366f1]' : ''}`}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                    closeDropdown();
                  }}
                >
                  <span className="text-xs font-bold">H2</span> Medium header
                </button>
                <button
                  className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 3 }) ? 'text-[#6366f1]' : ''}`}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                    closeDropdown();
                  }}
                >
                  <span className="text-xs font-bold">H3</span> Small header
                </button>
              </div>
            )}
        </div>
        {/* Divider */}
        <div className="w-px h-5 bg-[#444] mx-1" />
        {/* Inline style buttons */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          <Bold className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          <Italic className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'is-active' : ''}
        >
          <Underline className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          <Strikethrough className="w-3 h-3" />
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1.5" />
        {/* Task moved into Insert dropdown */}
        {/* Checklist (simple checkbox + content, NO borders, NO dropdowns) */}
        <button
          onClick={() => {
            // Insert simple checkbox using the custom extension
            (editor.chain().focus() as any).toggleSimpleChecklist().run();
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100"
          title="Checklist"
        >
          <Square className="w-3 h-3" />
          <span className="text-xs font-medium">Checklist</span>
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-[#444] mx-1.5" />
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo className="w-3 h-3" />
          </button>
          <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo className="w-3 h-3" />
          </button>
        </div>
        {/* Divider */}
        <div className="w-px h-5 bg-[#444] mx-1.5" />
        {/* More button with dropdown */}
        <div className="relative inline-block ml-1.5 dropdown-container">
          <button
            ref={moreBtnRef}
            type="button"
            className="flex items-center gap-1 px-1 py-0.5 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
            onClick={() => toggleDropdown('more')}
          >
            <span className="text-gray-900 font-semibold text-xs">More</span>
            <ChevronDown className="w-2 h-2 text-gray-700" />
          </button>
          {(activeDropdown === 'more' || activeDropdown === 'highlight') && (
            <div
              className="absolute top-full z-[9999] mt-2"
              style={{
                left: 0,
                right: 0,
                minWidth: '180px'
              }}
              onMouseEnter={() => {
                if (activeDropdown === 'more') {
                  setActiveDropdown('more');
                }
              }}
              onMouseLeave={() => {
                setActiveDropdown(null);
              }}
            >
              <div
                ref={moreDropdownRef}
                className="absolute left-0 top-0 bg-white text-gray-900 p-2 rounded shadow-xl border border-gray-200 min-w-[180px] flex flex-col gap-1 z-[9999]"
                style={{ 
                  zIndex: 9999,
                  maxWidth: window.innerWidth >= 1920 ? '240px' : '200px',
                  minWidth: window.innerWidth >= 1920 ? '220px' : '180px',
                  transform: moreBtnRef.current ? (() => {
                    const rect = moreBtnRef.current!.getBoundingClientRect();
                    const dropdownWidth = window.innerWidth >= 1920 ? 240 : 200;
                    const viewportWidth = window.innerWidth;
                    
                    // If dropdown would overflow right edge, align to right
                    if (rect.left + dropdownWidth > viewportWidth) {
                      return `translateX(${Math.max(0, viewportWidth - dropdownWidth - rect.left - 10)}px)`;
                    }
                    // Otherwise, align to button
                    return 'translateX(0)';
                  })() : 'translateX(0)'
                }}
              >
                {/* Brush (highlight) button at top, with palette opening to the left */}
                <div className="relative" style={{ minHeight: 20 }}>
                  <button
                    ref={highlightBtnRef}
                    type="button"
                    className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'} ${activeDropdown === 'highlight' ? 'bg-gray-100' : ''}`}
                    style={{ background: activeDropdown === 'highlight' ? '#f3f4f6' : 'none', position: 'relative', zIndex: 52 }}
                    title="Highlight Color"
                    onMouseEnter={() => setActiveDropdown('highlight')}
                    onMouseLeave={e => {
                      // If moving to the highlight dropdown, don't close
                      const related = e.relatedTarget as HTMLElement | null;
                      if (!related || !related.closest('[data-highlight-dropdown]')) {
                        setActiveDropdown('more');
                      }
                    }}
                  >
                    <Paintbrush className="w-4 h-4" />
                    Highlight
                    <ChevronDown color="#374151" size={14} className="ml-1" />
                  </button>
                  {/* Buffer zone between highlight button and dropdown (to the left) */}
                  {activeDropdown === 'highlight' && (
                    <div
                      style={{
                        position: 'absolute',
                        right: '100%',
                        top: 0,
                        width: 150,
                        height: '100%',
                        zIndex: 51,
                        pointerEvents: 'auto',
                      }}
                      onMouseEnter={() => setActiveDropdown('highlight')}
                      onMouseLeave={() => setActiveDropdown('more')}
                    />
                  )}
                  {activeDropdown === 'highlight' && (
                    <div
                      ref={highlightDropdownRef}
                      className="absolute top-0 bg-white text-gray-900 p-3 rounded shadow-xl border border-gray-200 z-[9999]"
                      style={{
                        minWidth: 200,
                        zIndex: 53,
                        right: '100%',
                        marginRight: '8px',
                        maxWidth: '220px',
                        left: (() => {
                          if (!moreBtnRef.current) return 'auto';
                          const rect = moreBtnRef.current.getBoundingClientRect();
                          const dropdownWidth = 220;
                          
                          // If highlight dropdown would overflow left edge, position it to the right
                          if (rect.left - dropdownWidth < 0) {
                            return '100%';
                          }
                          return 'auto';
                        })()
                      }}
                      data-highlight-dropdown="true"
                      onMouseLeave={() => setActiveDropdown('more')}
                    >
                      {/* Auto button */}
                      <button
                        onClick={() => {
                          editor.chain().focus().unsetHighlight().run();
                          setActiveDropdown('more');
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded border border-gray-300 mb-2 focus:outline-none bg-white"
                      >
                        <span className="w-6 h-6 rounded-full border border-[#888] flex items-center justify-center bg-gradient-to-br from-[#fff] to-[#eee] relative">
                          <span style={{ position: 'absolute', width: '100%', height: 2, background: '#888', transform: 'rotate(-45deg)', top: '50%', left: 0, marginTop: -1 }} />
                        </span>
                        <span>Auto</span>
                      </button>
                      {/* For white text */}
                      <div>
                        <div className="text-xs text-gray-300 mb-1 ml-1">For White text</div>
                        <div className="grid grid-cols-7 gap-1.5 mb-2">
                          {[
                            '#2E2E2E', '#191970', '#228B22', '#DC143C', '#2F4F4F', '#663399', '#008B8B',
                          ].map((color, idx) => (
                            <button
                              key={'white' + color + idx}
                              onClick={() => {
                                editor.chain().focus().setHighlight({ color }).run();
                                setActiveDropdown('more');
                              }}
                              className="w-6 h-6 rounded-full border border-[#888] hover:scale-110 transition-transform"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        {/* For black text */}
                        <div className="text-xs text-gray-300 mb-1 ml-1">For Black text</div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {[
                            '#FFFACD', '#FFFFE0', '#98FB98', '#E0FFFF', '#E6E6FA', '#FFE4E1', '#FFB6C1',
                          ].map((color, idx) => (
                            <button
                              key={'black' + color + idx}
                              onClick={() => {
                                editor.chain().focus().setHighlight({ color }).run();
                                setActiveDropdown('more');
                              }}
                              className="w-6 h-6 rounded-full border border-[#888] hover:scale-110 transition-transform"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rest of the More dropdown items */}
                <button
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={editor.isActive({ textAlign: 'left' }) ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                  title="Align Left"
                  onMouseEnter={() => setActiveDropdown('more')}
                >
                  <AlignLeft className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Left
                </button>
                <button
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={editor.isActive({ textAlign: 'center' }) ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                  title="Align Center"
                  onMouseEnter={() => setActiveDropdown('more')}
                >
                  <AlignCenter className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Center
                </button>
                <button
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={editor.isActive({ textAlign: 'right' }) ? `is-active flex items-center gap-1.5 px-2 py rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                  title="Align Right"
                  onMouseEnter={() => setActiveDropdown('more')}
                >
                  <AlignRight className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Right
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={editor.isActive('blockquote') ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                >
                  <Quote className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Quote
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().setHorizontalRule().run();
                    appendParagraphIfNeeded(editor);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                >
                  <Minus className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Horizontal Rule
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  disabled={!editor.can().chain().focus().toggleCode().run()}
                  className={editor.isActive('code') ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                >
                  <Code className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Code
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={editor.isActive('bulletList') ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                  title="Bullet List"
                >
                  <List className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} /> Bullet List
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={editor.isActive('orderedList') ? `is-active flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                  title="Numbered List"
                >
                  <ListOrdered className={window.innerWidth >= 1920 ? "w-4 h-4" : "w-3.5 h-3.5"} /> Numbered List
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TemplateEditorToolbarProps {
  editor: Editor | null;
}

export const TemplateEditorToolbar: React.FC<TemplateEditorToolbarProps> = ({ editor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Template uploads are not supported - use local preview only
  const [activeDropdown, setActiveDropdown] = useState<any>(null);
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const highlightDropdownRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const [currentTextColor, setCurrentTextColor] = useState<string>('#111827');

  // Function to get theme-aware text color
  const getThemeTextColor = () => {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'black' ? '#ffffff' : '#111827';
  };

  // Update current text color when editor state changes
  useEffect(() => {
    if (!editor) return;
    
    const updateTextColor = () => {
      const editorColor = editor?.getAttributes('textStyle').color;
      setCurrentTextColor(editorColor || getThemeTextColor());
    };

    // Update initially
    updateTextColor();

    // Listen for editor updates
    const handleTransaction = () => {
      updateTextColor();
    };

    editor.on('transaction', handleTransaction);

    // Listen for theme changes
    const handleThemeChange = () => {
      updateTextColor();
    };

    // Observer for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => {
      editor.off('transaction', handleTransaction);
      observer.disconnect();
    };
  }, [editor]);

  const TEXT_COLORS = [
    '#e0e0e0', '#bdbdbd', '#757575', '#212121', '#ba68c8',
    '#f06292', '#ff8a65', '#ffd54f', '#aed581', '#4dd0e1', '#64b5f6', '#1976d2',
  ];

  // Color-related variables for the color picker
  // currentTextColor is now managed by useState and useEffect above
  const parseColorToRgb = (color: string) => {
    if (!color || color === '') return null;
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };
  const getLuminance = (r: number, g: number, b: number) => {
    const srgb = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };
  const rgb = parseColorToRgb(currentTextColor);
  const luminance = rgb ? getLuminance(rgb.r, rgb.g, rgb.b) : 0.2;
  const innerStroke = luminance > 0.7 ? '#111827' : '#ffffff';
  const outerStroke = luminance > 0.7 ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.45)';

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  if (!editor) {
    return <div className="editor-toolbar" />;
  }

  // This duplicate function is removed - using the main handleImageUpload above

  const appendParagraphIfNeeded = (editor: Editor) => {
    const { doc } = editor.state;
    const lastNode = doc.lastChild;
    if (!lastNode || lastNode.type.name !== 'paragraph' || lastNode.content.size !== 0) {
      editor.commands.insertContentAt(doc.content.size, { type: 'paragraph' });
    }
  };

  return (
          <div className="editor-toolbar flex flex-wrap items-center gap-1 p-1 bg-black-100 dark:bg-black-800 border-b border-gray-300 dark:border-gray-600 relative justify-start">
      {/* Insert Button with Dropdown */}
      <div className="relative dropdown-container">
        <button
          type="button"
          className="flex items-center gap-1 px-1 py-0.5 rounded-full bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
          style={{ minWidth: 0 }}
          onClick={() => toggleDropdown('insert')}
        >
          <span className="flex items-center justify-center w-3 h-3 rounded-full bg-[#818cf8]">
            <Plus className="w-2 h-2 text-black" />
          </span>
          <span className="text-gray-900 font-semibold text-xs" style={{ lineHeight: 1 }}>Insert</span>
          <ChevronDown className="w-2 h-2 text-gray-700" />
        </button>
        {activeDropdown === 'insert' && (
          <div
            className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 flex flex-col gap-1"
            style={{
              minWidth: window.innerWidth >= 1920 ? '160px' : '140px',
              maxWidth: window.innerWidth >= 1920 ? '180px' : '160px'
            }}
            onMouseEnter={() => setActiveDropdown('insert')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button
              className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                appendParagraphIfNeeded(editor);
                closeDropdown();
              }}
            >
              <Table className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} />
              Insert Table
            </button>
            <button
              className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
              onClick={() => {
                fileInputRef.current?.click();
                closeDropdown();
              }}
            >
              <Image className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} />
              Insert Image
            </button>
            <button
              className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left ${window.innerWidth >= 1920 ? 'text-sm' : 'text-xs'}`}
              onClick={closeDropdown}
            >
              <Link className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} />
              Insert Link
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={(e) => {
            // Templates do not support uploads; clear selection and warn.
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('Image upload is not available in templates', 'error');
          }}
        />
      </div>
      {/* Divider */}
      <div className="w-px h-5 bg-gray-200 mx-1" />
      {/* Font Size Dropdown */}
      <div className="relative inline-block dropdown-container ml-1">
        <button
          type="button"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
          onClick={() => toggleDropdown('fontSize')}
        >
          <span className="text-gray-900 font-medium text-xs">
            {editor.getAttributes('textStyle').fontSize
              ? editor.getAttributes('textStyle').fontSize.replace('px', '')
              : 'Font Size'}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-700" />
        </button>
        {activeDropdown === 'fontSize' && (
          <div
            className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 min-w-[80px] flex flex-col gap-1"
            onMouseEnter={() => setActiveDropdown('fontSize')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            {[12, 14, 16, 18, 24, 32].map(size => (
              <button
                key={size}
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.getAttributes('textStyle').fontSize === `${size}px` ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  (editor.chain().focus() as any).setFontSize(`${size}px`).run();
                  setActiveDropdown(null);
                }}
              >
                {size}
              </button>
            ))}
            <button
              className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${!editor.getAttributes('textStyle').fontSize ? 'text-[#6366f1]' : ''}`}
              onClick={() => {
                (editor.chain().focus() as any).unsetFontSize().run();
                setActiveDropdown(null);
              }}
            >
              Default
            </button>
          </div>
        )}
      </div>
      {/* Text Color Palette */}
      <div className="relative inline-block dropdown-container ml-1">
        <button
          ref={colorBtnRef}
          type="button"
          onClick={() => toggleDropdown('color')}
          className="flex items-center justify-center w-6 h-6 p-0 bg-transparent"
          title="Text Color"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="22" height="22" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--editor-formatting-button-color)', shapeRendering: 'geometricPrecision' }}>
                <defs>
                  <pattern id="pattern0_12129_209028" width="1" height="1" patternContentUnits="objectBoundingBox">
                    <use xlinkHref="#image0_12129_209028" transform="scale(.01667)" />
                  </pattern>
                  <image xlinkHref="data:image/png;base64,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" id="image0_12129_209028" width="60" height="60" preserveAspectRatio="none" />
                  </defs>
                  <path fill="url(#pattern0_12129_209028)" d="M2 2h20v20H2z"></path>
                  <circle cx="12" cy="12" r="6.7" fill={currentTextColor} stroke={innerStroke} strokeOpacity="0.98" strokeWidth="2.25" vectorEffect="non-scaling-stroke"></circle>
                  <circle cx="12" cy="12" r="7.7" stroke={outerStroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke"></circle>
                </svg>
              </span>
              <ChevronDown className="w-3 h-3 ml-1 text-gray-700 dark:text-gray-300" />
            </span>
          </button>
          {activeDropdown === 'color' && (
            <div
              ref={colorDropdownRef}
              className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-2 rounded shadow-xl border border-gray-200"
              style={{ minWidth: 200 }}
              onMouseEnter={() => setActiveDropdown('color')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              {/* Auto button */}
              <button
                onClick={() => {
                  editor.chain().focus().setColor('').run();
                  closeDropdown();
                }}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded border border-[#666] mb-1.5 focus:outline-none text-sm"
                style={{ background: 'rgba(30,30,30,0.9)' }}
              >
                <span className="w-4 h-4 rounded-full border border-[#888] flex items-center justify-center bg-gradient-to-br from-[#fff] to-[#eee] relative">
                  <span style={{ position: 'absolute', width: '100%', height: 2, background: '#888', transform: 'rotate(-45deg)', top: '50%', left: 0, marginTop: -1 }} />
                </span>
                <span>Auto</span>
              </button>
              {/* Color swatches grid */}
              <div className="grid grid-cols-7 gap-1">
                {[
                  '#8a8a8a', '#666666', '#404040', '#1a1a1a', '#000000', '#8a4fd9', '#b33fd9',
                  '#d63030', '#d67330', '#d9b833', '#40d973', '#33b3d9', '#335fd9', '#2a40d9'
                ].map((color, idx) => (
                  <button
                    key={color + idx}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      closeDropdown();
                    }}
                    className="w-5 h-5 rounded-full border border-[#888] hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {/* Block style dropdown (Aa) */}
        <div className="relative inline-block dropdown-container">
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
            onClick={() => toggleDropdown('block')}
          >
            <span className="text-lg font-bold">Aa</span>
            <span className="text-gray-900 font-medium text-sm">
              {editor.isActive('heading', { level: 1 }) ? 'Large header' :
                editor.isActive('heading', { level: 2 }) ? 'Medium header' :
                  editor.isActive('heading', { level: 3 }) ? 'Small header' :
                    'Normal text'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-700" />
          </button>
          {activeDropdown === 'block' && (
            <div
              className="absolute left-0 top-full z-[9999] mt-2 bg-white text-gray-900 p-1 rounded shadow-xl border border-gray-200 min-w-[180px] flex flex-col gap-1"
              onMouseEnter={() => setActiveDropdown('block')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${!editor.isActive('heading', { level: 1 }) && !editor.isActive('heading', { level: 2 }) && !editor.isActive('heading', { level: 3 }) ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  closeDropdown();
                }}
              >
                <span className="text-sm font-bold">Aa</span> Normal text
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 1 }) ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  closeDropdown();
                }}
              >
                <span className="text-base font-bold">H1</span> Large header
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 2 }) ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  closeDropdown();
                }}
              >
                <span className="text-sm font-bold">H2</span> Medium header
              </button>
              <button
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-gray-100 text-left text-xs ${editor.isActive('heading', { level: 3 }) ? 'text-[#6366f1]' : ''}`}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  closeDropdown();
                }}
              >
                <span className="text-xs font-bold">H3</span> Small header
              </button>
            </div>
          )}
        </div>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Inline style buttons */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={(editor.isActive('bold') ? 'is-active ' : '') + 'text-gray-800 hover:bg-gray-100 px-1 py-1 rounded'}
        >
          <Bold className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={(editor.isActive('italic') ? 'is-active ' : '') + 'text-gray-800 hover:bg-gray-100 px-1 py-1 rounded'}
        >
          <Italic className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={(editor.isActive('underline') ? 'is-active ' : '') + 'text-gray-800 hover:bg-gray-100 px-1 py-1 rounded'}
        >
          <Underline className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={(editor.isActive('strike') ? 'is-active ' : '') + 'text-gray-800 hover:bg-gray-100 px-1 py-1 rounded'}
        >
          <Strikethrough className="w-3 h-3" />
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Task List */}
        <button onClick={() => editor.chain().focus().toggleTaskList().run()} className="text-gray-800 hover:bg-gray-100 px-1 py-1 rounded">
          <CheckSquare className="w-3 h-3" />
        </button>
        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="text-gray-800 hover:bg-gray-100 px-1 py-1 rounded">
            <Undo className="w-3 h-3" />
          </button>
          <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="text-gray-800 hover:bg-gray-100 px-1 py-1 rounded">
            <Redo className="w-3 h-3" />
          </button>
        </div>
        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {/* More button with dropdown */}
        <div className="relative inline-block ml-2 dropdown-container">
          <button
            ref={moreBtnRef}
            type="button"
              className="flex items-center gap-2 px-3 py-1 rounded bg-transparent hover:bg-gray-100 focus:outline-none"
          onClick={() => toggleDropdown('more')}
        >
              <span className="text-gray-900 font-semibold text-base">More</span>
              <ChevronDown className="w-2 h-2 text-gray-700" />
        </button>
        {(activeDropdown === 'more' || activeDropdown === 'highlight') && (
          <div
            className="absolute top-full z-[9999] mt-2"
            style={{
              left: 0,
              right: 0,
              minWidth: '200px'
            }}
            onMouseEnter={() => {
              if (activeDropdown === 'more') {
                setActiveDropdown('more');
              }
            }}
            onMouseLeave={() => {
              setActiveDropdown(null);
            }}
          >
            <div
              ref={moreDropdownRef}
          className="absolute top-0 bg-white text-gray-900 p-2 rounded shadow-xl border border-gray-200 min-w-[180px] flex flex-col gap-1"
              style={{ 
                zIndex: 50, 
                maxWidth: window.innerWidth >= 1920 ? '240px' : '200px',
                minWidth: window.innerWidth >= 1920 ? '220px' : '180px',
                transform: moreBtnRef.current ? (() => {
                  const rect = moreBtnRef.current!.getBoundingClientRect();
                  const dropdownWidth = window.innerWidth >= 1920 ? 240 : 200;
                  const viewportWidth = window.innerWidth;
                  
                  // If dropdown would overflow right edge, align to right
                  if (rect.left + dropdownWidth > viewportWidth) {
                    return `translateX(${Math.max(0, viewportWidth - dropdownWidth - rect.left - 10)}px)`;
                  }
                  // Otherwise, align to button
                  return 'translateX(0)';
                })() : 'translateX(0)'
              }}
            >
              {/* Highlight button and palette */}
              <div className="relative" style={{ minHeight: 40 }}>
                <button
                  ref={highlightBtnRef}
                  type="button"
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'} ${activeDropdown === 'highlight' ? 'bg-gray-100' : ''}`}
                  style={{ background: activeDropdown === 'highlight' ? '#f3f4f6' : 'none', position: 'relative', zIndex: 52 }}
                  title="Highlight Color"
                  onMouseEnter={() => setActiveDropdown('highlight')}
                  onMouseLeave={e => {
                    const related = e.relatedTarget as HTMLElement | null;
                    if (!related || !related.closest('[data-highlight-dropdown]')) {
                      setActiveDropdown('more');
                    }
                  }}
                >
                  <Paintbrush className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} />
                  Highlight
                  <ChevronDown color="#374151" size={window.innerWidth >= 1920 ? 16 : 14} className="ml-1" />
                </button>
                {/* Buffer zone between highlight button and dropdown (to the left) */}
                {activeDropdown === 'highlight' && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '100%',
                      top: 0,
                      width: 150,
                      height: '100%',
                      zIndex: 51,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={() => setActiveDropdown('highlight')}
                    onMouseLeave={() => setActiveDropdown('more')}
                  />
                )}
                {activeDropdown === 'highlight' && (
                  <div
                    ref={highlightDropdownRef}
                    className="absolute top-0 bg-white text-gray-900 p-4 rounded shadow-xl border border-gray-200"
                    style={{ 
                      minWidth: 220, 
                      zIndex: 53,
                      right: '100%',
                      marginRight: '8px',
                      maxWidth: '220px',
                      left: (() => {
                        if (!moreBtnRef.current) return 'auto';
                        const rect = moreBtnRef.current.getBoundingClientRect();
                        const dropdownWidth = 220;
                        const viewportWidth = window.innerWidth;
                        
                        // If highlight dropdown would overflow left edge, position it to the right
                        if (rect.left - dropdownWidth < 0) {
                          return '100%';
                        }
                        return 'auto';
                      })()
                    }}
                    data-highlight-dropdown="true"
                    onMouseLeave={() => setActiveDropdown('more')}
                  >
                    {/* Auto button */}
                    <button
                      onClick={() => {
                        editor.chain().focus().unsetHighlight().run();
                        setActiveDropdown('more');
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded border border-gray-300 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    >
                      <span className="w-6 h-6 rounded-full border border-[#888] flex items-center justify-center bg-gradient-to-br from-[#fff] to-[#eee] relative">
                        <span style={{ position: 'absolute', width: '100%', height: 2, background: '#888', transform: 'rotate(-45deg)', top: '50%', left: 0, marginTop: -1 }} />
                      </span>
                      <span>Auto</span>
                    </button>
                    {/* For white text */}
                    <div>
                      <div className="text-xs text-gray-300 mb-1 ml-1">For White text</div>
                      <div className="grid grid-cols-7 gap-2 mb-3">
                        {['#2E2E2E', '#191970', '#228B22', '#DC143C', '#2F4F4F', '#663399', '#008B8B'].map((color, idx) => (
                          <button
                            key={'white' + color + idx}
                            onClick={() => {
                              editor.chain().focus().setHighlight({ color }).run();
                              setActiveDropdown('more');
                            }}
                            className="w-7 h-7 rounded-full border border-[#888] hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      {/* For black text */}
                      <div className="text-xs text-gray-300 mb-1 ml-1">For Black text</div>
                      <div className="grid grid-cols-7 gap-2">
                        {['#FFFACD', '#FFFFE0', '#98FB98', '#E0FFFF', '#E6E6FA', '#FFE4E1', '#FFB6C1'].map((color, idx) => (
                          <button
                            key={'black' + color + idx}
                            onClick={() => {
                              editor.chain().focus().setHighlight({ color }).run();
                              setActiveDropdown('more');
                            }}
                            className="w-7 h-7 rounded-full border border-[#888] hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={editor.isActive({ textAlign: 'left' }) ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                title="Align Left"
                onMouseEnter={() => setActiveDropdown('more')}
              >
                <AlignLeft className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Left
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={editor.isActive({ textAlign: 'center' }) ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                title="Align Center"
                onMouseEnter={() => setActiveDropdown('more')}
              >
                <AlignCenter className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Center
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={editor.isActive({ textAlign: 'right' }) ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                title="Align Right"
                onMouseEnter={() => setActiveDropdown('more')}
              >
                <AlignRight className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Align Right
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#353A40] text-left w-full text-sm' : 'flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#353A40] text-left w-full text-sm'}
              >
                <Quote className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Quote
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setHorizontalRule().run();
                  appendParagraphIfNeeded(editor);
                }}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
              >
                <Minus className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Horizontal Rule
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                disabled={!editor.can().chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
              >
                <Code className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Code
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                title="Bullet List"
              >
                <List className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Bullet List
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? `is-active flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}` : `flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-100 text-left w-full ${window.innerWidth >= 1920 ? 'text-base' : 'text-sm'}`}
                title="Numbered List"
              >
                <ListOrdered className={window.innerWidth >= 1920 ? "w-5 h-5" : "w-4 h-4"} /> Numbered List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


