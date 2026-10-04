import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./Home.tsx";
import { api, type LocationItem, type MeStats } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      login: vi.fn(),
      locations: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    },
  };
});

const STATS: MeStats = { locations: 2, clothes: 3 };

const LOCATIONS: LocationItem[] = [
  {
    id: 1,
    name: "主卧衣柜",
    note: "靠窗那一个",
    createdAt: "2026-10-04T00:00:00.000Z",
    clothesCount: 3,
  },
  {
    id: 2,
    name: "次卧储物箱",
    note: null,
    createdAt: "2026-10-04T00:00:00.000Z",
    clothesCount: 0,
  },
];

function renderHome() {
  return render(
    <Home
      user={{ id: 1, username: "admin" }}
      stats={STATS}
      onLogout={vi.fn()}
      onStatsChange={vi.fn()}
    />,
  );
}

describe("Home 地点管理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.locations.list).mockResolvedValue({ locations: LOCATIONS });
    vi.mocked(api.me).mockResolvedValue({
      user: { id: 1, username: "admin" },
      stats: STATS,
    });
  });

  it("展示地点列表与各地点的衣物数量", async () => {
    renderHome();

    expect(await screen.findByText("主卧衣柜")).toBeVisible();
    expect(screen.getByText("次卧储物箱")).toBeVisible();
    expect(screen.getByText("3 件衣物")).toBeVisible();
    expect(screen.getByText("0 件衣物")).toBeVisible();
  });

  it("列表为空时展示空态提示", async () => {
    vi.mocked(api.locations.list).mockResolvedValue({ locations: [] });
    renderHome();

    expect(await screen.findByText("还没有地点，先建一个吧")).toBeVisible();
  });

  it("新建地点后提交并刷新列表与统计", async () => {
    vi.mocked(api.locations.create).mockResolvedValue({
      location: {
        id: 3,
        name: "阳台晾衣架",
        note: null,
        createdAt: "2026-10-04T00:00:00.000Z",
        clothesCount: 0,
      },
    });
    renderHome();
    await screen.findByText("主卧衣柜");

    await userEvent.click(screen.getByRole("button", { name: "新建地点" }));
    await userEvent.type(screen.getByLabelText("名称"), "阳台晾衣架");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(api.locations.create).toHaveBeenCalledWith({ name: "阳台晾衣架", note: "" }),
    );
    // 保存后应重新拉取列表
    await waitFor(() => expect(api.locations.list).toHaveBeenCalledTimes(2));
  });

  it("编辑地点时表单预填原名称与原备注", async () => {
    vi.mocked(api.locations.update).mockResolvedValue({
      location: { ...LOCATIONS[0], name: "主卧大衣柜" },
    });
    renderHome();
    await screen.findByText("主卧衣柜");

    await userEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);

    const nameInput = await screen.findByLabelText("名称");
    expect(nameInput).toHaveValue("主卧衣柜");
    expect(screen.getByLabelText("备注（可选）")).toHaveValue("靠窗那一个");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "主卧大衣柜");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(api.locations.update).toHaveBeenCalledWith(1, {
        name: "主卧大衣柜",
        note: "靠窗那一个",
      }),
    );
  });

  it("删除地点需要二次确认才真正调用接口", async () => {
    vi.mocked(api.locations.remove).mockResolvedValue({ ok: true });
    renderHome();
    await screen.findByText("主卧衣柜");

    await userEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);

    // 只弹出确认框，尚未删除
    expect(await screen.findByText(/删除「主卧衣柜」/)).toBeVisible();
    expect(api.locations.remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(api.locations.remove).toHaveBeenCalledWith(1));
  });
});
