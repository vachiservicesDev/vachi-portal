import { graduated, n, table, type StateForm, type StateRule } from "./types";

/**
 * Income tax withholding for the 41 states (and DC) that tax wages, as each state publishes it for
 * 2026. Every rule annualizes the period's taxable wages, so it works for any pay frequency.
 *
 * Sources: each state's 2026 employer withholding guide, as restated in the U.S. Department of
 * Agriculture National Finance Center tax formula bulletins (help.nfc.usda.gov/systems/taxes),
 * which federal payroll uses; the bulletin reference is on each rule. Iowa, California and Arkansas
 * were also checked against the state's own 2026 formula document. Check every rule each January:
 * most states change a figure for the new year.
 */

const NFC = (ref: string) => `NFC bulletin ${ref} (help.nfc.usda.gov)`;

/** A deduction that drops by `step` dollars for every `band` (or part) of wages above `from`. */
const stepDown = (
  wages: number,
  full: number,
  from: number,
  band: number,
  step: number,
  floor: number,
) =>
  wages <= from
    ? full
    : Math.max(floor, full - step * Math.ceil((wages - from) / band));

/** An amount that grows by `step` for every `band` (or part) above `from`, up to `max`. */
const stepUp = (
  value: number,
  from: number,
  band: number,
  step: number,
  max: number,
) =>
  value <= from ? 0 : Math.min(max, step * Math.ceil((value - from) / band));

/** Looks up a percent from [notOver, percent] rows; above the last row, the last percent. */
const lookup = (value: number, rows: [number, number][]) =>
  (rows.find(([notOver]) => value <= notOver) ?? rows[rows.length - 1])[1];

// ---------------------------------------------------------------- Connecticut (Form CT-W4)
type CtCode = "A" | "B" | "C" | "D" | "F";
const CT_EXEMPTION: Record<CtCode, [number, number]> = {
  A: [12_000, 24_000],
  B: [19_000, 38_000],
  C: [24_000, 48_000],
  D: [0, 0],
  F: [15_000, 30_000],
};
const CT_RATES_ADF: [number, number][] = [
  [0, 0.02],
  [10_000, 0.045],
  [50_000, 0.055],
  [100_000, 0.06],
  [200_000, 0.065],
  [250_000, 0.069],
  [500_000, 0.0699],
];
const CT_RATES: Record<CtCode, [number, number][]> = {
  A: CT_RATES_ADF,
  D: CT_RATES_ADF,
  F: CT_RATES_ADF,
  B: [
    [0, 0.02],
    [16_000, 0.045],
    [80_000, 0.055],
    [160_000, 0.06],
    [320_000, 0.065],
    [400_000, 0.069],
    [800_000, 0.0699],
  ],
  C: [
    [0, 0.02],
    [20_000, 0.045],
    [100_000, 0.055],
    [200_000, 0.06],
    [400_000, 0.065],
    [500_000, 0.069],
    [1_000_000, 0.0699],
  ],
};
// 2% phase-out add-back, on taxable wages: [from, band, step, max]
const CT_PHASE_OUT: Record<CtCode, [number, number, number, number]> = {
  A: [50_250, 2_500, 25, 250],
  D: [50_250, 2_500, 25, 250],
  B: [78_500, 4_000, 40, 400],
  C: [100_500, 5_000, 50, 500],
  F: [56_500, 5_000, 25, 250],
};
// Additional recapture, on annual wages: three stepped stages of [from, band, step, max of the stage].
const CT_RECAPTURE: Record<CtCode, [number, number, number, number][]> = {
  A: [
    [105_000, 5_000, 25, 250],
    [200_000, 5_000, 90, 2_700],
    [500_000, 5_000, 50, 450],
  ],
  D: [
    [105_000, 5_000, 25, 250],
    [200_000, 5_000, 90, 2_700],
    [500_000, 5_000, 50, 450],
  ],
  F: [
    [105_000, 5_000, 25, 250],
    [200_000, 5_000, 90, 2_700],
    [500_000, 5_000, 50, 450],
  ],
  B: [
    [168_000, 8_000, 40, 400],
    [320_000, 8_000, 140, 4_200],
    [800_000, 8_000, 80, 720],
  ],
  C: [
    [210_000, 10_000, 50, 500],
    [400_000, 10_000, 180, 5_400],
    [1_000_000, 10_000, 100, 900],
  ],
};
// Personal tax credit, on annual wages: [not over, credit].
const CT_CREDIT: Record<CtCode, [number, number][]> = {
  A: [
    [15_000, 0.75],
    [15_500, 0.7],
    [16_000, 0.65],
    [16_500, 0.6],
    [17_000, 0.55],
    [17_500, 0.5],
    [18_000, 0.45],
    [18_500, 0.4],
    [20_000, 0.35],
    [20_500, 0.3],
    [21_000, 0.25],
    [21_500, 0.2],
    [25_000, 0.15],
    [25_500, 0.14],
    [26_000, 0.13],
    [26_500, 0.12],
    [27_000, 0.11],
    [48_000, 0.1],
    [48_500, 0.09],
    [49_000, 0.08],
    [49_500, 0.07],
    [50_000, 0.06],
    [50_500, 0.05],
    [51_000, 0.04],
    [51_500, 0.03],
    [52_000, 0.02],
    [52_500, 0.01],
    [Infinity, 0],
  ],
  B: [
    [24_000, 0.75],
    [24_500, 0.7],
    [25_000, 0.65],
    [25_500, 0.6],
    [26_000, 0.55],
    [26_500, 0.5],
    [27_000, 0.45],
    [27_500, 0.4],
    [34_000, 0.35],
    [34_500, 0.3],
    [35_000, 0.25],
    [35_500, 0.2],
    [44_000, 0.15],
    [44_500, 0.14],
    [45_000, 0.13],
    [45_500, 0.12],
    [46_000, 0.11],
    [74_000, 0.1],
    [74_500, 0.09],
    [75_000, 0.08],
    [75_500, 0.07],
    [76_000, 0.06],
    [76_500, 0.05],
    [77_000, 0.04],
    [77_500, 0.03],
    [78_000, 0.02],
    [78_500, 0.01],
    [Infinity, 0],
  ],
  C: [
    [30_000, 0.75],
    [30_500, 0.7],
    [31_000, 0.65],
    [31_500, 0.6],
    [32_000, 0.55],
    [32_500, 0.5],
    [33_000, 0.45],
    [33_500, 0.4],
    [40_000, 0.35],
    [40_500, 0.3],
    [41_000, 0.25],
    [41_500, 0.2],
    [50_000, 0.15],
    [50_500, 0.14],
    [51_000, 0.13],
    [51_500, 0.12],
    [52_000, 0.11],
    [96_000, 0.1],
    [96_500, 0.09],
    [97_000, 0.08],
    [97_500, 0.07],
    [98_000, 0.06],
    [98_500, 0.05],
    [99_000, 0.04],
    [99_500, 0.03],
    [100_000, 0.02],
    [100_500, 0.01],
    [Infinity, 0],
  ],
  F: [
    [18_800, 0.75],
    [19_300, 0.7],
    [19_800, 0.65],
    [20_300, 0.6],
    [20_800, 0.55],
    [21_300, 0.5],
    [21_800, 0.45],
    [22_300, 0.4],
    [25_000, 0.35],
    [25_500, 0.3],
    [26_000, 0.25],
    [26_500, 0.2],
    [31_300, 0.15],
    [31_800, 0.14],
    [32_300, 0.13],
    [32_800, 0.12],
    [33_300, 0.11],
    [60_000, 0.1],
    [60_500, 0.09],
    [61_000, 0.08],
    [61_500, 0.07],
    [62_000, 0.06],
    [62_500, 0.05],
    [63_000, 0.04],
    [63_500, 0.03],
    [64_000, 0.02],
    [64_500, 0.01],
    [Infinity, 0],
  ],
  D: [[Infinity, 0]],
};

