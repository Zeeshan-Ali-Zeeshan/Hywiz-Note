import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Edit, Copy, MoreHorizontal, Link as LinkIcon, Scissors } from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useNavigate } from 'react-router-dom';

interface LinkBubbleProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  linkData: {
    href: string;
    text: string;
    maskText?: string;
    target?: string;
  };
  position: { x: number; y: number };
  onEdit: () => void;
}

export const LinkBubble: React.FC<LinkBubbleProps> = ({
  editor,
  isOpen,
  onClose,
  linkData,
  position,
  onEdit,
}) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideBubble = bubbleRef.current && !bubbleRef.current.contains(target);
      const clickedOutsideMenu = menuRef.current && !menuRef.current.contains(target);
      if (clickedOutsideBubble && clickedOutsideMenu) {
        onClose();
        setMenuOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setMenuOpen(false);
    onClose();
  };

  const handleDelete = () => {
    editor.chain().focus().extendMarkRange('link').deleteSelection().run();
    setMenuOpen(false);
    onClose();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkData.href);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(linkData.text || linkData.href);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleOpenLink = () => {
    if (linkData.href.startsWith('note://')) {
      // Handle internal note navigation - use React Router
      const noteId = linkData.href.replace('note://', '');
      console.log('LinkBubble: Navigating to note via React Router:', noteId);
      navigate(`/notes?note=${noteId}`);
    } else if (linkData.href.startsWith('template://')) {
      // Handle internal template navigation - use React Router
      const templateId = linkData.href.replace('template://', '');
      console.log('LinkBubble: Navigating to template via React Router:', templateId);
      navigate(`/templates?template=${templateId}`);
    } else if (linkData.href.startsWith('http://') || linkData.href.startsWith('https://')) {
      const target = linkData.target || '_blank';
      if (target === '_blank') {
        window.open(linkData.href, target, 'noopener,noreferrer');
      } else {
        window.location.href = linkData.href;
      }
    } else {
      window.location.href = linkData.href;
    }
    onClose();
  };

  if (!isOpen) return null;

  const rootEl = document.documentElement;
  const themeAttr = rootEl.getAttribute('data-theme');
  const isDark = themeAttr === 'dark' || themeAttr === 'black' || rootEl.classList.contains('dark');
  const baseBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textMuted = isDark ? 'text-gray-200' : 'text-gray-900';
  const urlBg = isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const menuBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const menuText = isDark ? 'text-gray-100' : 'text-gray-800';
  const menuHover = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100';

  return (
    <div
      ref={bubbleRef}
      className={`fixed ${baseBg} border rounded-md shadow-lg z-[10000] pointer-events-auto`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px',
      }}
      onMouseLeave={() => setTimeout(() => onClose(), 220)}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className={`px-2 py-1 rounded ${urlBg} text-sm max-w-xs truncate flex items-center gap-1`}>
          <LinkIcon size={14} className={textMuted} />
          <span title={linkData.href}>{linkData.href}</span>
        </div>
        <button
          onClick={onEdit}
          className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          <Edit size={14} />
          Edit
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            aria-label="More"
          >
            <MoreHorizontal size={18} className={textMuted} />
          </button>
          {menuOpen && (
            <div className={`absolute right-0 mt-1 w-44 ${menuBg} ${menuText} border rounded-md shadow-xl py-1 z-[10001] pointer-events-auto`}
                 onMouseLeave={() => setMenuOpen(false)} onMouseEnter={() => setMenuOpen(true)}>
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={() => { setMenuOpen(false); handleOpenLink(); }}>
                <ExternalLink size={14} className="inline mr-2" />Open
              </button>
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={() => { setMenuOpen(false); handleCopyText(); }}>
                <Copy size={14} className="inline mr-2" />Copy
              </button>
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={() => { setMenuOpen(false); handleCopyLink(); }}>
                <Copy size={14} className="inline mr-2" />Copy URL
              </button>
              <div className={`my-1 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={() => { setMenuOpen(false); onEdit(); }}>
                <Edit size={14} className="inline mr-2" />Edit
              </button>
              <div className={`my-1 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={handleUnlink}>
                <Scissors size={14} className="inline mr-2" />Unlink
              </button>
              <button className={`w-full px-3 py-2 text-left text-sm ${menuText} ${menuHover}`} onClick={handleDelete}>
                <LinkIcon size={14} className="inline mr-2 rotate-45" />Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
