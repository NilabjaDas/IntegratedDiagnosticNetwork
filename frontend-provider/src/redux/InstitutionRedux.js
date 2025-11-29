import { createSlice } from "@reduxjs/toolkit";

const institutionReduxSlice = createSlice({
  name: "institution",
  initialState: {
    brandDetails: {},

  },
  reducers: {
    setInstitutionDetails : (state, action) => {
      state.brandDetails = action.payload;
    },

  },
});

export const {
  setInstitutionDetails,
} = institutionReduxSlice.actions;

export default institutionReduxSlice.reducer;
