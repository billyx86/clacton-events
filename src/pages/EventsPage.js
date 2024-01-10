// EventsPage.js
import React, { useEffect, useState } from "react";
import Event from '../components/Event';
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from 'react-router-dom';

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            setUser(user);
        } else {
            setUser(null);
        }
      });

      const fetchEvents = async () => {
          const eventsCollectionRef = collection(db, "events");
          const eventsSnapshot = await getDocs(eventsCollectionRef);
          const now = new Date();
          const eventsList = eventsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(event => event.date && event.date.toDate() > now) // Filter out past events
            .sort((a, b) => b.id - a.id); // Sort events (adjust sorting as needed)

          setEvents(eventsList);
      };

      fetchEvents();

      return unsubscribe;
    }, []);

    function handleSearchInput(event) {
        setSearchQuery(event.target.value);
    }

    const filteredEvents = events.filter(event => event.content.toLowerCase().includes(searchQuery.toLowerCase()));

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