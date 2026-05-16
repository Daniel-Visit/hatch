'use client';

import { useEffect } from 'react';

export function useUnreadTitle(unreadCount: number, baseTitle = 'Hatch'): void {
  useEffect(() => {
    const original = document.title;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
    return () => {
      document.title = original;
    };
  }, [unreadCount, baseTitle]);
}
