import axios from 'axios';

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
    return config;
});

export const login = async (username, password) => {
    const res = await api.post('/authenticate/login-staff', { username, password });
    return res.data;
};

// Mock function for orders
export const getOrders = async () => {
    // In real app: return api.get('/orders');
    return new Promise(resolve => setTimeout(() => resolve([
        { id: '1', patient: 'John Doe', test: 'CBC', status: 'Pending' },
        { id: '2', patient: 'Jane Smith', test: 'Lipid Profile', status: 'Completed' },
    ]), 500));
};
