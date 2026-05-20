import { create } from 'zustand';
import { Task, TaskFilter } from '../types';
import api from '../lib/api';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  selectedFilter: TaskFilter;

  // Actions
  fetchTasks: (filter?: Partial<TaskFilter>) => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  setFilter: (filter: Partial<TaskFilter>) => void;
  clearError: () => void;
  // ✅ CANONICAL: syncTasksFromNote now accepts canonical Task schema
  syncTasksFromNote: (noteId: string, tasks: Array<{
    taskId?: string;
    title: string;
    status: 'pending' | 'completed' | 'canceled';
    dueDateWall?: string;
    isFloating: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    isRecurring: boolean;
    recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminder?: string;
    position: number;
  }>) => Promise<any>;

  // Task statistics
  getTaskStats: () => {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [] as Task[],
  loading: false,
  error: null,
  selectedFilter: {
    status: 'all',
  },

  fetchTasks: async (filter = {}) => {
    set({ loading: true, error: null });
    try {
      const currentFilter = { ...get().selectedFilter, ...filter };
      const response = await api.get('/tasks', { params: currentFilter });
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : (Array.isArray(raw?.tasks) ? raw.tasks : []);
      // ✅ CANONICAL: Backend now returns canonical schema, minimal mapping needed
      const normalized = list.map((t: any) => ({
        ...t,
        id: t.id || t._id,  // Map _id to id for frontend
        // Ensure ID fields are strings, not objects
        noteId: t.noteId
          ? (typeof t.noteId === 'string' ? t.noteId : (t.noteId?._id || String(t.noteId)))
          : undefined,
        templateId: t.templateId
          ? (typeof t.templateId === 'string' ? t.templateId : (t.templateId?._id || String(t.templateId)))
          : undefined,
      }));
      set({ tasks: normalized, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch tasks',
        loading: false
      });
    }
  },

  createTask: async (taskData) => {
    try {
      const response = await api.post('/tasks', taskData);
      const payload = response.data || {};
      const newTask = {
        ...payload,
        id: payload.id || payload._id,
        dueDate: payload.dueDateUTC || payload.dueDate || payload.dueDateWall,
        noteId: payload.noteId
          ? (typeof payload.noteId === 'string' ? payload.noteId : (payload.noteId?._id || String(payload.noteId)))
          : undefined,
        templateId: payload.templateId
          ? (typeof payload.templateId === 'string' ? payload.templateId : (payload.templateId?._id || String(payload.templateId)))
          : undefined,
      } as any;
      set(state => ({
        tasks: [...(Array.isArray(state.tasks) ? state.tasks : []), newTask]
      }));
      return newTask;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create task'
      });
      throw error;
    }
  },

  updateTask: async (id, updates) => {
    try {
      const response = await api.patch(`/tasks/${id}`, updates);
      const payload = response.data || {};
      const updatedTask = {
        ...payload,
        id: payload.id || payload._id,
        dueDate: payload.dueDateUTC || payload.dueDate || payload.dueDateWall,
        noteId: payload.noteId
          ? (typeof payload.noteId === 'string' ? payload.noteId : (payload.noteId?._id || String(payload.noteId)))
          : undefined,
        templateId: payload.templateId
          ? (typeof payload.templateId === 'string' ? payload.templateId : (payload.templateId?._id || String(payload.templateId)))
          : undefined,
      } as any;
      set(state => ({
        tasks: (Array.isArray(state.tasks) ? state.tasks : []).map(task =>
          (task.id === id) ? updatedTask : task
        )
      }));

      // If a recurring task was completed, refresh tasks to get the next occurrence
      // ✅ CANONICAL: Check status instead of completed boolean
      if (updates.status === 'completed') {
        // Wait for server to create next occurrence (it's now synchronous)
        setTimeout(async () => {
          await get().fetchTasks();
        }, 1000);
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update task'
      });
      throw error;
    }
  },

  deleteTask: async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      set(state => ({
        tasks: (Array.isArray(state.tasks) ? state.tasks : []).filter(task => task.id !== id)
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete task'
      });
      throw error;
    }
  },

  // ✅ CANONICAL: Use status enum instead of completed boolean
  // ✅ CANONICAL: Use status enum instead of completed boolean
  toggleTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status !== 'completed') {
      // Completing the task
      // Use the dedicated completion endpoint which handles recurrence logic
      await get().completeTask(id);
    } else {
      // Un-completing the task
      // Just update status back to pending
      const updates = {
        status: 'pending' as const,
        completedAt: undefined
      };
      await get().updateTask(id, updates);
    }
  },

  completeTask: async (id: string) => {
    try {
      // Optimistic update
      const task = get().tasks.find(t => t.id === id);
      if (task) {
        // If recurring, we don't know the next date yet, but we can mark it as processed
        // For non-recurring, mark as completed
        if (!task.isRecurring) {
          set(state => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'completed', completedAt: new Date().toISOString() } : t)
          }));
        }
      }

      const response = await api.post(`/tasks/${id}/complete`);
      const { task: updatedTask } = response.data;

      // Update state with the server response (which includes new due date for recurring tasks)
      if (updatedTask) {
        // Normalize the response task if needed (similar to fetchTasks)
        const normalized = {
          ...updatedTask,
          id: updatedTask.id || updatedTask._id,
          noteId: updatedTask.noteId
            ? (typeof updatedTask.noteId === 'string' ? updatedTask.noteId : (updatedTask.noteId?._id || String(updatedTask.noteId)))
            : undefined,
        };

        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? normalized : t)
        }));
      } else {
        // Fallback refresh
        await get().fetchTasks();
      }
    } catch (error: any) {
      // Revert optimistic update on error
      await get().fetchTasks();
      set({
        error: error.response?.data?.message || 'Failed to complete task'
      });
      throw error;
    }
  },

  setFilter: (filter) => {
    set(state => ({
      selectedFilter: { ...state.selectedFilter, ...filter }
    }));
  },

  clearError: () => set({ error: null }),

  // ✅ CANONICAL: Accepts and sends canonical Task schema
  syncTasksFromNote: async (noteId: string, tasks: Array<{
    taskId?: string;
    title: string;
    status: 'pending' | 'completed' | 'canceled';
    dueDateWall?: string;
    isFloating: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    isRecurring: boolean;
    recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminder?: string;
    position: number;
  }>) => {
    try {
      const response = await api.post('/tasks/sync-from-note', { noteId, tasks });
      // Refresh tasks after sync
      await get().fetchTasks();
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to sync tasks from note'
      });
      throw error;
    }
  },

  // ✅ CANONICAL: Use status and dueDateWall fields
  getTaskStats: () => {
    const tasks = Array.isArray(get().tasks) ? get().tasks : [];
    const now = new Date();

    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      overdue: tasks.filter(t =>
        t.status !== 'completed' &&
        t.dueDateWall &&
        new Date(t.dueDateWall) < now
      ).length
    };
  },

  assignTask: async (taskId: string, userIds: string[]) => {
    try {
      await api.post(`/tasks/${taskId}/assign`, { userIds });
      await get().fetchTasks();
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to assign task'
      });
      throw error;
    }
  },

  shareTask: async (taskId: string, shares: Array<{ userId: string; permission: 'read' | 'write' }>) => {
    try {
      await api.post(`/tasks/${taskId}/share`, { shares });
      await get().fetchTasks();
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to share task'
      });
      throw error;
    }
  }
}));
