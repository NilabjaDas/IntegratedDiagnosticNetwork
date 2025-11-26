// useOnBack.js
import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * useOnBack(onBack(prevLocation, newLocation), opts)
 * - onBack: called when BACK navigation detected, receives (prevLocation, newLocation)
 * - opts.onForward: called on forward navigation (receives (prevLocation, newLocation))
 */
export default function useOnBack(onBack, opts = {}) {
  const { onForward } = opts;
  const navType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'
  const location = useLocation();

  const idxRef = useRef(null);
  const prevIdxRef = useRef(null);
  const lastLocationRef = useRef(location); // holds previous location
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const SESSION_KEY = "rr_idx_v1";
    let counter = Number(sessionStorage.getItem(SESSION_KEY) || 0);
    counter += 1;
    sessionStorage.setItem(SESSION_KEY, String(counter));

    const initialState = { ...(window.history.state || {}), __rr_idx: counter };
    window.history.replaceState(initialState, document.title, window.location.href);
    idxRef.current = counter;
    prevIdxRef.current = counter;

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;

    window.history.pushState = function (state, title, url) {
      counter += 1;
      sessionStorage.setItem(SESSION_KEY, String(counter));
      const newState = { ...(state || {}), __rr_idx: counter };
      origPush.apply(window.history, [newState, title, url]);
      idxRef.current = counter;
      prevIdxRef.current = counter;
    };

    window.history.replaceState = function (state, title, url) {
      const newState = { ...(state || {}), __rr_idx: counter };
      origReplace.apply(window.history, [newState, title, url]);
      idxRef.current = counter;
    };

    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  useEffect(() => {
    const currentIdx = window.history.state?.__rr_idx;

    // If navigation is normal push/replace, update lastLocationRef to this location (becomes "previous" for next nav)
    if (navType !== "POP") {
      if (typeof currentIdx === "number") {
        prevIdxRef.current = currentIdx;
        idxRef.current = currentIdx;
      }
      // update lastLocationRef to current location for future comparisons
      lastLocationRef.current = location;
      return;
    }

    // navType === 'POP' (user pressed back/forward)
    const prevLocation = lastLocationRef.current; // this is the location *before* the POP
    const newLocation = location;                 // this is the location *after* the POP

    if (typeof currentIdx === "number" && typeof prevIdxRef.current === "number") {
      if (currentIdx < prevIdxRef.current) {
        try { onBack && onBack(prevLocation, newLocation); } catch (e) { console.error(e); }
      } else if (currentIdx > prevIdxRef.current) {
        try { onForward && onForward(prevLocation, newLocation); } catch (e) { console.error(e); }
      }
    } else {
      // Fallback: treat unknown POP as back (you can change this)
      try { onBack && onBack(prevLocation, newLocation); } catch (e) { console.error(e); }
    }

    // update prev index and lastLocationRef for next time
    prevIdxRef.current = typeof currentIdx === "number" ? currentIdx : prevIdxRef.current;
    idxRef.current = prevIdxRef.current;
    lastLocationRef.current = newLocation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, navType, location]);
}
