import "server-only";

function getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const serverEnv = {
    get databaseUrl(): string {
        return getRequiredEnv("DATABASE_URL");
    },

    get authSecret(): string {
        return getRequiredEnv("AUTH_SECRET");
    },
};
