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
  Timestamp,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  EVENT_PAGE_SIZE,
  filterEventsByQuery,
  toEvent,
} from '../utils/eventUtils';

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    // #27: the listing defaults to "upcoming only". The date constraint is
    // applied server-side — where('date', '>=', now) on the *same* field as
    // the orderBy needs no composite index. The toggle re-queries with no
    // date constraint (newest-posted first) so past events become visible.
    const [showPast, setShowPast] = useState(false);
    // Cursor pagination state (issue #7 — the page used to pull the whole
    // collection on every visit). The cursor value follows the active
    // view's sort field: upcoming → the last event's `date` (Timestamp);
    // past → the last `createdOn`.
    const [lastCursor, setLastCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchError, setFetchError] = useState(false);
    const navigate = useNavigate();

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

    // Exposed so a retry button can refetch page one.
    const handleSearchInput = (event) => {
        setSearchQuery(event.target.value);
    };

    // Client-side filter over the loaded window (the #22 contract). The
    // pre-#27 `isEventUpcoming` client filter is gone: in the upcoming
    // view the server already guarantees date >= now, and in the past
    // view we deliberately want past events.
    const filteredEvents = filterEventsByQuery(events, searchQuery);

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

            <div className="le-button-wrapper">
                <label className="past-toggle" data-testid="show-past-toggle">
                    <input
                        type="checkbox"
                        checked={showPast}
                        onChange={(event) => setShowPast(event.target.checked)}
                    />
                    Show past events
                </label>
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
