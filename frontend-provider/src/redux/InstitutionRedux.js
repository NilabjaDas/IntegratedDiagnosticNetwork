import { createSlice } from "@reduxjs/toolkit";

const institutionReduxSlice = createSlice({
  name: "institution",
  initialState: {
    brandDetails: {},
    status: false,
  },
  reducers: {
    setInstitutionDetails : (state, action) => {
      state.brandDetails = action.payload;
    },
     setInstitutionStatus : (state, action) => {
      state.status = action.payload;
    },
  },
});

export const {
  setInstitutionDetails, setInstitutionStatus
} = institutionReduxSlice.actions;

export default institutionReduxSlice.reducer;
