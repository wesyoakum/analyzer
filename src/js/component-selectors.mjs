// ===== component-selectors.mjs — predefined component selections =====

/**
 * @typedef {Object} ComponentOption
 * @property {string} pn
 * @property {string} [name]
 * @property {string} [description]
 * @property {number|string|boolean} [gear_ratio_stage1]
 * @property {number|string|boolean} [gear_ratio_stage2]
 * @property {number|string|boolean} [gearbox_max_torque_Nm]
 * @property {number|string|boolean} [motor_max_rpm]
 * @property {number|string|boolean} [motor_hp]
 * @property {number|string|boolean} [motor_tmax_Nm]
 * @property {number|string|boolean} [pump_disp_cc]
 * @property {number|string|boolean} [pump_max_psi]
 * @property {number|string|boolean} [hyd_motor_disp_cc]
 * @property {number|string|boolean} [hyd_motor_min_disp_cc]
 * @property {number|string|boolean} [hyd_motor_max_rpm]
  * @property {number|string|boolean} [motor_eff]
  * @property {number|string|boolean} [c_mm]
  * @property {number|string|boolean} [depth_m]
  * @property {number|string|boolean} [dead_m]
  * @property {number|string|boolean} [c_w_kgpm]
  * @property {number|string|boolean} [core_in]
  * @property {number|string|boolean} [flange_dia_in]
  * @property {number|string|boolean} [ftf_in]
  * @property {number|string|boolean} [lebus_in]
  * @property {number|string|boolean} [pack]
  * @property {number|string|boolean} [wraps_override]
  * @property {number|string|boolean} [motors]
  * @property {number|string|boolean} [h_pump_strings]
  * @property {string} [gearbox_select]
  * @property {string} [electric_motor_select]
  * @property {string} [hydraulic_pump_select]
  * @property {string} [hydraulic_motor_select]
  * @property {string} [cable_select]
  * @property {string} [drum_select]
  * @property {string} [payload_select]
  * @property {string} [hpu_select]
  * @property {string} [hpu_motor_select]
 */

/**
 * @typedef {Object} SelectConfig
 * @property {string} selectId
 * @property {ComponentOption[]} options
 * @property {Record<string, keyof ComponentOption>} fieldMap
 * @property {boolean} [initialSkipEvents]
 */

/** @type {ComponentOption[]} */
export const CABLE_OPTIONS = [
  {
    pn: 'CB-30-3000',
    description: '30 mm × 3000 m, 100 m dead, 3.8 kg/m',
    c_mm: 30,
    depth_m: 3000,
    dead_m: 100,
    c_w_kgpm: 3.8
  },
  {
    pn: 'CB-32-3500',
    description: '32 mm × 3500 m, 120 m dead, 4.2 kg/m',
    c_mm: 32,
    depth_m: 3500,
    dead_m: 120,
    c_w_kgpm: 4.2
  },
  {
    pn: 'CB-28-2500',
    description: '28 mm × 2500 m, 80 m dead, 3.1 kg/m',
    c_mm: 28,
    depth_m: 2500,
    dead_m: 80,
    c_w_kgpm: 3.1
  }
];

/** @type {ComponentOption[]} */
export const DRUM_OPTIONS = [
  {
    pn: 'DR-64-116',
    description: '64 in core, 116 in FTF, 0.625 in liner',
    core_in: 64,
    flange_dia_in: 110,
    ftf_in: 116,
    lebus_in: 0.625,
    pack: 0.877,
    wraps_override: 40
  },
  {
    pn: 'DR-705-118',
    description: '70.5 in core, 118 in FTF, 0.75 in liner',
    core_in: 70.5,
    flange_dia_in: 122,
    ftf_in: 118,
    lebus_in: 0.75,
    pack: 0.88,
    wraps_override: 38.5
  },
  {
    pn: 'DR-82-132',
    description: '82 in core, 132 in FTF, 0.6 in liner',
    core_in: 82,
    flange_dia_in: 138,
    ftf_in: 132,
    lebus_in: 0.6,
    pack: 0.9,
    wraps_override: 36
  }
];

