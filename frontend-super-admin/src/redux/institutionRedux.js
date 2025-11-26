import { createSlice } from "@reduxjs/toolkit";

const institutionSlice = createSlice({
  name: "institution",
  initialState: {
    institutions: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    },
    isFetching: false,
    error: false,
  },
  reducers: {
    getInstitutionsStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getInstitutionsSuccess: (state, action) => {
      state.isFetching = false;
      state.institutions = action.payload.data;
      state.pagination = action.payload.pagination;
    },
    getInstitutionsFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
    // Optional: Actions to update state locally without fetching (Optimistic UI)
    resetInstitutions: (state) => {
      state.institutions = [];
      state.pagination = { total: 0, page: 1, limit: 10, totalPages: 0 };
    }
  },
});

export const {
  getInstitutionsStart,
  getInstitutionsSuccess,
  getInstitutionsFailure,
  resetInstitutions,
} = institutionSlice.actions;

export default institutionSlice.reducer;