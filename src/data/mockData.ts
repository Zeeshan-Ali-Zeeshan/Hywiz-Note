import { Note, Shortcut, RecentItem, NavigationItem } from '../types';

export const notes: Note[] = [
  {
    id: '1',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '9/11/20',
    thumbnail: 'https://images.pexels.com/photos/1029604/pexels-photo-1029604.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['outdoor', 'design'],
    isPinned: false,
    category: 'lifestyle'
  },
  {
    id: '2',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/21/20',
    thumbnail: 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['business', 'strategy'],
    isPinned: true,
    category: 'business'
  },
  {
    id: '3',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/21/20',
    thumbnail: 'https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['real-estate'],
    isPinned: false,
    category: 'business'
  },
  {
    id: '4',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal'
  },
  {
    id: '5',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal'
  },
  {
    id: '6',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal'
  },
  {
    id: '7',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal'
  },
  {
    id: '8',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal'
  }
];

// Mock data for store Note interface - these should match the store's Note type exactly
export const storeNotes = [
  {
    _id: '1',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['outdoor', 'design'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '2',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['business', 'strategy'],
    attachments: [],
    isPinned: true,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '3',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['real-estate'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '4',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['travel', 'vacation'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '5',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['travel', 'vacation'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '6',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['travel', 'vacation'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '7',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['travel', 'vacation'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  },
  {
    _id: '8',
    userId: 'user1',
    workspaceId: 'workspace1',
    notebookIds: ['1'],
    primaryNotebookId: '1',
    tags: ['travel', 'vacation'],
    attachments: [],
    isPinned: false,
    isShortcut: false,
    isDeleted: false,
    lastViewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Title Of Note',
    content: 'Data written in The Note............',
    preview: 'Data written in The Note............'
  }
];

// Mock data for workspace notes - matches WorkspaceWithContent interface
export const workspaceNotes = [
  {
    _id: '1',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '9/11/20',
    thumbnail: 'https://images.pexels.com/photos/1029604/pexels-photo-1029604.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['outdoor', 'design'],
    isPinned: false,
    category: 'lifestyle',
    notebookIds: ['1']
  },
  {
    _id: '2',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/21/20',
    thumbnail: 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['business', 'strategy'],
    isPinned: true,
    category: 'business',
    notebookIds: ['1']
  },
  {
    _id: '3',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/21/20',
    thumbnail: 'https://images.pexels.com/photos/186077/pexels-photo-186077.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['real-estate'],
    isPinned: false,
    category: 'business',
    notebookIds: ['2']
  },
  {
    _id: '4',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal',
    notebookIds: ['2']
  },
  {
    _id: '5',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal',
    notebookIds: ['1']
  },
  {
    _id: '6',
    title: 'Title Of Note',
    preview: 'Data written in The Note............',
    date: '7/29/20',
    thumbnail: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=200',
    tags: ['travel', 'vacation'],
    isPinned: false,
    category: 'personal',
    notebookIds: ['2']
  }
];

export const notebooks = [
  { _id: '1', name: 'Name Note Book', color: '#3B82F6' },
  { _id: '2', name: 'Name Note Book', color: '#10B981' },
  { _id: '3', name: 'Name Note Book', color: '#F59E0B' },
  { _id: '4', name: 'Name Note Book', color: '#EF4444' },
  { _id: '5', name: 'Name Note Book', color: '#8B5CF6' },
  { _id: '6', name: 'Name Note Book', color: '#06B6D4' }
];

export const shortcuts: Shortcut[] = [
  { id: '1', name: 'Business', icon: 'briefcase' },
  { id: '2', name: 'Clients', icon: 'users' },
  { id: '3', name: 'Contacts', icon: 'user-check' },
  { id: '4', name: 'Promo', icon: 'search' },
  { id: '5', name: 'Meeting Notes', icon: 'file-text' },
  { id: '6', name: 'Business Stra...', icon: 'trending-up' },
  { id: '7', name: 'To-do List', icon: 'check-square' },
  { id: '8', name: 'Personal Proj...', icon: 'user' },
  { id: '9', name: 'Maui', icon: 'search' },
  { id: '10', name: 'Leads', icon: 'trending-up' }
];

export const recentItems: RecentItem[] = [
  {
    id: '1',
    title: 'Contract Document',
    type: 'document',
    thumbnail: 'https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg?auto=compress&cs=tinysrgb&w=200',
    timestamp: '9/21/20'
  },
  {
    id: '2',
    title: 'Emerald Furniture',
    type: 'image',
    thumbnail: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=200',
    timestamp: '1 minute ago'
  }
];

export const navigationItems: NavigationItem[] = [
  { id: 'home', name: 'Home', icon: 'home' },
  { id: 'shortcuts', name: 'Shortcuts', icon: 'zap', badge: 3 },
  { id: 'notes', name: 'All Notes', icon: 'file-text' },
  { id: 'notebooks', name: 'Notebooks', icon: 'book' },
  { id: 'shared', name: 'Shared with Me', icon: 'users' },


  { id: 'trash', name: 'Trash', icon: 'trash-2' }
];