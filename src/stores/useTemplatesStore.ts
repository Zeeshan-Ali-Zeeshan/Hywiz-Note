import { create } from 'zustand';
import api from '../lib/api';
import { Tag } from './useTagsStore';
import { extractTitleFromYjs } from '../lib/yjsUtils';

export interface Template {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: Tag[] | string[];
  userId: any;
  isPublic: boolean;
  isPinned: boolean;
  isShortcut: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  collaborators: Array<{
    userId: any;
    permission: 'read' | 'write' | 'admin';
    addedAt: string;
  }>;
  shareLink?: string;
  shareExpiry?: string;
  usageCount: number;
  rating: number;
  ratingCount: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  yjsUpdate?: string; // YDoc update for collaborative editing
  fallbackContent?: string; // Fallback HTML content when YDoc is not available
}

interface TemplatesState {
  templates: Template[];
  currentTemplate: Template | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: {
    search: string;
    category: string;
    tags: string[];
    isPinned: boolean | null;
    isArchived: boolean | null;
    isPublic: boolean | null;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Actions
  fetchTemplates: (params?: any) => Promise<void>;
  fetchPublicTemplates: (params?: any) => Promise<void>;
  fetchTemplate: (id: string) => Promise<Template>;
  createTemplate: (templateData: Partial<Template>) => Promise<Template>;
  updateTemplate: (id: string, updates: Partial<Template>) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<Template>;
  createNoteFromTemplate: (id: string, notebookId?: string, workspaceId?: string) => Promise<any>;
  pinTemplate: (id: string) => Promise<void>;
  toggleShortcut: (id: string, isShortcut: boolean) => Promise<void>;
  archiveTemplate: (id: string) => Promise<void>;
  shareTemplate: (id: string, isPublic: boolean, shareExpiry?: string) => Promise<any>;
  addCollaborator: (id: string, email: string, permission: string) => Promise<Template>;
  updateCollaboratorPermission: (id: string, userId: string, permission: string) => Promise<Template>;
  removeCollaborator: (id: string, userId: string) => Promise<Template>;
  rateTemplate: (id: string, rating: number) => Promise<any>;
  getTemplateByShareLink: (shareLink: string) => Promise<Template>;
  updateTemplateYjsUpdate: (id: string, yjsUpdate: string) => Promise<void>;
  getCategories: () => Promise<string[]>;
  getStats: () => Promise<any>;
  setCurrentTemplate: (template: Template | null) => void;
  setFilters: (filters: Partial<TemplatesState['filters']>) => void;
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  clearError: () => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  currentTemplate: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  },
  filters: {
    search: '',
    category: '',
    tags: [],
    isPinned: null,
    isArchived: null,
    isPublic: null,
  },
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  fetchTemplates: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      
      const { filters, sortBy, sortOrder, pagination } = get();
      const queryParams = new URLSearchParams();
      
