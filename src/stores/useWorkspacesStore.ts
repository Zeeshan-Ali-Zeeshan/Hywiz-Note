import { create } from 'zustand';
import api from '../lib/api';

export interface Workspace {
  _id: string;
  name: string;
  description: string;
  userId: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  notebookCount: number;
  noteCount: number;
  collaborators: Array<{
    userId: string;
    permission: 'read' | 'write' | 'admin';
    addedAt: string;
  }>;
  settings: {
    allowPublicSharing: boolean;
    autoArchive: boolean;
    archiveAfterDays: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceWithContent {
  workspace: Workspace;
  notebooks: Array<{
    _id: string;
    name: string;
    description: string;
    userId: string;
    noteCount: number;
    color: string;
    icon: string;
    isDefault: boolean;
    coverImage: string;
    createdAt: string;
    updatedAt: string;
  }>;
  notes: Array<{
    _id: string;
    title: string;
    preview: string;
    date: string;
    thumbnail?: string;
    tags: string[];
    isPinned: boolean;
    category: string;
  }>;
}

interface WorkspacesState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  defaultWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspace: (id: string) => Promise<WorkspaceWithContent>;
  createWorkspace: (data: Partial<Workspace>) => Promise<Workspace>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  getWorkspaceById: (id: string) => Workspace | undefined;
  addCollaborator: (workspaceId: string, userId: string, permission: string) => Promise<Workspace>;
  removeCollaborator: (workspaceId: string, collaboratorId: string) => Promise<Workspace>;
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  defaultWorkspace: null,
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/workspaces');
      const workspaces = response.data;
      const defaultWorkspace = workspaces.find((ws: Workspace) => ws.isDefault);

      set({
        workspaces,
        defaultWorkspace,
        loading: false
      });
    } catch (error) {
      console.error('Fetch workspaces error:', error);
      set({
        loading: false,
        error: 'Failed to fetch workspaces'
      });
    }
  },

  fetchWorkspace: async (id: string) => {
    try {
      const response = await api.get(`/workspaces/${id}`);
      return response.data;
    } catch (error) {
      console.error('Fetch workspace error:', error);
      throw error;
    }
  },

  createWorkspace: async (data: Partial<Workspace>) => {
    try {
      const response = await api.post('/workspaces', data);
      const newWorkspace = response.data;

      set(state => ({
        workspaces: [...state.workspaces, newWorkspace],
        currentWorkspace: newWorkspace,
        defaultWorkspace: newWorkspace.isDefault ? newWorkspace : state.defaultWorkspace
      }));

      return newWorkspace;
    } catch (error) {
      console.error('Create workspace error:', error);
      throw error;
    }
  },

  updateWorkspace: async (id: string, data: Partial<Workspace>) => {
    try {
      const response = await api.put(`/workspaces/${id}`, data);
      const updatedWorkspace = response.data;

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace._id === id ? updatedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?._id === id ? updatedWorkspace : state.currentWorkspace,
        defaultWorkspace: updatedWorkspace.isDefault ? updatedWorkspace : state.defaultWorkspace
      }));

      return updatedWorkspace;
    } catch (error) {
      console.error('Update workspace error:', error);
      throw error;
    }
  },

  deleteWorkspace: async (id: string) => {
    try {
      await api.delete(`/workspaces/${id}`);
      set(state => ({
        workspaces: state.workspaces.filter(workspace => workspace._id !== id),
        currentWorkspace: state.currentWorkspace?._id === id ? null : state.currentWorkspace
      }));
    } catch (error) {
      console.error('Delete workspace error:', error);
      throw error;
    }
  },

  setCurrentWorkspace: (workspace: Workspace | null) => {
    set({ currentWorkspace: workspace });
  },

  getWorkspaceById: (id: string) => {
    return get().workspaces.find(workspace => workspace._id === id);
  },

  addCollaborator: async (workspaceId: string, userId: string, permission: string) => {
    try {
      const response = await api.post(`/workspaces/${workspaceId}/collaborators`, {
        userId,
        permission
      });
      const updatedWorkspace = response.data;

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace._id === workspaceId ? updatedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?._id === workspaceId ? updatedWorkspace : state.currentWorkspace
      }));

      return updatedWorkspace;
    } catch (error) {
      console.error('Add collaborator error:', error);
      throw error;
    }
  },

  removeCollaborator: async (workspaceId: string, collaboratorId: string) => {
    try {
      const response = await api.delete(`/workspaces/${workspaceId}/collaborators/${collaboratorId}`);
      const updatedWorkspace = response.data;

      set(state => ({
        workspaces: state.workspaces.map(workspace =>
          workspace._id === workspaceId ? updatedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?._id === workspaceId ? updatedWorkspace : state.currentWorkspace
      }));

      return updatedWorkspace;
    } catch (error) {
      console.error('Remove collaborator error:', error);
      throw error;
    }
  },
}));

// --- SOCKET.IO REALTIME LISTENERS ---
import socket from '../lib/socket';
if (typeof window !== 'undefined' && socket && !(window as any)._workspacesListenersAdded) {
  socket.on('workspace-created', ({ workspace }) => {
    useWorkspacesStore.setState(state => ({ workspaces: [...state.workspaces, workspace] }));
  });
  socket.on('workspace-updated', ({ workspace }) => {
    useWorkspacesStore.setState(state => ({
      workspaces: state.workspaces.map(w => w._id === workspace._id ? workspace : w),
      currentWorkspace: state.currentWorkspace && state.currentWorkspace._id === workspace._id ? workspace : state.currentWorkspace,
      defaultWorkspace: workspace.isDefault ? workspace : state.defaultWorkspace
    }));
  });
  socket.on('workspace-deleted', ({ workspaceId }) => {
    useWorkspacesStore.setState(state => ({
      workspaces: state.workspaces.filter(w => w._id !== workspaceId),
      currentWorkspace: state.currentWorkspace && state.currentWorkspace._id === workspaceId ? null : state.currentWorkspace
    }));
  });
  (window as any)._workspacesListenersAdded = true;
} 