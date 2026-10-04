import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocationDetail from "./LocationDetail.tsx";
import { api, type ClothingItem } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      clothes: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    },
  };
});

const CLOTHES: ClothingItem[] = [
  {
    id: 1,
    locationId: 7,
    name: "黑色羽绒服",
    photoUrl: "https://example.com/a.png",
    createdAt: "2026-10-04T00:00:00.000Z",
  },
  {
    id: 2,
    locationId: 7,
    name: "灰色卫衣",
    photoUrl: "https://example.com/b.png",
    createdAt: "2026-10-04T00:00:00.000Z",
  },
];

function renderDetail(location: { id: number | null; name: string }) {
  const onChanged = vi.fn();
  return {
    onChanged,
    ...render(
      <LocationDetail
        location={location}
        onBack={vi.fn()}
        onAdd={vi.fn()}
        onChanged={onChanged}
      />,
    ),
  };
}

describe("LocationDetail 地点相册", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.clothes.list).mockResolvedValue({ clothes: CLOTHES });
    vi.mocked(api.clothes.remove).mockResolvedValue({ ok: true });
  });

  it("展示该地点的衣物照片与件数", async () => {
    renderDetail({ id: 7, name: "主卧衣柜" });

    expect(await screen.findByAltText("黑色羽绒服")).toBeVisible();
    expect(screen.getByAltText("灰色卫衣")).toBeVisible();
    expect(screen.getByText("共 2 件衣物")).toBeVisible();
    expect(api.clothes.list).toHaveBeenCalledWith({ locationId: 7 });
  });

  it("未分配分组走 unassigned 查询", async () => {
    renderDetail({ id: null, name: "未分配" });

    await waitFor(() =>
      expect(api.clothes.list).toHaveBeenCalledWith({ unassigned: true }),
    );
  });

  it("没有衣物时展示空态", async () => {
    vi.mocked(api.clothes.list).mockResolvedValue({ clothes: [] });
    renderDetail({ id: 7, name: "主卧衣柜" });

    expect(await screen.findByText("这个地点还没有衣物，点「添加」录一件")).toBeVisible();
  });

  it("删除衣物需二次确认，确认后刷新并通知父级", async () => {
    const { onChanged } = renderDetail({ id: 7, name: "主卧衣柜" });
    await screen.findByAltText("黑色羽绒服");

    await userEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    expect(await screen.findByText(/删除「黑色羽绒服」/)).toBeVisible();
    expect(api.clothes.remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(api.clothes.remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
