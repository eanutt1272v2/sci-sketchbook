import React from 'react';
import {
  Folder,
  File,
  FileText,
  FileJson,
  FileCode,
  LucideIcon,
} from 'lucide-react';

interface FileIconProps {
  name: string;
  type: 'file' | 'directory';
  className?: string;
}

export function FileIcon({ name, type, className = 'w-4 h-4' }: FileIconProps) {
  if (type === 'directory') {
    return <Folder className={className} />;
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pde') {
    return <FileCode className={className} />;
  }

  if (ext === 'js') {
    return <FileCode className={className} />;
  }

  if (ext === 'json') {
    return <FileJson className={className} />;
  }

  if (['txt', 'md'].includes(ext)) {
    return <FileText className={className} />;
  }

  return <File className={className} />;
}
