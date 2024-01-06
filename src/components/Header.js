import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import '../styles/Header.css';

const Header = () => {
    const [isNavVisible, setIsNavVisible] = useState(false);
    const [user, setUser] = useState(null);
    const [loggedInName, setLoggedInName] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                getUserName(user);
            } else {
                setUser(null);
            }
        });

        const getUserName = async (user) => {
            const userRef = doc(db, "users", user.email);
            const userSnap = await getDoc(userRef);
    
            if (userSnap.exists()) {
                setLoggedInName(userSnap.data().name);
            } else {
                console.log("No such document!");
            }
        }

        return () => {
            unsubscribe();
        };
    }, []);

    const handleSignOut = () => {
        signOut(auth).then(() => {
            setUser(null);
            setLoggedInName('');
        }).catch((error) => {
            console.log(error);
        });
    };

    const toggleNav = () => {
        setIsNavVisible(!isNavVisible);
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    return (
        <div className="header">
            <div className="header-container">
                <div className="menu-icon" onClick={toggleNav}>
                    <span>☰</span>
                </div>
                <div className="logo">
                    <p>Logo</p>
                </div>
                <nav className={`nav ${isNavVisible ? 'show' : ''}`}>
                    <ul>
                        <li><a href="/">Home</a></li>
                        <li><a href="/events">Events</a></li>
                        <li><a href="/about">About</a></li>
                    </ul>
                </nav>
                <div className="auth-buttons">
                    {user ? (
                        <div className="user-menu">
                            <button onClick={toggleDropdown} className="user-menu-button">
                                {loggedInName ? `${loggedInName}` : 'User'}
                            </button>
                                <div className={`dropdown ${showDropdown ? 'show' : ''}`}>
                                    <a href="/profile">Profile</a>
                                    <a href="/account-settings">Account Settings</a>
                                    <a onClick={handleSignOut}>Log Out</a>
                                </div>
                        </div>
                    ) : (
                        <>
                            <a href="/login">Login</a>
                            <a href="/signup">Sign Up</a>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Header;