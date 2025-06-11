# Wikinsert Web App

A Vue.js web application that serves as the entry point for user study experiments in the Wikinsert project. This web
app provides access to preprocessed Wikipedia articles with entity-aware highlighting capabilities.

## Purpose and Overview

The Wikinsert Web App was developed to support user study experiments, such as think-aloud studies, by providing a
controlled environment where users can access a predefined sample of Wikipedia articles. Since the current
implementation does not support live inference, this web app serves as a crucial interface to the preprocessed data.

Key aspects of the web app:

- Provides a simple, user-friendly interface for accessing the Wikinsert functionality
- Connects to a backend API that serves pre-computed sentence-level relevance scores
- Allows users to search for and select Wikipedia articles from the preprocessed dataset
- Maintains a consistent user experience with the Wikimedia design language

## Features

- **Article Search**: Search interface using Wikimedia Codex's typeahead component
- **Preprocessed Data Access**: Access to a curated set of Wikipedia articles with pre-computed entity relevance scores
- **Wikimedia Design Integration**: Consistent styling with Wikipedia using the Codex design system
- **Responsive Layout**: Works across different device sizes and screen resolutions

## Technical Implementation

### Technologies

- **Vue.js 3**: Frontend framework with Composition API
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast, modern build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Wikimedia Codex**: Design system and component library for Wikipedia-like interfaces

### Architecture

The web app follows a simple architecture:

1. **Main App Component**: Serves as the landing page with project information
2. **TypeaheadSearch Component**: Handles user search queries and displays results
3. **Backend API Integration**: Connects to the Wikinsert API for article data

## Installation and Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Project Setup

```sh
# Install dependencies
npm install
```

### Development

```sh
# Start development server with hot-reload
npm run dev
```

## Usage

1. Start the application using `npm run dev` or deploy the built files from the `dist` directory
2. The landing page displays information about the Wikinsert project
3. Use the search bar to find Wikipedia articles from the preprocessed dataset
4. Click on a search result to view the article with entity-aware highlighting

## Backend API Integration

The web app connects to the Wikinsert backend API to retrieve article data. The API endpoint is configured in the
TypeaheadSearch component:

```
baseApiUrl = "http://odin.st.lab.au.dk:8081"
```

The API provides:

- Search functionality for finding articles in the preprocessed dataset
- Article metadata including titles, descriptions, and thumbnails
- Pre-computed sentence-level relevance scores for entity highlighting