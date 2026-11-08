import type { ExternalIntegrationAdapter, ExternalIntegrationEnvelope, ExternalIntegrationResult } from "./external-integration-contract.js";

export class ExternalIntegrationAdapterRegistry {
  private readonly adapters = new Map<string, ExternalIntegrationAdapter>();

  register(adapter: ExternalIntegrationAdapter): void {
    if (this.adapters.has(adapter.integrationId)) {
      throw new Error(`Integration adapter already registered: ${adapter.integrationId}`);
    }
    this.adapters.set(adapter.integrationId, adapter);
  }

  get(integrationId: string): ExternalIntegrationAdapter | undefined {
    return this.adapters.get(integrationId);
  }

  async execute(envelope: ExternalIntegrationEnvelope): Promise<ExternalIntegrationResult> {
    const adapter = this.adapters.get(envelope.integrationId);
    if (!adapter) {
      return {
        accepted: false,
        authoritativeMutation: false,
        correlationId: envelope.correlationId,
        retryable: false,
        failureClass: "VALIDATION",
        message: `No adapter registered for integration ${envelope.integrationId}`,
      };
    }

    try {
      const result = await adapter.execute(envelope);
      if (result.correlationId !== envelope.correlationId) {
        return {
          accepted: false,
          authoritativeMutation: false,
          correlationId: envelope.correlationId,
          retryable: false,
          failureClass: "VALIDATION",
          message: "Adapter returned a mismatched correlationId",
        };
      }
      return result;
    } catch (error) {
      return {
        accepted: false,
        authoritativeMutation: false,
        correlationId: envelope.correlationId,
        retryable: true,
        failureClass: "TRANSIENT",
        message: error instanceof Error ? error.message : "External adapter execution failed",
      };
    }
  }
}
