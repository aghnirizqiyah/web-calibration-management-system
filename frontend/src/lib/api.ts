import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Set role header otomatis di setiap request
export const setRole = (role: 'admin' | 'user') => {
  api.defaults.headers.common['x-role'] = role;
};

export default api;