      // Add filters
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.tags.length > 0) queryParams.append('tags', filters.tags.join(','));
      if (filters.isPinned !== null) queryParams.append('isPinned', filters.isPinned.toString());
      if (filters.isArchived !== null) queryParams.append('isArchived', filters.isArchived.toString());
      if (filters.isPublic !== null) queryParams.append('isPublic', filters.isPublic.toString());
      
      // Add sorting
      queryParams.append('sortBy', sortBy);
      queryParams.append('sortOrder', sortOrder);
      
      // Add pagination
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      // Add custom params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get(`/templates?${queryParams.toString()}`);
      
      // Extract titles from Yjs for each template
      const templatesWithYjsTitles = response.data.templates.map((template: Template) => {
        if (template.yjsUpdate) {
          const yjsTitle = extractTitleFromYjs(template.yjsUpdate);
          return { ...template, title: yjsTitle || template.title || 'Untitled Template' };
        }
        return { ...template, title: template.title || 'Untitled Template' };
      });
      
      set({
        templates: templatesWithYjsTitles,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch templates',
        loading: false,
      });
    }
  },

  fetchPublicTemplates: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      
      const queryParams = new URLSearchParams();
      
      // Add custom params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get(`/templates/public?${queryParams.toString()}`);
      
      // Extract titles from Yjs for each template
      const templatesWithYjsTitles = response.data.templates.map((template: Template) => {
        if (template.yjsUpdate) {
          const yjsTitle = extractTitleFromYjs(template.yjsUpdate);
          return { ...template, title: yjsTitle || template.title || 'Untitled Template' };
        }
        return { ...template, title: template.title || 'Untitled Template' };
      });
      
      set({
        templates: templatesWithYjsTitles,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch public templates',
        loading: false,
      });
    }
  },

  fetchTemplate: async (id: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.get(`/templates/${id}`);
      const template = response.data;
      
      // Extract title from Yjs if available
      if (template.yjsUpdate) {
        const yjsTitle = extractTitleFromYjs(template.yjsUpdate);
        template.title = yjsTitle || template.title || 'Untitled Template';
      }
      
      set({
        currentTemplate: template,
        loading: false,
      });
      
      return template;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch template',
        loading: false,
      });
      throw error;
    }
  },

  createTemplate: async (templateData: Partial<Template>) => {
    try {
      set({ loading: true, error: null });
      
      console.log('🌐 Templates Store - Sending to API:', templateData);
      console.log('🌐 API endpoint: POST /templates');
      
      const response = await api.post('/templates', templateData);
      const newTemplate = response.data;
      
      console.log('🌐 API Response:', newTemplate);
      console.log('🌐 Response has fallbackContent:', 'fallbackContent' in newTemplate);
      console.log('🌐 Response fallbackContent:', newTemplate.fallbackContent);
      
      set((state) => ({
        templates: [newTemplate, ...state.templates],
        currentTemplate: newTemplate,
        loading: false,
      }));
      
      return newTemplate;
    } catch (error: any) {
      console.error('🌐 Templates Store - API Error:', error);
      console.error('🌐 Error response:', error.response?.data);
      
      set({
        error: error.response?.data?.message || 'Failed to create template',
        loading: false,
      });
      throw error;
    }
  },

  updateTemplate: async (id: string, updates: Partial<Template>) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.put(`/templates/${id}`, updates);
      const updatedTemplate = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? updatedTemplate : t
        ),
        currentTemplate: state.currentTemplate?._id === id ? updatedTemplate : state.currentTemplate,
        loading: false,
      }));
      
      return updatedTemplate;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update template',
        loading: false,
      });
      throw error;
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      set({ loading: true, error: null });
      
      await api.delete(`/templates/${id}`);
      
      set((state) => ({
        templates: state.templates.filter(t => t._id !== id),
        currentTemplate: state.currentTemplate?._id === id ? null : state.currentTemplate,
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete template',
        loading: false,
      });
      throw error;
    }
  },

  duplicateTemplate: async (id: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.post(`/templates/${id}/duplicate`);
      const duplicatedTemplate = response.data;
      
      set((state) => ({
        templates: [duplicatedTemplate, ...state.templates],
        currentTemplate: duplicatedTemplate,
        loading: false,
      }));
      
      return duplicatedTemplate;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to duplicate template',
        loading: false,
      });
      throw error;
    }
  },

  createNoteFromTemplate: async (id: string, notebookId?: string, workspaceId?: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.post(`/templates/${id}/create-note`, {
        notebookId,
        workspaceId
      });
      const newNote = response.data;
      
      set({ loading: false });
      
      return newNote;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create note from template',
        loading: false,
      });
      throw error;
    }
  },

  pinTemplate: async (id: string) => {
    try {
      const response = await api.post(`/templates/${id}/pin`);
      const { isPinned } = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? { ...t, isPinned } : t
        ),
        currentTemplate: state.currentTemplate?._id === id 
          ? { ...state.currentTemplate, isPinned }
          : state.currentTemplate,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to pin template',
      });
      throw error;
    }
  },

  toggleShortcut: async (id: string, isShortcut: boolean) => {
    try {
      await api.patch(`/templates/${id}/shortcut`, { isShortcut });
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? { ...t, isShortcut } : t
        ),
        currentTemplate: state.currentTemplate?._id === id 
          ? { ...state.currentTemplate, isShortcut }
          : state.currentTemplate,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to toggle template shortcut',
      });
      throw error;
    }
  },

  archiveTemplate: async (id: string) => {
    try {
      const response = await api.post(`/templates/${id}/archive`);
      const { isArchived } = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? { ...t, isArchived } : t
        ),
        currentTemplate: state.currentTemplate?._id === id 
          ? { ...state.currentTemplate, isArchived }
          : state.currentTemplate,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to archive template',
      });
      throw error;
    }
  },

  shareTemplate: async (id: string, isPublic: boolean, shareExpiry?: string) => {
    try {
      const response = await api.post(`/templates/${id}/share`, {
        isPublic,
        shareExpiry,
      });
      
      const { shareLink, shareExpiry: expiry } = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? { ...t, isPublic, shareLink, shareExpiry: expiry } : t
        ),
        currentTemplate: state.currentTemplate?._id === id 
          ? { ...state.currentTemplate, isPublic, shareLink, shareExpiry: expiry }
          : state.currentTemplate,
      }));
      
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to share template',
      });
      throw error;
    }
  },

  addCollaborator: async (id: string, email: string, permission: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.post(`/templates/${id}/collaborators`, {
        email,
        permission,
      });
      const updatedTemplate = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? updatedTemplate : t
        ),
        currentTemplate: state.currentTemplate?._id === id ? updatedTemplate : state.currentTemplate,
        loading: false,
      }));
      
      return updatedTemplate;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to add collaborator',
        loading: false,
      });
      throw error;
    }
  },

  updateCollaboratorPermission: async (id: string, userId: string, permission: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.put(`/templates/${id}/collaborators/${userId}`, {
        permission,
      });
      const updatedTemplate = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? updatedTemplate : t
        ),
        currentTemplate: state.currentTemplate?._id === id ? updatedTemplate : state.currentTemplate,
        loading: false,
      }));
      
      return updatedTemplate;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update collaborator permission',
        loading: false,
      });
      throw error;
    }
  },

  removeCollaborator: async (id: string, userId: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.delete(`/templates/${id}/collaborators/${userId}`);
      const updatedTemplate = response.data;
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? updatedTemplate : t
        ),
        currentTemplate: state.currentTemplate?._id === id ? updatedTemplate : state.currentTemplate,
        loading: false,
      }));
      
      return updatedTemplate;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to remove collaborator',
        loading: false,
      });
      throw error;
    }
  },

  rateTemplate: async (id: string, rating: number) => {
    try {
      const response = await api.post(`/templates/${id}/rate`, { rating });
      
      set((state) => ({
        templates: state.templates.map(t => 
          t._id === id ? { ...t, rating: response.data.rating, ratingCount: response.data.ratingCount } : t
        ),
        currentTemplate: state.currentTemplate?._id === id 
          ? { ...state.currentTemplate, rating: response.data.rating, ratingCount: response.data.ratingCount }
          : state.currentTemplate,
      }));
      
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to rate template',
      });
      throw error;
    }
  },

  getTemplateByShareLink: async (shareLink: string) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.get(`/templates/share/${shareLink}`);
      const template = response.data;
      
      set({
        currentTemplate: template,
        loading: false,
      });
      
      return template;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch shared template',
        loading: false,
      });
      throw error;
    }
  },

  updateTemplateYjsUpdate: async (id: string, yjsUpdate: string) => {
    try {
      await api.patch(`/templates/${id}/yjs-update`, { yjsUpdate });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update template YJS data',
      });
      throw error;
    }
  },

  getCategories: async () => {
    try {
      const response = await api.get('/templates/categories');
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch categories',
      });
      throw error;
    }
  },

  getStats: async () => {
    try {
      const response = await api.get('/templates/stats');
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch stats',
      });
      throw error;
    }
  },

  setCurrentTemplate: (template: Template | null) => {
    set({ currentTemplate: template });
  },

  setFilters: (filters: Partial<TemplatesState['filters']>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 }, // Reset to first page when filters change
    }));
  },

  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => {
    set({ sortBy, sortOrder });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// --- SOCKET.IO REALTIME LISTENERS ---
import socket from '../lib/socket';

// Function to setup socket listeners
const setupSocketListeners = () => {
  if (!socket.connected) {
    console.log('useTemplatesStore: Socket not connected, waiting for connection...');
    socket.on('connect', () => {
      console.log('useTemplatesStore: Socket connected, setting up listeners');
      setupSocketListeners();
    });
    return;
  }

  console.log('useTemplatesStore: Setting up socket listeners');
  
  socket.on('template-created', ({ template }) => {
    console.log('useTemplatesStore: template-created event received', { templateId: template._id });
    useTemplatesStore.setState(state => ({ templates: [template, ...state.templates] }));
  });
  
  socket.on('template-updated', ({ template }) => {
    console.log('useTemplatesStore: template-updated event received', { 
      templateId: template._id,
      isPublic: template.isPublic,
      collaboratorsCount: template.collaborators?.length,
      socketConnected: socket.connected,
      socketId: socket.id
    });
    
    useTemplatesStore.setState(state => {
      const newTemplates = state.templates.map(t => t._id === template._id ? template : t);
      const newCurrentTemplate = state.currentTemplate && state.currentTemplate._id === template._id ? template : state.currentTemplate;
      
      console.log('useTemplatesStore: Updated store state', {
        templatesCount: newTemplates.length,
        currentTemplateId: newCurrentTemplate?._id,
        updatedTemplate: template,
        foundInTemplates: state.templates.find(t => t._id === template._id) ? 'yes' : 'no',
        foundInCurrentTemplate: state.currentTemplate?._id === template._id ? 'yes' : 'no'
      });
      
      return {
        templates: newTemplates,
        currentTemplate: newCurrentTemplate
      };
    });
  });
  
  socket.on('collaborator-updated', (updatedTemplate) => {
    console.log('useTemplatesStore: collaborator-updated event received', { 
      templateId: updatedTemplate._id,
      isPublic: updatedTemplate.isPublic,
      collaboratorsCount: updatedTemplate.collaborators?.length
    });
    
    useTemplatesStore.setState(state => ({
      templates: state.templates.map(template =>
        template._id === updatedTemplate._id ? { ...template, ...updatedTemplate } : template
      ),
      currentTemplate: state.currentTemplate?._id === updatedTemplate._id
        ? { ...state.currentTemplate, ...updatedTemplate }
        : state.currentTemplate,
    }));
  });
  
  socket.on('template-deleted', ({ templateId }) => {
    console.log('useTemplatesStore: template-deleted event received', { templateId });
    useTemplatesStore.setState(state => ({
      templates: state.templates.filter(t => t._id !== templateId),
      currentTemplate: state.currentTemplate && state.currentTemplate._id === templateId ? null : state.currentTemplate
    }));
  });
};

// Setup listeners when the store is first accessed
if (typeof window !== 'undefined' && !(window as any)._templatesListenersAdded) {
  setupSocketListeners();
  (window as any)._templatesListenersAdded = true;
} 