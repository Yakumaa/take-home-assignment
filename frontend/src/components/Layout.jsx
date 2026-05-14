import React from 'react';
import { Navigation } from './Navigation';

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
