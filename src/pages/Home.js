import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import Event from '../components/Event';
import { toEvent, isEventUpcoming } from '../utils/eventUtils';

const RECENT_COUNT = 3;

const Home = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
      try {
        // Server-side: most recently created events only. Before this was
        // added, the page pulled the *entire* events collection into the
        // browser for three cards (issue #7). Documents without `createdOn`
        // (very old events) sort last in Firestore, which is fine — the
        // heading is "Recently Posted Events".
        const recentQuery = query(
          collection(db, 'events'),
          orderBy('createdOn', 'desc'),
          limit(RECENT_COUNT)
        );
        const eventsSnapshot = await getDocs(recentQuery);
        const now = new Date();
        const recent = eventsSnapshot.docs
          .map(toEvent)
          .filter((event) => isEventUpcoming(event.date, now));

        if (cancelled) return;
        setEvents(recent);
      } catch (error) {
        console.error('Error fetching recent events:', error);
      }
    };

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return(
    <main>
      <div className="main-wrapper">
        <h1>Welcome to Clacton Events!</h1>
        <div className="trending-events">
        <h2>Recently Posted Events</h2>
        <div className="home-events-container">
            {events.map(event => (
              <div className="home-event" key={event.id}>
                <Event 
                  key={event.id} 
                  id={event.id} 
                  title={event.content}
                  description={event.shortDescription} 
                  imageUrl={event.imageUrl}
                  location={event.location}
                  date={event.date}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export default Home;
