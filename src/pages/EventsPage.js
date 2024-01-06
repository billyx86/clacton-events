import React, { useEffect, useState } from "react";
import Event from '../components/Event'
import eventData from '../data/events.json'

const EventsPage = () => {
  const [events, setEvents] = useState(eventData.events);
  const [searchQuery, setSearchQuery] = useState('');

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
            <Event id={filteredEvent.id} title={filteredEvent.content} description={filteredEvent.description} imageUrl={filteredEvent.imageURL} />
          ))}
        </div>
      </div>
    </main>
  )
}

export default EventsPage;