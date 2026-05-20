import React from "react";
import "./editor-overrides.css";
import "./task-styles.css";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { useNavigate } from "react-router-dom";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TaskList } from "./extensions/TaskList";
import { TaskItem } from "./extensions/TaskItem";
import { SimpleChecklistList, SimpleChecklistItem } from "./extensions/SimpleChecklist";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorToolbar } from "./EditorToolbar";
import { CollaborativeHighlight } from "./extensions/CollaborativeHighlight";
import { CollaborativeTextAlign } from "./extensions/CollaborativeTextAlign";
import { CollaborativeColor } from "./extensions/CollaborativeColor";
import { CollaborativeFontSize } from "./extensions/CollaborativeFontSize";
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
// import TableCell from '@tiptap/extension-table-cell';
// import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { CollaborativeTableCellColor } from './extensions/CollaborativeTableCellColor';
import { CollaborativeTableHeaderColor } from './extensions/CollaborativeTableHeaderColor';
import { TableCellMenuOverlay, InlineTableButton } from './TableCellMenuOverlay';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { tableEditing } from 'prosemirror-tables';
// import axios from 'axios';
import api from '../../lib/api';
import debounce from 'lodash.debounce';
import Link from '@tiptap/extension-link';
import { LinkModal } from './LinkModal';
import { LinkBubble } from './LinkBubble';
import { extractTasksFromYjs, extractTasksFromYjsDoc, extractTasksFromProseMirrorJSON } from '../../lib/yjsUtils';
import { useTasksStore } from '../../stores/useTasksStore';

interface RichTextEditorProps {
  noteId: string;
  readOnly?: boolean;
  hideToolbar?: boolean;
  onEditorReady?: (editor: Editor | null) => void;
  initialContent?: string; // <-- Add this prop
  ydoc: Y.Doc;
  provider?: WebsocketProvider;
  yjsUpdate?: string | Uint8Array; // base64 string or Uint8Array
  title?: string; // <-- Add this prop
  isTemplate?: boolean;
  noteData?: any; // Note data including attachments
}

// ✅ SELECTED CELL PLUGIN - Re-enabled with browser extension protection
function selectedCellPlugin() {
  return new Plugin({
    key: new PluginKey('selectedCell'),
    props: {
      decorations(state) {
        const { selection } = state;
        const decorations = [];
        // Always check the resolved position of the cursor
        const $pos = selection.$from;
        for (let d = $pos.depth; d > 0; d--) {
          const node = $pos.node(d);
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            const pos = $pos.before(d);
            decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'selectedCell' }));
            break;
          }
        }
        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
}

// ✅ IMAGE DELETION PLUGIN - Detects deleted images and removes them from server
// Works with YJS by tracking all transactions (YJS wraps all user actions)
function imageDeletionPlugin(noteId: string, isTemplate?: boolean) {
  // Track images to avoid duplicate deletion attempts
  const deletionInProgress = new Set<string>();

  console.log('[IMAGE DELETION PLUGIN] Plugin created for noteId:', noteId, 'isTemplate:', isTemplate);

  return new Plugin({
    key: new PluginKey('imageDeletion'),
    appendTransaction(transactions, oldState, newState) {
      console.log('[IMAGE DELETION PLUGIN] appendTransaction called', {
        noteId,
        isTemplate,
        hasDocChanged: transactions.some(tr => tr.docChanged),
        transactionCount: transactions.length
      });

      // Process ALL transactions - YJS wraps user actions, so we need to check all
      if (!noteId || isTemplate) {
        console.log('[IMAGE DELETION PLUGIN] Skipping - no noteId or isTemplate');
        return null;
      }

      if (!transactions.some(tr => tr.docChanged)) {
        console.log('[IMAGE DELETION PLUGIN] Skipping - no doc changes');
        return null;
      }

      // Extract all images from the new state
      const currentImages = new Set<string>();
      newState.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs.src) {
          // Skip blob URLs - they're temporary and shouldn't be deleted from server
          if (!node.attrs.src.startsWith('blob:')) {
            currentImages.add(node.attrs.src);
          }
        }
      });

      // Extract all images from the old state
      const oldImages = new Set<string>();
      oldState.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs.src) {
          if (!node.attrs.src.startsWith('blob:')) {
            oldImages.add(node.attrs.src);
          }
        }
      });

      console.log('[IMAGE DELETION PLUGIN] Image comparison', {
        oldCount: oldImages.size,
        currentCount: currentImages.size,
        oldImages: Array.from(oldImages),
        currentImages: Array.from(currentImages)
      });

      // Find deleted images (in old but not in current)
      const deletedImages: Array<{ src: string; alt?: string }> = [];
      oldImages.forEach((src) => {
        if (!currentImages.has(src) && !deletionInProgress.has(src)) {
          // Get alt from old state
          let alt = '';
          oldState.doc.descendants((node) => {
            if (node.type.name === 'image' && node.attrs.src === src) {
              alt = node.attrs.alt || '';
            }
          });
          deletedImages.push({ src, alt });
        }
      });

      // Delete images from server if any were removed
      if (deletedImages.length > 0) {
        console.log('[IMAGE DELETION PLUGIN] ⚠️ DETECTED DELETED IMAGES:', deletedImages.length, deletedImages);
        deletedImages.forEach(async (image) => {
          // Mark as in progress to prevent duplicate deletions
          deletionInProgress.add(image.src);

          try {
            // Extract filename from URL
            // URLs can be: http://localhost:3001/uploads/filename.png or /uploads/filename.png
            let filename = '';
            const url = image.src;

            // Try to extract filename from URL
            const uploadsMatch = url.match(/\/uploads\/([^?#]+)/);
            if (uploadsMatch) {
              filename = uploadsMatch[1];
            } else {
              // Fallback: try to get filename from alt attribute
              if (image.alt) {
                // Check if alt contains a filename
                const altParts = image.alt.split('/');
                if (altParts.length > 0) {
                  const potentialFilename = altParts[altParts.length - 1];
                  if (potentialFilename.includes('.')) {
                    filename = potentialFilename;
                  }
                } else if (image.alt.includes('.')) {
                  // Alt might be the filename directly
                  filename = image.alt;
                }
              }
            }

            if (filename) {
              console.log('[IMAGE DELETION PLUGIN] 🗑️ CALLING DELETE API:', {
                endpoint: `/notes/${noteId}/attachments/${encodeURIComponent(filename)}`,
                filename,
                url
              });
              try {
                const response = await api.delete(`/notes/${noteId}/attachments/${encodeURIComponent(filename)}`);
                console.log('[IMAGE DELETION PLUGIN] ✅ SUCCESS - Deleted image:', filename, response);
              } catch (deleteError: any) {
                // 404 means file already deleted or doesn't exist - that's fine
                if (deleteError?.response?.status !== 404) {
                  console.error('[IMAGE DELETION PLUGIN] ❌ FAILED to delete image:', filename, {
                    status: deleteError?.response?.status,
                    message: deleteError?.response?.data?.message || deleteError?.message,
                    error: deleteError
                  });
                } else {
                  console.log('[IMAGE DELETION PLUGIN] ℹ️ Image already deleted (404):', filename);
                }
              }
            } else {
              console.error('[IMAGE DELETION PLUGIN] ❌ Could not extract filename from URL:', url, 'Alt:', image.alt);
            }
          } catch (error: any) {
            // Don't show error to user - image might already be deleted or not exist
            console.error('[IMAGE DELETION PLUGIN] ❌ Error processing deletion:', error);
          } finally {
            // Remove from in-progress set after a delay to allow retry if needed
            setTimeout(() => {
              deletionInProgress.delete(image.src);
            }, 5000);
          }
        });
      } else {
        console.log('[IMAGE DELETION PLUGIN] No deleted images detected');
      }

      return null; // No transaction to append
    }
  });
}

