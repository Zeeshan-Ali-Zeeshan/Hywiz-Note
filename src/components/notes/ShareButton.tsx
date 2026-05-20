import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Users, Globe, X, Link as LinkIcon } from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import api from '../../lib/api';
import { copyToClipboard, generateShareLink } from '../../lib/utils';
import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/useToastStore';
import socket from '../../lib/socket';

interface ShareButtonProps {
  noteId: string;
  noteTitle?: string;
  className?: string;
  onClose?: () => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  dropdownRef?: React.RefObject<HTMLDivElement>;
  onShareChange?: () => void;
}

interface ShareSettings {
  isPublic: boolean;
  allowEdit: boolean;
  allowComments: boolean;
  passwordProtected: boolean;
  password?: string;
  expiresAt?: string;
}

interface Collaborator {
  _id: string;
  userId: {
    _id: string;
    name?: string;
    email?: string;
    avatar?: string;
  } | string;
  email: string;
  permission: 'view' | 'edit' | 'full';
  status?: 'pending' | 'accepted' | 'declined';
  invitedAt?: string;
  acceptedAt?: string;
}

// Debounce utility
function debounce(fn: (settings: ShareSettings) => void, delay: number) {
  let timer: NodeJS.Timeout;
  return (settings: ShareSettings) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(settings), delay);
  };
}

// Type guard for userId
function isUserObject(user: any): user is { name?: string; email?: string } {
  return user && typeof user === 'object' && ('name' in user || 'email' in user);
}

