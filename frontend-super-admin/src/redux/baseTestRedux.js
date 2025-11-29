import { createSlice } from "@reduxjs/toolkit";

const baseTestSlice = createSlice({
  name: "baseTest",
  initialState: {
    tests: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    },
    isFetching: false,
    error: false,
  },
  reducers: {
    getTestsStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getTestsSuccess: (state, action) => {
      state.isFetching = false;
      state.tests = action.payload.data;
      state.pagination = action.payload.pagination;
    },
    getTestsFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
  },
});

export const {
  getTestsStart,
  getTestsSuccess,
  getTestsFailure,
} = baseTestSlice.actions;

export default baseTestSlice.reducer;