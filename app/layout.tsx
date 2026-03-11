import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sci-Sketchbook | p5.js & Processing Sketches',
  description: 'Browse and explore a collection of p5.js and Processing sketch files with a modern, responsive interface.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex flex-col min-h-screen">
        <div className="flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
