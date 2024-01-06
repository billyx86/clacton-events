import React, { useEffect, useState } from "react";
import Event from '../components/Event';
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";

const EventsPage = () => {
  const [events, setEvents] = useState([]); // Initialize events as an array
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [loggedInName, setLoggedInName] = useState('');

  useEffect(() => {
    const unsubscribeFromAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      getUserName(currentUser);
    });

    const getUserName = async (user) => {
      const userRef = doc(db, "users", user.email);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
          setLoggedInName(userSnap.data().name);
      } else {
          console.log("No such document!");
      }
  }

    const fetchEvents = async () => {
      const eventsCollectionRef = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsCollectionRef);
      const eventsList = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsList);
    };

    fetchEvents();
    return () => {
      unsubscribeFromAuth(); // Unsubscribe from auth listener on unmount
    };
  }, []);


  function handleSearchInput(event) {
    setSearchQuery(event.target.value);
  }

  const handleListEvent = async () => {
    if (!user) {
        console.error("No user signed in!");
        return;
    }
  
    try {
        // Start a batch
        const batch = writeBatch(db);
    
        // Reference to the counter document
        const counterRef = doc(db, "counters", "eventCounter");
        const counterSnap = await getDoc(counterRef);
        let newCount = 1;
    
        if (counterSnap.exists()) {
            newCount = counterSnap.data().count + 1;
            batch.update(counterRef, { count: newCount });
        } else {
            // Initialize the counter if it doesn't exist
            batch.set(counterRef, { count: newCount });
        }
      
        // Add the new event with the incremented count
        const newEvent = {
            id: newCount,
            author: user.email,
            content: "New Event Title",
            shortDescription: "Short description of the event",
            longDescription: "Long description of the event",
            imageUrl: "https://example.com/image.jpg",
            createdOn: serverTimestamp()
        };
        
        const newEventRef = doc(collection(db, "events"));
        batch.set(newEventRef, newEvent);
      
        // Commit the batch
        await batch.commit();
        console.log("Event successfully listed with ID: ", newCount);
    } catch (error) {
        console.error("Error listing event: ", error);
    }
  };

  // Filter the events based on the search query
  const filteredEvents = events.filter(event => event.content.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <main>
      <div className="search-wrapper">
        <div className="search-container">
          <input type="text" placeholder="Search events..." onChange={handleSearchInput}/>
        </div>
      </div>

      {user && (
      <button onClick={handleListEvent} className="list-event-button">List Event</button>
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
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export default EventsPage;
