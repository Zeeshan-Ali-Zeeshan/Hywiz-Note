import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useNotesStore } from '../stores/useNotesStore';
import { useNotebooksStore } from '../stores/useNotebooksStore';
import { useTemplatesStore } from '../stores/useTemplatesStore';
import { useFilesStore } from '../stores/useFilesStore';
import { useCalendarStore } from '../stores/useCalendarStore';
import { useTasksStore } from '../stores/useTasksStore';
import { useUIStore } from '../stores/useUIStore';
import { useWorkspacesStore } from '../stores/useWorkspacesStore';
import * as Y from 'yjs';
import { Navigate, useNavigate } from 'react-router-dom';
import { FileText, Search, Star, Folder, BookOpen, Share2, BarChart3, CheckSquare, CalendarDays, LayoutTemplate, ChevronDown, LogOut, User as UserIcon, Filter, X, File, FileImage, Play, FileAudio, FileSpreadsheet, FileText as FileTextIcon } from 'lucide-react';
import { getPlainTextPreview, extractTitleFromYjs, hasTasksInYjs, extractPlainTextFromYjs } from '../lib/yjsUtils';
import api from '../lib/api';
import vector from './img/1.png';
import vector2 from './img/2.png';
import vector3 from './img/3.png';
import vector4 from './img/4.png';

