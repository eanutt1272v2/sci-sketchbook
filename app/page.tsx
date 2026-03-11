import { Suspense } from 'react';
import { FileBrowser } from './components/FileBrowser';
import { Loader2 } from 'lucide-react';

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Loading directory...</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Sci-Sketchbook</h1>
              <p className="text-sm text-muted-foreground">Browse p5.js and Processing sketches</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<LoadingFallback />}>
          <FileBrowser />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              Sci-Sketchbook © 2024 • A modern file browser for creative code
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">About</a>
              <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
