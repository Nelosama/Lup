import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { sanitizeImage } from "../src/storage/storage.service";
import { currency, publicText } from "../src/common/policy.service";
import { configuration } from "../src/common/config";
describe("security primitives", () => {
  it("accepts ISO currencies and rejects made-up codes", () => {
    expect(currency("EUR")).toBe("EUR");
    expect(() => currency("ZZZ")).toThrow(BadRequestException);
  });
  it("rejects public contact details", () => {
    expect(() => publicText("Write to person@example.com")).toThrow();
    expect(() => publicText("Call +504 9999 8888")).toThrow();
    expect(publicText("Painting and furniture repair")).toBeTruthy();
  });
  it("rejects executable, SVG, mislabeled and oversized images", async () => {
    await expect(sanitizeImage(Buffer.from("<svg></svg>"))).rejects.toThrow();
    await expect(
      sanitizeImage(Buffer.from("MZ executable.jpg")),
    ).rejects.toThrow();
    await expect(
      sanitizeImage(Buffer.alloc(5 * 1024 * 1024 + 1)),
    ).rejects.toThrow();
  });
  it("re-encodes images, bounds dimensions and removes metadata", async () => {
    const input = await sharp({
      create: { width: 1800, height: 300, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "private owner" } } })
      .toBuffer();
    const out = await sanitizeImage(input);
    const m = await sharp(out).metadata();
    expect(m.format).toBe("webp");
    expect(m.width).toBe(1600);
    expect(m.exif).toBeUndefined();
  });
  it("rejects production local mail configuration", () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.MAIL_MODE = "local";
    expect(() => configuration()).toThrow();
    process.env = prev;
  });
});

describe("encrypted mail payloads", () => {
  it("authenticates encrypted reset payloads", async () => {
    const { sealMail, openMail } = await import("../src/auth/mail.service");
    const key = "a".repeat(64);
    const payload = {
      to: "test@example.com",
      subject: "RESET_PASSWORD",
      url: "https://lup.example/reset-password?token=private",
    };
    const cipher = sealMail(payload, key);
    expect(cipher).not.toContain("private");
    expect(openMail(cipher, key)).toEqual(payload);
    expect(() => openMail(cipher, "b".repeat(64))).toThrow();
  });
});
