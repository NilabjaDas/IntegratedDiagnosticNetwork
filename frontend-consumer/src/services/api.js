import axios from 'axios';
import { encryptPayload } from './encryption';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/consumer';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // ENCRYPT POST BODY
    if (config.method === 'post' && config.data) {
        config.headers['Content-Type'] = 'text/plain';
        config.data = encryptPayload(config.data, config.url);
    }

    return config;
});

export const sendOtp = async (mobile) => {
    const res = await api.post('/auth/send-otp', { mobile });
    return res.data;
};

export const login = async (mobile, otp) => {
    const res = await api.post('/auth/login', { mobile, otp });
    return res.data;
};

export const register = async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
};

export const getInstitutions = async (query = {}) => {
    const res = await api.get('/booking/institutions', { params: query });
    return res.data;
};
