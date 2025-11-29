import { createSlice } from "@reduxjs/toolkit";

const testSlice = createSlice({
  name: "test",
  initialState: {
    tests: [],       // Local institution tests
    packages: [],    // Local institution packages
    masterTests: [], // Results from master catalog search
    isFetching: false,
    error: false,
  },
  reducers: {
    // Generic Start/Failure
    processStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    processFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },

    // Master Catalog
    getMasterTestsSuccess: (state, action) => {
      state.isFetching = false;
      state.masterTests = action.payload;
    },

    // Local Tests
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

    // Packages
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