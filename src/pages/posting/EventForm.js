// EventForm.js
import React, { useState, useEffect, useRef  } from 'react';
import { collection, serverTimestamp, doc, getDoc, runTransaction, Timestamp  } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import Pica from 'pica';

import '../../styles/posting/EventForm.css'

const EventForm = () => {
    const [formData, setFormData] = useState({
        content: '',
        shortDescription: '',
        longDescription: '',
        date: '',
        imageUrl: '',
        websiteUrl: ''
    });
    const [eventLocation, setEventLocation] = useState('Clacton-on-Sea');
    const [user, setUser] = useState(null);
    const [loggedInName, setLoggedInName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const navigate  = useNavigate();
    const fileInputRef = useRef(null);

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const getFormattedCurrentDateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0'); // month is 0-indexed
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    

    const [minDateTime, setMinDateTime] = useState(getFormattedCurrentDateTime());

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                getUserName(user);
            } else {
                setUser(null);
                navigate('/login');
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

    const convertDateStringToTimestamp = (dateString) => {
        const dateObj = new Date(dateString);
        return Timestamp.fromDate(dateObj);
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
      
        // Create a canvas and context for resizing
        const offScreenCanvas = document.createElement('canvas');
        const ctx = offScreenCanvas.getContext('2d');
      
        // Set the desired output dimensions
        const maxWidth = 800;
        const maxHeight = 600;
      
        // Read the uploaded file as a data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Calculate the scaling factor to maintain aspect ratio
            let scaleFactor = Math.min(maxWidth / img.width, maxHeight / img.height);
            scaleFactor = (scaleFactor > 1) ? 1 : scaleFactor; // Don't scale up
      
            // Set canvas dimensions proportional to the image scaled to the max sizes
            offScreenCanvas.width = img.width * scaleFactor;
            offScreenCanvas.height = img.height * scaleFactor;
      
            // Resize the image with Pica
            Pica().resize(img, offScreenCanvas)
              .then(resizedCanvas => Pica().toBlob(resizedCanvas, 'image/jpeg', 0.90)) // Adjust the quality as needed
              .then(blob => {
                // Now you have a resized image as a Blob, ready to upload
                const userId = auth.currentUser.uid;
                const timestamp = new Date().getTime();
                const uniquePath = `events/${userId}/${timestamp}-${file.name}`;
      
                const storageRef = ref(storage, uniquePath);
                return uploadBytes(storageRef, blob);
              })
              .then(snapshot => getDownloadURL(snapshot.ref))
              .then(imageUrl => {
                setFormData({ ...formData, imageUrl });
                // Handle the rest of your form submission here
              })
              .catch(error => {
                console.error('Error uploading resized image: ', error);
              });
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
    

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        if (submitting) return;
        setSubmitting(true);

        try {
            // Convert date string to Firestore timestamp
            const eventDate = convertDateStringToTimestamp(formData.date);

            // Increment the legacy counter atomically — the old read-then-write
            // allowed two concurrent posters to get the same id. The document
            // ID (assigned by Firestore) remains the canonical event ID; the
            // counter is kept only as a sort key for older listings.
            const counterRef = doc(db, "counters", "eventCounter");
            const newEvent = {
                ...formData,
                location: eventLocation,
                date: eventDate,
                createdOn: serverTimestamp(),
                author: loggedInName,
                emailOfAuthor: user.email
            };

            const newEventRef = doc(collection(db, "events"));

            await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                const newCount = counterSnap.exists()
                    ? counterSnap.data().count + 1
                    : 1;
                // Counter doc may not exist on the very first event —
                // create it in-transaction rather than failing with
                // update() on a missing document.
                if (counterSnap.exists()) {
                    transaction.update(counterRef, { count: newCount });
                } else {
                    transaction.set(counterRef, { count: newCount });
                }
                transaction.set(newEventRef, { ...newEvent, id: newCount });
            });

            console.log("Event successfully listed!");
            setFormData({ content: '', shortDescription: '', longDescription: '', location: '', imageUrl: '', websiteUrl: '' }); // Reset form
            navigate('/events');
        } catch (error) {
            console.error("Error listing event: ", error);
            setSubmitError("Something went wrong while listing the event. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="event-form-container">
            <h1>List an Event</h1>
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
                    name="websiteUrl" 
                    value={formData.websiteUrl} 
                    onChange={handleChange} 
                    placeholder="Website URL (optional)"  
                />
                <GooglePlacesAutocomplete
                    apiKey={`${process.env.REACT_APP_GMAPS_STATIC_KEY}`}
                    selectProps={{
                        eventLocation,
                        onChange: setEventLocation,
                        placeholder: "Location"
                    }}
                />
                <input 
                    type="datetime-local" 
                    name="date" 
                    value={formData.date}
                    onChange={handleChange}
                    placeholder="Date (DD/MM/YY HH:MM)" 
                    min={minDateTime}
                    required 
                />
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }} 
                />
                <div className="image-input-wrapper">
                    <input 
                        type="text" 
                        name="imageUrl" 
                        value={formData.imageUrl} 
                        onChange={handleChange} 
                        placeholder="Image URL"
                        required
                    />
                    <button type="button" onClick={handleButtonClick} className="custom-upload-button">
                        Upload Image
                    </button>
                </div>
                <button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Event'}
                </button>
                {submitError && (
                    <p role="alert" style={{ color: '#c62828' }}>{submitError}</p>
                )}
            </form>
        </div>
    );
};

export default EventForm;
