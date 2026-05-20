import { create } from 'zustand';
import api from '../lib/api';

export interface Notebook {
  _id: string;
  name: string;
  description: string;
  userId: string;
  workspaceId: string;
  noteCount: number;
  color: string;
  icon: string;
  isDefault: boolean;
  coverImage: string;
  createdAt: string;
  updatedAt: string;
}

interface NotebooksState {
  notebooks: Notebook[];
  currentNotebook: Notebook | null;
  defaultNotebook: Notebook | null;
  loading: boolean;

  // Actions
  fetchNotebooks: () => Promise<void>;
  fetchNotebook: (id: string) => Promise<Notebook>;
  createNotebook: (data: Partial<Notebook>) => Promise<Notebook>;
  updateNotebook: (id: string, data: Partial<Notebook>) => Promise<Notebook>;
  deleteNotebook: (id: string) => Promise<void>;
  setCurrentNotebook: (notebook: Notebook | null) => void;
  getNotebookById: (id: string) => Notebook | undefined;
}

export const useNotebooksStore = create<NotebooksState>((set, get) => ({
  notebooks: [],
  currentNotebook: null,
  defaultNotebook: null,
  loading: false,

  fetchNotebooks: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/notebooks');
      const notebooks = response.data;
      const defaultNotebook = notebooks.find((nb: Notebook) => nb.isDefault);
      
      set({ 
        notebooks,
        defaultNotebook,
        loading: false 
      });
    } catch (error) {
      console.error('Fetch notebooks error:', error);
      set({ loading: false });
    }
  },

  fetchNotebook: async (id: string) => {
    try {
      const response = await api.get(`/notebooks/${id}`);
      return response.data;
    } catch (error) {
      console.error('Fetch notebook error:', error);
      throw error;
    }
  },

  createNotebook: async (data: Partial<Notebook>) => {
    try {
      const response = await api.post('/notebooks', data);
      const newNotebook = response.data;
      
      set(state => ({
        notebooks: [...state.notebooks, newNotebook]
      }));
      
      return newNotebook;
    } catch (error) {
      console.error('Create notebook error:', error);
      throw error;
    }
  },

  updateNotebook: async (id: string, data: Partial<Notebook>) => {
    try {
      const response = await api.put(`/notebooks/${id}`, data);
      const updatedNotebook = response.data;
      
      set(state => ({
        notebooks: state.notebooks.map(notebook => 
          notebook._id === id ? updatedNotebook : notebook
        ),
        currentNotebook: state.currentNotebook?._id === id ? updatedNotebook : state.currentNotebook,
        defaultNotebook: updatedNotebook.isDefault ? updatedNotebook : state.defaultNotebook
      }));
      
      return updatedNotebook;
    } catch (error) {
      console.error('Update notebook error:', error);
      throw error;
    }
  },

  deleteNotebook: async (id: string) => {
    try {
      await api.delete(`/notebooks/${id}`);
      set(state => ({
        notebooks: state.notebooks.filter(notebook => notebook._id !== id),
        currentNotebook: state.currentNotebook?._id === id ? null : state.currentNotebook
      }));
    } catch (error) {
      console.error('Delete notebook error:', error);
      throw error;
    }
  },

  setCurrentNotebook: (notebook: Notebook | null) => {
    set({ currentNotebook: notebook });
  },

  getNotebookById: (id: string) => {
    return get().notebooks.find(notebook => notebook._id === id);
  },
}));

// --- SOCKET.IO REALTIME LISTENERS ---
import socket from '../lib/socket';
if (typeof window !== 'undefined' && socket && !(window as any)._notebooksListenersAdded) {
  socket.on('notebook-created', ({ notebook }) => {
    useNotebooksStore.setState(state => ({ notebooks: [...state.notebooks, notebook] }));
  });
  socket.on('notebook-updated', ({ notebook }) => {
    useNotebooksStore.setState(state => ({
      notebooks: state.notebooks.map(n => n._id === notebook._id ? notebook : n),
      currentNotebook: state.currentNotebook && state.currentNotebook._id === notebook._id ? notebook : state.currentNotebook,
      defaultNotebook: notebook.isDefault ? notebook : state.defaultNotebook
    }));
  });
  socket.on('notebook-deleted', ({ notebookId }) => {
    useNotebooksStore.setState(state => ({
      notebooks: state.notebooks.filter(n => n._id !== notebookId),
      currentNotebook: state.currentNotebook && state.currentNotebook._id === notebookId ? null : state.currentNotebook
    }));
  });
  (window as any)._notebooksListenersAdded = true;
}