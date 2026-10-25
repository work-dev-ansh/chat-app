import { createSlice, createSelector, type PayloadAction } from "@reduxjs/toolkit";
import type { ChatMessage } from "@/contracts/message";
import type { RootState } from "../index";

interface UIState {
  isNewChatModalOpen: boolean;
  isForwardModalOpen: boolean;
  messageToForward: ChatMessage | null;
  draggedMessage: ChatMessage | null;
  isUploadingMedia: boolean;
  uploadProgress: number; // 0 to 100
}

const initialState: UIState = {
  isNewChatModalOpen: false,
  isForwardModalOpen: false,
  messageToForward: null,
  draggedMessage: null,
  isUploadingMedia: false,
  uploadProgress: 0,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setNewChatModalOpen(state, action: PayloadAction<boolean>) {
      state.isNewChatModalOpen = action.payload;
    },
    openForwardModal(state, action: PayloadAction<ChatMessage>) {
      state.isForwardModalOpen = true;
      state.messageToForward = action.payload;
    },
    closeForwardModal(state) {
      state.isForwardModalOpen = false;
      state.messageToForward = null;
    },
    setDraggedMessage(state, action: PayloadAction<ChatMessage | null>) {
      state.draggedMessage = action.payload;
    },
    setMediaUploading(
      state,
      action: PayloadAction<{ isUploading: boolean; progress?: number }>,
    ) {
      state.isUploadingMedia = action.payload.isUploading;
      if (action.payload.progress !== undefined) {
        state.uploadProgress = action.payload.progress;
      }
    },
  },
});

export const {
  setNewChatModalOpen,
  openForwardModal,
  closeForwardModal,
  setDraggedMessage,
  setMediaUploading,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

export const selectUIState = (state: RootState) => state.ui;
export const selectIsNewChatModalOpen = (state: RootState) =>
  state.ui.isNewChatModalOpen;
export const selectIsForwardModalOpen = (state: RootState) =>
  state.ui.isForwardModalOpen;
export const selectMessageToForward = (state: RootState) =>
  state.ui.messageToForward;

export const selectForwardState = createSelector(
  [selectIsForwardModalOpen, selectMessageToForward],
  (isOpen, message) => ({ isOpen, message }),
);

export const selectDraggedMessage = (state: RootState) => state.ui.draggedMessage;
export const selectIsUploadingMedia = (state: RootState) => state.ui.isUploadingMedia;
export const selectUploadProgress = (state: RootState) => state.ui.uploadProgress;

export const selectUploadState = createSelector(
  [selectIsUploadingMedia, selectUploadProgress],
  (isUploading, progress) => ({ isUploading, progress }),
);
