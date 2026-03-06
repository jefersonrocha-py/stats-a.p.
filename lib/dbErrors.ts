type Mapped = { status: number; body: Record<string, any> };

function inferDuplicateField(message: string) {
  if (/email/i.test(message)) return "email";
  if (/gdmsApId/i.test(message)) return "gdmsApId";
  return "unique_field";
}

export function mapDbError(error: unknown): Mapped {
  const err = error as { code?: string; message?: string; sqlMessage?: string };
  const message = String(err?.sqlMessage || err?.message || error);

  switch (err?.code) {
    case "ER_DUP_ENTRY":
      return {
        status: 409,
        body: { error: "UNIQUE_CONSTRAINT", field: inferDuplicateField(message) },
      };
    case "ER_NO_REFERENCED_ROW_2":
    case "ER_ROW_IS_REFERENCED_2":
      return {
        status: 409,
        body: { error: "FOREIGN_KEY_CONSTRAINT", details: message },
      };
    case "ER_BAD_NULL_ERROR":
    case "ER_DATA_TOO_LONG":
    case "ER_TRUNCATED_WRONG_VALUE":
      return {
        status: 400,
        body: { error: "DB_VALIDATION_ERROR", details: message },
      };
    default:
      return {
        status: 500,
        body: { error: "DB_ERROR", details: message },
      };
  }
}
