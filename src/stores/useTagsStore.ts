import { create } from 'zustand';
import api from '../lib/api';

export interface Tag {
  _id: string;
  name: string;
  userId: string;
  noteCount: number;
  description: string;
  parentTag?: string;
  createdAt: string;
  updatedAt: string;
}

interface TagsState {
  tags: Tag[];
  selectedTags: string[];
  loading: boolean;

  // Actions
  fetchTags: () => Promise<void>;
  createTag: (data: Partial<Tag>) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  selectTag: (tagName: string) => void;
  toggleTagSelection: (tagName: string) => void;
  clearSelectedTags: () => void;
  getTagByName: (name: string) => Tag | undefined;
  updateTagCounts: () => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  selectedTags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/tags');
      set({ 
        tags: response.data,
        loading: false 
      });
    } catch (error) {
      console.error('Fetch tags error:', error);
      set({ loading: false });
    }
  },

  createTag: async (data: Partial<Tag>) => {
    try {
      const response = await api.post('/tags', data);
      const newTag = response.data;
      
      set(state => ({
        tags: [...state.tags, newTag]
      }));
      
      return newTag;
    } catch (error) {
      console.error('Create tag error:', error);
      throw error;
    }
  },

  updateTag: async (id: string, data: Partial<Tag>) => {
    try {
      const response = await api.put(`/tags/${id}`, data);
      const updatedTag = response.data;
      
      set(state => ({
        tags: state.tags.map(tag => 
          tag._id === id ? updatedTag : tag
        )
      }));
      
      return updatedTag;
    } catch (error) {
      console.error('Update tag error:', error);
      throw error;
    }
  },

  deleteTag: async (id: string) => {
    try {
      await api.delete(`/tags/${id}`);
      set(state => ({
        tags: state.tags.filter(tag => tag._id !== id)
      }));
    } catch (error) {
      console.error('Delete tag error:', error);
      throw error;
    }
  },

  selectTag: (tagName: string) => {
    set({ selectedTags: [tagName] });
  },

  toggleTagSelection: (tagName: string) => {
    set(state => ({
      selectedTags: state.selectedTags.includes(tagName)
        ? state.selectedTags.filter(tag => tag !== tagName)
        : [...state.selectedTags, tagName]
    }));
  },

  clearSelectedTags: () => {
    set({ selectedTags: [] });
  },

  getTagByName: (name: string) => {
    return get().tags.find(tag => tag.name === name.toLowerCase());
  },

  updateTagCounts: async () => {
    try {
      await api.post('/tags/update-counts');
      get().fetchTags(); // Refresh tags to get updated counts
    } catch (error) {
      console.error('Update tag counts error:', error);
    }
  },
}));

// --- SOCKET.IO REALTIME LISTENERS ---
import socket from '../lib/socket';
if (typeof window !== 'undefined' && socket && !(window as any)._tagsListenersAdded) {
  socket.on('tag-created', ({ tag }) => {
    useTagsStore.setState(state => ({ tags: [...state.tags, tag] }));
  });
  socket.on('tag-updated', ({ tag }) => {
    useTagsStore.setState(state => ({
      tags: state.tags.map(t => t._id === tag._id ? tag : t)
    }));
  });
  socket.on('tag-deleted', ({ tagId }) => {
    useTagsStore.setState(state => ({
      tags: state.tags.filter(t => t._id !== tagId)
    }));
  });
  (window as any)._tagsListenersAdded = true;
}