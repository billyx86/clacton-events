import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import EventsPage from './pages/EventsPage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup'
import EventDetails from './pages/EventDetails';

const Main = () => {
  return (
    <Routes>
        <Route exact path='/' element={<Home/>} />
        <Route exact path='/events' element={<EventsPage/>} />
        <Route path="/login" element={ <Login /> } />
        <Route path="/signup" element={ <Signup /> } />
        <Route path="/event/:id" component={EventDetails} />
    </Routes>
  );
}

export default Main;