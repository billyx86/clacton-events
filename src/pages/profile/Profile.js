import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";

const Profile = () => {
    return (
        <div>
            {/* Display event details here */}
            <h1>Profile</h1>
            <p>Event Description</p>
            {/* More details */}
        </div>
    );
};

export default Profile;