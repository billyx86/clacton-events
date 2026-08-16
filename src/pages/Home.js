import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Event from '../components/Event';
import { toEvent, isEventUpcoming, sortEventsByRecency } from '../utils/eventUtils';

const Home = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const eventsCollectionRef = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsCollectionRef);
      const now = new Date();
      const allEvents = eventsSnapshot.docs
        .map(toEvent)
        .filter(event => isEventUpcoming(event.date, now));

      // Heading says "Recently Posted Events" — show the three most recent,
      // not a random shuffle of the collection.
      const selectedEvents = sortEventsByRecency(allEvents).slice(0, 3);

      setEvents(selectedEvents);
    };

    fetchEvents();
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