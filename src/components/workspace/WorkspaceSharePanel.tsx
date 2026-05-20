import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, Globe, Shield, Check, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useToastStore } from '../../stores/useToastStore';

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  selectedNotebookId?: string;
  notebooks: Array<{ _id: string; name: string }>
}

type Permission = 'read' | 'write' | 'admin';

const WorkspaceSharePanel: React.FC<SharePanelProps> = ({ isOpen, onClose, workspaceId, selectedNotebookId, notebooks }) => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'notebook'>('workspace');
  const [emails, setEmails] = useState('');
  const [permission, setPermission] = useState<Permission>('read');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>(selectedNotebookId ? [selectedNotebookId] : []);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore(s => s.showToast);

  useEffect(() => {
    if (selectedNotebookId) {
      setSelectedNotebookIds([selectedNotebookId]);
    }
  }, [selectedNotebookId]);

  const notebookOptions = useMemo(() => notebooks || [], [notebooks]);

  if (!isOpen) return null;

  const handleShare = async () => {
    const list = emails
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    if (list.length === 0) {
      showToast('Enter at least one email', 'error');
      return;
    }
    try {
      setLoading(true);
      if (activeTab === 'workspace') {
        if (!workspaceId) throw new Error('Workspace id missing');
        // Send one by one to leverage backend email->user lookup
        for (const email of list) {
          await api.post(`/workspaces/${workspaceId}/collaborators`, {
            email,
            permission,
            scope,
            notebookIds: scope === 'selected' ? selectedNotebookIds : []
          });
        }
        showToast('Workspace shared successfully', 'success');
      } else {
        // Share current or selected notebook
        const targetIds = selectedNotebookIds.length ? selectedNotebookIds : (selectedNotebookId ? [selectedNotebookId] : []);
        if (!targetIds.length) {
          showToast('Select a notebook to share', 'error');
          return;
        }
        for (const nbId of targetIds) {
          for (const email of list) {
            await api.post(`/notebooks/${nbId}/collaborators`, { email, permission });
          }
        }
        showToast('Notebook shared successfully', 'success');
      }
      setEmails('');
      onClose();
    } catch (e) {
      showToast('Failed to share. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Enhanced backdrop with glassy effect */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      
      {/* Main panel with glassy effect */}
      <div className="relative w-full max-w-lg bg-white/90 dark:bg-gray-900/90 black:bg-[#242424]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 black:border-[#3a3a3a]/30 overflow-hidden text-gray-900 dark:text-gray-100 black:text-gray-100">
                 {/* Enhanced Header with subtle glassy effect */}
         <div className="px-6 py-4 border-b border-white/20 dark:border-gray-700/30 black:border-[#3a3a3a]/30 bg-white/30 dark:bg-gray-800/30 black:bg-[#2a2a2a]/30 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 black:bg-[#3a3a3a] rounded-lg flex items-center justify-center">
               <Users className="w-4 h-4 text-gray-600 dark:text-gray-300 black:text-gray-300" />
             </div>
            <div>
                             <span className="text-lg font-bold text-gray-900 dark:text-white black:text-white">Share Workspace</span>
              <p className="text-xs text-gray-600 dark:text-gray-400 black:text-gray-400">Invite collaborators to join</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 dark:hover:bg-gray-800/30 black:hover:bg-[#2a2a2a]/30 transition-all duration-200 hover:scale-105">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
          </button>
        </div>

        {/* Enhanced Tabs with glassy effect */}
        <div className="px-6 pt-4 flex items-center gap-3">
                     <button 
             onClick={() => setActiveTab('workspace')} 
             className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
               activeTab === 'workspace' 
                 ? 'bg-blue-600 dark:bg-blue-500 black:bg-blue-500 text-white shadow-md' 
                 : 'bg-white/50 dark:bg-gray-800/50 black:bg-[#2a2a2a]/50 text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/70 black:hover:bg-[#2a2a2a]/70'
             }`}
           >
            <Globe className="w-4 h-4 inline mr-2" />
            Workspace
          </button>
                     <button 
             onClick={() => setActiveTab('notebook')} 
             className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
               activeTab === 'notebook' 
                 ? 'bg-blue-600 dark:bg-blue-500 black:bg-blue-500 text-white shadow-md' 
                 : 'bg-white/50 dark:bg-gray-800/50 black:bg-[#2a2a2a]/50 text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/70 black:hover:bg-[#2a2a2a]/70'
             }`}
           >
            <Shield className="w-4 h-4 inline mr-2" />
            Notebook
          </button>
        </div>

        {/* Enhanced Content Area with glassy effect */}
        <div className="px-6 py-5 space-y-5">
          {/* Enhanced Email Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200 mb-2">Invite by email</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                value={emails} 
                onChange={e=>setEmails(e.target.value)} 
                placeholder="email1@example.com, email2@example.com" 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/30 dark:border-gray-600/30 black:border-[#3a3a3a]/30 bg-white/70 dark:bg-gray-800/70 black:bg-[#242424]/70 backdrop-blur-sm text-sm text-gray-900 dark:text-gray-100 black:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 black:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200" 
              />
            </div>
          </div>
          {/* Enhanced Permission Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200">Permission Level</label>
            <select 
              value={permission} 
              onChange={e=>setPermission(e.target.value as Permission)} 
              className="px-4 py-2.5 rounded-xl border border-white/30 dark:border-gray-600/30 black:border-[#3a3a3a]/30 bg-white/70 dark:bg-gray-800/70 black:bg-[#242424]/70 backdrop-blur-sm text-sm text-gray-900 dark:text-gray-100 black:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
            >
              <option value="read">👁️ Can view</option>
              <option value="write">✏️ Can edit</option>
              <option value="admin">🔑 Full access</option>
            </select>
          </div>

          {activeTab === 'workspace' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200">Share Scope</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 black:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 black:hover:text-blue-400 transition-colors">
                    <input type="radio" className="accent-blue-600 dark:accent-blue-500 w-4 h-4" checked={scope==='all'} onChange={()=>setScope('all')} />
                    <span className="font-medium">📚 All notebooks</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 black:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 black:hover:text-blue-400 transition-colors">
                    <input type="radio" className="accent-blue-600 dark:accent-blue-500 w-4 h-4" checked={scope==='selected'} onChange={()=>setScope('selected')} />
                    <span className="font-medium">🎯 Selected notebooks</span>
                  </label>
                </div>
              </div>
              {scope==='selected' && (
                <div className="max-h-48 overflow-auto border rounded-xl border-white/30 dark:border-gray-600/30 black:border-[#3a3a3a]/30 p-4 bg-white/50 dark:bg-gray-800/50 black:bg-[#242424]/50 backdrop-blur-sm">
                  {notebookOptions.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400 black:text-gray-400">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No notebooks available
                    </div>
                  )}
                  <ul className="space-y-2">
                    {notebookOptions.map(nb => {
                      const checked = selectedNotebookIds.includes(nb._id);
                      return (
                        <li key={nb._id}>
                           <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 black:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 black:hover:text-blue-400 transition-all duration-200 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-gray-700/40 black:hover:bg-[#2a2a2a]/40 border border-transparent hover:border-white/20 dark:hover:border-gray-600/30 black:hover:border-[#3a3a3a]/30">
                             <div className="relative">
                               <input 
                                 type="checkbox" 
                                 className="sr-only" 
                                 checked={checked} 
                                 onChange={(e)=>{
                              if (e.target.checked) setSelectedNotebookIds(prev=>[...prev, nb._id]);
                              else setSelectedNotebookIds(prev=>prev.filter(id=>id!==nb._id));
                                 }} 
                               />
                               <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                                 checked 
                                   ? 'bg-blue-600 dark:bg-blue-500 black:bg-blue-500 border-blue-600 dark:border-blue-500 black:border-blue-500' 
                                   : 'bg-white/70 dark:bg-gray-800/70 black:bg-[#242424]/70 border-gray-300 dark:border-gray-600 black:border-[#3a3a3a]'
                               }`}>
                                 {checked && (
                                   <Check className="w-3 h-3 text-white" />
                                 )}
                               </div>
                             </div>
                             <span className="font-medium flex-1">📓 {nb.name}</span>
                             {checked && (
                               <div className="w-2 h-2 bg-blue-600 dark:bg-blue-500 black:bg-blue-500 rounded-full animate-pulse"></div>
                             )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notebook' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200">Select notebooks to share</label>
              <div className="max-h-48 overflow-auto border rounded-xl border-white/30 dark:border-gray-600/30 black:border-[#3a3a3a]/30 p-4 bg-white/50 dark:bg-gray-800/50 black:bg-[#242424]/50 backdrop-blur-sm">
                {notebookOptions.map(nb => {
                  const checked = selectedNotebookIds.includes(nb._id);
                  return (
                                         <label key={nb._id} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 black:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 black:hover:text-blue-400 transition-all duration-200 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-gray-700/40 black:hover:bg-[#2a2a2a]/40 border border-transparent hover:border-white/20 dark:hover:border-gray-600/30 black:hover:border-[#3a3a3a]/30">
                       <div className="relative">
                         <input 
                           type="checkbox" 
                           className="sr-only" 
                           checked={checked} 
                           onChange={(e)=>{
                        if (e.target.checked) setSelectedNotebookIds(prev=>[...prev, nb._id]);
                        else setSelectedNotebookIds(prev=>prev.filter(id=>id!==nb._id));
                           }} 
                         />
                         <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                           checked 
                             ? 'bg-blue-600 dark:bg-blue-500 black:bg-blue-500 border-blue-600 dark:border-blue-500 black:border-blue-500' 
                             : 'bg-white/70 dark:bg-gray-800/70 black:bg-[#242424]/70 border-gray-300 dark:border-gray-600 black:border-[#3a3a3a]'
                         }`}>
                           {checked && (
                             <Check className="w-3 h-3 text-white" />
                           )}
                         </div>
                       </div>
                       <span className="font-medium flex-1">📓 {nb.name}</span>
                       {checked && (
                         <div className="w-2 h-2 bg-blue-600 dark:bg-blue-500 black:bg-blue-500 rounded-full animate-pulse"></div>
                       )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enhanced Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/20 dark:border-gray-700/30 black:border-[#3a3a3a]/30">
            <button 
              onClick={onClose} 
              className="px-6 py-3 rounded-xl border border-white/30 dark:border-gray-600/30 black:border-[#3a3a3a]/30 text-sm font-medium hover:bg-white/20 dark:hover:bg-gray-800/30 black:hover:bg-[#2a2a2a]/30 transition-all duration-200 hover:scale-105"
            >
              Cancel
            </button>
                         <button 
               disabled={loading} 
               onClick={handleShare} 
               className="px-6 py-3 rounded-xl bg-blue-600 dark:bg-blue-500 black:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60 hover:bg-blue-700 dark:hover:bg-blue-600 black:hover:bg-blue-600 transition-all duration-200 hover:scale-105 shadow-md"
             >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} 
              {loading ? 'Sharing...' : 'Share Workspace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSharePanel;


