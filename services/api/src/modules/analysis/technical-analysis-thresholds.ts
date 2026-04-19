/** |pct change per day| below this on SMA series → slope "flat" (0.1%). */
export const SMA_SLOPE_FLAT_THRESHOLD: number = 0.001;

/** Volume vs 20d avg: above if > avg × (1+ε), below if < avg × (1−ε). */
export const VOLUME_CLASSIFICATION_EPSILON: number = 0.1;

/** Pivot window half-width: k=2 → 5-bar window (2 left, pivot, 2 right). */
export const PIVOT_SWING_WINDOW_K: number = 2;

/** Price distance to MA for "sideways" deadband (1.5%). */
export const TREND_SIDEWAYS_DISTANCE_DEADBAND: number = 0.015;

/** Minimum |SMA slope| magnitude to count as trending (0.05% per day). */
export const TREND_MIN_SMA_SLOPE_MAGNITUDE: number = 0.0005;

/** Bollinger BW vs trailing mean: neutral band (2%). */
export const BOLLINGER_BW_NEUTRAL_TOLERANCE: number = 0.02;
