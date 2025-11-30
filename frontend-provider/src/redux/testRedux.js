import { createSlice } from "@reduxjs/toolkit";

const testSlice = createSlice({
  name: "test",
  initialState: {
    tests: [],       
    packages: [],    
    masterTests: [], // The List
    masterPagination: { // NEW: Pagination Meta
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
    },
    isFetching: false,
    error: false,
  },
  reducers: {
    processStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    processFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
    
    // Updated to handle { data, pagination } structure
    getMasterTestsSuccess: (state, action) => {
      state.isFetching = false;
      state.masterTests = action.payload.data;
      state.masterPagination = action.payload.pagination;
    },

    // ... (Keep other existing reducers like getTestsSuccess, etc.) ...
    getTestsSuccess: (state, action) => {
      state.isFetching = false;
      state.tests = action.payload;
    },
    addTestSuccess: (state, action) => {
      state.isFetching = false;
      state.tests.push(action.payload);
    },
    updateTestSuccess: (state, action) => {
      state.isFetching = false;
      state.tests = state.tests.map((item) =>
        item._id === action.payload._id ? action.payload : item
      );
    },
    deleteTestSuccess: (state, action) => {
      state.isFetching = false;
      state.tests = state.tests.filter((item) => item._id !== action.payload);
    },
    getPackagesSuccess: (state, action) => {
      state.isFetching = false;
      state.packages = action.payload;
    },
    addPackageSuccess: (state, action) => {
      state.isFetching = false;
      state.packages.push(action.payload);
    },
    updatePackageSuccess: (state, action) => {
      state.isFetching = false;
      state.packages = state.packages.map((item) =>
        item._id === action.payload._id ? action.payload : item
      );
    },
    deletePackageSuccess: (state, action) => {
      state.isFetching = false;
      state.packages = state.packages.filter((item) => item._id !== action.payload);
    },
  },
});

export const {
  processStart,
  processFailure,
  getMasterTestsSuccess,
  getTestsSuccess,
  addTestSuccess,
  updateTestSuccess,
  deleteTestSuccess,
  getPackagesSuccess,
  addPackageSuccess,
  updatePackageSuccess,
  deletePackageSuccess,
} = testSlice.actions;

export default testSlice.reducer;