/** @type {ComponentOption[]} */
export const PAYLOAD_OPTIONS = [
  {
    pn: 'PL-8000',
    description: '8 tonne subsea package',
    payload_kg: 8000
  },
  {
    pn: 'PL-6000',
    description: '6 tonne instrument frame',
    payload_kg: 6000
  },
  {
    pn: 'PL-10000',
    description: '10 tonne lift module',
    payload_kg: 10000
  }
];

/** @type {ComponentOption[]} */
export const GEARBOX_OPTIONS = [
  {
    pn: 'Hico-30-17.32',
    name: 'Hico-30-17.32',
    description: 'PN 30 — ratio 17.32:1, max torque 5649.24 N·m',
    gear_ratio_stage1: 17.32,
    gearbox_max_torque_Nm: 5649.24
  },
  {
    pn: 'Hico-30-22.52',
    name: 'Hico-30-22.52',
    description: 'PN 30 — ratio 22.52:1, max torque 5649.24 N·m',
    gear_ratio_stage1: 22.52,
    gearbox_max_torque_Nm: 5649.24
  },
  {
    pn: 'Hico-40-19',
    name: 'Hico-40-19',
    description: 'PN 40 — ratio 19:1, max torque 6779.09 N·m',
    gear_ratio_stage1: 19,
    gearbox_max_torque_Nm: 6779.09
  },
  {
    pn: 'Hico-44-24.7',
    name: 'Hico-44-24.7',
    description: 'PN 44 — ratio 24.7:1, max torque 8473.86 N·m',
    gear_ratio_stage1: 24.7,
    gearbox_max_torque_Nm: 8473.86
  },
  {
    pn: 'Hico-30-24',
    name: 'Hico-30-24',
    description: 'PN 30 — ratio 24:1, max torque 5649.24 N·m',
    gear_ratio_stage1: 24,
    gearbox_max_torque_Nm: 5649.24
  },
  {
    pn: 'Hico-40-31.2',
    name: 'Hico-40-31.2',
    description: 'PN 40 — ratio 31.2:1, max torque 6779.09 N·m',
    gear_ratio_stage1: 31.2,
    gearbox_max_torque_Nm: 6779.09
  },
  {
    pn: 'F-30 Ratio 19-305',
    name: 'F-30 Ratio 19-305',
    description: 'PN F-30 — max torque 30000 N·m',
    gearbox_max_torque_Nm: 30000
  },
  {
    pn: 'F-40 Ratio 19-181',
    name: 'F-40 Ratio 19-181',
    description: 'PN F-40 — max torque 40000 N·m',
    gearbox_max_torque_Nm: 40000
  },
  {
    pn: 'F-55 Ratio 16-185',
    name: 'F-55 Ratio 16-185',
    description: 'PN F-55 — max torque 55000 N·m',
    gearbox_max_torque_Nm: 55000
  },
  {
    pn: 'F-80 Ratio 19-206',
    name: 'F-80 Ratio 19-206',
    description: 'PN F-80 — max torque 80000 N·m',
    gearbox_max_torque_Nm: 80000
  },
  {
    pn: 'F-100 Ratio 21-226',
    name: 'F-100 Ratio 21-226',
    description: 'PN F-100 — max torque 100000 N·m',
    gearbox_max_torque_Nm: 100000
  },
  {
    pn: 'F-130 Ratio 69-206',
    name: 'F-130 Ratio 69-206',
    description: 'PN F-130 — max torque 130000 N·m',
    gearbox_max_torque_Nm: 130000
  },
  {
    pn: 'F-180 Ratio 206-281',
    name: 'F-180 Ratio 206-281',
    description: 'PN F-180 — max torque 180000 N·m',
    gearbox_max_torque_Nm: 180000
  },
  {
    pn: 'F-220 Ratio 97-345',
    name: 'F-220 Ratio 97-345',
    description: 'PN F-220 — max torque 220000 N·m',
    gearbox_max_torque_Nm: 220000
  },
  {
    pn: 'F-260 Ratio 69-1784',
    name: 'F-260 Ratio 69-1784',
    description: 'PN F-260 — max torque 260000 N·m',
    gearbox_max_torque_Nm: 260000
  },
  {
    pn: 'F-280 Ratio 201-201',
    name: 'F-280 Ratio 201-201',
    description: 'PN F-280 — max torque 280000 N·m',
    gearbox_max_torque_Nm: 280000
  },
  {
    pn: 'F-360 Ratio 94-490',
    name: 'F-360 Ratio 94-490',
    description: 'PN F-360 — max torque 360000 N·m',
    gearbox_max_torque_Nm: 360000
  },
  {
    pn: 'Dinamic Oil 512 Ratio 13.8-43.6',
    name: 'Dinamic Oil 512 Ratio 13.8-43.6',
    description: 'PN 512 — ratio 13.8–43.6:1, max torque 7380 N·m',
    gearbox_max_torque_Nm: 7380
  },
  {
    pn: 'Dinamic Oil 513 Ratio 42.6-189.',
    name: 'Dinamic Oil 513 Ratio 42.6-189.',
    description: 'PN 513 — ratio 42.6–189:1, max torque 7800 N·m',
    gearbox_max_torque_Nm: 7800
  },
  {
    pn: 'Dinamic Oil 612 Ratio 13.4-33.1',
    name: 'Dinamic Oil 612 Ratio 13.4-33.1',
    description: 'PN 612 — ratio 13.4–33.1:1, max torque 9800 N·m',
    gearbox_max_torque_Nm: 9800
  },
  {
    pn: 'Dinamic Oil 613 Ratio 49.1-210.',
    name: 'Dinamic Oil 613 Ratio 49.1-210.',
    description: 'PN 613 — ratio 49.1–210:1, max torque 10150 N·m',
    gearbox_max_torque_Nm: 10150
  },
  {
    pn: 'Dinamic Oil 812 Ratio 14.1-42.7',
    name: 'Dinamic Oil 812 Ratio 14.1-42.7',
    description: 'PN 812 — ratio 14.1–42.7:1, max torque 11750 N·m',
    gearbox_max_torque_Nm: 11750
  },
  {
    pn: 'Dinamic Oil 813 Ratio 43.6-207.',
    name: 'Dinamic Oil 813 Ratio 43.6-207.',
    description: 'PN 813 — ratio 43.6–207:1, max torque 12400 N·m',
    gearbox_max_torque_Nm: 12400
  },
  {
    pn: 'Dinamic Oil 1022 Ratio 14.1-42.7',
    name: 'Dinamic Oil 1022 Ratio 14.1-42.7',
    description: 'PN 1022 — ratio 14.1–42.7:1, max torque 16601 N·m',
    gearbox_max_torque_Nm: 16601
  },
  {
    pn: 'Dinamic Oil 1023 Ratio 43.6-226.',
    name: 'Dinamic Oil 1023 Ratio 43.6-226.',
    description: 'PN 1023 — ratio 43.6–226:1, max torque 18060 N·m',
    gearbox_max_torque_Nm: 18060
  },
  {
    pn: 'Dinamic Oil 1532 Ratio 17.9-45.7',
    name: 'Dinamic Oil 1532 Ratio 17.9-45.7',
    description: 'PN 1532 — ratio 17.9–45.7:1, max torque 22650 N·m',
    gearbox_max_torque_Nm: 22650
  },
  {
    pn: 'Dinamic Oil 2522 Ratio 17.5-41.8',
    name: 'Dinamic Oil 2522 Ratio 17.5-41.8',
    description: 'PN 2522 — ratio 17.5–41.8:1, max torque 18972 N·m',
    gearbox_max_torque_Nm: 18972
  }
];

