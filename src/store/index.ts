import { configureStore } from "@reduxjs/toolkit";
import { chatReducer } from "./slices/chat-slice";
import { uiReducer } from "./slices/ui-slice";

/**
 * Central Redux Store configured with Redux Toolkit.
 * Manages normalized messages, conversation summaries, presence, and active chat drafts.
 */
export const store = configureStore({
  reducer: {
    chat: chatReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

