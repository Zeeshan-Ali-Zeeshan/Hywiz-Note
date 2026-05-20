import React, { useState } from 'react';
import { X, Search, FileText } from 'lucide-react';
import { useNotesStore } from '../../stores/useNotesStore';
import { useNavigate } from 'react-router-dom';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: string;
  content: string;
  tags: string[];
}

export const templates: Template[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Structured template for meeting notes',
    icon: FileText,
    category: 'Work',
    content: `<h2>Meeting Notes</h2>
<h3>📅 Meeting Details</h3>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Time:</strong> [Time]</p>
<p><strong>Duration:</strong> [Duration]</p>
<p><strong>Location:</strong> [Location/Platform]</p>

<h3>👥 Attendees</h3>
<ul>
<li>[Attendee 1]</li>
<li>[Attendee 2]</li>
<li>[Attendee 3]</li>
</ul>

<h3>📋 Agenda</h3>
<ol>
<li>[Agenda Item 1]</li>
<li>[Agenda Item 2]</li>
<li>[Agenda Item 3]</li>
</ol>

<h3>💬 Discussion Points</h3>
<ul>
<li><strong>Topic 1:</strong> [Discussion details]</li>
<li><strong>Topic 2:</strong> [Discussion details]</li>
</ul>

<h3>✅ Action Items</h3>
<ul>
<li>[ ] [Action item 1] - [Assignee] - [Due date]</li>
<li>[ ] [Action item 2] - [Assignee] - [Due date]</li>
</ul>

<h3>📝 Key Decisions</h3>
<ul>
<li>[Decision 1]</li>
<li>[Decision 2]</li>
</ul>

<h3>📅 Next Meeting</h3>
<p><strong>Date:</strong> [Next meeting date]</p>
<p><strong>Agenda:</strong> [Next meeting agenda]</p>`,
    tags: ['meeting', 'work', 'collaboration']
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Comprehensive project planning template',
    icon: FileText,
    category: 'Work',
    content: `<h2>Project Plan</h2>
<h3>📋 Project Overview</h3>
<p><strong>Project Name:</strong> [Project Name]</p>
<p><strong>Project Manager:</strong> [Name]</p>
<p><strong>Start Date:</strong> [Date]</p>
<p><strong>End Date:</strong> [Date]</p>
<p><strong>Budget:</strong> [Budget]</p>

<h3>🎯 Project Goals</h3>
<ul>
<li>[Goal 1]</li>
<li>[Goal 2]</li>
<li>[Goal 3]</li>
</ul>

<h3>📊 Success Metrics</h3>
<ul>
<li><strong>Metric 1:</strong> [Description]</li>
<li><strong>Metric 2:</strong> [Description]</li>
</ul>

<h3>👥 Team Members</h3>
<ul>
<li><strong>[Role 1]:</strong> [Name] - [Responsibilities]</li>
<li><strong>[Role 2]:</strong> [Name] - [Responsibilities]</li>
</ul>

<h3>📅 Timeline</h3>
<h4>Phase 1: Planning (Week 1-2)</h4>
<ul>
<li>[ ] [Task 1]</li>
<li>[ ] [Task 2]</li>
</ul>

<h4>Phase 2: Development (Week 3-8)</h4>
<ul>
<li>[ ] [Task 1]</li>
<li>[ ] [Task 2]</li>
</ul>

<h4>Phase 3: Testing (Week 9-10)</h4>
<ul>
<li>[ ] [Task 1]</li>
<li>[ ] [Task 2]</li>
</ul>

<h4>Phase 4: Launch (Week 11-12)</h4>
<ul>
<li>[ ] [Task 1]</li>
<li>[ ] [Task 2]</li>
</ul>

<h3>💰 Budget Breakdown</h3>
<ul>
<li><strong>Development:</strong> [Amount]</li>
<li><strong>Design:</strong> [Amount]</li>
<li><strong>Marketing:</strong> [Amount]</li>
<li><strong>Contingency:</strong> [Amount]</li>
</ul>

<h3>⚠️ Risks & Mitigation</h3>
<ul>
<li><strong>Risk 1:</strong> [Description] - <em>Mitigation: [Strategy]</em></li>
<li><strong>Risk 2:</strong> [Description] - <em>Mitigation: [Strategy]</em></li>
</ul>`,
    tags: ['project', 'planning', 'work']
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    description: 'Personal daily reflection template',
    icon: FileText,
    category: 'Personal',
    content: `<h2>Daily Journal - [Date]</h2>

<h3>🌅 Morning Reflection</h3>
<p><strong>How did I sleep?</strong> [Quality of sleep]</p>
<p><strong>Energy level:</strong> [1-10]</p>
<p><strong>Mood:</strong> [Current mood]</p>

<h3>🎯 Today's Goals</h3>
<ul>
<li>[ ] [Goal 1]</li>
<li>[ ] [Goal 2]</li>
<li>[ ] [Goal 3]</li>
</ul>

<h3>📝 Gratitude</h3>
<p>Today I'm grateful for:</p>
<ol>
<li>[Gratitude item 1]</li>
<li>[Gratitude item 2]</li>
<li>[Gratitude item 3]</li>
</ol>

<h3>📚 What I Learned Today</h3>
<ul>
<li>[Learning 1]</li>
<li>[Learning 2]</li>
</ul>

<h3>💪 Challenges & How I Handled Them</h3>
<ul>
<li><strong>Challenge:</strong> [Description] - <em>Response: [How I handled it]</em></li>
</ul>

<h3>🌟 Highlights of the Day</h3>
<ul>
<li>[Highlight 1]</li>
<li>[Highlight 2]</li>
</ul>

<h3>🌙 Evening Reflection</h3>
<p><strong>Did I achieve my goals?</strong> [Yes/No - Why?]</p>
<p><strong>What could I have done better?</strong> [Reflection]</p>
<p><strong>Tomorrow I will:</strong> [Action plan]</p>

<h3>📊 Daily Rating</h3>
<p><strong>Productivity:</strong> [1-10]</p>
<p><strong>Happiness:</strong> [1-10]</p>
<p><strong>Health:</strong> [1-10]</p>`,
    tags: ['journal', 'personal', 'reflection']
  },
  {
    id: 'idea-brainstorm',
    name: 'Idea Brainstorm',
    description: 'Creative brainstorming template',
    icon: FileText,
    category: 'Creative',
    content: `<h2>Idea Brainstorm</h2>

<h3>💡 Problem/Challenge</h3>
<p>[Describe the problem or challenge you're trying to solve]</p>

<h3>🎯 Objective</h3>
<p><strong>What are we trying to achieve?</strong></p>
<p>[Clear objective statement]</p>

<h3>🧠 Initial Ideas</h3>
<h4>Crazy Ideas (No limits!)</h4>
<ul>
<li>[Crazy idea 1]</li>
<li>[Crazy idea 2]</li>
<li>[Crazy idea 3]</li>
</ul>

<h4>Practical Ideas</h4>
<ul>
<li>[Practical idea 1]</li>
<li>[Practical idea 2]</li>
<li>[Practical idea 3]</li>
</ul>

<h4>Inspired Ideas</h4>
<ul>
<li>[Inspired idea 1]</li>
<li>[Inspired idea 2]</li>
<li>[Inspired idea 3]</li>
</ul>

<h3>🔍 Research & Inspiration</h3>
<p><strong>What already exists?</strong></p>
<ul>
<li>[Existing solution 1]</li>
<li>[Existing solution 2]</li>
</ul>

<p><strong>Inspiration sources:</strong></p>
<ul>
<li>[Inspiration 1]</li>
<li>[Inspiration 2]</li>
</ul>

<h3>✅ Evaluation Criteria</h3>
<ul>
<li><strong>Feasibility:</strong> [How realistic is this?]</li>
<li><strong>Impact:</strong> [How much value does this create?]</li>
<li><strong>Resources:</strong> [What do we need?]</li>
<li><strong>Timeline:</strong> [How long will this take?]</li>
</ul>

<h3>⭐ Top Ideas (Ranked)</h3>
<ol>
<li><strong>[Top idea 1]</strong> - [Brief description]</li>
<li><strong>[Top idea 2]</strong> - [Brief description]</li>
<li><strong>[Top idea 3]</strong> - [Brief description]</li>
</ol>

<h3>🚀 Next Steps</h3>
<ul>
<li>[ ] [Action step 1]</li>
<li>[ ] [Action step 2]</li>
<li>[ ] [Action step 3]</li>
</ul>`,
    tags: ['brainstorm', 'creative', 'ideas']
  },
  {
    id: 'shopping-list',
    name: 'Shopping List',
    description: 'Organized shopping list template',
    icon: FileText,
    category: 'Personal',
    content: `<h2>Shopping List</h2>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Store:</strong> [Store name]</p>

<h3>🥛 Dairy & Eggs</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>🥩 Meat & Fish</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>🥬 Produce</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>🥖 Bread & Bakery</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>🥫 Pantry</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>🧴 Household</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>💊 Health & Beauty</h3>
<ul>
<li>[ ] [Item] - [Quantity]</li>
<li>[ ] [Item] - [Quantity]</li>
</ul>

<h3>💰 Budget</h3>
<p><strong>Estimated Total:</strong> [Amount]</p>
<p><strong>Actual Total:</strong> [Amount]</p>

<h3>📝 Notes</h3>
<p>[Any additional notes or reminders]</p>`,
    tags: ['shopping', 'personal', 'list']
  },
  {
    id: 'travel-plan',
    name: 'Travel Plan',
    description: 'Comprehensive travel planning template',
    icon: FileText,
    category: 'Personal',
    content: `<h2>Travel Plan - [Destination]</h2>

<h3>📅 Trip Details</h3>
<p><strong>Destination:</strong> [City, Country]</p>
<p><strong>Dates:</strong> [Start Date] - [End Date]</p>
<p><strong>Duration:</strong> [Number of days]</p>
<p><strong>Travelers:</strong> [Names]</p>

<h3>✈️ Transportation</h3>
<h4>Flights</h4>
<ul>
<li><strong>Departure:</strong> [Flight details]</li>
<li><strong>Return:</strong> [Flight details]</li>
</ul>

<h4>Local Transportation</h4>
<ul>
<li>[ ] [Transportation method 1]</li>
<li>[ ] [Transportation method 2]</li>
</ul>

<h3>🏨 Accommodation</h3>
<p><strong>Hotel/Accommodation:</strong> [Name]</p>
<p><strong>Address:</strong> [Address]</p>
<p><strong>Check-in:</strong> [Date & Time]</p>
<p><strong>Check-out:</strong> [Date & Time]</p>
<p><strong>Confirmation #:</strong> [Number]</p>

<h3>🗺️ Itinerary</h3>
<h4>Day 1 - [Date]</h4>
<ul>
<li><strong>Morning:</strong> [Activity]</li>
<li><strong>Afternoon:</strong> [Activity]</li>
<li><strong>Evening:</strong> [Activity]</li>
</ul>

<h4>Day 2 - [Date]</h4>
<ul>
<li><strong>Morning:</strong> [Activity]</li>
<li><strong>Afternoon:</strong> [Activity]</li>
<li><strong>Evening:</strong> [Activity]</li>
</ul>

<h3>🍽️ Restaurants & Food</h3>
<ul>
<li>[ ] [Restaurant 1] - [Cuisine] - [Address]</li>
<li>[ ] [Restaurant 2] - [Cuisine] - [Address]</li>
</ul>

<h3>🎯 Must-See Attractions</h3>
<ul>
<li>[ ] [Attraction 1] - [Address] - [Hours]</li>
<li>[ ] [Attraction 2] - [Address] - [Hours]</li>
</ul>

<h3>📋 Packing List</h3>
<h4>Clothing</h4>
<ul>
<li>[ ] [Item]</li>
<li>[ ] [Item]</li>
</ul>

<h4>Electronics</h4>
<ul>
<li>[ ] [Item]</li>
<li>[ ] [Item]</li>
</ul>

<h4>Documents</h4>
<ul>
<li>[ ] Passport</li>
<li>[ ] Travel insurance</li>
<li>[ ] Booking confirmations</li>
</ul>

<h3>💰 Budget</h3>
<ul>
<li><strong>Flights:</strong> [Amount]</li>
<li><strong>Accommodation:</strong> [Amount]</li>
<li><strong>Food:</strong> [Amount]</li>
<li><strong>Activities:</strong> [Amount]</li>
<li><strong>Transportation:</strong> [Amount]</li>
<li><strong>Total:</strong> [Total Amount]</li>
</ul>

<h3>📞 Important Contacts</h3>
<ul>
<li><strong>Hotel:</strong> [Phone]</li>
<li><strong>Emergency:</strong> [Number]</li>
<li><strong>Local Embassy:</strong> [Phone]</li>
</ul>`,
    tags: ['travel', 'planning', 'personal']
  },
  {
    id: 'workout-log',
    name: 'Workout Log',
    description: 'Fitness tracking template',
    icon: FileText,
    category: 'Health',
    content: `<h2>Workout Log - [Date]</h2>

<h3>📊 Daily Stats</h3>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Workout Type:</strong> [Cardio/Strength/Flexibility/etc.]</p>
<p><strong>Duration:</strong> [Time]</p>
<p><strong>Energy Level:</strong> [1-10]</p>
<p><strong>Sleep Quality:</strong> [1-10]</p>

<h3>💪 Workout Details</h3>
<h4>Warm-up (10 minutes)</h4>
<ul>
<li>[ ] [Exercise 1] - [Sets] x [Reps]</li>
<li>[ ] [Exercise 2] - [Sets] x [Reps]</li>
</ul>

<h4>Main Workout</h4>
<ul>
<li>[ ] [Exercise 1] - [Sets] x [Reps] - [Weight]</li>
<li>[ ] [Exercise 2] - [Sets] x [Reps] - [Weight]</li>
<li>[ ] [Exercise 3] - [Sets] x [Reps] - [Weight]</li>
</ul>

<h4>Cool-down (5 minutes)</h4>
<ul>
<li>[ ] [Exercise 1] - [Duration]</li>
<li>[ ] [Exercise 2] - [Duration]</li>
</ul>

<h3>📈 Progress Tracking</h3>
<p><strong>Weight:</strong> [Current weight]</p>
<p><strong>Body Fat %:</strong> [Percentage]</p>
<p><strong>Measurements:</strong></p>
<ul>
<li>Chest: [Measurement]</li>
<li>Arms: [Measurement]</li>
<li>Waist: [Measurement]</li>
<li>Hips: [Measurement]</li>
</ul>

<h3>🎯 Goals</h3>
<ul>
<li><strong>Short-term:</strong> [Goal] - [Target date]</li>
<li><strong>Long-term:</strong> [Goal] - [Target date]</li>
</ul>

<h3>💭 Notes & Observations</h3>
<p>[How the workout felt, any issues, improvements needed]</p>

<h3>🍽️ Nutrition</h3>
<p><strong>Pre-workout:</strong> [What you ate]</p>
<p><strong>Post-workout:</strong> [What you ate]</p>
<p><strong>Water intake:</strong> [Amount]</p>

<h3>📅 Next Workout Plan</h3>
<p><strong>Date:</strong> [Next workout date]</p>
<p><strong>Focus:</strong> [What to work on]</p>`,
    tags: ['fitness', 'health', 'workout']
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep',
    description: 'Job interview preparation template',
    icon: FileText,
    category: 'Work',
    content: `<h2>Interview Preparation</h2>

<h3>🏢 Company Research</h3>
<p><strong>Company:</strong> [Company Name]</p>
<p><strong>Position:</strong> [Job Title]</p>
<p><strong>Industry:</strong> [Industry]</p>
<p><strong>Company Size:</strong> [Size]</p>

<h3>📋 Company Information</h3>
<ul>
<li><strong>Founded:</strong> [Year]</li>
<li><strong>CEO:</strong> [Name]</li>
<li><strong>Mission:</strong> [Mission statement]</li>
<li><strong>Values:</strong> [Company values]</li>
<li><strong>Recent News:</strong> [Recent developments]</li>
</ul>

<h3>👥 Interview Details</h3>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Time:</strong> [Time]</p>
<p><strong>Location:</strong> [Location/Platform]</p>
<p><strong>Interviewer(s):</strong> [Names]</p>
<p><strong>Type:</strong> [Phone/Video/In-person]</p>

<h3>❓ Common Questions & Answers</h3>
<h4>Tell me about yourself</h4>
<p>[Your elevator pitch]</p>

<h4>Why are you interested in this position?</h4>
<p>[Your motivation]</p>

<h4>Why do you want to work here?</h4>
<p>[Company-specific reasons]</p>

<h4>What are your strengths?</h4>
<p>[Key strengths with examples]</p>

<h4>What are your weaknesses?</h4>
<p>[Growth areas with improvement plans]</p>

<h4>Where do you see yourself in 5 years?</h4>
<p>[Career goals]</p>

<h3>❓ Questions to Ask</h3>
<ul>
<li>[Question about company culture]</li>
<li>[Question about growth opportunities]</li>
<li>[Question about team structure]</li>
<li>[Question about challenges]</li>
</ul>

<h3>📚 Technical Preparation</h3>
<ul>
<li>[ ] [Technical skill 1] - [Review/Study plan]</li>
<li>[ ] [Technical skill 2] - [Review/Study plan]</li>
</ul>

<h3>🎯 STAR Method Examples</h3>
<h4>Situation: [Describe the situation]</h4>
<h4>Task: [What was your task?]</h4>
<h4>Action: [What actions did you take?]</h4>
<h4>Result: [What were the results?]</h4>

<h3>📝 Notes</h3>
<p>[Additional notes, reminders, or preparation items]</p>

<h3>✅ Checklist</h3>
<ul>
<li>[ ] Research company thoroughly</li>
<li>[ ] Prepare answers to common questions</li>
<li>[ ] Prepare questions to ask</li>
<li>[ ] Test technology (if virtual)</li>
<li>[ ] Plan outfit (if in-person)</li>
<li>[ ] Print resume and portfolio</li>
<li>[ ] Plan route/timing</li>
</ul>`,
    tags: ['interview', 'career', 'work']
  }
];

interface NoteTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoteTemplates: React.FC<NoteTemplatesProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { createNote, setCurrentNote } = useNotesStore();
  const navigate = useNavigate();

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleCreateFromTemplate = async (template: Template) => {
    try {
      const newNote = await createNote({
        tags: template.tags
      });

      setCurrentNote(newNote);
      navigate(`/notes?note=${newNote._id}`);
      onClose();
    } catch (error) {
      console.error('Failed to create note from template:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Note Templates</h2>
            <p className="text-gray-500">Choose a template to get started quickly</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const IconComponent = template.icon;
              return (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <IconComponent className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500">{template.category}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">{template.description}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>

                  <button
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateFromTemplate(template);
                    }}
                  >
                    Use Template
                  </button>
                </div>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteTemplates; 