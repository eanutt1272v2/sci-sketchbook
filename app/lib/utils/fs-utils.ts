import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const HIDDEN_FILES = new Set([
  'server.js',
  'next-env.d.ts',
  'app',
  'favicon.ico',
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.env',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'next.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
]);

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  detailedType: string;
}

export interface DirectoryListing {
  items: FileItem[];
  path: string;
  breadcrumbs: Array<{ name: string; path: string }>;
}

export function resolveSafePath(requestPath: string): string {
  // Handle root path
  if (requestPath === '/' || requestPath === '') {
    return ROOT_DIR;
  }

  // Remove leading slash for proper path joining
  const cleanPath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  const normalized = path.normalize(cleanPath);
  const resolved = path.resolve(ROOT_DIR, normalized);

  // Ensure the resolved path is within ROOT_DIR
  const relativePath = path.relative(ROOT_DIR, resolved);
  if (relativePath.startsWith('..')) {
    throw new Error('Path traversal attempt detected');
  }

  return resolved;
}

export function isHidden(name: string): boolean {
  return name.startsWith('.') || HIDDEN_FILES.has(name.toLowerCase());
}

export function getDetailedType(name: string, isDir: boolean): string {
  if (isDir) return 'Folder';

  const ext = path.extname(name).toLowerCase();
  const typeMap: Record<string, string> = {
    '.pde': 'Processing Sketch',
    '.js': 'JavaScript',
    '.json': 'JSON Data',
    '.txt': 'Text File',
    '.md': 'Markdown',
  };

  return typeMap[ext] || (ext ? ext.slice(1).toUpperCase() + ' File' : 'File');
}

export function formatBytes(bytes: number): string {
  if (bytes === -1) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function listDirectory(dirPath: string): DirectoryListing {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const baseDir = ROOT_DIR;
    const relativePath = path.relative(baseDir, dirPath);

    const visibleItems = items.filter(item => !isHidden(item.name));

    const fileItems: FileItem[] = visibleItems.map(item => {
      const fullPath = path.join(dirPath, item.name);
      let size = 0;

      if (item.isDirectory()) {
        try {
          size = fs.readdirSync(fullPath).length;
        } catch {
          size = 0;
        }
      } else {
        try {
          size = fs.statSync(fullPath).size;
        } catch {
          size = 0;
        }
      }

      const stats = fs.statSync(fullPath);

      return {
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        size,
        modified: stats.mtime.toLocaleString(),
        detailedType: getDetailedType(item.name, item.isDirectory()),
        isNew: false,
      };
    });

    const breadcrumbs = [{ name: 'root', path: '/' }];
    if (relativePath && relativePath !== '.') {
      const parts = relativePath.split(path.sep);
      let currentPath = '';
      parts.forEach(part => {
        currentPath = path.join(currentPath, part);
        breadcrumbs.push({
          name: part,
          path: `/?path=${encodeURIComponent(currentPath)}`,
        });
      });
    }

    return {
      items: fileItems,
      path: relativePath || '/',
      breadcrumbs,
    };
  } catch (error) {
    throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
