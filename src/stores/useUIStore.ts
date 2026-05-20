import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  currentPage: string;
  sidebarOpen: boolean;
  customizeModalOpen: boolean;
  importExportModalOpen: boolean;
  importExportMode: 'import' | 'export';
  noteEditorOpen: boolean;
  selectedNoteIds: string[];
  searchModalOpen: boolean;
  bulkActionsOpen: boolean;
  templatesModalOpen: boolean;
  keyboardShortcutsModalOpen: boolean;
  darkMode: boolean;
  layoutStyle: 'comfortable' | 'compact' | 'spacious';
  showToolbar: boolean;
  fontSize: 'small' | 'medium' | 'large';
  theme: 'light' | 'black';

  // Actions
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  openCustomizeModal: () => void;
  closeCustomizeModal: () => void;
  openImportExportModal: (mode: 'import' | 'export') => void;
  closeImportExportModal: () => void;
  openNoteEditor: (noteId?: string) => void;
  closeNoteEditor: () => void;
  toggleSearchModal: () => void;
  setBulkActionsOpen: (open: boolean) => void;
  toggleTemplatesModal: () => void;
  toggleKeyboardShortcutsModal: () => void;
  toggleDarkMode: () => void;
  setLayoutStyle: (style: 'comfortable' | 'compact' | 'spacious') => void;
  toggleToolbar: () => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setTheme: (theme: 'light' | 'black') => void;
  setSelectedNoteIds: (ids: string[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentPage: 'dashboard',
      sidebarOpen: true,
      customizeModalOpen: false,
      importExportModalOpen: false,
      importExportMode: 'import',
      noteEditorOpen: false,
      selectedNoteIds: [],
      searchModalOpen: false,
      bulkActionsOpen: false,
      templatesModalOpen: false,
      keyboardShortcutsModalOpen: false,
      darkMode: false,
      layoutStyle: 'comfortable',
      showToolbar: true,
      fontSize: 'medium',
      theme: 'light',

      setCurrentPage: (page: string) => set({ currentPage: page }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      openCustomizeModal: () => set({ customizeModalOpen: true }),

      closeCustomizeModal: () => set({ customizeModalOpen: false }),

      openImportExportModal: (mode: 'import' | 'export') => set({ importExportModalOpen: true, importExportMode: mode }),

      closeImportExportModal: () => set({ importExportModalOpen: false }),

      openNoteEditor: (noteId?: string) => set({
        noteEditorOpen: true,
        currentPage: 'notes'
      }),

      closeNoteEditor: () => set({ noteEditorOpen: false }),

      toggleSearchModal: () => set((state) => ({ searchModalOpen: !state.searchModalOpen })),

      setBulkActionsOpen: (open: boolean) => set({ bulkActionsOpen: open }),

      toggleTemplatesModal: () => set((state) => ({ templatesModalOpen: !state.templatesModalOpen })),

      toggleKeyboardShortcutsModal: () => set((state) => ({ keyboardShortcutsModalOpen: !state.keyboardShortcutsModalOpen })),

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      setLayoutStyle: (style) => set({ layoutStyle: style }),

      toggleToolbar: () => set((state) => ({ showToolbar: !state.showToolbar })),

      setFontSize: (size) => set({ fontSize: size }),

      setTheme: (theme) => set({ theme }),

      setSelectedNoteIds: (ids: string[]) => set({ selectedNoteIds: ids }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        layoutStyle: state.layoutStyle,
        showToolbar: state.showToolbar,
        fontSize: state.fontSize,
        theme: state.theme,
      }),
    }
  )
);