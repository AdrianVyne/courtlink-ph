import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: FavoriteService is injected at runtime by Nest.
import { FavoriteService } from "./favorite.service.js";

const addSchema = z.object({ venueId: z.string().uuid() });

@Controller({ path: "favorites", version: "1" })
export class FavoriteController {
  constructor(private readonly favorites: FavoriteService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return this.favorites.list(user.id);
  }

  @Get("venues/:venueId")
  async status(@Req() request: AuthenticatedRequest, @Param("venueId") venueId: string) {
    const user = getSessionUser(request);
    return { favorite: await this.favorites.isFavorite(user.id, venueId) };
  }

  @Post()
  @HttpCode(201)
  async add(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = addSchema.parse(body);
    await this.favorites.add(user.id, input.venueId);
    return { favorite: true };
  }

  @Delete("venues/:venueId")
  @HttpCode(200)
  async remove(@Req() request: AuthenticatedRequest, @Param("venueId") venueId: string) {
    const user = getSessionUser(request);
    await this.favorites.remove(user.id, venueId);
    return { favorite: false };
  }
}
