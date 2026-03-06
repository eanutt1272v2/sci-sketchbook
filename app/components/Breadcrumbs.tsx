'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  breadcrumbs: Breadcrumb[];
}

export function Breadcrumbs({ breadcrumbs }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-6 overflow-x-auto pb-2">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1 whitespace-nowrap">
          {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.name}</span>
          ) : (
            <Link
              href={crumb.path}
              className="text-accent hover:underline transition-colors"
            >
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
