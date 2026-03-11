'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';

interface FileViewerProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function FileViewer({ filePath, fileName, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchFileContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch file content');
        }

        const data = await response.json();
        setContent(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchFileContent();
  }, [filePath]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', fileName);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground truncate">{fileName}</h3>
            <p className="text-xs text-muted-foreground truncate">{filePath}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-muted rounded transition-colors"
              title="Copy content"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-muted rounded transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading file content...
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-destructive bg-destructive/10">
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words text-foreground bg-muted/30">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
