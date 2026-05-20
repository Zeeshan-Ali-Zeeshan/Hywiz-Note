import { create } from 'zustand';
import api from '../lib/api';

export interface FileItem {
  _id: string;
  name: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  description: string;
  tags: Array<{
    _id: string;
    name: string;
    color: string;
  }>;
  isShared: boolean;
  sharedWith: Array<{
    user: string;
    permissions: 'read' | 'write' | 'admin';
  }>;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  workspace?: {
    _id: string;
    name: string;
  };
  notebook?: {
    _id: string;
    name: string;
  };
  isPublic: boolean;
  downloadCount: number;
  lastAccessedAt: string;
  isPinned: boolean;
  isShortcut: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
  };
  createdAt: string;
  updatedAt: string;
}


export interface FilesState {
  files: FileItem[];
  currentFile: FileItem | null;
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  total: number;
  
  // Actions
  fetchFiles: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    mimetype?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => Promise<void>;
  // uploadFile removed - files can only be uploaded through notes
  getFile: (id: string) => Promise<FileItem>;
  updateFile: (id: string, updates: Partial<FileItem>) => Promise<FileItem>;
  deleteFile: (id: string) => Promise<void>;
  downloadFile: (id: string) => Promise<void>;
  shareFile: (id: string, userIds: string[], permissions?: string) => Promise<void>;
  setCurrentFile: (file: FileItem | null) => void;
  clearError: () => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  currentFile: null,
  loading: false,
  error: null,
  totalPages: 0,
  currentPage: 1,
  total: 0,

  fetchFiles: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/files', { params });
      set({
        files: response.data.files,
        totalPages: response.data.totalPages,
        currentPage: response.data.currentPage,
        total: response.data.total,
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch files',
        loading: false
      });
      throw error;
    }
  },

  // uploadFile removed - files can only be uploaded through notes

  getFile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/files/${id}`);
      const file = response.data;
      set({
        currentFile: file,
        loading: false
      });
      return file;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch file',
        loading: false
      });
      throw error;
    }
  },

  updateFile: async (id: string, updates: Partial<FileItem>) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/files/${id}`, updates);
      const updatedFile = response.data.file;
      
      set(state => ({
        files: state.files.map(file => 
          file._id === id ? updatedFile : file
        ),
        currentFile: state.currentFile?._id === id ? updatedFile : state.currentFile,
        loading: false
      }));

      return updatedFile;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update file',
        loading: false
      });
      throw error;
    }
  },

  deleteFile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/files/${id}`);
      
      set(state => ({
        files: state.files.filter(file => file._id !== id),
        currentFile: state.currentFile?._id === id ? null : state.currentFile,
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete file',
        loading: false
      });
      throw error;
    }
  },

  downloadFile: async (id: string) => {
    try {
      // First get file info to get the correct MIME type
      const fileInfo = await api.get(`/files/${id}`);
      const file = fileInfo.data;
      
      const response = await api.get(`/files/${id}/download`, {
        responseType: 'blob',
      });
      
      // Create blob with correct MIME type
      const blob = new Blob([response.data], { type: file.mimetype });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Use the original filename
      link.setAttribute('download', file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to download file'
      });
      throw error;
    }
  },

  shareFile: async (id: string, userIds: string[], permissions = 'read') => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/files/${id}/share`, {
        userIds,
        permissions
      });
      
      const updatedFile = response.data.file;
      
      set(state => ({
        files: state.files.map(file => 
          file._id === id ? updatedFile : file
        ),
        currentFile: state.currentFile?._id === id ? updatedFile : state.currentFile,
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to share file',
        loading: false
      });
      throw error;
    }
  },


  setCurrentFile: (file: FileItem | null) => {
    set({ currentFile: file });
  },

  clearError: () => {
    set({ error: null });
  }
}));
