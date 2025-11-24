import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/admin-master';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
