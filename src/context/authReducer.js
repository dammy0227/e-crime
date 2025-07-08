// src/context/authReducer.js
import { LOGIN_SUCCESS, LOGOUT, AUTH_ERROR } from './types';

const authReducer = (state, action) => {
  switch (action.type) {
    case LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        token: action.payload.token,
        admin: action.payload.admin,
        loading: false
      };
    case LOGOUT:
    case AUTH_ERROR:
      return {
        ...state,
        isAuthenticated: false,
        token: null,
        admin: null,
        loading: false
      };
    default:
      return state;
  }
};

export default authReducer;
