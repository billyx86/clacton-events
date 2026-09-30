// EventForm.js
import React, { useState, useEffect, useRef  } from 'react';
import { collection, serverTimestamp, doc, getDoc, runTransaction, Timestamp  } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import Pica from 'pica';
import { resolveAuthorName } from '../../utils/authorName';

import '../../styles/posting/EventForm.css'

const INITIAL_FORM_DATA = {
    content: '',
    shortDescription: '',
    longDescription: '',
    date: '',
    imageUrl: '',
    websiteUrl: ''
};

// Cap on uploaded poster images (issue #11). Anything larger is rejected
// before it goes through Pica's resize path, so a 20 MB photo can't be
// decoded/resized client-side first.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

const EventForm = () => {
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [eventLocation, setEventLocation] = useState('Clacton-on-Sea');
    const [user, setUser] = useState(null);
    const [loggedInName, setLoggedInName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    // issue #11: local preview of the chosen image, plus a dedicated error
    // channel so upload/decode failures never die silently in console.error.
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imageError, setImageError] = useState('');
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
    

    const [minDateTime] = useState(getFormattedCurrentDateTime());

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
            // A permission error (or any other read failure) must not reject
            // the onAuthStateChanged callback silently — treat it the same
            // as a missing document and fall back. (issue #12)
            let docData = null;
            try {
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    docData = userSnap.data();
                }
            } catch (error) {
                console.error("Failed to read user profile document:", error);
            }
            // resolveAuthorName always returns a non-empty string:
            // users/<email> name → auth displayName → email local part.
            setLoggedInName(resolveAuthorName(docData, user));
        }

        return unsubscribe; // Cleanup subscription on unmount
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const convertDateStringToTimestamp = (dateString) => {
        const dateObj = new Date(dateString);
        return Timestamp.fromDate(dateObj);
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files && event.target.files[0];
        // Let the same file be re-selected after a failed attempt.
        if (event.target) event.target.value = '';
        setImageError('');
        if (!file) return;

        // Validate before the pipeline (issue #11): reject non-images and
        // anything over the cap so a huge photo never hits the resize path.
        if (file.type && !file.type.startsWith('image/')) {
            setImageError(`"${file.name}" isn't an image file. Please choose a PNG, JPEG, or similar.`);
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setImageError(`"${file.name}" is ${Math.round(file.size / (1024 * 1024))} MB. Keep images under 8 MB.`);
            return;
        }

        // Create a canvas for resizing
        const offScreenCanvas = document.createElement('canvas');

        // Set the desired output dimensions
        const maxWidth = 800;
        const maxHeight = 600;

        // Read the uploaded file as a data URL
        const reader = new FileReader();
        reader.onerror = () => {
            setImageError('The image file could not be read. Please try again.');
        };
        reader.onload = (e) => {
          const img = new Image();
          // issue #11: a file that fails to decode used to leave the form
          // frozen with no feedback. Surface it, and show the preview only
          // once we know the image is actually decodable.
          img.onerror = () => {
            setImageError('That image could not be decoded. Try a standard PNG or JPEG.');
          };
          img.onload = () => {
            // The image is decodable — show the preview immediately so the
            // user sees what will be posted while the upload runs.
            setImagePreviewUrl(e.target.result);
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
                // Functional update: the closure above captured
                // `formData` when the file was picked, which can be
                // stale by the time the upload finishes.
                setFormData((prev) => ({ ...prev, imageUrl }));
                // Handle the rest of your form submission here
              })
              .catch(error => {
                // issue #11: upload/decode failures were console.error-only,
                // leaving the user staring at a required-empty field.
                console.error('Error uploading resized image: ', error);
                setImageError('The image upload failed. Please try again.');
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
            setFormData(INITIAL_FORM_DATA); // Reset form
            setEventLocation('Clacton-on-Sea');
            // Reset the image upload UI (issue #11) alongside the form so a
            // stale preview/error doesn't linger on the next event.
            setImagePreviewUrl('');
            setImageError('');
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
                    apiKey={`${import.meta.env.REACT_APP_GMAPS_STATIC_KEY}`}
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
                {imagePreviewUrl && (
                    <div className="image-preview-wrapper">
                        <img
                            src={imagePreviewUrl}
                            alt="Preview of the image about to be uploaded"
                            className="image-preview"
                            style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', display: 'block' }}
                        />
                    </div>
                )}
                {imageError && (
                    <p role="alert" style={{ color: '#c62828' }}>{imageError}</p>
                )}
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
