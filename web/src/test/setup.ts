import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 每个用例后卸载组件、清空 localStorage，避免用例间互相污染
afterEach(() => {
  cleanup();
  localStorage.clear();
});
