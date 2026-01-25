import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/userSlice";
import messagesReducer from "../features/messagesSlice";
import connectionReducer from "../features/connectionsSlice";

// Configure the Redux store with multiple reducers

export const store = configureStore({
    reducer: {
        user: userReducer,
        messages: messagesReducer,
        connections: connectionReducer,
    },
});

export default store;