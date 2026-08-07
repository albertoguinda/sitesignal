import type { AssetStatus, AssetType, Metric } from "../../shared/types";

/** Fixed seed — the demo dataset is byte-identical on every machine. */
export const RANDOM_SEED = 20260807;

/** How much history the seeder generates, at one sample per hour. */
export const HISTORY_DAYS = 60;

export interface SiteSeed {
  key: string;
  name: string;
  lat: number;
  lng: number;
  timezone: string;
}

export interface AssetSeed {
  siteKey: string;
  code: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  /** Floor plan coordinates, metres. `y` is elevation: 0 = ground, >0 = mezzanine. */
  pos: [x: number, y: number, z: number];
  installedAt: string;
}

export interface MetricProfile {
  metric: Metric;
  /** Long-run mean of the signal. */
  base: number;
  /** Amplitude of the daily cycle; also scales noise and drift. */
  amplitude: number;
  /** Clamp applied after all components, keeps values physically plausible. */
  floor?: number;
}

export const SITE_SEEDS: SiteSeed[] = [
  {
    key: "northgate",
    name: "Northgate Processing",
    lat: 51.9244,
    lng: 4.4777,
    timezone: "Europe/Amsterdam",
  },
  {
    key: "ridgeline",
    name: "Ridgeline Substation",
    lat: 39.7392,
    lng: -104.9903,
    timezone: "America/Denver",
  },
  {
    key: "kanto",
    name: "Kanto Cold Store",
    lat: 35.4437,
    lng: 139.638,
    timezone: "Asia/Tokyo",
  },
];

export const ASSET_SEEDS: AssetSeed[] = [
  // --- Northgate Processing — wet process line -----------------------------
  {
    siteKey: "northgate",
    code: "NG-P01",
    name: "Feed Pump A",
    type: "pump",
    status: "ok",
    pos: [-4.5, 0, -3],
    installedAt: "2019-04-18",
  },
  {
    siteKey: "northgate",
    code: "NG-P02",
    name: "Feed Pump B",
    type: "pump",
    status: "warning",
    pos: [-4.5, 0, 3],
    installedAt: "2019-04-18",
  },
  {
    siteKey: "northgate",
    code: "NG-C01",
    name: "Air Compressor",
    type: "compressor",
    status: "ok",
    pos: [0, 0, -3],
    installedAt: "2021-09-02",
  },
  {
    siteKey: "northgate",
    code: "NG-B01",
    name: "Steam Boiler",
    type: "boiler",
    status: "ok",
    pos: [0, 0, 3],
    installedAt: "2017-11-27",
  },
  {
    siteKey: "northgate",
    code: "NG-T01",
    name: "Buffer Tank",
    type: "tank",
    status: "ok",
    pos: [4.5, 2.4, -3],
    installedAt: "2018-02-14",
  },
  {
    siteKey: "northgate",
    code: "NG-V01",
    name: "Belt Conveyor",
    type: "conveyor",
    status: "critical",
    pos: [4.5, 0, 3],
    installedAt: "2020-06-30",
  },

  // --- Ridgeline Substation — power ----------------------------------------
  {
    siteKey: "ridgeline",
    code: "RL-TR1",
    name: "Main Transformer",
    type: "transformer",
    status: "ok",
    pos: [-4.5, 0, -3],
    installedAt: "2016-08-09",
  },
  {
    siteKey: "ridgeline",
    code: "RL-TR2",
    name: "Auxiliary Transformer",
    type: "transformer",
    status: "warning",
    pos: [-4.5, 0, 3],
    installedAt: "2016-08-09",
  },
  {
    siteKey: "ridgeline",
    code: "RL-GT1",
    name: "Gas Turbine",
    type: "turbine",
    status: "ok",
    pos: [0, 0, 0],
    installedAt: "2015-03-21",
  },
  {
    siteKey: "ridgeline",
    code: "RL-CP1",
    name: "Coolant Pump",
    type: "pump",
    status: "ok",
    pos: [4.5, 0, -3],
    installedAt: "2020-01-15",
  },
  {
    siteKey: "ridgeline",
    code: "RL-HV1",
    name: "Control Room HVAC",
    type: "hvac",
    status: "ok",
    pos: [4.5, 2.4, 3],
    installedAt: "2022-05-04",
  },
  {
    siteKey: "ridgeline",
    code: "RL-CH1",
    name: "Oil Chiller",
    type: "chiller",
    status: "ok",
    pos: [0, 0, 6],
    installedAt: "2021-07-19",
  },

  // --- Kanto Cold Store — cold chain ---------------------------------------
  {
    siteKey: "kanto",
    code: "KT-CH1",
    name: "Chiller Bank 1",
    type: "chiller",
    status: "ok",
    pos: [-4.5, 0, -3],
    installedAt: "2018-10-11",
  },
  {
    siteKey: "kanto",
    code: "KT-CH2",
    name: "Chiller Bank 2",
    type: "chiller",
    status: "critical",
    pos: [-4.5, 0, 3],
    installedAt: "2018-10-11",
  },
  {
    siteKey: "kanto",
    code: "KT-CM1",
    name: "Ammonia Compressor",
    type: "compressor",
    status: "warning",
    pos: [0, 0, -3],
    installedAt: "2019-12-06",
  },
  {
    siteKey: "kanto",
    code: "KT-HV1",
    name: "Dock HVAC",
    type: "hvac",
    status: "ok",
    pos: [0, 2.4, 3],
    installedAt: "2023-03-28",
  },
  {
    siteKey: "kanto",
    code: "KT-CV1",
    name: "Pallet Conveyor",
    type: "conveyor",
    status: "ok",
    pos: [4.5, 0, -3],
    installedAt: "2020-11-02",
  },
  {
    siteKey: "kanto",
    code: "KT-TK1",
    name: "Glycol Tank",
    type: "tank",
    status: "warning",
    pos: [4.5, 0, 3],
    installedAt: "2017-06-23",
  },
];

