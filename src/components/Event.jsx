import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocationLabel, formatEventDate } from '../utils/eventUtils';
import '../styles/Event.css';

const Event = ({ id, title, description, imageUrl, location, date }) => {
    const navigate = useNavigate();

    const locationLabel = getLocationLabel(location);

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
                {locationLabel && (
                <p className="event-location">
                    <span className="location-bold">
                        Location: 
                    </span> 
                    {locationLabel}
                </p>
                )}
                <p className="event-location">
                    <span className="location-bold">
                        Date: 
                    </span> 
                    {formatEventDate(date)}
                </p>
                <button className="event-details-button" onClick={navigateToEventDetails}>View Details</button>
            </div>
        </section>
    );
}

export default Event;