function connecticut(wages: number, f: StateForm): number {
  const code = f.status as CtCode | undefined;
  if (!code || !(code in CT_RATES)) return wages * 0.0699; // no valid CT-W4
  const [exemption, from] = CT_EXEMPTION[code];
  const taxable = wages - stepDown(wages, exemption, from, 1_000, 1_000, 0);
  if (taxable <= 0) return 0;
  const [pFrom, pBand, pStep, pMax] = CT_PHASE_OUT[code];
  let tax =
    graduated(taxable, CT_RATES[code]) +
    stepUp(taxable, pFrom, pBand, pStep, pMax);
  for (const [from, band, step, max] of CT_RECAPTURE[code])
    tax += stepUp(wages, from, band, step, max);
  return tax * (1 - lookup(wages, CT_CREDIT[code]));
}

// ---------------------------------------------------------------- Arkansas (Form AR4EC)
// Low income credit: [threshold, upper limit, maximum credit]
const AR_LOW_INCOME: Record<
  string,
  (exemptions: number) => [number, number, number]
> = {
  low_single: () => [14_644, 17_500, 111.8],
  low_married: (e) =>
    e <= 1 ? [24_696, 29_000, 391.56] : [29_723, 36_100, 531.96],
  low_hoh: (e) =>
    e <= 1 ? [20_821, 25_300, 268.84] : [24_819, 29_000, 378.04],
};

function arkansasGross(net: number): number {
  if (net < 100_001) net = Math.floor(net / 100) * 100 + 50;
  let tax: number;
  if (net <= 5_600) tax = 0;
  else if (net <= 11_200) tax = net * 0.02 - 111.98;
  else if (net <= 16_000) tax = net * 0.03 - 223.97;
  else if (net <= 26_400) tax = net * 0.034 - 287.97;
  else if (net <= 94_701) tax = net * 0.037 - 367.16;
  else if (net <= 97_601)
    tax = net * 0.037 - (369.9 - 10 * Math.ceil((net - 94_701) / 100));
  else tax = net * 0.037 - 79.9;
  return Math.round(Math.max(0, tax));
}

// Maryland county rates; -1 is Anne Arundel's graduated table, -2 Frederick's bracketed rate.
const MD_COUNTIES: Record<string, number> = {
  Allegany: 0.032,
  "Anne Arundel": -1,
  "Baltimore County": 0.032,
  "Baltimore City": 0.032,
  Calvert: 0.032,
  Caroline: 0.032,
  Carroll: 0.0303,
  Cecil: 0.0274,
  Charles: 0.0303,
  Dorchester: 0.033,
  Frederick: -2,
  Garrett: 0.0265,
  Harford: 0.0306,
  Howard: 0.032,
  Kent: 0.033,
  Montgomery: 0.032,
  "Prince George's": 0.032,
  "Queen Anne's": 0.032,
  "St. Mary's": 0.032,
  Somerset: 0.032,
  Talbot: 0.024,
  Washington: 0.0295,
  Wicomico: 0.032,
  Worcester: 0.0225,
};

// ---------------------------------------------------------------- the rules

