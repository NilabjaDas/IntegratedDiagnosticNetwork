import { createSlice } from "@reduxjs/toolkit";

const clinicalTestSlice = createSlice({
  name: "clinicalTest",
  initialState: {
    clinicalTests: [], // Renamed from tests
    isFetching: false,
    error: false,
  },
  reducers: {
    getClinicalTestsStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getClinicalTestsSuccess: (state, action) => {
      state.isFetching = false;
      state.clinicalTests = action.payload; // Renamed
    },
    getClinicalTestsFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    }
  },
});

export const { 
    getClinicalTestsStart, 
    getClinicalTestsSuccess, 
    getClinicalTestsFailure 
} = clinicalTestSlice.actions;

export default clinicalTestSlice.reducer;