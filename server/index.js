import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Note from './models/Note.js';
import Template from './models/Template.js';
import User from './models/User.js';
import TaskSeries from './models/TaskSeries.js';  // Import TaskSeries to register the schema
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import { JSDOM } from 'jsdom';
import { Schema } from 'prosemirror-model';
import 'dotenv/config';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { orderedList, bulletList, listItem } from 'prosemirror-schema-list';
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import { htmlToProseMirrorJSON } from './utils/htmlToProseMirrorJSON.js';
import { templateHtmlToProseMirrorJSON } from './utils/templateHtmlToProseMirrorJSON.js';

// Extended ProseMirror schema for rich features


let nodes = basicSchema.spec.nodes
  .addToEnd('ordered_list', orderedList)
  .addToEnd('bullet_list', bulletList)
  .addToEnd('list_item', listItem)
  .addToEnd('heading', {
    attrs: { level: { default: 1 }, textAlign: { default: null } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } },
    ],
    toDOM(node) {
      const { level, textAlign } = node.attrs;
      const style = textAlign ? `text-align: ${textAlign};` : '';
      return [
        'h' + level,
        { style },
        0
      ];
    }
  })
  .addToEnd('image', {
    inline: true,
    attrs: { src: {}, alt: { default: null }, title: { default: null } },
    group: 'inline',
    draggable: true,
    parseDOM: [{ tag: 'img[src]', getAttrs: dom => ({ src: dom.getAttribute('src'), title: dom.getAttribute('title'), alt: dom.getAttribute('alt') }) }],
    toDOM(node) { return ['img', node.attrs]; }
  })
  .addToEnd('horizontal_rule', {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() { return ['hr']; }
  })
  .addToEnd('task_item', {
    content: 'paragraph block*',
    attrs: { checked: { default: false } },
    toDOM(node) { return ['li', { 'data-checked': node.attrs.checked ? 'true' : 'false' }, 0]; },
    parseDOM: [{ tag: 'li', getAttrs: dom => ({ checked: dom.getAttribute('data-checked') === 'true' }) }],
    defining: true
  })
  .addToEnd('task_list', {
    group: 'block',
    content: 'task_item+',
    toDOM() { return ['ul', { 'data-type': 'taskList' }, 0]; },
    parseDOM: [{ tag: 'ul[data-type="taskList"]' }]
  });

const marks = basicSchema.spec.marks.append({
  bold: { ...basicSchema.spec.marks.get('strong'), parseDOM: [{ tag: 'strong' }, { style: 'font-weight=bold' }] },
  italic: { ...basicSchema.spec.marks.get('em'), parseDOM: [{ tag: 'em' }, { style: 'font-style=italic' }] },
  underline: {
    parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
    toDOM() { return ['u', 0]; }
  },
  strikethrough: {
    parseDOM: [{ tag: 's' }, { style: 'text-decoration=line-through' }],
    toDOM() { return ['s', 0]; }
  },
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [{ tag: 'a[href]', getAttrs: dom => ({ href: dom.getAttribute('href'), title: dom.getAttribute('title') }) }],
    toDOM(node) { return ['a', node.attrs, 0]; }
  },
  color: {
    attrs: { color: {} },
    parseDOM: [{ style: 'color', getAttrs: value => ({ color: value }) }],
    toDOM(node) { return ['span', { style: `color: ${node.attrs.color}` }, 0]; }
  },
  highlight: {
    attrs: { backgroundColor: {} },
    parseDOM: [{ style: 'background-color', getAttrs: value => ({ backgroundColor: value }) }],
    toDOM(node) { return ['span', { style: `background-color: ${node.attrs.backgroundColor}` }, 0]; }
  },
  fontsize: {
    attrs: { size: {} },
    parseDOM: [{ style: 'font-size', getAttrs: value => ({ size: value }) }],
    toDOM(node) { return ['span', { style: `font-size: ${node.attrs.size}` }, 0]; }
  },
  alignment: {
    attrs: { align: {} },
    parseDOM: [{ style: 'text-align', getAttrs: value => ({ align: value }) }],
    toDOM(node) { return ['span', { style: `text-align: ${node.attrs.align}` }, 0]; }
  }
});

const schema = new Schema({ nodes, marks });

// Import routes
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import notebooksRoutes from './routes/notebooks.js';
import workspacesRoutes from './routes/workspaces.js';
import tagsRoutes from './routes/tags.js';
import sharingRoutes from './routes/sharing.js';

import calendarRoutes from './routes/calendar.js';
import searchRoutes from './routes/search.js';
import uploadRoutes from './routes/upload.js';
import usersRoutes from './routes/users.js';
import templatesRoutes from './routes/templates.js';
import filesRoutes from './routes/files.js';
import tasksRoutes from './routes/tasks.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

console.log('=== SERVER STARTED ===');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
}));

// Serve uploaded files with proper headers and video streaming support
app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length');
  res.header('Accept-Ranges', 'bytes');

  // Set proper Content-Type based on file extension
  const filePath = req.path.toLowerCase();
  if (filePath.endsWith('.mp4')) {
    res.header('Content-Type', 'video/mp4');
  } else if (filePath.endsWith('.webm')) {
    res.header('Content-Type', 'video/webm');
  } else if (filePath.endsWith('.avi')) {
    res.header('Content-Type', 'video/avi');
  } else if (filePath.endsWith('.mov')) {
    res.header('Content-Type', 'video/quicktime');
  } else if (filePath.endsWith('.mkv')) {
    res.header('Content-Type', 'video/x-matroska');
  }

  next();
}, express.static(path.join(process.cwd(), 'server/uploads'), {
  // Enable proper video streaming
  acceptRanges: true,
  cacheControl: false,
  etag: false,
  lastModified: false
}));

