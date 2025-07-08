import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/Login';
import Dashboard from './pages/dashboard/Dashboard';
import SessionDetail from './pages/SessionDetail/SessionDetail';
import CameraPage from './pages/CameraPage/CameraPage'; // ✅ CameraPage import
import useAuth from './hooks/useAuth';
import './App.css'


const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // You can replace with a spinner
  }

  return isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Private Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/session/:id"
          element={
            <PrivateRoute>
              <SessionDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/session/:id/camera"
          element={
            <PrivateRoute>
              <CameraPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
