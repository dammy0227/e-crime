import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../services/api';
import './SessionDetail.css';

const SessionDetail = () => {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [violations, setViolations] = useState([]);

  const handleStatusUpdate = async (vid, newStatus) => {
    try {
      await API.put(`/violations/${vid}/status`, { status: newStatus });

      // Re-fetch updated violations
      const res = await API.get(`/sessions/${sessionId}/violations`);
      setViolations(res.data.violations);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resSession = await API.get(`/sessions/${sessionId}`);
        setSession(resSession.data.session);

        const resViolations = await API.get(`/sessions/${sessionId}/violations`);
        setViolations(resViolations.data.violations);
      } catch (err) {
        console.error('Error fetching session or violations:', err);
      }
    };

    fetchData();
  }, [sessionId]);

  if (!session) {
    return <div className="session-loading">Loading session details...</div>;
  }

  return (
    <div className="session-detail-container">
      <h2 className="session-title">Session: {session.sessionName}</h2>
      <p className="session-created">
        Created: {new Date(session.createdAt).toLocaleString()}
      </p>
      <p className="session-max-faces">
        Max Faces Allowed: {session.maxFacesAllowed || 1}
      </p>

      <button
        onClick={() => navigate(`/session/${sessionId}/camera`)}
        className="start-monitoring-button"
      >
        Start Camera Monitoring
      </button>

      <h3 className="violations-heading">Violations</h3>
      {violations.length === 0 ? (
        <p className="no-violations">No violations recorded.</p>
      ) : (
        <div className="violation-grid">
          {violations.map((v) => (
            <div key={v._id} className="violation-card">
              <p className="violation-type">Type: {v.type}</p>
              <p className="violation-time">
                Time: {new Date(v.timestamp).toLocaleTimeString()}
              </p>

              <div className="media-container">
                {v.mediaType === 'video' ? (
                  <video
                    src={`http://localhost:5000/${v.mediaPath}`}
                    controls
                    className="violation-video"
                  />
                ) : v.mediaType === 'audio' ? (
                  <audio src={`http://localhost:5000/${v.mediaPath}`} controls />
                ) : (
                  <img
                    src={`http://localhost:5000/${v.mediaPath}`}
                    alt="violation"
                    className="violation-image"
                  />
                )}
              </div>

              <div className="violation-actions">
                <span className="violation-status">
                  Status: {v.status || 'Pending'}
                </span>
                <div className="action-buttons">
                  <button
                    onClick={() => handleStatusUpdate(v._id, 'Reviewed')}
                    className="review-button"
                  >
                    Mark Reviewed
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(v._id, 'Dismissed')}
                    className="dismiss-button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionDetail;
