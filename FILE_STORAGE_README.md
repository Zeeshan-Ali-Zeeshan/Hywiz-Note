# File Storage System

## Overview

A comprehensive file storage and management system integrated into the note-taking application. This feature allows users to upload, organize, preview, and manage various types of files with a modern, intuitive interface that follows the app's design patterns.

## Features

### 🚀 Core Functionality
- **File Upload**: Drag-and-drop or click-to-select file upload with progress tracking
- **File Management**: View, download, rename, delete, and organize files
- **File Preview**: Built-in preview for images with fallback icons for other file types
- **Search & Filter**: Advanced search and filtering by file type, name, and metadata
- **File Statistics**: Overview of total files, storage usage, and file type distribution

### 📱 User Interface
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Grid & List Views**: Toggle between grid and list view modes
- **Dark Mode Support**: Full dark mode and black theme compatibility
- **Modern UI**: Consistent with the app's design language using Tailwind CSS

### 🔧 Advanced Features
- **File Sharing**: Share files with other users with permission controls
- **Pin Files**: Mark important files for quick access
- **Shortcuts**: Add files to shortcuts for easy navigation
- **File Organization**: Organize files by workspace and notebook
- **Tag Support**: Tag files for better categorization
- **Download Tracking**: Track download counts and last access times

## Technical Implementation

### Backend Architecture

#### Models
- **File Model** (`server/models/File.js`):
  - Complete file metadata storage
  - User ownership and sharing permissions
  - Integration with tags, workspaces, and notebooks
  - File statistics and access tracking

#### API Endpoints
- **File Routes** (`server/routes/files.js`):
  - `GET /api/files` - List user files with pagination and filtering
  - `POST /api/files/upload` - Upload new files with metadata
  - `GET /api/files/:id` - Get specific file details
  - `PUT /api/files/:id` - Update file metadata
  - `DELETE /api/files/:id` - Delete file and cleanup
  - `GET /api/files/:id/download` - Download file with tracking
  - `POST /api/files/:id/share` - Share file with users
  - `GET /api/files/stats/overview` - Get file statistics

### Frontend Architecture

#### Store Management
- **Files Store** (`src/stores/useFilesStore.ts`):
  - Zustand-based state management
  - Complete CRUD operations
  - File upload with progress tracking
  - Search and filtering capabilities
  - Statistics and analytics

#### Components
- **Files Page** (`src/pages/Files.tsx`):
  - Main file management interface
  - Upload modal with drag-and-drop
  - File grid and list views
  - Advanced search and filtering
  - File details modal
  - Statistics dashboard

#### Navigation Integration
- **Sidebar**: Added to navigation menu with Folder icon
- **Dashboard**: Quick access tile already implemented
- **Routing**: Integrated into App.tsx routing system

## File Types Supported

### Images
- JPEG, PNG, GIF, WebP, SVG
- Inline preview in grid view
- Full-size preview in details modal

### Documents
- PDF, DOC, DOCX, TXT, RTF, ODT
- File icon with type indication
- Download functionality

### Media
- Video: MP4, AVI, MOV, WebM
- Audio: MP3, WAV, OGG, AAC
- Archive: ZIP, RAR, 7Z, TAR

### Other
- All other file types supported
- Generic file icon with MIME type display
- Full download and sharing capabilities

## Usage Guide

### Uploading Files
1. Navigate to Files page via sidebar or dashboard
2. Click "Upload Files" button or drag files to the page
3. Select files from your device
4. Files upload with progress indication
5. Uploaded files appear immediately in the grid

### Managing Files
1. **View Files**: Toggle between grid and list views
2. **Search**: Use the search bar to find files by name or description
3. **Filter**: Filter by file type using the filter buttons
4. **Sort**: Sort by date, name, or size (ascending/descending)

### File Actions
- **Preview**: Click on a file to view details and preview
- **Download**: Click download button or use details modal
- **Pin**: Mark files as important for quick access
- **Share**: Share files with other users (if implemented)
- **Delete**: Remove files with confirmation prompt

### Organization
- **Tags**: Add tags to categorize files
- **Workspaces**: Organize files by workspace
- **Notebooks**: Associate files with specific notebooks
- **Shortcuts**: Add frequently used files to shortcuts

## Security Features

### Access Control
- User-based file ownership
- Sharing permissions (read/write/admin)
- Public/private file settings
- Secure file serving

### File Validation
- File size limits (50MB default)
- MIME type validation
- Secure upload directory
- Filename sanitization

## Performance Optimizations

### Frontend
- Lazy loading for large file lists
- Pagination for better performance
- Optimized image previews
- Efficient state management

### Backend
- Indexed database queries
- Efficient file serving
- Upload progress tracking
- Proper error handling

## Configuration

### Environment Variables
```env
# File upload settings
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR=server/uploads
```

### Database Indexes
```javascript
// Optimized indexes for better search performance
fileSchema.index({ name: 'text', description: 'text' });
fileSchema.index({ uploadedBy: 1, createdAt: -1 });
fileSchema.index({ mimetype: 1 });
fileSchema.index({ tags: 1 });
```

## Future Enhancements

### Planned Features
- [ ] File versioning system
- [ ] Advanced image editing
- [ ] Video/audio playback
- [ ] File compression
- [ ] Bulk operations
- [ ] Advanced sharing features
- [ ] File templates
- [ ] Integration with cloud storage
- [ ] OCR for document indexing
- [ ] File collaboration features

### Technical Improvements
- [ ] CDN integration
- [ ] File deduplication
- [ ] Advanced caching
- [ ] Background processing
- [ ] Virus scanning
- [ ] Thumbnail generation
- [ ] Progressive web app features

## Troubleshooting

### Common Issues
1. **Upload Fails**: Check file size limits and permissions
2. **Files Not Loading**: Verify API endpoints and authentication
3. **Preview Not Working**: Ensure correct MIME types and file paths
4. **Search Not Working**: Check database indexes and search implementation

### Error Handling
- Comprehensive error messages
- Graceful fallbacks for failed operations
- User-friendly error notifications
- Detailed logging for debugging

## API Documentation

### File Upload
```javascript
POST /api/files/upload
Content-Type: multipart/form-data

FormData:
- file: File object
- description: string (optional)
- tags: JSON array (optional)
- workspace: ObjectId (optional)
- notebook: ObjectId (optional)
```

### File Search
```javascript
GET /api/files?search=query&mimetype=image&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

### File Statistics
```javascript
GET /api/files/stats/overview

Response:
{
  totalFiles: number,
  totalSize: number,
  recentFiles: File[],
  filesByType: Array<{_id: string, count: number, size: number}>
}
```

This file storage system provides a complete, production-ready solution for managing files within the note-taking application, with excellent user experience and robust technical implementation.
