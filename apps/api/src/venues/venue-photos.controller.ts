import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
import { Idempotent } from "../idempotency/idempotent.decorator.js";
// biome-ignore lint/style/useImportType: VenuePhotoService is injected by Nest at runtime.
import { VenuePhotoService } from "./venue-photos.service.js";

const patchSchema = z
  .object({
    altText: z.string().min(5).max(200).optional(),
    position: z.number().int().min(0).max(7).optional(),
  })
  .refine((value) => value.altText !== undefined || value.position !== undefined, {
    message: "Provide altText or position",
  });

interface MultipartRequest {
  file(): Promise<
    | {
        mimetype: string;
        toBuffer(): Promise<Buffer>;
        fields: Record<string, { value?: string } | undefined>;
      }
    | undefined
  >;
}

@Controller({ version: "1" })
export class VenuePhotosController {
  constructor(private readonly photos: VenuePhotoService) {}

  @Idempotent()
  @Post("venues/:venueId/photos")
  @HttpCode(201)
  async upload(@Req() request: AuthenticatedRequest, @Param("venueId") venueId: string) {
    const user = getSessionUser(request);
    const file = await (request as unknown as MultipartRequest).file();
    if (!file) throw new BadRequestException({ code: "PHOTO_FILE_REQUIRED" });
    const buffer = await file.toBuffer();
    return this.photos.addPhoto({
      userId: user.id,
      venueId,
      altText: String(file.fields.altText?.value ?? ""),
      file: { buffer, contentType: file.mimetype, sizeBytes: buffer.length },
    });
  }

  @Patch("venues/:venueId/photos/:photoId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("venueId") venueId: string,
    @Param("photoId") photoId: string,
    @Body() body: unknown,
  ) {
    const user = getSessionUser(request);
    const patch = patchSchema.parse(body);
    return this.photos.updatePhoto({ userId: user.id, venueId, photoId, ...patch });
  }

  @Delete("venues/:venueId/photos/:photoId")
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("venueId") venueId: string,
    @Param("photoId") photoId: string,
  ) {
    const user = getSessionUser(request);
    await this.photos.removePhoto({ userId: user.id, venueId, photoId });
  }

  @Public()
  @Get("venue-photos/:photoId")
  async publicPhoto(
    @Param("photoId") photoId: string,
    @Res() reply: { header(name: string, value: string): unknown; redirect(url: string): unknown },
  ) {
    const url = await this.photos.publicPhotoUrl(photoId);
    reply.header("Cache-Control", "public, max-age=86400");
    reply.redirect(url);
  }
}
