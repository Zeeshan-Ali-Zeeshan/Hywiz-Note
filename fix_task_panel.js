const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('c:/Users/Zeeshan Ali/Desktop/project2/src/components/editor/extensions/TaskItemComponent.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Replace FloatingPanelProps
content = content.replace(
    `interface FloatingPanelProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}`,
    `interface FloatingPanelProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}`
);

// 2. Replace FloatingPanel return body
content = content.replace(
    `    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl bg-white dark:bg-[#18181b] black:bg-[#1c1c1c] border border-slate-200/80 dark:border-slate-700/70 black:border-[#2e2e2e] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-1 rounded-t-2xl"
        >
          <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 black:text-slate-50 tracking-tight">
            {title}
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 black:hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#2a2a2a] transition-all"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>,`,
    `    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={\`relative w-full mx-4 flex flex-col animate-in fade-in zoom-in-95 duration-150 \${className || 'max-w-lg rounded-2xl shadow-2xl bg-white dark:bg-[#18181b] black:bg-[#1c1c1c] border border-slate-200/80 dark:border-slate-700/70 black:border-[#2e2e2e]'}\`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!hideHeader && (
          <div
            className="flex items-center justify-between px-5 pt-4 pb-1 rounded-t-2xl"
          >
            <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 black:text-slate-50 tracking-tight">
              {title}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 black:hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#2a2a2a] transition-all"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={hideHeader ? "" : "px-5 py-4"}>
          {children}
        </div>
      </div>
    </div>,`
);

// 3. Replace PANEL_CONFIG type
content = content.replace(
    \`const PANEL_CONFIG: Record<PanelType, { title: React.ReactNode; content: React.ReactNode }> = {\`,
  \`const PANEL_CONFIG: Record<PanelType, { title: React.ReactNode; content: React.ReactNode; className?: string; hideHeader?: boolean }> = {\`
);

// 4. Replace more panel config
content = content.replace(
  \`    more: {
      title: "More Options",
      content: <MorePanelContent />
    },\`,
  \`    more: {
      title: "More Options",
      content: <MorePanelContent />,
      className: "max-w-[750px] rounded-[24px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] bg-slate-100/70 dark:bg-[#18181b]/70 black:bg-[#121212]/70 backdrop-blur-xl border border-white/20 dark:border-white/10 black:border-white/5 overflow-hidden",
      hideHeader: true
    },\`
);

// 5. Replace FloatingPanel usage
content = content.replace(
  \`        <FloatingPanel
          title={PANEL_CONFIG[activePanel].title}
          onClose={closePanel}
        >
          {PANEL_CONFIG[activePanel].content}
        </FloatingPanel>\`,
  \`        <FloatingPanel
          title={PANEL_CONFIG[activePanel]?.title}
          onClose={closePanel}
          className={PANEL_CONFIG[activePanel]?.className}
          hideHeader={PANEL_CONFIG[activePanel]?.hideHeader}
        >
          {PANEL_CONFIG[activePanel]?.content}
        </FloatingPanel>\`
);

// 6. Replace MorePanelContent completely
const morePanelStartRegex = /const MorePanelContent = \\(\\) => \\{[\\s\\S]*?  \\n  const PANEL_CONFIG:/;

const newMorePanel = \`const MorePanelContent = () => {
    const { user } = useAuthStore();
    const { notes, currentNote } = useNotesStore();
    const [showNotesDropdown, setShowNotesDropdown] = useState(false);

    const handleFlagToggle = () => {
      const newVal = !localIsFlagged;
      setLocalIsFlagged(newVal);
      updateAttributes({ isFlagged: newVal });
      if (taskId) updateTaskBackend({ isFlagged: newVal });
    };

    const handleDeleteTaskLocal = () => {
      if (window.confirm('Are you sure you want to delete this task?')) {
        editor?.commands.deleteNode('taskItem');
        closePanel();
      }
    };

    const handleSave = () => {
      handleDescriptionUpdate();
      closePanel();
    };

    const cardClass = "bg-white/50 dark:bg-slate-900/40 black:bg-white/5 border border-white/40 dark:border-white/5 black:border-white/10 rounded-[20px] p-4 flex flex-col shadow-sm backdrop-blur-md relative overflow-hidden group";

    return (
      <div className="flex flex-col p-6 gap-4 text-slate-800 dark:text-slate-100 black:text-slate-100 w-full font-sans max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header Section */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-[22px] font-semibold tracking-tight leading-none text-slate-900 dark:text-white black:text-white">More Options</h2>
            <div className="text-[13px] text-slate-500 dark:text-slate-400 black:text-slate-400">
              Created by <span className="text-slate-700 dark:text-slate-200 black:text-slate-300 ml-1 font-medium">{user?.name || 'You'}</span>
            </div>
            
            <div className="relative mt-2">
              <button
                onClick={() => setShowNotesDropdown(!showNotesDropdown)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 black:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                {currentNote?.title || 'My Note'}
                <ChevronDown className="w-4 h-4 opacity-70" />
              </button>
              {showNotesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 rounded-xl shadow-xl bg-white dark:bg-slate-900 black:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 black:border-[#333] z-50 py-1 overflow-hidden">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-100 dark:border-slate-800 black:border-[#333]">Move to note</div>
                  {notes.slice(0, 6).map(note => (
                    <button
                      key={note._id}
                      onClick={() => setShowNotesDropdown(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 black:hover:bg-white/5 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{note.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={closePanel} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2 bg-white/50 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 black:bg-white/5 black:hover:bg-white/10 rounded-full border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Bento Card: Title & Description */}
        <div className={cardClass + " mt-2"}>
          <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[20px] pointer-events-none"></div>

          <div className="flex items-center gap-3 mb-3 relative z-10">
            <button
              onClick={handleToggle}
              className={\`w-6 h-6 rounded-full flex flex-shrink-0 items-center justify-center border-2 transition-all \${isCompleted ? 'bg-[#7C87FB] border-[#7C87FB] shadow-[0_0_10px_rgba(124,135,251,0.5)]' : 'border-[#7C87FB]/70 hover:bg-[#7C87FB]/10'}\`}
            >
               {isCompleted && <Check className="w-4 h-4 text-white stroke-[3px]" />}
            </button>
            <div className={\`text-lg font-semibold outline-none text-slate-900 dark:text-white black:text-white \${isCompleted ? 'line-through opacity-60' : ''}\`}>
               {node.textContent || 'Task'}
            </div>
          </div>
          <textarea
             value={localDesc}
             onChange={(e) => setLocalDesc(e.target.value)}
             placeholder="Add a descriptive note..."
             rows={3}
             className="w-full bg-slate-100/50 dark:bg-black/20 black:bg-black/40 border border-transparent hover:border-slate-300 dark:hover:border-white/10 focus:border-slate-400 dark:focus:border-white/20 rounded-xl p-3 text-[14px] leading-relaxed resize-none outline-none transition-all placeholder:text-slate-500 relative z-10 text-slate-800 dark:text-slate-200 black:text-slate-200"
          />
        </div>

        {/* Middle 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Timeline Card */}
          <div className={cardClass}>
             <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[20px] pointer-events-none"></div>
             <h3 className="text-[15px] font-semibold mb-4 relative z-10 text-slate-900 dark:text-white black:text-white">Timeline</h3>
             <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-auto relative z-10">
                <Calendar className="w-4 h-4 text-blue-500" /> Due Date
             </div>
             <button onClick={() => openPanel('date')} className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C87FB]/10 to-[#7C87FB]/20 text-[#7C87FB] dark:text-[#a0a8ff] font-semibold text-[13px] hover:from-[#7C87FB]/20 hover:to-[#7C87FB]/30 transition-all border border-[#7C87FB]/30 shadow-inner relative z-10 text-center">
                {dueDateWall ? format(new Date(dueDateWall), 'MMM d, yyyy') : 'Set Date'}
             </button>
          </div>

          {/* Alerts Card */}
          <div className={cardClass}>
             <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[20px] pointer-events-none"></div>
             <h3 className="text-[15px] font-semibold mb-4 relative z-10 text-slate-900 dark:text-white black:text-white">Alerts</h3>
             <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-auto relative z-10">
                <Bell className="w-4 h-4 text-[#7C87FB]" /> Reminder
             </div>
             <div className="mt-4 flex items-center gap-1.5 relative z-10">
                <div className="flex flex-1 items-center justify-between gap-1 py-2 px-3 rounded-xl bg-slate-100/50 dark:bg-black/20 black:bg-white/5 border border-slate-200 dark:border-white/10 black:border-white/5">
                   <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 black:text-slate-200">7 AM</span>
                   <span className="text-[10px] text-slate-400">-</span>
                   <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 black:text-slate-200">9 AM</span>
                   <button className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors">
                     <Settings className="w-[14px] h-[14px]" />
                   </button>
                </div>
             </div>
          </div>

          {/* Collaborator Card */}
          <div className={cardClass}>
             <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[20px] pointer-events-none"></div>
             <h3 className="text-[15px] font-semibold mb-4 relative z-10 text-slate-900 dark:text-white black:text-white">Collaborator</h3>
             <div className="flex items-center gap-3 mb-auto relative z-10">
                <div className="relative">
                   <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 black:bg-slate-800 flex items-center justify-center text-[13px] font-bold text-slate-700 dark:text-slate-200 border border-white/60 dark:border-white/20 shadow-sm backdrop-blur-sm">
                      {node.attrs.assignee ? node.attrs.assignee.substring(0, 2).toUpperCase() : 'ZA'}
                   </div>
                   <div className="absolute right-0 bottom-0 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-800 black:border-slate-900 rounded-full"></div>
                </div>
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Assignee</span>
             </div>
             <button onClick={() => openPanel('assignee')} className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold text-slate-700 dark:text-slate-300 black:text-slate-300 border border-slate-300/60 dark:border-white/10 black:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 black:hover:bg-white/10 transition-all relative z-10 bg-white/30 dark:bg-transparent">
                {node.attrs.assignee ? 'Change...' : 'Assign Collaborator'}
             </button>
          </div>
        </div>

        {/* Bottom Card: Priority & Status */}
        <div className={cardClass}>
           <div className="absolute inset-0 border border-white/40 dark:border-white/10 rounded-[20px] pointer-events-none"></div>
           <h3 className="text-[15px] font-semibold mb-3 relative z-10 text-slate-900 dark:text-white black:text-white">Priority & Status</h3>
           <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 min-w-[70px]">
                    <Flag className="w-[14px] h-[14px] text-emerald-500" /> Priority
                 </div>
                 <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-black/20 black:bg-white/5 p-1 rounded-full border border-slate-200 dark:border-transparent flex-1 justify-center sm:justify-start">
                    {['Low', 'Medium', 'High'].map(p => {
                       const pVal = p.toLowerCase();
                       const isSelected = priority === pVal;
                       const baseBtn = "px-4 py-1.5 text-[12px] font-bold rounded-full transition-all duration-300 ease-out";
                       
                       let selectedClass = "";
                       if (isSelected) {
                         if (p === 'Low') selectedClass = "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border-transparent";
                         else if (p === 'Medium') selectedClass = "bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] border-transparent";
                         else selectedClass = "bg-rose-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] border-transparent";
                       } else {
                         selectedClass = "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
                       }
                       
                       return (
                          <button
                             key={p}
                             onClick={() => updateAttributes({ priority: pVal })}
                             className={\`\${baseBtn} \${selectedClass}\`}
                          >
                             {p}
                          </button>
                       );
                    })}
                 </div>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                 <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                    <Flag className="w-[14px] h-[14px] text-slate-400" /> Status Flag
                 </div>
                 <button
                    onClick={handleFlagToggle}
                    className={\`w-10 h-6 rounded-full p-[3px] transition-colors duration-300 ease-out border \${localIsFlagged ? 'bg-[#7C87FB] border-[#7C87FB]' : 'bg-slate-300 dark:bg-white/10 black:bg-white/10 border-transparent'}\`}
                 >
                    <div className={\`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-300 ease-out shadow-sm \${localIsFlagged ? 'translate-x-[15px]' : 'translate-x-0'}\`} />
                 </button>
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 px-1 relative z-10">
           <button onClick={handleDeleteTaskLocal} className="flex items-center gap-2 text-[13px] font-semibold text-rose-500/80 hover:text-rose-600 transition-colors w-full sm:w-auto justify-center">
              <Trash2 className="w-4 h-4" /> Delete task
           </button>
           <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={closePanel} className="flex-1 sm:flex-none px-6 py-2.5 text-[14px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 black:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-300 dark:hover:border-white/10 text-center">
                 Cancel
              </button>
              <button onClick={handleSave} className="flex-1 sm:flex-none px-8 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 rounded-xl shadow-[0_0_20px_rgba(124,135,251,0.4)] hover:shadow-[0_0_25px_rgba(124,135,251,0.6)] transition-all text-center">
                 Save
              </button>
           </div>
        </div>

      </div>
    );
  };

  const PANEL_CONFIG:\`

content = content.replace(morePanelStartRegex, newMorePanel);

fs.writeFileSync(targetPath, content);
console.log('Update complete');
