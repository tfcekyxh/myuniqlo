import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom 没有实现 object URL，照片预览会用到，这里补一个稳定的桩
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-preview";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

// 每个用例后卸载组件、清空 localStorage，避免用例间互相污染
afterEach(() => {
  cleanup();
  localStorage.clear();
});
