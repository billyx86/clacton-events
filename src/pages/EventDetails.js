"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

import { EmailShareButton, FacebookShareButton, TwitterShareButton } from "react-share"

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
                        {/* Not implemented while I figure out a use for this.
                        <button className="event-detail-button">Save for Later</button>
                    <button className="event-detail-button">Share</button> */}
                        <div className="share-buttons">
                            <EmailShareButton url={window.location.href}> 
                                <svg className="share-button-svg" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path d="M19 24h-14c-2.761 0-5-2.239-5-5v-14c0-2.761 2.239-5 5-5h14c2.762 0 5 2.239 5 5v14c0 2.761-2.238 5-5 5zm-.141-6.333c.63 0 1.141-.512 1.141-1.142v-9.05c0-.63-.511-1.142-1.141-1.142h-13.718c-.63 0-1.141.512-1.141 1.142v9.05c0 .63.511 1.142 1.141 1.142h13.718zm-6.859-4.058l-6.228-4.321-.014 7.712h12.457v-7.712l-6.215 4.321zm5.913-6.609c-1.745 1.215-5.913 4.153-5.913 4.153l-5.947-4.153h11.86z"/></svg>
                            </EmailShareButton>
                            <FacebookShareButton url={window.location.href}>
                                <svg className="share-button-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-3 7h-1.924c-.615 0-1.076.252-1.076.889v1.111h3l-.238 3h-2.762v8h-3v-8h-2v-3h2v-1.923c0-2.022 1.064-3.077 3.461-3.077h2.539v3z"/></svg>
                            </FacebookShareButton>
                            <TwitterShareButton url={window.location.href}>
                                <svg className="share-button-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-.139 9.237c.209 4.617-3.234 9.765-9.33 9.765-1.854 0-3.579-.543-5.032-1.475 1.742.205 3.48-.278 4.86-1.359-1.437-.027-2.649-.976-3.066-2.28.515.098 1.021.069 1.482-.056-1.579-.317-2.668-1.739-2.633-3.26.442.246.949.394 1.486.411-1.461-.977-1.875-2.907-1.016-4.383 1.619 1.986 4.038 3.293 6.766 3.43-.479-2.053 1.08-4.03 3.199-4.03.943 0 1.797.398 2.395 1.037.748-.147 1.451-.42 2.086-.796-.246.767-.766 1.41-1.443 1.816.664-.08 1.297-.256 1.885-.517-.439.656-.996 1.234-1.639 1.697z"/></svg>
                            </TwitterShareButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetails;
