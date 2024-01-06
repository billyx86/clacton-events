// EventForm.js
import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";

const EventForm = () => {
    const [formData, setFormData] = useState({
        content: '',
        shortDescription: '',
        longDescription: '',
        location: '',
        imageUrl: ''
    });
    const [user, setUser] = useState(null);
    const [loggedInName, setLoggedInName] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                getUserName(user);
            } else {
                setUser(null);
            }
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

        return unsubscribe; // Cleanup subscription on unmount
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
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

            // Create the new event with the incremented count
            const newEvent = {
                id: newCount,
                ...formData,
                createdOn: serverTimestamp(),
                author: loggedInName
            };
            
            const newEventRef = doc(collection(db, "events"));
            batch.set(newEventRef, newEvent);

            // Commit the batch
            await batch.commit();
            alert("Event successfully listed!");
            setFormData({ content: '', shortDescription: '', longDescription: '', location: '', imageUrl: '' }); // Reset form
        } catch (error) {
            console.error("Error listing event: ", error);
        }
    };

    return (
        <div className="event-form-container">
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    name="content" 
                    value={formData.content} 
                    onChange={handleChange} 
                    placeholder="Event Title" 
                    required 
                />
                <input 
                    type="text" 
                    name="shortDescription" 
                    value={formData.shortDescription} 
                    onChange={handleChange} 
                    placeholder="Short Description" 
                    required 
                />
                <textarea 
                    name="longDescription" 
                    value={formData.longDescription} 
                    onChange={handleChange} 
                    placeholder="Long Description" 
                    required 
                />
                <input 
                    type="text" 
                    name="location" 
                    value={formData.location} 
                    onChange={handleChange} 
                    placeholder="Location" 
                    required 
                />
                <input 
                    type="text" 
                    name="imageUrl" 
                    value={formData.imageUrl} 
                    onChange={handleChange} 
                    placeholder="Image URL" 
                    required 
                />

                <button type="submit">Submit Event</button>
            </form>
        </div>
    );
};

export default EventForm;
