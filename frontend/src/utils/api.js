import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api',
});

export const searchNearbySlots = (params) => API.get('/search/nearby', { params });

export default API;
