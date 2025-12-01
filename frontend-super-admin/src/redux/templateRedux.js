import { createSlice } from "@reduxjs/toolkit";

const templateSlice = createSlice({
  name: "template",
  initialState: {
    templates: [],
    isFetching: false,
    error: false,
    pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
    },
    currentTemplate: null // For editor view
  },
  reducers: {
    getTemplatesStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getTemplatesSuccess: (state, action) => {
      state.isFetching = false;
      state.templates = action.payload.data;
      state.pagination = action.payload.pagination;
    },
    getTemplateByIdSuccess: (state, action) => {
      state.isFetching = false;
      state.currentTemplate = action.payload;
    },
    getTemplatesFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
    addTemplateSuccess: (state, action) => {
        state.isFetching = false;
        state.templates.unshift(action.payload);
        state.pagination.total += 1;
    },
    updateTemplateSuccess: (state, action) => {
        state.isFetching = false;
        state.templates = state.templates.map((item) =>
            item._id === action.payload._id ? action.payload : item
        );
        state.currentTemplate = action.payload; // Update current if viewing
    },
    deleteTemplateSuccess: (state, action) => {
        state.isFetching = false;
        state.templates = state.templates.filter((item) => item._id !== action.payload);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
    clearCurrentTemplate: (state) => {
        state.currentTemplate = null;
    }
  },
});

export const {
  getTemplatesStart,
  getTemplatesSuccess,
  getTemplateByIdSuccess,
  getTemplatesFailure,
  addTemplateSuccess,
  updateTemplateSuccess,
  deleteTemplateSuccess,
  clearCurrentTemplate
} = templateSlice.actions;

export default templateSlice.reducer;