/** @type {ComponentOption[]} */
export const ELECTRIC_MOTOR_OPTIONS = [
  {
    pn: 'LAM5-18-184TC',
    name: '5 HP AC Motor',
    description: 'PN LAM5-18-184TC — 5 hp, 20.202 N·m, 1780 rpm',
    motor_hp: 5,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 20.202
  },
  {
    pn: 'LAM10-18-215TC',
    name: '10 HP AC Motor',
    description: 'PN LAM10-18-215TC — 10 hp, 40.756 N·m, 1780 rpm',
    motor_hp: 10,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 40.756
  },
  {
    pn: 'LAM15-18-254TC',
    name: '15 HP AC Motor',
    description: 'PN LAM15-18-254TC — 15 hp, 59.249 N·m, 1780 rpm',
    motor_hp: 15,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 59.249
  },
  {
    pn: 'LAM20-18-256TC',
    name: '20 HP AC Motor',
    description: 'PN LAM20-18-256TC — 20 hp, 80.956 N·m, 1780 rpm',
    motor_hp: 20,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 80.956
  },
  {
    pn: 'LAM25-18-284TC',
    name: '25 HP AC Motor',
    description: 'PN LAM25-18-284TC — 25 hp, 99.382 N·m, 1780 rpm',
    motor_hp: 25,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 99.382
  },
  {
    pn: 'LAM30-18-286TC',
    name: '30 HP AC Motor',
    description: 'PN LAM30-18-286TC — 30 hp, 118.404 N·m, 1780 rpm',
    motor_hp: 30,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 118.404
  },
  {
    pn: 'LAM40-18-324TC',
    name: '40 HP AC Motor',
    description: 'PN LAM40-18-324TC — 40 hp, 161.071 N·m, 1780 rpm',
    motor_hp: 40,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 161.071
  },
  {
    pn: 'LAM50-18-326TC',
    name: '50 HP AC Motor',
    description: 'PN LAM50-18-326TC — 50 hp, 199.306 N·m, 1780 rpm',
    motor_hp: 50,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 199.306
  },
  {
    pn: 'LAM60-18-364TC',
    name: '60 HP AC Motor',
    description: 'PN LAM60-18-364TC — 60 hp, 241.336 N·m, 1780 rpm',
    motor_hp: 60,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 241.336
  },
  {
    pn: 'LAM75-18-365TC',
    name: '75 HP AC Motor',
    description: 'PN LAM75-18-365TC — 75 hp, 294.349 N·m, 1780 rpm',
    motor_hp: 75,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 294.349
  },
  {
    pn: 'LAM100-18-405TC',
    name: '100 HP AC Motor',
    description: 'PN LAM100-18-405TC — 100 hp, 402.001 N·m, 1780 rpm',
    motor_hp: 100,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 402.001
  },
  {
    pn: 'LAM125-18-444TC',
    name: '125 HP AC Motor',
    description: 'PN LAM125-18-444TC — 125 hp, 483.35 N·m, 1780 rpm',
    motor_hp: 125,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 483.35
  },
  {
    pn: 'LAM150-18-445TC',
    name: '150 HP AC Motor',
    description: 'PN LAM150-18-445TC — 150 hp, 588.697 N·m, 1780 rpm',
    motor_hp: 150,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 588.697
  },
  {
    pn: 'LAM200-18-445TC',
    name: '200 HP AC Motor',
    description: 'PN LAM200-18-445TC — 200 hp, 799.934 N·m, 1780 rpm',
    motor_hp: 200,
    motor_max_rpm: 1780,
    motor_tmax_Nm: 799.934
  },
  {
    pn: 'EM-PMI240-T180-2200',
    name: 'Editron 2200',
    description: 'PN EM-PMI240-T180-2200 — 59 hp, 192 N·m, 2200 rpm',
    motor_hp: 59,
    motor_max_rpm: 2200,
    motor_tmax_Nm: 192
  },
  {
    pn: 'EM-PMI240-T180-4400',
    name: 'Editron 4400',
    description: 'PN EM-PMI240-T180-4400 — 107.28 hp, 175 N·m, 4400 rpm',
    motor_hp: 107.28,
    motor_max_rpm: 4400,
    motor_tmax_Nm: 175
  },
  {
    pn: 'EM-PMI240-T180-6600',
    name: 'Editron 6600',
    description: 'PN EM-PMI240-T180-6600 — 120.69 hp, 130 N·m, 6600 rpm',
    motor_hp: 120.69,
    motor_max_rpm: 6600,
    motor_tmax_Nm: 130
  },
  {
    pn: 'EM-PMI240-T180-8800',
    name: 'Editron 8800',
    description: 'PN EM-PMI240-T180-8800 — 134.1 hp, 109 N·m, 8800 rpm',
    motor_hp: 134.1,
    motor_max_rpm: 8800,
    motor_tmax_Nm: 109
  }
];

