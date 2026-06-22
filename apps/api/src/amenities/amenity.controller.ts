import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: AmenityService is injected by Nest at runtime.
import { AmenityService } from "./amenity.service.js";

@Controller({ path: "amenities", version: "1" })
export class AmenityController {
  constructor(private readonly amenities: AmenityService) {}

  @Public()
  @Get()
  async listCatalog() {
    const catalog = await this.amenities.listCatalog();
    return catalog.map(({ key, name, scope }) => ({ key, name, scope }));
  }
}
