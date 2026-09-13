import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import EventsPage from './pages/EventsPage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup'
import EventDetails from './pages/EventDetails';
import ListEvent from './pages/posting/EventForm';
import Profile from './pages/profile/Profile';

const Main = () => {
  return (
    <Routes>
        <Route exact path='/' element={<Home/>} />
        <Route exact path='/events' element={<EventsPage/>} />
        <Route path="/login" element={ <Login /> } />
        <Route path="/signup" element={ <Signup /> } />
        <Route path="/events/:id" element={ <EventDetails /> } />
        <Route path="/list-event" element={ <ListEvent />} />
        <Route path="/profile" element={ <Profile />} />
    </Routes>
  );
}

export default Main;