/**
 * PS-005 8-State Data Model Contract (Contract Section 11)
 * Explicit states for all asynchronous data sources.
 * Never infer missing data as 0 or fabricated figures.
 */
export type DataState =
  | 'LIVE'         // Data currently being received from running engine
  | 'MEASURED'     // Verified result from empirical test or query run
  | 'CONFIGURED'   // Configured system specification / parameter
  | 'TARGET'       // Problem statement requirement / SLA invariant
  | 'LOADING'      // Awaiting initial response
  | 'STALE'        // No new data received within timeout window (>3s)
  | 'UNAVAILABLE'  // Engine/endpoint unreachable
  | 'ERROR';       // Network or deserialization error

export interface MetricValue<T> {
  value: T | null;
  state: DataState;
  target?: string;
  sourceLabel?: string;
  timestamp?: number;
}
