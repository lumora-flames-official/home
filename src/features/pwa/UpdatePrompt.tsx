import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../theme/designSystem';

/**
 * Renders a small bottom banner when the service worker has a new version ready.
 *
 * Uses the `prompt` update strategy: the new SW waits in `waiting` state until the
 * user taps "Update", then reloads the page with the fresh version. The alternative
 * — auto-updating — can swap the app out from under a customer mid-enquiry, which
 * is worse than stale assets by a fair margin.
 *
 * Returns `null` when no update is pending, so it contributes nothing to the normal
 * render path.
 */
export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-1/2 z-50 -translate-x-1/2',
        'flex items-center gap-3 rounded-full px-5 py-3 shadow-xl',
        'bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900'
      )}
    >
      <span className="whitespace-nowrap text-sm font-light">New version available</span>

      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className={cn(
          'rounded-full bg-amber-500 px-4 py-1.5 text-stone-950 transition-colors hover:bg-amber-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 dark:focus-visible:ring-offset-stone-100',
          DESIGN_TOKENS.typography.button
        )}
      >
        Update
      </button>

      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notification"
        className="text-stone-400 transition-colors hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded dark:text-stone-500 dark:hover:text-stone-800"
      >
        ✕
      </button>
    </div>
  );
};
