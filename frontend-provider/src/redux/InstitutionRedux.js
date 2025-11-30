import { createSlice } from "@reduxjs/toolkit";

const institutionReduxSlice = createSlice({
  name: "institution",
  initialState: {
    brandDetails: {}, // Kept for backward compatibility
    status: false,
    isFetching: false,
    error: false,
  },
  reducers: {
    // --- Fetching Logic ---
    getInstitutionStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getInstitutionSuccess: (state, action) => {
      state.isFetching = false;
      state.brandDetails = action.payload;
      state.status = action.payload.status;
    },
    getInstitutionFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },

    // --- Legacy / Manual Setters ---
    setInstitutionDetails: (state, action) => {
      state.brandDetails = action.payload;
    },
    setInstitutionStatus: (state, action) => {
      state.status = action.payload;
    },
  },
});

export const {
  getInstitutionStart,
  getInstitutionSuccess,
  getInstitutionFailure,
  setInstitutionDetails,
  setInstitutionStatus,
} = institutionReduxSlice.actions;

export default institutionReduxSlice.reducer;
