import { createSlice } from "@reduxjs/toolkit";

const templateLibrarySlice = createSlice({
  name: "templateLibrary",
  initialState: {
    libraryTemplates: [],
    printTemplates: [],
    commTemplates: [],
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
     getPrintTemplates: (state, action) => {
      state.printTemplates = action.payload;
    },
     getCommTemplates: (state, action) => {
      state.commTemplates = action.payload;
    },
  },
});

export const {
  getLibraryStart,
  getLibrarySuccess,
  getLibraryFailure,
  getPrintTemplates,
  getCommTemplates
} = templateLibrarySlice.actions;

export default templateLibrarySlice.reducer;