const Dashboard: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuthStore();
  const { notes, fetchNotes, createNote, setCurrentNote } = useNotesStore();
  const { notebooks, fetchNotebooks, defaultNotebook } = useNotebooksStore();
  const { templates, fetchTemplates } = useTemplatesStore();
  const { files, fetchFiles } = useFilesStore();
  const { events, fetchEvents, googleCalendarEvents } = useCalendarStore();
  const { fetchTasks } = useTasksStore();
  const { theme } = useUIStore();
  const { currentWorkspace, defaultWorkspace, fetchWorkspaces } = useWorkspacesStore() as any;
  const navigate = useNavigate();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const accountRef = useRef<HTMLDivElement | null>(null);

  // Overview section state
  const [activeOverviewTab, setActiveOverviewTab] = useState<'scratchpad' | 'notes' | 'files' | 'calendar' | 'tasks' | 'shared'>('scratchpad');

  // Scratch pad state
  const [scratchPadContent, setScratchPadContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Compute line color for scratch pad based on theme
  const scratchLineColor = theme === 'light'
    ? 'rgba(251, 191, 36, 0.30)'
    : 'rgba(251, 191, 36, 0.16)';

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [quickFilters, setQuickFilters] = useState({
    contentType: localStorage.getItem('dashboardContentType') || 'all',
    dateRange: 'all',
    notebook: '',
    isPinned: false,
    isShortcut: false
  });

  // Shared items state for "Shared" tab
  type SharedItem = {
    _id: string;
    type: 'note' | 'template';
    title: string;
    plainTextContent?: string;
    content?: string;
    yjsUpdate?: string; // base64-encoded when fetched individually
    updatedAt: string;
    userId: { _id: string; name: string; email: string; avatar?: string };
  };
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [loadingShared, setLoadingShared] = useState<boolean>(false);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        setLoadingShared(true);
        const res = await api.get('/sharing/collaborative');
        const items: SharedItem[] = res.data || [];

        // Enrich items with Yjs-derived title/content when needed
        const enriched = await Promise.all(items.slice(0, 12).map(async (item) => {
          try {
            if (item.type === 'note') {
              const noteRes = await api.get(`/notes/${item._id}`);
              const note = noteRes.data || {};
              const yjsUpdate: string | undefined = note.yjsUpdate;
              return {
                ...item,
                yjsUpdate,
                title: (yjsUpdate ? extractTitleFromYjs(yjsUpdate) : item.title) || item.title,
                plainTextContent: (yjsUpdate ? getPlainTextPreview(yjsUpdate) : item.plainTextContent) || item.plainTextContent
              } as SharedItem;
            }
            if (item.type === 'template') {
              const tplRes = await api.get(`/templates/${item._id}`);
              const tpl = tplRes.data || {};
              const yjsUpdate: string | undefined = tpl.yjsUpdate;
              return {
                ...item,
                yjsUpdate,
                title: (yjsUpdate ? extractTitleFromYjs(yjsUpdate) : item.title) || item.title,
                plainTextContent: (yjsUpdate ? getPlainTextPreview(yjsUpdate) : item.plainTextContent) || item.plainTextContent
              } as SharedItem;
            }
          } catch (e) {
            // Fallback to item as-is if enrichment fails
          }
          return item;
        }));

        setSharedItems(enriched);
      } catch (e) {
        console.error('Failed to load shared items', e);
      } finally {
        setLoadingShared(false);
      }
    };
    if (activeOverviewTab === 'shared' && sharedItems.length === 0 && !loadingShared) {
      fetchShared();
    }
  }, [activeOverviewTab]);

  
  // State for managing image URLs
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageUrlsRef = useRef<Record<string, string>>({});
  const previewRetryRef = useRef<Record<string, number>>({});
  const pendingReleasesRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  const releaseBlobUrl = (url?: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    setImageUrls(prev => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }
      const validIds = new Set(files.map(file => file._id));
      let changed = false;
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (!validIds.has(id)) {
          releaseBlobUrl(updated[id]);
          delete updated[id];
          delete previewRetryRef.current[id];
          delete pendingReleasesRef.current[id];
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [files]);

  useEffect(() => {
    // Ensure core data is loaded, including defaults
    fetchWorkspaces?.();
    fetchNotes({ limit: 6, sortBy: 'lastViewedAt' });
    fetchNotebooks();
    fetchTemplates();
    fetchFiles();
    fetchTasks();
    // Fetch calendar events for the next 7 days
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    fetchEvents(startDate, endDate);
  }, [fetchNotes, fetchNotebooks, fetchTemplates, fetchFiles, fetchTasks, fetchEvents]);

  // Load scratch pad content from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('scratchpad-content');
    if (saved) {
      setScratchPadContent(saved);
    }
  }, []);

  // Auto-save scratch pad content
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (scratchPadContent.trim()) {
        setIsSaving(true);
        localStorage.setItem('scratchpad-content', scratchPadContent);
        setLastSaved(new Date());
        // Simulate a brief saving animation
        setTimeout(() => setIsSaving(false), 500);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [scratchPadContent]);

  // Load image URLs for files that have previews
  useEffect(() => {
    const loadImageUrls = async () => {
      const newImageUrls: Record<string, string> = {};
      
      for (const file of files) {
        if (hasPreview(file.mimetype || '') && !imageUrls[file._id]) {
          const url = await createAuthenticatedImageUrl(file._id);
          if (url) {
            // For videos, create a thumbnail from the video
            if (file.mimetype?.startsWith('video/')) {
              try {
                const thumbnailUrl = await createVideoThumbnail(url);
                const queue = pendingReleasesRef.current[file._id] || [];
                queue.push(url);
                pendingReleasesRef.current[file._id] = queue;
                newImageUrls[file._id] = thumbnailUrl;
              } catch (error) {
                console.error('Failed to create video thumbnail:', error);
                // Keep the video URL as fallback
                newImageUrls[file._id] = url;
              }
            } else {
              // For images, use the URL directly
              newImageUrls[file._id] = url;
            }
          }
        }
      }
      
      if (Object.keys(newImageUrls).length > 0) {
        setImageUrls(prev => {
          const updated = { ...prev };
          Object.entries(newImageUrls).forEach(([id, url]) => {
            const previous = updated[id];
            if (previous && previous !== url) {
              const queue = pendingReleasesRef.current[id] || [];
              queue.push(previous);
              pendingReleasesRef.current[id] = queue;
            }
            updated[id] = url;
            previewRetryRef.current[id] = 0;
          });
          return updated;
        });
      }
    };

    if (files.length > 0) {
      loadImageUrls();
    }
  }, [files]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(imageUrlsRef.current).forEach(releaseBlobUrl);
      Object.values(pendingReleasesRef.current).forEach(list => {
        list.forEach(releaseBlobUrl);
      });
      pendingReleasesRef.current = {};
    };
  }, []);

  const handlePreviewLoad = (fileId: string, target: HTMLImageElement) => {
    previewRetryRef.current[fileId] = 0;
    target.style.display = 'block';
    target.nextElementSibling?.classList.add('hidden');

    const pending = pendingReleasesRef.current[fileId];
    if (pending && pending.length > 0) {
      pending.forEach(releaseBlobUrl);
      delete pendingReleasesRef.current[fileId];
    }
  };

  const handlePreviewError = (fileId: string, target: HTMLImageElement) => {
    target.style.display = 'none';
    target.nextElementSibling?.classList.remove('hidden');

    const attempts = previewRetryRef.current[fileId] ?? 0;
    if (attempts >= 2) {
      return;
    }

    previewRetryRef.current[fileId] = attempts + 1;

    let previousUrl: string | undefined;
    setImageUrls(prev => {
      previousUrl = prev[fileId];
      if (!prev[fileId]) {
        return prev;
      }
      const { [fileId]: _removed, ...rest } = prev;
      return rest;
    });

    releaseBlobUrl(previousUrl);
    delete pendingReleasesRef.current[fileId];

    createAuthenticatedImageUrl(fileId)
      .then(newUrl => {
        if (!newUrl) {
          return;
        }
        setImageUrls(prev => {
          const current = prev[fileId];
          releaseBlobUrl(current);
          previewRetryRef.current[fileId] = 0;
          return { ...prev, [fileId]: newUrl };
        });
      })
      .catch(() => {});
  };

  // Auto-scroll to current time in calendar timeline
  useEffect(() => {
    if (activeOverviewTab === 'calendar') {
      const timelineElement = document.querySelector('.timeline-container');
      if (timelineElement) {
        const now = new Date();
        const currentHour = now.getHours();
        const scrollPosition = (currentHour * 60 + now.getMinutes()) * (60/60) - 120;
        timelineElement.scrollTop = Math.max(0, scrollPosition);
      }
    }
  }, [activeOverviewTab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.filter-dropdown')) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigation handlers for quick actions
  const handleNavigate = (path: string) => navigate(path);
  const handleNotebookClick = () => {
    if (notebooks && notebooks.length > 0) {
      navigate(`/notebooks/${notebooks[0]._id}`);
    } else {
      navigate('/notebooks');
    }
  };

  const handleCreateFirstNote = async () => {
    try {
      if (!user) {
        console.error('User not authenticated');
        navigate('/login');
        return;
      }
      const newNote = await createNote({});
      setCurrentNote(newNote);
      navigate(`/notes?note=${newNote._id}`);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  // Scratch pad handlers
  const handleConvertToNote = async () => {
    if (!scratchPadContent.trim()) return;
    
    setIsConverting(true);
    try {
      if (!user) {
        console.error('User not authenticated');
        navigate('/login');
        return;
      }
      
      let resolvedWorkspaceId = currentWorkspace?._id || defaultWorkspace?._id;
      if (!resolvedWorkspaceId) {
        try { await fetchWorkspaces?.(); } catch {}
        // Read the freshest store state after fetch
        try {
          const wsState = (await import('../stores/useWorkspacesStore')).useWorkspacesStore.getState();
          resolvedWorkspaceId = wsState.currentWorkspace?._id || wsState.defaultWorkspace?._id;
        } catch {}
      }
      if (!resolvedWorkspaceId) {
        console.error('No workspace selected');
        setIsConverting(false);
        return;
      }
      
      // Build a Yjs document with title and content in the structures the editor expects
      const ydoc = new Y.Doc();
      const title = (scratchPadContent.split('\n')[0] || 'Scratch Pad Note').trim();
      const body = scratchPadContent;

      // Title: use XmlFragment('title') with a Y.XmlText node
      const yTitleFrag = ydoc.getXmlFragment('title');
      const yTitleText = new Y.XmlText();
      yTitleText.insert(0, title);
      yTitleFrag.insert(0, [yTitleText]);

      // Content for the editor: XmlFragment('prosemirror') with paragraphs (TipTap expects 'paragraph')
      const yPm = ydoc.getXmlFragment('prosemirror');
      const lines = body.split(/\r?\n/);
      const paraNodes: Y.XmlElement[] = (lines.length ? lines : ['']).map((line) => {
        const para = new Y.XmlElement('paragraph');
        if (line && line.length > 0) {
          const t = new Y.XmlText();
          t.insert(0, line);
          para.insert(0, [t]);
        }
        return para;
      });
      yPm.insert(0, paraNodes);

      // Also add a 'default' fragment so plain-text utilities and previews can read content
      const yDefault = ydoc.getXmlFragment('default');
      const defaultParas: Y.XmlElement[] = (lines.length ? lines : ['']).map((line) => {
        const para = new Y.XmlElement('paragraph');
        if (line && line.length > 0) {
          const t = new Y.XmlText();
          t.insert(0, line);
          para.insert(0, [t]);
        }
        return para;
      });
      yDefault.insert(0, defaultParas);
      
      const update = Y.encodeStateAsUpdate(ydoc);
      const yjsUpdate = btoa(String.fromCharCode.apply(null, Array.from(update)));
      
      // Prefer default notebook under the resolved workspace when available
      let primaryNotebookId = defaultNotebook?._id;
      if (!primaryNotebookId) {
        try { await fetchNotebooks(); } catch {}
        try {
          const nbState = (await import('../stores/useNotebooksStore')).useNotebooksStore.getState();
          primaryNotebookId = nbState.defaultNotebook?._id || undefined;
        } catch {}
      }
      const notebookIds = primaryNotebookId ? [primaryNotebookId] : [];

      const newNote = await createNote({
        workspaceId: resolvedWorkspaceId,
        primaryNotebookId,
        notebookIds,
        // Fallback fields so UI has something even if yjsUpdate isn't immediately used
        title,
        content: body,
        preview: body.slice(0, 200),
        yjsUpdate
      });
      
      setCurrentNote(newNote);
      setScratchPadContent(''); // Clear scratch pad after conversion
      localStorage.removeItem('scratchpad-content');
      setLastSaved(null);
      
      navigate(`/notes?note=${newNote._id}`);
    } catch (error) {
      console.error('Failed to convert scratch pad to note:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleClearScratchPad = () => {
    if (window.confirm('Are you sure you want to clear the scratch pad? This action cannot be undone.')) {
      setScratchPadContent('');
      localStorage.removeItem('scratchpad-content');
      setLastSaved(null);
    }
  };

  // Keyboard shortcuts for scratch pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when scratch pad tab is active
      if (activeOverviewTab !== 'scratchpad') return;
      
      // Ctrl/Cmd + Enter: Convert to note
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConvertToNote();
      }
      
      // Ctrl/Cmd + K: Clear scratch pad
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleClearScratchPad();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeOverviewTab, scratchPadContent, isConverting]);


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const first = names[0]?.charAt(0) || '';
    const second = names[1]?.charAt(0) || '';
    return (first + second).toUpperCase() || 'U';
  };

  // Helper function to get file type icon
  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return FileImage;
    if (mimetype.startsWith('video/')) return Play;
    if (mimetype.startsWith('audio/')) return FileAudio;
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype.includes('csv')) return FileSpreadsheet;
    if (mimetype.includes('pdf')) return FileTextIcon;
    if (mimetype.includes('text/') || mimetype.includes('document')) return FileTextIcon;
    return File;
  };

  // Helper function to get file type color
  const getFileColor = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return 'text-green-600 dark:text-green-400 black:text-green-400';
    if (mimetype.startsWith('video/')) return 'text-purple-600 dark:text-purple-400 black:text-purple-400';
    if (mimetype.startsWith('audio/')) return 'text-pink-600 dark:text-pink-400 black:text-pink-400';
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype.includes('csv')) return 'text-emerald-600 dark:text-emerald-400 black:text-emerald-400';
    if (mimetype.includes('pdf')) return 'text-red-600 dark:text-red-400 black:text-red-400';
    if (mimetype.includes('text/') || mimetype.includes('document')) return 'text-blue-600 dark:text-blue-400 black:text-blue-400';
    return 'text-gray-600 dark:text-gray-400 black:text-gray-400';
  };


  // Helper function to create authenticated image URL
  const createAuthenticatedImageUrl = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error('Failed to load image:', error);
    }
    return null;
  };

  // Helper function to create video thumbnail
  const createVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadeddata = () => {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        
        // Seek to 1 second for thumbnail
        video.currentTime = 1;
      };
      
      video.onseeked = () => {
        if (ctx) {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob URL
          canvas.toBlob((blob) => {
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob);
              resolve(thumbnailUrl);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        } else {
          reject(new Error('Canvas context not available'));
        }
      };
      
      video.onerror = () => {
        reject(new Error('Video loading failed'));
      };
      
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';
    });
  };

  // Helper function to check if file has preview
  const hasPreview = (mimetype: string) => {
    return mimetype?.startsWith('image/') || mimetype?.startsWith('video/');
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get upcoming events
  const getUpcomingEvents = () => {
    const allEvents = [...events, ...googleCalendarEvents];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return allEvents
      .filter(event => {
        const eventDate = new Date(event.startTime || event.start?.dateTime || event.start?.date);
        return eventDate >= now && eventDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startTime || a.start?.dateTime || a.start?.date);
        const dateB = new Date(b.startTime || b.start?.dateTime || b.start?.date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 8);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // Search through notes
      let filteredNotes = notes.filter(note => {
        const searchTerm = query.toLowerCase();
        
        // Extract title from YJS data if available
        const yjsTitle = note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : '';
        const fallbackTitle = note.title || '';
        const title = (yjsTitle || fallbackTitle).toLowerCase();
        
        // Extract content from YJS data if available
        const yjsContent = note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) : '';
        const fallbackContent = note.content || '';
        const content = (yjsContent || fallbackContent).toLowerCase();
        
        const tags = note.tags?.map(tag => {
          if (typeof tag === 'string') return tag.toLowerCase();
          return (tag.name || '').toLowerCase();
        }).join(' ') || '';
        
        // Basic text search
        const textMatch = title.includes(searchTerm) || 
                         content.includes(searchTerm) || 
                         tags.includes(searchTerm);
        
        if (!textMatch) return false;
        
        // Apply content type filter
        if (quickFilters.contentType !== 'all' && quickFilters.contentType !== 'notes') {
          return false;
        }
        
        // Apply notebook filter
        if (quickFilters.notebook && note.primaryNotebookId) {
          const notebookId = typeof note.primaryNotebookId === 'string' 
            ? note.primaryNotebookId 
            : note.primaryNotebookId._id;
          if (notebookId !== quickFilters.notebook) {
            return false;
          }
        }
        
        // Apply pinned filter
        if (quickFilters.isPinned && !note.isPinned) {
          return false;
        }
        
        // Apply shortcut filter
        if (quickFilters.isShortcut && !note.isShortcut) {
          return false;
        }
        
        // Apply date range filter
        if (quickFilters.dateRange !== 'all') {
          const noteDate = new Date(note.updatedAt);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - noteDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          switch (quickFilters.dateRange) {
            case 'today':
              if (diffDays > 1) return false;
              break;
            case 'week':
              if (diffDays > 7) return false;
              break;
            case 'month':
              if (diffDays > 30) return false;
              break;
            case 'year':
              if (diffDays > 365) return false;
              break;
          }
        }
        
        return true;
      }).map(note => ({ ...note, type: 'note' }));
      
      // Search through templates
      let filteredTemplates = templates.filter(template => {
        const searchTerm = query.toLowerCase();
        const title = template.title || '';
        const description = template.description || '';
        const tags = template.tags?.map(tag => {
          if (typeof tag === 'string') return tag.toLowerCase();
          return (tag.name || '').toLowerCase();
        }).join(' ') || '';

        // Basic text search
        const textMatch = title.toLowerCase().includes(searchTerm) || 
                         description.toLowerCase().includes(searchTerm) || 
                         tags.includes(searchTerm);
        
        if (!textMatch) return false;
        
        // Apply content type filter
        if (quickFilters.contentType !== 'all' && quickFilters.contentType !== 'templates') {
          return false;
        }
        
        // Apply pinned filter
        if (quickFilters.isPinned && !template.isPinned) {
          return false;
        }
        
        // Apply shortcut filter
        if (quickFilters.isShortcut && !template.isShortcut) {
          return false;
        }
        
        // Apply date range filter
        if (quickFilters.dateRange !== 'all') {
          const templateDate = new Date(template.updatedAt);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - templateDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          switch (quickFilters.dateRange) {
            case 'today':
              if (diffDays > 1) return false;
              break;
            case 'week':
              if (diffDays > 7) return false;
              break;
            case 'month':
              if (diffDays > 30) return false;
              break;
            case 'year':
              if (diffDays > 365) return false;
              break;
          }
        }
        
        return true;
      }).map(template => ({ ...template, type: 'template' }));

      // Combine results
      setSearchResults([...filteredNotes, ...filteredTemplates]);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 black:bg-[#242424] min-h-full overflow-y-auto transition-colors duration-200">
      <div className="p-6 max-w-[1920px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 bg-clip-text text-transparent">
              Welcome Back {user?.name || 'User'}
            </h1>
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 black:text-gray-200 mt-3">
              Ready to organize your thoughts and boost productivity with your personal workspace?
            </p>
          </div>
          {/* Account Button */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex items-center space-x-2 px-2.5 py-1.5 bg-white dark:bg-gray-800 black:bg-[#242424] hover:bg-gray-50 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] transition-colors"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center">
                  {getInitials(user?.name)}
                </div>
              )}
              {/* <span className="hidden sm:block text-xs font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200 max-w-[140px] truncate">
                {user?.name || 'Account'}
              </span> */}
              {/* <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 black:text-gray-400" /> */}
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-800 black:bg-[#242424] shadow-xl overflow-hidden z-20">
                <div className="p-3 flex items-center space-x-3">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white text-sm font-bold flex items-center justify-center">
                      {getInitials(user?.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 black:text-gray-100 truncate">{user?.name || 'User'}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 black:text-gray-300 truncate">{user?.email || ''}</div>
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]"></div>
                <div className="p-2">
                  <button
                    onClick={() => { setShowAccountMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a]"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
            </div>
            )}
          </div>
          </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-full shadow-lg p-3 flex items-center justify-between transition-colors duration-200">
            <div className="flex items-center space-x-3 flex-1">
                              <input
                  type="text"
                  placeholder="Search The Notes etc....."
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  
                  // Clear previous timeout
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                  
                  // Search on every keystroke with debouncing
                  if (query.trim()) {
                    searchTimeoutRef.current = setTimeout(() => {
                      handleSearch(query);
                    }, 300); // 300ms delay
                  } else {
                    setSearchResults([]);
                  }
                }}
                className="flex-1 text-xs font-semibold text-gray-800 dark:text-gray-100 black:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 border-none outline-none focus:border-none focus:outline-none focus:ring-0"
                />
            </div>
            <div className="flex items-center space-x-3">
              {/* Enhanced Filter Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 black:from-blue-600 black:to-blue-700 black:hover:from-blue-700 black:hover:to-blue-800 text-white rounded-full px-3 py-1.5 flex items-center space-x-2 cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Filters</span>
                  {/* Active filters indicator */}
                  {(() => {
                    const activeFilters = [
                      quickFilters.contentType !== 'all' ? 1 : 0,
                      quickFilters.dateRange !== 'all' ? 1 : 0,
                      quickFilters.notebook ? 1 : 0,
                      quickFilters.isPinned ? 1 : 0,
                      quickFilters.isShortcut ? 1 : 0
                    ].reduce((a, b) => a + b, 0);
                    
                    return activeFilters > 0 ? (
                      <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {activeFilters}
                      </span>
                    ) : null;
                  })()}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Enhanced Filter Dropdown Menu */}
                {showFilterDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl shadow-2xl z-50 backdrop-blur-sm">
                    <div className="p-3 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] pb-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white black:text-white flex items-center space-x-2">
                          <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400 black:text-blue-400" />
                          <span>Search Filters</span>
                        </h3>
                        <button
                          onClick={() => setShowFilterDropdown(false)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 black:hover:text-gray-300 transition-colors duration-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Content Type Filter */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300">
                          Content Type
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { value: 'all', label: 'All', icon: '🔍', color: 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a]' },
                            { value: 'notes', label: 'Notes', icon: '📝', color: 'bg-sky-100 dark:bg-gray-700 black:bg-[#2a2a2a]' },
                            { value: 'templates', label: 'Templates', icon: '📚', color: 'bg-violet-100 dark:bg-gray-700 black:bg-[#2a2a2a]' }
                          ].map((type) => (
                            <button
                              key={type.value}
                              onClick={() => {
                                setQuickFilters(prev => ({ ...prev, contentType: type.value }));
                                setShowFilterDropdown(false);
                              }}
                              className={`p-1.5 rounded-lg border-2 transition-all duration-200 ${
                                quickFilters.contentType === type.value
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 black:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-600 black:border-[#3a3a3a] hover:border-blue-300 dark:hover:border-blue-500 black:hover:border-blue-500'
                              } ${type.color}`}
                            >
                              <div className="text-center">
                                <div className="text-base mb-0.5">{type.icon}</div>
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">{type.label}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Date Range Filter */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300">
                          Date Range
                        </label>
                        <select 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] rounded-lg bg-white dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-900 dark:text-white black:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-xs"
                          onChange={(e) => setQuickFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                          value={quickFilters.dateRange}
                        >
                          <option value="all">🕐 All Time</option>
                          <option value="today">📅 Today</option>
                          <option value="week">📆 This Week</option>
                          <option value="month">📅 This Month</option>
                          <option value="year">📅 This Year</option>
                        </select>
                      </div>
                      
                      {/* Notebook Filter */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300">
                          Notebook
                        </label>
                        <select 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 black:border-[#3a3a3a] rounded-lg bg-white dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-900 dark:text-white black:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-xs"
                          onChange={(e) => setQuickFilters(prev => ({ ...prev, notebook: e.target.value }))}
                          value={quickFilters.notebook}
                        >
                          <option value="">📚 All Notebooks</option>
                          {notebooks.slice(0, 5).map((notebook) => (
                            <option key={notebook._id} value={notebook._id}>
                              📖 {notebook.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Status Filters */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300">
                          Status
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { key: 'isPinned', label: '📌 Pinned', color: 'bg-yellow-100 dark:bg-yellow-900/30 black:bg-[#2a2a2a]' },
                            { key: 'isShortcut', label: '⭐ Shortcuts', color: 'bg-orange-100 dark:bg-orange-900/30 black:bg-[#2a2a2a]' }
                          ].map((status) => (
                            <button
                              key={status.key}
                              onClick={() => {
                                setQuickFilters(prev => ({ 
                                  ...prev, 
                                  [status.key]: !prev[status.key as keyof typeof prev] 
                                }));
                              }}
                              className={`p-1.5 rounded-lg border-2 transition-all duration-200 ${
                                quickFilters[status.key as keyof typeof quickFilters]
                                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 black:bg-yellow-900/20'
                                  : 'border-gray-200 dark:border-gray-600 black:border-[#3a3a3a] hover:border-yellow-300 dark:hover:border-yellow-500 black:hover:border-yellow-500'
                              } ${status.color}`}
                            >
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">{status.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] space-y-2">
                        <button
                          onClick={() => {
                            setQuickFilters({
                              contentType: 'all',
                              dateRange: 'all',
                              notebook: '',
                              isPinned: false,
                              isShortcut: false
                            });
                            setShowFilterDropdown(false);
                          }}
                          className="w-full p-2 bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333] text-gray-700 dark:text-gray-300 black:text-gray-300 rounded-lg transition-colors duration-200 font-medium text-xs"
                        >
                          🗑️ Clear All Filters
                        </button>
                        <button
                          onClick={() => {
                            setShowFilterDropdown(false);
                            // Apply filters to current search
                            if (searchQuery.trim()) {
                              handleSearch(searchQuery);
                            }
                          }}
                          className="w-full p-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 font-medium text-xs shadow-lg hover:shadow-xl"
                        >
                          ✅ Apply Filters
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Enhanced Search Button */}
              <button 
                onClick={() => handleSearch(searchQuery)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 black:from-blue-600 black:to-blue-700 black:hover:from-blue-700 black:hover:to-blue-800 text-white rounded-full p-2.5 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                title="Search Notes & Templates"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Search Results - Display below search bar */}
          {searchQuery && searchResults.length > 0 && (
            <div className="mt-4 bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white black:text-white mb-4 flex items-center space-x-2">
                <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 black:text-blue-400" />
                <span>Search Results for "{searchQuery}"</span>
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 black:text-gray-400">
                  ({searchResults.length} found)
                </span>
              </h3>
              <div className="space-y-1.5">
                {searchResults.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      if (item.type === 'note') {
                        // Navigate to notes page with the specific note selected
                        handleNavigate(`/notes?note=${item._id}`);
                      } else if (item.type === 'template') {
                        // Navigate to templates page with the specific template selected
                        handleNavigate(`/templates?template=${item._id}`);
                      }
                    }}
                    className="group relative p-2.5 rounded-md cursor-pointer transition-all duration-300 border bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 hover:backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 shadow-sm text-gray-700 dark:text-gray-300 black:text-gray-300 hover:shadow-md hover:scale-[1.01]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shadow-sm transition-all duration-300 bg-gray-100 dark:bg-gray-700 black:bg-[#333333]">
                        <div className={`${
                          item.type === 'note'
                            ? 'text-sky-600 dark:text-sky-400 black:text-sky-400'
                            : 'text-violet-600 dark:text-violet-400 black:text-violet-400'
                        }`}>
                          {item.type === 'note' ? <FileText className="w-3.5 h-3.5" /> : <LayoutTemplate className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h3 className="font-medium truncate max-w-[180px] text-gray-900 dark:text-white black:text-white" style={{ fontSize: '16px' }}>
                            {item.type === 'note' 
                              ? (item.yjsUpdate ? extractTitleFromYjs(item.yjsUpdate) : item.title) || 'Untitled Note'
                              : (item.title || 'Untitled Template')
                            }
                          </h3>
                          {item.isPinned && (
                            <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 black:text-gray-400 truncate mt-0.5" style={{ fontSize: '13px' }}>
                          {item.type === 'note' 
                            ? (item.yjsUpdate ? getPlainTextPreview(item.yjsUpdate) : item.content) || 'No content' 
                            : item.description || 'No description'
                          }
                        </p>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className={`text-xs ${
                            item.type === 'note' 
                              ? 'text-sky-600 dark:text-sky-400 black:text-sky-400' 
                              : 'text-violet-600 dark:text-violet-400 black:text-violet-400'
                          }`}>
                            {item.type === 'note' ? 'Note' : 'Template'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">•</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                            {item.type === 'note' ? new Date(item.updatedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-7">
                        {item.tags.slice(0, 3).map((tag: any) => (
                          <span
                            key={typeof tag === 'string' ? tag : tag._id}
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              item.type === 'note' 
                                ? 'bg-sky-100 dark:bg-sky-900/30 black:bg-sky-900/30 text-sky-700 dark:text-sky-300 black:text-sky-300' 
                                : 'bg-violet-100 dark:bg-violet-900/30 black:bg-violet-900/30 text-violet-700 dark:text-violet-300 black:text-violet-300'
                            }`}
                          >
                            {typeof tag === 'string' ? tag : (tag.name || '')}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Glassy effect overlay - appears on hover */}
                    <div className="absolute inset-0 rounded-md transition-opacity duration-300 pointer-events-none opacity-0 group-hover:opacity-100">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* No Results Message */}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="mt-4 bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 rounded-lg shadow-lg p-4">
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 black:bg-[#333333] flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-gray-400 dark:text-gray-500 black:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white black:text-white mb-2">
                  No results found for "{searchQuery}"
                </h3>
                <p className="text-gray-500 dark:text-gray-400 black:text-gray-400 text-sm max-w-xs mx-auto">
                  Try different keywords or check your spelling. Make sure your search terms match the content in your notes and templates.
                </p>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {isSearching && (
            <div className="mt-4 bg-white/80 dark:bg-gray-800/80 black:bg-[#242424]/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 black:border-[#3a3a3a]/60 rounded-lg shadow-lg p-4">
              <div className="flex items-center justify-center py-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 animate-spin flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
                <span className="ml-3 text-gray-600 dark:text-gray-400 black:text-gray-400 font-medium">Searching...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {/* Create Notes */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/notes')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-[linear-gradient(138deg,rgba(157,77,255,1)_0%,rgba(190,0,101,1)_100%)] flex items-center justify-center mb-2">
                <img
                  className="w-[35px] h-[35px]"
                  alt="Vector"
                  src={vector}
                />
              </div>

              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Create Notes
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Start writing
                </div>
              </div>
            </div>
          </div>

          {/* Create Spaces */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/spaces')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-[linear-gradient(138deg,rgba(89,255,77,1)_0%,rgba(44,0,190,1)_100%)] flex items-center justify-center mb-2">
                <img
                  className="w-[25px] h-[25px]"
                  alt="Vector"
                  src={vector2}
                />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Create Spaces
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Start writing
                </div>
              </div>
            </div>
          </div>

          {/* Short Cut */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/shortcuts')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center mb-2">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Short Cut
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Quick actions
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/notes')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-[linear-gradient(138deg,rgba(255,81,47,1)_0%,rgba(221,36,118,1)_100%)] flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Notes
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  View all notes
                </div>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center relative group" onClick={() => handleNavigate('/tasks')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-cyan-500 to-green-400 flex items-center justify-center mb-2">
                <CheckSquare className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Tasks
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Track progress
                </div>
              </div>
            </div>
          </div>

          {/* Files */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/files')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-pink-500 to-blue-600 flex items-center justify-center mb-2">
                <Folder className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Files
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Manage files
                </div>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/templates')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-2">
                <LayoutTemplate className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Templates
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Pre-made layouts
                </div>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/calendar')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center mb-2">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Calendar
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Schedule events
                </div>
              </div>
            </div>
              </div>

          {/* Notebook */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={handleNotebookClick}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center mb-2">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Notebook
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Organize notes
                </div>
              </div>
            </div>
          </div>

          {/* Shared with Me */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/shared-with-me')}>
            <div className="relative w-[90px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center mb-2" style={{ minHeight: '45px', height: '45px' }}>
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Shared with Me
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Collaborative work
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/tags')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-r from-[#64F38C] to-[#F79D00]  flex items-center justify-center mb-2">
                <img
                  className="w-[30px] h-[25px]"
                  alt="Vector"
                  src={vector3}
                />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Tags
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Categorize content
                </div>
              </div>
            </div>
          </div>

          {/* Spaces */}
          <div className="h-[120px] bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center" onClick={() => handleNavigate('/spaces')}>
            <div className="relative w-[80px] h-[80px] flex flex-col items-center">
              <div className="w-[45px] h-[45px] rounded-lg bg-gradient-to-r from-[#9D4DFF] to-[#F79D09] flex items-center justify-center mb-2">
                <img
                  className="w-[30px] h-[25px]"
                  alt="Vector"
                  src={vector4}
                />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900 dark:text-gray-100 black:text-gray-100 text-xs tracking-[0] leading-[normal] mb-1">
                  Spaces
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-300 black:text-gray-300 text-[8px] tracking-[0] leading-[normal]">
                  Workspaces
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scratch Pad Section */}
        <div className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setActiveOverviewTab('scratchpad')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'scratchpad' 
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 black:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 black:text-yellow-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <FileText className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'scratchpad' 
                    ? 'text-yellow-600 dark:text-yellow-400 black:text-yellow-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 black:group-hover:text-yellow-400'
                }`} />
                <span className="font-semibold text-sm">Quick Notes</span>
              </button>
              <button 
                onClick={() => setActiveOverviewTab('notes')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'notes' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 black:bg-blue-900/30 text-blue-700 dark:text-blue-300 black:text-blue-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <BarChart3 className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'notes' 
                    ? 'text-blue-600 dark:text-blue-400 black:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 black:group-hover:text-blue-400'
                }`} />
                <span className="font-semibold text-sm">Notes</span>
              </button>
              <button 
                onClick={() => setActiveOverviewTab('files')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'files' 
                    ? 'bg-green-100 dark:bg-green-900/30 black:bg-green-900/30 text-green-700 dark:text-green-300 black:text-green-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <Folder className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'files' 
                    ? 'text-green-600 dark:text-green-400 black:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 black:group-hover:text-green-400'
                }`} />
                <span className="font-semibold text-sm">Files</span>
              </button>
              <button 
                onClick={() => setActiveOverviewTab('calendar')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'calendar' 
                    ? 'bg-purple-100 dark:bg-purple-900/30 black:bg-purple-900/30 text-purple-700 dark:text-purple-300 black:text-purple-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <CalendarDays className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'calendar' 
                    ? 'text-purple-600 dark:text-purple-400 black:text-purple-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 black:group-hover:text-purple-400'
                }`} />
                <span className="font-semibold text-sm">Calendar</span>
              </button>
              <button 
                onClick={() => setActiveOverviewTab('tasks')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'tasks' 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 black:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 black:text-emerald-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <CheckSquare className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'tasks' 
                    ? 'text-emerald-600 dark:text-emerald-400 black:text-emerald-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 black:group-hover:text-emerald-400'
                }`} />
                <span className="font-semibold text-sm">Tasks</span>
              </button>
              <button 
                onClick={() => setActiveOverviewTab('shared')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 group ${
                  activeOverviewTab === 'shared' 
                    ? 'bg-orange-100 dark:bg-orange-900/30 black:bg-orange-900/30 text-orange-700 dark:text-orange-300 black:text-orange-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300'
                }`}
              >
                <Share2 className={`w-4 h-4 transition-colors ${
                  activeOverviewTab === 'shared' 
                    ? 'text-orange-600 dark:text-orange-400 black:text-orange-400' 
                    : 'text-gray-600 dark:text-gray-400 black:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 black:group-hover:text-orange-400'
                }`} />
                <span className="font-semibold text-sm">Shared</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Content Section */}
            <div>
          {activeOverviewTab === 'scratchpad' && (
            <div>
          <div className="flex items-center justify-between mb-4s">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 black:text-gray-200">Quick Capture</h2>
                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                  {lastSaved && (
                    <>
                      <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Scratch Pad */}
              <div className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 black:text-gray-100 flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Scratch Pad</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs ${
                      scratchPadContent.length > 500 
                        ? 'text-red-600 dark:text-red-400 black:text-red-400' 
                        : scratchPadContent.length > 400 
                        ? 'text-orange-600 dark:text-orange-400 black:text-orange-400'
                        : 'text-gray-500 dark:text-gray-400 black:text-gray-400'
                    }`}>
                      {scratchPadContent.length}/600 characters
                    </span>
                    {isSaving && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>Saving...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="relative">
                  <textarea
                    value={scratchPadContent}
                    onChange={(e) => setScratchPadContent(e.target.value)}
                    placeholder="Jot down quick thoughts, ideas, or reminders... This content auto-saves as you type."
                    className="w-full h-48 bg-transparent placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 text-gray-900 dark:text-gray-100 black:text-gray-100 resize-none focus:outline-none text-sm leading-relaxed border-none"
                    maxLength={600}
                    style={{
                      backgroundImage: `repeating-linear-gradient(transparent, transparent 19px, ${scratchLineColor} 20px)`,
                      backgroundSize: '100% 20px',
                      lineHeight: '20px',
                      paddingTop: '2px'
                    }}
                  />
                  
                  {/* Character count progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 black:bg-[#3a3a3a] rounded-b-lg overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        scratchPadContent.length > 500 
                          ? 'bg-red-500' 
                          : scratchPadContent.length > 400 
                          ? 'bg-orange-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min((scratchPadContent.length / 600) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                    Auto-saves as you type • Plain text only
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleClearScratchPad}
                      disabled={!scratchPadContent.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 black:text-gray-200 bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear
              </button>
                    <button
                      onClick={handleConvertToNote}
                      disabled={!scratchPadContent.trim() || isConverting}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      {isConverting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Converting...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>Convert to Note</span>
                        </>
                      )}
              </button>
            </div>
          </div>
              </div>
            </div>
          )}

          {activeOverviewTab === 'notes' && (
            <div>
          {/* Recent Notes Grid */}
          <div className="grid grid-cols-4 gap-4">
            {notes.slice(0, 8).map((note) => (
              <div
                key={note._id}
                onClick={() => handleNavigate(`/notes?note=${note._id}`)}
                className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl shadow-md p-3 hover:shadow-lg transition-shadow cursor-pointer h-64"
              >
                <div className="h-full flex flex-col">
                  <h3 className="font-bold mb-2 line-clamp-2 text-gray-800 dark:text-gray-100 black:text-gray-100" style={{ fontSize: '16px' }}>
                    {note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : 'Untitled'}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 black:text-gray-300 flex-1 line-clamp-6" style={{ fontSize: '13px' }}>
                    {note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) || extractTitleFromYjs(note.yjsUpdate) : 'No content'}
                  </p>
                  <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 black:text-gray-400">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            
            {notes.length === 0 && (
              <div className="col-span-4 text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-xs mb-3">No notes yet</p>
                <button
                  onClick={handleCreateFirstNote}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-xs"
                >
                  Create your first note
                </button>
              </div>
            )}
          </div>
            </div>
          )}

          {activeOverviewTab === 'files' && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 black:text-gray-200">Recent Files</h2>
                <div className="flex space-x-3">
                  <button className="bg-black black:bg-[#181818] text-white px-3 py-1.5 rounded-lg font-bold text-xs">
                    Recent
                  </button>
                  <button className="text-gray-800 dark:text-gray-200 black:text-gray-200 font-bold text-xs">
                    All Files
                  </button>
                </div>
              </div>

              {/* Recent Files Grid */}
              <div className="grid grid-cols-4 gap-4">
                {files.slice(0, 8).map((file) => {
                  const FileIcon = getFileIcon(file.mimetype || '');
                  const fileColor = getFileColor(file.mimetype || '');
                  const hasFilePreview = hasPreview(file.mimetype || '');
                  const imageUrl = imageUrls[file._id];
                  
                  return (
                    <div
                      key={file._id}
                      onClick={() => handleNavigate(`/files`)}
                      className="bg-white dark:bg-gray-800 black:bg-[#1e1e1e] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-xl shadow-md hover:shadow-xl dark:hover:shadow-2xl black:hover:shadow-2xl transition-all duration-200 cursor-pointer h-64 group overflow-hidden hover:border-blue-500/50 dark:hover:border-blue-400/50 black:hover:border-blue-400/50"
                    >
                      <div className="h-full flex flex-col">
                        {/* Thumbnail/Preview Area */}
                        <div className="relative h-40 bg-gray-100 dark:bg-gray-700 black:bg-[#1a1a1a] flex items-center justify-center overflow-hidden rounded-t-xl">
                          {hasFilePreview && imageUrl ? (
                            <div className="relative w-full h-full">
                              <img
                                src={imageUrl}
                                alt={file.originalName || 'File preview'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onLoad={(e) => handlePreviewLoad(file._id, e.currentTarget)}
                                onError={(e) => handlePreviewError(file._id, e.currentTarget)}
                              />
                              
                              
                              {/* Fallback Icon */}
                              <div className={`absolute inset-0 flex items-center justify-center ${hasFilePreview && imageUrl ? 'hidden' : ''}`}>
                                <div className={`w-16 h-16 rounded-lg flex items-center justify-center backdrop-blur-sm ${
                                  file.mimetype?.startsWith('image/') ? 'bg-green-500/20 dark:bg-green-500/30 black:bg-green-500/30' :
                                  file.mimetype?.startsWith('video/') ? 'bg-purple-500/20 dark:bg-purple-500/30 black:bg-purple-500/30' :
                                  file.mimetype?.startsWith('audio/') ? 'bg-pink-500/20 dark:bg-pink-500/30 black:bg-pink-500/30' :
                                  file.mimetype?.includes('pdf') ? 'bg-red-500/20 dark:bg-red-500/30 black:bg-red-500/30' :
                                  file.mimetype?.includes('spreadsheet') ? 'bg-emerald-500/20 dark:bg-emerald-500/30 black:bg-emerald-500/30' :
                                  'bg-blue-500/20 dark:bg-blue-500/30 black:bg-blue-500/30'
                                }`}>
                                  <FileIcon className={`w-8 h-8 ${fileColor}`} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={`w-16 h-16 rounded-lg flex items-center justify-center backdrop-blur-sm ${
                              file.mimetype?.startsWith('image/') ? 'bg-green-500/20 dark:bg-green-500/30 black:bg-green-500/30' :
                              file.mimetype?.startsWith('video/') ? 'bg-purple-500/20 dark:bg-purple-500/30 black:bg-purple-500/30' :
                              file.mimetype?.startsWith('audio/') ? 'bg-pink-500/20 dark:bg-pink-500/30 black:bg-pink-500/30' :
                              file.mimetype?.includes('pdf') ? 'bg-red-500/20 dark:bg-red-500/30 black:bg-red-500/30' :
                              file.mimetype?.includes('spreadsheet') ? 'bg-emerald-500/20 dark:bg-emerald-500/30 black:bg-emerald-500/30' :
                              'bg-blue-500/20 dark:bg-blue-500/30 black:bg-blue-500/30'
                            }`}>
                              <FileIcon className={`w-8 h-8 ${fileColor}`} />
                            </div>
                          )}
                        </div>

                        {/* File Info - Minimal */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-semibold text-sm mb-1 line-clamp-2 text-gray-800 dark:text-gray-100 black:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 black:group-hover:text-blue-400 transition-colors">
                              {file.originalName || 'Untitled File'}
                            </h3>
                            <div className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                              {formatFileSize(file.size || 0)}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {files.length === 0 && (
                  <div className="col-span-4 text-center py-8">
                    <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 text-xs mb-3">No files uploaded yet</p>
                    <button
                      onClick={() => handleNavigate('/files')}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-xs"
                    >
                      Upload your first file
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeOverviewTab === 'calendar' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 black:text-gray-200">Today's Schedule</h2>
                <div className="flex space-x-3">
                  <button className="bg-black black:bg-[#181818] text-white px-3 py-1.5 rounded-lg font-bold text-xs">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </button>
                  <button 
                    onClick={() => handleNavigate('/calendar')}
                    className="text-gray-800 dark:text-gray-200 black:text-gray-200 font-bold text-xs hover:text-purple-600 dark:hover:text-purple-400 black:hover:text-purple-400 transition-colors"
                  >
                    View Full Calendar
                  </button>
                </div>
              </div>

              {/* Today's Timeline */}
              <div className="bg-white dark:bg-gray-800 black:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 black:border-[#404040] rounded-xl overflow-hidden">
                <div className="relative max-h-96 overflow-y-auto timeline-container">
                  {/* Current Time Indicator */}
                  <div 
                    className="absolute left-20 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 z-10 shadow-lg" 
                    style={{ 
                      top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (60/60)}px` 
                    }}
                  ></div>
                  
                  {/* Timeline Hours */}
                  {(() => {
                    const hours = [];
                    for (let i = 0; i < 24; i++) {
                      hours.push(i);
                    }
                    return hours;
                  })().map(hour => {
                    const hourEvents = getUpcomingEvents().filter(event => {
                      const eventDate = new Date(event.startTime || event.start?.dateTime || event.start?.date);
                      const eventHour = eventDate.getHours();
                      const isToday = eventDate.toDateString() === new Date().toDateString();
                      return eventHour === hour && isToday;
                    });
                    
                    const timeLabel = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                    
                    return (
                      <div key={hour} className="flex border-b border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] min-h-[60px] hover:bg-white/50 dark:hover:bg-gray-800/50 black:hover:bg-[#2a2a2a]/50 transition-colors duration-200">
                        <div className="w-20 p-3 text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 border-r border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] flex-shrink-0 bg-white/50 dark:bg-gray-900/50 black:bg-[#242424]">
                          {timeLabel}
                        </div>
                        <div className="flex-1 relative p-3">
                          {hourEvents.map((event, index) => (
                            <div 
                              key={event._id || event.id} 
                              className="absolute left-3 right-3 p-3 rounded-lg text-xs cursor-pointer hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 bg-gradient-to-r from-purple-500 to-blue-500 text-white" 
                              style={{ 
                                top: `${index * 30}px`, 
                                zIndex: index + 1 
                              }} 
                              onClick={() => handleNavigate('/calendar')}
                            >
                              <div className="flex items-center space-x-2 mb-1">
                                <CalendarDays className="w-3.5 h-3.5 text-white/90" />
                                <span className="font-semibold text-white">
                                  {new Date(event.startTime || event.start?.dateTime || event.start?.date).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                              <div className="font-medium text-white truncate">
                                {event.title || event.summary || 'Untitled Event'}
                              </div>
                              {event.location && (
                                <div className="text-white/80 text-xs truncate mt-1">
                                  📍 {event.location}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Timeline Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-gray-50 dark:bg-gray-900 black:bg-[#0f0f0f]">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 black:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded"></div>
                        <span>Events</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 border-2 border-purple-500 dark:border-purple-400 black:border-purple-400 rounded"></div>
                        <span>Current Time</span>
                      </div>
                    </div>
                    <div className="text-gray-500 dark:text-gray-500 black:text-gray-500">
                      {getUpcomingEvents().filter(event => {
                        const eventDate = new Date(event.startTime || event.start?.dateTime || event.start?.date);
                        return eventDate.toDateString() === new Date().toDateString();
                      }).length} events today
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeOverviewTab === 'shared' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 black:text-gray-200">Shared with Me</h2>
                <div className="flex space-x-3">
                  <button className="bg-black black:bg-[#181818] text-white px-3 py-1.5 rounded-lg font-bold text-xs">
                    Recent
                  </button>
                  <button onClick={() => handleNavigate('/shared-with-me')} className="text-gray-800 dark:text-gray-200 black:text-gray-200 font-bold text-xs hover:text-orange-600 dark:hover:text-orange-400 black:hover:text-orange-400">
                    View All
                  </button>
                </div>
              </div>

              {/* Shared Items Grid - same card style as Notes */}
              <div className="grid grid-cols-4 gap-4">
                {loadingShared ? (
                  [...Array(4)].map((_, idx) => (
                    <div key={idx} className="h-64 bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl p-3 animate-pulse">
                      <div className="h-5 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  ))
                ) : sharedItems.length > 0 ? (
                  sharedItems.slice(0, 8).map((item) => (
                    <div
                      key={item._id}
                      onClick={() => handleNavigate(item.type === 'note' ? `/note/${item._id}` : '/templates')}
                      className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl shadow-md p-3 hover:shadow-lg transition-shadow cursor-pointer h-64"
                    >
                      <div className="h-full flex flex-col">
                        <h3 className="font-bold mb-2 line-clamp-2 text-gray-800 dark:text-gray-100 black:text-gray-100" style={{ fontSize: '16px' }}>
                          {item.title || 'Untitled'}
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 black:text-gray-300 flex-1 line-clamp-6" style={{ fontSize: '13px' }}>
                          {item.plainTextContent || item.content || 'No content'}
                        </p>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 black:text-gray-400 mt-2">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-center py-8">
                    <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 text-xs mb-3">Nothing shared yet</p>
                    <button
                      onClick={() => handleNavigate('/shared-with-me')}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition-colors text-xs"
                    >
                      View All Shared
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeOverviewTab === 'tasks' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 black:text-gray-200">Notes with Tasks</h2>
                <div className="flex space-x-3">
                  <button className="bg-black black:bg-[#181818] text-white px-3 py-1.5 rounded-lg font-bold text-xs">
                    Recent
                  </button>
                  <button 
                    onClick={() => handleNavigate('/tasks')}
                    className="text-gray-800 dark:text-gray-200 black:text-gray-200 font-bold text-xs hover:text-emerald-600 dark:hover:text-emerald-400 black:hover:text-emerald-400 transition-colors"
                  >
                    View All Tasks
                  </button>
                </div>
              </div>

              {/* Notes with Tasks Grid - same design as notes */}
              <div className="grid grid-cols-4 gap-4">
                {(() => {
                  // Use the exact same filtering logic as Tasks page
                  const notesWithTasks = (notes || []).filter(note => {
                    const title = note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) || 'Untitled' : 'Untitled';
                    const hasTasks = note.yjsUpdate ? hasTasksInYjs(note.yjsUpdate as any) : false;
                    
                    // Enhanced detection: also check for common task patterns in plain text
                    let hasTaskPatterns = hasTasks;
                    if (!hasTaskPatterns && note.yjsUpdate) {
                      try {
                        const plainText = extractPlainTextFromYjs(note.yjsUpdate);
                        // Look for task-like patterns in plain text
                        hasTaskPatterns = /(\[\s*\]|\[x\]|\[✓\])/i.test(plainText) || 
                                         plainText.toLowerCase().includes('task') ||
                                         plainText.toLowerCase().includes('todo');
                      } catch (error) {
                        // Fallback: if title suggests tasks, include it
                        hasTaskPatterns = title.toLowerCase().includes('task') || 
                                         title.toLowerCase().includes('test') ||
                                         title.toLowerCase().includes('todo');
                      }
                    }
                    
                    return hasTaskPatterns;
                  });
                  
                  return notesWithTasks.length > 0 ? (
                    notesWithTasks.slice(0, 8).map((note) => (
                      <div
                        key={note._id}
                        onClick={() => handleNavigate(`/tasks?note=${note._id}`)}
                        className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl shadow-md p-3 hover:shadow-lg transition-shadow cursor-pointer h-64 relative group"
                      >
                        {/* Task indicator */}
                        <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                          <CheckSquare className="w-3 h-3" />
                        </div>
                        <div className="h-full flex flex-col">
                          <h3 className="font-bold mb-2 line-clamp-2 text-gray-800 dark:text-gray-100 black:text-gray-100 pr-8" style={{ fontSize: '16px' }}>
                            {note.yjsUpdate ? extractTitleFromYjs(note.yjsUpdate) : 'Untitled'}
                          </h3>
                          <p className="text-gray-700 dark:text-gray-300 black:text-gray-300 flex-1 line-clamp-6" style={{ fontSize: '13px' }}>
                            {note.yjsUpdate ? getPlainTextPreview(note.yjsUpdate) || extractTitleFromYjs(note.yjsUpdate) : 'No content'}
                          </p>
                          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 black:text-gray-400">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 text-center py-8">
                      <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 text-xs mb-3">No notes with tasks yet</p>
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={() => handleNavigate('/notes')}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors text-xs"
                        >
                          Create Note
                        </button>
                        <button
                          onClick={() => handleNavigate('/tasks')}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-xs"
                        >
                          View Tasks Page
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 