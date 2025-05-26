## Overview

This project uses the following tech stack:
- Next.js 15 (for client framework)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Framer Motion (for animations)

All relevant files live in the 'src' directory.

## Setup

This project is set up already and running on a cloud environment.

To set it up yourself:

1. Clone the repository
2. Run `pnpm install` to install the dependencies
3. Run `pnpm dev` to start the development server
4. Run `npx convex dev` to start the Convex development server

Running the convex development server is critical for ensuring the backend convex functions are correctly updating.

## Deploying to GitHub Pages

This project can be deployed to GitHub Pages with the following steps:

1. Fork or push this repository to your GitHub account
2. Set up the following secret in your GitHub repository settings:
   - `NEXT_PUBLIC_CONVEX_URL`: Your Convex deployment URL (from .env.local)
3. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Set the source to 'GitHub Actions'
4. Push to the main branch or manually trigger the workflow
5. Your site will be deployed to `https://[your-username].github.io/kite-aggregator/`

**Note**: Since this is a static export, you'll need an active Convex deployment for the backend functionality to work.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL environment variables on the client side.

# KITE Aggregator

A modern, intelligent content aggregation platform that automatically collects and organizes articles from RSS feeds and HTML websites. Built with Next.js, Convex, and TypeScript for a seamless, real-time experience.

## ✨ Features

### 🔄 **Smart Content Aggregation**
- **RSS Feed Support** - Automatically parse and import from RSS/Atom feeds
- **HTML Website Parsing** - Extract articles directly from websites using Cheerio
- **Duplicate Prevention** - Intelligent deduplication across all sources
- **Real-time Updates** - Live content synchronization with WebSocket support

### 📁 **Intelligent Organization**
- **Custom Folders** - Create and manage personalized article collections
- **Advanced Search** - Full-text search across all articles and content
- **Source Filtering** - Filter articles by specific RSS feeds or websites
- **Smart Categorization** - Organize content by source and publication date

### 🛡️ **Data Management**
- **2-Year Article Limit** - Automatically filters content to last 2 years
- **Auto-Purge System** - Scheduled cleanup of old articles
- **Manual Cleanup Tools** - One-click removal of outdated content
- **Orphaned Article Detection** - Automatic cleanup when sources are removed

### 🎨 **Modern User Experience**
- **Dark Mode by Default** - Professional, eye-friendly interface
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Real-time UI Updates** - Instant feedback and live data updates
- **Intuitive Navigation** - Clean tabbed interface for easy content management
- **Centered Card Layout** - Professional, focused design

## 🚀 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Convex (real-time database and functions)
- **Styling**: Tailwind CSS v4, Custom CSS
- **UI Components**: shadcn/ui
- **Parsing**: Cheerio (HTML), xml2js (RSS/Atom)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Deployment**: Vercel-ready with standalone output

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Setup

1. **Clone the repository**