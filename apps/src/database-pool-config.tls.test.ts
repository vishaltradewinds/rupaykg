import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as tls from "node:tls";
import type { AddressInfo } from "node:net";
import { createDatabasePoolConfig } from "./database-pool-config.js";

describe("production PostgreSQL TLS policy handshake", () => {
  let directory: string;
  let certificate: string;
  let privateKey: string;
  let server: tls.Server | undefined;
  let port: number;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "rupaykg-postgres-tls-"));
    const certificatePath = join(directory, "server.crt");
    const privateKeyPath = join(directory, "server.key");
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", privateKeyPath,
      "-out", certificatePath,
      "-days", "1",
      "-subj", "/CN=localhost",
      "-addext", "subjectAltName=DNS:localhost",
    ], { stdio: "ignore" });
    certificate = await readFile(certificatePath, "utf8");
    privateKey = await readFile(privateKeyPath, "utf8");
    const tlsServer = tls.createServer({ key: privateKey, cert: certificate }, (socket) => socket.end());
    server = tlsServer;
    await new Promise<void>((resolve, reject) => {
      tlsServer.once("error", reject);
      tlsServer.listen(0, "127.0.0.1", resolve);
    });
    port = (tlsServer.address() as AddressInfo).port;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  function connectWithPolicy(policy: tls.ConnectionOptions, servername: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: "127.0.0.1",
        port,
        servername,
        ...policy,
      }, () => {
        socket.end();
        resolve();
      });
      socket.once("error", reject);
    });
  }

  it("accepts a trusted certificate with a matching hostname", async () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=disable",
      DATABASE_SSL: "require",
      DATABASE_CA_CERT: certificate,
    });
    const policy = config.ssl;
    assert.ok(policy && typeof policy === "object");
    assert.equal(policy.rejectUnauthorized, true);
    await connectWithPolicy(policy, "localhost");
  });

  it("rejects a self-signed certificate when its CA is not trusted", async () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "require",
    });
    const policy = config.ssl;
    assert.ok(policy && typeof policy === "object");
    await assert.rejects(
      connectWithPolicy(policy, "localhost"),
      /self-signed certificate|unable to verify/i,
    );
  });

  it("rejects a trusted certificate when the server hostname does not match", async () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "require",
      DATABASE_CA_CERT: certificate,
    });
    const policy = config.ssl;
    assert.ok(policy && typeof policy === "object");
    await assert.rejects(
      connectWithPolicy(policy, "wronghost.example.invalid"),
      /hostname|subject alternative name|altname/i,
    );
  });
});
