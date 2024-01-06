import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Event.css';

const Event = ({ id, title, description, imageUrl }) => {
    const navigate = useNavigate();

    const navigateToEventDetails = () => {
        navigate(`/events/${id}`); // Navigate to the event's page
    };

    return (
        <section className="event">
            <img src={imageUrl} alt={title} />
            <div className="event-info">
                <h3>{title}</h3>
                <p>{description}</p>
                <button onClick={navigateToEventDetails}>View Details</button>
            </div>
        </section>
    );
}

export default Event;