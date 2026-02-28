import { ApiClient } from './api-client';
import { getApiBaseUrl } from '../config/public-config';

export const apiClient: ApiClient = new ApiClient({ baseUrl: getApiBaseUrl() });

