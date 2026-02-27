import { createSlice } from "@reduxjs/toolkit";

const queueSlice = createSlice({
  name: "queue",
  initialState: {
    queue: [],
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

    // 3. Real-Time Update: Triggered when a tech clicks Call/Start/Hold/Complete
    updateTokenSuccess: (state, action) => {
      state.isFetching = false;
      const updatedToken = action.payload;
      
      if (updatedToken.status === 'COMPLETED') {
        state.queue = state.queue.filter((token) => token._id !== updatedToken._id);
      } else {
        const index = state.queue.findIndex((token) => token._id === updatedToken._id);
        if (index !== -1) {
          state.queue[index] = updatedToken;
        } else {
          // CRITICAL FIX: Add it if it wasn't in the list
          state.queue.push(updatedToken);
        }
      }
    },
 
  },
});

export const {
  queueProcessStart,
  queueProcessFailure,
  getQueueSuccess,
  updateTokenSuccess,

} = queueSlice.actions;

export default queueSlice.reducer;