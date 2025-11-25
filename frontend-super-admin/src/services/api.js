import axios from 'axios';
import { encryptPayload } from './encryption';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/admin-master';

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
        config.headers['Content-Type'] = 'text/plain'; // Tell server it's raw text
        config.data = encryptPayload(config.data, config.url);
    }

    return config;
});

export const login = async (username, password) => {
    const res = await api.post('/login', { username, password });
    return res.data;
};

export const getInstitutions = async () => {
    const res = await api.get('/institutions');
    return res.data;
};

export const createInstitution = async (data) => {
    const res = await api.post('/institutions', data);
    return res.data;
};

export const updateInstitution = async (id, data) => {
    const res = await api.put(`/institutions/${id}`, data);
    return res.data;
};

export const deleteInstitution = async (id) => {
    const res = await api.delete(`/institutions/${id}`);
    return res.data;
};

export const deactivateInstitution = async (id, status) => {
    const res = await api.put(`/institutions/${id}/status`, { status });
    return res.data;
};

export const createUser = async (institutionId, data) => {
    const res = await api.post(`/users/${institutionId}`, data);
    return res.data;
};
