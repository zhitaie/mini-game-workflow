export interface SaveEnvelope<TData> {
  schemaVersion: number;
  data: TData;
  updatedAt: number;
}

export interface SaveDefinition<TData> {
  schemaVersion: number;
  createDefaultData(): TData;
  migrate(stored: SaveEnvelope<TData>): SaveEnvelope<TData>;
}

