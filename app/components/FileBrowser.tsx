'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { FileTable } from './FileTable';
import { AlertCircle, Loader2 } from 'lucide-react';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  detailedType: string;
}

interface DirectoryListing {
  items: FileItem[];
  path: string;
  breadcrumbs: Array<{ name: string; path: string }>;
}

export function FileBrowser() {
  const searchParams = useSearchParams();
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPath = searchParams.get('path') || '/';

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch directory listing');
        }

        const data = await response.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [currentPath]);

  return (
    <>
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading directory...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">Error</h3>
            <p className="text-sm text-destructive/90">{error}</p>
          </div>
        </div>
      )}

      {listing && !loading && (
        <>
          {listing.breadcrumbs && <Breadcrumbs breadcrumbs={listing.breadcrumbs} />}
          <FileTable items={listing.items} currentPath={currentPath} />
        </>
      )}
    </>
  );
}
