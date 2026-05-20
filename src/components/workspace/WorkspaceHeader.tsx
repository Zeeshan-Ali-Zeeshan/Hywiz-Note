import React, { useState } from 'react';
import { ArrowLeft, Bell, UserPlus, Plus } from 'lucide-react';
import WorkspaceSharePanel from './WorkspaceSharePanel';

interface WorkspaceHeaderProps {
	workspaceName: string;
	notebookName?: string;
	noteTitle?: string;
	onCreateNote: () => void;
	onBackClick?: () => void;
	showBackButton?: boolean;
	leftWidth?: number; // pixels – width of the left sidebar/header column
	workspaceId?: string;
	selectedNotebookId?: string | null;
	notebooksForShare?: Array<{ _id: string; name: string }>; 
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
	workspaceName,
	notebookName = 'Name Of Note Book',
	noteTitle = 'Title of Note',
	onCreateNote,
	onBackClick,
	showBackButton = false,
	leftWidth = 288,
	workspaceId,
	selectedNotebookId,
	notebooksForShare = []
}) => {
	const [shareOpen, setShareOpen] = useState(false);
	return (
		<div className="relative w-full bg-white dark:bg-gray-900 black:bg-[#242424]">
			{/* Main Header split to mirror sections: left above sidebar, right above notes */}
			<div className="h-12 grid items-center px-0" style={{ gridTemplateColumns: `${leftWidth}px 1fr` }}>
				{/* Left header over sidebar */}
				<div className="pl-4 flex items-center space-x-3 h-full">
					<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
						<span className="text-white text-sm font-bold">W</span>
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-bold text-gray-900 dark:text-white black:text-white">{workspaceName}</span>
						<span className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">{notebookName}</span>
					</div>
				</div>

				{/* Subtle divider indicator - aligns with main divider below */}
				<div className="absolute h-full bg-gray-200 dark:bg-gray-700 black:bg-[#3a3a3a] opacity-60" style={{ width: '1px', left: `${leftWidth}px`, top: 0 }}></div>

				{/* Right header over notes section */}
				<div className="flex items-center justify-between pr-4 pl-4">
					<div className="flex items-center space-x-4">
						{showBackButton && (
							<div className="flex items-center space-x-1">
								<button 
									onClick={onBackClick}
									className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 black:hover:bg-[#2a2a2a] rounded-lg transition-all duration-200 group shadow-sm hover:shadow-md"
									title="Back to notes list"
								>
									<ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300 black:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 black:group-hover:text-blue-400" />
								</button>
							</div>
						)}
					</div>

					{/* Right side actions */}
					<div className="flex items-center space-x-2">
						<button
							onClick={onCreateNote}
							className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg font-medium text-xs flex items-center space-x-2"
						>
							<Plus className="w-3.5 h-3.5" />
							<span>New Note</span>
						</button>
						<button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] hover:text-gray-800 rounded-lg transition-all duration-200 group">
							<Bell className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-800" />
						</button>
						<button onClick={() => setShareOpen(true)} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center leading-none hover:from-blue-600 hover:to-purple-600 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg">
							<UserPlus className="block w-4 h-4 text-white" />
						</button>
					</div>
				</div>
			</div>

			{/* Unified Top Bar Divider - connects to sections below */}
			<div className="h-1 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 black:from-[#4a4a4a] black:via-[#5a5a5a] black:to-[#4a4a4a] shadow-md border-t border-gray-200 dark:border-gray-600 black:border-[#3a3a3a]"></div>

			{shareOpen && (
				<WorkspaceSharePanel
					isOpen={shareOpen}
					onClose={() => setShareOpen(false)}
					workspaceId={workspaceId}
					selectedNotebookId={selectedNotebookId || undefined}
					notebooks={notebooksForShare}
				/>
			)}
		</div>
	);
};

export default WorkspaceHeader; 