// Note: Using default StarterKit Link extension



// Helper to POST canonical Yjs update to backend
async function saveCanonicalYjsUpdate(noteId: string, ydoc: Y.Doc, isTemplate?: boolean, noteData?: any) {
  console.log('[YJS DEBUG] saveCanonicalYjsUpdate called');
  try {
    const update = Y.encodeStateAsUpdate(ydoc);
    const base64 = btoa(String.fromCharCode(...update));
    if (isTemplate) {
      await api.patch(`/templates/${noteId}/yjs-update`, { yjsUpdate: base64 });
      console.log('[YJS DEBUG] Canonical Yjs update saved to backend for template:', noteId);
    } else {
      await api.patch(`/notes/${noteId}/yjs-update`, { yjsUpdate: base64 });
      console.log('[YJS DEBUG] Canonical Yjs update saved to backend for note:', noteId);

      // Also save attachments to server if this is a note and has attachments
      if (noteData && noteData.attachments && noteData.attachments.length > 0) {
        console.log('[ATTACHMENT DEBUG] Saving attachments to server for note:', noteId);
        await saveAttachmentsToServer(noteId, noteData.attachments);
      }
    }
  } catch (e) {
    console.error('[YJS ERROR] Failed to save canonical Yjs update:', e);
  }
}

// Helper to save attachments to server (only once per note)
const processedNotes = new Set<string>();

async function saveAttachmentsToServer(noteId: string, attachments: any[]) {
  // Check if we've already processed this note
  if (processedNotes.has(noteId)) {
    console.log('[ATTACHMENT DEBUG] Note already processed, skipping:', noteId);
    return;
  }

  try {
    console.log('[ATTACHMENT DEBUG] Processing attachments for note:', noteId, 'Count:', attachments.length);

    for (const attachment of attachments) {
      try {
        // Check if this attachment already has a File record by searching for the URL
        const searchResponse = await api.get(`/files?search=${encodeURIComponent(attachment.originalName || attachment.filename)}`);

        if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
          // Create File record for this attachment via the files API
          const fileData = new FormData();
          fileData.append('description', `Attachment from note: ${noteId}`);
          fileData.append('tags', JSON.stringify([]));

          // We need to create a File record directly in the database
          // Since we can't upload the file again, we'll create the record manually
          const fileRecord = {
            name: attachment.originalName || attachment.filename,
            originalName: attachment.originalName || attachment.filename,
            mimetype: attachment.type,
            size: attachment.size,
            path: `server/uploads/${attachment.filename}`,
            url: attachment.url,
            description: `Attachment from note: ${noteId}`,
            tags: [],
            uploadedBy: null, // Will be set by server from auth token
            workspace: null,
            notebook: null
          };

          // Create the file record via a custom endpoint
          await api.post('/files/create-from-attachment', fileRecord);
          console.log('[ATTACHMENT DEBUG] Created File record for:', attachment.filename);
        } else {
          console.log('[ATTACHMENT DEBUG] File record already exists for:', attachment.filename);
        }
      } catch (attachmentError) {
        console.error('[ATTACHMENT ERROR] Failed to process attachment:', attachment.filename, attachmentError);
      }
    }

    // Mark this note as processed
    processedNotes.add(noteId);
    console.log('[ATTACHMENT DEBUG] Marked note as processed:', noteId);

  } catch (error) {
    console.error('[ATTACHMENT ERROR] Failed to save attachments to server:', error);
  }
}

