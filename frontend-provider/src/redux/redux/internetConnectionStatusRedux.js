import { createSlice } from "@reduxjs/toolkit";

const internetConnectionStatusRedux = createSlice({
  name: "internetConnectionStatus",
  initialState: {
    internetConnectionStatusStored: null
  },
  reducers: {
    internet: (state, action) =>{
      state.internetConnectionStatusStored = action.payload
    }
  },
});

export const { internet } =
internetConnectionStatusRedux.actions;

export default internetConnectionStatusRedux.reducer;
