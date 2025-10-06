import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const issuer = "etherium";
const audience = "etherium-users";

export type JwtPayload = {
  sub: string;           // user id
  email: string;
  name: string;
  role: "SUPERADMIN" | "ADMIN" | "USER";
};

export async function signAuthToken(payload: JwtPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { issuer, audience });
  return payload as unknown as JwtPayload;
}
