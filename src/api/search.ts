import api from './client';

export const searchApi = {
  search: (params: { q: string; scope?: string; page?: number; page_size?: number; status?: number }) =>
    api.get('/search/', { params }),
};
