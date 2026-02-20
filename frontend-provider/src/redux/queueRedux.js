import { createSlice } from "@reduxjs/toolkit";

const queueSlice = createSlice({
  name: "queue",
  initialState: {
    queue: [],         // Holds the active tokens for the selected department
    isFetching: false,
    error: false,
  },
  reducers: {
    queueProcessStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    queueProcessFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
    // 1. Initial Load: Replaces the whole array with fetched data
    getQueueSuccess: (state, action) => {
      state.isFetching = false;
      state.queue = action.payload;
    },
    // 2. Real-Time Add: Triggered by SSE when Reception creates a new order
    addTokenSuccess: (state, action) => {
      state.isFetching = false;
      // Prevent duplicates just in case SSE fires twice
      const exists = state.queue.find((token) => token._id === action.payload._id);
      if (!exists) {
        state.queue.push(action.payload); // Add new patient to the bottom of the line
      }
    },
    // 3. Real-Time Update: Triggered when a tech clicks Call/Start/Hold/Complete
    updateTokenSuccess: (state, action) => {
      state.isFetching = false;
      const updatedToken = action.payload;
      
      // If the technician marks it COMPLETED, remove it from the active UI
      if (updatedToken.status === 'COMPLETED') {
        state.queue = state.queue.filter((token) => token._id !== updatedToken._id);
      } else {
        // Otherwise, find the token and update its status (e.g., WAITING -> CALLED)
        const index = state.queue.findIndex((token) => token._id === updatedToken._id);
        if (index !== -1) {
          state.queue[index] = updatedToken;
        }
      }
    },
  },
});

export const {
  queueProcessStart,
  queueProcessFailure,
  getQueueSuccess,
  addTokenSuccess,
  updateTokenSuccess,
} = queueSlice.actions;

export default queueSlice.reducer;