import React, { useEffect, useState, useRef } from 'react';
import { useFilesStore, FileItem } from '../stores/useFilesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useToastStore } from '../stores/useToastStore';
import { useUIStore } from '../stores/useUIStore';
import { 
  Search, 
  Download, 
  Eye,
  File,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  Grid,
  List,
  X,
  MoreHorizontal,
  Play,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

const Files: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { showToast } = useToastStore();
  const { theme } = useUIStore();
  const filesStore = useFilesStore();
  const { fetchFiles, files, loading } = filesStore;

  // State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const filterOptions = [
    { value: 'all', label: 'All Files', icon: File },
    { value: 'image', label: 'Images', icon: Image },
    { value: 'video', label: 'Videos', icon: Video },
    { value: 'audio', label: 'Audio', icon: Music },
    { value: 'document', label: 'Documents', icon: FileText },
    { value: 'archive', label: 'Archives', icon: Archive }
  ];

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdownId]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSearch = () => {
    fetchFiles({
      search: searchQuery.trim() || undefined,
      mimetype: selectedFilter === 'all' ? undefined : selectedFilter
    });
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    handleSearch();
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return Image;
    if (mimetype.startsWith('video/')) return Video;
    if (mimetype.startsWith('audio/')) return Music;
    if (mimetype.includes('pdf') || mimetype.includes('doc') || mimetype.includes('txt')) return FileText;
    if (mimetype.includes('zip') || mimetype.includes('rar')) return Archive;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileAction = async (action: string, file: FileItem) => {
    try {
      switch (action) {
        case 'download': {
          await filesStore.downloadFile(file._id);
          showToast('Download started', 'success');
          break;
        }
        case 'preview':
          setPreviewFile(file);
          setShowPreviewModal(true);
          break;
        case 'copy-link':
          navigator.clipboard.writeText(`http://localhost:3001${file.url}`);
          showToast('File link copied to clipboard', 'success');
          break;
      }
    } catch (error) {
      console.error('File action error:', error);
      showToast('Failed to perform action', 'error');
    }
  };

  const canPreview = (file: { mimetype: string }) => {
    return file.mimetype.startsWith('image/') || 
           file.mimetype.startsWith('video/') || 
           file.mimetype.startsWith('audio/') ||
           file.mimetype === 'application/pdf';
  };

  const toggleDropdown = (fileId: string) => {
    setOpenDropdownId(openDropdownId === fileId ? null : fileId);
  };

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900 black:bg-[#242424] transition-colors duration-200">
      <div className="p-6 max-w-[1920px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Files
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 black:text-gray-400 mt-1">
              Attachments from your notes
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className={`p-2 rounded-lg border transition-colors
                bg-white dark:bg-gray-800 black:bg-[#242424]
                border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]
                hover:bg-gray-50 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a]
                ${
                  theme === 'black'
                    ? 'text-gray-200'
                    : theme === 'dark'
                      ? 'text-gray-100'
                      : 'text-gray-700'
                }
              `}
            >
              {viewMode === 'grid' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-xl p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-lg bg-white dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-900 dark:text-white black:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {filterOptions.map((filter) => {
                const IconComponent = filter.icon;
                return (
                  <button
                    key={filter.value}
                    onClick={() => handleFilterChange(filter.value)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedFilter === filter.value
                        ? 'bg-blue-100 dark:bg-blue-900/30 black:bg-blue-900/30 text-blue-600 dark:text-blue-400 black:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 black:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333]'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Files Grid/List */}
        <div className={`bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] transition-colors`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400 black:text-gray-400">Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white black:text-white mb-2">No files yet</h3>
              <p className="text-gray-600 dark:text-gray-400 black:text-gray-400 mb-4">
                Upload images and files directly in your notes to see them here
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-5 gap-6' : 'space-y-3'}>
              {files.map((file) => {
                const FileIcon = getFileIcon(file.mimetype);
                return viewMode === 'grid' ? (
                  <div
                    key={file._id}
                    className="group relative bg-white dark:bg-gray-800 black:bg-[#2a2a2a] rounded-xl p-4 hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700 black:border-[#3a3a3a] hover:border-blue-300 dark:hover:border-blue-600 black:hover:border-blue-600"
                  >
                    {/* File Preview/Icon */}
                    <div className="w-full h-32 mb-4 flex items-center justify-center bg-gray-50 dark:bg-gray-700 black:bg-[#333333] rounded-lg overflow-hidden relative">
                      {file.mimetype.startsWith('image/') ? (
                        <img
                          src={`http://localhost:3001${file.url}`}
                          alt={file.name}
                          className="max-w-full max-h-full object-cover rounded-lg hover:scale-105 transition-transform duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileAction('preview', file);
                          }}
                        />
                       ) : file.mimetype.startsWith('video/') ? (
                         <div 
                           className="relative w-full h-full bg-black rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors overflow-hidden"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleFileAction('preview', file);
                           }}
                         >
                          <video className="w-full h-full object-cover rounded-lg transition-transform duration-200" muted preload="metadata" playsInline>
                            <source src={`http://localhost:3001${file.url}`} type={file.mimetype} />
                           </video>
                           <div className="absolute inset-0 bg-black/40 hover:bg-black/30 dark:bg-black/50 dark:hover:bg-black/40 black:bg-black/60 black:hover:bg-black/50 flex items-center justify-center rounded-lg transition-all">
                             <div className="backdrop-blur-sm rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 bg-white/90 hover:bg-white border border-white/50">
                               <Play className="w-4 h-4 text-gray-900" />
                             </div>
                           </div>
                         </div>
                      ) : file.mimetype.startsWith('audio/') ? (
                        <div className="relative w-full h-full bg-purple-50 dark:bg-purple-900/30 black:bg-purple-900/30 rounded-lg flex items-center justify-center">
                          <Music className="w-12 h-12 text-purple-600 dark:text-purple-400 black:text-purple-400" />
                          <div className="absolute bottom-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">AUDIO</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <FileIcon className="w-12 h-12 mb-2" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400 uppercase font-medium">
                            {file.mimetype.split('/')[1] || 'FILE'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* File Info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white black:text-white truncate flex-1 mr-2">{file.name}</h3>
                        <div className="flex items-center space-x-1 flex-shrink-0" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {file.workspace ? `Workspace: ${file.workspace.name}` : ''}
                        {file.notebook ? `Notebook: ${file.notebook.name}` : ''}
                      </div>
                    </div>
                    
                    {/* Actions Menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative dropdown-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(file._id);
                          }}
                          className="p-1.5 bg-white dark:bg-gray-800 black:bg-[#242424] rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border border-gray-100 dark:border-gray-700 black:border-[#3a3a3a]"
                        >
                          <MoreHorizontal className="w-3 h-3 text-gray-600 dark:text-gray-400 black:text-gray-400" />
                        </button>
                        {openDropdownId === file._id && (
                          <div className="absolute top-full right-0 bg-white dark:bg-gray-800 black:bg-[#242424] rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] min-w-[140px] z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileAction('download', file);
                                setOpenDropdownId(null);
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#333333] transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                            {canPreview(file) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileAction('preview', file);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#333333] transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={file._id}
                    className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={() => handleFileAction('preview', file)}
                  >
                    <FileIcon className="w-8 h-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white black:text-white truncate">{file.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
                        {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                        {file.workspace ? ` • Workspace: ${file.workspace.name}` : ''}
                        {file.notebook ? ` • Notebook: ${file.notebook.name}` : ''}
                      </p>
                    </div>
                      <div className="relative dropdown-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          toggleDropdown(file._id);
                          }}
                          className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#333333] transition-all duration-200 border border-gray-200 dark:border-gray-600 black:border-[#3a3a3a]"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-400 black:text-gray-400" />
                        </button>
                      {openDropdownId === file._id && (
                          <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 black:bg-[#242424] rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] py-1 min-w-[140px] z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileAction('download', file);
                                setOpenDropdownId(null);
                              }}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#333333] transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                            {canPreview(file) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileAction('preview', file);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 black:hover:bg-[#333333] transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Enhanced Preview Modal */}
        {showPreviewModal && previewFile && (
          <div className={`fixed inset-0 backdrop-blur-sm z-50 ${
            theme === 'light' 
              ? 'bg-white/95' 
              : theme === 'black' 
                ? 'bg-black/98' 
                : 'bg-gray-900/95'
          }`}>
            <div className="flex flex-col h-full w-full max-w-screen-2xl mx-auto">
              {/* Header */}
              <div className="flex-shrink-0 p-4 sm:p-6 flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
                  <div className={`backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl shadow-lg ${
                    theme === 'light' 
                      ? 'bg-black/10 border border-black/20 text-gray-900' 
                      : 'bg-white/10 border border-white/20 text-white'
                  }`}>
                    <h3 className="font-semibold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-xs">{previewFile.name}</h3>
                  </div>
                  <div className={`backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium ${
                    theme === 'light' 
                      ? 'bg-black/10 border border-black/20 text-gray-900' 
                      : 'bg-white/10 border border-white/20 text-white'
                  }`}>
                    {formatFileSize(previewFile.size)}
                  </div>
                  <div className={`backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium ${
                    theme === 'light' 
                      ? 'bg-black/10 border border-black/20 text-gray-900' 
                      : 'bg-white/10 border border-white/20 text-white'
                  }`}>
                    {previewFile.mimetype.split('/')[1].toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className={`flex-shrink-0 p-2 sm:p-3 backdrop-blur-md rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                    theme === 'light' 
                      ? 'bg-black/10 border border-black/20 text-gray-900 hover:bg-black/20' 
                      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                {previewFile.mimetype.startsWith('image/') && (
                  <div className="relative w-full h-full flex items-center justify-center overflow-auto">
                    <img
                      src={`http://localhost:3001${previewFile.url}`}
                      alt={previewFile.name}
                      className="object-contain max-w-[96vw] max-h-[88vh]"
                    />
                  </div>
                )}

                {previewFile.mimetype.startsWith('video/') && (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <div className="relative w-full h-full">
                      <video
                        ref={videoRef}
                        src={`http://localhost:3001${previewFile.url}`}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <source src={`http://localhost:3001${previewFile.url}`} type={previewFile.mimetype} />
                    </video>
                    </div>
                  </div>
                )}

                {previewFile.mimetype.startsWith('audio/') && (
                  <div className={`rounded-3xl p-10 text-center max-w-lg shadow-2xl ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-blue-100 via-purple-100 to-indigo-100 border border-black/10'
                      : 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 border border-white/10'
                  }`}>
                    <div className={`w-32 h-32 mx-auto mb-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg ${
                      theme === 'light' ? 'bg-black/20' : 'bg-white/20'
                    }`}>
                      <Music className={`${theme === 'light' ? 'text-gray-800' : 'text-white'} w-16 h-16`} />
                    </div>
                    <h3 className={`text-2xl font-bold mb-2 truncate ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{previewFile.name}</h3>
                    <div className={`text-sm mb-6 space-y-1 ${theme === 'light' ? 'text-gray-600' : 'text-white/70'}`}>
                      <div>{previewFile.mimetype.split('/')[1].toUpperCase()}</div>
                      <div>{formatFileSize(previewFile.size)}</div>
                    </div>
                    <div className={`backdrop-blur-md rounded-2xl p-4 ${theme === 'light' ? 'bg-black/10 border border-black/20' : 'bg-white/10 border border-white/20'}`}>
                      <audio
                        src={`http://localhost:3001${previewFile.url}`}
                        controls
                        className="w-full h-12"
                        style={{ filter: theme === 'light' ? 'none' : 'invert(1) brightness(0.8)', borderRadius: '12px' }}
                      />
                    </div>
                  </div>
                )}

                {previewFile.mimetype === 'application/pdf' && (
                  <div className="w-full h-full max-w-5xl max-h-5xl bg-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                    <iframe src={`http://localhost:3001${previewFile.url}`} className="w-full h-full" title={previewFile.name} />
                  </div>
                )}

                {!canPreview(previewFile) && (
                  <div className="text-center text-white max-w-md mx-auto">
                    <div className="w-32 h-32 mx-auto mb-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl flex items-center justify-center shadow-lg">
                      <File className="w-16 h-16 text-white/70" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Preview not available</h3>
                    <p className="text-white/70 mb-2">This file type cannot be previewed in the browser</p>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 mb-6">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/70">Format:</span>
                          <span className="font-medium">{previewFile.mimetype}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Size:</span>
                          <span className="font-medium">{formatFileSize(previewFile.size)}</span>
                        </div>
                      </div>
                    </div>
                    <a href={`http://localhost:3001${previewFile.url}`} className="underline text-blue-300" download={previewFile.originalName}>
                      Download file
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Files;
