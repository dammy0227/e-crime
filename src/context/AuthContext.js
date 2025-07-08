// src/context/AuthContext.js
import React, { createContext, useReducer, useEffect } from 'react';
import authReducer from './authReducer';
import { LOGIN_SUCCESS, LOGOUT } from './types';

const AuthContext = createContext();

const initialState = {
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
  admin: null
};

const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

 // src/context/AuthContext.js
useEffect(() => {
  const storedAdmin = localStorage.getItem('admin');
  const storedToken = localStorage.getItem('token');

  if (storedToken && storedAdmin) {
    dispatch({
      type: LOGIN_SUCCESS,
      payload: {
        token: storedToken,
        admin: JSON.parse(storedAdmin)
      }
    });
  } else {
    dispatch({ type: 'AUTH_ERROR' }); // Mark loading as done
  }
}, []);


  // Login function
  const login = (admin, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('admin', JSON.stringify(admin));
    dispatch({ type: LOGIN_SUCCESS, payload: { admin, token } });
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    dispatch({ type: LOGOUT });
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
