import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './index.css';
import App from './App.tsx';

/*
 * Global ScrollTrigger settings, applied once before any component mounts.
 *
 * `ignoreMobileResize` is the one that earns its place: a mobile browser hiding its
 * toolbar changes the viewport *height* with no layout consequence, and without this
 * ScrollTrigger re-measures all six pinned blocks on `/collections` in response. That
 * refresh is not cheap and it happens mid-scroll, which is exactly when it is felt.
 *
 * `limitCallbacks` coalesces callbacks to one per tick rather than firing for every
 * intermediate scroll value. **Measured honestly: this did not reduce layout work** on
 * `/collections` (2,808 → 2,859 over an identical 60-step traversal, i.e. noise). It is
 * kept because fewer redundant `onUpdate` calls is right on principle and costs nothing,
 * not because it fixed a measured problem. Do not cite it as a performance win.
 *
 * Set here rather than in a component so it cannot be applied twice, and so it is in
 * effect before the first trigger exists — a trigger built under the old settings keeps
 * them.
 *
 * For what the numbers actually say about this page, see `docs/performance.md`.
 */
ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
