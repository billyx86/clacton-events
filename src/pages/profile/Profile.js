import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';

const Profile = () => {
    return (
        <div>
            <h1>Profile</h1>
        </div>
    );
};

export default Profile;