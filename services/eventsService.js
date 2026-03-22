import { axiosInstance } from "./api";

/**
 * Events API service
 */
export const eventsService = {
  getUpcoming: async () => {
    const { data } = await axiosInstance.get("/api/events/upcoming");
    return data;
  },
  getPast: async (cursor) => {
    const params = { limit: 20 };
    if (cursor) params.cursor = cursor;
    const { data } = await axiosInstance.get("/api/events/past", { params });
    return data;
  },
};
