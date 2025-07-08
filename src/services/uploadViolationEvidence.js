import API from './api';

export const uploadViolationEvidence = async (blob, sessionId, violationTypes, type = 'video') => {
  const formData = new FormData();
  formData.append(type, blob, `evidence.${type === 'audio' ? 'webm' : 'webm'}`);
  formData.append('sessionId', sessionId);
  formData.append('violationTypes', JSON.stringify(violationTypes));

  const endpoint = type === 'audio' ? '/upload/audio' : '/upload/video';

  try {
    const response = await API.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    console.log(`✅ ${type} evidence uploaded:`, response.data);
  } catch (err) {
    console.error(`❌ Failed to upload ${type}:`, err);
    throw err;
  }
};
