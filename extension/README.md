# Wikinsert Browser Extension

The Wikinsert browser extension is a tool that enhances Wikipedia articles with entity-aware highlighting. It allows
users to select a target entity and visualize the relevance of each sentence in the article to that entity through a
color-coded heatmap overlay.

## Features

- **Entity Search**: Search for and select target entities related to the current Wikipedia article
- **Entity-Aware Highlighting**: Visualize sentence-level relevance to the selected entity with a color gradient
- **Highlighting Density Control**: Adjust the threshold for highlighted content using a slider
- **Visual Legend**: See a breakdown of what the heatmap colors represent
- **Accessibility-Compliant**: Designed with WCAG AAA contrast compliance

![Wikinsert Extension Overview](../static/wikinsert-highlight.png)

## Installation and Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository
2. Navigate to the extension directory
3. Install dependencies:

```bash
npm install
```

### Building the Extension

To build the extension for production:

```bash
npm run build
```

This will:

- Compile TypeScript files using webpack
- Process CSS with Tailwind
- Copy static assets from the public directory
- Output the built extension to the `dist` directory

### Development Mode

For development with hot reloading (currently not working fully):

```bash
npm run dev
```

### Loading the Extension in Chrome

1. Build the extension using `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the `dist` directory
5. The extension should now be installed and visible in your browser

## Technical Implementation

### Architecture

The extension is built with a modular architecture:

- **Background Script**: Handles communication between the popup and content scripts
- **Content Scripts**: Injected into Wikipedia pages to modify the DOM and implement highlighting
- **Popup UI**: Provides the user interface for entity selection and highlighting controls

### Technologies

- **TypeScript**: Provides type safety and modern JavaScript features
- **Vue.js**: Used for reactive UI components in the popup
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Wikimedia Codex**: Design system for consistent UI components that match Wikipedia's style
- **Webpack**: Module bundler for compiling and packaging the extension

### Component Breakdown

#### Content Scripts

- `highlighting.ts`: Implements the sentence highlighting architecture
- `coloring.ts`: Handles color mapping for the highlighting
- `xpath.ts`: Provides XPath utilities for DOM traversal
- `page-addons.ts`: Adds additional UI elements to the Wikipedia page

#### Popup Components

- `search.ts`: Implements the entity search functionality
- `target.ts`: Handles target entity selection and display
- `toggle.ts`: Provides controls for toggling highlighting on/off
- `menu.ts`: Manages the popup menu structure

### Sentence Highlighting Architecture

The highlighting system aligns precomputed relevance scores with sentences rendered in the browser's DOM through
offset-based mapping and span-level DOM manipulation:

1. The extension retrieves sentence-level annotations from the backend API
2. It performs DOM traversal to collect all visible text nodes
3. For each sentence, it computes intersections with DOM nodes
4. It wraps the corresponding text ranges in `<span>` elements with appropriate styling
5. The styling includes background colors based on the relevance score

### Color Mapping Function

The extension uses a sophisticated color mapping function to visualize relevance scores:

- Scores are normalized to a range of 0-1
- The color gradient transitions from white (low relevance) to yellow to red (high relevance)
- Opacity is adjusted based on the score to enhance visual distinction
- The color mapping is designed to meet WCAG AAA contrast standards

```typescript
// Simplified color mapping function
function getColor(score: number): string {
    // Normalize score to 0-1 range
    const normalizedScore = (score - minScore) / (maxScore - minScore);

    // Calculate RGB values based on score
    let r = 255;
    let g, b;

    if (normalizedScore <= 0.5) {
        g = 255;
        b = 255 * (1 - normalizedScore / 0.5);
    } else {
        g = 255 + (94 - 255) * (normalizedScore - 0.5) / 0.5;
        b = 94 * (normalizedScore - 0.5) / 0.5;
    }

    // Calculate opacity
    const alpha = (normalizedScore + 0.3) / 4;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

## Usage

1. Navigate to a Wikipedia article
2. Click the Wikinsert extension icon in your browser toolbar
3. Use the search bar to find and select a target entity
4. Toggle highlighting on to see the heatmap overlay
5. Adjust the density slider to control the highlighting threshold
6. Hover over the legend to understand the color mapping

## API Integration

The extension communicates with the Wikinsert API to retrieve:

1. **Heatmap Data**: Sentence-level relevance scores for the current article and selected target entity
2. **Target Entities**: Available target entities that can be inserted into the current article

## Accessibility and Preservation

- The extension preserves the original HTML structure of the article
- Highlighting can be toggled without loss of content or structure
- Colors are chosen to meet WCAG AAA contrast compliance
- The UI follows accessibility best practices from the Wikimedia Codex design system