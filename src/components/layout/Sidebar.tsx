import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Star,
  FileText,
  Book,
  Users,
  Tag as TagIcon,
  Trash2,
  ChevronDown,
  Settings,
  Menu,
  Calendar,
  BookOpen,
  ChevronLeft,
  Package,
  Plus,
  Folder,
  CheckSquare,
  NotebookTabs,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNotesStore } from '../../stores/useNotesStore';
import { useUIStore } from '../../stores/useUIStore';
import { useNotebooksStore } from '../../stores/useNotebooksStore';
import { useWorkspacesStore } from '../../stores/useWorkspacesStore';
import { useTagsStore, Tag } from '../../stores/useTagsStore';
import { useTagsModal } from '../../hooks/useTagsModal';
import { TagsModal } from '../modals/TagsModal';
import logo from './logo.png';


const navigationItems = [
  { id: 'dashboard', name: 'Home', icon: Home, path: '/dashboard', color: 'text-blue-600' },
  { id: 'shortcuts', name: 'Shortcuts', icon: Star, path: '/shortcuts', badge: 3, color: 'text-yellow-500' },
  { id: 'notes', name: 'Notes', icon: FileText, path: '/notes', color: 'text-green-600' },
  { id: 'notebooks', name: 'Notebooks', icon: NotebookTabs, path: '/notebooks', color: 'text-purple-600 dark:text-purple-300 black:text-purple-200' },
  { id: 'files', name: 'Files', icon: Folder, path: '/files', color: 'text-blue-500' },
  { id: 'tasks', name: 'Tasks', icon: CheckSquare, path: '/tasks', color: 'text-emerald-600' },
  { id: 'templates', name: 'Templates', icon: BookOpen, path: '/templates', color: 'text-orange-600' },
  { id: 'shared', name: 'Shared with Me', icon: Users, path: '/shared', color: 'text-indigo-600' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, path: '/calendar', color: 'text-red-600' },
  { id: 'tags', name: 'Tags', icon: TagIcon, path: '', color: 'text-pink-600' },
  { id: 'trash', name: 'Trash', icon: Trash2, path: '/trash', color: 'text-gray-600' }
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createNote, setCurrentNote, notes, fetchNotes } = useNotesStore();
  const { toggleSearchModal } = useUIStore();
  const { notebooks, createNotebook, fetchNotebooks, setCurrentNotebook } = useNotebooksStore();
  const { workspaces, fetchWorkspaces, createWorkspace } = useWorkspacesStore();
  const { tags, fetchTags, createTag, deleteTag, updateTag } = useTagsStore();
  const { isTagsModalOpen, openTagsModal, closeTagsModal } = useTagsModal();

  // Wrapper functions for tags modal
  const handleAddTag = async (tag: Partial<Tag>) => {
    try {
      const newTag = await createTag(tag);
      await fetchTags(); // Refresh tags
      return newTag;
    } catch (error) {
      console.error('Failed to create tag:', error);
      throw error;
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      await fetchTags(); // Refresh tags
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  };

  const handleEditTag = async (tagId: string, tag: Partial<Tag>) => {
    try {
      const updatedTag = await updateTag(tagId, tag);
      await fetchTags(); // Refresh tags
      return updatedTag;
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  };
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notebooksDropdownOpen, setNotebooksDropdownOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);

  // Workspace state
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  // Workspace creation handler
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreatingWorkspace(true);
    try {
      const newWorkspace = await createWorkspace({
        name: newWorkspaceName.trim(),
        description: '',
        icon: 'briefcase',
        color: '#3B82F6'
      });
      setNewWorkspaceName('');
      setShowCreateWorkspaceModal(false);
      navigate(`/workspaces/${newWorkspace._id}`);
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // Fetch notebooks, tags, and workspaces on mount
  React.useEffect(() => {
    fetchNotebooks();
    fetchTags();
    fetchWorkspaces();
  }, [fetchNotebooks, fetchTags, fetchWorkspaces]);

  const handleCreateNote = async () => {
    try {
      if (!user) {
        console.error('User not authenticated');
        navigate('/login');
        return;
      }

      console.log('Creating new note...');
      const newNote = await createNote({
        // title: '',
      });

      console.log('Note created, navigating to editor...');

      setCurrentNote(newNote);
      navigate(`/notes?note=${newNote._id}`);
      setIsMobileOpen(false);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  const handleSearchClick = () => {
    toggleSearchModal();
    setIsMobileOpen(false);
  };

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookName.trim()) return;
    setCreatingNotebook(true);
    try {
      const nb = await createNotebook({ name: newNotebookName.trim() });
      setNewNotebookName('');
      setCreatingNotebook(false);
      setNotebooksDropdownOpen(false);
      setCurrentNotebook(nb);
      navigate(`/notebooks/${nb._id}`);
      setShowNotebookModal(false);
    } catch (err) {
      setCreatingNotebook(false);
    }
  };

  const sidebarContent = (
    <div className={`flex flex-col h-full ${isCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-900 black:bg-[#181818] shadow-lg z-10 transition-all duration-300 relative`}>
      <div className="p-3">
        {/* Header: Logo + Collapse Toggle */}
        <div className={`flex items-center mb-6 ${isCollapsed ? 'flex-col space-y-4 items-center' : 'justify-between'}`}>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img src={logo} alt="Logo" className="w-6 h-5" />
            </div>
            {!isCollapsed && <span className="font-bold text-base text-gray-800 dark:text-gray-100 black:text-gray-100 truncate">Hywiz Note</span>}
          </div>
          {/* Modern Collapse Toggle */}
          <button
            className={`hidden lg:flex items-center justify-center w-6 h-6 rounded-lg text-gray-500 dark:text-gray-400 black:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] hover:text-gray-800 dark:hover:text-gray-100 black:hover:text-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <div className="space-y-4">
          <div>
            {!isCollapsed && <h3 className="text-xs font-bold text-gray-800 mb-3">Navigations</h3>}
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.path;

                if (item.id === 'notebooks') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavigation(item.path)}
                      className={`flex items-center p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] cursor-pointer ${isCollapsed ? 'justify-center' : 'space-x-2'}`}
                    >
                      <IconComponent className={`w-4 h-4 ${item.color} shrink-0`} />
                      {!isCollapsed && <span className="font-bold text-xs text-gray-800 dark:text-gray-200 black:text-gray-200">{item.name}</span>}
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'notes') {
                        if (!notes || notes.length === 0) {
                          fetchNotes();
                        }
                        const firstNote = notes && notes.length > 0 ? notes[0] : null;
                        if (firstNote) {
                          navigate(`/notes?note=${firstNote._id}`);
                        } else {
                          navigate(item.path);
                        }
                        setIsMobileOpen(false);
                      } else if (item.id === 'tags') {
                        // Open tags modal instead of navigating
                        openTagsModal();
                        setIsMobileOpen(false);
                      } else {
                        handleNavigation(item.path);
                      }
                    }}
                    className={`flex items-center p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] cursor-pointer ${isCollapsed ? 'justify-center' : 'space-x-2'}`}
                  >
                    <IconComponent className={`w-4 h-4 ${item.color} shrink-0`} />
                    {!isCollapsed && <span className="font-bold text-xs text-gray-800 dark:text-gray-200 black:text-gray-200">{item.name}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {!isCollapsed && <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 black:text-gray-200 mb-3">Workspaces</h3>}
            <div className="space-y-1">
              {workspaces && workspaces.length > 0 ? (
                <>
                  {workspaces.slice(0, 3).map((workspace) => (
                    <div key={workspace._id} className={`flex items-center p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-gray-50 dark:bg-gray-800 black:bg-[#2f2f2f] hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] cursor-pointer transition-colors ${isCollapsed ? 'justify-center' : 'gap-2'}`} onClick={() => navigate(`/workspaces/${workspace._id}`)}>
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0">
                        <Package className="w-3 h-3" style={{ color: workspace.color }} />
                      </div>
                      {!isCollapsed && <span className="font-medium text-xs text-gray-800 dark:text-gray-200 black:text-gray-200 truncate">{workspace.name}</span>}
                    </div>
                  ))}
                  {!isCollapsed && (
                    <div className="space-y-1 pt-1">
                      <button
                        onClick={() => setShowCreateWorkspaceModal(true)}
                        className="w-full h-8 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] text-gray-700 dark:text-gray-200 black:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] transition-colors"
                        title="Create a new workspace"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Workspace</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                !isCollapsed && (
                  <button
                    onClick={() => setShowCreateWorkspaceModal(true)}
                    className="w-full h-8 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] text-gray-700 dark:text-gray-200 black:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] transition-colors"
                    title="Create a new workspace"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Workspace</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div
              onClick={() => {
                navigate('/settings');
                setIsMobileOpen(false);
              }}
              className={`flex items-center p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer ${isCollapsed ? 'justify-center' : 'space-x-2'}`}
            >
              <Settings className="w-4 h-4 text-gray-700 shrink-0" />
              {!isCollapsed && <span className="font-bold text-xs text-gray-800">Settings</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        />
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex bg-white dark:bg-gray-900 black:bg-[#181818] text-gray-800 flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'
        }`}>
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 black:bg-[#181818] text-gray-800 flex flex-col transform transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-3 right-3 z-50 p-2 rounded-full bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 text-gray-800 focus:outline-none shadow-lg"
          aria-label="Close sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {sidebarContent}
      </div>

      {/* Tags Modal */}
      <TagsModal
        isOpen={isTagsModalOpen}
        onClose={closeTagsModal}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        onEditTag={handleEditTag}
      />

      {/* Create Workspace Modal */}
      {showCreateWorkspaceModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Create New Work Space</h3>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="workspaceName"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., My Project"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateWorkspaceModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWorkspace}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {creatingWorkspace ? 'Creating...' : 'Create Work Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};