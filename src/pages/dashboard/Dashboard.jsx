import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [expectedStudentCount, setExpectedStudentCount] = useState('');
  const [maxFacesAllowed, setMaxFacesAllowed] = useState(1); // NEW state for face count
  const navigate = useNavigate();

  const loadSessions = async () => {
    try {
      const res = await API.get('/sessions');
      const fetchedSessions = res?.data?.sessions || res?.data || [];
      setSessions(fetchedSessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setSessions([]);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionName.trim() || !expectedStudentCount || !maxFacesAllowed) return;
    try {
      await API.post('/sessions', {
        sessionName,
        expectedStudentCount: parseInt(expectedStudentCount, 10),
        maxFacesAllowed: parseInt(maxFacesAllowed, 10), // Send maxFacesAllowed
      });
      setSessionName('');
      setExpectedStudentCount('');
      setMaxFacesAllowed(1); // Reset field
      await loadSessions();
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">Dashboard</h2>

      <form onSubmit={handleCreateSession} className="create-form">
        <input
          type="text"
          placeholder="Exam Session Name"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="number"
          placeholder="Expected Student Count"
          value={expectedStudentCount}
          onChange={(e) => setExpectedStudentCount(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="number"
          placeholder="Max Faces Allowed"
          value={maxFacesAllowed}
          onChange={(e) => setMaxFacesAllowed(e.target.value)}
          className="input-field"
          required
          min={1}
        />
        <button type="submit" className="create-button">
          Create
        </button>
      </form>

      <h3 className="session-list-title">Existing Sessions</h3>
      <div className="session-list">
        {Array.isArray(sessions) && sessions.length > 0 ? (
          sessions.map((session) => (
            <div
              key={session._id}
              className="session-card"
              onClick={() => navigate(`/session/${session._id}`)}
            >
              <div className="session-name">{session.sessionName}</div>
              <div className="session-date">
                Created: {new Date(session.startedAt).toLocaleString()}
              </div>
              <div className="session-info">
                Max Faces: {session.maxFacesAllowed || 1}
              </div>
              {session.endedAt && (
                <div className="session-ended">Session ended</div>
              )}
            </div>
          ))
        ) : (
          <p className="no-session-msg">No sessions available.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
