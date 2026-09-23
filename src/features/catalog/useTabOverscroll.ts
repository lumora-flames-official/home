import { useEffect, useRef } from 'react';

/** Options for {@link useTabOverscroll}. */
export interface TabOverscrollOptions {
  /** Fired when the reader pushes past the bottom of the document. */
  onNext: () => void;
  /** Fired when the reader pushes past the top of the document. */
  onPrevious: () => void;
  /** Detach the listeners entirely — e.g. when there is nothing to page to. */
  enabled: boolean;
}

/** Slack on the edge test, absorbing sub-pixel scroll heights and zoom rounding. */
const EDGE_TOLERANCE_PX = 2;

/** Accumulated over-scroll needed to commit a tab change. Roughly one short flick. */
const INTENT_THRESHOLD_PX = 150;

/** Idle time that ends a gesture, so two separate flicks don't add up. */
const GESTURE_GAP_MS = 320;

/**
 * Idle time required to re-arm after a commit.
 *
 * This is the guard that stops one flick from cascading through every tab: trackpad
 * and touch inertia keep firing events for up to a second after the finger lifts, and
 * all of them arrive at the new tab's edge pointing the same way. Requiring the input
 * stream to fall silent is the only test that reliably separates a fresh gesture from
 * the tail of the one that already counted; a fixed cooldown cannot, because inertia
 * outlasts any duration short enough to feel responsive.
 */
const REARM_QUIET_MS = 260;

/** Lines and pages to pixels, so a mouse wheel and a trackpad accumulate alike. */
const normaliseWheelDelta = (event: WheelEvent): number => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
  return event.deltaY;
};

/**
 * Turns over-scroll at either end of the document into a tab change.
 *
 * The catalog renders one collection at a time, so reaching the bottom of a list is
 * the end of a page rather than the end of the catalog. This makes the continuation
 * feel like scrolling: keep pushing down and the next collection opens, keep pushing
 * up and the previous one returns.
 *
 * ## Why intent is accumulated instead of read from the scroll position
 *
 * The obvious implementation — "if `scrollY + innerHeight >= scrollHeight`, advance" —
 * breaks in two ways that have no fix at that level. A collection short enough to fit
 * the viewport is *simultaneously* at the top and the bottom, so it would advance the
 * instant it opened and keep going; and even on a long list, the position is still at
 * the edge on the frame after a commit, so the transition fires repeatedly. Measuring
 * the reader's input past a stationary edge answers a different and correct question:
 * not "where is the page" but "is someone still trying to go further".
 *
 * Deliberately *not* GSAP: this is input interpretation, not animation. Nothing here
 * tweens, so there is nothing for `useGSAP` to scope or clean up, and the resulting
 * scroll jump is instant in every motion mode.
 *
 * Keyboard and assistive-technology users get no gesture to accumulate, which is why
 * the page also renders explicit previous/next controls at the foot of each list.
 * Those are the accessible path; this is the shortcut.
 */
export const useTabOverscroll = ({ onNext, onPrevious, enabled }: TabOverscrollOptions): void => {
  /**
   * Latest callbacks, read at event time.
   *
   * Held in a ref so the listeners are attached once per `enabled` change rather than
   * on every render — re-subscribing mid-gesture would drop the accumulator and make
   * the threshold unreachable on a slow, steady scroll.
   */
  const handlers = useRef({ onNext, onPrevious });

  // Written in an effect, not during render: refs are commit-time state. The listeners
  // cannot fire before this has run, since input is only delivered to a painted frame.
  useEffect(() => {
    handlers.current = { onNext, onPrevious };
  }, [onNext, onPrevious]);

  useEffect(() => {
    if (!enabled) return;

    /** Signed over-scroll banked for the current gesture; positive is downward. */
    let intent = 0;
    /** Timestamp of the last input event, for both gesture and re-arm gaps. */
    let lastEventAt = 0;
    /** Whether a commit is awaiting a quiet input stream before re-arming. */
    let locked = false;
    /** Previous touch Y, so a drag yields the same signed delta a wheel does. */
    let touchY: number | null = null;

    const atTop = (): boolean => window.scrollY <= EDGE_TOLERANCE_PX;

    const atBottom = (): boolean =>
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - EDGE_TOLERANCE_PX;

    const onDelta = (delta: number): void => {
      if (delta === 0) return;

      const now = performance.now();
      const sinceLast = now - lastEventAt;
      lastEventAt = now;

      if (locked) {
        // Still inside the inertial tail of the gesture that already committed.
        if (sinceLast < REARM_QUIET_MS) return;
        locked = false;
      }

      // A pause, or a reversal, starts the measurement over. Without the reversal
      // test, rocking back and forth against the edge would bank both directions.
      if (sinceLast > GESTURE_GAP_MS || Math.sign(delta) !== Math.sign(intent)) intent = 0;

      // Only movement *against a stationary edge* counts. Mid-list scrolling has
      // somewhere to go, so it is not an attempt to leave the collection.
      const pushing = delta > 0 ? atBottom() : atTop();
      if (!pushing) {
        intent = 0;
        return;
      }

      intent += delta;
      if (Math.abs(intent) < INTENT_THRESHOLD_PX) return;

      const commit = intent > 0 ? handlers.current.onNext : handlers.current.onPrevious;
      intent = 0;
      locked = true;
      commit();
    };

    const onWheel = (event: WheelEvent): void => onDelta(normaliseWheelDelta(event));

    const onTouchStart = (event: TouchEvent): void => {
      touchY = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent): void => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      // Dragging the content up means scrolling down, hence the inverted sign.
      onDelta(touchY - y);
      touchY = y;
    };

    const onTouchEnd = (): void => {
      touchY = null;
    };

    /*
     * Passive throughout: nothing here calls `preventDefault`, and declaring that up
     * front keeps the browser's scrolling off the main thread. The page still rubber-
     * bands or bounces at the edge as the platform intends — the gesture is observed,
     * never hijacked.
     */
    const options: AddEventListenerOptions = { passive: true };

    window.addEventListener('wheel', onWheel, options);
    window.addEventListener('touchstart', onTouchStart, options);
    window.addEventListener('touchmove', onTouchMove, options);
    window.addEventListener('touchend', onTouchEnd, options);
    window.addEventListener('touchcancel', onTouchEnd, options);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled]);
};
