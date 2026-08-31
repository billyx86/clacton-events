import React, { useState, useEffect, useCallback } from 'react';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import Event from '../../components/Event';
import { isEventUpcoming, sortEventsByRecency } from '../../utils/eventUtils';
import '../../styles/profile/Profile.css'

// Firestore `in` queries support at most 30 values.
const IN_QUERY_MAX = 30;

const Profile = () => {
    const [events, setEvents] = useState([]); // Initialize as an array
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchEvents = useCallback(async (interestedEvents) => {
        const eventIds = Array.isArray(interestedEvents)
            ? interestedEvents.filter(Boolean)
            : [];
        const now = new Date();

        // Only fetch the documents the user actually followed — before this
        // was added the page downloaded the *entire* events collection and
        // filtered client-side (issue #7). `in` queries are capped at 30
        // values, so beyond that we fall back to a bounded recency window
        // rather than fetching everything.
        let eventsList;
        if (eventIds.length === 0) {
            eventsList = [];
        } else if (eventIds.length <= IN_QUERY_MAX) {
            const snapshot = await getDocs(
                query(
                    collection(db, 'events'),
                    where('__name__', 'in', eventIds.map((id) => `events/${id}`)),
                    limit(eventIds.length)
                )
            );
            eventsList = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        } else {
            const snapshot = await getDocs(
                query(
                    collection(db, 'events'),
                    orderBy('createdOn', 'desc'),
                    limit(100)
                )
            );
            eventsList = snapshot.docs
                .map((d) => ({ ...d.data(), id: d.id }))
                .filter((event) => eventIds.includes(event.id));
        }

        // Upcoming only — the user may have followed events that have since
        // passed. sortEventsByRecency keeps the display order consistent
        // with the rest of the app.
        setEvents(sortEventsByRecency(
            eventsList.filter((event) => isEventUpcoming(event.date, now))
        ));
    }, []);

    const getUserInfo = useCallback(async () => {
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
    }, [fetchEvents]);

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
    }, [getUserInfo]);

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
                        <svg clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="round" stroke-miterlimit="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12.25 6c.398 0 .75.352.75.75 0 .414-.336.75-.75.75-1.505 0-7.75 0-7.75 0v12h17v-8.75c0-.414.336-.75.75-.75s.75.336.75.75v9.25c0 .621-.522 1-1 1h-18c-.48 0-.9-.4-.95-.9zm-2.011 6.526c-1.045 3.003-1.238 3.45-1.238 3.84 0 .441.385.626.627.626.272 0 1.108-.301 3.829-1.249zm.888-.889 3.22 3.22 8.408-8.4c.163-.163.245-.377.245-.592 0-.213-.082-.427-.245-.591-.58-.578-1.458-1.457-2.039-2.036-.163-.163-.377-.245-.592-.245-.213 0-.428.082-.592.245z" fill-rule="nonzero"/></svg>
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
