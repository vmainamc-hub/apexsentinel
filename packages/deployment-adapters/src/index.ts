export interface ValidationResult {
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
}

export interface ProviderSite {
    id: string;
    name: string;
    url?: string;
    adminUrl?: string;
}

export interface DeploymentResult {
    id: string;
    status: 'queued' | 'building' | 'deployed' | 'failed';
    url?: string;
    logsUrl?: string;
}

export interface DeploymentProvider {
    readonly key: string;
    validateConnection(): Promise<ValidationResult>;
    createSite(input: { siteId: string; name: string; repository: string; branch: string }): Promise<ProviderSite>;
    configureEnvironment(input: { providerSiteId: string; values: Record<string, string> }): Promise<void>;
    deploy(input: { providerSiteId: string; configurationVersion: number }): Promise<DeploymentResult>;
    getDeployment(id: string): Promise<DeploymentResult>;
    rollback(input: { providerSiteId: string; deploymentId: string }): Promise<DeploymentResult>;
}

