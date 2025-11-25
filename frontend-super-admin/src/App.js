import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateInstitution from './pages/CreateInstitution';

const { defaultAlgorithm, darkAlgorithm } = theme;

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
            colorPrimary: '#1677ff',
        },
      }}
    >
      <Router>
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <Dashboard isDarkMode={isDarkMode} toggleTheme={toggleTheme} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
           <Route
            path="/create-institution"
            element={isAuthenticated ? <CreateInstitution isDarkMode={isDarkMode} toggleTheme={toggleTheme} /> : <Navigate to="/login" />}
          />
        </Routes>
      </Router>
      <ToastContainer theme={isDarkMode ? 'dark' : 'light'} />
    </ConfigProvider>
  );
}

export default App;
