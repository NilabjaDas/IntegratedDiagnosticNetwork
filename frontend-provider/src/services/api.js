import axios from 'axios';
import { encryptPayload } from './encryption';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({
    baseURL: API_URL,
});

// Helper to get subdomain/dev code
const getHeaders = () => {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // DEV MODE: Allow setting institution code manually
    const devCode = localStorage.getItem('dev_institution_code');
    if (devCode) {
        headers['x-institution-code'] = devCode;
    }

    return headers;
};

api.interceptors.request.use((config) => {
    config.headers = { ...config.headers, ...getHeaders() };

    // ENCRYPT POST BODY
    if (config.method === 'post' && config.data) {
        config.headers['Content-Type'] = 'text/plain';
        config.data = encryptPayload(config.data, config.url);
    }

    return config;
});

export const login = async (username, password) => {
    const res = await api.post('/authenticate/login-staff', { username, password });
    return res.data;
};

export const getOrders = async () => {
    // Real API call
    // Note: The route might be /bookings or /orders depending on backend implementation.
    // Based on index.js: app.use("/api/orders", OrderRoute);
    const res = await api.get('/orders');
    return res.data;
};
