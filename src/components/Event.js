import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Event.css';

const Event = ({ id, title, description, imageUrl, location }) => {
    const navigate = useNavigate();

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
                    {location}
                </p>
                <button className="event-details-button" onClick={navigateToEventDetails}>View Details</button>
            </div>
        </section>
    );
}

export default Event;