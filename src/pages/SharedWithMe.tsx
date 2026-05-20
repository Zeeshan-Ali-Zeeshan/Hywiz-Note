import React, { useEffect, useState } from 'react';
import { Users, FileText, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface SharedItem {
  _id: string;
  type: 'note' | 'template';
  title: string;
  plainTextContent?: string;
  content?: string;
  updatedAt: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export const SharedWithMe: React.FC = () => {
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCollaborativeItems();
  }, []);

  const fetchCollaborativeItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/sharing/collaborative');
      setSharedItems(response.data);
    } catch (error) {
      console.error('Failed to fetch collaborative items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTitleClick = (item: SharedItem) => {
    // Navigate to the shared note view instead of rendering NoteEditor directly
    if (item.type === 'note') {
      navigate(`/note/${item._id}`);
    } else if (item.type === 'template') {
      // For templates, you might want to create a shared template view
      // For now, we'll use the template editor
      navigate(`/templates/${item._id}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black max-w-[1920px] mx-auto w-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Header */}
          <div className="bg-black border-b border-gray-800 p-4">
            <h1 className="text-xl font-semibold text-white mb-4">Shared with Me</h1>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-lg p-4 animate-pulse">
                  <div className="h-3 bg-gray-800 rounded w-3/4 mb-2"></div>
                  <div className="h-2.5 bg-gray-800 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : sharedItems.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <Users className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-base font-medium text-white mb-2">Nothing shared yet</h3>
                <p className="text-sm text-gray-400">Notes and templates shared with you will show up here.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800 bg-black table-fixed">
                <thead>
                  <tr>
                    <th className="px-4 py-2 w-1/3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-2 w-1/3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 w-1/3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shared by</th>
                    <th className="px-4 py-2 w-1/3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shared date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sharedItems.map((item) => (
                    <tr key={item._id}>
                      {/* Title */}
                      <td
                        className="px-4 py-3 whitespace-nowrap text-white cursor-pointer transition-all duration-200 ease-in-out group"
                        onClick={() => handleTitleClick(item)}
                      >
                        <span className="flex items-center">
                          {item.type === 'note' ? (
                            <FileText className="w-4 h-4 text-white mr-2 flex-shrink-0" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-white mr-2 flex-shrink-0" />
                          )}
                          <span className="align-middle group-hover:text-blue-400 transition-colors">{item.title}</span>
                        </span>
                      </td>
                      {/* Type */}
                      <td className="px-6 py-4 whitespace-nowrap text-white">
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </td>
                      {/* Shared by */}
                      <td className="px-6 py-4 whitespace-nowrap text-white flex items-center">
                        <span className="inline-block w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-base mr-2">
                          {item.userId?.name?.charAt(0)?.toUpperCase()}
                        </span>
                        <span>{item.userId?.name}</span>
                      </td>
                      {/* Shared date */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedWithMe;