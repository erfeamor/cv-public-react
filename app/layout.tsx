import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interactive CV',
  description: 'Public résumé, statically rendered and background-revalidated (ISR).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