/** @type {ComponentOption[]} */
export const HYDRAULIC_PUMP_OPTIONS = [
  {
    pn: 'HP1 60',
    name: 'Danfoss HP1 60',
    description: 'PN HP1 60 — 60 cc/rev',
    pump_disp_cc: 60
  },
  {
    pn: 'HP1 68',
    name: 'Danfoss HP1 68',
    description: 'PN HP1 68 — 68 cc/rev',
    pump_disp_cc: 68
  },
  {
    pn: 'HP1 69',
    name: 'Danfoss HP1 69',
    description: 'PN HP1 69 — 69 cc/rev',
    pump_disp_cc: 69
  },
  {
    pn: 'HP1 78',
    name: 'Danfoss HP1 78',
    description: 'PN HP1 78 — 78 cc/rev',
    pump_disp_cc: 78
  },
  {
    pn: 'HP1 89',
    name: 'Danfoss HP1 89',
    description: 'PN HP1 89 — 89 cc/rev',
    pump_disp_cc: 89
  },
  {
    pn: 'HP1 100',
    name: 'Danfoss HP1 100',
    description: 'PN HP1 100 — 100 cc/rev',
    pump_disp_cc: 100
  },
  {
    pn: 'HP1 115',
    name: 'Danfoss HP1 115',
    description: 'PN HP1 115 — 115 cc/rev',
    pump_disp_cc: 115
  },
  {
    pn: 'HP1 130',
    name: 'Danfoss HP1 130',
    description: 'PN HP1 130 — 130 cc/rev',
    pump_disp_cc: 130
  },
  {
    pn: 'HP1 147',
    name: 'Danfoss HP1 147',
    description: 'PN HP1 147 — 147 cc/rev',
    pump_disp_cc: 147
  },
  {
    pn: 'HP1 165',
    name: 'Danfoss HP1 165',
    description: 'PN HP1 165 — 165 cc/rev',
    pump_disp_cc: 165
  },
  {
    pn: 'HP1 180',
    name: 'Danfoss HP1 180',
    description: 'PN HP1 180 — 180 cc/rev',
    pump_disp_cc: 180
  },
  {
    pn: 'HP1 210',
    name: 'Danfoss HP1 210',
    description: 'PN HP1 210 — 210 cc/rev',
    pump_disp_cc: 210
  },
  {
    pn: 'HP1 250',
    name: 'Danfoss HP1 250',
    description: 'PN HP1 250 — 250 cc/rev',
    pump_disp_cc: 250
  },
  {
    pn: 'HP1 280',
    name: 'Danfoss HP1 280',
    description: 'PN HP1 280 — 280 cc/rev',
    pump_disp_cc: 280
  }
];

