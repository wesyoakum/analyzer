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
 * @property {number|string|boolean} [system_type_select]
 * @property {number|string|boolean} [winch_type_select]
 * @property {number|string|boolean} [rated_swl_kgf]
 * @property {number|string|boolean} [rated_speed_mpm]
 * @property {number|string|boolean} [dead_m]
 * @property {number|string|boolean} [depth_m]
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
 * @property {number|string|boolean} [gearbox_select]
 * @property {number|string|boolean} [electric_motor_select]
 * @property {number|string|boolean} [hydraulic_motor_select]
 * @property {number|string|boolean} [hydraulic_pump_select]
 * @property {number|string|boolean} [payload_select]
 * @property {number|string|boolean} [cable_select]
 * @property {number|string|boolean} [drum_select]
 * @property {number|string|boolean} [h_pump_strings]
 * @property {string} [hpu_select]
 * @property {string} [hpu_motor_select]
 * @property {number|string|boolean} [h_emotor_hp]
 * @property {number|string|boolean} [h_emotor_rpm]
 * @property {Record<string, unknown>} [metadata]
 * @property {Record<string, unknown>} [data]
 */

/**
 * @typedef {Object} SelectConfig
 * @property {string} selectId
 * @property {ComponentOption[]} options
 * @property {string} type
 * @property {string} label
 * @property {Record<string, keyof ComponentOption>} fieldMap
 * @property {boolean} [initialSkipEvents]
 * @property {ComponentOption[]} [customOptions]
 */

/** @type {ComponentOption[]} */
export const CABLE_OPTIONS = [
  {
    pn: '.681 Umbilical',
    description: '0.681 in diameter umbilical',
    c_mm: 17.3
  },
  {
    pn: '.322 Umbilical',
    description: '0.322 in diameter umbilical',
    c_mm: 8.18
  },
  {
    pn: '9/16 3x19 Wire Rope',
    description: '9/16 in 3×19 wire rope',
    c_mm: 14.29
  },
  {
    pn: '34 mm Umbilical',
    description: '34 mm diameter umbilical',
    c_mm: 34
  },
  {
    pn: '39 mm Umbilical',
    description: '39 mm diameter umbilical',
    c_mm: 39
  }
];

