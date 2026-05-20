import React, { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useNotesStore } from '../../stores/useNotesStore';

interface LinkModalProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  initialText?: string;
}

interface SearchResult {
  _id: string;
  title: string;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  editor,
  isOpen,
  onClose,
  initialUrl = '',
  initialText = '',
}) => {
  const [text, setText] = useState(initialText);
  const [link, setLink] = useState(initialUrl);
  const [showNoteSelector, setShowNoteSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  const { notes, fetchNotes } = useNotesStore();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setLink(initialUrl);
      setSearchQuery('');
      setSearchResults([]);
      setShowNoteSelector(false);
      fetchNotes();
    }
  }, [isOpen, initialUrl, initialText, fetchNotes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = notes
        .filter(note => 
          note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, notes]);

  const handleSubmit = () => {
    console.log('=== LinkModal Submit Debug ===');
    console.log('link state:', JSON.stringify(link));
    console.log('text state:', JSON.stringify(text));
    
    // Validate inputs
    if (!link || link.trim() === '') {
      console.log('ERROR: Link is empty, not submitting');
      return;
    }
    
    if (!text || text.trim() === '') {
      console.log('ERROR: Text is empty, not submitting');
      return;
    }

    // Create href - much simpler logic
    let finalHref = '';
    if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:')) {
      finalHref = link;
    } else if (link.startsWith('note://')) {
      finalHref = link;
    } else {
      // Treat as note ID
      finalHref = `note://${link}`;
    }
    
    console.log('Final href:', JSON.stringify(finalHref));
    console.log('Editor selection before:', editor.state.selection);
    console.log('Available marks in schema:', Object.keys(editor.schema.marks));
    console.log('Link mark available:', !!editor.schema.marks.link);
    
    // Verify link extension is available
    if (!editor.schema.marks.link) {
      console.error('Link extension is not available in the editor schema!');
      alert('Error: Link extension is not properly configured. Please refresh the page and try again.');
      return;
    }
    
    // Check if we have a selection (editing existing link)
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    
    console.log('Has selection:', hasSelection, 'from:', from, 'to:', to);
    
    if (hasSelection) {
      // Editing existing link or selected text
      console.log('Editing existing link/selection');
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: finalHref })
        .run();
    } else {
      // Inserting new link - try different approaches
      console.log('Inserting new link - testing different methods');
      
            // Method 1: Use command approach with proper chaining
      console.log('Trying method 1: command approach');
      try {
    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const { from } = state.selection;
            const node = state.schema.text(text, [state.schema.marks.link.create({ href: finalHref })]);
            tr.replaceSelectionWith(node, false);
            return true;
          })
          .run();
        console.log('Method 1 successful');
      } catch (error) {
        console.log('Method 1 failed:', error);
        
        // Method 2: Insert text then apply mark using manual transaction
        console.log('Trying method 2: manual transaction');
        try {
          const { state, view } = editor;
          const { from } = state.selection;
          
          // Insert text
          editor.chain().focus().insertContent(text).run();
          
          // Get new position after insert
          const to = from + text.length;
          
          // Create transaction to apply link mark
          const tr = state.tr;
        const linkMark = state.schema.marks.link.create({ href: finalHref });
          tr.addMark(from, to, linkMark);
          view.dispatch(tr);
          
          console.log('Method 2 successful');
        } catch (error2) {
          console.log('Method 2 failed:', error2);
          
          // Method 3: Simple insertContent with HTML string
          console.log('Trying method 3: simple HTML insertion');
          editor
            .chain()
            .focus()
            .insertContent(`<a href="${finalHref}">${text}</a>`)
      .run();
          console.log('Method 3 attempted');
        }
      }
    }
    
    console.log('Editor selection after:', editor.state.selection);
    
    // Debug: Check what was actually inserted
    setTimeout(() => {
      console.log('=== POST-INSERT DEBUG ===');
      console.log('Editor HTML:', editor.getHTML());
      console.log('Editor JSON:', JSON.stringify(editor.getJSON(), null, 2));
      
      // Check if any links exist
      const links = editor.state.doc.descendants((node, pos) => {
        if (node.marks) {
          const linkMark = node.marks.find(mark => mark.type.name === 'link');
          if (linkMark) {
            console.log('Found link mark at position', pos, ':', linkMark.attrs);
          }
        }
      });
    }, 100);
    
    onClose();
  };

  const selectNote = (note: SearchResult) => {
    setLink(note._id);
    setText(note.title);
    setShowNoteSelector(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const isUrlValid = link.length > 0 && text.length > 0 && (link.startsWith('http') || link.startsWith('note://') || notes.some(n => n._id === link));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        <div className="p-6 space-y-4">
          {/* Text Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Link Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Add a link"
                className={`flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isUrlValid ? 'ring-2 ring-red-500' : ''
                }`}
              />
              <button
                onClick={() => setShowNoteSelector(!showNoteSelector)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1 text-sm"
              >
                <FileText size={16} />
                Select note
              </button>
            </div>
            
            {/* Note Selector Dropdown */}
            {showNoteSelector && (
              <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 max-h-40 overflow-y-auto">
                <div className="p-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full px-2 py-1 text-sm bg-gray-100 dark:bg-gray-600 border-0 rounded text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
                  />
                </div>
                {searchResults.length > 0 ? (
                  searchResults.map((note) => (
                    <button
                      key={note._id}
                      onClick={() => selectNote(note)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                    >
                      {note.title}
                    </button>
                  ))
                ) : searchQuery.length > 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No notes found
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    Start typing to search notes
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 p-6 pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isUrlValid || !link}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
