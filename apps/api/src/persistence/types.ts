import type { ParseError, ParsedInterchange } from "@claim-checker/edi-parser";
import type { UploadStatus } from "@prisma/client";

export type CreateUploadInput = {
  organizationId: string;
  userId: string;
  filename: string;
  byteSize: number;
  contentHash: string;
  storageKey: string;
  status?: UploadStatus;
};

export type PersistParseSuccessInput = {
  organizationId: string;
  uploadId: string;
  actorUserId?: string;
  parsed: ParsedInterchange;
};

export type PersistParseFailureInput = {
  organizationId: string;
  uploadId: string;
  actorUserId?: string;
  errors: ParseError[];
};
