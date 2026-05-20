import React, { useState } from 'react';
import { Search as SearchIcon, BookOpen, ChevronDown, Plus, FileText, Notebook } from 'lucide-react';
import { extractTitleFromYjs } from '../../lib/yjsUtils';


interface Notebook {
  _id: string;
  name: string;
  color: string;
}

interface WorkspaceSidebarProps {
  workspaceName: string;
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNotebookSelect: (notebookId: string) => void;
  onCreateNotebook: () => void;
  onCreateNote: () => void;
  // map of notebookId -> notes (id + title)
  notesByNotebook?: Record<string, { _id: string; title?: string; yjsUpdate?: string | { type: 'Buffer'; data: number[] } | Uint8Array }[]>;
  onNoteSelect?: (noteId: string) => void;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  workspaceName,
  notebooks,
  selectedNotebookId,
  searchQuery,
  onSearchChange,
  onNotebookSelect,
  onCreateNotebook,
  onCreateNote,
  notesByNotebook = {},
  onNoteSelect
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 black:bg-[#181818] flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-gray-100/50 dark:border-gray-800/50 black:border-[#3a3a3a]/50 bg-white dark:bg-gray-900 black:bg-[#181818]">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notebooks..."
            className="w-full pl-9 pr-3 py-2 border-0 rounded-lg bg-gray-50 dark:bg-gray-800 black:bg-[#242424] text-xs text-gray-900 dark:text-gray-100 black:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 black:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Notebooks List */}
      <div className="flex-1 overflow-y-auto p-2.5 bg-white dark:bg-gray-900 black:bg-[#181818]">
        <div className="px-1.5 pb-2 flex items-center justify-between">
          <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Notebooks</div>
          <button
            aria-label={isOpen ? 'Collapse notebooks' : 'Expand notebooks'}
            className="p-1 rounded-md bg-transparent"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={`w-4 h-4 text-gray-500 ${isOpen ? '' : '-rotate-90'}`} />
          </button>
        </div>

        <>
        {isOpen && (
          <div className="space-y-1">
            {notebooks.map((notebook) => (
              <div key={notebook._id}>
                <div
                  className={`group flex items-center space-x-2.5 p-2 rounded-md cursor-pointer transition-all duration-300 border shadow-sm border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 ${
                    notebook._id === selectedNotebookId
                      ? 'bg-white/90 dark:bg-gray-800/90 black:bg-[#242424]/90 notebook-selected ring-1 ring-offset-1 ring-blue-500/40 dark:ring-blue-400/40 black:ring-blue-400/40 text-gray-900 dark:text-white black:text-gray-100'
                      : 'bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 hover:backdrop-blur-sm text-gray-700 dark:text-gray-300 black:text-gray-300'
                  }`}
                  onClick={() => {
                    onNotebookSelect(notebook._id);
                    setExpanded(prev => (prev === notebook._id ? null : notebook._id));
                  }}
                >
                  <div className={`p-1.5 rounded-md workspace-notebook-icon ${
                    notebook._id === selectedNotebookId
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-gray-100/80 text-gray-600 dark:bg-gray-700/80 dark:text-gray-300 black:bg-[#3a3a3a]/80 black:text-gray-300'
                  }`}>
                    <Notebook className="w-4 h-4" />
                  </div>
                  <span className={`font-medium text-xs flex-1 ${
                    notebook._id === selectedNotebookId 
                      ? 'text-gray-900 dark:text-white black:text-white'
                      : 'text-gray-800 dark:text-gray-300 black:text-gray-300'
                  }`}>
                    {notebook.name}
                  </span>
                  {notebook._id === selectedNotebookId && (
                    <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 black:bg-blue-400 rounded-full"></div>
                  )}
                </div>
                {expanded === notebook._id && (notesByNotebook[notebook._id]?.length ?? 0) > 0 && (
                  <div className="mt-1 ml-5 pl-2 border-l-2 border-gray-200/70 dark:border-gray-700/60 black:border-[#3a3a3a]/60 space-y-0.5">
                    {notesByNotebook[notebook._id]!.map((note) => (
                      <button
                        key={note._id}
                        onClick={() => onNoteSelect && onNoteSelect(note._id)}
                        className="w-full flex items-center gap-2 text-left text-[11px] text-gray-700 dark:text-gray-300 black:text-gray-300 px-2 py-1.5 rounded-md bg-transparent"
                      >
                        <FileText className="w-3.5 h-3.5 opacity-80" />
                        <span className="truncate font-medium">{(note.yjsUpdate && extractTitleFromYjs(note.yjsUpdate)) || note.title || 'Untitled'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* New Notebook shortcut */}
            <button
              onClick={onCreateNotebook}
              className="flex items-center gap-2 text-[11px] font-medium text-[#0ea5b1] ml-2 mt-2 px-2 py-1.5 rounded-md bg-transparent"
            >
              <Plus className="w-4 h-4" />
              <span>New Notebook</span>
            </button>

          </div>
        )}
          {isOpen && notebooks.length === 0 && (
            <div className="text-center py-7">
              <div className="w-11 h-11 bg-[#e6f6f9] dark:bg-[#16343a] black:bg-[#10282c] rounded-lg flex items-center justify-center mx-auto mb-3.5">
                <BookOpen className="w-5 h-5 text-[#0ea5b1]" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 text-[13px] font-medium mb-1">No notebooks yet</p>
              <p className="text-gray-500 dark:text-gray-400 black:text-gray-400 text-[11px] mb-3">Create your first notebook to get started</p>
              <button
                onClick={onCreateNotebook}
                className="px-3.5 py-2 bg-[#0ea5b1] text-white text-[11px] font-medium rounded-md"
              >
                Create Notebook
              </button>
            </div>
          )}
        </>
      </div>
    </div>
  );
};

export default WorkspaceSidebar; 