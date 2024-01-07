import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Event.css';

const Event = ({ id, title, description, imageUrl, location, date }) => {
    const navigate = useNavigate();

    console.log(location)

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        // Convert Firestore Timestamp to JavaScript Date object
        const dateObj = new Date(timestamp.seconds * 1000);
        // Format the date
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        });
        return formattedDate;
    };

    const navigateToEventDetails = () => {
        navigate(`/events/${id}`); // Navigate to the event's page
    };

    return (
        <section className="event">
            <div className="event-image" style={{backgroundImage: `url("${imageUrl}")`}}>
            </div>
            <div className="event-info">
                <h3>{title}</h3>
                <p>{description}</p>
                <p className="event-location">
                    <span className="location-bold">
                        Location: 
                    </span> 
                    {location.label}
                </p>
                <p className="event-location">
                    <span className="location-bold">
                        Date: 
                    </span> 
                    {formatDate(date)}
                </p>
                <button className="event-details-button" onClick={navigateToEventDetails}>View Details</button>
            </div>
        </section>
    );
}

export default Event;