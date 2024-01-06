import React, { useEffect, useState } from "react";
import Event from '../components/Event'
import eventData from '../data/events.json'
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // Ensure you have this export in your firebase.js

const EventsPage = () => {
  const [events, setEvents] = useState(eventData.events);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      const eventsCollectionRef = collection(db, "events"); // Reference to your Firestore events collection
      const eventsSnapshot = await getDocs(eventsCollectionRef);
      const eventsList = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsList);
    };

    fetchEvents();
  }, []);

  function handleSearchInput(event) {
    setSearchQuery(event.target.value);
  }

  return(
    <main>
      <div className="search-wrapper">
        <div className="search-container">
          <input type="text" placeholder="Search events..." onChange={handleSearchInput}/>
        </div>
      </div>

      <div className="main-wrapper">
        <div className="main-container">
          {events.filter(eventData => eventData.content.toLowerCase().includes(searchQuery.toLowerCase())).map(filteredEvent => (
            <Event id={filteredEvent.id} title={filteredEvent.content} description={filteredEvent.shortDescription} imageUrl={filteredEvent.imageUrl} />
          ))}
        </div>
      </div>
    </main>
  )
}

export default EventsPage;