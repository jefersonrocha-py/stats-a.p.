export type UserAccountStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED";

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function toDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getUserAccountStatus(input: {
  isBlocked?: unknown;
  suspendedUntil?: unknown;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const isBlocked = toBoolean(input.isBlocked);
  const suspendedUntil = toDate(input.suspendedUntil);

  if (isBlocked) {
    return {
      isBlocked: true,
      suspendedUntil: suspendedUntil?.toISOString() ?? null,
      status: "BLOCKED" as UserAccountStatus,
    };
  }

  if (suspendedUntil && suspendedUntil.getTime() > now.getTime()) {
    return {
      isBlocked: false,
      suspendedUntil: suspendedUntil.toISOString(),
      status: "SUSPENDED" as UserAccountStatus,
    };
  }

  return {
    isBlocked: false,
    suspendedUntil: suspendedUntil?.toISOString() ?? null,
    status: "ACTIVE" as UserAccountStatus,
  };
}
