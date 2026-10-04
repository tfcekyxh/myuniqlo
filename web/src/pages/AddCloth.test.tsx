import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddCloth from "./AddCloth.tsx";
import { api, type LocationItem } from "@/api";

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

const LOCATIONS: LocationItem[] = [
  { id: 7, name: "主卧衣柜", note: null, createdAt: "", clothesCount: 0 },
  { id: 8, name: "次卧储物箱", note: null, createdAt: "", clothesCount: 0 },
];

function renderAddCloth(onDone = vi.fn()) {
  return {
    onDone,
    ...render(
      <AddCloth
        locations={LOCATIONS}
        defaultLocationId={null}
        onDone={onDone}
        onCancel={vi.fn()}
      />,
    ),
  };
}

function photoFile(): File {
  return new File(["dummy-bytes"], "cloth.png", { type: "image/png" });
}

describe("AddCloth 添加衣物", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.clothes.create).mockResolvedValue({
      clothing: {
        id: 1,
        locationId: 7,
        name: "黑色羽绒服",
        photoUrl: "https://example.com/a.png",
        createdAt: "",
      },
    });
  });

  it("未选照片时保存会被拦截，且不调用接口", async () => {
    renderAddCloth();

    await userEvent.type(screen.getByLabelText("名称"), "黑色羽绒服");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("请拍照或选择一张衣物照片")).toBeVisible();
    expect(api.clothes.create).not.toHaveBeenCalled();
  });

  it("选中照片后用 FormData 提交名称、文件与地点", async () => {
    const { onDone } = renderAddCloth();

    await userEvent.upload(screen.getByLabelText("照片（必填）"), photoFile());
    await userEvent.type(screen.getByLabelText("名称"), "黑色羽绒服");
    await userEvent.selectOptions(screen.getByLabelText("归属地点（可选）"), "7");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(api.clothes.create).toHaveBeenCalledTimes(1));

    const form = vi.mocked(api.clothes.create).mock.calls[0][0];
    expect(form.get("name")).toBe("黑色羽绒服");
    expect(form.get("locationId")).toBe("7");
    expect(form.get("photo")).toBeInstanceOf(File);
    expect(onDone).toHaveBeenCalled();
  });

  it("不指定地点时 FormData 不带 locationId", async () => {
    renderAddCloth();

    await userEvent.upload(screen.getByLabelText("照片（必填）"), photoFile());
    await userEvent.type(screen.getByLabelText("名称"), "围巾");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(api.clothes.create).toHaveBeenCalledTimes(1));
    const form = vi.mocked(api.clothes.create).mock.calls[0][0];
    expect(form.get("locationId")).toBeNull();
  });

  it("接口报错时展示后端文案且不回调 onDone", async () => {
    vi.mocked(api.clothes.create).mockRejectedValue(
      new Error("照片过大，请上传 10MB 以内的图片"),
    );
    const { onDone } = renderAddCloth();

    await userEvent.upload(screen.getByLabelText("照片（必填）"), photoFile());
    await userEvent.type(screen.getByLabelText("名称"), "大衣");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("照片过大，请上传 10MB 以内的图片")).toBeVisible();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("默认选中传入的地点", async () => {
    render(
      <AddCloth
        locations={LOCATIONS}
        defaultLocationId={8}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("归属地点（可选）")).toHaveValue("8");
  });
});
