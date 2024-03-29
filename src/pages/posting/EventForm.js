// EventForm.js
import React, { useState, useEffect, useRef  } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch, Timestamp  } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
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
    const [ip, setIP] = useState("");
    const navigate  = useNavigate();
    const fileInputRef = useRef(null);
    const pica = Pica();

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const getData = async () => {
        const res = await axios.get("https://api.ipify.org/?format=json");
        console.log(res.data);
        setIP(res.data.ip);
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

        getData();

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
        console.log(eventLocation)
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

            // Convert date string to Firestore timestamp
            const eventDate = convertDateStringToTimestamp(formData.date);

            // Create the new event with the incremented count
            const newEvent = {
                id: newCount,
                ...formData,
                location: eventLocation,
                date: eventDate,
                createdOn: serverTimestamp(),
                author: loggedInName,
                emailOfAuthor: user.email,
                ipOfAuthor: ip
            };
            
            const newEventRef = doc(collection(db, "events"));
            batch.set(newEventRef, newEvent);

            // Commit the batch
            await batch.commit();
            console.log("Event successfully listed!");
            setFormData({ content: '', shortDescription: '', longDescription: '', location: '', imageUrl: '', websiteUrl: '' }); // Reset form
            navigate('/events');
        } catch (error) {
            console.error("Error listing event: ", error);
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
                <button type="submit">Submit Event</button>
            </form>
        </div>
    );
};

export default EventForm;
