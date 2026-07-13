import type { Metadata } from 'next';
import { config } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: config.appTitle,
  description: 'Hasil sementara pemilihan penatua dan diaken per kolom',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