export const STATE_RULES: Record<string, StateRule> = {
  AL: {
    name: "Alabama",
    form: "A-4",
    statuses: {
      S: "Single",
      MS: "Married filing separately",
      M: "Married",
      H: "Head of family",
      "0": "No personal exemption (0)",
    },
    fields: { dependents: "Dependents (other than spouse)" },
    source:
      "Alabama withholding tax tables and instructions (whbooklet), formula method",
    annualTax(w, f, ctx) {
      const s = f.status ?? "S";
      const std =
        s === "M"
          ? stepDown(w, 8_500, 25_999.99, 500, 175, 5_000)
          : s === "H"
            ? stepDown(w, 5_200, 25_999.99, 500, 135, 2_500)
            : s === "MS"
              ? stepDown(w, 4_250, 12_999.99, 250, 88, 2_500)
              : stepDown(w, 3_000, 25_999.99, 500, 25, 2_500);
      const personal = s === "M" || s === "H" ? 3_000 : s === "0" ? 0 : 1_500;
      const perDependent = w <= 50_000 ? 1_000 : w <= 100_000 ? 500 : 300;
      const taxable =
        w - std - ctx.federalAnnual - personal - n(f.dependents) * perDependent;
      return s === "M"
        ? graduated(taxable, [
            [0, 0.02],
            [1_000, 0.04],
            [6_000, 0.05],
          ])
        : graduated(taxable, [
            [0, 0.02],
            [500, 0.04],
            [3_000, 0.05],
          ]);
    },
  },
  AZ: {
    name: "Arizona",
    form: "A-4",
    fields: { amount: "Percent elected (0.5 to 3.5; 2.0 if no A-4)" },
    source:
      NFC("NFC-23-1686066172") + "; Arizona Form A-4 (2026 rates unchanged)",
    annualTax: (w, f) =>
      (w * (f.amount === undefined ? 2 : Math.min(3.5, n(f.amount)))) / 100,
  },
  AR: {
    name: "Arkansas",
    form: "AR4EC",
    statuses: {
      standard: "Standard tables",
      low_single: "Low income tables: single",
      low_married: "Low income tables: married",
      low_hoh: "Low income tables: head of household",
    },
    fields: { allowances: "Exemptions" },
    source:
      NFC("NFC-26-1781190112") +
      " (3.7% top rate from mid-2026); Arkansas DFA whformula_2026",
    annualTax(w, f) {
      let tax = arkansasGross(w - 2_470);
      const low = AR_LOW_INCOME[f.status ?? ""];
      if (low) {
        const [threshold, upper, max] = low(n(f.allowances));
        tax -=
          w < threshold
            ? tax
            : Math.max(0, (1 - (w - threshold) / (upper - threshold)) * max);
      }
      return Math.max(0, tax - 29 * n(f.allowances));
    },
  },
  CA: {
    name: "California",
    form: "DE 4",
    statuses: {
      single: "Single, or married with two incomes",
      married: "Married (one income)",
      hoh: "Head of household",
    },
    fields: {
      allowances: "Regular withholding allowances",
      dependents: "Additional allowances for estimated deductions",
    },
    source: "EDD 2026 Method B (26methb.pdf)",
    annualTax(w, f) {
      const s = f.status ?? "single";
      const big = s === "hoh" || (s === "married" && n(f.allowances) >= 2);
      if (w <= (big ? 37_791 : 18_896)) return 0;
      const taxable = w - 1_000 * n(f.dependents) - (big ? 11_412 : 5_706);
      const rows: [number, number, number][] =
        s === "hoh"
          ? [
              [0, 0.011, 0],
              [22_173, 0.022, 243.9],
              [52_530, 0.044, 911.75],
              [67_716, 0.066, 1_579.93],
              [83_805, 0.088, 2_641.8],
              [98_990, 0.1023, 3_978.08],
              [505_208, 0.1133, 45_534.18],
              [606_251, 0.1243, 56_982.35],
              [1_000_000, 0.1353, 105_925.35],
              [1_010_417, 0.1463, 107_334.77],
            ]
          : s === "married"
            ? [
                [0, 0.011, 0],
                [22_158, 0.022, 243.74],
                [52_528, 0.044, 911.88],
                [82_904, 0.066, 2_248.42],
                [115_084, 0.088, 4_372.3],
                [145_448, 0.1023, 7_044.33],
                [742_958, 0.1133, 68_169.6],
                [891_542, 0.1243, 85_004.17],
                [1_000_000, 0.1353, 98_485.5],
                [1_485_906, 0.1463, 164_228.58],
              ]
            : [
                [0, 0.011, 0],
                [11_079, 0.022, 121.87],
                [26_264, 0.044, 455.94],
                [41_452, 0.066, 1_124.21],
                [57_542, 0.088, 2_186.15],
                [72_724, 0.1023, 3_522.17],
                [371_479, 0.1133, 34_084.81],
                [445_771, 0.1243, 42_502.09],
                [742_953, 0.1353, 79_441.81],
                [1_000_000, 0.1463, 114_220.27],
              ];
      return Math.max(0, table(taxable, rows) - 168.3 * n(f.allowances));
    },
  },
  CO: {
    name: "Colorado",
    form: "DR 0004 (or federal W-4)",
    statuses: {
      single: "Single, married filing separately or head of household",
      married: "Married filing jointly or qualifying surviving spouse",
    },
    fields: {},
    roundPeriod: "dollar",
    source: NFC("NFC-26-1772551649"),
    annualTax: (w, f) =>
      Math.max(0, w - (f.status === "married" ? 11_000 : 5_500)) * 0.044,
  },
  CT: {
    name: "Connecticut",
    form: "CT-W4",
    statuses: {
      A: "A: married filing jointly, spouse earns more (or separately)",
      B: "B: head of household",
      C: "C: married filing jointly, combined income under limit",
      D: "D: married, both working, highest withholding",
      F: "F: single",
      none: "No CT-W4 on file (6.99%)",
    },
    fields: {},
    source:
      NFC("NFC-24-1712697342") +
      "; CT DRS Circular CT / TPG-211 (2026 figures unchanged)",
    annualTax: connecticut,
  },
  DE: {
    name: "Delaware",
    form: "W-4 (Delaware)",
    statuses: {
      single: "Single",
      married_joint: "Married filing jointly",
      married_separate: "Married filing separately",
    },
    fields: { allowances: "Exemptions" },
    source: NFC("NFC-20-1605647748"),
    annualTax(w, f) {
      const taxable = w - (f.status === "married_joint" ? 6_500 : 3_250);
      const tax = table(taxable, [
        [0, 0, 0],
        [2_000, 0.022, 0],
        [5_000, 0.039, 66],
        [10_000, 0.048, 261],
        [20_000, 0.052, 741],
        [25_000, 0.0555, 1_001],
        [60_000, 0.066, 2_943.5],
      ]);
      return Math.max(0, tax - 110 * n(f.allowances));
    },
  },
  DC: {
    name: "District of Columbia",
    form: "D-4",
    fields: { allowances: "Withholding allowances" },
    source: NFC("NFC-22-1668460546"),
    annualTax: (w, f) =>
      table(w - 4_300 * n(f.allowances), [
        [0, 0.04, 0],
        [10_000, 0.06, 400],
        [40_000, 0.065, 2_200],
        [60_000, 0.085, 3_500],
        [250_000, 0.0925, 19_650],
        [500_000, 0.0975, 42_775],
        [1_000_000, 0.1075, 91_525],
      ]),
  },
  GA: {
    name: "Georgia",
    form: "G-4",
    statuses: {
      S: "Single or head of household",
      N: "Married, both spouses working (or filing separately)",
      M: "Married filing jointly, one spouse working",
    },
    fields: { allowances: "Dependents plus additional allowances" },
    source: NFC("NFC-26-1784643404"),
    annualTax: (w, f) =>
      Math.max(
        0,
        w - (f.status === "M" ? 30_000 : 15_000) - 5_000 * n(f.allowances),
      ) * 0.0499,
  },
  HI: {
    name: "Hawaii",
    form: "HW-4",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1768321238"),
    annualTax(w, f) {
      const taxable = w - 1_144 * n(f.allowances) - 4_350;
      return f.status === "married"
        ? table(taxable, [
            [0, 0.014, 0],
            [19_200, 0.032, 269],
            [28_800, 0.055, 576],
            [38_400, 0.064, 1_104],
            [48_000, 0.068, 1_718],
            [72_000, 0.072, 3_350],
            [96_000, 0.076, 5_078],
            [250_000, 0.079, 16_782],
          ])
        : table(taxable, [
            [0, 0.014, 0],
            [9_600, 0.032, 134],
            [14_400, 0.055, 288],
            [19_200, 0.064, 552],
            [24_000, 0.068, 859],
            [36_000, 0.072, 1_675],
            [48_000, 0.076, 2_539],
            [125_000, 0.079, 8_391],
          ]);
    },
  },
  ID: {
    name: "Idaho",
    form: "ID W-4",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: {},
    roundPeriod: "dollar",
    source: NFC("NFC-26-1786997961"),
    annualTax: (w, f) =>
      Math.max(0, w - (f.status === "married" ? 32_200 : 16_100)) * 0.053,
  },
  IL: {
    name: "Illinois",
    form: "IL-W-4",
    fields: {
      allowances: "Basic allowances (line 1)",
      dependents: "Additional allowances (line 2)",
    },
    source: NFC("NFC-26-1784121339"),
    annualTax: (w, f) =>
      Math.max(0, w - 2_925 * n(f.allowances) - 1_000 * n(f.dependents)) *
      0.0495,
  },
  IN: {
    name: "Indiana",
    form: "WH-4",
    fields: {
      allowances: "Personal exemptions (self, spouse, 65+, blind, dependents)",
      dependents: "Additional dependent exemptions",
    },
    source: NFC("NFC-26-1774379018"),
    annualTax: (w, f) =>
      Math.max(0, w - 1_000 * n(f.allowances) - 1_500 * n(f.dependents)) *
      0.0295,
  },
  IA: {
    name: "Iowa",
    form: "IA W-4 (2024 or later)",
    statuses: {
      other: "Other, or married with a working spouse",
      hoh: "Head of household",
      married: "Married, spouse has no earned income",
    },
    fields: { amount: "Allowance amount (USD per year)" },
    source:
      "Iowa Department of Revenue, 2026 Withholding Formula and Instructions",
    annualTax: (w, f) =>
      Math.max(
        0,
        Math.max(
          0,
          w -
            (f.status === "married"
              ? 26_000
              : f.status === "hoh"
                ? 19_500
                : 13_000),
        ) *
          0.038 -
          n(f.amount),
      ),
  },
  KS: {
    name: "Kansas",
    form: "K-4",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Total exemptions" },
    source: NFC("NFC-24-1722617728"),
    annualTax(w, f) {
      const e = n(f.allowances);
      const married = f.status === "married";
      const personal = e === 0 ? 0 : married && e >= 2 ? 18_320 : 9_160;
      const extra = Math.max(0, e - (married ? 2 : 1)) * 2_320;
      const taxable = w - personal - extra;
      return married
        ? table(taxable, [
            [0, 0, 0],
            [8_240, 0.052, 0],
            [54_240, 0.0558, 2_392],
          ])
        : table(taxable, [
            [0, 0, 0],
            [3_605, 0.052, 0],
            [26_605, 0.0558, 1_196],
          ]);
    },
  },
  KY: {
    name: "Kentucky",
    form: "K-4",
    fields: {},
    source: NFC("NFC-26-1770145550"),
    annualTax: (w) => Math.max(0, w - 3_360) * 0.035,
  },
  LA: {
    name: "Louisiana",
    form: "L-4",
    statuses: {
      single: "Single, claiming the standard deduction",
      married_one: "Married, claiming one standard deduction",
      married:
        "Married, head of household or surviving spouse (full deduction)",
      none: "No standard deduction",
    },
    fields: {},
    source: NFC("NFC-26-1767639939"),
    annualTax: (w, f) =>
      Math.max(
        0,
        w -
          (f.status === "none" ? 0 : f.status === "married" ? 25_750 : 12_875),
      ) * 0.0309,
  },
  ME: {
    name: "Maine",
    form: "W-4ME",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    roundPeriod: "dollar",
    source: NFC("NFC-26-1787745725"),
    annualTax(w, f) {
      const married = f.status === "married";
      const std = married
        ? w <= 204_550
          ? 28_550
          : w >= 354_550
            ? 0
            : ((354_550 - w) / 150_000) * 28_550
        : w <= 102_250
          ? 12_850
          : w >= 177_250
            ? 0
            : ((177_250 - w) / 75_000) * 12_850;
      const taxable = w - std - 5_300 * n(f.allowances);
      return married
        ? table(taxable, [
            [0, 0.058, 0],
            [54_850, 0.0675, 3_181],
            [129_750, 0.0715, 8_237],
            [1_500_000, 0.0915, 106_210],
          ])
        : table(taxable, [
            [0, 0.058, 0],
            [27_400, 0.0675, 1_589],
            [64_850, 0.0715, 4_117],
            [1_000_000, 0.0915, 70_980],
          ]);
    },
  },
  MD: {
    name: "Maryland",
    form: "MW507",
    statuses: { single: "Single", married: "Married" },
    fields: { allowances: "Exemptions" },
    localities: MD_COUNTIES,
    source: NFC("NFC-26-1783003892") + " (state and county)",
    annualTax(w, f) {
      if (w < 5_000) return 0;
      const married = f.status === "married";
      const taxable = Math.max(0, w - 3_400 - 3_200 * n(f.allowances));
      const state = married
        ? table(taxable, [
            [0, 0.0475, 0],
            [150_000, 0.05, 7_125],
            [175_000, 0.0525, 8_375],
            [225_000, 0.055, 11_000],
            [300_000, 0.0575, 15_125],
            [600_000, 0.0625, 32_375],
            [1_200_000, 0.065, 69_875],
          ])
        : table(taxable, [
            [0, 0.0475, 0],
            [100_000, 0.05, 4_750],
            [125_000, 0.0525, 6_000],
            [150_000, 0.055, 7_312.5],
            [250_000, 0.0575, 12_812.5],
            [500_000, 0.0625, 27_187.5],
            [1_000_000, 0.065, 58_437.5],
          ]);
      const rate = MD_COUNTIES[f.locality ?? ""] ?? 0.032;
      const county =
        rate === -1 // Anne Arundel, graduated
          ? married
            ? table(taxable, [
                [0, 0.027, 0],
                [75_000, 0.0294, 2_025],
                [480_000, 0.032, 13_932],
              ])
            : table(taxable, [
                [0, 0.027, 0],
                [50_000, 0.0294, 1_350],
                [400_000, 0.032, 11_640],
              ])
          : rate === -2 // Frederick, one rate on all wages by bracket
            ? taxable *
              (married
                ? lookup(taxable, [
                    [25_000, 0.0225],
                    [100_000, 0.0275],
                    [250_000, 0.0296],
                    [Infinity, 0.032],
                  ])
                : lookup(taxable, [
                    [25_000, 0.0225],
                    [50_000, 0.0275],
                    [150_000, 0.0296],
                    [Infinity, 0.032],
                  ]))
            : taxable * rate;
      return state + county;
    },
  },
  MA: {
    name: "Massachusetts",
    form: "M-4",
    statuses: { single: "Single or married", hoh: "Head of household" },
    fields: { allowances: "Exemptions" },
    source: NFC("NFC-26-1769797447"),
    annualTax(w, f, ctx) {
      const e = n(f.allowances);
      if (e >= 1 && w < 8_000) return 0;
      // Social Security and Medicare paid are deductible up to $2,000 a year.
      const before = ctx.ficaYtd * 0.0765;
      const current =
        before >= 2_000
          ? 0
          : Math.min(ctx.periodWages * 0.0765, 2_000 - before);
      const taxable =
        w -
        current * ctx.periods -
        (e === 1 ? 4_400 : e > 1 ? 1_000 * e + 3_400 : 0);
      const tax = table(taxable, [
        [0, 0.05, 0],
        [1_107_750, 0.09, 55_387.5],
      ]);
      return Math.max(0, tax - (f.status === "hoh" ? 120 : 0));
    },
  },
  MI: {
    name: "Michigan",
    form: "MI-W4",
    fields: { allowances: "Personal and dependent exemptions" },
    source: NFC("NFC-26-1781704387"),
    annualTax: (w, f) => Math.max(0, w - 5_900 * n(f.allowances)) * 0.0425,
  },
  MN: {
    name: "Minnesota",
    form: "W-4MN",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1782924992"),
    annualTax(w, f) {
      const taxable = w - 5_300 * n(f.allowances);
      return f.status === "married"
        ? table(taxable, [
            [0, 0, 0],
            [14_700, 0.0535, 0],
            [63_400, 0.068, 2_605.45],
            [208_180, 0.0785, 12_450.49],
            [352_630, 0.0985, 23_789.82],
          ])
        : table(taxable, [
            [0, 0, 0],
            [4_700, 0.0535, 0],
            [38_010, 0.068, 1_782.09],
            [114_130, 0.0785, 6_958.25],
            [207_850, 0.0985, 14_315.27],
          ]);
    },
  },
  MS: {
    name: "Mississippi",
    form: "89-350",
    statuses: {
      single: "Single",
      both: "Married, both spouses working",
      hoh: "Head of family",
      married: "Married, spouse not working",
    },
    fields: { allowances: "Dependents ($1,500 each)" },
    roundPeriod: "dollar",
    source: NFC("NFC-26-1768327516"),
    annualTax(w, f) {
      const s = f.status ?? "single";
      const std = s === "married" ? 4_600 : s === "hoh" ? 3_400 : 2_300;
      const personal =
        s === "married" || s === "both" ? 12_000 : s === "hoh" ? 9_500 : 6_000;
      return (
        Math.max(0, w - std - personal - 1_500 * n(f.allowances) - 10_000) *
        0.04
      );
    },
  },
  MO: {
    name: "Missouri",
    form: "MO W-4",
    statuses: {
      single:
        "Single, married filing separately, or married with a working spouse",
      married: "Married, spouse not working",
      hoh: "Head of household",
    },
    fields: {},
    roundPeriod: "dollar",
    source: NFC("NFC-26-1773783048"),
    annualTax: (w, f) =>
      table(
        w -
          (f.status === "married"
            ? 32_200
            : f.status === "hoh"
              ? 24_150
              : 16_100),
        [
          [0, 0, 0],
          [1_348, 0.02, 0],
          [2_696, 0.025, 27],
          [4_044, 0.03, 61],
          [5_392, 0.035, 101],
          [6_740, 0.04, 148],
          [8_088, 0.045, 202],
          [9_436, 0.047, 263],
        ],
      ),
  },
  MT: {
    name: "Montana",
    form: "MW-4",
    statuses: {
      single: "Single, married filing separately, or both spouses working",
      married: "Married filing jointly",
      hoh: "Head of household",
    },
    fields: {},
    roundPeriod: "up",
    source: NFC("NFC-26-1767632355"),
    annualTax(w, f) {
      const [free, top, plus] =
        f.status === "married"
          ? [32_200, 127_200, 4_465]
          : f.status === "hoh"
            ? [24_150, 95_400, 3_349]
            : [16_100, 63_600, 2_233];
      return table(w, [
        [0, 0, 0],
        [free, 0.047, 0],
        [top, 0.0565, plus],
      ]);
    },
  },
  NE: {
    name: "Nebraska",
    form: "W-4N",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1774374744"),
    annualTax(w, f) {
      const married = f.status === "married";
      const tax = (allowances: number) =>
        married
          ? table(w - 2_440 * allowances, [
              [0, 0, 0],
              [8_190, 0.0226, 0],
              [13_010, 0.0322, 108.93],
              [32_400, 0.0421, 733.29],
              [50_400, 0.0435, 1_491.09],
              [62_530, 0.0448, 2_018.75],
              [82_920, 0.046, 2_932.22],
            ])
          : table(w - 2_440 * allowances, [
              [0, 0, 0],
              [3_430, 0.0226, 0],
              [6_710, 0.0322, 74.13],
              [21_810, 0.0421, 560.35],
              [31_610, 0.0435, 972.93],
              [40_130, 0.0448, 1_343.55],
              [75_370, 0.046, 2_922.3],
            ]);
      const claimed = tax(n(f.allowances));
      const base = married ? 2 : 1;
      // LB223 minimum: at least half the tax on the base allowances.
      return n(f.allowances) > base
        ? Math.max(claimed, 0.5 * tax(base))
        : claimed;
    },
  },
  NJ: {
    name: "New Jersey",
    form: "NJ-W4",
    statuses: {
      A: "Rate A: single or married filing separately",
      B: "Rate B: married filing jointly, head of household",
      C: "Rate C",
      D: "Rate D",
      E: "Rate E",
    },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-21-1615324548"),
    annualTax(w, f) {
      const rows: Record<string, [number, number, number][]> = {
        A: [
          [0, 0.015, 0],
          [20_000, 0.02, 300],
          [35_000, 0.039, 600],
          [40_000, 0.061, 795],
          [75_000, 0.07, 2_930],
          [500_000, 0.099, 32_680],
          [1_000_000, 0.118, 82_180],
        ],
        B: [
          [0, 0.015, 0],
          [20_000, 0.02, 300],
          [50_000, 0.027, 900],
          [70_000, 0.039, 1_440],
          [80_000, 0.061, 1_830],
          [150_000, 0.07, 6_100],
          [500_000, 0.099, 30_600],
          [1_000_000, 0.118, 80_100],
        ],
        C: [
          [0, 0.015, 0],
          [20_000, 0.023, 300],
          [40_000, 0.028, 760],
          [50_000, 0.035, 1_040],
          [60_000, 0.056, 1_390],
          [150_000, 0.066, 6_430],
          [500_000, 0.099, 29_530],
          [1_000_000, 0.118, 79_030],
        ],
        D: [
          [0, 0.015, 0],
          [20_000, 0.027, 300],
          [40_000, 0.034, 840],
          [50_000, 0.043, 1_180],
          [60_000, 0.056, 1_610],
          [150_000, 0.065, 6_650],
          [500_000, 0.099, 29_400],
          [1_000_000, 0.118, 78_900],
        ],
        E: [
          [0, 0.015, 0],
          [20_000, 0.02, 300],
          [35_000, 0.058, 600],
          [100_000, 0.065, 4_370],
          [500_000, 0.099, 30_370],
          [1_000_000, 0.118, 79_870],
        ],
      };
      return table(
        w - 1_000 * n(f.allowances),
        rows[f.status ?? "A"] ?? rows.A,
      );
    },
  },
  NM: {
    name: "New Mexico",
    form: "Federal W-4",
    statuses: {
      single: "Single",
      married: "Married",
      hoh: "Head of household",
    },
    fields: {},
    source: NFC("NFC-26-1776874663"),
    annualTax(w, f) {
      const rows: Record<string, [number, number, number][]> = {
        single: [
          [0, 0, 0],
          [8_050, 0.015, 0],
          [13_550, 0.032, 82.5],
          [20_550, 0.032, 306.5],
          [24_550, 0.043, 434.5],
          [33_550, 0.043, 821.5],
          [41_550, 0.047, 1_165.5],
          [58_550, 0.047, 1_964.5],
          [74_550, 0.049, 2_716.5],
          [218_050, 0.059, 9_748],
        ],
        married: [
          [0, 0, 0],
          [16_100, 0.015, 0],
          [24_100, 0.032, 120],
          [32_100, 0.032, 376],
          [41_100, 0.043, 664],
          [57_100, 0.043, 1_352],
          [66_100, 0.047, 1_739],
          [102_100, 0.047, 3_431],
          [116_100, 0.049, 4_089],
          [331_100, 0.059, 14_624],
        ],
        hoh: [
          [0, 0, 0],
          [12_075, 0.015, 0],
          [20_075, 0.032, 120],
          [28_075, 0.032, 376],
          [37_075, 0.043, 664],
          [53_075, 0.043, 1_352],
          [62_075, 0.047, 1_739],
          [98_075, 0.047, 3_431],
          [112_075, 0.049, 4_089],
          [327_075, 0.059, 14_624],
        ],
      };
      return table(w, rows[f.status ?? "single"] ?? rows.single);
    },
  },
  NY: {
    name: "New York",
    form: "IT-2104",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    source:
      NFC("NFC-26-1772477134") + " (state only; NYC and Yonkers not included)",
    annualTax(w, f) {
      const married = f.status === "married";
      const taxable = w - (married ? 7_950 : 7_400) - 1_000 * n(f.allowances);
      // Very high earners: one flat rate on all taxable wages.
      const flat: [number, number][] = married
        ? [
            [2_155_349.99, 0.1045],
            [4_999_999.99, 0.111],
            [24_999_999.99, 0.117],
          ]
        : [
            [1_077_549.99, 0.1045],
            [4_999_999.99, 0.111],
            [24_999_999.99, 0.117],
          ];
      const top = flat.filter(([over]) => taxable > over).pop();
      if (top) return taxable * top[1];
      return married
        ? table(taxable, [
            [0, 0.039, 0],
            [8_500, 0.044, 332],
            [11_700, 0.0515, 472],
            [13_900, 0.054, 586],
            [80_650, 0.059, 4_190],
            [96_800, 0.0657, 5_143],
            [107_650, 0.0707, 5_855],
            [157_650, 0.0801, 9_388],
            [211_550, 0.064, 13_708],
            [323_200, 0.1349, 20_854],
            [373_200, 0.0735, 27_600],
            [1_077_550, 0.0765, 79_369],
          ])
        : table(taxable, [
            [0, 0.039, 0],
            [8_500, 0.044, 332],
            [11_700, 0.0515, 472],
            [13_900, 0.054, 586],
            [80_650, 0.059, 4_190],
            [96_800, 0.0703, 5_143],
            [107_650, 0.0753, 5_906],
            [157_650, 0.064, 9_673],
            [215_400, 0.1144, 13_369],
            [265_400, 0.0735, 19_091],
          ]);
    },
  },
  NC: {
    name: "North Carolina",
    form: "NC-4",
    statuses: {
      single: "Single or married filing separately",
      married: "Married filing jointly or surviving spouse",
      hoh: "Head of household",
    },
    fields: { allowances: "Allowances" },
    roundPeriod: "dollar",
    source: NFC("NFC-26-1767633224"),
    annualTax: (w, f) =>
      Math.max(
        0,
        w - (f.status === "hoh" ? 19_125 : 12_750) - 2_500 * n(f.allowances),
      ) * 0.0409,
  },
  ND: {
    name: "North Dakota",
    form: "Federal W-4",
    statuses: {
      single: "Single or married filing separately",
      married: "Married filing jointly",
      hoh: "Head of household",
    },
    fields: {},
    roundPeriod: "dollar",
    source: NFC("NFC-26-1767646699"),
    annualTax(w, f) {
      const rows: Record<string, [number, number, number][]> = {
        single: [
          [0, 0, 0],
          [57_625, 0.0195, 0],
          [258_450, 0.025, 3_916.09],
        ],
        married: [
          [0, 0, 0],
          [57_500, 0.0195, 0],
          [168_525, 0.025, 2_164.99],
        ],
        hoh: [
          [0, 0, 0],
          [78_475, 0.0195, 0],
          [289_675, 0.025, 4_118.4],
        ],
      };
      return table(w, rows[f.status ?? "single"] ?? rows.single);
    },
  },
  OH: {
    name: "Ohio",
    form: "IT 4",
    fields: { allowances: "Exemptions" },
    source: NFC("NFC-26-1786990318"),
    annualTax: (w, f) =>
      table(w - 650 * n(f.allowances), [
        [0, 0.016, 0],
        [26_050, 0.0299, 416.8],
        [100_000, 0.034, 2_627.91],
      ]),
  },
  OK: {
    name: "Oklahoma",
    form: "OK-W-4",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    roundPeriod: "dollar",
    source: NFC("NFC-26-1773324603"),
    annualTax(w, f) {
      const taxable = w - 1_000 * n(f.allowances);
      return f.status === "married"
        ? table(taxable, [
            [0, 0, 0],
            [20_200, 0.025, 0],
            [22_500, 0.035, 57.5],
            [27_100, 0.045, 218.5],
          ])
        : table(taxable, [
            [0, 0, 0],
            [10_100, 0.025, 0],
            [11_250, 0.035, 28.75],
            [13_550, 0.045, 109.25],
          ]);
    },
  },
  OR: {
    name: "Oregon",
    form: "OR-W-4",
    statuses: { single: "Single", married: "Married" },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1778117419"),
    annualTax(w, f, ctx) {
      const married = f.status === "married";
      const e = n(f.allowances);
      const big = married || e >= 3; // the married tables
      const cap = married
        ? stepDown(w, 8_750, 249_999.99, 10_000, 1_750, 0)
        : stepDown(w, 8_750, 124_999.99, 5_000, 1_750, 0);
      const taxable =
        w - Math.min(ctx.federalAnnual, cap) - (big ? 5_820 : 2_910);
      const tax =
        w < 50_000
          ? big
            ? table(taxable, [
                [0, 0.0475, 263],
                [9_100, 0.0675, 695],
                [22_800, 0.0875, 1_620],
              ])
            : table(taxable, [
                [0, 0.0475, 263],
                [4_550, 0.0675, 479],
                [11_400, 0.0875, 941],
              ])
          : big
            ? table(taxable, [
                [0, 0, 0],
                [22_800, 0.0875, 1_357],
                [250_000, 0.099, 21_237],
              ])
            : table(taxable, [
                [0, 0, 0],
                [11_400, 0.0875, 678],
                [125_000, 0.099, 10_618],
              ]);
      const reduce = married
        ? w > 200_000
          ? Math.min(e, 2)
          : 0
        : w > 100_000 && e >= 1
          ? 1
          : 0;
      return Math.max(0, tax - 263 * Math.max(0, e - reduce));
    },
  },
  PA: {
    name: "Pennsylvania",
    form: "None (flat rate)",
    fields: {},
    source:
      "Pennsylvania Department of Revenue: 3.07% of compensation, no allowances",
    annualTax: (w) => w * 0.0307,
  },
  RI: {
    name: "Rhode Island",
    form: "RI W-4",
    fields: { allowances: "Exemptions" },
    source: NFC("NFC-26-1772030778"),
    annualTax: (w, f) =>
      table(w - (w <= 290_800 ? 1_000 * n(f.allowances) : 0), [
        [0, 0.0375, 0],
        [82_050, 0.0475, 3_076.88],
        [186_450, 0.0599, 8_035.88],
      ]),
  },
  SC: {
    name: "South Carolina",
    form: "SC W-4",
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1773173131"),
    annualTax(w, f) {
      const e = n(f.allowances);
      const taxable = w - (e >= 1 ? Math.min(w * 0.1, 7_500) : 0) - 5_000 * e;
      return table(taxable, [
        [0, 0, 0],
        [3_640, 0.03, 0],
        [18_230, 0.06, 437.7],
      ]);
    },
  },
  UT: {
    name: "Utah",
    form: "Federal W-4",
    statuses: {
      single: "Single or head of household",
      married: "Married filing jointly",
      none: "No W-4 on file",
    },
    fields: {},
    source: NFC("NFC-26-1782763921"),
    annualTax(w, f) {
      const gross = w * 0.0445;
      if (f.status === "none") return gross;
      const married = f.status === "married";
      const reduction = Math.max(0, w - (married ? 18_696 : 9_348)) * 0.013;
      return Math.max(
        0,
        gross - Math.max(0, (married ? 970 : 485) - reduction),
      );
    },
  },
  VT: {
    name: "Vermont",
    form: "W-4VT",
    statuses: { single: "Single or head of household", married: "Married" },
    fields: { allowances: "Allowances" },
    source: NFC("NFC-26-1780320782"),
    annualTax(w, f) {
      const taxable = w - 5_400 * n(f.allowances);
      return f.status === "married"
        ? table(taxable, [
            [0, 0, 0],
            [11_775, 0.0335, 0],
            [96_475, 0.066, 2_837.45],
            [216_525, 0.076, 10_760.75],
            [323_825, 0.0875, 18_915.55],
          ])
        : table(taxable, [
            [0, 0, 0],
            [3_925, 0.0335, 0],
            [54_675, 0.066, 1_700.13],
            [126_775, 0.076, 6_458.73],
            [260_225, 0.0875, 16_600.93],
          ]);
    },
  },
  VA: {
    name: "Virginia",
    form: "VA-4",
    fields: {
      allowances: "Personal and dependent exemptions",
      dependents: "Exemptions for age 65+ and blindness",
    },
    source: NFC("NFC-25-1750694986"),
    annualTax: (w, f) =>
      table(w - 8_750 - 930 * n(f.allowances) - 800 * n(f.dependents), [
        [0, 0.02, 0],
        [3_000, 0.03, 60],
        [5_000, 0.05, 120],
        [17_000, 0.0575, 720],
      ]),
  },
  WV: {
    name: "West Virginia",
    form: "WV/IT-104",
    statuses: {
      one: "One earner, one job",
      two: "Two earners or two or more jobs",
    },
    fields: { allowances: "Exemptions" },
    roundPeriod: "dollar",
    source: NFC("NFC-26-1786455448"),
    annualTax(w, f) {
      const taxable = w - 2_000 * n(f.allowances);
      return f.status === "two"
        ? table(taxable, [
            [0, 0.0211, 0],
            [7_500, 0.0281, 158.25],
            [18_750, 0.0316, 474.38],
            [30_000, 0.0422, 829.88],
            [45_000, 0.0458, 1_462.88],
          ])
        : table(taxable, [
            [0, 0.0211, 0],
            [10_000, 0.0281, 211],
            [25_000, 0.0316, 632.5],
            [40_000, 0.0422, 1_106.5],
            [60_000, 0.0458, 1_950.5],
          ]);
    },
  },
  WI: {
    name: "Wisconsin",
    form: "WT-4",
    statuses: { single: "Single", married: "Married" },
    fields: { allowances: "Exemptions" },
    source:
      NFC("NFC-22-1646766842") +
      " (Wisconsin Pub W-166 method, unchanged for 2026)",
    annualTax(w, f) {
      const std =
        f.status === "married"
          ? w <= 25_727
            ? 9_461
            : w >= 73_032
              ? 0
              : 9_461 - 0.2 * (w - 25_727)
          : w <= 17_780
            ? 6_702
            : w >= 73_630
              ? 0
              : 6_702 - 0.12 * (w - 17_780);
      return table(w - std - 400 * n(f.allowances), [
        [0, 0.0354, 0],
        [12_760, 0.0465, 451.7],
        [25_520, 0.053, 1_045.04],
        [280_950, 0.0765, 14_582.83],
      ]);
    },
  },
};
