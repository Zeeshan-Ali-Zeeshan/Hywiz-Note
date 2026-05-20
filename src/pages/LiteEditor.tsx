import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { useNotesStore } from '../stores/useNotesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import api from '../lib/api';
import * as Y from 'yjs';
import { MinimalTitleEditor } from '../components/notes/MinimalTitleEditor';

const LiteEditor: React.FC = () => {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { fetchNote, saveSharedNote } = useNotesStore();
  const { user } = useAuthStore();
  const [note, setNote] = useState<any>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isSharedNote, setIsSharedNote] = useState(false);
  const [access, setAccess] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    if (noteId) {
      // First try to fetch as a regular note
      fetchNote(noteId).then(n => {
        setNote(n);
        setIsSharedNote(false);
      }).catch(async (err) => {
        // If it fails, try to fetch as a shared note
        try {
          const token = localStorage.getItem('token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const response = await api.get(`/notes/${noteId}/shared`, { headers });
          setNote(response.data.note);
          setAccess(response.data.access);
          setIsSharedNote(true);
        } catch (sharedError) {
          console.error('Failed to fetch note:', sharedError);
          setNote(null);
        }
      });
    }
  }, [noteId, fetchNote]);

  // Initialize Yjs doc from yjsUpdate
  useEffect(() => {
    if (!note) return;
    const ydocInstance = new Y.Doc();
    if (note.yjsUpdate) {
      try {
        const update = Uint8Array.from(atob(note.yjsUpdate), c => c.charCodeAt(0));
        Y.applyUpdate(ydocInstance, update);
      } catch (e) {
        console.error('Failed to apply yjsUpdate:', e);
      }
    }
    setYdoc(ydocInstance);
  }, [note]);

  const handleSaveToMyNotes = async () => {
    if (!user || !note) return;
    setSaving(true);
    try {
      // Save the shared note to user's account
      await saveSharedNote(noteId!);
      // Redirect to the notes page in the full app
      navigate(`/notes`, { replace: true });
    } catch (error) {
      console.error('Error saving shared note:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!note || !ydoc) return <div className="text-white p-8">Loading...</div>;

  // Read-only if not canEdit
  const readOnly = !(access && access.canEdit);

  return (
    <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center">
      <div className="w-full max-w-[1200px] bg-[#232323] rounded-lg shadow-lg p-6 mt-8">
        {/* Action buttons for shared notes */}
        {isSharedNote && user && access && (
          <div className="flex justify-between items-center mb-4 p-4 bg-gray-800 dark:bg-gray-900 black:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 black:border-gray-800">
            <div className="text-white">
              <p className="text-sm text-gray-300 dark:text-gray-400 black:text-gray-400">Shared Note</p>
              {/* Title is now Yjs-powered below */}
              {access.canEdit && (
                <p className="text-sm text-green-400 dark:text-green-400 black:text-green-400">You have edit access</p>
              )}
              {access.canSave && (
                <p className="text-sm text-blue-400 dark:text-blue-400 black:text-blue-400">You have full access (can save to your account)</p>
              )}
            </div>
            <div className="flex gap-3">
              {access.canSave && (
                <button
                  onClick={handleSaveToMyNotes}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save to My Notes'}
                </button>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Open Full App
              </button>
            </div>
          </div>
        )}

        {/* Yjs-powered Title */}
        <div className="mb-4">
          <MinimalTitleEditor
            ydoc={ydoc}
            readOnly={readOnly}
          />
        </div>

        {/* Fixed toolbar */}
        {editorInstance && (
          <div className="bg-[#232323] border-b border-[#232323]">
            <EditorToolbar editor={editorInstance} noteId={noteId || ''} note={note} />
          </div>
        )}
        {/* Scrollable text editor area only */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <RichTextEditor
            noteId={noteId || ''}
            readOnly={readOnly}
            hideToolbar={true}
            onEditorReady={setEditorInstance}
            ydoc={ydoc}
            yjsUpdate={note.yjsUpdate}
          />
        </div>
      </div>
    </div>
  );
};

export default LiteEditor; 