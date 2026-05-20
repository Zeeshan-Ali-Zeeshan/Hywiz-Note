import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { useNotesStore } from '../stores/useNotesStore';
import { useAuthStore } from '../stores/useAuthStore';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  callback: () => void;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { toggleSearchModal, toggleTemplatesModal, toggleSidebar, toggleDarkMode } = useUIStore();
  const { createNote, currentNote, updateNote, deleteNote } = useNotesStore();
  const { logout } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger shortcuts when not typing in input fields
      if (
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        (event.target as HTMLElement).contentEditable !== 'true'
      ) {
        const { key, ctrlKey, altKey, metaKey } = event;

        // Global shortcuts
        switch (key) {
          case 'k':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              toggleSearchModal();
            }
            break;

          case 'n':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              createNote({
                title: 'Untitled Note',
                content: '',
                plainTextContent: ''
              });
            }
            break;

          case 't':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              toggleTemplatesModal();
            }
            break;

          case 'b':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              toggleSidebar();
            }
            break;

          case 'd':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              toggleDarkMode();
            }
            break;

          case 's':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              if (currentNote) {
                updateNote(currentNote._id, {
                  title: currentNote.title,
                  content: currentNote.content,
                  plainTextContent: currentNote.plainTextContent
                });
              }
            }
            break;

          case 'Delete':
          case 'Backspace':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              if (currentNote) {
                if (confirm('Are you sure you want to delete this note?')) {
                  deleteNote(currentNote._id);
                }
              }
            }
            break;

          case '1':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/dashboard');
            }
            break;

          case '2':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/notes');
            }
            break;

          case '3':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/notebooks');
            }
            break;





          case '6':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/shortcuts');
            }
            break;

          case '7':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/shared');
            }
            break;

          case '8':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              navigate('/trash');
            }
            break;

          case 'Escape':
            // Close modals
            const modals = document.querySelectorAll('[data-modal]');
            if (modals.length > 0) {
              event.preventDefault();
              // Close the last opened modal
              const lastModal = modals[modals.length - 1] as HTMLElement;
              const closeButton = lastModal.querySelector('[data-close-modal]') as HTMLElement;
              if (closeButton) {
                closeButton.click();
              }
            }
            break;

          case '?':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              // Show keyboard shortcuts help
              showKeyboardShortcutsHelp();
            }
            break;

          case 'l':
            if (ctrlKey || metaKey) {
              event.preventDefault();
              logout();
            }
            break;
        }

        // Navigation shortcuts
        if (altKey) {
          switch (key) {
            case 'ArrowLeft':
              event.preventDefault();
              window.history.back();
              break;
            case 'ArrowRight':
              event.preventDefault();
              window.history.forward();
              break;
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    navigate,
    toggleSearchModal,
    toggleTemplatesModal,
    toggleSidebar,
    toggleDarkMode,
    createNote,
    currentNote,
    updateNote,
    deleteNote,
    logout
  ]);
};

const showKeyboardShortcutsHelp = () => {
  const shortcuts = [
    { key: 'Ctrl/Cmd + K', description: 'Open search' },
    { key: 'Ctrl/Cmd + N', description: 'New note' },
    { key: 'Ctrl/Cmd + T', description: 'Open templates' },
    { key: 'Ctrl/Cmd + B', description: 'Toggle sidebar' },
    { key: 'Ctrl/Cmd + D', description: 'Toggle dark mode' },
    { key: 'Ctrl/Cmd + S', description: 'Save note' },
    { key: 'Ctrl/Cmd + Delete', description: 'Delete note' },
    { key: 'Ctrl/Cmd + 1-8', description: 'Navigate to sections' },
    { key: 'Ctrl/Cmd + ?', description: 'Show this help' },
    { key: 'Ctrl/Cmd + L', description: 'Logout' },
    { key: 'Escape', description: 'Close modals' },
    { key: 'Alt + ←/→', description: 'Navigate back/forward' }
  ];

  const helpContent = shortcuts
    .map(({ key, description }) => `<tr><td class="font-mono text-sm">${key}</td><td>${description}</td></tr>`)
    .join('');

  const helpModal = document.createElement('div');
  helpModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  helpModal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-close-modal>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="p-6">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 font-medium text-gray-900 dark:text-white">Shortcut</th>
              <th class="text-left py-2 font-medium text-gray-900 dark:text-white">Action</th>
            </tr>
          </thead>
          <tbody class="text-gray-600 dark:text-gray-300">
            ${helpContent}
          </tbody>
        </table>
      </div>
    </div>
  `;

  helpModal.setAttribute('data-modal', 'true');
  document.body.appendChild(helpModal);

  const closeButton = helpModal.querySelector('[data-close-modal]');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      document.body.removeChild(helpModal);
    });
  }

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      document.body.removeChild(helpModal);
    }
  });
}; 