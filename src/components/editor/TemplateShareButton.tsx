import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Users, Globe, X, Link as LinkIcon } from 'lucide-react';
import api from '../../lib/api';
import { copyToClipboard, generateShareLink } from '../../lib/utils';
import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/useToastStore';
import socket from '../../lib/socket';
import { useTemplatesStore } from '../../stores/useTemplatesStore';

interface TemplateShareButtonProps {
  templateId: string;
  templateTitle?: string;
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
  permission: 'read' | 'write' | 'admin';
  status?: 'pending' | 'accepted' | 'declined';
  invitedAt?: string;
  acceptedAt?: string;
}

function debounce(fn: (settings: ShareSettings) => void, delay: number) {
  let timer: NodeJS.Timeout;
  return (settings: ShareSettings) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(settings), delay);
  };
}

function isUserObject(user: any): user is { name?: string; email?: string } {
  return user && typeof user === 'object' && ('name' in user || 'email' in user);
}

export const TemplateShareButton = forwardRef<HTMLButtonElement, TemplateShareButtonProps>(
  ({ templateId, templateTitle, className = '', onClose, open, setOpen, dropdownRef, onShareChange }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [activeTab, setActiveTab] = useState<'share' | 'collaborators' | 'settings'>('share');
    const modalRef = useRef<HTMLDivElement>(null);
    const internalButtonRef = useRef<HTMLButtonElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const showToast = useToastStore((state) => state.showToast);
    const [, forceUpdate] = useState(0);

    const template = useTemplatesStore(state => state.templates.find(t => t._id === templateId));
    const shareSettings = {
      isPublic: template?.isPublic || false,
      allowEdit: false, // adjust if you add edit support
      allowComments: false, // adjust if you add comment support
      passwordProtected: false, // adjust if you add password support
      password: '',
      expiresAt: ''
    };
    const collaborators = template?.collaborators || [];
    const shareLink = template?.shareLink || `${window.location.origin}/template/${templateId}`;

    const [newCollaborator, setNewCollaborator] = useState('');
    const [newCollaboratorPermission, setNewCollaboratorPermission] = useState<'read' | 'write' | 'admin'>('read');

    useImperativeHandle(ref, () => internalButtonRef.current as HTMLButtonElement);

    useEffect(() => {
      if (templateId) {
        loadShareData();
      }
    }, [templateId]);

    useEffect(() => {
      if (isModalOpen && templateId) {
        loadShareData();
      }
    }, [isModalOpen, templateId]);

    useEffect(() => {
      // Force a re-render when shareSettings or collaborators change
      forceUpdate(n => n + 1);
    }, [template?.isPublic, template?.collaborators]);

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

    useEffect(() => {
      if (onClose) {
        setIsModalOpen(true);
      }
    }, [onClose]);

    const actualOpen = open !== undefined ? open : isModalOpen;

    useEffect(() => {
      if (!actualOpen || !internalButtonRef.current) return;
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

    const loadShareData = async () => {
      try {
        setIsLoading(true);
        // No need to reload data since it comes from the store
        // The store automatically updates via socket events
      } catch (error) {
        console.error('Template share data load error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const updateShareSettings = async (settings: ShareSettings) => {
      try {
        setIsLoading(true);
        await api.post(`/templates/${templateId}/share`, settings);
        if (onShareChange) onShareChange();
        showToast('Sharing settings updated!', 'success');
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
        console.log('TemplateShareButton: Adding collaborator', { 
          templateId, 
          email: newCollaborator.trim(), 
          permission: newCollaboratorPermission 
        });
        
        setIsLoading(true);
        const response = await api.post(`/templates/${templateId}/collaborators`, {
          email: newCollaborator.trim(),
          permission: newCollaboratorPermission
        });
        
        console.log('TemplateShareButton: Collaborator added successfully', { 
          response: response.data,
          templateId: response.data._id,
          collaboratorsCount: response.data.collaborators?.length
        });
        
        setNewCollaborator('');
        if (onShareChange) onShareChange();
        showToast('Invitation sent!', 'success');
      } catch (error: any) {
        console.error('TemplateShareButton: Failed to add collaborator', { 
          error: error.response?.data,
          status: error.response?.status 
        });
        
        if (
          error.response?.status === 400 &&
          error.response?.data?.message === 'This user is already a collaborator on this template'
        ) {
          const collaboratorsResponse = await api.get(`/templates/${templateId}`);
          const freshCollaborators = collaboratorsResponse.data.collaborators || [];
          const targetEmail = newCollaborator.trim().toLowerCase();
          const existing = freshCollaborators.find(
            (c: Collaborator) => (isUserObject(c.userId) && c.userId.email && c.userId.email.trim().toLowerCase() === targetEmail) ||
                 (typeof c.email === 'string' && c.email.trim().toLowerCase() === targetEmail)
          );
          if (existing) {
            await updateCollaboratorPermission(existing._id, newCollaboratorPermission);
            setNewCollaborator('');
            showToast('Collaborator permission updated!', 'success');
            return;
          }
        }
        showToast('Failed to invite collaborator. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const removeCollaborator = async (collaboratorId: string) => {
      try {
        console.log('TemplateShareButton: Removing collaborator', { 
          templateId, 
          collaboratorId 
        });
        
        setIsLoading(true);
        await api.delete(`/templates/${templateId}/collaborators/${collaboratorId}`);
        
        console.log('TemplateShareButton: Collaborator removed successfully', { 
          templateId, 
          collaboratorId 
        });
        
        if (onShareChange) onShareChange();
        showToast('Collaborator removed successfully!', 'success');
      } catch (error: any) {
        console.error('TemplateShareButton: Failed to remove collaborator', { 
          error: error.response?.data,
          status: error.response?.status,
          templateId,
          collaboratorId
        });
        
        if (error.response?.data?.message) {
          showToast(error.response.data.message, 'error');
        } else {
          showToast('Failed to remove collaborator. Please try again.', 'error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    const updateCollaboratorPermission = async (collaboratorId: string, permission: 'read' | 'write' | 'admin') => {
      try {
        setIsLoading(true);
        await api.put(`/templates/${templateId}/collaborators/${collaboratorId}`, { permission });
        if (onShareChange) onShareChange();
        showToast('Permission updated successfully!', 'success');
      } catch (error: any) {
        if (error.response?.data?.message) {
          showToast(error.response.data.message, 'error');
        } else {
          showToast('Failed to update permission. Please try again.', 'error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    const copyShareLink = async () => {
      const success = await copyToClipboard(shareLink);
      if (success) {
        showToast('Link copied to clipboard!', 'success');
      } else {
        showToast('Failed to copy link', 'error');
      }
    };

    const getPermissionIcon = () => {
      if (shareSettings.isPublic) {
        return <Globe className="w-3.5 h-3.5" />;
      }
      if (collaborators.length > 0) {
        return <Users className="w-3.5 h-3.5" />;
      }
      return null;
    };

    const getPermissionText = () => {
      if (shareSettings.isPublic) {
        return 'Anyone with link can view';
      }
      if (collaborators.length > 0) {
        return `${collaborators.length} collaborator${collaborators.length > 1 ? 's' : ''}`;
      }
      return 'Private';
    };

    const isValidEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    };

    const debouncedSaveSettings = React.useRef(debounce((settings: ShareSettings) => {
      updateShareSettings(settings);
      showToast('Sharing settings updated!', 'success');
    }, 200)).current;

    const collaboratorEmail = (c: any) => (typeof c.email === 'string' ? c.email : (c.userId && c.userId.email ? c.userId.email : ''));
    const collaboratorId = (c: any) => (c._id || (c.userId && c.userId._id) || '');



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
          className={`rounded-l-md rounded-r-none bg-[#818cf8] hover:bg-[#6366f1] text-white px-2 h-[36px] border border-[#818cf8] border-r-0 focus:outline-none transition-colors text-sm flex items-center gap-2 leading-none justify-center ${className}`}
          title="Share template"
        >
          <span className="text-sm font-medium">Share</span>
          {getPermissionIcon()}
        </button>
        <button
          onClick={copyShareLink}
          className="rounded-r-lg rounded-l-none bg-[#818cf8] hover:bg-[#6366f1] text-white px-3 h-[36px] border border-[#818cf8] border-l border-l-white/30 focus:outline-none transition-colors flex items-center justify-center"
          title="Copy template link"
          style={{ minWidth: 30 }}
        >
          <LinkIcon className="w-4 h-4 flex-shrink-0" />
        </button>
        
        {actualOpen && createPortal(
          <div
            ref={dropdownRef || modalRef}
            className="bg-white dark:bg-gray-800 black:bg-[#242424] text-gray-900 dark:text-gray-100 black:text-gray-100 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] w-96 max-h-[90vh] flex flex-col"
            style={dropdownStyle}
          >
            {/* Invite by Email */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
              <input
                type="email"
                value={newCollaborator}
                onChange={(e) => setNewCollaborator(e.target.value)}
                placeholder="Add name or email"
                className={`w-full px-3 py-2 bg-white dark:bg-gray-700 black:bg-[#2f2f2f] border rounded-md text-gray-900 dark:text-gray-100 black:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 black:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 text-xs ${
                  newCollaborator.trim() && !isValidEmail(newCollaborator)
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 black:border-[#3a3a3a]'
                }`}
              />
              <div className="flex items-center mt-3">
                <div className="relative flex-1">
                  <select
                    value={newCollaboratorPermission}
                    onChange={(e) => setNewCollaboratorPermission(e.target.value as 'admin' | 'write' | 'read')}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 black:bg-[#2f2f2f] border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] rounded-md text-gray-900 dark:text-gray-100 black:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none text-xs"
                  >
                    <option value="admin">Full access</option>
                    <option value="write">Can edit</option>
                    <option value="read">Can view</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
                <button
                  onClick={addCollaborator}
                  disabled={!newCollaborator.trim() || !isValidEmail(newCollaborator) || isLoading}
                  className="ml-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 black:bg-[#2f2f2f] border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] text-gray-900 dark:text-gray-100 black:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  style={{ minWidth: 110 }}
                >
                  Send invite
                </button>
              </div>
              {newCollaborator.trim() && !isValidEmail(newCollaborator) && (
                <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>
              )}
            </div>

            {/* People with access */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
              <div className="text-xs text-gray-400 mb-2">People with access {collaborators.length + 1}</div>
              <div className="space-y-2">
                {/* Owner always first */}
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a]">
                  <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-base">
                    T
                  </div>
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-gray-100 black:text-gray-100 text-sm font-medium">You <span className="text-xs text-gray-500 ml-1">· You</span></div>
                    <div className="text-xs text-gray-500">(owner)</div>
                  </div>
                  <div className="text-xs text-gray-500 mr-2">Owner</div>
                </div>
                {collaborators.map((c) => {
                  const userObj = isUserObject(c.userId) ? c.userId : undefined;
                  const collaboratorUserId = typeof c.userId === 'object' && c.userId._id ? c.userId._id : c.userId;
                  return (
                    <div key={collaboratorId(c)} className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a]">
                      <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-base">
                        {userObj && userObj.name ? userObj.name[0]?.toUpperCase() : (collaboratorEmail(c) ? collaboratorEmail(c)[0].toUpperCase() : 'U')}
                      </div>
                                        <div className="flex-1">
                    <div className="text-gray-900 dark:text-gray-100 black:text-gray-100 text-sm font-medium">{userObj && userObj.name ? userObj.name : (collaboratorEmail(c) || 'Unknown')}</div>
                    <div className="text-xs text-gray-500">{userObj && userObj.email ? userObj.email : collaboratorEmail(c)}</div>
                  </div>
                  <div className="text-xs text-gray-500 mr-2 capitalize">
                        {c.permission === 'admin' ? 'Full access' : c.permission === 'write' ? 'Can edit' : 'Can view'}
                      </div>
                      <button
                        onClick={() => removeCollaborator(collaboratorId(c))}
                        className="p-1 text-gray-500 hover:text-red-500"
                        title="Remove collaborator"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Link sharing section */}
            <div className="p-5">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="relative flex-1 min-w-0">
                  <select
                    value={shareSettings.isPublic ? (shareSettings.allowEdit ? 'public-edit' : 'public-view') : 'restricted'}
                    onChange={e => {
                      const value = e.target.value;
                      let newSettings = undefined;
                      if (value === 'restricted') {
                        newSettings = { ...shareSettings, isPublic: false, allowEdit: false };
                      } else if (value === 'public-view') {
                        newSettings = { ...shareSettings, isPublic: true, allowEdit: false };
                      } else if (value === 'public-edit') {
                        newSettings = { ...shareSettings, isPublic: true, allowEdit: true };
                      }
                      if (newSettings) {
                        updateShareSettings(newSettings); // Changed from setShareSettings to updateShareSettings
                        debouncedSaveSettings(newSettings);
                      }
                    }}
                    className="px-3 py-2 bg-white dark:bg-gray-700 black:bg-[#2f2f2f] border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] rounded-md text-gray-900 dark:text-gray-100 black:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none w-full text-xs"
                    style={{ minWidth: 140 }}
                  >
                    <option value="restricted">Restricted</option>
                    <option value="public-view">Anyone with the link can view</option>
                    <option value="public-edit">Anyone with the link can edit</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
                <button
                  onClick={copyShareLink}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 black:bg-[#2f2f2f] border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] rounded-md text-gray-900 dark:text-gray-100 black:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#2a2a2a] flex items-center gap-2 flex-shrink-0 text-xs"
                  style={{ minWidth: 50 }}
                >
                  <LinkIcon className="w-4 h-4" />
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

export default TemplateShareButton; 