/** @type {ComponentOption[]} */
export const HYDRAULIC_MOTOR_OPTIONS = [
  {
    pn: '55',
    name: 'Brevini 55',
    description: 'PN 55 — 30–61 cc/rev, 4450 rpm',
    hyd_motor_min_disp_cc: 30,
    hyd_motor_disp_cc: 61,
    hyd_motor_max_rpm: 4450
  },
  {
    pn: '75',
    name: 'Brevini 75',
    description: 'PN 75 — 40–81 cc/rev, 4000 rpm',
    hyd_motor_min_disp_cc: 40,
    hyd_motor_disp_cc: 81,
    hyd_motor_max_rpm: 4000
  },
  {
    pn: '108',
    name: 'Brevini 108',
    description: 'PN 108 — 56–113 cc/rev, 3550 rpm',
    hyd_motor_min_disp_cc: 56,
    hyd_motor_disp_cc: 113,
    hyd_motor_max_rpm: 3550
  },
  {
    pn: '160',
    name: 'Brevini 160',
    description: 'PN 160 — 80–161 cc/rev, 3100 rpm',
    hyd_motor_min_disp_cc: 80,
    hyd_motor_disp_cc: 161,
    hyd_motor_max_rpm: 3100
  },
  {
    pn: '200',
    name: 'Brevini 200',
    description: 'PN 200 — 108–216 cc/rev, 2900 rpm',
    hyd_motor_min_disp_cc: 108,
    hyd_motor_disp_cc: 216,
    hyd_motor_max_rpm: 2900
  },
  {
    pn: 'CMF 80',
    name: 'Linde CMF 80',
    description: 'PN CMF 80 — 80 cc/rev, 4500 rpm',
    hyd_motor_min_disp_cc: 80,
    hyd_motor_disp_cc: 80,
    hyd_motor_max_rpm: 4500
  },
  {
    pn: 'CMV 60',
    name: 'Linde CMV 60',
    description: 'PN CMV 60 — 62 cc/rev, 4450 rpm',
    hyd_motor_min_disp_cc: 62,
    hyd_motor_disp_cc: 62,
    hyd_motor_max_rpm: 4450
  },
  {
    pn: 'CMV 85',
    name: 'Linde CMV 85',
    description: 'PN CMV 85 — 29.8–85 cc/rev, 3900 rpm',
    hyd_motor_min_disp_cc: 29.8,
    hyd_motor_disp_cc: 85,
    hyd_motor_max_rpm: 3900
  },
  {
    pn: 'CMV 115',
    name: 'Linde CMV 115',
    description: 'PN CMV 115 — 39.2–115 cc/rev, 3550 rpm',
    hyd_motor_min_disp_cc: 39.2,
    hyd_motor_disp_cc: 115,
    hyd_motor_max_rpm: 3550
  },
  {
    pn: 'CMV 140',
    name: 'Linde CMV 140',
    description: 'PN CMV 140 — 49–140 cc/rev, 3250 rpm',
    hyd_motor_min_disp_cc: 49,
    hyd_motor_disp_cc: 140,
    hyd_motor_max_rpm: 3250
  },
  {
    pn: 'CMV 170',
    name: 'Linde CMV 170',
    description: 'PN CMV 170 — 64.6–170 cc/rev, 3100 rpm',
    hyd_motor_min_disp_cc: 64.6,
    hyd_motor_disp_cc: 170,
    hyd_motor_max_rpm: 3100
  }
];

