import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Route-level code splitting (issue #18): each page is a separate chunk
// loaded on demand, so the initial bundle only ships the shell (router,
// shared components, firebase) instead of every page's code.
const Home = lazy(() => import('./pages/Home'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const ListEvent = lazy(() => import('./pages/posting/EventForm'));
const Profile = lazy(() => import('./pages/profile/Profile'));

const Main = () => {
  return (
    <Routes>
        <Route exact path='/' element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <Home/>
          </Suspense>
        } />
        <Route exact path='/events' element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <EventsPage/>
          </Suspense>
        } />
        <Route path="/login" element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <Login />
          </Suspense>
        } />
        <Route path="/signup" element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <Signup />
          </Suspense>
        } />
        <Route path="/events/:id" element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <EventDetails />
          </Suspense>
        } />
        <Route path="/list-event" element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <ListEvent />
          </Suspense>
        } />
        <Route path="/profile" element={
          <Suspense fallback={<div className="route-fallback">Loading...</div>}>
            <Profile />
          </Suspense>
        } />
    </Routes>
  );
}

export default Main;
