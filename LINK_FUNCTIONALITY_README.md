# Link Functionality in Editors

This document describes the comprehensive link functionality implemented in the note-taking application's editors.

## Features

### 1. External Links
- **URL Support**: Full support for HTTP, HTTPS, mailto, and tel protocols
- **Target Options**: Links can open in new tabs/windows or same tab
- **Visual Indicators**: External links show an arrow (↗) indicator
- **Click Behavior**: 
  - Regular click: Shows link bubble with options
  - Ctrl/Cmd+click: Opens directly in new tab

### 2. Internal Links
- **Note Links**: Link to other notes using `note://` protocol
- **Template Links**: Link to templates using `template://` protocol
- **Visual Distinction**: Different colors for notes (green) and templates (purple)
- **Navigation**: Clicking internal links navigates to the target note/template

### 3. Link Masking
- **Mask Text**: Display custom text instead of the actual URL
- **Hover Preview**: Hover over masked links to see the actual URL
- **Toggle Display**: Option to show/hide the actual URL in the link bubble

### 4. Link Management
- **Insert Links**: Use the toolbar button or Ctrl+K shortcut
- **Edit Links**: Click on any link to open the link bubble for editing
- **Remove Links**: Quick removal option in the link bubble
- **Copy Links**: Copy link URLs to clipboard

## Usage

### Inserting Links

1. **Via Toolbar**:
   - Click the "Insert" button in the toolbar
   - Select "Insert Note Link" from the dropdown
   - Choose between external or internal links

2. **Via Keyboard**:
   - Press `Ctrl+K` (or `Cmd+K` on Mac) to open the link modal
   - Enter the URL or search for internal notes/templates

3. **Via Link Modal**:
   - Select link type (External/Internal)
   - For external links: Enter URL
   - For internal links: Search and select from notes/templates
   - Optionally set link text and target
   - Enable masking for custom display text

### Editing Links

1. **Link Bubble**:
   - Click on any existing link
   - Use the bubble to:
     - Open the link
     - Edit link properties
     - Copy link URL
     - Remove the link

2. **Masked Links**:
   - Toggle between masked text and actual URL
   - Preview the actual URL on hover

## Technical Implementation

### Components

1. **Link Extension** (`src/components/editor/extensions/Link.ts`)
   - TipTap extension for link functionality
   - Handles link attributes and commands
   - Manages click events and navigation

2. **Link Modal** (`src/components/editor/LinkModal.tsx`)
   - Modal for inserting and editing links
   - Search functionality for internal notes/templates
   - Support for link masking

3. **Link Bubble** (`src/components/editor/LinkBubble.tsx`)
   - Popup interface for link management
   - Quick actions for existing links
   - Mask text toggle functionality

### Link Types

#### External Links
```javascript
{
  href: "https://example.com",
  target: "_blank",
  rel: "noopener noreferrer"
}
```

#### Internal Note Links
```javascript
{
  href: "note://noteId123",
  text: "Note Title"
}
```

#### Internal Template Links
```javascript
{
  href: "template://templateId456",
  text: "Template Name"
}
```

#### Masked Links
```javascript
{
  href: "https://example.com",
  maskText: "Click here for more info",
  text: "Click here for more info"
}
```

### CSS Styling

Links are styled with different colors based on type:
- **External links**: Blue (#2563eb)
- **Note links**: Green (#059669)
- **Template links**: Purple (#7c3aed)
- **Email links**: Red (#dc2626)
- **Phone links**: Green (#059669)

### Navigation Integration

Internal links integrate with the existing routing system:
- Note links navigate to `/notes?note={noteId}`
- Template links navigate to `/templates?template={templateId}`
- Uses custom events for cross-component communication

## Keyboard Shortcuts

- `Ctrl+K` / `Cmd+K`: Open link modal
- `Ctrl+Click` / `Cmd+Click`: Open link in new tab

## Future Enhancements

1. **Link Validation**: Real-time URL validation
2. **Link Previews**: Rich previews for external links
3. **Broken Link Detection**: Identify and highlight broken links
4. **Link Analytics**: Track link usage and clicks
5. **Bulk Link Operations**: Edit multiple links at once
6. **Link Categories**: Organize links by type or purpose

## Browser Compatibility

- Modern browsers with ES6+ support
- Requires clipboard API for copy functionality
- Responsive design for mobile devices

## Security Considerations

- External links open with `rel="noopener noreferrer"` by default
- URL validation prevents XSS attacks
- Internal links use custom protocols to prevent conflicts
- Masked links maintain security while improving UX
