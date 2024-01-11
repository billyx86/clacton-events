"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

import '../styles/EventDetails.css';

const EventDetails = () => {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [interestFeedback, setInterestFeedback] = useState('');

    useEffect(() => {
        const fetchEvent = async () => {
            setLoading(true);
            try {
                const eventsCollectionRef = collection(db, 'events');
                const q = query(eventsCollectionRef, where('id', '==', parseInt(id)));
                const querySnapshot = await getDocs(q);
                const eventDocs = querySnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
                if (eventDocs.length > 0) {
                    setEvent(eventDocs[0]);
                    console.log(event.location)
                } else {
                    console.log('No such event!');
                }
            } catch (error) {
                console.error('Error fetching event:', error);
            }
            setLoading(false);
        };
        fetchEvent();

    }, [id]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!event) {
        return <div>No event found.</div>;
    }

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const dateObj = timestamp.toDate();
        const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' };
        return dateObj.toLocaleDateString('en-GB', options);
    };

    const handleInterest = async () => {
        if (!auth.currentUser) {
            console.error("No user logged in");
            setInterestFeedback("You must be logged in to show interest.");
            return;
        }

        const userEmail = auth.currentUser.email;
        const userRef = doc(db, "users", userEmail);
        
        try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Check if the user has already shown interest in this event
                if (userData.interestedEvents && userData.interestedEvents.includes(id)) {
                    setInterestFeedback("You have already shown interest in this event.");
                    return;
                }

                // Update the user's interested events
                await updateDoc(userRef, {
                    interestedEvents: arrayUnion(id)
                });
                setInterestFeedback("You have successfully shown interest in this event.");
            } else {
                console.error("User document does not exist");
                setInterestFeedback("Error: User document does not exist.");
            }
        } catch (error) {
            console.error("Error updating user's interested events:", error);
            setInterestFeedback("Error updating interested events.");
        }
    };

    return (
        <div className="main-event-details-wrapper">
            <a className="main-event-details-bte-button" href="/events">◄ Back to Events</a>
            <div className="event-details-grid">
                <div className="event-detail-container">
                    {event.imageUrl && (
                        <img src={event.imageUrl} alt={event.content} className="event-detail-image" />
                    )}
                    <div className="event-detail-info">
                        <h3 className="event-detail-title">{event.content}</h3>
                        <p className="event-detail-short-description">{event.shortDescription}</p>
                        <p className="event-detail-meta"><span className="location-bold">Location:</span>{event.location.label}</p>
                        <p className="event-detail-meta"><span className="date-bold">Date:</span> {formatDate(event.date)}</p>
                        <p className="event-detail-long-description">{event.longDescription}</p>
                    </div>
                </div>
                <div className="right-side-wrapper">
                    <div>
                        <img className="google-maps-static"
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${event.location.label}&zoom=18&markers=${event.location.label}&size=640x640&maptype=roadmap&key=${process.env.REACT_APP_GMAPS_STATIC_KEY}`}
                        />
                    </div>
                    <div className="maps-buttons">
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${event.location.label}`}
                            className="google-maps-clickable-wrapper-left"
                            target="_blank"
                        >
                                Open in Google Maps
                        </a>
                        <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${event.location.label}`}
                            className="google-maps-clickable-wrapper-right"
                            target="_blank"
                        >
                                Get Directions
                        </a>
                    </div>
                    <div className="event-detail-interaction-menu">
                        {/* Interaction buttons */}
                        <button className="event-detail-button" onClick={handleInterest}>I'm Interested</button>
                        {interestFeedback && <p className="interest-feedback">{interestFeedback}</p>}
                        {event.websiteUrl && <a className="button-url-wrapper" href={`${event.websiteUrl}`}><button className="event-detail-button">Open Event Website</button></a>}
                        <button className="event-detail-button">Save for Later</button>
                        <button className="event-detail-button">Share</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetails;
