import { axiosInstance } from "./api";

/**
 * Analytics API service
 */
export const analyticsService = {
  getSummary: async () => {
    const { data } = await axiosInstance.get("/api/analytics/summary");
    return data;
  },
  getAdmin: async () => {
    const { data } = await axiosInstance.get("/api/analytics/admin");
    return data;
  },
};