/** @type {ComponentOption[]} */
export const HPU_MOTOR_OPTIONS = [
  {
    pn: 'HMOT-75-1780',
    description: '75 hp @ 1780 rpm',
    h_emotor_hp: 75,
    h_emotor_rpm: 1780
  },
  {
    pn: 'HMOT-90-1785',
    description: '90 hp @ 1785 rpm',
    h_emotor_hp: 90,
    h_emotor_rpm: 1785
  },
  {
    pn: 'HMOT-110-1200',
    description: '110 hp @ 1200 rpm',
    h_emotor_hp: 110,
    h_emotor_rpm: 1200
  }
];

/** @type {ComponentOption[]} */
export const HPU_OPTIONS = [
  {
    pn: 'HPU-2S-210',
    description: '2 strings, HMOT-75-1780, pump HP-210A',
    h_pump_strings: 2,
    hpu_motor_select: 'HMOT-75-1780',
    hydraulic_pump_select: 'HP-210A'
  },
  {
    pn: 'HPU-3S-180',
    description: '3 strings, HMOT-90-1785, pump HP-180B',
    h_pump_strings: 3,
    hpu_motor_select: 'HMOT-90-1785',
    hydraulic_pump_select: 'HP-180B'
  },
  {
    pn: 'HPU-2S-250',
    description: '2 strings, HMOT-110-1200, pump HP-250C',
    h_pump_strings: 2,
    hpu_motor_select: 'HMOT-110-1200',
    hydraulic_pump_select: 'HP-250C'
  }
];

/** @type {ComponentOption[]} */
export const SYSTEM_OPTIONS = [
  {
    pn: 'WINCH-513',
    description: 'Placeholder 513 Winch system',
    cable_select: 'CB-30-3000',
    drum_select: 'DR-705-118',
    payload_select: 'PL-8000',
    hpu_select: 'HPU-2S-210',
    hpu_motor_select: 'HMOT-75-1780',
    core_in: 70.5,
    flange_dia_in: 122,
    ftf_in: 118,
    lebus_in: 0.75,
    pack: 0.88,
    motors: 6,
    h_pump_strings: 2,
    gearbox_select: 'GB-123',
    electric_motor_select: 'EM-200-4P',
    hydraulic_pump_select: 'HP-210A',
    hydraulic_motor_select: 'HM-1580'
  },
  {
    pn: 'WINCH-900',
    description: 'Placeholder 900 Winch system',
    cable_select: 'CB-32-3500',
    drum_select: 'DR-82-132',
    payload_select: 'PL-10000',
    hpu_select: 'HPU-2S-250',
    hpu_motor_select: 'HMOT-110-1200',
    core_in: 82,
    flange_dia_in: 138,
    ftf_in: 132,
    lebus_in: 0.6,
    pack: 0.9,
    motors: 4,
    h_pump_strings: 3,
    gearbox_select: 'GB-2050',
    electric_motor_select: 'EM-250-6P',
    hydraulic_pump_select: 'HP-250C',
    hydraulic_motor_select: 'HM-2090'
  }
];

