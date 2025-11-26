import { createSlice } from "@reduxjs/toolkit";

const brandReduxSlice = createSlice({
  name: "brand",
  initialState: {
    brandDetails: {},

  },
  reducers: {
    setBrandDetails : (state, action) => {
      state.brandDetails = action.payload;
    },

  },
});

export const {
  setBrandDetails,
} = brandReduxSlice.actions;

export default brandReduxSlice.reducer;
