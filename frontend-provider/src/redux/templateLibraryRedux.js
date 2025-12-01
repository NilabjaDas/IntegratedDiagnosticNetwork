import { createSlice } from "@reduxjs/toolkit";

const templateLibrarySlice = createSlice({
  name: "templateLibrary",
  initialState: {
    libraryTemplates: [],
    isFetching: false,
    error: false,
  },
  reducers: {
    getLibraryStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getLibrarySuccess: (state, action) => {
      state.isFetching = false;
      state.libraryTemplates = action.payload;
    },
    getLibraryFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
  },
});

export const {
  getLibraryStart,
  getLibrarySuccess,
  getLibraryFailure,
} = templateLibrarySlice.actions;

export default templateLibrarySlice.reducer;