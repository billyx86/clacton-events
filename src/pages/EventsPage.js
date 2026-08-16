// EventsPage.js
import React, { useEffect, useState } from 'react';
import Event from '../components/Event';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { toEvent, isEventUpcoming, filterEventsByQuery, sortEventsByRecency } from '../utils/eventUtils';

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user || null);
      });

      const fetchEvents = async () => {
          const eventsCollectionRef = collection(db, "events");
          const eventsSnapshot = await getDocs(eventsCollectionRef);
          const now = new Date();
          // toEvent() makes the document ID the canonical id; the list is
          // sorted newest-first (createdOn, then legacy counter).
          const eventsList = sortEventsByRecency(
            eventsSnapshot.docs
              .map(toEvent)
              .filter(event => isEventUpcoming(event.date, now)) // Filter out past events
          );

          setEvents(eventsList);
      };

      fetchEvents();

      return unsubscribe;
    }, []);

    function handleSearchInput(event) {
        setSearchQuery(event.target.value);
    }

    const filteredEvents = filterEventsByQuery(events, searchQuery);

    return (
        <main>
            <div className="search-wrapper">
                <div className="search-container">
                    <input type="text" placeholder="Search events..." onChange={handleSearchInput}/>
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
                </div>
            </div>
        </main>
    );
}

export default EventsPage;