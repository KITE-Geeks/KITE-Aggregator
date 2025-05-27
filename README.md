# KITE Aggregator

A modern, intelligent content aggregation platform with client-side authentication, built with Next.js, Convex, and TypeScript.

## ✨ Features

- **Client-Side Authentication**: Secure login system with password protection
- **Static Site Generation**: Optimized for GitHub Pages deployment
- **Responsive Design**: Works on all device sizes
- **Modern UI**: Built with Tailwind CSS and Shadcn UI components
- **Real-time Updates**: Powered by Convex backend

## 🚀 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Shadcn UI
- **Icons**: Lucide Icons
- **Backend**: Convex (database & serverless functions)
- **Animations**: Framer Motion
- **Deployment**: GitHub Pages

## 🛠️ Setup

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/KITE-Aggregator.git
   cd KITE-Aggregator
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with your configuration.

4. Start the development server
   ```bash
   pnpm dev
   ```

5. (Optional) Start Convex development server
   ```bash
   npx convex dev
   ```

## 🔒 Authentication

This application uses client-side authentication with the following default credentials:

- **Password**: The password is set in your `.env.local` file as `ADMIN_PASSWORD`

To change the password, update the `ADMIN_PASSWORD` in your `.env.local` file.

## 🚀 Deploying to GitHub Pages

1. Push your code to a GitHub repository
2. Go to the repository Settings > Pages
3. Configure GitHub Pages:
   - Source: GitHub Actions
   - Branch: main/master
4. The GitHub Actions workflow will automatically deploy your site to `https://[your-username].github.io/KITE-Aggregator/`

## 🌐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Client-side authentication
ADMIN_PASSWORD=your_secure_password_here

# Environment (development, production)
NODE_ENV=development

# GitHub Pages deployment
GITHUB_ACTIONS=false
NEXT_PUBLIC_BASE_PATH=
```

## 📂 Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # Reusable UI components
├── contexts/            # React context providers
└── lib/                 # Utility functions and configurations
```

## 📝 Notes

- This application uses static site generation for GitHub Pages compatibility
- Authentication is handled client-side using localStorage
- For production use, consider implementing a more secure authentication method
- The application is configured to work with GitHub Pages base path (`/KITE-Aggregator`)
- Running the Convex development server is recommended during development for full backend functionality

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