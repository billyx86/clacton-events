// EventsPage.js
import React, { useCallback, useEffect, useState } from 'react';
import Event from '../components/Event';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
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

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    // Cursor pagination state (issue #7 — the page used to pull the whole
    // collection on every visit).
    const [lastSnapshot, setLastSnapshot] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchError, setFetchError] = useState(false);
    const navigate = useNavigate();

    // Newest-first on the server; the client only filters what it already
    // has. Past events can only appear in the *loaded* window (the form
    // requires future dates, so the collection is mostly upcoming).
    //
    // #22: the UI copy now states that scope honestly ("Filter loaded
    // events…" + the hint line) instead of the old "Search events..."
    // placeholder that implied collection-wide search. The filtering logic
    // itself is unchanged — it already covers the full *loaded* set; making
    // it truly collection-wide needs a server-side search path (no native
    // full-text search in Firestore), which is deliberately out of scope.
    const buildQuery = useCallback((cursor) => {
        const constraints = [
            orderBy('createdOn', 'desc'),
            limit(EVENT_PAGE_SIZE),
        ];
        if (cursor) {
            constraints.splice(1, 0, startAfter(cursor));
        }
        return query(collection(db, 'events'), ...constraints);
    }, []);

    const applySnapshot = (snapshot) => {
        setEvents(snapshot.docs.map(toEvent));
        setLastSnapshot(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === EVENT_PAGE_SIZE);
    };

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !lastSnapshot) return;
        setLoadingMore(true);
        try {
            const snapshot = await getDocs(buildQuery(lastSnapshot));
            setEvents((prev) => [...prev, ...snapshot.docs.map(toEvent)]);
            setLastSnapshot(snapshot.docs[snapshot.docs.length - 1] ?? lastSnapshot);
            setHasMore(snapshot.docs.length === EVENT_PAGE_SIZE);
        } catch (error) {
            console.error('Error loading more events:', error);
            setFetchError(true);
        } finally {
            setLoadingMore(false);
        }
    }, [buildQuery, hasMore, lastSnapshot, loadingMore]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user || null);
        });

        let cancelled = false;
        const init = async () => {
            const snapshot = await getDocs(buildQuery(null));
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
    }, [buildQuery]);

    // Exposed so a retry button can refetch page one.
    const handleSearchInput = (event) => {
        setSearchQuery(event.target.value);
    };

    const now = new Date();
    const filteredEvents = filterEventsByQuery(
        events.filter((event) => isEventUpcoming(event.date, now)),
        searchQuery
    );

    return (
        <main>
            <div className="search-wrapper">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Filter loaded events…"
                        aria-label="Filter loaded events"
                        onChange={handleSearchInput}
                    />
                    <p className="search-scope-hint" data-testid="search-scope-hint">
                        Filters the events loaded so far — use Load more to search further back.
                    </p>
                </div>
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
                    {filteredEvents.map(filteredEvent => (
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
                    {hasMore && (
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