/**
 * Signal shape per asset type. Values are chosen so each metric sits in a
 * plausible engineering range for that machine, which is what makes the
 * dashboard read as real rather than as random noise.
 */
export const METRIC_PROFILES: Record<AssetType, MetricProfile[]> = {
  pump: [
    { metric: "temperature", base: 62, amplitude: 4 },
    { metric: "vibration", base: 2.4, amplitude: 0.5, floor: 0.1 },
  ],
  compressor: [
    { metric: "temperature", base: 78, amplitude: 6 },
    { metric: "vibration", base: 3.1, amplitude: 0.7, floor: 0.1 },
    { metric: "humidity", base: 34, amplitude: 6, floor: 0 },
  ],
  chiller: [
    { metric: "temperature", base: -4, amplitude: 1.5 },
    { metric: "humidity", base: 82, amplitude: 5, floor: 0 },
  ],
  turbine: [
    { metric: "temperature", base: 412, amplitude: 18 },
    { metric: "vibration", base: 4.2, amplitude: 0.9, floor: 0.1 },
    { metric: "humidity", base: 28, amplitude: 5, floor: 0 },
  ],
  transformer: [
    { metric: "temperature", base: 68, amplitude: 5 },
    { metric: "humidity", base: 38, amplitude: 6, floor: 0 },
  ],
  conveyor: [
    { metric: "vibration", base: 1.8, amplitude: 0.4, floor: 0.1 },
    { metric: "temperature", base: 44, amplitude: 3 },
  ],
  boiler: [
    { metric: "temperature", base: 154, amplitude: 9 },
    { metric: "humidity", base: 22, amplitude: 4, floor: 0 },
  ],
  hvac: [
    { metric: "temperature", base: 21, amplitude: 2 },
    { metric: "humidity", base: 46, amplitude: 7, floor: 0 },
  ],
  tank: [
    { metric: "temperature", base: 34, amplitude: 3 },
    { metric: "humidity", base: 58, amplitude: 6, floor: 0 },
  ],
};

export interface AlertSeed {
  assetCode: string;
  severity: "info" | "warning" | "critical";
  state: "open" | "ack" | "resolved";
  message: string;
  /** Days before "now" the alert was opened. */
  daysAgo: number;
}

export const ALERT_SEEDS: AlertSeed[] = [
  {
    assetCode: "NG-V01",
    severity: "critical",
    state: "open",
    message: "Drive-end vibration above 6.0 mm/s across three consecutive windows",
    daysAgo: 1.2,
  },
  {
    assetCode: "KT-CH2",
    severity: "critical",
    state: "open",
    message: "Suction temperature drifting up — evaporator coil icing suspected",
    daysAgo: 2.4,
  },
  {
    assetCode: "NG-P02",
    severity: "warning",
    state: "open",
    message: "Bearing temperature trending +8 °C week over week",
    daysAgo: 3.9,
  },
  {
    assetCode: "KT-CM1",
    severity: "warning",
    state: "open",
    message: "Discharge vibration above baseline during peak duty cycle",
    daysAgo: 5.1,
  },
  {
    assetCode: "RL-HV1",
    severity: "info",
    state: "open",
    message: "Filter differential pressure at 80 % of the change threshold",
    daysAgo: 6.7,
  },
  {
    assetCode: "KT-TK1",
    severity: "warning",
    state: "ack",
    message: "Glycol headspace humidity outside the 45–65 % operating band",
    daysAgo: 8.3,
  },
  {
    assetCode: "RL-TR2",
    severity: "warning",
    state: "ack",
    message: "Winding temperature exceeded 78 °C during afternoon load peak",
    daysAgo: 11.6,
  },
  {
    assetCode: "RL-GT1",
    severity: "info",
    state: "ack",
    message: "Scheduled borescope inspection window opens in 14 days",
    daysAgo: 14.2,
  },
  {
    assetCode: "NG-C01",
    severity: "warning",
    state: "resolved",
    message: "Intercooler approach temperature normalised after coil clean",
    daysAgo: 17.8,
  },
  {
    assetCode: "RL-CP1",
    severity: "warning",
    state: "resolved",
    message: "Cavitation signature cleared following strainer service",
    daysAgo: 21.4,
  },
  {
    assetCode: "KT-CV1",
    severity: "info",
    state: "resolved",
    message: "Belt tracking corrected during the night shift",
    daysAgo: 25.9,
  },
  {
    assetCode: "NG-B01",
    severity: "info",
    state: "resolved",
    message: "Feedwater conductivity spike cleared after blowdown",
    daysAgo: 29.3,
  },
];
