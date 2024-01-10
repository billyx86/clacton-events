import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Event from '../components/Event';

const Home = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const eventsCollectionRef = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsCollectionRef);
      const now = new Date();
      const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(event => event.date && event.date.toDate() > now);

      // Shuffle and pick three events
      const shuffledEvents = allEvents.sort(() => 0.5 - Math.random());
      const selectedEvents = shuffledEvents.slice(0, 3);

      setEvents(selectedEvents);
    };

    fetchEvents();
  }, []);

  const scrollEvents = (direction) => {
    const container = document.querySelector('.home-events-container');
    const scrollAmount = 300; // Adjust as needed
    if (direction === 'left') {
        container.scrollLeft -= scrollAmount;
    } else {
        container.scrollLeft += scrollAmount;
    }
};

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
                  title={event.content} // or event.title, depending on your data structure
                  description={event.shortDescription} // or appropriate field
                  imageUrl={event.imageUrl} // or appropriate field
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