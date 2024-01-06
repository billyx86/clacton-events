// EventsPage.js
import React, { useEffect, useState } from "react";
import Event from '../components/Event';
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from 'react-router-dom';

const EventsPage = () => {
    const [events, setEvents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchEvents = async () => {
            const eventsCollectionRef = collection(db, "events");
            const eventsSnapshot = await getDocs(eventsCollectionRef);
            const eventsList = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(eventsList);
        };

        fetchEvents();
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

            <div className="le-button-wrapper">
              <button onClick={() => navigate('/list-event')} className="list-event-button">List Event</button>
            </div>

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
                        />
                    ))}
                </div>
            </div>
        </main>
    );
}

export default EventsPage;