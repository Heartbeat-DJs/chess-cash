import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Club — ChessCash',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
