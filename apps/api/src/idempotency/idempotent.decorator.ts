import { SetMetadata } from "@nestjs/common";

export const IDEMPOTENT_ROUTE_KEY = "courtlink.idempotent";

export const Idempotent = (): MethodDecorator => SetMetadata(IDEMPOTENT_ROUTE_KEY, true);