/** @type {ComponentOption[]} */
export const DRUM_OPTIONS = [
  {
    pn: 'CTW513',
    description: '70.5 in core, 90.5 in FTF, 110 in Flange',
    core_in: 70.5,
    flange_dia_in: 110,
    ftf_in: 90.5
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
    pn: 'LAM90-18-405TC',
    name: '90 HP AC Motor',
    description: 'PN LAM90-18-405TC — 90 hp, 359.029 N·m, 1785 rpm',
    motor_hp: 90,
    motor_max_rpm: 1785,
    motor_tmax_Nm: 359.029
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
    pn: 'LAM110-12-444TC',
    name: '110 HP AC Motor',
    description: 'PN LAM110-12-444TC — 110 hp, 652.736 N·m, 1200 rpm',
    motor_hp: 110,
    motor_max_rpm: 1200,
    motor_tmax_Nm: 652.736
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
export const HPU_OPTIONS = [
  {
    pn: 'CTH1025',
    name: 'CTH1025',
    description: '25 hp AC motor, 1 pump string',
    h_pump_strings: 1,
    h_emotor_hp: 25
  },
  {
    pn: 'CTH1030',
    name: 'CTH1030',
    description: '30 hp AC motor, 1 pump string',
    h_pump_strings: 1,
    h_emotor_hp: 30
  },
  {
    pn: 'CTH2150',
    name: 'CTH2150',
    description: '75 hp AC motors, 2 pump strings',
    h_pump_strings: 2,
    h_emotor_hp: 75
  },
  {
    pn: 'CTH2300',
    name: 'CTH2300',
    description: '150 hp AC motors, 2 pump strings, 210 cc pumps',
    h_pump_strings: 2,
    h_emotor_hp: 150,
    pump_disp_cc: 210
  }
];

/** @type {ComponentOption[]} */
export const SYSTEM_OPTIONS = [
  {
    pn: 'WINCH-513',
    description: 'Placeholder 513 Winch system',
    system_type_select: 'electric',
    winch_type_select: 'conventional',
    cable_select: 'CB-30-3000',
    drum_select: 'DR-705-118',
    payload_select: 'PL-8000',
    hpu_select: 'HPU-2S-210',
    hpu_motor_select: 'LAM75-18-365TC',
    rated_swl_kgf: 8000,
    rated_speed_mpm: 30,
    dead_m: 100,
    depth_m: 3000,
    core_in: 70.5,
    flange_dia_in: 122,
    ftf_in: 118,
    lebus_in: 0.75,
    pack: 0.88,
    wraps_override: 10,
    motors: 6,
    h_pump_strings: 2,
    gearbox_select: 'GB-123',
    gr1: 20,
    gr2: 5,
    gearbox_max_torque_Nm: 6000,
    electric_motor_select: 'EM-200-4P',
    hydraulic_pump_select: 'HP-210A',
    hydraulic_motor_select: 'HM-1580'
  },
  {
    pn: 'WINCH-900',
    description: 'Placeholder 900 Winch system',
    system_type_select: 'hydraulic',
    winch_type_select: 'traction',
    cable_select: 'CB-32-3500',
    drum_select: 'DR-82-132',
    payload_select: 'PL-10000',
    hpu_select: 'HPU-2S-250',
    hpu_motor_select: 'LAM110-12-444TC',
    rated_swl_kgf: 12000,
    rated_speed_mpm: 25,
    dead_m: 120,
    depth_m: 3500,
    core_in: 82,
    flange_dia_in: 138,
    ftf_in: 132,
    lebus_in: 0.6,
    pack: 0.9,
    wraps_override: 12,
    motors: 4,
    h_pump_strings: 3,
    gearbox_select: 'GB-2050',
    gr1: 22,
    gr2: 6,
    gearbox_max_torque_Nm: 8200,
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
    gr2: 'gear_ratio_stage2',
    gearbox_max_torque_Nm: 'gearbox_max_torque_Nm'
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
    motor_hp: 'h_emotor_hp',
    motor_max_rpm: 'h_emotor_rpm'
  }),
  hpu: /** @type {SelectConfig['fieldMap']} */ ({
    h_pump_strings: 'h_pump_strings',
    h_emotor_hp: 'h_emotor_hp',
    h_emotor_rpm: 'h_emotor_rpm',
    h_pump_cc: 'pump_disp_cc',
    hpu_motor_select: 'hpu_motor_select',
    hydraulic_pump_select: 'hydraulic_pump_select'
  }),
  system: /** @type {SelectConfig['fieldMap']} */ ({
    system_type_select: 'system_type_select',
    winch_type_select: 'winch_type_select',
    cable_select: 'cable_select',
    drum_select: 'drum_select',
    payload_select: 'payload_select',
    rated_swl_kgf: 'rated_swl_kgf',
    rated_speed_mpm: 'rated_speed_mpm',
    dead_m: 'dead_m',
    depth_m: 'depth_m',
    core_in: 'core_in',
    ftf_in: 'ftf_in',
    lebus_in: 'lebus_in',
    pack: 'pack',
    wraps_override: 'wraps_override',
    motors: 'motors',
    h_pump_strings: 'h_pump_strings',
    hpu_select: 'hpu_select',
    hpu_motor_select: 'hpu_motor_select',
    gearbox_select: 'gearbox_select',
    gr1: 'gear_ratio_stage1',
    gr2: 'gear_ratio_stage2',
    gearbox_max_torque_Nm: 'gearbox_max_torque_Nm',
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
    type: 'cable',
    label: 'Cable',
    fieldMap: FIELD_MAPS.cable
  },
  {
    selectId: 'drum_select',
    options: DRUM_OPTIONS,
    type: 'drum',
    label: 'Drum',
    fieldMap: FIELD_MAPS.drum
  },
  {
    selectId: 'payload_select',
    options: PAYLOAD_OPTIONS,
    type: 'payload',
    label: 'Payload',
    fieldMap: FIELD_MAPS.payload
  },
  {
    selectId: 'gearbox_select',
    options: GEARBOX_OPTIONS,
    type: 'gearbox',
    label: 'Gearbox',
    fieldMap: FIELD_MAPS.gearbox
  },
  {
    selectId: 'electric_motor_select',
    options: ELECTRIC_MOTOR_OPTIONS,
    type: 'electric-motor',
    label: 'Electric Motor',
    fieldMap: FIELD_MAPS.electricMotor
  },
  {
    selectId: 'hpu_motor_select',
    options: ELECTRIC_MOTOR_OPTIONS,
    type: 'hpu-motor',
    label: 'HPU Motor',
    fieldMap: FIELD_MAPS.hpuMotor
  },
  {
    selectId: 'hpu_select',
    options: HPU_OPTIONS,
    type: 'hpu',
    label: 'HPU',
    fieldMap: FIELD_MAPS.hpu
  },
  {
    selectId: 'hydraulic_pump_select',
    options: HYDRAULIC_PUMP_OPTIONS,
    type: 'hydraulic-pump',
    label: 'Hydraulic Pump',
    fieldMap: FIELD_MAPS.hydraulicPump
  },
  {
    selectId: 'hydraulic_motor_select',
    options: HYDRAULIC_MOTOR_OPTIONS,
    type: 'hydraulic-motor',
    label: 'Hydraulic Motor',
    fieldMap: FIELD_MAPS.hydraulicMotor
  },
  {
    selectId: 'system_select',
    options: SYSTEM_OPTIONS,
    type: 'system',
    label: 'System',
    fieldMap: FIELD_MAPS.system,
    initialSkipEvents: false
  }
];

const watchedInputs = new Set();
const CREATE_NEW_VALUE = '__component_create_new__';
const SAVE_CURRENT_VALUE = '__component_save_current__';
const SAVE_CURRENT_LABEL = 'Save Current Preset';
const COMPONENT_STORAGE_PREFIX = 'analyzer.components.';
/** @type {Map<string, ComponentOption[]>} */
const memoryCustomOptions = new Map();
let cachedComponentStorage;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergePresetMetadata(...sources) {
  /** @type {Record<string, unknown>} */
  const result = {};
  sources.forEach(source => {
    if (!isPlainObject(source)) {
      return;
    }
    Object.entries(source).forEach(([key, value]) => {
      if (key === 'fieldMap' && isPlainObject(value)) {
        const existingFieldMap =
          isPlainObject(result.fieldMap) ? { .../** @type {Record<string, unknown>} */ (result.fieldMap) } : {};
        result.fieldMap = { ...existingFieldMap, .../** @type {Record<string, unknown>} */ (value) };
        return;
      }
      result[key] = value;
    });
  });
  return result;
}

function buildMetadataForConfig(option, config) {
  const metadata = mergePresetMetadata(option && isPlainObject(option.metadata) ? option.metadata : {});
  if (option && typeof option.pn === 'string' && option.pn) {
    if (typeof metadata.pn !== 'string' || !metadata.pn) {
      metadata.pn = option.pn;
    }
  }
  if (config && typeof config.type === 'string' && config.type) {
    metadata.type = config.type;
  }
  if (config && typeof config.label === 'string' && config.label) {
    metadata.label = config.label;
  }
  if (config && isPlainObject(config.fieldMap)) {
    const entries = Object.entries(config.fieldMap).filter(([, optionKey]) => typeof optionKey === 'string' && optionKey);
    if (entries.length) {
      const fieldMap =
        isPlainObject(metadata.fieldMap) ? { .../** @type {Record<string, string>} */ (metadata.fieldMap) } : {};
      entries.forEach(([inputId, optionKey]) => {
        fieldMap[inputId] = /** @type {string} */ (optionKey);
      });
      metadata.fieldMap = fieldMap;
    }
  }
  return metadata;
}

function cloneOption(option) {
  const clone = { ...option };
  if (isPlainObject(option.metadata)) {
    clone.metadata = { ...option.metadata };
  }
  if (isPlainObject(option.data)) {
    clone.data = { ...option.data };
  }
  return clone;
}

function rememberCustomOptions(type, options) {
  if (!type) return;
  const list = Array.isArray(options) ? options.map(cloneOption) : [];
  memoryCustomOptions.set(type, list);
}

function getRememberedCustomOptions(type) {
  if (!type) return [];
  const existing = memoryCustomOptions.get(type);
  return existing ? existing.map(cloneOption) : [];
}

function persistCustomOptions(type) {
  if (!type) return;
  const storage = getComponentStorage();
  if (!storage) return;
  try {
    const snapshot = memoryCustomOptions.get(type) ?? [];
    storage.setItem(`${COMPONENT_STORAGE_PREFIX}${type}`, JSON.stringify(snapshot));
  } catch (err) {
    console.warn(`Unable to persist custom ${type} options:`, err);
  }
}

function refreshSelectsForType(type) {
  if (!type) return;
  const snapshot = getRememberedCustomOptions(type);
  SELECT_CONFIGS.forEach(config => {
    if (config.type !== type) return;
    config.customOptions = snapshot.map(cloneOption);
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
    if (!selectEl) return;
    const prior = selectEl.value;
    populateSelectOptions(selectEl, config, { selectedValue: prior });
    selectEl.dispatchEvent(new Event('component:options-refreshed'));
  });
}

function replaceCustomOptions(type, options, { persist = true } = {}) {
  if (!type) return;
  rememberCustomOptions(type, options);
  refreshSelectsForType(type);
  if (persist) {
    persistCustomOptions(type);
  }
}

function optionIdentity(option) {
  if (!option) return null;
  if (typeof option.id === 'string' && option.id.length) {
    return `id:${option.id}`;
  }
  if (typeof option.pn === 'string' && option.pn.length) {
    return `pn:${option.pn.toLowerCase()}`;
  }
  return null;
}

function mergeCustomOptionLists(existing, incoming) {
  const result = Array.isArray(existing) ? existing.map(cloneOption) : [];
  if (!Array.isArray(incoming)) {
    return result;
  }
  incoming.forEach(option => {
    const key = optionIdentity(option);
    if (!key) return;
    const clone = cloneOption(option);
    const index = result.findIndex(item => optionIdentity(item) === key);
    if (index >= 0) {
      result[index] = clone;
    } else {
      result.push(clone);
    }
  });
  return result;
}

function upsertCustomOption(type, option, { persist = true } = {}) {
  if (!type) return;
  const existing = memoryCustomOptions.get(type) ?? [];
  const merged = mergeCustomOptionLists(existing, [option]);
  replaceCustomOptions(type, merged, { persist });
}

function normalizePresetDataForOption(data, fieldMap) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const normalized = {};
  const entries = Object.entries(data);
  const fieldMapEntries =
    fieldMap && typeof fieldMap === 'object' && !Array.isArray(fieldMap)
      ? Object.entries(fieldMap)
      : [];
  const inputIds = new Set(fieldMapEntries.map(([inputId]) => inputId));

  entries.forEach(([key, value]) => {
    if (!inputIds.has(key)) {
      normalized[key] = value;
    }
  });

  fieldMapEntries.forEach(([inputId, optionKey]) => {
    if (typeof optionKey !== 'string' || optionKey.length === 0) return;
    if (Object.prototype.hasOwnProperty.call(data, optionKey)) {
      normalized[optionKey] = data[optionKey];
      return;
    }
    if (Object.prototype.hasOwnProperty.call(data, inputId)) {
      normalized[optionKey] = data[inputId];
    }
  });

  return normalized;
}

function extractOptionData(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object') return result;
  Object.entries(raw).forEach(([key, value]) => {
    if (key === 'pn' || key === 'name' || key === 'description' || key === 'id' || key === 'metadata' || key === 'data') {
      return;
    }
    result[key] = value;
  });
  return result;
}

function normalizeStoredOption(raw, expectedType) {
  if (!raw || typeof raw !== 'object') return null;

  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : null;
  const type = metadata && typeof metadata.type === 'string' ? metadata.type : undefined;
  if (type && expectedType && type !== expectedType) {
    return null;
  }

  const pnFromMetadata = metadata && typeof metadata.pn === 'string' ? metadata.pn : undefined;
  const pnFromRaw = typeof raw.pn === 'string' ? raw.pn : undefined;
  const optionPn = pnFromRaw ?? pnFromMetadata;
  const optionName =
    typeof raw.name === 'string' && raw.name.trim().length ? raw.name : optionPn ?? (pnFromMetadata ?? undefined);
  const description = typeof raw.description === 'string' && raw.description.length ? raw.description : undefined;
  const id = typeof raw.id === 'string' ? raw.id : undefined;

  const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? normalizePresetDataForOption(raw.data, metadata?.fieldMap)
    : extractOptionData(raw);

  const pn = optionPn ?? optionName;
  if (!pn || typeof pn !== 'string') {
    return null;
  }

  const option = {
    pn,
    name: optionName ?? pn,
    ...(description ? { description } : {}),
    ...data
  };

  if (id) {
    option.id = id;
  }

  if (metadata) {
    option.metadata = { ...metadata };
  }

  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    option.data = { ...raw.data };
  }

  return option;
}

