'use client';

import React, { useState, useMemo } from 'react';
import { FileIcon } from './FileIcon';
import { ChevronUp, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
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

interface ColumnVisibility {
  name: boolean;
  type: boolean;
  size: boolean;
  modified: boolean;
}

export function FileTable({ items, currentPath }: FileTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    name: true,
    type: true,
    size: true,
    modified: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const toggleColumnVisibility = (column: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
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
  }, [filteredItems, sortKey, sortOrder]);

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <button
      onClick={() => handleSort(sortBy)}
      className="flex items-center gap-2 hover:text-accent transition-colors font-semibold"
    >
      {label}
      {sortKey === sortBy && (
        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );

  const getFilePath = (item: FileItem): string => {
    if (currentPath === '/') {
      return `/${item.name}`;
    }
    return `${currentPath}/${item.name}`;
  };

  return (
    <>
      {/* Search and Column Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground"
          >
            <Eye className="w-4 h-4" />
            Columns
          </button>

          {showColumnMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-40">
              <div className="p-2 space-y-2">
                {(['name', 'type', 'size', 'modified'] as const).map(column => (
                  <button
                    key={column}
                    onClick={() => toggleColumnVisibility(column)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors text-sm text-left text-foreground"
                  >
                    {columnVisibility[column] ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="capitalize">{column}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columnVisibility.name && (
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <SortHeader label="Name" sortBy="name" />
                </th>
              )}
              {columnVisibility.type && (
                <th className="px-4 py-3 text-left font-semibold text-foreground hidden sm:table-cell">
                  <SortHeader label="Type" sortBy="type" />
                </th>
              )}
              {columnVisibility.size && (
                <th className="px-4 py-3 text-right font-semibold text-foreground hidden md:table-cell">
                  <SortHeader label="Size" sortBy="size" />
                </th>
              )}
              {columnVisibility.modified && (
                <th className="px-4 py-3 text-left font-semibold text-foreground hidden lg:table-cell">
                  <SortHeader label="Modified" sortBy="modified" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(item => (
              <tr
                key={item.name}
                className="border-b border-border hover:bg-muted/50 transition-colors"
              >
                {columnVisibility.name && (
                  <td className="px-4 py-3">
                    {item.type === 'directory' ? (
                      <Link
                        href={`/?path=${encodeURIComponent(getFilePath(item))}`}
                        className="flex items-center gap-2 text-accent hover:underline group"
                      >
                        <FileIcon name={item.name} type="directory" className="w-5 h-5" />
                        <span className="font-medium group-hover:text-accent/80">{item.name}</span>
                      </Link>
                    ) : (
                      <Link
                        href={getFilePath(item)}
                        className="flex items-center gap-2 text-accent hover:underline group"
                      >
                        <FileIcon name={item.name} type="file" className="w-5 h-5" />
                        <span className="font-medium group-hover:text-accent/80">{item.name}</span>
                      </Link>
                    )}
                  </td>
                )}
                {columnVisibility.type && (
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {item.detailedType}
                  </td>
                )}
                {columnVisibility.size && (
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {item.type === 'directory' ? `${item.size} items` : formatBytes(item.size)}
                  </td>
                )}
                {columnVisibility.modified && (
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                    {new Date(item.modified).toLocaleString()}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sortedItems.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground">
            {searchQuery ? 'No files matching your search' : 'No files or folders found'}
          </div>
        )}
      </div>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
