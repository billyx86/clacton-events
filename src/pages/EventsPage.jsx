// EventsPage.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Event from '../components/Event';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  EVENT_PAGE_SIZE,
  filterEventsByQuery,
  isEventUpcoming,
  toEvent,
} from '../utils/eventUtils';
import { SEARCH_PAGE_SIZE, tokenizeSearchQuery } from '../utils/searchTokens';

// #26: search keystrokes are debounced before they hit the server —
// every keystroke would otherwise fan out a Firestore query.
const SEARCH_DEBOUNCE_MS = 300;

// Millisecond value of a Firestore date field (a Timestamp, a
// { seconds } object, or a plain Date). Undated or invalid events sort
// to the end of the soonest-first search ordering instead of to the
// front as 1970.
const eventDateMillis = (date) => {
    if (!date) return Infinity;
    if (typeof date.toDate === 'function') return date.toDate().getTime();
    if (typeof date.seconds === 'number') return date.seconds * 1000;
    const t = new Date(date).getTime();
    return Number.isNaN(t) ? Infinity : t;
};

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    // #27: the listing defaults to "upcoming only". The date constraint is
    // applied server-side — where('date', '>=', now) on the *same* field as
    // the orderBy needs no composite index. The toggle re-queries with no
    // date constraint (newest-posted first) so past events become visible.
    const [showPast, setShowPast] = useState(false);
    // #26: server-side search over the denormalised `searchIndex` field
    // (array-contains-any, see utils/searchTokens). searchResults === null
    // means "no server search has completed yet"; searchFallback === true
    // means the index query failed (a transient Firestore error — the
    // query itself is single-field and needs no composite index) and we
    // degrade to client-side filtering of the loaded window, with the
    // honest scope hint from #22.
    const [searchResults, setSearchResults] = useState(null);
    const [searchFallback, setSearchFallback] = useState(false);
    const [searchPending, setSearchPending] = useState(false);
    // Cursor pagination state (issue #7 — the page used to pull the whole
    // collection on every visit). The cursor value follows the active
    // view's sort field: upcoming → the last event's `date` (Timestamp);
    // past → the last `createdOn`.
    const [lastCursor, setLastCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchError, setFetchError] = useState(false);
    const navigate = useNavigate();

    // Memoised so the search effect's dependency array stays stable for a
    // given query string (a fresh array on every render would re-trigger
    // the effect, and thus the query, on every render).
    const tokens = useMemo(() => tokenizeSearchQuery(searchQuery), [searchQuery]);
    const inSearchMode = tokens.length > 0;

    const buildListQuery = useCallback((cursor) => {
        const constraints = [];
        if (showPast) {
            // No date constraint: everything, newest-posted first (the
            // pre-#27 behaviour, now opt-in via the toggle).
            constraints.push(orderBy('createdOn', 'desc'));
        } else {
            // Same field as the where clause → no composite index needed.
            // Ascending so the soonest event is at the top of the listing.
            constraints.push(
                where('date', '>=', Timestamp.now()),
                orderBy('date', 'asc')
            );
        }
        constraints.push(limit(EVENT_PAGE_SIZE));
        if (cursor != null) {
            constraints.splice(constraints.length - 1, 0, startAfter(cursor));
        }
        return query(collection(db, 'events'), ...constraints);
    }, [showPast]);

    // #26: the search is a single-field query — array-contains-any on
    // the denormalised `searchIndex`, bounded by a limit. It deliberately
    // carries no orderBy and no where on another field: any such
    // combination would require a composite index in Firestore, which
    // this app keeps out of its dependencies. Scoping the hit set to the
    // active view (upcoming vs. past) and soonest-first ordering are
    // applied client-side instead — over at most SEARCH_PAGE_SIZE docs,
    // which is trivial to filter and sort in JS.
    const buildSearchQuery = useCallback(() => {
        return query(
            collection(db, 'events'),
            where('searchIndex', 'array-contains-any', tokens),
            limit(SEARCH_PAGE_SIZE),
        );
    }, [tokens]);

    const applySnapshot = (snapshot) => {
        const docs = snapshot.docs;
        setEvents(docs.map(toEvent));
        const last = docs[docs.length - 1] ?? null;
        // Cursor key follows the view's sort field (see buildListQuery).
        setLastCursor(last ? (showPast ? last.data().createdOn : last.data().date) : null);
        setHasMore(docs.length === EVENT_PAGE_SIZE);
    };

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || lastCursor == null) return;
        setLoadingMore(true);
        try {
            const snapshot = await getDocs(buildListQuery(lastCursor));
            setEvents((prev) => [...prev, ...snapshot.docs.map(toEvent)]);
            const last = snapshot.docs[snapshot.docs.length - 1];
            if (last) {
                setLastCursor(showPast ? last.data().createdOn : last.data().date);
            }
            setHasMore(snapshot.docs.length === EVENT_PAGE_SIZE);
        } catch (error) {
            console.error('Error loading more events:', error);
            setFetchError(true);
        } finally {
            setLoadingMore(false);
        }
    }, [buildListQuery, hasMore, lastCursor, loadingMore, showPast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user || null);
        });

        let cancelled = false;
        const init = async () => {
            const snapshot = await getDocs(buildListQuery(null));
            if (cancelled) return;
            applySnapshot(snapshot);
        };

        init().catch((error) => {
            console.error('Error fetching events:', error);
            if (!cancelled) setFetchError(true);
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [buildListQuery]);

    // #26: run the debounced server-side search whenever the (memoised)
    // token list or the active view changes; reset search state when the
    // query clears.
    useEffect(() => {
        if (!inSearchMode) {
            setSearchResults(null);
            setSearchFallback(false);
            setSearchPending(false);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearchPending(true);
            try {
                const snapshot = await getDocs(buildSearchQuery());
                if (cancelled) return;
                setSearchResults(snapshot.docs.map(toEvent));
                setSearchFallback(false);
            } catch (error) {
                // Transient Firestore failure — degrade to client-side
                // filtering of the loaded window instead of failing the
                // search for every keystroke. (The query is single-field,
                // so no composite index is involved.)
                console.error('Server-side search failed, falling back:', error);
                if (!cancelled) setSearchFallback(true);
            } finally {
                if (!cancelled) setSearchPending(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [inSearchMode, buildSearchQuery]);

    // Exposed so a retry button can refetch page one.
    const handleSearchInput = (event) => {
        setSearchQuery(event.target.value);
    };

    // What actually renders. In search mode the server hit set (or,
    // while falling back, the client-side filter over the loaded window)
    // decides; otherwise the paginated listing. The index query itself
    // carries no date constraint (index-free — see buildSearchQuery), so
    // in the upcoming view the hit set is scoped to date >= now and
    // ordered soonest-first client-side; in the past view the scope
    // simply drops and the same sort applies.
    let displayedEvents;
    if (inSearchMode) {
        if (searchFallback) {
            displayedEvents = filterEventsByQuery(events, searchQuery);
        } else {
            const now = new Date();
            displayedEvents = (searchResults ?? [])
                .filter((event) => showPast || isEventUpcoming(event.date, now))
                .sort((a, b) => eventDateMillis(a.date) - eventDateMillis(b.date));
        }
    } else {
        displayedEvents = events;
    }

    return (
        <main>
            <div className="search-wrapper">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search events…"
                        aria-label="Search events"
                        onChange={handleSearchInput}
                    />
                    {inSearchMode && searchFallback && (
                        <p className="search-scope-hint" data-testid="search-scope-hint">
                            Filters the events loaded so far — use Load more to search further back.
                        </p>
                    )}
                    {inSearchMode && searchPending && searchResults === null && (
                        <p className="search-scope-hint" data-testid="search-pending">
                            Searching…
                        </p>
                    )}
                </div>
            </div>

            <div className="le-button-wrapper">
                <label className="past-toggle" data-testid="show-past-toggle">
                    <input
                        type="checkbox"
                        checked={showPast}
                        onChange={(event) => setShowPast(event.target.checked)}
                    />
                    Show past events
                </label>
                {inSearchMode && (
                    <button
                        type="button"
                        className="list-event-button"
                        onClick={() => setSearchQuery('')}
                    >
                        Clear search
                    </button>
                )}
            </div>

            {user ? (
            <div className="le-button-wrapper">
              <button onClick={() => navigate('/list-event')} className="list-event-button">List Event</button>
            </div>
            ) : (
              <div className="le-button-wrapper">
                <h2>Log in to post an event.</h2>
              </div>
            )}

            {fetchError && (
              <p role="alert" style={{ color: '#c62828' }}>
                Something went wrong loading events. Please refresh.
              </p>
            )}

            <div className="main-wrapper">
                <div className="main-container">
                    {displayedEvents.map(filteredEvent => (
                        <Event 
                            key={filteredEvent.id} 
                            id={filteredEvent.id} 
                            title={filteredEvent.content} 
                            description={filteredEvent.shortDescription} 
                            imageUrl={filteredEvent.imageUrl} 
                            location={filteredEvent.location}
                            date={filteredEvent.date}
                        />
                    ))}
                    {(!inSearchMode || searchFallback) && hasMore && (
                        <div className="le-button-wrapper">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="list-event-button"
                            >
                                {loadingMore ? 'Loading…' : 'Load more events'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default EventsPage;