export const FIELD_MAPS = {
  cable: /** @type {SelectConfig['fieldMap']} */ ({
    c_mm: 'c_mm',
    depth_m: 'depth_m',
    dead_m: 'dead_m',
    c_w_kgpm: 'c_w_kgpm'
  }),
  drum: /** @type {SelectConfig['fieldMap']} */ ({
    core_in: 'core_in',
    flange_dia_in: 'flange_dia_in',
    ftf_in: 'ftf_in',
    lebus_in: 'lebus_in',
    pack: 'pack',
    wraps_override: 'wraps_override'
  }),
  payload: /** @type {SelectConfig['fieldMap']} */ ({
    payload_kg: 'payload_kg'
  }),
  gearbox: /** @type {SelectConfig['fieldMap']} */ ({
    gr1: 'gear_ratio_stage1',
    gr2: 'gear_ratio_stage2'
  }),
  electricMotor: /** @type {SelectConfig['fieldMap']} */ ({
    motor_eff: 'motor_eff',
    motor_max_rpm: 'motor_max_rpm',
    motor_hp: 'motor_hp',
    motor_tmax: 'motor_tmax_Nm'
  }),
  hydraulicPump: /** @type {SelectConfig['fieldMap']} */ ({
    h_pump_cc: 'pump_disp_cc',
    h_max_psi: 'pump_max_psi'
  }),
  hydraulicMotor: /** @type {SelectConfig['fieldMap']} */ ({
    h_hmot_cc: 'hyd_motor_disp_cc',
    h_hmot_rpm_max: 'hyd_motor_max_rpm'
  }),
  hpuMotor: /** @type {SelectConfig['fieldMap']} */ ({
    h_emotor_hp: 'h_emotor_hp',
    h_emotor_rpm: 'h_emotor_rpm'
  }),
  hpu: /** @type {SelectConfig['fieldMap']} */ ({
    h_pump_strings: 'h_pump_strings',
    hpu_motor_select: 'hpu_motor_select',
    hydraulic_pump_select: 'hydraulic_pump_select'
  }),
  system: /** @type {SelectConfig['fieldMap']} */ ({
    cable_select: 'cable_select',
    drum_select: 'drum_select',
    payload_select: 'payload_select',
    core_in: 'core_in',
    ftf_in: 'ftf_in',
    lebus_in: 'lebus_in',
    pack: 'pack',
    motors: 'motors',
    h_pump_strings: 'h_pump_strings',
    hpu_select: 'hpu_select',
    hpu_motor_select: 'hpu_motor_select',
    gearbox_select: 'gearbox_select',
    electric_motor_select: 'electric_motor_select',
    hydraulic_pump_select: 'hydraulic_pump_select',
    hydraulic_motor_select: 'hydraulic_motor_select'
  })
};

/** @type {SelectConfig[]} */
const SELECT_CONFIGS = [
  {
    selectId: 'cable_select',
    options: CABLE_OPTIONS,
    fieldMap: FIELD_MAPS.cable
  },
  {
    selectId: 'drum_select',
    options: DRUM_OPTIONS,
    fieldMap: FIELD_MAPS.drum
  },
  {
    selectId: 'payload_select',
    options: PAYLOAD_OPTIONS,
    fieldMap: FIELD_MAPS.payload
  },
  {
    selectId: 'gearbox_select',
    options: GEARBOX_OPTIONS,
    fieldMap: FIELD_MAPS.gearbox
  },
  {
    selectId: 'electric_motor_select',
    options: ELECTRIC_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.electricMotor
  },
  {
    selectId: 'hpu_motor_select',
    options: HPU_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.hpuMotor
  },
  {
    selectId: 'hpu_select',
    options: HPU_OPTIONS,
    fieldMap: FIELD_MAPS.hpu
  },
  {
    selectId: 'hydraulic_pump_select',
    options: HYDRAULIC_PUMP_OPTIONS,
    fieldMap: FIELD_MAPS.hydraulicPump
  },
  {
    selectId: 'hydraulic_motor_select',
    options: HYDRAULIC_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.hydraulicMotor
  },
  {
    selectId: 'system_select',
    options: SYSTEM_OPTIONS,
    fieldMap: FIELD_MAPS.system,
    initialSkipEvents: false
  }
];

