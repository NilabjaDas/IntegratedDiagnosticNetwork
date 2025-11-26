// In a file named actionTypes.js

export const CLEAR_ALL_REDUCERS = 'CLEAR_ALL_REDUCERS';
export const SET_THEME = "SET_THEME";
export const SET_PAGE_LOCATION = "SET_PAGE_LOCATION";
export function getScreenSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  }