function getComponentStorage() {
  if (cachedComponentStorage !== undefined) return cachedComponentStorage;
  if (typeof window === 'undefined' || !window.localStorage) {
    cachedComponentStorage = null;
    return cachedComponentStorage;
  }
  try {
    const { localStorage } = window;
    const probe = `${COMPONENT_STORAGE_PREFIX}__probe__`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    cachedComponentStorage = localStorage;
  } catch (err) {
    console.warn('Component preset storage disabled:', err);
    cachedComponentStorage = null;
  }
  return cachedComponentStorage;
}

function loadCustomOptions(type) {
  const storage = getComponentStorage();
  if (storage) {
    try {
      const raw = storage.getItem(`${COMPONENT_STORAGE_PREFIX}${type}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map(opt => normalizeStoredOption(opt, type))
            .filter((opt) => opt && typeof opt.pn === 'string')
            .map(opt => ({ ...opt, name: opt.name ?? opt.pn }));
        }
      }
    } catch (err) {
      console.warn(`Unable to read custom ${type} options:`, err);
    }
  }
  return getRememberedCustomOptions(type)
    .map(opt => normalizeStoredOption(opt, type))
    .filter((opt) => opt && typeof opt.pn === 'string')
    .map(opt => ({ ...opt, name: opt.name ?? opt.pn }));
}

function allOptions(config) {
  const base = Array.isArray(config.options) ? config.options : [];
  const custom = Array.isArray(config.customOptions) ? config.customOptions : [];
  return base.concat(custom);
}

function findOption(config, pn) {
  return allOptions(config).find(opt => opt.pn === pn);
}

function readFieldValue(inputId) {
  const el = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
  if (!el) return undefined;
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      return el.checked;
    }
    if (el.type === 'number') {
      if (el.value === '') return undefined;
      const num = Number(el.value);
      return Number.isNaN(num) ? undefined : num;
    }
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  return el.textContent ?? undefined;
}

function collectValuesForConfig(config) {
  const result = {};
  Object.entries(config.fieldMap).forEach(([inputId, optionKey]) => {
    const value = readFieldValue(inputId);
    if (value !== undefined) {
      result[optionKey] = value;
    }
  });
  return result;
}

function populateSelectOptions(selectEl, config, { selectedValue } = {}) {
  const prior = selectedValue !== undefined ? selectedValue : selectEl.value;
  selectEl.innerHTML = '';
  const manualOpt = document.createElement('option');
  manualOpt.value = '';
  manualOpt.textContent = 'Custom (manual input)';
  selectEl.appendChild(manualOpt);

  allOptions(config).forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.pn;
    opt.textContent = describeOption(config, option);
    selectEl.appendChild(opt);
  });

  const createOpt = document.createElement('option');
  createOpt.value = CREATE_NEW_VALUE;
  createOpt.textContent = 'Create New';
  selectEl.appendChild(createOpt);

  const saveOpt = document.createElement('option');
  saveOpt.value = SAVE_CURRENT_VALUE;
  saveOpt.textContent = SAVE_CURRENT_LABEL;
  saveOpt.dataset.componentPresetSave = '1';
  saveOpt.disabled = true;
  selectEl.appendChild(saveOpt);

  if (prior && prior !== CREATE_NEW_VALUE && prior !== SAVE_CURRENT_VALUE && findOption(config, prior)) {
    selectEl.value = prior;
  } else if (prior === '') {
    selectEl.value = '';
  } else {
    selectEl.value = '';
  }
}

function ensureSavePresetOption(selectEl) {
  /** @type {HTMLOptionElement|null} */
  let option = selectEl.querySelector(`option[value="${SAVE_CURRENT_VALUE}"]`);
  if (!option) {
    option = document.createElement('option');
    option.value = SAVE_CURRENT_VALUE;
    option.textContent = SAVE_CURRENT_LABEL;
    option.dataset.componentPresetSave = '1';
    option.disabled = true;
    selectEl.appendChild(option);
  }
  return option;
}

async function handleCreateNew(config, selectEl) {
  const label = config.label || 'component';
  const pnInput = window.prompt(`Enter a part number for the new ${label} preset:`);
  if (pnInput == null) {
    return null;
  }
  const pn = pnInput.trim();
  if (!pn) {
    window.alert('A part number is required to create a preset.');
    return null;
  }

  const existing = allOptions(config).find(opt => opt.pn.toLowerCase() === pn.toLowerCase());
  if (existing) {
    window.alert(`A preset with part number "${pn}" already exists.`);
    return null;
  }

  const descriptionInput = window.prompt(`Enter a description for ${pn}:`);
  const description = descriptionInput == null ? '' : descriptionInput.trim();

  const values = collectValuesForConfig(config);
  const metadata = { pn };
  if (config.type) {
    metadata.type = config.type;
  }
  if (config.label) {
    metadata.label = config.label;
  }
  if (config.fieldMap && typeof config.fieldMap === 'object') {
    const entries = Object.entries(config.fieldMap).filter(([, optionKey]) => typeof optionKey === 'string' && optionKey);
    if (entries.length) {
      metadata.fieldMap = Object.fromEntries(entries);
    }
  }

  const payload = {
    name: pn,
    ...(description ? { description } : {}),
    data: values,
    metadata
  };

  const wasDisabled = selectEl.disabled;
  selectEl.disabled = true;
  try {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let message = `Failed to create ${label} preset.`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error?.message) {
          message = errorBody.error.message;
          if (Array.isArray(errorBody.error.details) && errorBody.error.details.length) {
            message = `${message}\n- ${errorBody.error.details.join('\n- ')}`;
          }
        }
      } catch (err) {
        // Ignore JSON parsing errors; fall back to generic message.
      }
      window.alert(message);
      return null;
    }

    let body;
    try {
      body = await response.json();
    } catch (err) {
      window.alert('Failed to parse server response when creating preset.');
      return null;
    }

    const preset = body?.preset;
    if (!preset || typeof preset.id !== 'string') {
      window.alert('Server response did not include the created preset.');
      return null;
    }

    const presetData =
      preset && typeof preset.data === 'object' && preset.data !== null && !Array.isArray(preset.data)
        ? preset.data
        : values;

    const serverMetadata =
      preset.metadata && typeof preset.metadata === 'object' && !Array.isArray(preset.metadata)
        ? preset.metadata
        : undefined;
    const mergedMetadata = {
      ...metadata,
      ...(serverMetadata ?? {})
    };
    if (!mergedMetadata.pn) {
      mergedMetadata.pn = pn;
    }
    if (config.type && !mergedMetadata.type) {
      mergedMetadata.type = config.type;
    }
    if (config.label && !mergedMetadata.label) {
      mergedMetadata.label = config.label;
    }

    const normalizedOptionData = normalizePresetDataForOption(presetData, mergedMetadata?.fieldMap);

    /** @type {ComponentOption} */
    const option = {
      pn,
      name: preset.name ?? pn,
      ...(preset.description ? { description: preset.description } : {}),
      ...normalizedOptionData,
      id: preset.id,
      metadata: { ...mergedMetadata },
      data: { ...presetData }
    };

    if (config.type) {
      upsertCustomOption(config.type, option);
    }
    return pn;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.alert(`Unable to create ${label} preset: ${message}`);
    return null;
  } finally {
    selectEl.disabled = wasDisabled;
  }
}

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
  const option = findOption(config, pn);
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
  const initializedTypes = new Set();
  SELECT_CONFIGS.forEach(config => {
    const type = config.type;
    if (!type || initializedTypes.has(type)) return;
    const loaded = loadCustomOptions(type);
    rememberCustomOptions(type, loaded);
    initializedTypes.add(type);
  });

  SELECT_CONFIGS.forEach(config => {
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
    if (!selectEl) return;

    const customOptions = getRememberedCustomOptions(config.type);
    config.customOptions = customOptions;

    const initialValue = selectEl.value;
    const { initialSkipEvents = true } = config;

    populateSelectOptions(selectEl, config, { selectedValue: initialValue });

    let isSavingPreset = false;
    let saveOption = ensureSavePresetOption(selectEl);
    const updateSaveOptionState = () => {
      saveOption = ensureSavePresetOption(selectEl);
      if (!saveOption) {
        return;
      }
      if (isSavingPreset) {
        saveOption.disabled = true;
        saveOption.textContent = 'Saving…';
        return;
      }
      saveOption.textContent = SAVE_CURRENT_LABEL;
      const option = findOption(config, selectEl.value);
      const isServerPreset = Boolean(option && typeof option.id === 'string' && option.id);
      const shouldEnable = isServerPreset && !selectEl.disabled;
      saveOption.disabled = !shouldEnable;
      if (isServerPreset && option && typeof option.id === 'string') {
        saveOption.dataset.presetId = option.id;
      } else {
        delete saveOption.dataset.presetId;
      }
    };

    selectEl.addEventListener('component:options-refreshed', () => {
      saveOption = ensureSavePresetOption(selectEl);
      updateSaveOptionState();
    });

    Object.keys(config.fieldMap).forEach(inputId => attachWatcher(inputId));

    let previousValue = selectEl.value && selectEl.value !== CREATE_NEW_VALUE ? selectEl.value : '';
    let suppressNext = false;

    const ensureOptionApplied = (value, { skipEvents = false } = {}) => {
      applySelection(config, value, { skipEvents });
    };

    const performSaveCurrentPreset = async () => {
      if (isSavingPreset) {
        return;
      }
      const option = findOption(config, selectEl.value);
      if (!option || typeof option.id !== 'string' || !option.id) {
        return;
      }

      const descriptor = option.name && option.name !== option.pn ? `${option.name} (${option.pn})` : option.pn;
      const label = config.label || 'component';
      const confirmMessage = [
        `Save the current ${label} settings to preset "${descriptor}"?`,
        'This will overwrite the version stored on the server.'
      ].join('\n\n');
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }

      isSavingPreset = true;
      const wasSelectDisabled = selectEl.disabled;
      selectEl.disabled = true;
      updateSaveOptionState();

      try {
        const values = collectValuesForConfig(config);
        const payloadMetadata = buildMetadataForConfig(option, config);
        const payload = {
          id: option.id,
          name: option.name ?? option.pn,
          ...(option.description ? { description: option.description } : {}),
          data: values,
          metadata: payloadMetadata
        };

        let response;
        try {
          response = await fetch('/api/presets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          window.alert(`Unable to save preset: ${message}`);
          return;
        }

        if (!response.ok) {
          let message = 'Failed to save preset.';
          try {
            const errorBody = await response.json();
            if (errorBody?.error?.message) {
              message = errorBody.error.message;
              if (Array.isArray(errorBody.error.details) && errorBody.error.details.length) {
                message = `${message}\n- ${errorBody.error.details.join('\n- ')}`;
              }
            }
          } catch (err) {
            // Ignore JSON parsing errors; fall back to generic message.
          }
          window.alert(message);
          return;
        }

        let body;
        try {
          body = await response.json();
        } catch (err) {
          window.alert('Failed to parse server response when saving preset.');
          return;
        }

        const preset = body?.preset;
        if (!preset || typeof preset.id !== 'string') {
          window.alert('Server response did not include the updated preset.');
          return;
        }

        const presetData =
          preset && typeof preset.data === 'object' && preset.data !== null && !Array.isArray(preset.data)
            ? preset.data
            : values;
        const serverMetadata =
          preset.metadata && typeof preset.metadata === 'object' && !Array.isArray(preset.metadata)
            ? preset.metadata
            : undefined;
        const mergedMetadata = mergePresetMetadata(option.metadata, payloadMetadata, serverMetadata);
        if (option.pn && (typeof mergedMetadata.pn !== 'string' || !mergedMetadata.pn)) {
          mergedMetadata.pn = option.pn;
        }
        if (config.type && (!mergedMetadata.type || typeof mergedMetadata.type !== 'string')) {
          mergedMetadata.type = config.type;
        }
        if (config.label && (!mergedMetadata.label || typeof mergedMetadata.label !== 'string')) {
          mergedMetadata.label = config.label;
        }

        const normalizedOptionData = normalizePresetDataForOption(presetData, mergedMetadata?.fieldMap);
        /** @type {ComponentOption} */
        const updatedOption = {
          pn: mergedMetadata.pn && typeof mergedMetadata.pn === 'string' ? mergedMetadata.pn : option.pn,
          name: preset.name ?? option.name ?? option.pn,
          ...(preset.description ? { description: preset.description } : option.description ? { description: option.description } : {}),
          ...normalizedOptionData,
          id: option.id,
          metadata: isPlainObject(mergedMetadata) ? { ...mergedMetadata } : undefined,
          data: isPlainObject(presetData) ? { ...presetData } : undefined
        };
        if (typeof preset.updatedAt === 'string') {
          updatedOption.updatedAt = preset.updatedAt;
        } else if (option.updatedAt) {
          updatedOption.updatedAt = option.updatedAt;
        }

        if (config.type) {
          upsertCustomOption(config.type, updatedOption);
        }

        const updatedPn = updatedOption.pn ?? option.pn;
        if (updatedPn) {
          previousValue = updatedPn;
          selectEl.value = updatedPn;
        }
      } finally {
        isSavingPreset = false;
        selectEl.disabled = wasSelectDisabled;
        updateSaveOptionState();
      }
    };

    selectEl.addEventListener('change', async () => {
      if (suppressNext) {
        suppressNext = false;
        previousValue = selectEl.value;
        ensureOptionApplied(selectEl.value);
        updateSaveOptionState();
        return;
      }

      const value = selectEl.value;
      if (value === SAVE_CURRENT_VALUE) {
        const revertValue = previousValue || '';
        selectEl.value = revertValue;
        await performSaveCurrentPreset();
        updateSaveOptionState();
        return;
      }

      if (value === CREATE_NEW_VALUE) {
        selectEl.value = previousValue;
        const createdPn = await handleCreateNew(config, selectEl);
        if (createdPn) {
          previousValue = createdPn;
          suppressNext = true;
          selectEl.value = createdPn;
          ensureOptionApplied(createdPn);
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          ensureOptionApplied(previousValue);
        }
        updateSaveOptionState();
        return;
      }

      previousValue = value;
      ensureOptionApplied(value);
      updateSaveOptionState();
    });

    // Apply persisted selection if present
    if (selectEl.value) {
      ensureOptionApplied(selectEl.value, { skipEvents: initialSkipEvents });
    }

    updateSaveOptionState();
  });

  void fetchAndApplyServerPresets();
}

async function fetchAndApplyServerPresets() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  let response;
  try {
    response = await fetch('/api/presets');
  } catch (err) {
    console.warn('Unable to fetch presets from server:', err);
    return;
  }

  if (!response.ok) {
    console.warn('Failed to load presets from server.');
    return;
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    console.warn('Unable to parse presets response from server:', err);
    return;
  }

  const presets = Array.isArray(body?.presets) ? body.presets : [];
  if (!presets.length) {
    return;
  }

  /** @type {Map<string, ComponentOption[]>} */
  const grouped = new Map();

  presets.forEach(preset => {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
      return;
    }
    const metadata =
      preset.metadata && typeof preset.metadata === 'object' && !Array.isArray(preset.metadata)
        ? preset.metadata
        : undefined;
    const type = metadata && typeof metadata.type === 'string' ? metadata.type : undefined;
    if (!type) {
      return;
    }
    const option = normalizeStoredOption(preset, type);
    if (!option) {
      return;
    }
    if (metadata) {
      option.metadata = { ...metadata, ...(option.metadata ?? {}) };
    }
    if (!option.metadata) {
      option.metadata = {};
    }
    if (typeof option.metadata.pn !== 'string') {
      option.metadata.pn = option.pn;
    }
    if (type && option.metadata.type !== type) {
      option.metadata.type = type;
    }
    if (preset.data && typeof preset.data === 'object' && !Array.isArray(preset.data)) {
      option.data = { ...preset.data };
    }
    const list = grouped.get(type) ?? [];
    list.push(option);
    grouped.set(type, list);
  });

  grouped.forEach((options, type) => {
    if (!options.length) {
      return;
    }
    const existing = getRememberedCustomOptions(type);
    const merged = mergeCustomOptionLists(existing, options);
    replaceCustomOptions(type, merged, { persist: true });
  });
}
