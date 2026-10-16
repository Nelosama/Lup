import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { configuration } from "../common/config";
export async function sanitizeImage(buffer: Buffer) {
  if (buffer.length > 5 * 1024 * 1024)
    throw new BadRequestException("Image exceeds 5 MB");
  try {
    const image = sharp(buffer, {
      limitInputPixels: 24000000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("format");
    return await image
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      "Invalid image: use a static JPEG, PNG or WebP",
    );
  }
}
@Injectable()
export class StorageService {
  private client(): SupabaseClient {
    const c = configuration();
    if (!c.SUPABASE_URL || !c.SUPABASE_SERVICE_ROLE_KEY)
      throw new ServiceUnavailableException(
        "Supabase Storage is not configured",
      );
    return createClient(c.SUPABASE_URL, c.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async upload(buffer: Buffer, scope: string) {
    const image = await sanitizeImage(buffer);
    const path = `${scope}/${randomUUID()}.webp`;
    const { error } = await this.client()
      .storage.from(configuration().SUPABASE_STORAGE_BUCKET)
      .upload(path, image, { contentType: "image/webp", upsert: false });
    if (error)
      throw new ServiceUnavailableException("Image storage unavailable");
    return path;
  }
  async remove(path: string) {
    const { error } = await this.client()
      .storage.from(configuration().SUPABASE_STORAGE_BUCKET)
      .remove([path]);
    if (error)
      throw new ServiceUnavailableException("Image storage unavailable");
  }
  async url(path: string) {
    const { data, error } = await this.client()
      .storage.from(configuration().SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(path, 600);
    if (error)
      throw new ServiceUnavailableException("Image storage unavailable");
    return data.signedUrl;
  }
}
