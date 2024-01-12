import React, { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import Event from '../../components/Event';
import '../../styles/profile/Profile.css'

const Profile = () => {
    const [events, setEvents] = useState([]); // Initialize as an array
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                getUserInfo();
            } else {
                setLoading(false);
            }
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    const getUserInfo = async () => {
        setLoading(true);
        const userEmail = auth.currentUser?.email;
        if (userEmail) {
            const userRef = doc(db, "users", userEmail);
            try {
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userProfileData = userSnap.data();
                    setUserProfile(userProfileData);
                    await fetchEvents(userProfileData.interestedEvents); // Fetch events after setting user profile
                } else {
                    console.log("No user data found");
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        } else {
            console.log("No user logged in");
        }
        setLoading(false);
    };

    const fetchEvents = async (interestedEvents) => {
        const eventsCollectionRef = collection(db, "events");
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        const now = new Date(); // Current date and time
    
        const eventsList = eventsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(event => {
                // Convert Firestore Timestamp to JavaScript Date object
                const eventDate = event.date.toDate();
    
                // Check if the event date is in the future and if it's in the interestedEvents array
                return eventDate > now && interestedEvents?.includes(event.id.toString());
            })
            .sort((a, b) => b.id - a.id);
    
        setEvents(eventsList);
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!userProfile) {
        return <div>No user profile data.</div>;
    }


    return (
        <div className="profile-info-container">
            <h1>Profile</h1>
            <div className="user-info-card">
                <div className="user-info-name">
                    <p>{userProfile.name}</p>
                    {/* Will be useful for later
                    <button>
                        <svg clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m11.25 6c.398 0 .75.352.75.75 0 .414-.336.75-.75.75-1.505 0-7.75 0-7.75 0v12h17v-8.75c0-.414.336-.75.75-.75s.75.336.75.75v9.25c0 .621-.522 1-1 1h-18c-.48 0-1-.379-1-1v-13c0-.481.38-1 1-1zm-2.011 6.526c-1.045 3.003-1.238 3.45-1.238 3.84 0 .441.385.626.627.626.272 0 1.108-.301 3.829-1.249zm.888-.889 3.22 3.22 8.408-8.4c.163-.163.245-.377.245-.592 0-.213-.082-.427-.245-.591-.58-.578-1.458-1.457-2.039-2.036-.163-.163-.377-.245-.591-.245-.213 0-.428.082-.592.245z" fill-rule="nonzero"/></svg>
                    </button>
                    */}
                </div>
                <p>{userProfile.email}</p>
                <p>Events you're interested in:</p>
                <div className='events-map'>
                    {events.map(event => (
                            <Event 
                                key={event.id} 
                                id={event.id} 
                                title={event.content} 
                                description={event.shortDescription} 
                                imageUrl={event.imageUrl} 
                                location={event.location}
                                date={event.date}
                            />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Profile;
