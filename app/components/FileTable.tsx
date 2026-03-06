'use client';

import React, { useState, useMemo } from 'react';
import { FileIcon } from './FileIcon';
import { ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  detailedType: string;
}

interface FileTableProps {
  items: FileItem[];
  currentPath: string;
}

type SortKey = 'name' | 'type' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';

export function FileTable({ items, currentPath }: FileTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type':
          aVal = a.detailedType.toLowerCase();
          bVal = b.detailedType.toLowerCase();
          break;
        case 'size':
          aVal = a.size;
          bVal = b.size;
          break;
        case 'modified':
          aVal = new Date(a.modified).getTime();
          bVal = new Date(b.modified).getTime();
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, sortKey, sortOrder]);

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <button
      onClick={() => handleSort(sortBy)}
      className="flex items-center gap-2 hover:text-accent transition-colors"
    >
      {label}
      {sortKey === sortBy && (
        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              <SortHeader label="Name" sortBy="name" />
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground hidden sm:table-cell">
              <SortHeader label="Type" sortBy="type" />
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground hidden md:table-cell">
              <SortHeader label="Size" sortBy="size" />
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground hidden lg:table-cell">
              <SortHeader label="Modified" sortBy="modified" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map(item => (
            <tr
              key={item.name}
              className="border-b border-border hover:bg-muted/50 transition-colors"
            >
              <td className="px-4 py-3">
                {item.type === 'directory' ? (
                  <Link
                    href={`/?path=${encodeURIComponent(
                      currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
                    )}`}
                    className="flex items-center gap-2 text-accent hover:underline"
                  >
                    <FileIcon name={item.name} type="directory" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <FileIcon name={item.name} type="file" />
                    <span>{item.name}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                {item.detailedType}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                {item.type === 'directory' ? `${item.size} items` : formatBytes(item.size)}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                {new Date(item.modified).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedItems.length === 0 && (
        <div className="px-4 py-8 text-center text-muted-foreground">
          No files or folders found
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
