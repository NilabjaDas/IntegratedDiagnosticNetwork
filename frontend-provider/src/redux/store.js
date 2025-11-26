import { configureStore, combineReducers } from "@reduxjs/toolkit";


import tokenReducer from "./tokenRedux";
import uiReducer from "./uiRedux";
import brandReducer from "./brandRedux";

import { CLEAR_ALL_REDUCERS } from "./actionTypes";

import CryptoJS from "crypto-js";

import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

// Encryption function
const encrypt = (data) => {
  return CryptoJS.AES.encrypt(
    JSON.stringify(data),
    process.env.REACT_APP_REDUX_ENCRYPTION_KEY
  ).toString();
};

// Decryption function
const decrypt = (encryptedData) => {
  const bytes = CryptoJS.AES.decrypt(
    encryptedData,
    process.env.REACT_APP_REDUX_ENCRYPTION_KEY
  );
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

const encryptTransform = {
  in: (state) => encrypt(state),
  out: (state) => decrypt(state),
};

const persistConfig = {
  key: "root",
  version: 1,
  storage,
  // storage: secureLocalStorage, // Use secureLocalStorage instead of the default storage
  transforms: [encryptTransform], // Apply encryption and decryption transforms
};

const appReducer = combineReducers({
  [process.env.REACT_APP_ACCESS_TOKEN_KEY]: tokenReducer,
  [process.env.REACT_APP_UI_DATA_KEY]: uiReducer,
  [process.env.REACT_APP_BRAND_DETAILS_KEY] : brandReducer,

});

const rootReducer = (state, action) => {
  if (action.type === CLEAR_ALL_REDUCERS) {
    // Reset only specific reducers
    return appReducer(
      {
        ...state,
        [process.env.REACT_APP_ACCESS_TOKEN_KEY]: undefined,
        [process.env.REACT_APP_UI_DATA_KEY]: undefined,

      },
      action
    );
  }
  return appReducer(state, action);
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),

  devTools: process.env.NODE_ENV !== "production", // Enable DevTools only in development
});

export let persistor = persistStore(store);
