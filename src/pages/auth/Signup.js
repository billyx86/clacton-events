import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import React, { useState } from 'react';
import { auth, db } from "../../firebase";
import { useNavigate } from 'react-router-dom';
import '../../styles/auth/Signup.css';

export const serverStamp = firebase.firestore.Timestamp

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate  = useNavigate();
  const photoURL = ""

  const handleSignup = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      var stampNow = serverStamp.now()
            // Update the user profile with the username
            try {
                await setDoc(doc(db, "users", email), {
                    name,
                    email,
                    photoURL,
                    created_at: stampNow
                })
                navigate('/');
            } catch (e) {
                console.log(e)
            }
      // Redirect to home page or dashboard after login
    } catch (error) {
      setError(`Authentication Error: ${error}`);
      // Handle errors like incorrect password, user not found, etc.
    }
  };

  return (
    <div className="signup-container">
        <form className="signup-form" onSubmit={handleSignup}>
            <h2>Sign Up</h2>
            {error && <div className="error-message">{error}</div>}
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required />
            <button type="submit">Sign Up</button>
        </form>
    </div>
);
};

export default Signup;