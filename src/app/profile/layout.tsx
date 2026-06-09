import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Profile — ChessCash',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
