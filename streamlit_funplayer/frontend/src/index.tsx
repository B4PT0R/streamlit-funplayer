import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import StreamlitFunPlayer from "./StreamlitFunPlayer"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <StreamlitFunPlayer />
  </StrictMode>
)