export const ShareButton = forwardRef<HTMLButtonElement, ShareButtonProps>(
  ({ noteId, noteTitle, className = '', onClose, open, setOpen, dropdownRef, onShareChange }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCollaborator, setNewCollaborator] = useState('');
    const [newCollaboratorPermission, setNewCollaboratorPermission] = useState<'view' | 'edit' | 'full'>('view');
    const [shareLink, setShareLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [activeTab, setActiveTab] = useState<'share' | 'collaborators' | 'settings'>('share');
    const modalRef = useRef<HTMLDivElement>(null);
    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const showToast = useToastStore((state) => state.showToast);

    // Dummy state to force re-render
    const [, forceUpdate] = useState(0);

    useImperativeHandle(ref, () => internalButtonRef.current as HTMLButtonElement);

    // Use the latest note from the store for all state
    const currentNote = useNotesStore(state => state.notes.find(note => note._id === noteId));
    // Use 'collaborators' field for realtime updates
    const collaborators = (currentNote && Array.isArray((currentNote as any).collaborators)) ? (currentNote as any).collaborators : [];
    // Always use the latest value from the store for shareSettings
    const shareSettings = currentNote?.shareSettings || {
      isPublic: false,
      allowEdit: false,
      allowComments: true,
      passwordProtected: false,
      password: '',
      expiresAt: ''
    };

    // Robust select value calculation
    const selectValue = shareSettings.isPublic
      ? (shareSettings.allowEdit ? 'public-edit' : 'public-view')
      : 'restricted';

    // Always sync share link when noteId or currentNote changes
    useEffect(() => {
      if (noteId) {
        setShareLink(`${window.location.origin}/note/${noteId}`);
      }
    }, [noteId, currentNote]);

    // Remove socket event listener for share/collaborator updates (store handles it)

    useEffect(() => {
      // Force a re-render when shareSettings or collaborators change
      forceUpdate(n => n + 1);
    }, [currentNote?.shareSettings, currentNote?.collaborators]);

    const handleCloseModal = () => {
      setIsModalOpen(false);
      if (onClose) {
        onClose();
      }
    };

    useEffect(() => {
      if (!isModalOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
        if (
          modalRef.current &&
          !modalRef.current.contains(event.target as Node) &&
          internalButtonRef.current &&
          !internalButtonRef.current.contains(event.target as Node)
        ) {
          handleCloseModal();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isModalOpen]);

    // Auto-open modal if onClose is provided (for use in NoteMoreMenu)
    useEffect(() => {
      if (onClose) {
        setIsModalOpen(true);
      }
    }, [onClose]);

    // Use controlled open state if provided
    const actualOpen = open !== undefined ? open : isModalOpen;

    useEffect(() => {
      if (!actualOpen || !internalButtonRef.current) return;
      const buttonRect = internalButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 384; // w-96
      const dropdownHeight = 500; // estimate, or measure after render
      const margin = 8;
      let top = buttonRect.bottom + margin + window.scrollY;
      let left = buttonRect.left + window.scrollX;
      // Flip up if not enough space below
      if (top + dropdownHeight > window.innerHeight + window.scrollY) {
        top = buttonRect.top - dropdownHeight - margin + window.scrollY;
      }
      // Shift left if not enough space to the right
      if (left + dropdownWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth - dropdownWidth - margin + window.scrollX;
      }
      setDropdownStyle({
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        width: dropdownWidth,
        maxHeight: '90vh',
      });
    }, [actualOpen]);

    useEffect(() => {
      if (!actualOpen) return;
      const handle = () => {
        setTimeout(() => {
          if (internalButtonRef.current) {
            const buttonRect = internalButtonRef.current.getBoundingClientRect();
            const dropdownWidth = 384;
            const dropdownHeight = 500;
            const margin = 8;
            let top = buttonRect.bottom + margin + window.scrollY;
            let left = buttonRect.left + window.scrollX;
            if (top + dropdownHeight > window.innerHeight + window.scrollY) {
              top = buttonRect.top - dropdownHeight - margin + window.scrollY;
            }
            if (left + dropdownWidth > window.innerWidth + window.scrollX) {
              left = window.innerWidth - dropdownWidth - margin + window.scrollX;
            }
            setDropdownStyle({
              position: 'fixed',
              top,
              left,
              zIndex: 9999,
              width: dropdownWidth,
              maxHeight: '90vh',
            });
          }
        }, 0);
      };
      window.addEventListener('resize', handle);
      window.addEventListener('scroll', handle, true);
      return () => {
        window.removeEventListener('resize', handle);
        window.removeEventListener('scroll', handle, true);
      };
    }, [actualOpen]);

    // Only use loadShareData after direct actions (add/remove collaborator, update settings)
    const loadShareData = async () => {
      try {
        setIsLoading(true);
        await api.get(`/notes/${noteId}/share`); // Optionally refresh backend cache
      } catch (error) {
        console.error('Failed to load share data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const updateShareSettings = async (settings: ShareSettings) => {
      try {
        setIsLoading(true);
        await api.put(`/notes/${noteId}/share`, settings);
        await loadShareData();
        if (onShareChange) onShareChange();
        setMessage('Share settings updated!');
        setMessageType('success');
      } catch (error) {
        setMessage('Failed to update share settings.');
        setMessageType('error');
      } finally {
        setIsLoading(false);
      }
    };

    const addCollaborator = async () => {
      if (!newCollaborator.trim()) return;
      if (!isValidEmail(newCollaborator)) {
        showToast('Please enter a valid email address', 'error');
        return;
      }
      try {
        setIsLoading(true);
        await api.post(`/notes/${noteId}/collaborators`, {
          email: newCollaborator.trim(),
          permission: newCollaboratorPermission
        });
        setNewCollaborator('');
        await loadShareData();
        if (onShareChange) onShareChange();
        showToast('Invitation sent!', 'success');
      } catch (error: any) {
        showToast('Failed to invite collaborator. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const removeCollaborator = async (collaboratorId: string) => {
      try {
        setIsLoading(true);
        await api.delete(`/notes/${noteId}/collaborators/${collaboratorId}`);
        await loadShareData();
        if (onShareChange) onShareChange();
        showToast('Collaborator removed successfully!', 'success');
      } catch (error: any) {
        showToast('Failed to remove collaborator. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const updateCollaboratorPermission = async (collaboratorId: string, permission: 'view' | 'edit' | 'full') => {
      try {
        setIsLoading(true);
        await api.put(`/notes/${noteId}/collaborators/${collaboratorId}`, { permission });
        await loadShareData();
        if (onShareChange) onShareChange();
        showToast('Permission updated successfully!', 'success');
      } catch (error: any) {
        showToast('Failed to update permission. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const copyShareLink = async () => {
      const success = await copyToClipboard(generateShareLink(noteId));
      if (success) {
        showToast('Link copied to clipboard!', 'success');
      } else {
        showToast('Failed to copy link', 'error');
      }
    };

    // Use store state for icon and text
    const getPermissionIcon = () => {
      if (currentNote && (currentNote as any).shareSettings && (currentNote as any).shareSettings.isPublic) {
        return <Globe className="w-4 h-4 text-white" />;
      }
      if (collaborators.length > 0) {
        return <Users className="w-4 h-4 text-white" />;
      }
      return null;
    };

    const getPermissionText = () => {
      if (currentNote && (currentNote as any).isPublic) {
        return shareSettings.allowEdit ? 'Anyone with link can edit' : 'Anyone with link can view';
      }
      if (collaborators.length > 0) {
        return `${collaborators.length} collaborator${collaborators.length > 1 ? 's' : ''}`;
      }
      return 'Private';
    };

    // Helper function to validate email format
    const isValidEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    };

    // Debounced save for share settings
    const debouncedSaveSettings = React.useRef(debounce(updateShareSettings, 200)).current;

    return (
      <>
        <button
          ref={internalButtonRef}
          onClick={() => {
            if (setOpen) {
              setOpen(!actualOpen);
            } else {
              setIsModalOpen((v) => !v);
            }
          }}
          className={`flex items-center rounded-md bg-[#232323] hover:bg-[#343434] text-white transition-colors text-xsrounded-l-lg rounded-r-none bg-[#818cf8] hover:bg-[#6366f1] text-black px-2 h-8 border border-[#818cf8] border-r-0 focus:outline-none transition-all duration-200 text-sm font-medium flex items-center gap-2`}
          title="Share note"
        >
          <span className="text-sm font-medium">Share</span>
          {getPermissionIcon()}
        </button>

        {actualOpen && createPortal(
          <div
            ref={dropdownRef || modalRef}
            className="bg-[#181818] rounded-xl shadow-2xl border border-[#232323] w-72 max-h-[75vh] flex flex-col"
            style={dropdownStyle}
          >
            {/* Invite by Email */}
            <div className="p-3 border-b border-[#232323]">
              <input
                type="email"
                value={newCollaborator}
                onChange={(e) => setNewCollaborator(e.target.value)}
                placeholder="Add name or email"
                className={`w-full px-1.5 py-1 bg-[#232323] border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs ${
                  newCollaborator.trim() && !isValidEmail(newCollaborator)
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-[#333]'
                }`}
              />
              <div className="flex items-center mt-2">
                <div className="relative flex-1">
                  <select
                    value={newCollaboratorPermission}
                    onChange={(e) => setNewCollaboratorPermission(e.target.value as 'view' | 'edit' | 'full')}
                    className="w-full px-1.5 py-1 bg-[#232323] border border-[#333] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-xs"
                  >
                    <option value="full">Full access</option>
                    <option value="edit">Can edit</option>
                    <option value="view">Can view</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
                <button
                  onClick={addCollaborator}
                  disabled={!newCollaborator.trim() || !isValidEmail(newCollaborator) || isLoading}
                  className="ml-2 px-2 py-1 bg-[#232323] border border-[#333] text-white rounded-md hover:bg-[#343434] disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  style={{ minWidth: 90 }}
                >
                  Send invite
                </button>
              </div>
              {newCollaborator.trim() && !isValidEmail(newCollaborator) && (
                <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>
              )}
            </div>

            {/* People with access */}
            <div className="p-3 border-b border-[#232323]">
              <div className="text-xs text-gray-400 mb-1.5">People with access {collaborators.length + 1}</div>
              <div className="space-y-1.5">
                {/* Owner always first */}
                <div className="flex items-center gap-1.5 p-1 rounded hover:bg-[#232323]">
                  <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs">
                    {isUserObject(currentNote?.userId) && currentNote?.userId?.name
                      ? currentNote.userId.name[0]?.toUpperCase()
                      : isUserObject(currentNote?.userId) && currentNote?.userId?.email
                        ? currentNote.userId.email[0]?.toUpperCase()
                        : typeof currentNote?.userId === 'string' && currentNote.userId[0]
                          ? currentNote.userId[0].toUpperCase()
                          : 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="text-white text-xs font-medium">{isUserObject(currentNote?.userId) && currentNote?.userId?.name
                      ? currentNote.userId.name
                      : 'You'} <span className="text-xs text-gray-400 ml-1">· You</span></div>
                    <div className="text-xs text-gray-400">{isUserObject(currentNote?.userId) && currentNote?.userId?.email
                      ? currentNote.userId.email
                      : typeof currentNote?.userId === 'string'
                        ? currentNote.userId
                        : ''}</div>
                  </div>
                  <div className="text-xs text-gray-400 mr-1.5">Owner</div>
                </div>
                {collaborators.map((c: Collaborator) => {
                  const emailStr = typeof c.email === 'string' ? c.email : '';
                  const userObj = isUserObject(c.userId) ? c.userId : undefined;
                  return (
                    <div key={c._id} className="flex items-center gap-1.5 p-1 rounded hover:bg-[#232323]">
                      <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs">
                        {userObj && userObj.name ? userObj.name[0]?.toUpperCase() : (emailStr ? emailStr[0].toUpperCase() : 'U')}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-xs font-medium">{userObj && userObj.name ? userObj.name : (emailStr || 'Unknown')}</div>
                        <div className="text-xs text-gray-400">{userObj && userObj.email ? userObj.email : emailStr}</div>
                      </div>
                      <div className="text-xs text-gray-400 mr-1.5 capitalize">
                        {c.permission === 'full' ? 'Full access' : c.permission === 'edit' ? 'Can edit' : 'Can view'}
                      </div>
                      <button
                        onClick={() => removeCollaborator(c._id)}
                        className="p-1 text-gray-400 hover:text-red-400"
                        title="Remove collaborator"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Link sharing section */}
            <div className="p-3">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-white flex-shrink-0" />
                <div className="relative flex-1 min-w-0">
                  <select
                    value={selectValue}
                    onChange={e => {
                      const value = e.target.value;
                      let newSettings: ShareSettings | undefined = undefined;
                      if (value === 'restricted') {
                        newSettings = { ...shareSettings, isPublic: false, allowEdit: false };
                      } else if (value === 'public-view') {
                        newSettings = { ...shareSettings, isPublic: true, allowEdit: false };
                      } else if (value === 'public-edit') {
                        newSettings = { ...shareSettings, isPublic: true, allowEdit: true };
                      }
                      if (newSettings) {
                        updateShareSettings(newSettings);
                        debouncedSaveSettings(newSettings);
                        showToast('Sharing settings updated!', 'success');
                      }
                    }}
                    className="px-1.5 py-1 bg-[#232323] border border-[#333] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none w-full text-xs"
                    style={{ minWidth: 120 }}
                  >
                    <option value="restricted">Restricted</option>
                    <option value="public-view">Anyone with the link can view</option>
                    <option value="public-edit">Anyone with the link can edit</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
                <button
                  onClick={copyShareLink}
                  className="px-2 py-1 bg-[#232323] border border-[#333] rounded-md text-white hover:bg-[#343434] flex items-center gap-1.5 flex-shrink-0 text-xs"
                  style={{ minWidth: 40 }}
                >
                  <LinkIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
); 