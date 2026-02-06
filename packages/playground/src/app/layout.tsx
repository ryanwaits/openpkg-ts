import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenPKG Playground',
  description: 'AI-composable API reference documentation playground',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
