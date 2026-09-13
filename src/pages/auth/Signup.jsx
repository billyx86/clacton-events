import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { auth, db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import '../../styles/auth/Signup.css';

const Signup = () => {
  // One casing (lowercase) across the app — Header compares to "business".
  const [accountType, setAccountType] = useState('personal');
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
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
            // Update the user profile with the username. A failure here must
            // be surfaced — otherwise the user exists in Auth but has no
            // Firestore doc and sees "No user profile data" everywhere.
            try {
                await setDoc(doc(db, "users", email), {
                    name,
                    email,
                    photoURL,
                    created_at: Timestamp.now(),
                    accountType,
                    interestedEvents: []
                });
                navigate('/');
            } catch (e) {
                console.error('Failed to create user profile document:', e);
                setError("Your account was created but saving your profile failed. Please log in again.");
            }
      // Redirect to home page or dashboard after login
    } catch (error) {
      // Firebase throws an Error object — surface the real message, not
      // "[object Object]".
      setError(error.message || "Authentication failed. Please try again.");
      // Handle errors like incorrect password, user not found, etc.
    }
  };

  return (
    <div className="signup-container">
        <form className="signup-form" onSubmit={handleSignup}>
            <h2>Sign Up</h2>
            {error && <div className="error-message">{error}</div>}
            <div className="account-type-selector">
              <p>Account Type: </p>
              <div className="account-type-selector-buttons">
                <div className="radio-button-left">
                  <input
                    id="personal-radio-button"
                    type="radio"
                    value="personal"
                    className="radio-button-input"
                    checked={accountType === "personal"}
                    onChange={() => setAccountType("personal")}
                  />
                  <label htmlFor="personal-radio-button">Personal</label>
                </div>
                <div className="radio-button-right">
                  <input
                    id="business-radio-button"
                    type="radio"
                    value="business"
                    className="radio-button-input"
                    checked={accountType === "business"}
                    onChange={() => setAccountType("business")}
                  />
                  <label htmlFor="business-radio-button">Business</label>
                </div>
              </div>
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required />
            <button type="submit">Sign Up</button>
            <p>Already have an account? <a href="/login">Log in here.</a></p>
        </form>
    </div>
);
};

export default Signup;