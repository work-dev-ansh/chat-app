"use client";

import { Provider } from "react-redux";
import { store } from "@/store";

/**
 * Root Redux Toolkit store provider wrapping the client component tree.
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {

  return <Provider store={store}>{children}</Provider>;
}