const watchedInputs = new Set();

function describeOption(config, option) {
  const parts = [option.name ?? option.pn];
  if (option.description) parts.push(option.description);
  return parts.join(' — ');
}

function attachWatcher(inputId) {
  if (watchedInputs.has(inputId)) return;
  const el = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
  if (!el) return;
  const handler = () => {
    if (el.dataset.componentSuppress === '1') return;
    const selectId = el.dataset.componentSelect;
    if (!selectId) return;
    delete el.dataset.componentSelect;
    delete el.dataset.componentPn;
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
    if (selectEl && selectEl.value) {
      selectEl.value = '';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  if (el instanceof HTMLInputElement) {
    const type = el.type;
    if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'color') {
      el.addEventListener('change', handler);
    } else {
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    }
  } else if (el instanceof HTMLSelectElement) {
    el.addEventListener('change', handler);
  } else if (el instanceof HTMLTextAreaElement) {
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  } else {
    el.addEventListener('change', handler);
  }
  watchedInputs.add(inputId);
}

function applySelection(config, pn, { skipEvents = false } = {}) {
  const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
  if (!selectEl) return;
  const option = config.options.find(opt => opt.pn === pn);
  const fieldEntries = Object.entries(config.fieldMap);
  if (!option) {
    fieldEntries.forEach(([inputId]) => {
      const inputEl = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
      if (!inputEl) return;
      if (inputEl.dataset.componentSelect === config.selectId) {
        delete inputEl.dataset.componentSelect;
        delete inputEl.dataset.componentPn;
      }
    });
    return;
  }

  fieldEntries.forEach(([inputId, optionKey]) => {
    const inputEl = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
    if (!inputEl) return;
    const value = option[optionKey];
    if (value == null) return;
    inputEl.dataset.componentSelect = config.selectId;
    inputEl.dataset.componentPn = option.pn;
    inputEl.dataset.componentSuppress = '1';
    if (inputEl instanceof HTMLInputElement) {
      if (inputEl.type === 'checkbox') {
        inputEl.checked = Boolean(value);
      } else {
        inputEl.value = String(value);
      }
    } else if (inputEl instanceof HTMLSelectElement || inputEl instanceof HTMLTextAreaElement) {
      inputEl.value = String(value);
    } else {
      inputEl.textContent = String(value);
    }
    if (!skipEvents) {
      if (inputEl instanceof HTMLInputElement) {
        if (inputEl.type !== 'checkbox' && inputEl.type !== 'radio' && inputEl.type !== 'range' && inputEl.type !== 'color') {
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    delete inputEl.dataset.componentSuppress;
  });
}

export function setupComponentSelectors() {
  SELECT_CONFIGS.forEach(config => {
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
    if (!selectEl) return;
    const initialValue = selectEl.value;
    const { initialSkipEvents = true } = config;

    // Populate the select list
    // Clear any existing dynamic options while preserving the first custom option
    const firstOption = selectEl.querySelector('option');
    selectEl.innerHTML = '';
    if (firstOption && firstOption.value === '') {
      selectEl.appendChild(firstOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Custom (manual input)';
      selectEl.appendChild(opt);
    }

    config.options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.pn;
      opt.textContent = describeOption(config, option);
      selectEl.appendChild(opt);
    });

    selectEl.value = initialValue;

    Object.keys(config.fieldMap).forEach(inputId => attachWatcher(inputId));

    selectEl.addEventListener('change', () => {
      applySelection(config, selectEl.value);
    });

    // Apply persisted selection if present
    if (selectEl.value) {
      applySelection(config, selectEl.value, { skipEvents: initialSkipEvents });
    }
  });
}
