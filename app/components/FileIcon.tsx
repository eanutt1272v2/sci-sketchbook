'use client';

import React from 'react';
import {
  Folder,
  File,
  FileText,
  FileJson,
  FileCode,
  LucideIcon,
  Code2,
  Database,
  Archive,
  Image,
  Music,
  Video,
  FileSpreadsheet,
  FileSliders,
  Terminal,
  Package,
  Zap,
  Cpu,
} from 'lucide-react';

interface FileIconProps {
  name: string;
  type: 'file' | 'directory';
  className?: string;
}

interface IconConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const getFileExtension = (name: string): string => {
  return name.split('.').pop()?.toLowerCase() || '';
};

const iconMap: Record<string, IconConfig> = {
  // Programming Languages - JavaScript/TypeScript
  'js': { icon: FileCode, color: '#F7DF1E', bgColor: 'bg-yellow-50' },
  'mjs': { icon: FileCode, color: '#F7DF1E', bgColor: 'bg-yellow-50' },
  'cjs': { icon: FileCode, color: '#F7DF1E', bgColor: 'bg-yellow-50' },
  'ts': { icon: FileCode, color: '#3178C6', bgColor: 'bg-blue-50' },
  'tsx': { icon: FileCode, color: '#06B6D4', bgColor: 'bg-cyan-50' },
  'jsx': { icon: FileCode, color: '#06B6D4', bgColor: 'bg-cyan-50' },

  // Python
  'py': { icon: FileCode, color: '#3776AB', bgColor: 'bg-blue-50' },
  'pyc': { icon: FileCode, color: '#3776AB', bgColor: 'bg-blue-50' },
  'pyw': { icon: FileCode, color: '#3776AB', bgColor: 'bg-blue-50' },

  // Java
  'java': { icon: FileCode, color: '#F89820', bgColor: 'bg-orange-50' },
  'class': { icon: FileCode, color: '#F89820', bgColor: 'bg-orange-50' },
  'jar': { icon: Archive, color: '#F89820', bgColor: 'bg-orange-50' },

  // C/C++
  'c': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },
  'h': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },
  'cpp': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },
  'cc': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },
  'cxx': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },
  'hpp': { icon: FileCode, color: '#00599C', bgColor: 'bg-blue-50' },

  // C#
  'cs': { icon: FileCode, color: '#239120', bgColor: 'bg-green-50' },

  // Go
  'go': { icon: FileCode, color: '#00ADD8', bgColor: 'bg-cyan-50' },

  // Rust
  'rs': { icon: FileCode, color: '#CE422B', bgColor: 'bg-red-50' },

  // PHP
  'php': { icon: FileCode, color: '#777BB4', bgColor: 'bg-purple-50' },

  // Ruby
  'rb': { icon: FileCode, color: '#CC342D', bgColor: 'bg-red-50' },
  'erb': { icon: FileCode, color: '#CC342D', bgColor: 'bg-red-50' },

  // Swift
  'swift': { icon: FileCode, color: '#FA7343', bgColor: 'bg-orange-50' },

  // Kotlin
  'kt': { icon: FileCode, color: '#7F52FF', bgColor: 'bg-purple-50' },

  // Dart
  'dart': { icon: FileCode, color: '#00D2B8', bgColor: 'bg-teal-50' },

  // Lua
  'lua': { icon: FileCode, color: '#000080', bgColor: 'bg-blue-50' },

  // Perl
  'pl': { icon: FileCode, color: '#39457E', bgColor: 'bg-slate-50' },

  // Processing
  'pde': { icon: Zap, color: '#1E90FF', bgColor: 'bg-blue-50' },

  // Web - HTML/CSS
  'html': { icon: Code2, color: '#E34C26', bgColor: 'bg-red-50' },
  'htm': { icon: Code2, color: '#E34C26', bgColor: 'bg-red-50' },
  'css': { icon: Code2, color: '#563D7C', bgColor: 'bg-purple-50' },
  'scss': { icon: Code2, color: '#C6538C', bgColor: 'bg-pink-50' },
  'sass': { icon: Code2, color: '#C6538C', bgColor: 'bg-pink-50' },
  'less': { icon: Code2, color: '#1D365D', bgColor: 'bg-slate-50' },

  // Data Formats
  'json': { icon: FileJson, color: '#F7DF1E', bgColor: 'bg-yellow-50' },
  'jsonl': { icon: FileJson, color: '#F7DF1E', bgColor: 'bg-yellow-50' },
  'xml': { icon: FileCode, color: '#E34C26', bgColor: 'bg-red-50' },
  'yaml': { icon: FileCode, color: '#CB171E', bgColor: 'bg-red-50' },
  'yml': { icon: FileCode, color: '#CB171E', bgColor: 'bg-red-50' },
  'toml': { icon: FileCode, color: '#9C4221', bgColor: 'bg-amber-50' },
  'ini': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
  'env': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
  'properties': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },

  // Databases
  'sql': { icon: Database, color: '#336791', bgColor: 'bg-blue-50' },
  'db': { icon: Database, color: '#336791', bgColor: 'bg-blue-50' },
  'sqlite': { icon: Database, color: '#003B57', bgColor: 'bg-slate-50' },
  'mongodb': { icon: Database, color: '#13AA52', bgColor: 'bg-green-50' },

  // Shell Scripts
  'sh': { icon: Terminal, color: '#4EAA25', bgColor: 'bg-green-50' },
  'bash': { icon: Terminal, color: '#4EAA25', bgColor: 'bg-green-50' },
  'zsh': { icon: Terminal, color: '#4EAA25', bgColor: 'bg-green-50' },
  'fish': { icon: Terminal, color: '#4EAA25', bgColor: 'bg-green-50' },
  'bat': { icon: Terminal, color: '#6B7280', bgColor: 'bg-gray-50' },
  'cmd': { icon: Terminal, color: '#6B7280', bgColor: 'bg-gray-50' },
  'ps1': { icon: Terminal, color: '#0078D4', bgColor: 'bg-blue-50' },
  'vbs': { icon: Terminal, color: '#6B7280', bgColor: 'bg-gray-50' },

  // Markup & Documentation
  'md': { icon: FileText, color: '#083FA1', bgColor: 'bg-slate-50' },
  'mdx': { icon: FileText, color: '#083FA1', bgColor: 'bg-slate-50' },
  'txt': { icon: FileText, color: '#6B7280', bgColor: 'bg-gray-50' },
  'rtf': { icon: FileText, color: '#6B7280', bgColor: 'bg-gray-50' },
  'nfo': { icon: FileText, color: '#6B7280', bgColor: 'bg-gray-50' },

  // Documents
  'pdf': { icon: FileText, color: '#D40000', bgColor: 'bg-red-50' },
  'doc': { icon: FileText, color: '#2B579A', bgColor: 'bg-blue-50' },
  'docx': { icon: FileText, color: '#2B579A', bgColor: 'bg-blue-50' },
  'dotx': { icon: FileText, color: '#2B579A', bgColor: 'bg-blue-50' },
  'odt': { icon: FileText, color: '#2B579A', bgColor: 'bg-blue-50' },
  'pages': { icon: FileText, color: '#555555', bgColor: 'bg-gray-50' },

  // Spreadsheets
  'xls': { icon: FileSpreadsheet, color: '#217346', bgColor: 'bg-green-50' },
  'xlsx': { icon: FileSpreadsheet, color: '#217346', bgColor: 'bg-green-50' },
  'xlsm': { icon: FileSpreadsheet, color: '#217346', bgColor: 'bg-green-50' },
  'ods': { icon: FileSpreadsheet, color: '#217346', bgColor: 'bg-green-50' },
  'numbers': { icon: FileSpreadsheet, color: '#555555', bgColor: 'bg-gray-50' },
  'csv': { icon: FileSpreadsheet, color: '#217346', bgColor: 'bg-green-50' },

  // Presentations
  'ppt': { icon: FileSliders, color: '#D83B01', bgColor: 'bg-orange-50' },
  'pptx': { icon: FileSliders, color: '#D83B01', bgColor: 'bg-orange-50' },
  'ppsx': { icon: FileSliders, color: '#D83B01', bgColor: 'bg-orange-50' },
  'odp': { icon: FileSliders, color: '#D83B01', bgColor: 'bg-orange-50' },
  'key': { icon: FileSliders, color: '#555555', bgColor: 'bg-gray-50' },

  // Images
  'jpg': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'jpeg': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'png': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'gif': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'webp': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'bmp': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'tiff': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'tif': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'ico': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'heic': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'raw': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'cr2': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'nef': { icon: Image, color: '#A855F7', bgColor: 'bg-purple-50' },
  'psd': { icon: Image, color: '#31C5F0', bgColor: 'bg-cyan-50' },
  'ai': { icon: Image, color: '#FF9A00', bgColor: 'bg-amber-50' },
  'eps': { icon: Image, color: '#FF9A00', bgColor: 'bg-amber-50' },
  'svg': { icon: Image, color: '#FFB13D', bgColor: 'bg-amber-50' },
  'indd': { icon: Image, color: '#FF3366', bgColor: 'bg-red-50' },

  // Video
  'mp4': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'mkv': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'mov': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'avi': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'wmv': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'flv': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'webm': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'm4v': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'mpeg': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  'mpg': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },
  '3gp': { icon: Video, color: '#E50914', bgColor: 'bg-red-50' },

  // Audio
  'mp3': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'wav': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'flac': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'ogg': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'm4a': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'aac': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'wma': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'mid': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'midi': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'aif': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'aiff': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },
  'opus': { icon: Music, color: '#EC407A', bgColor: 'bg-pink-50' },

  // Archives
  'zip': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'rar': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'tar': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'gz': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  '7z': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'bz2': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'xz': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },
  'iso': { icon: Archive, color: '#D97706', bgColor: 'bg-amber-50' },

  // Packages
  'pkg': { icon: Package, color: '#D97706', bgColor: 'bg-amber-50' },
  'deb': { icon: Package, color: '#D97706', bgColor: 'bg-amber-50' },
  'rpm': { icon: Package, color: '#D97706', bgColor: 'bg-amber-50' },
  'exe': { icon: Package, color: '#6B7280', bgColor: 'bg-gray-50' },
  'msi': { icon: Package, color: '#6B7280', bgColor: 'bg-gray-50' },
  'dmg': { icon: Package, color: '#555555', bgColor: 'bg-gray-50' },
  'apk': { icon: Package, color: '#3DDC84', bgColor: 'bg-green-50' },

  // Docker & DevOps
  'dockerfile': { icon: Cpu, color: '#2496ED', bgColor: 'bg-blue-50' },
  'docker': { icon: Cpu, color: '#2496ED', bgColor: 'bg-blue-50' },

  // Graphics & Design
  // 3D & Graphics
  'blend': { icon: Zap, color: '#F5792A', bgColor: 'bg-orange-50' },
  'blender': { icon: Zap, color: '#F5792A', bgColor: 'bg-orange-50' },

  // Shaders
  'glsl': { icon: Code2, color: '#1E90FF', bgColor: 'bg-blue-50' },
  'vert': { icon: Code2, color: '#1E90FF', bgColor: 'bg-blue-50' },
  'frag': { icon: Code2, color: '#1E90FF', bgColor: 'bg-blue-50' },
  'shader': { icon: Code2, color: '#1E90FF', bgColor: 'bg-blue-50' },

  // Fonts
  'ttf': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
  'otf': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
  'woff': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
  'woff2': { icon: FileCode, color: '#6B7280', bgColor: 'bg-gray-50' },
};

export function FileIcon({ name, type, className = 'w-5 h-5' }: FileIconProps) {
  if (type === 'directory') {
    return (
      <div className="flex items-center justify-center">
        <Folder className={`${className} text-blue-600`} />
      </div>
    );
  }

  const ext = getFileExtension(name);
  const config = iconMap[ext];

  if (config) {
    const Icon = config.icon;
    return (
      <div className="flex items-center justify-center">
        <Icon className={`${className} text-gray-700`} style={{ color: config.color }} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <File className={`${className} text-gray-400`} />
    </div>
  );
}
