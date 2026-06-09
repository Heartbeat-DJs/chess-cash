import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'vs The House — ChessCash',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
