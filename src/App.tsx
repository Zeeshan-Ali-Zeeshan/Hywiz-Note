import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { useAuthStore } from './stores/useAuthStore';
import { useUIStore } from './stores/useUIStore';
import { useToastStore } from './stores/useToastStore';
import { Toast } from './components/notes/Toast';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AllNotes from './pages/AllNotes';
import Notebooks from './pages/Notebooks';


import Calendar from './pages/Calendar';
import Shortcuts from './pages/Shortcuts';
import SharedWithMe from './pages/SharedWithMe';
import SharedNoteView from './pages/SharedNoteView';
import Trash from './pages/Trash';
import LiteEditor from './pages/LiteEditor';
import Layout from './components/layout/Layout';
import SearchModal from './components/modals/SearchModal';
// import { CustomizeModal } from './components/modals/CustomizeModal';
import Settings from './pages/Settings';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { ImportExportModal } from './components/modals/ImportExportModal';
import NoteTemplates from './components/notes/NoteTemplates';
import NotebookNotes from './pages/NotebookNotes';
import WorkspaceView from './pages/WorkspaceView';
import Templates from './pages/Templates';
import Files from './pages/Files';
import Tasks from './pages/Tasks';

function App() {
  const { isLoading, verifyToken, isAuthenticated } = useAuthStore();
  const {
    searchModalOpen,
    templatesModalOpen,
    keyboardShortcutsModalOpen,
    importExportMode
  } = useUIStore();
  const { message, type, isVisible } = useToastStore();

  // Verify token on app initialization
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Sync user preferences to UI store
  useEffect(() => {
    const { user } = useAuthStore.getState();
    if (user?.preferences) {
      if (user.preferences.fontSize) {
        useUIStore.getState().setFontSize(user.preferences.fontSize);
      }
      if (user.preferences.layoutStyle) {
        useUIStore.getState().setLayoutStyle(user.preferences.layoutStyle);
      }
      if (user.preferences.theme) {
        // Auto-migrate legacy 'dark' or 'auto' to 'black'
        const rawTheme = user.preferences.theme as string;
        const safeTheme = (rawTheme === 'dark' || rawTheme === 'auto')
          ? 'black'
          : user.preferences.theme as 'light' | 'black';
        useUIStore.getState().setTheme(safeTheme);
      }
    }
  }, [useAuthStore.getState().user, verifyToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 black:bg-[#242424]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 black:bg-[#242424] transition-colors duration-200">
          <Toast message={message} type={type} isVisible={isVisible} />
          <Routes>
            {/* Standalone public shared note view (always outside layout) */}
            <Route path="/note/:noteId" element={<SharedNoteView />} />

            {/* Standalone Lite Editor route (no sidebar/layout) */}
            <Route path="/lite-editor/:noteId" element={<LiteEditor />} />

            {/* Auth routes - redirect to dashboard if already authenticated */}
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
            />
            <Route
              path="/register"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
            />

            {/* All other routes with sidebar/layout - require authentication */}
            <Route
              path="*"
              element={
                isAuthenticated ? (
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/notes" element={<AllNotes />} />
                      {/* Removed list page: workspaces grid is no longer used */}
                      <Route path="/workspaces/:id" element={<WorkspaceView />} />
                      <Route path="/notebooks" element={<Notebooks />} />
                      <Route path="/notebooks/:id" element={<NotebookNotes />} />
                      <Route path="/files" element={<Files />} />
                      <Route path="/tasks" element={<Tasks />} />

                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/shortcuts" element={<Shortcuts />} />
                      <Route path="/shared" element={<SharedWithMe />} />
                      <Route path="/shared-with-me" element={<SharedWithMe />} />
                      <Route path="/spaces" element={<WorkspaceView />} />
                      <Route path="/tags" element={<AllNotes />} />
                      <Route path="/trash" element={<Trash />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Layout>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>

          {/* Modals */}
          <SearchModal isOpen={searchModalOpen} onClose={() => useUIStore.getState().toggleSearchModal()} />
          {/* Customize modal left for legacy entry; consider removing if not used anymore */}
          {/* <CustomizeModal /> */}
          <KeyboardShortcutsModal isOpen={keyboardShortcutsModalOpen} onClose={() => useUIStore.getState().toggleKeyboardShortcutsModal()} />
          <ImportExportModal mode={importExportMode} />
          <NoteTemplates isOpen={templatesModalOpen} onClose={() => useUIStore.getState().toggleTemplatesModal()} />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;