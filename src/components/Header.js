import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import '../styles/Header.css';

const Header = () => {
    const [isNavVisible, setIsNavVisible] = useState(false);
    const [user, setUser] = useState(null);
    const [loggedInName, setLoggedInName] = useState('');
    const [isBusiness, setIsBusiness] = useState(false);
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
                const { name = '', accountType } = userSnap.data();
                // Business accounts show the full name; personal accounts
                // show the first word (null-safe — missing name renders as
                // empty, the button falls back to 'User').
                if (accountType === "business") {
                    setIsBusiness(true)
                    setLoggedInName(name);
                } else {
                    setIsBusiness(false)
                    setLoggedInName(name.split(' ')[0]);
                }
            
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
                    <p><a href="/">Clacton Events</a></p>
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
                                    {/*<a href="/account-settings">Account Settings</a>*/}
                                    <a onClick={handleSignOut} href="javascript:void(0);">Log Out</a>
                                </div>
                        </div>
                    ) : (
                        <>
                            <a className="login-signup-buttons" href="/login">Log in</a>
                            <a className="login-signup-buttons" href="/signup">Sign Up</a>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Header;