// Type guards for Yjs content nodes
const isParagraph = (node: any): node is { type: string; content?: any[] } => node && typeof node === 'object' && 'type' in node && node.type === 'paragraph';
const isTextNode = (node: any): node is { type: string; text?: string } => node && typeof node === 'object' && 'type' in node && node.type === 'text';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ noteId, readOnly = false, hideToolbar = false, onEditorReady, initialContent, ydoc, provider, yjsUpdate, title, isTemplate, noteData }) => {
  const navigate = useNavigate();
  const { syncTasksFromNote, tasks, fetchTasks } = useTasksStore();
  // Remove ydocRef and providerRef, use props instead
  // Remove useEffect that creates/destroys ydoc/provider
  // Use editorKey if needed for noteId changes
  const [editorKey, setEditorKey] = React.useState(0);
  const initialContentSetRef = React.useRef<string | null>(null);
  const isSavingRef = React.useRef(false); // Prevent recursion in save function

  // Link modal state
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [linkModalInitialUrl, setLinkModalInitialUrl] = React.useState<string>('');
  const [linkModalInitialText, setLinkModalInitialText] = React.useState<string>('');

  // Link bubble (hover) state
  const [linkBubbleOpen, setLinkBubbleOpen] = React.useState(false);
  const [linkBubblePos, setLinkBubblePos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [linkBubbleData, setLinkBubbleData] = React.useState<{ href: string; text: string; maskText?: string; target?: string }>({ href: '', text: '' });

  // 🔒 STABILIZE EDITOR - Only recreate when noteId changes
  React.useEffect(() => {
    // Only increment editorKey when noteId changes (not ydoc/provider)
    setEditorKey(prev => prev + 1);
    initialContentSetRef.current = null;
    console.log('[EDITOR STABLE] 🔒 Editor recreation triggered by noteId change:', noteId);
  }, [noteId]); // Only recreate for different notes, not ydoc/provider changes

  // ✅ COLLABORATION WITH DEBUG INFO
  React.useEffect(() => {
    console.log('[COLLABORATION DEBUG] 🤝 Collaboration status:', {
      hasYdoc: !!ydoc,
      hasProvider: !!provider,
      noteId: noteId,
      editorKey: editorKey
    });
  }, [ydoc, provider, noteId, editorKey]);

  const collaborativeExtensions = ydoc
    ? [
      CollaborativeFontSize,
      CollaborativeColor,
      CollaborativeTextAlign.configure({ types: ['heading', 'paragraph'] }),
      CollaborativeHighlight.configure({ multicolor: true }),
      Collaboration.configure({ document: ydoc }),
      provider ? CollaborationCursor.configure({ provider, user: { name: "User", color: "#ffa500" } }) : null,
    ]
    : [];

  // Always use collaborative table extensions for better functionality
  const tableExtensions = [
    CollaborativeTableCellColor,
    CollaborativeTableHeaderColor,
  ];

  // 🔒 STABLE EDITOR CONFIGURATION - Minimize recreations
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'link',
        },
        // Ensure HTML parsing works correctly
        linkOnPaste: true,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel', 'note', 'template'],
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      SimpleChecklistList,
      SimpleChecklistItem,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'prosemirror-table'
        },
        // Prevent wrapper recreation
        allowTableNodeSelection: false,
        // ✅ FIXED LAYOUT COLUMN SIZING - Proper independent column resizing
        cellMinWidth: 80, // Minimum width for fixed layout
        // ✅ ENABLE LAST COLUMN RESIZING - Allow adjusting total table width
        lastColumnResizable: true,
        handleWidth: 8, // Slightly larger handle for easier resizing
      }),
      TableRow,
      Image.configure({
        inline: false, // Set to false for block-level images that display properly
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      ...tableExtensions, // Always use collaborative table extensions
      ...collaborativeExtensions,
      tableEditing(), // ✅ RE-ENABLED - Browser extension was the real culprit
      selectedCellPlugin(),
      imageDeletionPlugin(noteId, isTemplate), // ✅ IMAGE DELETION - Auto-cleanup deleted images
      InlineTableButton,
    ].filter(Boolean) as any,
    content: undefined,
    editable: !readOnly,
    // Disable autofocus to avoid stealing focus from title input
    autofocus: false,
    onFocus: () => {
      // If title already has content, do nothing. If empty, keep focus on title.
      // NoteEditor will manage focus; here we just avoid stealing when title is empty.
    },
    onUpdate: ({ editor }) => {
      // Trigger save on content change
      debouncedSave.current(noteId, ydoc, isTemplate || false, noteData, editor);
    },
  }, [editorKey, readOnly, ydoc, provider]); // ✅ RE-ADDED ydoc, provider - Required for collaboration

  // Apply canonical Yjs update if present
  React.useEffect(() => {
    if (!ydoc || !yjsUpdate) return;
    let update: Uint8Array;
    if (typeof yjsUpdate === 'string') {
      update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
    } else {
      update = yjsUpdate;
    }
    Y.applyUpdate(ydoc, update);
    console.log('[YJS DEBUG] Applied canonical Yjs update for note:', noteId);

    // Debug: Check what's in YJS after loading
    setTimeout(() => {
      if (ydoc) {
        const yXml = ydoc.getXmlFragment('prosemirror');
        const yjsJSON = yXml.toJSON ? yXml.toJSON() : [];
        const yjsStr = JSON.stringify(yjsJSON);
        const hasImagesInYJS = yjsStr.includes('image') || yjsStr.includes('img');
        console.log('[YJS DEBUG] YJS content after load:', {
          hasImages: hasImagesInYJS,
          contentPreview: yjsStr.substring(0, 500),
          fullContent: yjsJSON
        });
      }
    }, 500);
  }, [ydoc, yjsUpdate, noteId]);

  // Detect and fix blob URLs when content loads
  React.useEffect(() => {
    if (!editor || !ydoc || !noteData) return;

    const fixBlobUrls = () => {
      const html = editor.getHTML();
      const json = editor.getJSON();

      // Check for blob URLs in HTML
      const blobUrlRegex = /blob:https?:\/\/[^\s"']+/g;
      const blobUrlsInHtml = html.match(blobUrlRegex);

      // Find images with blob URLs in JSON
      const findBlobUrlImages = (obj: any): any[] => {
        const images: any[] = [];
        if (Array.isArray(obj)) {
          obj.forEach(item => images.push(...findBlobUrlImages(item)));
        } else if (obj && typeof obj === 'object') {
          if (obj.type === 'image' && obj.attrs?.src?.startsWith('blob:')) {
            images.push(obj);
          }
          Object.keys(obj).forEach(key => {
            images.push(...findBlobUrlImages(obj[key]));
          });
        }
        return images;
      };

      const blobUrlImages = findBlobUrlImages(json);

      if (blobUrlsInHtml && blobUrlsInHtml.length > 0 || blobUrlImages.length > 0) {
        console.warn('[BLOB URL FIX] ⚠️ Found blob URLs in editor content:', {
          htmlBlobUrls: blobUrlsInHtml,
          jsonBlobUrlImages: blobUrlImages.map(img => ({
            src: img.attrs?.src,
            alt: img.attrs?.alt
          }))
        });

        // Try to fix by matching with attachments
        if (noteData.attachments && Array.isArray(noteData.attachments)) {
          let fixed = false;

          blobUrlImages.forEach((imgNode: any) => {
            const blobUrl = imgNode.attrs?.src;
            if (!blobUrl || !blobUrl.startsWith('blob:')) return;

            // Try to find matching attachment
            const attachment = noteData.attachments.find((a: any) => {
              const alt = imgNode.attrs?.alt || '';
              return a.originalName === alt ||
                a.filename === alt ||
                (alt && (alt.includes(a.originalName || '') || alt.includes(a.filename || '')));
            });

            if (attachment && attachment.url) {
              const serverUrl = attachment.url.startsWith('http')
                ? attachment.url
                : `http://localhost:3001${attachment.url}`;

              console.log('[BLOB URL FIX] Replacing blob URL with server URL:', {
                from: blobUrl,
                to: serverUrl
              });

              // Find and update the image in the editor
              editor.chain().focus().command(({ tr, state }) => {
                let updated = false;
                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'image' && node.attrs.src === blobUrl) {
                    tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      src: serverUrl
                    });
                    updated = true;
                  }
                });
                return updated;
              }).run();

              fixed = true;
            }
          });

          if (fixed) {
            console.log('[BLOB URL FIX] ✓ Fixed blob URLs in editor');
          } else {
            console.warn('[BLOB URL FIX] ⚠️ Could not fix blob URLs - no matching attachments found');
          }
        }
      }
    };

    // Check after editor is ready
    setTimeout(fixBlobUrls, 1000);
    setTimeout(fixBlobUrls, 3000);
  }, [editor, ydoc, noteData]);

  // DISABLED: Images are stored in YJS with their URLs and positions
  // We should NOT restore from attachments because:
  // 1. Images are already in YJS at their correct positions
  // 2. Restoring from attachments would add them at the end, losing their original position
  // 3. YJS content is the source of truth for image positions

  // Set initial content in Yjs if needed (after editor is ready, and only if no yjsUpdate was applied)
  React.useEffect(() => {
    if (!editor || !initialContent || !ydoc || yjsUpdate) return;
    // Only set initial content if we haven't already for this note
    if (initialContentSetRef.current === noteId) return;
    const yXml = ydoc.getXmlFragment('prosemirror');
    // Check if Yjs doc is truly empty or only contains an empty paragraph
    const yjsContent = yXml.toJSON ? yXml.toJSON() : [];
    let isEmpty = false;
    if (Array.isArray(yjsContent) && yjsContent.length === 1 && isParagraph(yjsContent[0])) {
      const para = yjsContent[0] as { type: string; content?: any[] };
      if (!('content' in para) || !Array.isArray(para.content) || para.content.length === 0) {
        isEmpty = true;
      } else if (
        Array.isArray(para.content) &&
        para.content.length === 1 &&
        isTextNode(para.content[0]) &&
        (!para.content[0].text || para.content[0].text.trim() === '')
      ) {
        isEmpty = true;
      }
    } else if (Array.isArray(yjsContent) && yjsContent.length === 0) {
      isEmpty = true;
    }
    if (isEmpty) {
      editor.commands.setContent(initialContent, false); // false = don't emit transaction (Yjs will sync)
      initialContentSetRef.current = noteId;
      console.log('[YJS DEBUG] Set initial content from HTML for note:', noteId);
      // --- Self-healing: Save canonical Yjs update to backend ---
      saveCanonicalYjsUpdate(noteId, ydoc, isTemplate ?? false);
    }
  }, [editor, initialContent, editorKey, noteId, ydoc, yjsUpdate, isTemplate]);

  // Reset the flag when noteId changes
  React.useEffect(() => {
    initialContentSetRef.current = null;
  }, [noteId]);

  React.useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Function to clean blob URLs from YJS content before saving
  const cleanBlobUrlsFromYjs = (ydoc: Y.Doc, noteData?: any): boolean => {
    let hasBlobUrls = false;
    const yXml = ydoc.getXmlFragment('prosemirror');
    const json = yXml.toJSON ? yXml.toJSON() : [];

    // Recursively find and replace blob URLs
    const replaceBlobUrls = (obj: any, path: string = ''): any => {
      if (Array.isArray(obj)) {
        return obj.map((item, index) => replaceBlobUrls(item, `${path}[${index}]`));
      }
      if (obj && typeof obj === 'object') {
        // Check for image nodes with blob URLs
        if (obj.type === 'image' && obj.attrs?.src?.startsWith('blob:')) {
          hasBlobUrls = true;
          console.warn('[YJS CLEANUP] Found blob URL in image:', obj.attrs.src, 'at path:', path);

          // Try to find matching attachment from noteData
          if (noteData && noteData.attachments && Array.isArray(noteData.attachments)) {
            // Extract filename from blob URL if possible, or try to match by other means
            const attachment = noteData.attachments.find((a: any) => {
              // Try to match by original name or filename
              return a.originalName === obj.attrs.alt ||
                a.filename === obj.attrs.alt ||
                (obj.attrs.alt && obj.attrs.alt.includes(a.originalName || a.filename));
            });

            if (attachment && attachment.url) {
              const serverUrl = attachment.url.startsWith('http')
                ? attachment.url
                : `http://localhost:3001${attachment.url}`;
              console.log('[YJS CLEANUP] Replacing blob URL with server URL:', serverUrl);
              obj.attrs.src = serverUrl;
              return obj;
            }
          }

          // If no attachment found, remove the image (better than broken blob URL)
          console.warn('[YJS CLEANUP] No matching attachment found, image will be removed');
          return null; // Mark for removal
        }

        // Recursively process all properties
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const cleaned = replaceBlobUrls(value, path ? `${path}.${key}` : key);
          if (cleaned !== null) {
            result[key] = cleaned;
          }
        }
        return result;
      }
      return obj;
    };

    replaceBlobUrls(json);

    if (hasBlobUrls) {
      console.warn('[YJS CLEANUP] Blob URLs detected and cleaned from YJS content');
      // Note: Actually rebuilding YJS from cleaned JSON is complex
      // For now, we'll log a warning. The editor should prevent blob URLs from being inserted.
    }

    return hasBlobUrls;
  };

  // Fast save for task completion (1 second instead of 5) - syncs ALL task changes
  const fastSave = React.useRef(
    debounce(async (noteId: string, isTemplate: boolean, editorInstance?: Editor | null) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;

      try {
        if (!isTemplate && noteId && editorInstance) {
          const editorJSON = editorInstance.getJSON();
          const tasks = extractTasksFromProseMirrorJSON(editorJSON, noteId);

          // Sync ALL tasks to database (not just recurring ones)
          if (tasks.length > 0) {
            await syncTasksFromNote(noteId, tasks);
          }
        }
      } catch (error) {
        console.error('[TASK SYNC] Error in fast save:', error);
      } finally {
        setTimeout(() => {
          isSavingRef.current = false;
        }, 500);
      }
    }, 1000)
  );

  // Debounced save function with recursion protection
  const debouncedSave = React.useRef(
    debounce(async (noteId: string, ydoc: Y.Doc, isTemplate: boolean, noteData?: any, editorInstance?: Editor | null) => {
      // Prevent recursion
      if (isSavingRef.current) {
        console.log('[YJS DEBUG] Save already in progress, skipping');
        return;
      }

      isSavingRef.current = true;

      try {
        // CRITICAL: Clean blob URLs before saving
        const hadBlobUrls = cleanBlobUrlsFromYjs(ydoc, noteData);
        if (hadBlobUrls) {
          console.warn('[YJS DEBUG] ⚠️ Blob URLs were found and cleaned before save');
        }

        // DEBUG: Log the actual Yjs content and paragraph node
        const yXml = ydoc.getXmlFragment('prosemirror');
        const yjsContent = yXml.toJSON ? yXml.toJSON() : [];
        console.log('[YJS DEBUG] yjsContent:', JSON.stringify(yjsContent, null, 2));
        if (Array.isArray(yjsContent) && yjsContent.length === 1 && isParagraph(yjsContent[0])) {
          console.log('[YJS DEBUG] paragraph node:', JSON.stringify(yjsContent[0], null, 2));
        }
        // Improved isEmpty logic: only treat as empty if single paragraph with no text or only whitespace
        let isEmpty = false;
        if (Array.isArray(yjsContent) && yjsContent.length === 1 && isParagraph(yjsContent[0])) {
          const para = yjsContent[0] as { type: string; content?: any[] };
          if (!('content' in para) || !Array.isArray(para.content) || para.content.length === 0) {
            isEmpty = true;
          } else if (
            Array.isArray(para.content) &&
            para.content.length === 1 &&
            isTextNode(para.content[0]) &&
            (!para.content[0].text || para.content[0].text.trim() === '')
          ) {
            isEmpty = true;
          }
        } else if (Array.isArray(yjsContent) && yjsContent.length === 0) {
          isEmpty = true;
        }
        if (!isEmpty) {
          console.log('[YJS DEBUG] Not empty, will save');
          await saveCanonicalYjsUpdate(noteId, ydoc, isTemplate, noteData);

          // Sync tasks from note to Task collection (only for notes, not templates)
          if (!isTemplate && noteId && editorInstance) {
            try {
              // Method 1: Use editor.getJSON() - most reliable as it uses current editor state
              console.log('[TASK SYNC] Extracting tasks from editor JSON for note:', noteId);
              const editorJSON = editorInstance.getJSON();
              console.log('[TASK SYNC] Editor JSON:', JSON.stringify(editorJSON, null, 2));
              let tasks = extractTasksFromProseMirrorJSON(editorJSON, noteId);

              // Method 2: Fallback to Yjs extraction if no tasks found
              if (tasks.length === 0) {
                console.log('[TASK SYNC] No tasks found in editor JSON, trying Yjs extraction...');
                try {
                  const tasksFromYjs = extractTasksFromYjsDoc(ydoc, noteId);
                  if (tasksFromYjs.length > 0) {
                    console.log('[TASK SYNC] Found', tasksFromYjs.length, 'tasks via Yjs extraction');
                    tasks = tasksFromYjs;
                  }
                } catch (yjsError) {
                  console.warn('[TASK SYNC] Yjs extraction failed:', yjsError);
                }
              }

              console.log('[TASK SYNC] Final extracted tasks:', tasks.length, tasks);

              if (tasks.length > 0) {
                console.log('[TASK SYNC] Syncing', tasks.length, 'tasks from note:', noteId);
                const syncResponse = await syncTasksFromNote(noteId, tasks);
                console.log('[TASK SYNC] Sync completed successfully');

                // ✅ DUPLICATION FIX: Update editor with server-assigned taskIds
                // This anchors tasks so they aren't treated as new in subsequent syncs
                if (syncResponse?.tasks && editorInstance && !editorInstance.isDestroyed) {
                  editorInstance.commands.command(({ tr }) => {
                    let taskIndex = 0;
                    tr.doc.descendants((node, pos) => {
                      if (node.type.name === 'taskItem') {
                        if (taskIndex < syncResponse.tasks.length) {
                          const remoteTask = syncResponse.tasks[taskIndex];
                          // Match 1:1 with extraction order
                          if (node.attrs.taskId !== remoteTask._id) {
                            tr.setNodeAttribute(pos, 'taskId', remoteTask._id);
                            tr.setNodeAttribute(pos, 'snapshotStatus', remoteTask.status);
                            tr.setNodeAttribute(pos, 'snapshotEtag', remoteTask.etag);
                          }
                          taskIndex++;
                        }
                      }
                      return true;
                    });
                    return true;
                  });
                }
              } else {
                // If no tasks found, clear tasks for this note
                console.log('[TASK SYNC] No tasks found, clearing tasks for note:', noteId);
                await syncTasksFromNote(noteId, []);
              }
            } catch (taskSyncError) {
              console.error('[TASK SYNC] Error syncing tasks from note:', taskSyncError);
              console.error('[TASK SYNC] Error details:', taskSyncError);
              // Don't fail the save if task sync fails
            }
          }
        } else {
          console.log('[YJS DEBUG] Not saving empty Yjs state for note/template:', noteId);
        }
      } finally {
        // Reset the flag after a delay to allow for proper completion
        setTimeout(() => {
          isSavingRef.current = false;
        }, 1000);
      }
    }, 5000)
  );

  // ✅ TRACK IMAGES IN EDITOR - Multiple detection methods with UNDO/REDO support
  const previousImagesRef = React.useRef<Set<string>>(new Set());
  const deletionInProgressRef = React.useRef<Set<string>>(new Set());
  const pendingDeletionsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map()); // Track pending deletions for undo

  React.useEffect(() => {
    if (!editor || !noteId || isTemplate) {
      console.log('[IMAGE DELETION EDITOR] Skipping - missing editor, noteId, or isTemplate', { editor: !!editor, noteId, isTemplate });
      return;
    }

    console.log('[IMAGE DELETION EDITOR] 🚀 Setting up MULTIPLE detection methods with UNDO support for noteId:', noteId);

    // Function to extract all image URLs from editor
    const extractImagesFromEditor = (): Set<string> => {
      const images = new Set<string>();
      try {
        const json = editor.getJSON();

        const findImages = (obj: any) => {
          if (Array.isArray(obj)) {
            obj.forEach(item => findImages(item));
          } else if (obj && typeof obj === 'object') {
            if (obj.type === 'image' && obj.attrs?.src && !obj.attrs.src.startsWith('blob:')) {
              images.add(obj.attrs.src);
            }
            Object.keys(obj).forEach(key => {
              findImages(obj[key]);
            });
          }
        };

        findImages(json);
      } catch (error) {
        console.error('[IMAGE DELETION EDITOR] Error extracting images:', error);
      }
      return images;
    };

    // Function to cancel pending deletion (for undo)
    const cancelPendingDeletion = (src: string) => {
      const timeout = pendingDeletionsRef.current.get(src);
      if (timeout) {
        clearTimeout(timeout);
        pendingDeletionsRef.current.delete(src);
        deletionInProgressRef.current.delete(src);
        console.log('[IMAGE DELETION EDITOR] ✅ Cancelled pending deletion (undo detected):', src);
      }
    };

    // Function to delete image from server (with delay for undo)
    const scheduleImageDeletion = (src: string) => {
      // Cancel any existing pending deletion for this image
      cancelPendingDeletion(src);

      if (deletionInProgressRef.current.has(src)) {
        console.log('[IMAGE DELETION EDITOR] Already deleting:', src);
        return;
      }

      deletionInProgressRef.current.add(src);

      // Schedule deletion after 10 seconds (allows time for undo)
      const timeout = setTimeout(async () => {
        try {
          // Check again if image still doesn't exist (user might have undone)
          const currentImages = extractImagesFromEditor();
          if (currentImages.has(src)) {
            console.log('[IMAGE DELETION EDITOR] ⏪ Image restored (undo detected), cancelling deletion:', src);
            deletionInProgressRef.current.delete(src);
            pendingDeletionsRef.current.delete(src);
            return;
          }

          // Extract filename from URL
          const uploadsMatch = src.match(/\/uploads\/([^?#]+)/);
          if (uploadsMatch) {
            const filename = uploadsMatch[1];
            const endpoint = `/notes/${noteId}/attachments/${encodeURIComponent(filename)}`;
            console.log('[IMAGE DELETION EDITOR] 🗑️ CALLING DELETE API (after delay):', {
              endpoint,
              fullUrl: `http://localhost:3001/api${endpoint}`,
              filename,
              url: src
            });

            try {
              const response = await api.delete(endpoint);
              console.log('[IMAGE DELETION EDITOR] ✅ SUCCESS - Deleted image:', filename, response);
            } catch (deleteError: any) {
              if (deleteError?.response?.status !== 404) {
                console.error('[IMAGE DELETION EDITOR] ❌ FAILED to delete:', filename, {
                  status: deleteError?.response?.status,
                  message: deleteError?.response?.data?.message || deleteError?.message,
                  error: deleteError,
                  response: deleteError?.response
                });
              } else {
                console.log('[IMAGE DELETION EDITOR] ℹ️ Image already deleted (404):', filename);
              }
            }
          } else {
            console.error('[IMAGE DELETION EDITOR] ❌ Could not extract filename from URL:', src);
          }
        } catch (error: any) {
          console.error('[IMAGE DELETION EDITOR] ❌ Error processing deletion:', error);
        } finally {
          deletionInProgressRef.current.delete(src);
          pendingDeletionsRef.current.delete(src);
        }
      }, 10000); // 10 second delay for undo

      pendingDeletionsRef.current.set(src, timeout);
      console.log('[IMAGE DELETION EDITOR] ⏰ Scheduled deletion in 10s (undo window):', src);
    };

    // Function to detect and delete removed images
    const checkForDeletedImages = () => {
      const currentImages = extractImagesFromEditor();
      const previousImages = previousImagesRef.current;

      // IMPORTANT: Skip if previous images is empty (initial load or first image upload)
      // This prevents false positives when first uploading an image
      if (previousImages.size === 0) {
        console.log('[IMAGE DELETION EDITOR] ⏭️ Skipping check - initial load (no previous images)');
        previousImagesRef.current = currentImages;
        return;
      }

      console.log('[IMAGE DELETION EDITOR] 🔍 Checking images', {
        previousCount: previousImages.size,
        currentCount: currentImages.size,
        previous: Array.from(previousImages),
        current: Array.from(currentImages)
      });

      // Find images that were deleted (only if we had images before)
      const deletedImages: string[] = [];
      previousImages.forEach((src) => {
        if (!currentImages.has(src)) {
          deletedImages.push(src);
        }
      });

      // Find images that were restored (undo)
      const restoredImages: string[] = [];
      currentImages.forEach((src) => {
        if (!previousImages.has(src) && pendingDeletionsRef.current.has(src)) {
          restoredImages.push(src);
        }
      });

      // Cancel pending deletions for restored images
      restoredImages.forEach(src => cancelPendingDeletion(src));

      // Schedule deletion for removed images (only if we actually had images before)
      if (deletedImages.length > 0 && previousImages.size > 0) {
        console.log('[IMAGE DELETION EDITOR] ⚠️⚠️⚠️ DETECTED DELETED IMAGES:', deletedImages.length, deletedImages);
        deletedImages.forEach(src => scheduleImageDeletion(src));
      }

      // Update previous images
      previousImagesRef.current = currentImages;
    };

    // Initialize images - wait longer to ensure content is fully loaded
    const initializeImages = () => {
      const images = extractImagesFromEditor();
      // Only initialize if we actually have images (prevents false deletion detection)
      if (images.size > 0 || previousImagesRef.current.size === 0) {
        previousImagesRef.current = images;
        console.log('[IMAGE DELETION EDITOR] 📸 Initialized with', images.size, 'images:', Array.from(images));
      }
    };

    // Initialize after editor is ready - longer delays to avoid interfering with uploads
    setTimeout(initializeImages, 1000);
    setTimeout(initializeImages, 2500);
    setTimeout(initializeImages, 5000); // Extra check after everything is loaded

    // METHOD 1: Editor transaction listener
    const transactionHandler = () => {
      console.log('[IMAGE DELETION EDITOR] 📝 Transaction detected');
      setTimeout(checkForDeletedImages, 200);
    };

    // METHOD 2: Editor update listener
    const updateHandler = () => {
      console.log('[IMAGE DELETION EDITOR] 🔄 Update detected');
      setTimeout(checkForDeletedImages, 200);
    };

    // METHOD 4: Undo/Redo detection
    const undoRedoHandler = () => {
      console.log('[IMAGE DELETION EDITOR] ⏪ Undo/Redo detected - checking for restored images');
      setTimeout(checkForDeletedImages, 100);
    };

    // METHOD 3: DOM MutationObserver (catches everything)
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeName === 'IMG' || (node as Element).querySelector?.('img')) {
              shouldCheck = true;
            }
          });
        }
      });
      if (shouldCheck) {
        console.log('[IMAGE DELETION EDITOR] 🎯 DOM mutation detected - image removed');
        setTimeout(checkForDeletedImages, 300);
      }
    });

    // Attach all listeners
    editor.on('transaction', transactionHandler);
    editor.on('update', updateHandler);
    editor.on('create', undoRedoHandler); // Fires on undo/redo

    // Also listen for undo/redo via keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'y')) {
        console.log('[IMAGE DELETION EDITOR] ⌨️ Undo/Redo keyboard shortcut detected');
        setTimeout(checkForDeletedImages, 100);
      }
    };

    // Observe DOM changes
    const editorElement = editor.view.dom;
    observer.observe(editorElement, {
      childList: true,
      subtree: true
    });

    // Add keyboard listener
    editorElement.addEventListener('keydown', handleKeyDown);

    console.log('[IMAGE DELETION EDITOR] ✅ All listeners attached');

    return () => {
      editor.off('transaction', transactionHandler);
      editor.off('update', updateHandler);
      editor.off('create', undoRedoHandler);
      editorElement.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();

      // Cancel all pending deletions
      pendingDeletionsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingDeletionsRef.current.clear();

      console.log('[IMAGE DELETION EDITOR] 🛑 All listeners removed');
    };
  }, [editor, noteId, isTemplate, editorKey]);

  // ✅ CLEAN YJS UPDATES - Simple and reliable
  React.useEffect(() => {
    if (!ydoc || !noteId) return;
    console.log('[YJS DEBUG] Setting up Yjs update listener for noteId:', noteId);

    const handler = () => {
      console.log('[YJS DEBUG] Yjs update event fired');
      // Additional protection: don't trigger save if already saving
      if (isSavingRef.current) {
        console.log('[YJS DEBUG] Save in progress, ignoring update event');
        return;
      }
      debouncedSave.current(noteId, ydoc, isTemplate ?? false, noteData, editor);
    };

    ydoc.on('update', handler);

    // Listen for editor updates to detect recurring task completion
    // Track previous task states to detect when a recurring task is newly completed
    let previousTaskStates = new Map<string, boolean>();

    if (!isTemplate && noteId && editor) {
      // Initialize previous states
      try {
        const initialJSON = editor.getJSON();
        const initialTasks = extractTasksFromProseMirrorJSON(initialJSON, noteId);
        initialTasks.forEach(t => {
          const taskKey = `${t.taskId || t.title}|${t.dueDateWall || ''}|${t.position || 0}`;
          previousTaskStates.set(taskKey, t.status === 'completed');
        });
      } catch (error) {
        console.warn('[TASK SYNC] Error initializing task states:', error);
      }

      editor.on('update', () => {
        // Check if ANY task was changed (checked/unchecked) and sync to database
        try {
          const editorJSON = editor.getJSON();
          const tasks = extractTasksFromProseMirrorJSON(editorJSON, noteId);

          // Check for any task state changes
          let hasTaskChanges = false;
          let hasNewlyCompletedRecurring = false;
          tasks.forEach(t => {
            const taskKey = `${t.taskId || t.title}|${t.dueDateWall || ''}|${t.position || 0}`;
            const wasCompleted = previousTaskStates.get(taskKey) || false;
            const isCompleted = t.status === 'completed';

            if (wasCompleted !== isCompleted) {
              hasTaskChanges = true;
            }

            if (!wasCompleted && isCompleted && t.isRecurring && t.recurringPattern) {
              hasNewlyCompletedRecurring = true;
            }

            // Update state
            previousTaskStates.set(taskKey, isCompleted);
          });

          if (hasTaskChanges || hasNewlyCompletedRecurring) {
            // Immediately sync ALL task changes to database
            fastSave.current(noteId, isTemplate ?? false, editor);
          }
        } catch (error) {
          // Ignore errors in check
          console.warn('[TASK SYNC] Error checking task changes:', error);
        }
      });
    }

    // Also sync tasks immediately when note is loaded (for existing tasks)
    if (!isTemplate && noteId) {
      const syncTasksOnLoad = async () => {
        try {
          console.log('[TASK SYNC] Starting initial sync on note load for noteId:', noteId);
          let tasks: any[] = [];

          // Try editor.getJSON() first if editor is available
          if (editor) {
            try {
              const editorJSON = editor.getJSON();
              tasks = extractTasksFromProseMirrorJSON(editorJSON, noteId);
              console.log('[TASK SYNC] Initial sync - found', tasks.length, 'tasks via editor JSON');
            } catch (editorError) {
              console.warn('[TASK SYNC] Editor JSON extraction failed, falling back to Yjs:', editorError);
            }
          }

          // Fallback to Yjs extraction if no tasks found
          if (tasks.length === 0) {
            tasks = extractTasksFromYjsDoc(ydoc, noteId);
            console.log('[TASK SYNC] Initial sync - found', tasks.length, 'tasks via Yjs extraction');
          }

          if (tasks.length > 0) {
            const result = await syncTasksFromNote(noteId, tasks);
            console.log('[TASK SYNC] Initial sync completed:', result);
          } else {
            console.log('[TASK SYNC] No tasks found in note, clearing any existing tasks');
            await syncTasksFromNote(noteId, []);
          }
        } catch (error) {
          console.error('[TASK SYNC] Error in initial sync:', error);
          console.error('[TASK SYNC] Error stack:', error instanceof Error ? error.stack : 'No stack');
        }
      };
      // ✅ REMOVED DELAY: Sync immediately when editor is ready (reduced from 2000ms to 500ms for Yjs initialization)
      setTimeout(syncTasksOnLoad, 500);
    }

    return () => {
      ydoc.off('update', handler);
      debouncedSave.current.cancel && debouncedSave.current.cancel();
      fastSave.current.cancel && fastSave.current.cancel();
      if (editor) {
        editor.off('update');
      }
    };
  }, [ydoc, noteId, isTemplate, syncTasksFromNote, editor]);

  // Sync editor tasks FROM database when tasks are updated externally (e.g., from calendar)
  React.useEffect(() => {
    if (!editor || !noteId || isTemplate) return;

    // Get tasks for this note from the store
    const noteTasks = tasks.filter(t => t.noteId === noteId);
    if (noteTasks.length === 0) return;

    // Update editor task nodes to match database state
    const updateEditorTasksFromDatabase = () => {
      try {
        const editorJSON = editor.getJSON();
        const editorTasks = extractTasksFromProseMirrorJSON(editorJSON, noteId);

        // Create lookup keys by backend id when anchored, with title+position as a fallback.
        const dbTasksMap = new Map();
        noteTasks.forEach(dbTask => {
          const position = (dbTask as any).position || 0;
          if (dbTask.id) dbTasksMap.set(`${dbTask.id}|${position}`, dbTask);
          dbTasksMap.set(`${dbTask.title}|${position}`, dbTask);
        });

        // Find and update task nodes that don't match database
        let hasChanges = false;
        editorTasks.forEach(editorTask => {
          const key = `${editorTask.taskId || editorTask.title}|${editorTask.position || 0}`;
          const dbTask = dbTasksMap.get(key);
          const editorCompleted = editorTask.status === 'completed';
          const dbCompleted = dbTask?.status === 'completed';

          if (dbTask && editorCompleted !== dbCompleted) {
            // Database has different completion state, update editor
            hasChanges = true;

            // Find the task node in the editor and update it
            editor.chain().focus().command(({ tr, state }) => {
              let updated = false;
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'taskItem') {
                  const nodeText = node.textContent.trim();
                  if ((editorTask.taskId && node.attrs.taskId === editorTask.taskId) || nodeText === editorTask.title) {
                    tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      snapshotStatus: dbTask.status,
                      snapshotEtag: (dbTask as any).etag || node.attrs.snapshotEtag,
                      dueDateWall: dbTask.dueDateWall || null,
                      recurrenceRule: (dbTask as any).recurrenceRule || null,
                      recurringPattern: dbTask.recurringPattern || null,
                      isRecurring: dbTask.isRecurring || false,
                      checked: dbCompleted,
                      completedAt: dbCompleted ? (dbTask.completedAt || new Date().toISOString()) : null
                    });
                    updated = true;
                    return false; // Stop searching
                  }
                }
              });
              return updated;
            }).run();
          }
        });

        if (hasChanges) {
          console.log('[TASK SYNC] Updated editor tasks from database for note:', noteId);
        }
      } catch (error) {
        console.warn('[TASK SYNC] Error updating editor from database:', error);
      }
    };

    // Debounce the update to avoid too frequent updates
    const timeoutId = setTimeout(updateEditorTasksFromDatabase, 500);
    return () => clearTimeout(timeoutId);
  }, [tasks, noteId, editor, isTemplate]);

  // 🎯 ENHANCED SCROLL PROTECTION - Based on TABLE_SCROLL_FIX_README.md
  React.useEffect(() => {
    if (!editor) return;

    console.log(`[SCROLL DEBUG] 🎯 Setting up enhanced scroll protection`);

    // Store scroll positions by table position in ProseMirror document
    const scrollPositions = new Map<number, number>();

    // Get table position in ProseMirror document from DOM element
    const getTablePosition = (wrapper: HTMLElement): number | null => {
      try {
        const table = wrapper.querySelector('table');
        if (!table) return null;

        const pos = editor.view.posAtDOM(table, 0);
        if (pos === null || pos === undefined) return null;

        return pos;
      } catch (e) {
        console.error('[SCROLL ERROR] Failed to get table position:', e);
        return null;
      }
    };

    // Real-time scroll tracking
    const handleScroll = (event: Event) => {
      const wrapper = event.target as HTMLElement;
      if (wrapper.classList.contains('tableWrapper')) {
        const tablePos = getTablePosition(wrapper);
        if (tablePos !== null) {
          scrollPositions.set(tablePos, wrapper.scrollLeft);
          // console.log(`[SCROLL DEBUG] Stored scroll position for table-${tablePos}: ${wrapper.scrollLeft}`);
        }
      }
    };

    // Enhanced restoration with multiple retry attempts
    const restoreScrollPositions = () => {
      const wrappers = editor.view.dom.querySelectorAll('.tableWrapper');
      // console.log(`[SCROLL DEBUG] Restoring scroll positions for ${wrappers.length} table(s)`);

      wrappers.forEach((wrapper) => {
        const element = wrapper as HTMLElement;
        const tablePos = getTablePosition(element);

        if (tablePos !== null) {
          const savedPosition = scrollPositions.get(tablePos);

          if (savedPosition !== undefined && Math.abs(element.scrollLeft - savedPosition) > 1) {
            console.log(`[SCROLL DEBUG] Restored scroll position for table-${tablePos}: ${savedPosition}`);
            // Use scrollTo with instant behavior for smooth restoration
            element.scrollTo({
              left: savedPosition,
              behavior: 'instant'
            });
          }
        }
      });
    };

    // Enhanced MutationObserver - block browser extensions AND restore scroll
    const observer = new MutationObserver((mutations) => {
      let shouldRestoreScroll = false;

      mutations.forEach((mutation) => {
        // Block browser extension attributes
        if (mutation.type === 'attributes' &&
          mutation.attributeName === 'bis_skin_checked' &&
          mutation.target) {
          const target = mutation.target as HTMLElement;
          if (target.classList?.contains('tableWrapper')) {
            target.removeAttribute('bis_skin_checked');
          }
        }

        // Detect DOM changes that might reset scroll
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target.classList?.contains('tableWrapper') ||
            target.closest('.tableWrapper')) {
            shouldRestoreScroll = true;
          }
        }
      });

      // Restore scroll positions after DOM mutations
      if (shouldRestoreScroll) {
        // Use multiple attempts to ensure scroll is restored
        requestAnimationFrame(() => {
          restoreScrollPositions();
          // Second attempt after a short delay
          setTimeout(() => restoreScrollPositions(), 10);
          setTimeout(() => restoreScrollPositions(), 50);
        });
      }
    });

    // Add scroll listener
    editor.view.dom.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    // Observe DOM changes and attributes
    observer.observe(editor.view.dom, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['bis_skin_checked'] // Watch for browser extension attributes
    });

    // Restore scroll positions when Yjs updates occur
    const yjsUpdateHandler = () => {
      console.log(`[SCROLL DEBUG] Yjs update detected, will restore scroll positions`);
      requestAnimationFrame(() => {
        restoreScrollPositions();
        // Additional attempts for Yjs updates
        setTimeout(() => restoreScrollPositions(), 10);
        setTimeout(() => restoreScrollPositions(), 50);
        setTimeout(() => restoreScrollPositions(), 100);
      });
    };

    if (ydoc) {
      ydoc.on('update', yjsUpdateHandler);
    }

    return () => {
      editor.view.dom.removeEventListener('scroll', handleScroll, { capture: true });
      observer.disconnect();
      if (ydoc) {
        ydoc.off('update', yjsUpdateHandler);
      }
      console.log(`[SCROLL DEBUG] 🎯 Enhanced scroll protection cleaned up`);
    };
  }, [editor, editorKey, ydoc]);

  // Handle link clicks for navigation
  React.useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');

      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          event.preventDefault();

          if (href.startsWith('note://')) {
            // Handle internal note navigation - use React Router
            const noteId = href.replace('note://', '');
            console.log('Navigating to note via React Router:', noteId);
            navigate(`/notes?note=${noteId}`);
          } else if (href.startsWith('template://')) {
            // Handle internal template navigation - use React Router
            const templateId = href.replace('template://', '');
            console.log('Navigating to template via React Router:', templateId);
            navigate(`/templates?template=${templateId}`);
          } else if (href.startsWith('http://') || href.startsWith('https://')) {
            // Handle external links
            window.open(href, '_blank', 'noopener,noreferrer');
          } else if (href.startsWith('mailto:')) {
            // Handle email links
            window.location.href = href;
          } else if (href.startsWith('tel:')) {
            // Handle phone links
            window.location.href = href;
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleClick);

    // Hover handlers to show link bubble (do not auto-close on move; let bubble manage closing)
    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a');
      if (link && editorElement.contains(link)) {
        const rect = link.getBoundingClientRect();
        const href = link.getAttribute('href') || '';
        const targetAttr = link.getAttribute('target') || undefined;
        const text = link.textContent || href;
        console.log('Setting linkBubbleData:', { href, text, target: targetAttr });
        setLinkBubbleData({ href, text, target: targetAttr });
        setLinkBubblePos({ x: rect.left + rect.width / 2, y: rect.top });
        setLinkBubbleOpen(true);
      }
    };

    editorElement.addEventListener('mousemove', handleMouseMove);

    return () => {
      editorElement.removeEventListener('click', handleClick);
      editorElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, [editor]);

  // React.useEffect(() => {
  //   if (provider && ydoc) {
  //     const yXml = ydoc.getXmlFragment('prosemirror');
  //     // const logYjsContent = () => {
  //     //   const yjsContent = yXml.toJSON ? yXml.toJSON() : [];
  //     //   console.log('[DEBUG] Yjs XML Fragment (prosemirror):', JSON.stringify(yjsContent, null, 2));
  //     // };
  //     ydoc.on('update', logYjsContent);
  //     // Log once after connection
  //     logYjsContent();
  //     return () => {
  //       ydoc && ydoc.off('update', logYjsContent);
  //     };
  //   }
  // }, [editor, editorKey, ydoc]);

  return (
    <div>
      {!hideToolbar && <EditorToolbar editor={editor as Editor | null} noteId={noteId} onOpenLinkModal={() => setLinkModalOpen(true)} />}
      {/* Title below toolbar */}
      {title && (
        <div className="px-0 pt-2 pb-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        </div>
      )}
      <EditorContent editor={editor} />
      {editor && <TableCellMenuOverlay editor={editor} />}

      {editor && (
        <LinkBubble
          editor={editor}
          isOpen={linkBubbleOpen}
          onClose={() => setLinkBubbleOpen(false)}
          linkData={linkBubbleData}
          position={linkBubblePos}
          onEdit={() => {
            console.log('Edit button clicked, linkBubbleData:', linkBubbleData);
            setLinkModalInitialUrl(linkBubbleData.href || '');
            setLinkModalInitialText(linkBubbleData.text || '');
            setLinkBubbleOpen(false);
            setLinkModalOpen(true);
          }}
        />
      )}

      {editor && (
        <LinkModal
          editor={editor}
          isOpen={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          initialUrl={linkModalInitialUrl}
          initialText={linkModalInitialText}
        />
      )}
    </div>
  );
};
