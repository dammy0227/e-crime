// Imports
import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as faceMesh from '@tensorflow-models/facemesh';
import * as blazeface from '@tensorflow-models/blazeface';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';
import { uploadViolationEvidence } from '../../services/uploadViolationEvidence';
import API from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './CameraPage.css';

const CameraPage = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [faceModel, setFaceModel] = useState(null);
  const [objectModel, setObjectModel] = useState(null);
  const [meshModel, setMeshModel] = useState(null);
  const [toast, setToast] = useState('');
  const [maxFacesAllowed, setMaxFacesAllowed] = useState(1);
  const { id: sessionId } = useParams();
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const lastViolationRef = useRef({});
  const lastVoiceViolationRef = useRef(0);
  const lastHeadTurnRef = useRef(0);
  const micCleanupRef = useRef(null);

  const notify = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => {
    API.get(`/sessions/${sessionId}`)
      .then(res => setMaxFacesAllowed(res.data.session.maxFacesAllowed || 1))
      .catch(console.error);
  }, [sessionId]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', sessionId }));
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'violation') notify(`⚠️ Server violation: ${message.details}`);
    };
    ws.onerror = err => console.error('WebSocket error', err);
    ws.onclose = () => console.log('WebSocket closed');
    return () => ws.close();
  }, [sessionId]);

  const captureEvidence = useCallback(async (types, isAudio = false) => {
    try {
      let stream;
      if (isAudio) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (webcamRef.current?.stream) {
        stream = webcamRef.current.stream;
      } else {
        console.error("No media stream available");
        return;
      }

      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, {
          type: isAudio ? 'audio/webm' : 'video/webm',
        });

        try {
          await uploadViolationEvidence(blob, sessionId, types, isAudio ? 'audio' : 'video');
        } catch (err) {
          console.error('Upload failed:', err);
        }

        if (isAudio) {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 5000);
    } catch (err) {
      console.error('Capture failed:', err);
    }
  }, [sessionId]);

  const handleViolation = useCallback(async (types, isAudio = false) => {
    const now = Date.now();
    const uniqueKey = types.join('-');
    if (now - (lastViolationRef.current[uniqueKey] || 0) < 10000) return;

    lastViolationRef.current[uniqueKey] = now;
    notify(`🚨 Violation: ${types.join(', ')}`);

    // Play alert ONLY for multiple faces
    if (types.includes('Multiple Faces Detected')) {
      new Audio('/alert.mp3').play();
    }

    await captureEvidence(types, isAudio);
  }, [captureEvidence]);

  const detect = useCallback(async () => {
    if (!faceModel || !objectModel || !running) return;
    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4) return;

    const [faces, objects] = await Promise.all([
      faceModel.estimateFaces(video, false),
      objectModel.detect(video)
    ]);

    const violations = [];

    if (faces.length > maxFacesAllowed) {
      violations.push('Multiple Faces Detected');
    } else if (faces.length === 0) {
      violations.push('No Face Detected');
    }

    objects.forEach(obj => {
      const label = obj.class.toLowerCase();
      if (['cell phone', 'book'].includes(label)) {
        violations.push(`${label.charAt(0).toUpperCase() + label.slice(1)} Detected`);
      }
    });

    if (violations.length > 0) {
      await handleViolation(violations);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach(pred => {
      const [x, y] = pred.topLeft;
      const [x2, y2] = pred.bottomRight;
      ctx.strokeStyle = 'blue';
      ctx.strokeRect(x, y, x2 - x, y2 - y);
    });

    objects.forEach(pred => {
      const [x, y, width, height] = pred.bbox;
      ctx.strokeStyle = ['cell phone', 'book'].includes(pred.class.toLowerCase()) ? 'red' : 'green';
      ctx.strokeRect(x, y, width, height);
    });
  }, [faceModel, objectModel, maxFacesAllowed, handleViolation, running]);

  const initMicVolumeDetection = useCallback(() => {
    let micStream;
    let audioCtx;
    let analyser;
    let dataArray;

    const setup = async () => {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        const check = () => {
          if (!running) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

          if (avg > 25) {
            const now = Date.now();
            if (now - lastVoiceViolationRef.current > 10000) {
              lastVoiceViolationRef.current = now;
              handleViolation(['Talking Detected'], true);
            }
          }
          requestAnimationFrame(check);
        };
        check();
      } catch (err) {
        console.error('Mic error:', err);
      }
    };

    setup();

    return () => {
      if (micStream) micStream.getTracks().forEach(track => track.stop());
      if (audioCtx) audioCtx.close();
    };
  }, [handleViolation, running]);

  useEffect(() => {
    const loadMesh = async () => {
      await tf.setBackend('webgl');
      const model = await faceMesh.load();
      setMeshModel(model);
    };
    loadMesh();
  }, []);

  useEffect(() => {
    let rafId;

    const detectHeadTurn = async () => {
      if (!meshModel || !running) {
        rafId = requestAnimationFrame(detectHeadTurn);
        return;
      }

      const video = webcamRef.current?.video;
      if (!video || video.readyState < 2) {
        rafId = requestAnimationFrame(detectHeadTurn);
        return;
      }

      const input = tf.browser.fromPixels(video);
      const predictions = await meshModel.estimateFaces(input);
      input.dispose();

      if (predictions.length > 0) {
        const keypoints = predictions[0].scaledMesh;
        const leftEye = keypoints[33];
        const rightEye = keypoints[263];
        const dx = rightEye[0] - leftEye[0];
        const dy = rightEye[1] - leftEye[1];
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        if (angle > 20 || angle < -20) {
          const now = Date.now();
          if (now - lastHeadTurnRef.current > 10000) {
            lastHeadTurnRef.current = now;
            await handleViolation(['Head Turn Detected']);
          }
        }
      }

      rafId = requestAnimationFrame(detectHeadTurn);
    };

    if (running) {
      rafId = requestAnimationFrame(detectHeadTurn);
    }

    return () => cancelAnimationFrame(rafId);
  }, [meshModel, running, handleViolation]);

  useEffect(() => {
    let interval;

    if (running && faceModel && objectModel) {
      interval = setInterval(detect, 3000);
      micCleanupRef.current = initMicVolumeDetection();
    }

    return () => {
      clearInterval(interval);
      if (typeof micCleanupRef.current === 'function') {
        micCleanupRef.current();
        micCleanupRef.current = null;
      }
    };
  }, [running, detect, faceModel, objectModel, initMicVolumeDetection]);

  useEffect(() => {
    const load = async () => {
      const face = await blazeface.load();
      const object = await cocoSsd.load();
      setFaceModel(face);
      setObjectModel(object);
    };
    load();
  }, []);

  const stopWebcamStream = () => {
    const tracks = webcamRef.current?.stream?.getTracks();
    tracks?.forEach(track => track.stop());
  };

  const handleMonitoringToggle = () => {
    if (running) {
      setRunning(false);
      stopWebcamStream();

      if (typeof micCleanupRef.current === 'function') {
        micCleanupRef.current();
        micCleanupRef.current = null;
      }

      logout();
      navigate('/');
    } else {
      setRunning(true);
      notify('Monitoring started');
    }
  };

  return (
    <div className="camera-container">
      {toast && <div className="toast">{toast}</div>}
      <h2>Live Monitoring (Max Faces: {maxFacesAllowed})</h2>
      <div className="camera-wrapper">
        <Webcam
          audio={false}
          ref={webcamRef}
          videoConstraints={{ width: 1920, height: 1080, facingMode: 'user' }}
          onUserMedia={stream => webcamRef.current.stream = stream}
        />
        <canvas ref={canvasRef} className="camera-canvas" />
      </div>
      <button onClick={handleMonitoringToggle} className={`monitor-button ${running ? 'stop' : 'start'}`}>
        {running ? 'Stop Monitoring' : 'Start Monitoring'}
      </button>
    </div>
  );
};

export default CameraPage;
