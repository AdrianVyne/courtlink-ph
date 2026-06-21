import { Global, Module } from "@nestjs/common";
import { OBJECT_STORAGE } from "../auth/tokens.js";
import { S3ObjectStorage, s3ConfigFromEnv } from "./s3-object-storage.js";

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: () => new S3ObjectStorage(s3ConfigFromEnv()),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
