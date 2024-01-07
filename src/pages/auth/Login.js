import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from 'react';
import { auth } from "../../firebase";
import { useNavigate } from 'react-router-dom';
import '../../styles/auth/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate  = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(''); // Clear any existing errors
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect to home page or dashboard after login
      navigate('/');
    } catch (error) {
      setError(error.message); 
      // Handle errors like incorrect password, user not found, etc.
    }
  };

  return (
    <div className="login-container">
    <form className="login-form" onSubmit={handleLogin}>
        <h2>Log In</h2>
        {error && <div className="error-message">{error}</div>}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit">Log in</button>
        <p>Don't have an account? <a href="/signup">Register here.</a></p>
    </form>
  </div>
  );
};

export default Login;