// MongoDB connection
// Robust MongoDB connection with retry
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  mongoose.connect('mongodb+srv://zeeshantidi259:hyperking@cluster0.s17pj.mongodb.net/evernote-clone?retryWrites=true&w=majority', {
    serverSelectionTimeoutMS: 5000 // Fail fast if no server found
  })
    .then(() => {
      console.log('MongoDB connected successfully');

      const PORT = process.env.PORT || 3001;
      server.listen(PORT, () => {
        console.log(`HTTP server running at http://localhost:${PORT}`);
        console.log('Yjs WebSocket server running (integrated with Express backend)');
      });
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-note', (noteId) => {
    socket.join(`note-${noteId}`);
  });

  socket.on('note-update', (data) => {
    socket.to(`note-${data.noteId}`).emit('note-updated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Email transporter (use Ethereal for dev, or configure real SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASS,
  },
});



// --- Yjs WebSocket Integration ---
// In-memory Yjs docs (for demo; use persistence for production)
const docs = new Map();

async function getNoteContent(noteId) {
  // Use your Mongoose Note model
  const note = await Note.findById(noteId);
  return note ? note.content : '';
}

// Attach Yjs WebSocket server to the same HTTP server
const yjsWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // Handle Yjs websocket upgrades for both notes and templates
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith('/note-') || url.pathname.startsWith('/template-')) {
    yjsWss.handleUpgrade(request, socket, head, (ws) => {
      yjsWss.emit('connection', ws, request);
    });
  }
});

let yjsFirstConnection = false;
yjsWss.on('connection', async (conn, req) => {
  if (!yjsFirstConnection) {
    yjsFirstConnection = true;
    console.log('[YJS] First WebSocket connection established. Yjs WebSocket server is running and accepting connections.');
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.pathname.slice(1); // remove leading '/'
  let doc = docs.get(roomName);

  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
  }

  // --- BEST PRACTICE ENFORCEMENT ---
  // Only seed the Yjs doc from the DB if the doc is empty.
  // Never reseed/overwrite a non-empty Yjs doc, to prevent duplication or data loss.

  // Handle note seeding
  const noteMatch = roomName.match(/^note-(.+)$/);
  if (noteMatch) {
    const noteId = noteMatch[1];
    // Fetch note data
    const note = await Note.findById(noteId);
    const title = note ? note.title : '';

    // Check if we need to seed the document
    const yXml = doc.getXmlFragment('prosemirror');
    const yTitle = doc.getText('title');

    // Only seed if both fragments are empty (first time opening this note)
    if (yXml.length === 0 && yTitle.length === 0) {
      console.log('[YJS DEBUG] First time opening note', noteId, '- seeding from DB');

      // Seed content with empty paragraph (content is now stored in YJS)
      const emptyParagraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: ''
          }
        ]
      };
      yXml.insert(0, [emptyParagraph]);
      console.log('[YJS DEBUG] Seeded note with empty paragraph (content now in YJS)');

      // Seed title if Y.Text is empty
      if (title) {
        yTitle.insert(0, title);
        console.log('[YJS DEBUG] Seeded Yjs title for note', noteId, 'with title from DB:', title);
      }
    } else {
      // Document already has data - this is normal for shared notes
      console.log('[YJS DEBUG] Note', noteId, 'already has collaborative data - skipping seed');
    }
  }

  // Handle template seeding
  const templateMatch = roomName.match(/^template-(.+)$/);
  if (templateMatch) {
    const templateId = templateMatch[1];
    try {
      // Fetch template data
      const template = await Template.findById(templateId);
      const title = template ? template.title : '';

      console.log('[YJS DEBUG] Template title:', title);

      // Check if we need to seed the document
      const yXml = doc.getXmlFragment('prosemirror');
      const yTitle = doc.getXmlFragment('title');

      // Only seed if both fragments are empty (first time opening this template)
      if (yXml.length === 0 && yTitle.length === 0) {
        console.log('[YJS DEBUG] First time opening template', templateId, '- seeding from DB');

        // Seed content with empty paragraph (content is now stored in YJS)
        const emptyParagraph = {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: ''
            }
          ]
        };
        yXml.insert(0, [emptyParagraph]);
        console.log('[YJS DEBUG] Seeded template with empty paragraph (content now in YJS)');

        // Seed title if Y.XmlFragment is empty
        if (title && title.trim()) {
          yTitle.insert(0, title.trim());
          console.log('[YJS DEBUG] Seeded Yjs title for template', templateId, 'with title from DB:', title);
        } else {
          // Insert default title if none exists
          yTitle.insert(0, 'Untitled Template');
          console.log('[YJS DEBUG] Seeded Yjs title for template', templateId, 'with default title');
        }
      } else {
        // Document already has data - this is normal for shared templates
        console.log('[YJS DEBUG] Template', templateId, 'already has collaborative data - skipping seed');
      }
    } catch (error) {
      console.error('[YJS ERROR] Failed to seed template', templateId, ':', error);
      // Continue without seeding to prevent server crash
    }
  }

  setupWSConnection(conn, req, { doc });
});

console.log('Yjs WebSocket server running (integrated with Express backend)');

// Top-level request logger for all incoming requests
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming request: ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/notebooks', notebooksRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/sharing', sharingRoutes);

app.use('/api/calendar', calendarRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/tasks', tasksRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Server startup logic moved to mongoose connection block
