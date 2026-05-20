import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useNotesStore } from '../stores/useNotesStore';
import api from '../lib/api';
import '../components/editor/editor-overrides.css';
import { NoteEditor } from '../components/notes/NoteEditor';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export default function SharedNoteView() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saveSharedNote } = useNotesStore();
  const [note, setNote] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  // Debug current URL and component
  useEffect(() => {
    console.log('[FRONTEND DEBUG] SharedNoteView component mounted');
    console.log('[FRONTEND DEBUG] Current URL:', window.location.href);
    console.log('[FRONTEND DEBUG] noteId from params:', noteId);
    console.log('[FRONTEND DEBUG] user:', user);
  }, [noteId, user]);

  // Debug note state changes
  useEffect(() => {
    const isCollaborativeUser = access?.permission === 'owner' || 
                               access?.permission === 'write' || 
                               access?.permission === 'admin';
    const isPublicUser = access?.permission === 'public';
    const canCollaborate = isCollaborativeUser && access?.canEdit;
    
    console.log('[FRONTEND DEBUG] Note state changed:', JSON.stringify({
      note: note,
      access: access,
      loading: loading,
      error: error,
      userType: {
        permission: access?.permission,
        canEdit: access?.canEdit,
        isCollaborativeUser,
        isPublicUser,
        canCollaborate,
        userType: isCollaborativeUser ? 'collaborative' : 
                 isPublicUser ? 'public' : 'unknown'
      }
    }, null, 2));
  }, [note, access, loading, error]);

  // Initialize WebSocket connection for collaborative editing
  useEffect(() => {
    // Check if user is a collaborative user (owner or collaborator)
    // vs a public user (accessing via public link)
    const isCollaborativeUser = access?.permission === 'owner' || 
                               access?.permission === 'write' || 
                               access?.permission === 'admin';
    
    const isPublicUser = access?.permission === 'public';
    
    // Only enable collaborative editing for collaborative users with edit permissions
    // Public users should NOT get collaborative editing, even if note is also public
    const canCollaborate = isCollaborativeUser && access?.canEdit;
    
    if (!noteId || !canCollaborate) {
      console.log('[COLLABORATIVE] Skipping WebSocket setup:', {
        noteId,
        permission: access?.permission,
        canEdit: access?.canEdit,
        isCollaborativeUser,
        isPublicUser,
        canCollaborate,
        reason: !noteId ? 'No noteId' : 
                !isCollaborativeUser ? 'Not a collaborative user' : 
                !access?.canEdit ? 'No edit permission' : 'Unknown'
      });
      return;
    }

    console.log('[COLLABORATIVE] Setting up WebSocket connection for collaborative user:', {
      noteId,
      permission: access?.permission,
      canEdit: access?.canEdit,
      userType: 'collaborative'
    });
    
    // Connect to YJS WebSocket server for real-time collaboration
    const wsProvider = new WebsocketProvider(
      'ws://localhost:3001', 
      `note-${noteId}`, 
      ydoc
    );

    wsProvider.on('status', ({ status }: { status: string }) => {
      console.log('[COLLABORATIVE] WebSocket status:', status);
    });

    wsProvider.on('sync', (isSynced: boolean) => {
      console.log('[COLLABORATIVE] Document synced:', isSynced);
    });

    setProvider(wsProvider);

    // Cleanup on unmount
    return () => {
      console.log('[COLLABORATIVE] Cleaning up WebSocket connection');
      wsProvider.destroy();
    };
  }, [noteId, access?.permission, access?.canEdit, ydoc]);

  useEffect(() => {
    async function fetchNote() {
      try {
        console.log('[FRONTEND DEBUG] Fetching shared note:', noteId);
        
        // Check if noteId is valid
        if (!noteId) {
          console.error('[FRONTEND DEBUG] No noteId provided');
          setError('Invalid note ID');
          setLoading(false);
          return;
        }
        
        // Always send JWT token if available for collaborative access
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        console.log('[FRONTEND DEBUG] Request headers:', headers);
        
        const response = await api.get(`/notes/${noteId}/shared`, { headers });
        
        console.log('[FRONTEND DEBUG] Response received:', {
          status: response.status,
          data: response.data,
          note: response.data.note,
          access: response.data.access
        });
        
        setNote(response.data.note);
        setAccess(response.data.access);
        setLoading(false);

        // Debug: Log the entire note object received from the server
        console.log('Note object from server:', response.data.note);

        // Initialize Yjs doc
        if (response.data.note.yjsUpdate) {
          try {
            const update = Uint8Array.from(atob(response.data.note.yjsUpdate), c => c.charCodeAt(0));
            Y.applyUpdate(ydoc, update);
            // Debug: log Yjs fragments and prosemirror content
            console.log('Yjs fragments:', Array.from(ydoc.share.keys()));
            const yXml = ydoc.getXmlFragment('prosemirror');
            console.log('prosemirror fragment:', yXml.toJSON ? yXml.toJSON() : yXml);
          } catch (e) {
            console.error('Failed to apply yjsUpdate:', e);
          }
        }

        // No longer needed - we will handle rendering within this component
        // if (user && response.data.access?.canEdit && !response.data.access?.canSave) {
        //   navigate(`/lite-editor/${noteId}`, { replace: true });
        // }
      } catch (err: any) {
        console.error('[FRONTEND DEBUG] Error fetching note:', {
          error: err,
          status: err.response?.status,
          data: err.response?.data,
          message: err.message
        });
        
        setLoading(false);
        if (err.response && err.response.status === 403) {
          setError('unauthorized');
        } else {
          setNote(null);
          setError('Note not found or not shared.');
        }
      }
    }
    fetchNote();
  }, [noteId, user, navigate]);

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
      setError('Failed to save note to your account.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    console.log('[FRONTEND DEBUG] Rendering loading state');
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>Loading...</div>;
  }
  
  if (error === 'unauthorized') {
    console.log('[FRONTEND DEBUG] Rendering unauthorized state');
    return (
      <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>
        <p>You must be logged in to view this note.</p>
        <button
          style={{
            background: '#4f8cff',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            marginTop: '20px'
          }}
          onClick={() => navigate('/login')}
        >
          Login
        </button>
      </div>
    );
  }
  
  if (error || !note) {
    console.log('[FRONTEND DEBUG] Rendering error/not found state:', { error, note });
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>{error || 'Note not found or not shared.'}</div>;
  }

  // Determine read-only status based on access rights
  const isReadOnly = !(access?.canEdit);

  // Inline style overrides for blockquote and code
  const extraStyles = `
    .editor-content blockquote {
      background: #23272e;
      border-left: 4px solid #4f8cff;
      color: #bfc7d5;
      margin: 1.5em 0;
      padding: 1em 1.5em;
      border-radius: 6px;
      font-style: italic;
    }
    .editor-content pre, .editor-content code {
      background: #18191a;
      color: #e6e6e6;
      border-radius: 6px;
      padding: 0.5em 1em;
      font-size: 1em;
      font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
      overflow-x: auto;
    }
    .editor-content pre {
      margin: 1.5em 0;
    }
    .editor-content code {
      padding: 0.2em 0.4em;
    }
  `;

  // Editable: show NoteEditor full page if user is the owner or admin collaborator
  // TEMPORARY: Force SharedNoteView rendering for testing
  const forceSharedView = true; // Set to false to restore normal behavior
  
  if (!forceSharedView && access && (access.permission === 'owner' || access.permission === 'admin')) {
    console.log('[FRONTEND DEBUG] Rendering NoteEditor for owner/admin:', {
      access: access,
      permission: access.permission,
      isOwner: access.permission === 'owner',
      isAdmin: access.permission === 'admin',
      noteId: note._id
    });
    return (
      <div className="h-full min-h-screen bg-black flex flex-col">
        <NoteEditor noteId={note._id} onClose={() => window.location.reload()} shared />
      </div>
    );
  }

  // Read-only or Public-Editable View
  console.log('[FRONTEND DEBUG] Rendering read-only/public view:', {
    note: note,
    access: access,
    isReadOnly: !(access?.canEdit)
  });
  
  return (
    <div className="h-full min-h-screen bg-black flex flex-col">
      <style>{extraStyles}</style>
      
      {/* Collaborative Status Bar - Only for collaborative users */}
      {(() => {
        const isCollaborativeUser = access?.permission === 'owner' || 
                                   access?.permission === 'write' || 
                                   access?.permission === 'admin';
        const isPublicUser = access?.permission === 'public';
        const canCollaborate = isCollaborativeUser && access?.canEdit;
        
        if (canCollaborate && provider) {
          return (
            <div className="bg-green-600 text-white px-4 py-2 text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Collaborative editing active</span>
              </div>
              <div className="text-xs">
                Real-time sync enabled
              </div>
            </div>
          );
        }
        
        if (isPublicUser && access?.canEdit) {
          return (
            <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Public editing mode</span>
              </div>
              <div className="text-xs">
                Changes saved locally
              </div>
            </div>
          );
        }
        
        return null;
      })()}
      
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 bg-[#181818] rounded-lg shadow p-0">
          {/* Title below toolbar */}
          <div className="px-8 pt-4 pb-2">
          {/* <h2 className="text-2xl font-bold text-white mb-2">{note.title}</h2> */}
          </div>
          <div className="flex-1 px-8 pb-8 overflow-y-auto">
            <RichTextEditor
              noteId={note._id}
              readOnly={isReadOnly}
              hideToolbar={isReadOnly}
              title={note.title}
              ydoc={ydoc}
              yjsUpdate={note.yjsUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 