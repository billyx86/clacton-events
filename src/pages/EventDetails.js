"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

import '../styles/EventDetails.css'; // Make sure the path to your CSS file is correct

const EventDetails = () => {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="main-event-details-wrapper">
            <a href="/events">◄ Back to Events</a>
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
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${event.location.label}&zoom=18&markers=${event.location.label}&size=640x640&maptype=roadmap&key=${process.env.REACT_APP_GMAPS_STATIC_KEY}`} />
                    </div>
                    <div className="event-detail-interaction-menu">
                        {/* Interaction buttons go here */}
                        <button className="event-detail-button">I'm Interested</button>
                        <button className="event-detail-button">Open Event Website</button>
                        <button className="event-detail-button">Save for Later</button>
                        <button className="event-detail-button">Share</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetails;
